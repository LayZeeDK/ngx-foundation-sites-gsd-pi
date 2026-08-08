// Proves selector parity between nfs-button.styles.ts (S03's TS-template-
// literal source, the runtime path fed to NfsStyleLoader/NfsStyleExtractor)
// and the precompiled default CSS bundle (nfs-button.scss's compiled
// output). Two directions, for two different regressions (D017/S15 Key
// Risk 1):
//
// 1. Forward (raw, exact): every literal selector styles.ts defines must
//    appear verbatim in the compiled CSS. Catches a typo/drift in an
//    existing styles.ts selector.
// 2. Reverse (canonical, variant-family level): every `.button`-rooted
//    variant family the compiled CSS defines (e.g. `.button.success`,
//    `.button.dropdown.hollow.warning::after`) must have a matching family
//    in styles.ts, after stripping Foundation's own disabled/hover/focus
//    state combinators. Catches nfs-button.scss (T01) gaining a brand-new
//    palette/expand/dropdown class that styles.ts never learns -- the
//    forward-only check would stay green in that case, silently shipping
//    an unstyled runtime class.
//
// Non-`.button`-rooted compiled selectors (e.g. Foundation's own
// `[data-whatinput=mouse] .button` mouse-outline helper) are excluded from
// the reverse check: they are unrelated accessibility hooks, not button
// variant classes, and have no runtime styles.ts equivalent by design.
//
// ponytail: selector extraction is a plain regex over CSS-rule openers, not
// a full CSS parser. Sufficient for this flat, non-nested stylesheet; swap
// to a real parser (e.g. postcss) if either source grows @media/nesting.
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

/**
 * Reduces a `.button`-rooted selector to its variant-family identity by
 * dropping Foundation's own disabled/hover/focus state combinators, so
 * e.g. `.button.hollow.secondary:hover` and `.button.hollow.secondary[disabled]`
 * both canonicalize to the same family as `.button.hollow.secondary`.
 * Returns null for selectors that aren't rooted at `.button` (excluded).
 */
function canonicalizeButtonSelector(selector) {
  if (!selector.startsWith('.button')) {
    return null;
  }

  const pseudoElementMatch = selector.match(/(::[a-z-]+)$/);
  const pseudoElement = pseudoElementMatch ? pseudoElementMatch[1] : '';
  const withoutPseudoElement = pseudoElement
    ? selector.slice(0, -pseudoElement.length)
    : selector;

  const withoutState = withoutPseudoElement
    .replace(/\[disabled\]/g, '')
    .replace(/\.disabled\b/g, '')
    .replace(/:hover/g, '')
    .replace(/:focus/g, '');

  const classes = withoutState.split('.').filter((token) => token.length > 0);
  const [root, ...variantClasses] = classes;

  return [root, ...variantClasses.sort()].join('.') + pseudoElement;
}

function toCanonicalFamilies(selectors) {
  const families = new Set();

  for (const selector of selectors) {
    const canonical = canonicalizeButtonSelector(selector);

    if (canonical !== null) {
      families.add(canonical);
    }
  }

  return families;
}

const stylesTs = readFileSync(STYLES_TS_PATH, 'utf8');
const compiledCss = readFileSync(COMPILED_CSS_PATH, 'utf8');

const stylesTsSelectors = extractSelectors(extractTemplateLiteralBody(stylesTs));
const compiledCssSelectors = extractSelectors(compiledCss);

const missingFromCompiled = [...stylesTsSelectors].filter(
  (selector) => !compiledCssSelectors.has(selector),
);

const compiledFamilies = toCanonicalFamilies(compiledCssSelectors);
const stylesTsFamilies = toCanonicalFamilies(stylesTsSelectors);

const missingFromStylesTs = [...compiledFamilies].filter(
  (family) => !stylesTsFamilies.has(family),
);

let failed = false;

if (missingFromCompiled.length > 0) {
  failed = true;
  console.error(
    'CSS parity check FAILED (forward). Selectors from nfs-button.styles.ts missing from the precompiled CSS:',
  );

  for (const selector of missingFromCompiled) {
    console.error(`  - ${selector}`);
  }
}

if (missingFromStylesTs.length > 0) {
  failed = true;
  console.error(
    'CSS parity check FAILED (reverse). Variant families present in the precompiled CSS but missing from nfs-button.styles.ts:',
  );

  for (const family of missingFromStylesTs) {
    console.error(`  - ${family}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `CSS parity check PASSED: all ${stylesTsSelectors.size} selectors from nfs-button.styles.ts are present in the precompiled default CSS, and all ${compiledFamilies.size} button variant families in the precompiled CSS have a matching family in nfs-button.styles.ts.`,
);
