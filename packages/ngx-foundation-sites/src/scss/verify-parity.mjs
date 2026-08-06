// Proves the precompiled default CSS bundle contains every selector that
// nfs-button.styles.ts (S03's TS-template-literal source) defines. Selector
// parity only — hover/hollow hex values are recomputed from Foundation's own
// scale-color formulas in nfs-button.scss and may differ by a shade from the
// hand-matched approximations in nfs-button.styles.ts (see D009).
//
// ponytail: selector extraction is a plain regex over CSS-rule openers, not a
// full CSS parser. Sufficient for this flat, non-nested stylesheet; swap to a
// real parser (e.g. postcss) if either source grows @media/nesting.
import { readFileSync } from 'node:fs';

const STYLES_TS_PATH = new URL(
  '../lib/nfs-button/nfs-button.styles.ts',
  import.meta.url,
);
const COMPILED_CSS_PATH = new URL(
  '../../../../dist/packages/ngx-foundation-sites/css/nfs-button.css',
  import.meta.url,
);

function extractSelectors(cssText) {
  const selectors = new Set();
  const ruleOpenerPattern = /([^{}]+)\{/g;
  let match;

  while ((match = ruleOpenerPattern.exec(cssText)) !== null) {
    for (const selector of match[1].split(',')) {
      const trimmed = selector.trim();

      if (trimmed.length > 0) {
        selectors.add(trimmed);
      }
    }
  }

  return selectors;
}

function extractTemplateLiteralBody(tsText) {
  const templateMatch = tsText.match(/NFS_BUTTON_STYLES\s*=\s*`([\s\S]*)`/);

  if (!templateMatch) {
    throw new Error('Could not find NFS_BUTTON_STYLES template literal in nfs-button.styles.ts');
  }

  return templateMatch[1];
}

const stylesTs = readFileSync(STYLES_TS_PATH, 'utf8');
const compiledCss = readFileSync(COMPILED_CSS_PATH, 'utf8');

const expectedSelectors = extractSelectors(extractTemplateLiteralBody(stylesTs));
const actualSelectors = extractSelectors(compiledCss);

const missing = [...expectedSelectors].filter((selector) => !actualSelectors.has(selector));

if (missing.length > 0) {
  console.error('CSS parity check FAILED. Selectors missing from precompiled CSS:');

  for (const selector of missing) {
    console.error(`  - ${selector}`);
  }

  process.exit(1);
}

console.log(
  `CSS parity check PASSED: all ${expectedSelectors.size} selectors from nfs-button.styles.ts are present in the precompiled default CSS.`,
);
