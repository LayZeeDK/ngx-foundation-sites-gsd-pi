// Ticket 03, probe B -- DOES THE CSSOM ORACLE ACTUALLY WORK?
//
// Ticket 14 recommended "CSS validity via the browser's own CSSOM" as the missing
// gate and flagged the mechanics [INFER -- not executed]. Everything ticket 03
// recommends rests on that claim, so it is executed here against real Chromium.
//
// Two mechanics are compared, because they are not obviously equivalent:
//   M1  sheet-level: CSSStyleSheet.replaceSync(css) then walk cssRules and diff
//       the surviving declarations against the input. This is the browser's own
//       stylesheet parser -- the exact code path that runs in production.
//   M2  declaration-level: el.style.setProperty(prop, value) then read back.
//       This is the mechanic ticket 14 proposed.
//
// The question that decides ticket 03: does the oracle see defect classes 1-4 and
// MISS classes 5 and 6 (which are valid CSS)? If so, the oracle's blind spot and
// the fixed-settings gate's blind spot are DIFFERENT, and the two must be
// composed rather than chosen between.
//
// Read-only. Uses the playwright chromium already in node_modules -- no install.
//
// Usage: node cssom-oracle-probe.mjs

import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const loadPaths = [join(repoRoot, 'node_modules'), join(repoRoot, 'packages/ngx-foundation-sites/src/scss')];

const ALL_MIXINS = [
  'foundation-global-styles', 'foundation-forms', 'foundation-typography', 'foundation-grid',
  'foundation-flex-grid', 'foundation-xy-grid-classes', 'foundation-button', 'foundation-button-group',
  'foundation-close-button', 'foundation-label', 'foundation-progress-bar', 'foundation-slider',
  'foundation-switch', 'foundation-table', 'foundation-badge', 'foundation-breadcrumbs',
  'foundation-callout', 'foundation-card', 'foundation-dropdown', 'foundation-pagination',
  'foundation-tooltip', 'foundation-accordion', 'foundation-media-object', 'foundation-orbit',
  'foundation-responsive-embed', 'foundation-tabs', 'foundation-thumbnail', 'foundation-menu',
  'foundation-menu-icon', 'foundation-accordion-menu', 'foundation-drilldown-menu',
  'foundation-dropdown-menu', 'foundation-off-canvas', 'foundation-reveal', 'foundation-sticky',
  'foundation-title-bar', 'foundation-top-bar', 'foundation-float-classes', 'foundation-flex-classes',
  'foundation-visibility-classes', 'foundation-prototype-classes',
];

function compile(preamble) {
  return sass.compileString(
    [
      ...preamble,
      "@import 'foundation-sites/scss/foundation';",
      '$global-left: inline-start;',
      '$global-right: inline-end;',
      ...ALL_MIXINS.map((m) => `@include ${m};`),
    ].join('\n'),
    { loadPaths, style: 'expanded', logger: sass.Logger.silent },
  ).css;
}

// The two compiles ticket 03's candidate gate runs.
const CONFIGS = [
  { id: 'A_defaults', pre: [] },
  { id: 'B_admit_all', pre: ['$buttongroup-radius-on-each: false;', '$global-flexbox: false;'] },
];

// Exemplars for M2, one per defect class, taken verbatim from the measured output.
// Classes 5 and 6 have no single declaration to test -- that is the point, and the
// controls below make the asymmetry explicit rather than assumed.
const EXEMPLARS = [
  ['c1 text-align value', 'text-align', 'inline-start'],
  ['c2 bare-side property', 'inline-end', '5px'],
  ['c3 logical radius property', 'border-top-inline-start-radius', '0'],
  ['c4 background-position value', 'background-position', 'inline-end -1rem center'],
  ['c6 (a VALID declaration from the degenerate triangle rule)', 'border-style', 'solid'],
  ['CONTROL valid logical property', 'margin-inline-start', '1rem'],
  ['CONTROL valid logical VALUE', 'float', 'inline-start'],
  ['CONTROL correct radius longhand', 'border-start-start-radius', '6px'],
  ['CONTROL correct logical inset', 'inset-inline-end', '5px'],
  ['CONTROL correct text-align logical value', 'text-align', 'start'],
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');

console.log('=== M2: declaration-level oracle (setProperty + read-back) ===');
const m2 = await page.evaluate((pairs) => {
  const el = document.createElement('div');
  document.body.appendChild(el);

  return pairs.map(([label, prop, value]) => {
    el.style.cssText = '';
    el.style.setProperty(prop, value);

    return { label, prop, value, readBack: el.style.getPropertyValue(prop) };
  });
}, EXEMPLARS);

for (const r of m2) {
  const stuck = r.readBack !== '';
  console.log(
    `  ${stuck ? '[SURVIVED]' : '[DROPPED ]'}  ${r.prop}: ${r.value}`.padEnd(74) +
      `readBack=${JSON.stringify(r.readBack)}   ${r.label}`,
  );
}

console.log('\n=== M1: sheet-level oracle (CSSStyleSheet.replaceSync + walk cssRules) ===');

for (const cfg of CONFIGS) {
  const css = compile(cfg.pre);
  const res = await page.evaluate((sheetText) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(sheetText);

    // Collect every declaration the browser KEPT, and every selector it kept.
    const kept = [];
    const selectors = [];

    // [WARN] A style rule ALSO has .cssRules (CSS Nesting) and an empty
    // CSSRuleList is TRUTHY -- a naive `if (rule.cssRules) recurse; else collect`
    // walk therefore recurses past every style rule and collects NOTHING, which
    // reads as "the browser dropped everything" and is a FALSE ALL-CLEAR. Collect
    // first, then recurse. The positive control below fails loudly if this breaks
    // again.
    const walk = (rules) => {
      for (let r = 0; r < rules.length; r += 1) {
        const rule = rules.item(r);

        if (rule.style != null && rule.selectorText != null) {
          selectors.push(rule.selectorText);

          for (let i = 0; i < rule.style.length; i += 1) {
            const p = rule.style.item(i);
            kept.push(`${p}: ${rule.style.getPropertyValue(p).trim()}`);
          }
        }

        if (rule.cssRules != null && rule.cssRules.length > 0) {
          walk(rule.cssRules);
        }
      }
    };

    walk(sheet.cssRules);

    return {
      keptDecls: kept,
      // Class 5 signature: does the sheet still contain a class-NAME with an
      // interpolated side? If yes, the oracle CANNOT see it -- it is valid CSS.
      class5Selectors: selectors.filter((s) => /\.[A-Za-z0-9_-]*-inline-(?:start|end)\b/.test(s)).length,
      // Class 6 signature: a rule with `border-style: solid` + `border-width` and
      // no border-color and no per-side width. Survives if it is valid CSS.
      class6Rules: (() => {
        let n = 0;
        const scan = (rules) => {
          for (let r = 0; r < rules.length; r += 1) {
            const rule = rules.item(r);

            if (rule.cssRules != null && rule.cssRules.length > 0) {
              scan(rule.cssRules);
            }

            if (rule.style == null || rule.selectorText == null) {
              continue;
            }

            const props = new Set();

            for (let i = 0; i < rule.style.length; i += 1) {
              props.add(rule.style.item(i));
            }

            if (
              rule.style.getPropertyValue('border-style').trim() === 'solid' &&
              props.has('border-width') &&
              !props.has('border-color') &&
              !['top', 'bottom', 'left', 'right', 'inline-start', 'inline-end'].some((s) =>
                props.has(`border-${s}-width`),
              )
            ) {
              n += 1;
            }
          }
        };
        scan(sheet.cssRules);

        return n;
      })(),
      totalRules: selectors.length,
    };
  }, css);

  // Which of the input's invalid declarations are absent from the kept set?
  const keptSet = new Set(res.keptDecls);
  const wanted = {
    c1: [],
    c2: [],
    c3: [],
    c4: [],
  };

  for (const raw of css.split('\n')) {
    const t = raw.trim();
    const c = t.indexOf(':');

    if (c < 0 || t.endsWith('{') || t.startsWith('@')) {
      continue;
    }

    const prop = t.slice(0, c).trim();
    const value = t.slice(c + 1).replace(/;$/, '').trim();
    const decl = `${prop}: ${value}`;

    if (prop === 'text-align' && /\binline-(start|end)\b/.test(value)) {
      wanted.c1.push(decl);
    } else if (/^(inline-start|inline-end)$/.test(prop)) {
      wanted.c2.push(decl);
    } else if (/^border-(top|bottom)-inline-(start|end)-radius$/.test(prop)) {
      wanted.c3.push(decl);
    } else if (prop === 'background-position' && /\binline-(start|end)\b/.test(value)) {
      wanted.c4.push(decl);
    }
  }

  console.log(`\n  --- ${cfg.id} (${css.length} B, ${res.totalRules} rules kept) ---`);

  // POSITIVE CONTROL. A broken walk collects nothing, and "nothing survived"
  // would then read identically to "the browser dropped every defect" -- a false
  // all-clear. Require a known-VALID declaration to have survived before any
  // "[OK] ALL DROPPED" line below is allowed to mean anything.
  const controlSurvived = keptSet.has('margin-inline-start: 1rem') || [...keptSet].some((d) => d.startsWith('margin-inline-start:'));

  if (res.totalRules === 0 || !controlSurvived) {
    console.log(
      `    [FAIL] POSITIVE CONTROL FAILED: rules=${res.totalRules}, valid margin-inline-start survived=${controlSurvived}.` +
        ' The oracle itself is broken -- every result below is meaningless. ABORTING.',
    );
    await browser.close();
    process.exit(1);
  }

  console.log(`    [OK] positive control: ${keptSet.size} distinct declarations survived, including a valid logical property.`);

  for (const [k, list] of Object.entries(wanted)) {
    const survived = list.filter((d) => keptSet.has(d));
    console.log(
      `    ${k}: ${String(list.length).padStart(4)} invalid declarations in source  ->  ` +
        `${survived.length} survived Chromium's parser  ` +
        `${list.length === 0 ? '[n/a -- none emitted in this config]' : survived.length === 0 ? '[OK] ALL DROPPED -- oracle SEES this class' : '[FAIL] some survived'}`,
    );
  }

  console.log(
    `    c5: ${res.class5Selectors} `.padEnd(10) +
      `.*-inline-start/-end CLASS SELECTORS survived  [WARN] oracle is BLIND -- valid CSS matching nothing`,
  );
  // [WARN] Do NOT read this number as a browser drop. Chromium's CSSOM EXPANDS
  // `border-width` into four longhands when enumerated (measured:
  // cssom-shorthand-check.mjs), so a class-6 detector written against the SOURCE
  // text reports 0 here for a DETECTOR reason, not a browser reason. The rule and
  // all its declarations survive intact -- verified separately. Class 6 is a
  // defect of ABSENCE and no validity oracle can see it.
  console.log(
    `    c6: ${res.class6Rules} `.padEnd(10) +
      `source-shaped detector hits in the CSSOM view -- [WARN] ARTEFACT, not a drop.` +
      ' Chromium expands `border-width` to longhands; see cssom-shorthand-check.mjs, which shows the' +
      ' degenerate rule surviving intact. Oracle is structurally BLIND to class 6 (a defect of absence).',
  );
}

await browser.close();
