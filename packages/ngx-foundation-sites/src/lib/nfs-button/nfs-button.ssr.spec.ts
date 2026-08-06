import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import { NfsButton } from './nfs-button';
import { NFS_BUTTON_STYLES } from './nfs-button.styles';

@Component({
  selector: 'nfs-button-ssr-host',
  imports: [NfsButton],
  template: `<button libNfsButton>Button</button>`,
})
class NfsButtonSsrHostComponent {}

const SSR_DOCUMENT =
  '<!doctype html><html><head></head><body><nfs-button-ssr-host></nfs-button-ssr-host></body></html>';

async function serverRenderNfsButton(): Promise<string> {
  return renderApplication(
    (context) =>
      bootstrapApplication(
        NfsButtonSsrHostComponent,
        { providers: [provideServerRendering()] },
        context,
      ),
    { document: SSR_DOCUMENT },
  );
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
