// Ticket 01, probe C -- the harness that matches what THIS LIBRARY actually does,
// plus the monotonicity test.
//
// WHY A SECOND HARNESS. Probe B compiled `foundation-everything()`, and that
// mixin does `$global-flexbox: true !global;` when its `$flex` argument is true
// (the default) -- so it SILENTLY OVERWRITES a consumer's `$global-flexbox`
// setting. A perturbation of that setting measured through foundation-everything()
// is byte-identical for a reason that has nothing to do with RTL, which is a
// measurement artefact, not a finding.
//
// This library's island idiom is per-component: `@import` the partials, then
// `@include foundation-button;` [internal/_foundation-button.scss]. In that model
// no mixin resets the globals, so every setting is live. This harness reproduces
// that model over the FULL component set.
//
// Read-only. Usage:
//   node per-component-sweep.mjs                 # single-setting sweep
//   node per-component-sweep.mjs --pairs         # monotonicity: pairwise combos
//   node per-component-sweep.mjs --shuffle N     # N shuffled repeats of the
//                                                # baseline, to prove the counts
//                                                # are order-independent

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

import { classifyCss, fmt } from './rtl-defect-classifier.mjs';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const loadPaths = [join(repoRoot, 'node_modules'), join(repoRoot, 'packages/ngx-foundation-sites/src/scss')];

// Every component mixin foundation-everything() would include, but invoked
// DIRECTLY so no argument default resets a global. Grid family is included
// unconditionally in all three flavours so the sweep can reach float-grid sites.
const COMPONENT_MIXINS = [
  'foundation-global-styles',
  'foundation-forms',
  'foundation-typography',
  'foundation-grid',
  'foundation-flex-grid',
  'foundation-xy-grid-classes',
  'foundation-button',
  'foundation-button-group',
  'foundation-close-button',
  'foundation-label',
  'foundation-progress-bar',
  'foundation-slider',
  'foundation-switch',
  'foundation-table',
  'foundation-badge',
  'foundation-breadcrumbs',
  'foundation-callout',
  'foundation-card',
  'foundation-dropdown',
  'foundation-pagination',
  'foundation-tooltip',
  'foundation-accordion',
  'foundation-media-object',
  'foundation-orbit',
  'foundation-responsive-embed',
  'foundation-tabs',
  'foundation-thumbnail',
  'foundation-menu',
  'foundation-menu-icon',
  'foundation-accordion-menu',
  'foundation-drilldown-menu',
  'foundation-dropdown-menu',
  'foundation-off-canvas',
  'foundation-reveal',
  'foundation-sticky',
  'foundation-title-bar',
  'foundation-top-bar',
  'foundation-float-classes',
  'foundation-flex-classes',
  'foundation-visibility-classes',
  'foundation-prototype-classes',
];

function compile(preamble, mixinOrder = COMPONENT_MIXINS) {
  return sass.compileString(
    [
      ...preamble,
      "@import 'foundation-sites/scss/foundation';",
      '$global-left: inline-start;',
      '$global-right: inline-end;',
      ...mixinOrder.map((m) => `@include ${m};`),
    ].join('\n'),
    { loadPaths, style: 'expanded', logger: sass.Logger.silent },
  ).css;
}

function measure(preamble, order) {
  const css = compile(preamble, order);
  const { counts, samples } = classifyCss(css);

  return { bytes: css.length, counts, samples };
}

const KEYS = [
  'c1_textAlignValue',
  'c2_bareSidePositioning',
  'c3_logicalRadius',
  'c4_backgroundPosition',
  'c5_classNameRename',
  'c6_triangleDegenerate',
  'otherInvalidProp',
  'otherInvalidValue',
];

// --- The perturbations. Every one is a legitimate Foundation setting value. ---
const PERTURBATIONS = [
  { id: 'buttongroup-radius-on-each=false', pre: ['$buttongroup-radius-on-each: false;'] },
  { id: 'global-flexbox=false', pre: ['$global-flexbox: false;'] },
  { id: 'xy-grid=false', pre: ['$xy-grid: false;'] },
  { id: 'dropdownmenu-arrows=false', pre: ['$dropdownmenu-arrows: false;'] },
  { id: 'drilldown-arrows=false', pre: ['$drilldown-arrows: false;'] },
  { id: 'accordion-plusminus=false', pre: ['$accordion-plusminus: false;'] },
  { id: 'select-triangle-color=transparent', pre: ['$select-triangle-color: transparent;'] },
  { id: 'pagination-arrows=false', pre: ['$pagination-arrows: false;'] },
  { id: 'input-prefix-border=none', pre: ['$input-prefix-border: none;'] },
  { id: 'grid-column-align-edge=false', pre: ['$grid-column-align-edge: false;'] },
  { id: 'buttongroup-expand-max=2', pre: ['$buttongroup-expand-max: 2;'] },
  { id: 'global-text-direction=rtl', pre: ['$global-text-direction: rtl;'] },
  // Added after probe E's transitive gate closure found five gates the
  // intra-file walk missed.
  { id: 'menu-centered-back-compat=false', pre: ['$menu-centered-back-compat: false;'] },
  { id: 'accordionmenu-arrows=false', pre: ['$accordionmenu-arrows: false;'] },
  { id: 'grid-column-count=6', pre: ['$grid-column-count: 6;'] },
  { id: 'grid-column-count=24', pre: ['$grid-column-count: 24;'] },
  { id: 'global-radius=6px  [M002 CONTROL]', pre: ['$global-radius: 6px;'] },
  {
    id: 'foundation-palette all five  [M002 CONTROLS]',
    pre: ['$foundation-palette: (primary: #123456, secondary: #654321, success: #0f0f0f, warning: #abcdef, alert: #fedcba);'],
  },
  {
    id: 'ALL SIX M002 CONTROLS at once',
    pre: [
      '$foundation-palette: (primary: #123456, secondary: #654321, success: #0f0f0f, warning: #abcdef, alert: #fedcba);',
      '$global-radius: 6px;',
    ],
  },
];

// --- The MULTIPLIER settings: these do not gate a site, they control how many
// --- times a responsive site is emitted (via @each over breakpoint classes).
const MULTIPLIERS = [
  { id: 'breakpoint-classes=(small)', pre: ['$breakpoint-classes: (small);'] },
  { id: 'breakpoint-classes=(small medium)', pre: ['$breakpoint-classes: (small medium);'] },
  {
    id: 'breakpoint-classes=(small medium large xlarge xxlarge)',
    pre: ['$breakpoint-classes: (small medium large xlarge xxlarge);'],
  },
  {
    id: 'breakpoints += 2 extra + all classes',
    pre: [
      '$breakpoints: (small: 0, medium: 640px, large: 1024px, xlarge: 1200px, xxlarge: 1440px, huge: 1800px, giant: 2400px);',
      '$breakpoint-classes: (small medium large xlarge xxlarge huge giant);',
    ],
  },
];

// --- Brute-force bounding sweep: every boolean in Foundation's 490-name
// --- settings template, flipped. Catches anything the static gate walk missed.
function booleanPerturbations() {
  const src = readFileSync(join(repoRoot, 'node_modules/foundation-sites/scss/settings/_settings.scss'), 'utf8');
  const out = [];

  for (const line of src.split('\n')) {
    const m = /^\$([a-zA-Z0-9_-]+)\s*:\s*(true|false)\s*;\s*$/.exec(line);

    if (m) {
      out.push({ id: `BOOL $${m[1]}: ${m[2] === 'true' ? 'false' : 'true'} (default ${m[2]})`, pre: [`$${m[1]}: ${m[2] === 'true' ? 'false' : 'true'};`] });
    }
  }

  return out;
}

if (process.argv.includes('--multipliers')) {
  PERTURBATIONS.push(...MULTIPLIERS);
}

if (process.argv.includes('--bool')) {
  PERTURBATIONS.push(...booleanPerturbations());
}

const base = measure([]);
console.log('=== BASELINE (per-component includes, Foundation defaults + R004 rebind) ===');
console.log(`  css ${base.bytes} bytes`);
console.log(`  ${fmt(base.counts)}`);

for (const [k, set] of Object.entries(base.samples)) {
  console.log(`    ${k}: ${[...set].slice(0, 8).join(' | ')}${set.size > 8 ? ` ... (${set.size} distinct)` : ''}`);
}

// --- Order-independence control (the declaration-order artefact guard). ---
const shuffleIdx = process.argv.indexOf('--shuffle');

if (shuffleIdx > -1) {
  const n = Number(process.argv[shuffleIdx + 1] ?? 5);
  console.log(`\n=== ORDER-INDEPENDENCE CONTROL: ${n} shuffled mixin orders ===`);
  console.log('(counts must be identical; only byte order may change)');

  for (let r = 0; r < n; r += 1) {
    const order = [...COMPONENT_MIXINS];

    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    const m = measure([], order);
    const same = KEYS.every((k) => m.counts[k] === base.counts[k]);
    console.log(`  run ${r + 1}: css ${m.bytes} (base ${base.bytes})  counts identical: ${same ? '[OK]' : '[WARN] NO'}`);

    if (!same) {
      console.log(`    ${fmt(m.counts)}`);
    }
  }
}

const results = new Map();

function run(id, pre) {
  const r = measure(pre);
  const deltas = {};

  for (const k of KEYS) {
    const d = r.counts[k] - base.counts[k];

    if (d !== 0) {
      deltas[k] = d;
    }
  }

  results.set(id, { ...r, deltas });

  return { ...r, deltas };
}

console.log('\n=== SINGLE-SETTING SWEEP ===');
const rows = [];

for (const p of PERTURBATIONS) {
  let r;

  try {
    r = run(p.id, p.pre);
  } catch (err) {
    console.log(`[COMPILE ERROR]  ${p.id}\n    ${String(err.message).split('\n')[0]}`);
    rows.push({ id: p.id, pre: p.pre, error: String(err.message).split('\n')[0], changed: false });
    continue;
  }

  const changed = Object.keys(r.deltas).length > 0;
  const dstr = changed
    ? Object.entries(r.deltas)
        .map(([k, d]) => `${k} ${d > 0 ? '+' : ''}${d}`)
        .join(', ')
    : '--';
  console.log(
    `${changed ? '[ACTIVATES/MASKS]' : r.bytes !== base.bytes ? '[css only]     ' : '[INERT]        '} ${p.id}`,
  );
  console.log(`    css ${r.bytes} (${r.bytes - base.bytes >= 0 ? '+' : ''}${r.bytes - base.bytes})  invalid=${r.counts.totalInvalidDecl} (base ${base.counts.totalInvalidDecl})  ${dstr}`);
  rows.push({ id: p.id, pre: p.pre, bytes: r.bytes, counts: r.counts, deltas: r.deltas, changed });

  if (changed) {
    for (const k of Object.keys(r.deltas)) {
      const short = k.slice(0, 2);
      const before = base.samples[short] ? [...base.samples[short]] : [];
      const after = r.samples[short] ? [...r.samples[short]] : [];
      const added = after.filter((x) => !before.includes(x));
      const removed = before.filter((x) => !after.includes(x));

      if (added.length) {
        console.log(`      ${k} ADDED:   ${added.slice(0, 6).join(' | ')}`);
      }

      if (removed.length) {
        console.log(`      ${k} REMOVED: ${removed.slice(0, 6).join(' | ')}`);
      }
    }
  }
}

// --- Monotonicity: is the defect count additive over settings? ---
if (process.argv.includes('--pairs')) {
  const actives = rows.filter((r) => r.changed);
  console.log('\n=== MONOTONICITY / ADDITIVITY: pairwise combinations of activating settings ===');
  console.log('additive means  count(A+B) - base == (count(A) - base) + (count(B) - base)  for every class');
  const pairRows = [];

  // Two perturbations of the SAME variable are not a valid additivity test --
  // the second declaration simply wins, so the "prediction" is meaningless.
  // Skip them explicitly rather than reporting them as non-additive.
  const varsOf = (pre) => new Set(pre.flatMap((l) => [...l.matchAll(/^\$([a-zA-Z0-9_-]+)\s*:/gm)].map((m) => m[1])));
  let skipped = 0;

  for (let i = 0; i < actives.length; i += 1) {
    for (let j = i + 1; j < actives.length; j += 1) {
      const a = actives[i];
      const b = actives[j];
      const va = varsOf(a.pre);
      const vb = varsOf(b.pre);

      if ([...va].some((v) => vb.has(v))) {
        skipped += 1;
        console.log(`  [SKIP same-variable pair] ${a.id}  +  ${b.id}`);
        continue;
      }

      const combo = measure([...a.pre, ...b.pre]);
      const nonAdditive = [];

      for (const k of KEYS) {
        const predicted = base.counts[k] + (a.counts[k] - base.counts[k]) + (b.counts[k] - base.counts[k]);

        if (combo.counts[k] !== predicted) {
          nonAdditive.push(`${k}: predicted ${predicted}, measured ${combo.counts[k]}`);
        }
      }

      const verdict = nonAdditive.length === 0 ? '[ADDITIVE]' : '[NON-ADDITIVE]';
      console.log(`  ${verdict} ${a.id}  +  ${b.id}`);

      for (const n of nonAdditive) {
        console.log(`      ${n}`);
      }

      pairRows.push({ a: a.id, b: b.id, additive: nonAdditive.length === 0, nonAdditive, counts: combo.counts });
    }
  }

  const bad = pairRows.filter((p) => !p.additive);
  console.log(`\n  valid pairs tested: ${pairRows.length}   additive: ${pairRows.length - bad.length}   NON-additive: ${bad.length}   (same-variable pairs skipped: ${skipped})`);

  // Worst case: everything that ADDS, all at once -- one perturbation per
  // variable, keeping the largest adding value for any variable tested twice.
  const adders = [];
  const seenVars = new Set();

  for (const r of actives) {
    if (!Object.values(r.deltas).some((d) => d > 0)) {
      continue;
    }

    const vs = varsOf(r.pre);

    if ([...vs].some((v) => seenVars.has(v))) {
      continue;
    }

    for (const v of vs) {
      seenVars.add(v);
    }

    adders.push(r);
  }

  console.log(`\n  adding settings combined: ${adders.map((a) => a.id).join(' | ')}`);
  const worst = measure(adders.flatMap((r) => r.pre));
  console.log(`\n  worst case (all ${adders.length} adding settings at once): invalid=${worst.counts.totalInvalidDecl} (base ${base.counts.totalInvalidDecl})`);
  console.log(`    ${fmt(worst.counts)}`);
  writeFileSync('sweep-pairs.json', JSON.stringify({ base: base.counts, pairRows, worst: worst.counts }, null, 2));
}

console.log('\n=== SUMMARY ===');
const act = rows.filter((r) => r.changed);
console.log(`perturbations: ${rows.length}   ACTIVATE/MASK: ${act.length}`);

for (const r of act) {
  console.log(
    `  ${r.id}  ->  ${Object.entries(r.deltas)
      .map(([k, d]) => `${k} ${d > 0 ? '+' : ''}${d}`)
      .join(', ')}`,
  );
}

writeFileSync('sweep-per-component.json', JSON.stringify({ base: base.counts, baseBytes: base.bytes, rows }, null, 2));
