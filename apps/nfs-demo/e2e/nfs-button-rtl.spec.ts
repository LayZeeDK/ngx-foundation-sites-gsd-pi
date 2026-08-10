import { expect, test } from '@playwright/test';

// Proves NfsButton mirrors correctly under dir="rtl" (R004/S14).
//
// The whole compiled stylesheet contains exactly TWO genuinely directional
// declarations, both on `.button.dropdown::after`, which Foundation's
// unmodified `button-dropdown` emits as `float: inline-end` and
// `margin-inline-start: 1em` once `$global-left`/`$global-right` are rebound to
// the logical keywords (ticket 03). Everything else about the button
// (`margin: 0 0 1rem 0`, padding, border, radius, text-align) is
// inline-symmetric.
//
// That split is why this spec has two halves, and why the second one is not
// optional: an earlier revision asserted ONLY the symmetric properties, on a
// plain button, with no `.dropdown` instance anywhere in the demo app -- so it
// passed under every candidate RTL mechanism AND under no mechanism at all.
// R004 was validated by a test that could not fail.
//
// `float` is deliberately NOT asserted: under the logical-property mechanism
// `getComputedStyle(element, '::after').float` returns "inline-end" in BOTH
// directions, since the computed value keeps the logical keyword and only used
// layout resolves it. A float assertion would therefore either pass vacuously
// or fail misleadingly. The mirrored margin is the observable that actually
// differs. Measured in all three engines, not just Chromium: Chromium 151,
// WebKit 26.5 and Firefox 153 all report "inline-end" in both directions.
//
// This spec is also the reason playwright.config.ts carries `-webkit` and
// `-firefox` projects: it is the one gate whose subject is a CSS ENGINE
// behaviour rather than an Angular style-delivery mechanism.
test.describe('NfsButton RTL/bidirectional layout', () => {
  test('mirrors the dropdown arrow margin under dir="rtl"', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByTestId('rtl-container')).toHaveCSS(
      'direction',
      'rtl',
    );

    // Compared as NUMBERS, not as computed-value strings. WebKit snaps this
    // margin to 1/64 px on whichever side lands on a fractional offset, so the
    // same `margin-inline-start: 1em` serialises as "14.4px" on one arrow and
    // "14.390625px" on the other, and which arrow gets which is not stable
    // across runs. Chromium 151 and Firefox 153 report 14.4px on both. A 1/64 px
    // difference is not a mirroring defect, so string equality would be a
    // flake, not a gate.
    const readArrowMargins = (testId: string) =>
      page.getByTestId(testId).evaluate((element) => {
        const style = getComputedStyle(element, '::after');

        return {
          marginLeft: Number.parseFloat(style.marginLeft),
          marginRight: Number.parseFloat(style.marginRight),
        };
      });

    const ltrArrow = await readArrowMargins('ltr-dropdown');
    const rtlArrow = await readArrowMargins('rtl-dropdown');

    // Anti-vacuity: the inline-start margin must actually be non-zero, or both
    // directions would trivially agree on 0 and the mirroring assertions below
    // would mean nothing.
    expect(ltrArrow.marginLeft).toBeGreaterThan(0);
    expect(ltrArrow.marginRight).toBe(0);
    expect(rtlArrow.marginRight).toBeGreaterThan(0);
    expect(rtlArrow.marginLeft).toBe(0);

    // The actual mirroring. A physical `margin-left` -- the pre-ticket-03
    // output, and what a regression would reintroduce -- does NOT mirror, so
    // rtlArrow would equal ltrArrow and both of these would fail. The 1-decimal
    // tolerance (0.05 px) absorbs WebKit's 1/64 px (0.0094 px) snapping while
    // staying far below the 14.4 px the assertion is really about.
    expect(rtlArrow.marginLeft).toBeCloseTo(ltrArrow.marginRight, 1);
    expect(rtlArrow.marginRight).toBeCloseTo(ltrArrow.marginLeft, 1);
  });

  test('keeps the symmetric box model identical between ltr and rtl', async ({
    page,
  }) => {
    await page.goto('/');

    const ltrButton = page.getByRole('button', { name: 'Click me' });
    const rtlButton = page.getByTestId('rtl-button');

    const readBox = (locator: ReturnType<typeof page.getByTestId>) =>
      locator.evaluate((element) => {
        const style = getComputedStyle(element);

        return {
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          borderLeftWidth: style.borderLeftWidth,
          borderRightWidth: style.borderRightWidth,
          borderTopLeftRadius: style.borderTopLeftRadius,
          borderTopRightRadius: style.borderTopRightRadius,
          textAlign: style.textAlign,
        };
      });

    const ltrBox = await readBox(ltrButton);
    const rtlBox = await readBox(rtlButton);

    // Each side's box model is itself symmetric (left === right) ...
    expect(ltrBox.paddingLeft).toBe(ltrBox.paddingRight);
    expect(rtlBox.paddingLeft).toBe(rtlBox.paddingRight);
    expect(ltrBox.borderLeftWidth).toBe(ltrBox.borderRightWidth);
    expect(rtlBox.borderLeftWidth).toBe(rtlBox.borderRightWidth);
    expect(ltrBox.borderTopLeftRadius).toBe(ltrBox.borderTopRightRadius);
    expect(rtlBox.borderTopLeftRadius).toBe(rtlBox.borderTopRightRadius);

    // ... and matches across ltr/rtl, so dir="rtl" does not shift or unevenly
    // mirror anything that is supposed to stay put.
    expect(rtlBox).toEqual(ltrBox);
  });
});
