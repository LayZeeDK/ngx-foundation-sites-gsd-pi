import { APP_ID, ApplicationRef, Component } from '@angular/core';
import {
  bootstrapApplication,
  provideClientHydration,
} from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import { vi } from 'vitest';
import { NfsButton } from './nfs-button';

@Component({
  selector: 'lib-nfs-button-ssr-host',
  imports: [NfsButton],
  template: `<button nfsButton>Button</button>`,
})
class NfsButtonSsrHostComponent {}

const SSR_DOCUMENT =
  '<!doctype html><html><head></head><body><lib-nfs-button-ssr-host></lib-nfs-button-ssr-host></body></html>';

// Pinned explicitly rather than relying on Angular's default so the
// server-emitted `ng-app-id` value can be asserted exactly, and so the client
// bootstrap provably shares the id the server stamped -- ticket 01 named an
// APP_ID mismatch as the sole residual risk to style adoption.
const SSR_APP_ID = 'nfs-button-ssr-app';

/**
 * Locates the `<style>` element carrying NfsButton's compiled stylesheet,
 * identified by the `@layer nfs-defaults` wrapper authored in
 * `nfs-button.scss`.
 *
 * The at-rule name is a stable MARKER, not a CSS-text comparison: ticket 01
 * established that `SharedStylesHost` passes styles through verbatim while the
 * build does not (dev reformats and prepends an
 * `angular:styles/component:css` marker comment, production minifies), so only
 * element identity, element counts and attribute state are asserted here.
 */
function nfsDefaultsStyleElements(head: ParentNode): HTMLStyleElement[] {
  return [...head.querySelectorAll('style')].filter((element) =>
    element.textContent?.includes('@layer nfs-defaults'),
  );
}

async function serverRenderNfsButton(): Promise<string> {
  return renderApplication(
    (context) =>
      bootstrapApplication(
        NfsButtonSsrHostComponent,
        {
          providers: [
            provideServerRendering(),
            provideClientHydration(),
            { provide: APP_ID, useValue: SSR_APP_ID },
          ],
        },
        context,
      ),
    { document: SSR_DOCUMENT },
  );
}

interface HydrationResult {
  appRef: ApplicationRef;
  consoleMessages: string[];
  preHydrationButton: Element | null;
  preHydrationStyleElement: HTMLStyleElement | undefined;
}

async function hydrateNfsButton(ssrHtml: string): Promise<HydrationResult> {
  const parsedDocument = new DOMParser().parseFromString(ssrHtml, 'text/html');
  document.head.innerHTML = parsedDocument.head.innerHTML;
  document.body.innerHTML = parsedDocument.body.innerHTML;

  const preHydrationButton = document.querySelector('button');
  // Captured from `document.head` (not from the parsed document) because the
  // innerHTML assignment above creates fresh nodes -- this is the exact node
  // the client-side SharedStylesHost must adopt.
  const [preHydrationStyleElement] = nfsDefaultsStyleElements(document.head);

  const consoleMessages: string[] = [];
  const errorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => {
      consoleMessages.push(args.map(String).join(' '));
    });
  const warnSpy = vi
    .spyOn(console, 'warn')
    .mockImplementation((...args: unknown[]) => {
      consoleMessages.push(args.map(String).join(' '));
    });

  try {
    const appRef = await bootstrapApplication(NfsButtonSsrHostComponent, {
      providers: [
        provideClientHydration(),
        { provide: APP_ID, useValue: SSR_APP_ID },
      ],
    });
    await appRef.whenStable();
    return {
      appRef,
      consoleMessages,
      preHydrationButton,
      preHydrationStyleElement,
    };
  } finally {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  }
}

describe('NfsButton SSR (renderApplication)', () => {
  it('server-renders correct button markup', async () => {
    const html = await serverRenderNfsButton();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const button = doc.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.classList.contains('button')).toBe(true);
    expect(button?.textContent?.trim()).toBe('Button');
  });

  // R018 -- SSR/hydration safety, re-anchored to Angular's own server-side
  // style emission. Ticket 01: `SharedStylesHost.addElement` stamps
  // `ng-app-id="<APP_ID>"` on every style node it creates while
  // `ngServerMode` is set, and that attribute is the handle the client uses to
  // adopt the node instead of re-injecting it.
  it('inlines the component stylesheet into the server-rendered head, stamped with ng-app-id', async () => {
    const html = await serverRenderNfsButton();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const styleElements = nfsDefaultsStyleElements(doc.head);
    expect(styleElements).toHaveLength(1);
    expect(styleElements[0].getAttribute('ng-app-id')).toBe(SSR_APP_ID);
  });

  it('emits the stylesheet exactly once, with no second style element from a parallel mechanism', async () => {
    const html = await serverRenderNfsButton();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(doc.head.querySelectorAll('style')).toHaveLength(1);
  });
});

describe('NfsButton hydration (bootstrapApplication + provideClientHydration)', () => {
  let appRef: ApplicationRef | undefined;

  afterEach(() => {
    appRef?.destroy();
    appRef = undefined;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('hydrates the server-rendered markup with zero console errors or warnings', async () => {
    const html = await serverRenderNfsButton();
    const result = await hydrateNfsButton(html);
    appRef = result.appRef;

    expect(result.consoleMessages).toEqual([]);
  });

  it('reuses the server-rendered button element instead of creating a duplicate', async () => {
    const html = await serverRenderNfsButton();
    const result = await hydrateNfsButton(html);
    appRef = result.appRef;

    const hosts = document.querySelectorAll('lib-nfs-button-ssr-host');
    const buttons = document.querySelectorAll('button');
    expect(hosts.length).toBe(1);
    expect(buttons.length).toBe(1);
    expect(buttons[0]).toBe(result.preHydrationButton);
  });

  // Ticket 01's `addServerStyles` finding: the client adopts the
  // server-emitted node BY OBJECT IDENTITY (`inline.set(textContent, {usage:
  // 0, elements: [styleElement]})`), which is why D013's accepted
  // duplicate-`<style>` cost does not apply here.
  it('adopts the server-emitted <style> element by object identity rather than re-injecting it', async () => {
    const html = await serverRenderNfsButton();
    const result = await hydrateNfsButton(html);
    appRef = result.appRef;

    const styleElements = nfsDefaultsStyleElements(document.head);
    expect(styleElements).toHaveLength(1);
    expect(result.preHydrationStyleElement).toBeDefined();
    expect(styleElements[0]).toBe(result.preHydrationStyleElement);
  });

  it('strips ng-app-id from the adopted <style> element and marks it reused', async () => {
    const html = await serverRenderNfsButton();
    const result = await hydrateNfsButton(html);
    appRef = result.appRef;

    const [styleElement] = nfsDefaultsStyleElements(document.head);
    expect(styleElement.hasAttribute('ng-app-id')).toBe(false);
    // Dev-mode-only bookkeeping: `addUsage` stamps `ng-style-reused` when it
    // finds an existing record at usage 0, which is exactly the state
    // `addServerStyles` leaves an adopted server node in.
    expect(styleElement.hasAttribute('ng-style-reused')).toBe(true);
  });
});
