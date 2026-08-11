// Ticket 01, probe D -- three things the sweep leaves under-specified.
//
// D1. THE M002 QUESTION, measured through the ACTUAL SHIPPED ROUTE, not only
//     through raw Foundation: the real public theme() chain, which is where the
//     addon's six controls land. Two levels of exposure, because a clean bill of
//     health has to survive both.
// D2. Is class 5 (class-NAME interpolation, `.align-inline-start`) settings-
//     dependent? -- the map's open fog item. Enumerate the emitted selectors,
//     not just the count.
// D3. Does the radius VALUE gate the radius-shaped defect? The M002-shaped worry
//     is "$global-radius is a radius control and the latent class is radius-
//     shaped". Cross the radius control against the setting that DOES activate
//     the class.
//
// Read-only. Usage: node m002-and-class-name-probe.mjs

import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

import { classifyCss, fmt, parseRules } from './rtl-defect-classifier.mjs';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const loadPaths = [join(repoRoot, 'node_modules'), join(repoRoot, 'packages/ngx-foundation-sites/src/scss')];

function compileRaw(src) {
  return sass.compileString(src, { loadPaths, style: 'expanded', logger: sass.Logger.silent }).css;
}

// ---------------------------------------------------------------------------
// D1a. The SHIPPED route: the real public theme() API, with the addon's controls.
// ---------------------------------------------------------------------------
console.log('=== D1a. M002 SHIPPED ROUTE -- the real public theme() chain ===');
console.log('(the island already carries the R004 rebind; the addon drives theme() arguments)');

const THEME_CASES = [
  { id: 'defaults', args: '' },
  { id: 'radius 6px  [control 6]', args: '($radius: 6px)' },
  { id: 'radius 0', args: '($radius: 0)' },
  { id: 'radius 9999px', args: '($radius: 9999px)' },
  {
    id: 'all five palette colours  [controls 1-5]',
    args: '($palette: (primary: #123456, secondary: #654321, success: #0f0f0f, warning: #abcdef, alert: #fedcba))',
  },
  {
    id: 'ALL SIX controls',
    args: '($palette: (primary: #123456, secondary: #654321, success: #0f0f0f, warning: #abcdef, alert: #fedcba), $radius: 6px)',
  },
];

for (const c of THEME_CASES) {
  let css;

  try {
    css = compileRaw(`@use 'button' as nfs;\n@include nfs.theme${c.args};`);
  } catch (err) {
    console.log(`  [COMPILE ERROR] ${c.id}: ${String(err.message).split('\n')[0]}`);
    continue;
  }

  const { counts } = classifyCss(css);
  console.log(`  ${String(css.length).padStart(6)}B  invalid=${counts.totalInvalidDecl}  c1=${counts.c1_textAlignValue} c2=${counts.c2_bareSidePositioning} c3=${counts.c3_logicalRadius} c4=${counts.c4_backgroundPosition} c5=${counts.c5_classNameRename} c6=${counts.c6_triangleDegenerate}   ${c.id}`);
}

// ---------------------------------------------------------------------------
// D1b. The MAXIMAL route: raw Foundation, every component, rebind applied,
//      the six controls driven as bare Foundation globals (ticket 15's bar 3 --
//      the settings surface a future milestone would build).
// ---------------------------------------------------------------------------
console.log('\n=== D1b. M002 MAXIMAL ROUTE -- every Foundation component, controls as bare globals ===');
console.log('(this is the exposure a future settings surface would create for the SAME six controls)');

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

function compileAll(pre) {
  return compileRaw(
    [
      ...pre,
      "@import 'foundation-sites/scss/foundation';",
      '$global-left: inline-start;',
      '$global-right: inline-end;',
      ...ALL_MIXINS.map((m) => `@include ${m};`),
    ].join('\n'),
  );
}

const RADII = ['0', '1px', '3px', '6px', '0.5rem', '2rem', '50%', '9999px'];
const baseAll = classifyCss(compileAll([]));
console.log(`  BASELINE (radius default 0): ${fmt(baseAll.counts)}`);

for (const r of RADII) {
  const c = classifyCss(compileAll([`$global-radius: ${r};`])).counts;
  const same =
    c.totalInvalidDecl === baseAll.counts.totalInvalidDecl &&
    c.c5_classNameRename === baseAll.counts.c5_classNameRename &&
    c.c6_triangleDegenerate === baseAll.counts.c6_triangleDegenerate;
  console.log(`  $global-radius: ${r.padEnd(8)} -> ${fmt(c)}  ${same ? '[NO DEFECT CHANGE]' : '[CHANGED]'}`);
}

for (const key of ['primary', 'secondary', 'success', 'alert', 'warning']) {
  const pre = [
    '$foundation-palette: (primary: #1779ba, secondary: #767676, success: #3adb76, warning: #ffae00, alert: #cc4b37);',
    `$foundation-palette: map-merge($foundation-palette, (${key}: #123456));`,
  ];
  const c = classifyCss(compileAll(pre)).counts;
  const same = c.totalInvalidDecl === baseAll.counts.totalInvalidDecl && c.c5_classNameRename === baseAll.counts.c5_classNameRename && c.c6_triangleDegenerate === baseAll.counts.c6_triangleDegenerate;
  console.log(`  $foundation-palette.${key.padEnd(10)} -> ${fmt(c)}  ${same ? '[NO DEFECT CHANGE]' : '[CHANGED]'}`);
}

// ---------------------------------------------------------------------------
// D3. Does the radius VALUE gate the radius-shaped defect?
// ---------------------------------------------------------------------------
console.log('\n=== D3. radius control x the setting that DOES activate the radius class ===');

for (const r of ['0', '6px', '50%']) {
  for (const onEach of ['true', 'false']) {
    const c = classifyCss(compileAll([`$global-radius: ${r};`, `$buttongroup-radius-on-each: ${onEach};`])).counts;
    console.log(`  $global-radius: ${r.padEnd(6)} $buttongroup-radius-on-each: ${onEach.padEnd(6)} -> c3_radius=${c.c3_logicalRadius}  invalid=${c.totalInvalidDecl}`);
  }
}

// ---------------------------------------------------------------------------
// D2. Class 5 -- the class-NAME interpolation defect, enumerated.
// ---------------------------------------------------------------------------
console.log('\n=== D2. class-NAME interpolation defect (.align-inline-*), enumerated ===');

function classNameSelectors(css) {
  const out = [];

  for (const rule of parseRules(css)) {
    for (const line of rule.selector.split(',')) {
      if (/\.[A-Za-z0-9_-]*-inline-(start|end)\b/.test(line)) {
        out.push(line.trim());
      }
    }
  }

  return out;
}

const C5_CASES = [
  { id: 'defaults', pre: [] },
  { id: '$global-flexbox: false', pre: ['$global-flexbox: false;'] },
  { id: '$breakpoint-classes: (small)', pre: ['$breakpoint-classes: (small);'] },
  { id: '$breakpoint-classes: (small medium large xlarge xxlarge)', pre: ['$breakpoint-classes: (small medium large xlarge xxlarge);'] },
  { id: '$menu-centered-back-compat: false', pre: ['$menu-centered-back-compat: false;'] },
  { id: '$accordionmenu-arrows: false', pre: ['$accordionmenu-arrows: false;'] },
  { id: '$global-radius: 6px  [M002]', pre: ['$global-radius: 6px;'] },
];

for (const c of C5_CASES) {
  const sels = classNameSelectors(compileAll(c.pre));
  console.log(`\n  ${c.id}  ->  ${sels.length} selectors`);

  for (const s of sels) {
    console.log(`      ${s}`);
  }
}

// ---------------------------------------------------------------------------
// D2b. What Foundation's PUBLIC class names are, unrebound -- the contract the
//      rename breaks. Compile the same thing WITHOUT the rebind and diff.
// ---------------------------------------------------------------------------
console.log('\n=== D2b. the public class names the rebind renames (no-rebind control) ===');
const noRebind = sass.compileString(
  [
    "@import 'foundation-sites/scss/foundation';",
    ...ALL_MIXINS.map((m) => `@include ${m};`),
  ].join('\n'),
  { loadPaths, style: 'expanded', logger: sass.Logger.silent },
).css;

const physical = new Set();

for (const rule of parseRules(noRebind)) {
  for (const line of rule.selector.split(',')) {
    for (const m of line.matchAll(/\.[A-Za-z0-9_-]*align-(left|right)\b/g)) {
      physical.add(m[0]);
    }
  }
}

console.log(`  physical class names emitted WITHOUT the rebind: ${[...physical].sort().join(', ')}`);
const rebound = new Set(classNameSelectors(compileAll([])).flatMap((s) => [...s.matchAll(/\.[A-Za-z0-9_-]*-inline-(?:start|end)\b/g)].map((m) => m[0])));
console.log(`  class names emitted WITH the rebind:              ${[...rebound].sort().join(', ')}`);
