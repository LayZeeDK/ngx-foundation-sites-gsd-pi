/// <reference types="node" />
import { expect, test } from '@playwright/test';

// ponytail: axe-core ships transitively via @storybook/addon-a11y rather
// than a dedicated @axe-core/playwright devDependency (R003/S13) -- if
// Storybook ever drops that addon, pin axe-core directly in root
// package.json instead of re-adding @axe-core/playwright.
const axeCorePath = require.resolve('axe-core/axe.min.js');

/** One node axe reported under the `color-contrast` rule. */
type ContrastFailure = {
  /** The failing element's `data-a11y-variant`, set in app.component.ts. */
  readonly variant: string;
  /** axe's resolved text colour, so a palette change fails this gate. */
  readonly foreground: string;
  /** axe's resolved effective background colour. */
  readonly background: string;
};

/**
 * A theme the suite scans. The default theme ships Foundation's palette
 * unchanged and therefore ships known WCAG AA contrast shortfalls; M002's
 * WCAG-compliant prebuilt theme adds a SECOND fixture here whose
 * `expectedContrastFailures` is `[]`, rather than rewriting this gate.
 *
 * `path` is the seam: a theme is applied by the host's own global stylesheet
 * at build time (compile-time SCSS theming, never runtime custom properties),
 * so a second theme means a second served route or host, not a runtime toggle.
 */
type ThemeFixture = {
  readonly name: string;
  readonly path: string;
  readonly expectedContrastFailures: readonly ContrastFailure[];
};

// The expected failures are a RECORDED USER DECISION, not neglect: Foundation
// for Sites' default palette ships variants below WCAG AA, fidelity to
// Foundation wins for the default theme (D017), and compliance is delivered as
// a prebuilt WCAG/axe-compliant theme in M002 -- which is what eventually
// satisfies R003's "not just Foundation's own accessibility baseline" wording.
//
// This is deliberately an EXACT-SET assertion and deliberately NOT a disabled
// rule or a blanket suppression. Suppressing `color-contrast` would hide a
// genuine future regression and would rot silently; an exact set fails loudly
// when a new failure appears, when Foundation's values change, or when a
// compliant theme lands -- each of which should force a deliberate update.
//
// Independently verified true WCAG 2 ratios at each variant's
// Foundation-picked pairing (ticket 14): primary fill 4.647, secondary fill
// 4.504, hollow primary 4.647, hollow secondary 4.504, success fill 10.912,
// warning fill 10.659 -- all PASS; alert fill 4.498 (fails AA 4.5, passes
// AA-large 3.0), hollow success 1.799 and hollow warning 1.842 (fail both).
const themes: readonly ThemeFixture[] = [
  {
    // Foundation's default palette, with the demo app's own
    // `@include nfs-button.theme($background: #2a5db0)` applied to primary.
    // That override only RAISES primary's contrast (6.33 against 4.647), so
    // it cannot mask a default-theme failure.
    name: 'foundation-default',
    path: '/',
    expectedContrastFailures: [
      // White on #cc4b37 is 4.4989 -- short of AA normal text by 0.002, which
      // Foundation's own quantisation to one decimal reports as "4.5".
      { variant: 'alert', foreground: '#fefefe', background: '#cc4b37' },
      // The hollow variants pair the palette colour against the PAGE
      // background instead of the button text colour, so they are a different
      // and much worse pairing than their fill twins: around 1.8:1,
      // effectively illegible and below even the 3.0 large-text floor. No text
      // colour fixes them, because the failing colour IS the palette colour --
      // only substantially darkening $success-color / $warning-color would,
      // which is exactly the palette change M002 owns and this milestone does
      // not make.
      {
        variant: 'hollow-success',
        foreground: '#3adb76',
        background: '#ffffff',
      },
      {
        variant: 'hollow-warning',
        foreground: '#ffae00',
        background: '#ffffff',
      },
      // NOT expected to fail, and worth knowing why: `hollow-alert` is the
      // same #cc4b37 pairing as `alert` fill, but measured against this host's
      // background rather than against Foundation's #fefefe body background --
      // the library ships no global styles, so a zero-config consumer's page
      // is the browser's pure-white canvas. #cc4b37 on #ffffff is 4.537 and
      // PASSES; on #fefefe it is 4.498 and fails. It is a 0.037 boundary case
      // that flips with the consumer's page background, so if this gate ever
      // reports a fourth failure keyed `hollow-alert`, the cause is the page
      // background, not the palette.
    ],
  },
];

type AxeContrastData = {
  readonly fgColor: string;
  readonly bgColor: string;
  readonly contrastRatio: number;
};

type AxeReport = {
  readonly otherViolations: readonly { id: string; impact: string | null }[];
  readonly contrastFailures: readonly (ContrastFailure & {
    readonly contrastRatio: number | null;
  })[];
};

/**
 * Runs axe-core over `[data-testid="a11y-variants"]` -- one instance per
 * NfsButton variant, now including the full palette in both fill and hollow
 * form (success/warning/alert postdate R003's original scan) -- and splits the
 * result into the contrast findings and everything else.
 */
async function runAxe(
  page: import('@playwright/test').Page,
  path: string,
): Promise<AxeReport> {
  await page.goto(path);
  await page.addScriptTag({ path: axeCorePath });

  return page.evaluate(async () => {
    const context = document.querySelector('[data-testid="a11y-variants"]');
    const results = (await (
      window as unknown as {
        axe: {
          run: (
            ctx: Element,
            opts: unknown,
          ) => Promise<{
            violations: {
              id: string;
              impact: string | null;
              nodes: {
                target: string[];
                any: { data?: unknown }[];
                all: { data?: unknown }[];
                none: { data?: unknown }[];
              }[];
            }[];
          }>;
        };
      }
    ).axe.run(context!, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    })) as {
      violations: {
        id: string;
        impact: string | null;
        nodes: {
          target: string[];
          any: { data?: unknown }[];
          all: { data?: unknown }[];
          none: { data?: unknown }[];
        }[];
      }[];
    };

    const contrast = results.violations.filter(
      (violation) => violation.id === 'color-contrast',
    );
    const other = results.violations.filter(
      (violation) =>
        violation.id !== 'color-contrast' &&
        (violation.impact === 'critical' || violation.impact === 'serious'),
    );

    const contrastFailures = contrast.flatMap((violation) =>
      violation.nodes.map((node) => {
        const element = document.querySelector(node.target[0]);
        const check = [...node.any, ...node.all, ...node.none].find(
          (candidate) =>
            candidate.data != null &&
            'contrastRatio' in (candidate.data as Record<string, unknown>),
        );
        const data = check?.data as AxeContrastData | undefined;

        return {
          variant: element?.getAttribute('data-a11y-variant') ?? node.target[0],
          foreground: data?.fgColor ?? 'unknown',
          background: data?.bgColor ?? 'unknown',
          contrastRatio: data?.contrastRatio ?? null,
        };
      }),
    );

    return {
      otherViolations: other.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
      })),
      contrastFailures,
    };
  });
}

const byVariant = (
  left: { variant: string },
  right: { variant: string },
): number => left.variant.localeCompare(right.variant);

for (const theme of themes) {
  test.describe(`NfsButton accessibility (${theme.name} theme)`, () => {
    // R003's original proof, kept intact: everything that is not a known
    // contrast shortfall must be clean at critical/serious impact.
    test('has zero critical/serious axe-core violations outside colour contrast', async ({
      page,
    }) => {
      const report = await runAxe(page, theme.path);

      expect(
        report.otherViolations,
        JSON.stringify(report.otherViolations, null, 2),
      ).toEqual([]);
    });

    test('reports exactly the known colour-contrast failures, no more and no fewer', async ({
      page,
    }) => {
      const report = await runAxe(page, theme.path);

      const actual = report.contrastFailures
        .map(({ variant, foreground, background }) => ({
          variant,
          foreground,
          background,
        }))
        .sort(byVariant);
      const expected = [...theme.expectedContrastFailures].sort(byVariant);

      expect(
        actual,
        `Measured contrast failures:\n${JSON.stringify(
          report.contrastFailures,
          null,
          2,
        )}\n\nThis set is pinned deliberately (see the comment on \`themes\`). ` +
          `A new entry means a real regression or a Foundation palette change; ` +
          `a missing entry means a variant became compliant -- most likely ` +
          `M002's WCAG-compliant theme, which should be added as its own ` +
          `fixture with an empty expected set rather than by editing this one.`,
      ).toEqual(expected);
    });
  });
}
