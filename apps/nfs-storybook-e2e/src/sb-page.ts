import type { Page } from '@playwright/test';

// A minimal Storybook manager page object, modelled on storybookjs/storybook's
// own `SbPage` (code/e2e-sandbox/util.ts) -- not vendored, since that helper
// imports internal Storybook modules (`storybook/internal/csf`, sandbox
// templates) this workspace does not depend on. Only the ~4 accessors this
// addon's specs actually need (research/04 section 4.2).
const THEMING_PANEL_ID = 'nfs/theming/panel';

// Storybook persists panel size/position in sessionStorage across reloads
// (research/04 section 3.2 item 1); seeding a known layout before every
// navigation stops a collapsed/resized panel leaking in from a previous test.
const MANAGER_LAYOUT = {
  layout: { showToolbar: true, navSize: 300, bottomPanelHeight: 300, rightPanelWidth: 300 },
};

export class SbPage {
  constructor(private readonly page: Page) {}

  previewIframe() {
    return this.page.frameLocator('#storybook-preview-iframe');
  }

  previewRoot() {
    return this.previewIframe().locator('#storybook-root:visible, #storybook-docs:visible');
  }

  panelTabpanel() {
    return this.page.locator('#storybook-panel-root').getByRole('tabpanel');
  }

  themingPanelTab() {
    return this.page.getByRole('tab', { name: /^Theming/ });
  }

  themingStyleElement() {
    return this.previewIframe().locator('#nfs-theming');
  }

  themingPanelRoot() {
    return this.page.locator('[data-testid="nfs-theming-panel"]');
  }

  /**
   * Deep-links to a story with the Theming panel preselected -- fewer moving
   * parts than sidebar navigation (research/04 section 3.1). `globals`, when
   * given, is a raw `?globals=` value (e.g. read back from a prior
   * `page.url()`), so a theme selection survives a fresh full navigation to a
   * different story.
   */
  async gotoStory(storyId: string, globals?: string): Promise<void> {
    await this.page.addInitScript((layout) => {
      sessionStorage.setItem('@storybook/manager/store', JSON.stringify(layout));
    }, MANAGER_LAYOUT);

    const params = new URLSearchParams({ path: `/story/${storyId}`, addonPanel: THEMING_PANEL_ID });
    if (globals) {
      params.set('globals', globals);
    }
    await this.page.goto(`/?${params.toString()}`);
    await this.previewRoot().first().waitFor();
  }

  /** The current `?globals=` value Storybook has written into the URL. */
  currentGlobals(): string | null {
    return new URL(this.page.url()).searchParams.get('globals');
  }

  /**
   * Foundation's `.button` carries a 0.25s `background-color` transition
   * (research/04 section 3.2 item 2) -- any colour assertion racing it is
   * flaky. Must run against the preview FRAME (not the manager document),
   * so it uses the real `Frame`, not a `FrameLocator`.
   */
  async disablePreviewTransitions(): Promise<void> {
    const frame = this.page.frames().find((candidate) => candidate.url().includes('iframe.html'));
    await frame?.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
    // Storybook's own preview boot moves focus onto the first focusable
    // canvas element (confirmed live: reading a themed button's background
    // right after navigation consistently read Foundation's `:focus`/`:hover`
    // darkened variant, a stable ~20% lightness reduction, not a transient
    // transition artifact). Blur it so colour assertions read the resting
    // state the design's own hex literals describe.
    await frame?.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  }
}
