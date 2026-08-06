import { ApplicationRef, Component } from '@angular/core';
import {
  bootstrapApplication,
  provideClientHydration,
} from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import { vi } from 'vitest';
import { NfsButton } from './nfs-button';
import { NFS_BUTTON_STYLES } from './nfs-button.styles';

@Component({
  selector: 'lib-nfs-button-ssr-host',
  imports: [NfsButton],
  template: `<button libNfsButton>Button</button>`,
})
class NfsButtonSsrHostComponent {}

const SSR_DOCUMENT =
  '<!doctype html><html><head></head><body><lib-nfs-button-ssr-host></lib-nfs-button-ssr-host></body></html>';

async function serverRenderNfsButton(): Promise<string> {
  return renderApplication(
    (context) =>
      bootstrapApplication(
        NfsButtonSsrHostComponent,
        { providers: [provideServerRendering(), provideClientHydration()] },
        context,
      ),
    { document: SSR_DOCUMENT },
  );
}

interface HydrationResult {
  appRef: ApplicationRef;
  consoleMessages: string[];
  preHydrationButton: Element | null;
}

async function hydrateNfsButton(ssrHtml: string): Promise<HydrationResult> {
  const parsedDocument = new DOMParser().parseFromString(ssrHtml, 'text/html');
  document.head.innerHTML = parsedDocument.head.innerHTML;
  document.body.innerHTML = parsedDocument.body.innerHTML;

  const preHydrationButton = document.querySelector('button');

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
      providers: [provideClientHydration()],
    });
    await appRef.whenStable();
    return { appRef, consoleMessages, preHydrationButton };
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

  it('inlines NfsButton critical CSS into the server-rendered document head', async () => {
    const html = await serverRenderNfsButton();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const criticalCssElement = doc.querySelector(
      'style[data-nfs-critical-css="nfs-button"]',
    );
    expect(criticalCssElement).not.toBeNull();
    expect(criticalCssElement?.textContent).toBe(NFS_BUTTON_STYLES);
  });

  it('does not inject the browser-only NfsStyleLoader style element during server render', async () => {
    const html = await serverRenderNfsButton();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const styleLoaderElement = doc.querySelector(
      'style[data-nfs-style-id="nfs-button"]',
    );
    expect(styleLoaderElement).toBeNull();
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

  it('preserves the pre-hydration critical CSS style element in the document head', async () => {
    const html = await serverRenderNfsButton();
    const result = await hydrateNfsButton(html);
    appRef = result.appRef;

    const criticalCssElements = document.querySelectorAll(
      'style[data-nfs-critical-css="nfs-button"]',
    );
    expect(criticalCssElements.length).toBe(1);
    expect(criticalCssElements[0].textContent).toBe(NFS_BUTTON_STYLES);
  });
});
