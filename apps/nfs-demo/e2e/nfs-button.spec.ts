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
});
