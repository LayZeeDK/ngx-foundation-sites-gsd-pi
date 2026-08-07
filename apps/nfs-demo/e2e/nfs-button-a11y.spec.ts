/// <reference types="node" />
import { expect, test } from '@playwright/test';

// ponytail: axe-core ships transitively via @storybook/addon-a11y rather
// than a dedicated @axe-core/playwright devDependency (R003/S13) -- if
// Storybook ever drops that addon, pin axe-core directly in root
// package.json instead of re-adding @axe-core/playwright.
const axeCorePath = require.resolve('axe-core/axe.min.js');

// Scans every NfsButton variant rendered under data-testid="a11y-variants"
// (primary/secondary, hollow x2, sizes, disabled button, disabled anchor)
// for WCAG AA violations (R003).
test.describe('NfsButton accessibility', () => {
  test('has zero critical/serious axe-core violations across all variants', async ({
    page,
  }) => {
    await page.goto('/');
    await page.addScriptTag({ path: axeCorePath });

    const results = await page.evaluate(async () => {
      const context = document.querySelector('[data-testid="a11y-variants"]');
      return (
        window as unknown as {
          axe: { run: (ctx: Element, opts: unknown) => Promise<unknown> };
        }
      ).axe.run(context!, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      });
    });

    const violations = (
      results as { violations: { impact: string | null }[] }
    ).violations.filter(
      (violation) =>
        violation.impact === 'critical' || violation.impact === 'serious',
    );

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
