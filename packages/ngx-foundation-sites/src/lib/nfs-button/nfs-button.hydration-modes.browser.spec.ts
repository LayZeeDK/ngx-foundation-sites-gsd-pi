import { APP_ID, ApplicationRef, Component } from '@angular/core';
import {
  bootstrapApplication,
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import {
  provideServerRendering,
  renderApplication,
} from '@angular/platform-server';
import { NfsButton } from './nfs-button';
// @ts-expect-error -- raw asset import (Vite ?raw query), no ambient type in this tsconfig.
import earlyEventContractScript from '@angular/core/event-dispatch-contract.min.js?raw';

// Runs under Vitest Browser mode (real Chromium via @vitest/browser-playwright,
// see project.json's "test-browser" target) because these hydration modes
// (interaction-triggered incremental hydration, pre-hydration event replay)
// need real event dispatch/bubbling and dynamic-import timing that jsdom does
// not reliably reproduce.

@Component({
  selector: 'lib-nfs-button-replay-host',
  imports: [NfsButton],
  template: `<button nfsButton (click)="onClick()">Button</button>`,
})
class NfsButtonEventReplayHostComponent {
  clickCount = 0;

  onClick(): void {
    this.clickCount++;
  }
}

const REPLAY_SSR_DOCUMENT =
  '<!doctype html><html><head></head><body><lib-nfs-button-replay-host></lib-nfs-button-replay-host></body></html>';

// Scripts inserted via innerHTML assignment never execute (browser spec, not
// a jsdom quirk), so re-create each <script> to force it to run. Both
// withEventReplay()'s early event-capture contract and jsaction wiring for
// incremental-hydration triggers depend on their SSR-injected scripts
// actually executing on the client.
function renderSsrHtmlIntoDocument(html: string): void {
  const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
  document.head.innerHTML = parsedDocument.head.innerHTML;
  document.body.innerHTML = parsedDocument.body.innerHTML;

  for (const oldScript of [
    ...document.head.querySelectorAll('script'),
    ...document.body.querySelectorAll('script'),
  ]) {
    const newScript = document.createElement('script');

    for (const attribute of oldScript.attributes) {
      newScript.setAttribute(attribute.name, attribute.value);
    }

    newScript.textContent = oldScript.textContent;
    oldScript.replaceWith(newScript);
  }
}

// Mirrors the inline bootstrap script @angular/ssr injects into the real
// <head> of a served page (see node_modules/@angular/core/event-dispatch-contract.min.js,
// which assigns `window.__jsaction_bootstrap`). renderApplication() alone
// does not perform that index.html postprocessing, so both withEventReplay()
// and interaction-triggered incremental hydration -- which both gate on
// `window._ejsas[appId]` being populated before the client app bootstraps --
// would otherwise silently no-op.
// Container is `document.body`, matching what platform-server's
// insertEventRecordScript() passes in real SSR output (packages/platform-server/src/utils.ts).
function bootstrapEarlyJsactionContract(
  appId: string,
  bubbleEventTypes: string[],
  captureEventTypes: string[] = [],
): void {
  new Function(earlyEventContractScript as string)();

  (
    window as unknown as {
      __jsaction_bootstrap: (
        container: HTMLElement,
        appId: string,
        bubbleEventTypes: string[],
        captureEventTypes: string[],
      ) => void;
    }
  ).__jsaction_bootstrap(document.body, appId, bubbleEventTypes, captureEventTypes);
}

const REPLAY_APP_ID = 'nfs-button-replay-app';
const INCREMENTAL_APP_ID = 'nfs-button-incremental-app';

describe('NfsButton event replay (provideClientHydration(withEventReplay()))', () => {
  let appRef: ApplicationRef | undefined;

  afterEach(() => {
    appRef?.destroy();
    appRef = undefined;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('replays a click dispatched before hydration completes', async () => {
    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          NfsButtonEventReplayHostComponent,
          {
            providers: [
              provideServerRendering(),
              provideClientHydration(withEventReplay()),
              { provide: APP_ID, useValue: REPLAY_APP_ID },
            ],
          },
          context,
        ),
      { document: REPLAY_SSR_DOCUMENT },
    );

    renderSsrHtmlIntoDocument(html);
    bootstrapEarlyJsactionContract(REPLAY_APP_ID, ['click']);

    // Simulate a user clicking during the hydration gap, before
    // bootstrapApplication (and its event listeners) has run on the client.
    (document.querySelector('button') as HTMLButtonElement | null)?.click();

    appRef = await bootstrapApplication(NfsButtonEventReplayHostComponent, {
      providers: [
        provideClientHydration(withEventReplay()),
        { provide: APP_ID, useValue: REPLAY_APP_ID },
      ],
    });
    await appRef.whenStable();

    const hostComponent = appRef.components[0]
      .instance as NfsButtonEventReplayHostComponent;
    expect(hostComponent.clickCount).toBe(1);
  });
});

let incrementalProbeInstantiated = false;

@Component({
  selector: 'lib-nfs-button-incremental-probe',
  imports: [NfsButton],
  template: `<button nfsButton>Button</button>`,
})
class IncrementalHydrationProbeComponent {
  constructor() {
    incrementalProbeInstantiated = true;
  }
}

@Component({
  selector: 'lib-nfs-button-incremental-host',
  imports: [IncrementalHydrationProbeComponent],
  template: `
    @defer (hydrate on interaction) {
      <lib-nfs-button-incremental-probe />
    }
  `,
})
class NfsButtonIncrementalHydrationHostComponent {}

const INCREMENTAL_SSR_DOCUMENT =
  '<!doctype html><html><head></head><body><lib-nfs-button-incremental-host></lib-nfs-button-incremental-host></body></html>';

describe('NfsButton incremental hydration (@defer (hydrate on interaction))', () => {
  let appRef: ApplicationRef | undefined;

  beforeEach(() => {
    incrementalProbeInstantiated = false;
  });

  afterEach(() => {
    appRef?.destroy();
    appRef = undefined;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('defers hydrating the deferred block until the user interacts with it', async () => {
    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          NfsButtonIncrementalHydrationHostComponent,
          {
            providers: [
              provideServerRendering(),
              provideClientHydration(),
              { provide: APP_ID, useValue: INCREMENTAL_APP_ID },
            ],
          },
          context,
        ),
      { document: INCREMENTAL_SSR_DOCUMENT },
    );

    renderSsrHtmlIntoDocument(html);
    bootstrapEarlyJsactionContract(INCREMENTAL_APP_ID, ['click', 'keydown']);

    // renderApplication() runs in this same JS realm, so the server-side
    // instantiation of the probe (defer (hydrate ...) blocks always render
    // eagerly on the server) already flipped this flag -- reset it here so
    // the assertion below reflects client-side (hydration) behavior only.
    incrementalProbeInstantiated = false;

    appRef = await bootstrapApplication(
      NfsButtonIncrementalHydrationHostComponent,
      {
        providers: [
          provideClientHydration(),
          { provide: APP_ID, useValue: INCREMENTAL_APP_ID },
        ],
      },
    );
    await appRef.whenStable();

    // The block was server-rendered (hydrate blocks always render eagerly on
    // the server) but must not have instantiated its component on the client
    // yet -- hydration is deferred until the user interacts with it.
    expect(incrementalProbeInstantiated).toBe(false);

    (document.querySelector('button') as HTMLButtonElement | null)?.click();

    await appRef.whenStable();

    expect(incrementalProbeInstantiated).toBe(true);
  });
});
