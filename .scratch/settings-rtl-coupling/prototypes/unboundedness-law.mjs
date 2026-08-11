// Ticket 01, probe F -- IS THE CLASS BOUNDED?
//
// The pairwise run showed $grid-column-count and $breakpoint-classes are the two
// settings that do not merely gate a site, they MULTIPLY it -- and their
// interaction is the only non-additive one measured. Fitting the 12 measured
// points gives an exact law:
//
//     c2_bareSidePositioning  =  2 * $grid-column-count * |$breakpoint-classes|
//                                  + |$breakpoint-classes|  +  23
//
// This probe does NOT re-fit. It PREDICTS points that were never measured and
// then compiles them. A law that predicts held-out points is evidence; a law
// fitted to its own data is not.
//
// Both inputs are unbounded consumer settings ($breakpoints is an arbitrary-length
// map; $grid-column-count is any integer), so if the law holds the defect count
// has NO finite upper bound and no cartesian gate can enumerate it.
//
// Read-only. Usage: node unboundedness-law.mjs

import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

import { classifyCss } from './rtl-defect-classifier.mjs';

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

// Every breakpoint name Foundation's own $breakpoints template can carry, plus
// synthetic ones -- $breakpoints is a plain map, so a consumer can add any name.
const BP_NAMES = ['small', 'medium', 'large', 'xlarge', 'xxlarge', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12'];

function bpPre(n) {
  const names = BP_NAMES.slice(0, n);
  const map = names.map((name, i) => `${name}: ${i === 0 ? 0 : `${i * 320}px`}`).join(', ');

  return [`$breakpoints: (${map});`, `$breakpoint-classes: (${names.join(' ')});`];
}

function measure(cols, bpCount) {
  const css = sass.compileString(
    [
      ...bpPre(bpCount),
      `$grid-column-count: ${cols};`,
      "@import 'foundation-sites/scss/foundation';",
      '$global-left: inline-start;',
      '$global-right: inline-end;',
      ...ALL_MIXINS.map((m) => `@include ${m};`),
    ].join('\n'),
    { loadPaths, style: 'expanded', logger: sass.Logger.silent },
  ).css;

  return { bytes: css.length, counts: classifyCss(css).counts };
}

const law = (cols, bp) => 2 * cols * bp + bp + 23;

// Held-out predictions -- none of these combinations was used to fit the law.
// NOTE: fewer than 3 breakpoints is not testable -- Foundation's own
// `$print-breakpoint: large` and `$reveal-breakpoint: medium` defaults call
// breakpoint() with names that must exist in $breakpoints, so a 2-name map is a
// hard Sass error ("Undefined operation 2 <= null") for reasons unrelated to RTL.
const HELD_OUT = [
  [16, 4],
  [8, 6],
  [12, 4],
  [20, 3],
  [12, 8],
  [32, 3],
  [12, 12],
  [48, 6],
  [5, 9],
];

console.log('=== HELD-OUT PREDICTION TEST ===');
console.log('law: c2 = 2 * grid-column-count * |breakpoint-classes| + |breakpoint-classes| + 23\n');
console.log('  cols   bps   predicted   measured   verdict     css bytes');
let hits = 0;

for (const [cols, bp] of HELD_OUT) {
  const m = measure(cols, bp);
  const p = law(cols, bp);
  const ok = m.counts.c2_bareSidePositioning === p;
  hits += ok ? 1 : 0;
  console.log(
    `  ${String(cols).padStart(4)}  ${String(bp).padStart(4)}   ${String(p).padStart(9)}   ${String(m.counts.c2_bareSidePositioning).padStart(8)}   ${ok ? '[OK]      ' : '[MISMATCH]'}  ${m.bytes}`,
  );
}

console.log(`\n  held-out points predicted exactly: ${hits} / ${HELD_OUT.length}`);

console.log('\n=== the other five classes across the same range (are THEY bounded?) ===');
console.log('  cols   bps   c1  c2     c3  c4  c5  c6');

for (const [cols, bp] of [
  [12, 1],
  [12, 3],
  [12, 12],
  [48, 6],
  [48, 12],
]) {
  const c = measure(cols, bp).counts;
  console.log(
    `  ${String(cols).padStart(4)}  ${String(bp).padStart(4)}   ${String(c.c1_textAlignValue).padStart(2)}  ${String(c.c2_bareSidePositioning).padStart(5)}  ${String(c.c3_logicalRadius).padStart(3)}  ${String(c.c4_backgroundPosition).padStart(2)}  ${String(c.c5_classNameRename).padStart(2)}  ${String(c.c6_triangleDegenerate).padStart(2)}`,
  );
}
