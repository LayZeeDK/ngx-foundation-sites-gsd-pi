import { expect, test } from '@playwright/test';

// Proves NfsButton mirrors correctly under dir="rtl" (R004/S14). The
// button's layout (padding, border, radius) is fully symmetric shorthand --
// confirmed by S14 T01's audit finding zero physical left/right properties
// in nfs-button.scss / nfs-button.styles.ts -- so "correct mirroring" means
// the computed box model is IDENTICAL between the ltr and rtl instances;
// any asymmetry here would indicate a regression (e.g. a future change
// introducing a physical left/right property that rtlcss/browser direction
// then mirrors unevenly).
test.describe('NfsButton RTL/bidirectional layout', () => {
  test('mirrors padding, border, radius, and text-align identically under dir="rtl"', async ({
    page,
  }) => {
    await page.goto('/');

    const ltrButton = page.getByRole('button', { name: 'Click me' });
    const rtlButton = page.getByTestId('rtl-button');

    await expect(page.getByTestId('rtl-container')).toHaveCSS(
      'direction',
      'rtl',
    );

    const ltrBox = await ltrButton.evaluate((element) => {
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
    const rtlBox = await rtlButton.evaluate((element) => {
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

    // Each side's box model is itself symmetric (left === right) ...
    expect(ltrBox.paddingLeft).toBe(ltrBox.paddingRight);
    expect(rtlBox.paddingLeft).toBe(rtlBox.paddingRight);
    expect(ltrBox.borderLeftWidth).toBe(ltrBox.borderRightWidth);
    expect(rtlBox.borderLeftWidth).toBe(rtlBox.borderRightWidth);
    expect(ltrBox.borderTopLeftRadius).toBe(ltrBox.borderTopRightRadius);
    expect(rtlBox.borderTopLeftRadius).toBe(rtlBox.borderTopRightRadius);

    // ... and matches across ltr/rtl, proving dir="rtl" doesn't shift or
    // unevenly mirror the button's layout.
    expect(rtlBox).toEqual(ltrBox);
  });
});
