import { expect, test, type Page } from '@playwright/test';
import { SbPage } from '../src/sb-page';

// R021 lane 3 -- the only lane that can reach the Storybook manager (addon
// panels, the manager<->preview globals channel, URL state). Everything here
// runs against `static-storybook` (the built artefact `verify-theming-bundle`
// also inspects), never the dev server -- this is the design's own "first run
// against static-storybook is an acceptance step, not an assumption".
//
// Foundation's default palette, for reference: primary #1779ba (rgb(23, 121,
// 186)), secondary #767676 (rgb(118, 118, 118)). The WCAG-compliant preset
// overrides exactly success/warning/alert: #238648 (rgb(35, 134, 72)),
// #9e6c00 (rgb(158, 108, 0)), #cb4b37 (rgb(203, 75, 55)).

async function seq(sb: SbPage): Promise<string | null> {
  return sb.themingStyleElement().getAttribute('data-nfs-seq');
}

/** Waits for the coalescer's sequence attribute to move past `previous` --
 * the addon's own readiness signal (research/10 section 4.3), never a
 * timeout. A non-incrementing seq is a compile that never happened. */
async function waitForNextSeq(sb: SbPage, previous: string | null): Promise<void> {
  await expect
    .poll(async () => seq(sb))
    .not.toBe(previous);
}

async function setup(page: Page, storyId = 'nfsbutton--primary'): Promise<SbPage> {
  const sb = new SbPage(page);
  await sb.gotoStory(storyId);
  await sb.disablePreviewTransitions();
  await expect(sb.themingPanelRoot()).toHaveAttribute('data-nfs-panel-state', 'ready');
  return sb;
}

test.describe('Theming addon panel (R009/R021 lane 3)', () => {
  test('P1: the addon loads -- Theming tab present, zero manager console.error', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    const sb = await setup(page);

    await expect(sb.themingPanelTab()).toBeVisible();
    await expect(sb.themingPanelTab()).toHaveAttribute('aria-selected', 'true');
    expect(consoleErrors).toEqual([]);
  });

  test('P6: the panel goes loading -> ready on first open', async ({ page }) => {
    const sb = new SbPage(page);
    await sb.gotoStory('nfsbutton--primary');

    // Auto-retrying: whatever the real loading window is (measured ~1ms), this
    // waits for the true end state rather than racing it.
    await expect(sb.themingPanelRoot()).toHaveAttribute('data-nfs-panel-state', 'ready');
  });

  test('P2: driving the primary control changes the button\'s computed background-colour, with a pre/post differential', async ({
    page,
  }) => {
    const sb = await setup(page);
    const button = sb.previewRoot().getByRole('button', { name: 'Primary button' });

    // Auto-retrying, per research/04 section 3.2 item 3: a one-shot
    // getComputedStyle read is unsafe against Foundation's 0.25s transition.
    await expect(button).toHaveCSS('background-color', 'rgb(23, 121, 186)');
    const before = await button.evaluate((el) => getComputedStyle(el).backgroundColor);

    const previousSeq = await seq(sb);
    await page.locator('#nfs-color-primary-text').fill('#112233');
    await waitForNextSeq(sb, previousSeq);

    await expect(button).toHaveCSS('background-color', 'rgb(17, 34, 51)');
    const after = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(after).not.toBe(before);
  });

  test('P3: selecting WCAG-compliant seeds all six controls by name, and the preview renders the compliant colours', async ({
    page,
  }) => {
    const sb = await setup(page);

    const previousSeq = await seq(sb);
    await page.locator(`#${'nfs-preset-select'}`).selectOption('WCAG-compliant');
    await waitForNextSeq(sb, previousSeq);

    // Every control asserted individually, by name -- not "something changed".
    await expect(page.locator('#nfs-color-primary-text')).toHaveValue('#1779ba');
    await expect(page.locator('#nfs-color-secondary-text')).toHaveValue('#767676');
    await expect(page.locator('#nfs-color-success-text')).toHaveValue('#238648');
    await expect(page.locator('#nfs-color-warning-text')).toHaveValue('#9e6c00');
    await expect(page.locator('#nfs-color-alert-text')).toHaveValue('#cb4b37');
    await expect(page.locator('#nfs-radius-stepper')).toHaveValue('0');

    const globals = sb.currentGlobals();
    expect(globals).toBeTruthy();

    for (const [storyName, buttonName, expectedRgb] of [
      ['success', 'Success button', 'rgb(35, 134, 72)'],
      ['warning', 'Warning button', 'rgb(158, 108, 0)'],
      ['alert', 'Alert button', 'rgb(203, 75, 55)'],
    ] as const) {
      const storySb = new SbPage(page);
      await storySb.gotoStory(`nfsbutton--${storyName}`, globals ?? undefined);
      await storySb.disablePreviewTransitions();
      await expect(storySb.previewRoot().getByRole('button', { name: buttonName })).toHaveCSS(
        'background-color',
        expectedRgb,
      );
    }
  });

  test('P4: tweaking one control after a preset flips the selector to Custom, and restoring it flips back', async ({
    page,
  }) => {
    const sb = await setup(page);

    let previousSeq = await seq(sb);
    await page.locator('#nfs-preset-select').selectOption('WCAG-compliant');
    await waitForNextSeq(sb, previousSeq);
    await expect(page.locator('#nfs-preset-select')).toHaveValue('WCAG-compliant');

    previousSeq = await seq(sb);
    await page.locator('#nfs-color-success-text').fill('#111111');
    await waitForNextSeq(sb, previousSeq);
    await expect(page.locator('#nfs-preset-select')).toHaveValue('Custom');

    previousSeq = await seq(sb);
    await page.locator('#nfs-color-success-text').fill('#238648');
    await waitForNextSeq(sb, previousSeq);
    await expect(page.locator('#nfs-preset-select')).toHaveValue('WCAG-compliant');
  });

  test('P5: ?globals= round-trips a single sparse override, and the default theme yields an empty param', async ({
    page,
  }) => {
    const sb = new SbPage(page);
    await sb.gotoStory('nfsbutton--primary', 'nfsTheme.primary:!hex(cb4b37)');
    await sb.disablePreviewTransitions();
    await expect(sb.themingPanelRoot()).toHaveAttribute('data-nfs-panel-state', 'ready');

    await expect(sb.previewRoot().getByRole('button', { name: 'Primary button' })).toHaveCSS(
      'background-color',
      'rgb(203, 75, 55)',
    );
    await expect(page.locator('#nfs-color-secondary-text')).toHaveValue('#767676');

    const previousSeq = await seq(sb);
    await page.locator('#nfs-preset-select').selectOption('Foundation default');
    await waitForNextSeq(sb, previousSeq);

    expect(sb.currentGlobals() || '').toBe('');
  });

  test('P7: a theme that fails to compile surfaces a visible error, and the last good CSS survives', async ({
    page,
  }) => {
    // The panel is the validation boundary (R009), so an invalid value cannot
    // be typed into a control -- but a hand-edited or stale shared link
    // bypasses it, which is the real-world route to a failed compile. Storybook
    // decodes this to the bare string `notacolor`, which reaches
    // `$background:` and produces the same Sass error T6 pins in lane 1.
    const sb = new SbPage(page);
    await sb.gotoStory('nfsbutton--primary', 'nfsTheme.primary:notacolor');
    await sb.disablePreviewTransitions();

    // R009: "the panel shows sassMessage plus a friendly source name derived
    // from span.url". Before the compile state was wired through the channel,
    // every one of these assertions was unsatisfiable -- the error was
    // computed, serialised across the Worker boundary, and handed to an empty
    // listener set, so the addon simply appeared to do nothing.
    await expect(sb.themingPanelRoot()).toHaveAttribute('data-nfs-panel-state', 'error');

    const errorBox = page.locator('[data-testid="nfs-theming-error"]');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText('is not a color');
    await expect(errorBox).toContainText('_button.scss');

    // D035 part e: the last good CSS is never cleared on error. Foundation's
    // default primary must still be on screen -- the preview neither goes
    // blank nor silently keeps a half-applied theme.
    await expect(sb.previewRoot().getByRole('button', { name: 'Primary button' })).toHaveCSS(
      'background-color',
      'rgb(23, 121, 186)',
    );

    // The panel is mounted only while its tab is active, so a switch away
    // destroys its React state. The error must survive the round trip -- the
    // preview holds it and replays it on remount. Without that, the four-state
    // contract stops holding after one tab switch and a compile that failed
    // while the user was on another tab is never reported at all.
    await sb.panelTab(/^Controls/).click();
    await expect(sb.themingPanelTab()).toHaveAttribute('aria-selected', 'false');

    await sb.themingPanelTab().click();
    await expect(sb.themingPanelTab()).toHaveAttribute('aria-selected', 'true');
    await expect(sb.themingPanelRoot()).toHaveAttribute('data-nfs-panel-state', 'error');
    await expect(page.locator('[data-testid="nfs-theming-error"]')).toContainText('is not a color');
  });

  test('P8: an autodocs page renders under the selected theme and exposes no Theming panel', async ({ page }) => {
    const sb = new SbPage(page);
    await sb.gotoStory('nfsbutton--primary', 'nfsTheme.primary:!hex(cb4b37)');
    await sb.disablePreviewTransitions();
    await expect(sb.themingPanelRoot()).toHaveAttribute('data-nfs-panel-state', 'ready');

    await page.goto('/?path=/docs/nfsbutton--docs&globals=nfsTheme.primary:!hex(cb4b37)');
    await sb.previewRoot().first().waitFor();

    await expect(sb.themingPanelTab()).toHaveCount(0);
    const docsButton = sb.previewRoot().getByRole('button', { name: 'Primary button' }).first();
    await expect(docsButton).toHaveCSS('background-color', 'rgb(203, 75, 55)');
  });
});
