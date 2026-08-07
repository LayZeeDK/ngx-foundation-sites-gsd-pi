import { expect, test } from '@playwright/test';

// Exercises NfsButton as installed from the local Verdaccio registry into
// apps/nfs-demo/node_modules (proven non-symlinked, source-free by T02's
// verify-registry-consumption.mjs) via a real served build, not the
// monorepo source directly.
test.describe('NfsButton rendered from the registry-installed ngx-foundation-sites package', () => {
  test('renders NfsButton host classes and increments click count on click', async ({
    page,
  }) => {
    await page.goto('/');

    const button = page.getByRole('button', { name: 'Click me' });
    const clickCount = page.getByTestId('click-count');

    // NfsButton's host binding always applies the base 'button' class and
    // never the secondary/hollow/disabled variants for this template's
    // default `color="primary"` usage — proves the real directive is
    // rendering, not a stub.
    await expect(button).toHaveClass(/\bbutton\b/);
    await expect(button).not.toHaveClass(/\b(secondary|hollow|disabled)\b/);
    await expect(clickCount).toHaveText('Clicks: 0');

    await button.click();
    await expect(clickCount).toHaveText('Clicks: 1');

    await button.click();
    await expect(clickCount).toHaveText('Clicks: 2');
  });

  test('applies the app-level SCSS theme override (README Option 2) over the runtime default', async ({
    page,
  }) => {
    await page.goto('/');

    const button = page.getByRole('button', { name: 'Click me' });

    // src/styles.scss overrides $primary-color to #2a5db0 (rgb(42, 93, 176)).
    // NfsButton's runtime-injected default is wrapped in `@layer nfs-defaults`,
    // so this unlayered app stylesheet must win the cascade regardless of the
    // runtime <style> tag's later DOM insertion order (R008/D009).
    await expect(button).toHaveCSS('background-color', 'rgb(42, 93, 176)');
  });

  test('renders correctly under an RTL ancestor with the theme override still applied', async ({
    page,
  }) => {
    await page.goto('/');

    const rtlContainer = page.getByTestId('rtl-container');
    const rtlButton = page.getByTestId('rtl-button');

    await expect(rtlContainer).toHaveCSS('direction', 'rtl');
    await expect(rtlButton).toHaveCSS('background-color', 'rgb(42, 93, 176)');
  });
});
