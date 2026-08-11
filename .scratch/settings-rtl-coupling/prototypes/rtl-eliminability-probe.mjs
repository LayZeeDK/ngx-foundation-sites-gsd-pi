// Ticket 02 -- is the RTL residue eliminable?
//
// Sections:
//   A  substitution sweep      -- can ANY value of $global-left/$global-right
//                                 make all six defect classes valid at once?
//   B  hook inventory          -- what interception points exist in Foundation's
//                                 Sass, and which defect classes they reach.
//   C  the eliminator          -- Foundation UNMODIFIED + a `:dir(rtl)` override
//                                 layer derived from the two-pass diff.
//   D  settings matrix         -- does any consumer setting reintroduce a defect?
//   E  per-defect-class table  -- the emitted override for one site of each class.
//
// Read-only with respect to the repo. Writes only under .scratch/.
// Usage: node rtl-eliminability-probe.mjs

import { writeFileSync } from 'node:fs';
import { dirname as pathDirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildOverrideSheet,
  buildSingleSheet,
  compileFoundation,
  countMap,
  diffPasses,
  flatten,
  parseRules,
  validate,
  verifyEquivalence,
} from './rtl-eliminator.mjs';

const here = pathDirname(fileURLToPath(import.meta.url));
const EVERYTHING = '@include foundation-everything();';

function hr(title) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

function invalidCount(css) {
  const v = validate(css);

  return {
    unknownProperty: countMap(v.unknownProperty),
    invalidValue: countMap(v.invalidValue),
    total: countMap(v.unknownProperty) + countMap(v.invalidValue),
    detail: v,
  };
}

// ===========================================================================
// A -- substitution sweep
// ===========================================================================

hr('A. SUBSTITUTION SWEEP -- is there ANY value the rebind could use?');

const CANDIDATES = [
  ['left', 'right', 'Foundation UNMODIFIED (no rebind)'],
  ['inline-start', 'inline-end', 'R004 rebind, as shipped for Button'],
  ['start', 'end', 'text-align/logical-value keywords'],
  ['inset-inline-start', 'inset-inline-end', 'bare-side positioning fix'],
];

// $global-flexbox: false unlocks the text-align sites in _menu.scss;
// $buttongroup-radius-on-each: false unlocks the 14 corner-radius sites.
const UNLOCK_ALL = ['$global-flexbox: false;', '$buttongroup-radius-on-each: false;'];

for (const label of ['Foundation defaults', 'settings that unlock the latent sites']) {
  const settings = label === 'Foundation defaults' ? [] : UNLOCK_ALL;

  console.log(`\n--- ${label} ---`);

  for (const [l, r, why] of CANDIDATES) {
    const css = compileFoundation({
      rebindLeft: l === 'left' ? null : l,
      rebindRight: r === 'right' ? null : r,
      settings,
      include: EVERYTHING,
    });
    const c = invalidCount(css);

    console.log(
      `  $global-left: ${l.padEnd(18)} invalid declarations: ${String(c.total).padStart(3)}` +
        `  (unknown property ${c.unknownProperty}, invalid value ${c.invalidValue})   ${why}`,
    );

    if (c.total > 0) {
      for (const [k, n] of [...c.detail.unknownProperty, ...c.detail.invalidValue].sort().slice(0, 4)) {
        console.log(`      x${String(n).padStart(3)}  ${k}`);
      }
    }
  }
}

// ===========================================================================
// B -- hook inventory
// ===========================================================================

hr('B. HOOK INVENTORY -- what can be intercepted after the @import?');

// B1: is a post-@import MIXIN redefinition honoured by Foundation's own later
// @include? (Legacy @import puts mixins in one global scope resolved at include
// time, so a later definition should win.)
const shadowProbe = compileFoundation({
  include: '',
  append: [
    '@mixin css-triangle($size, $color, $direction) {',
    '  probe-shadow: hit;',
    '  probe-direction: #{$direction};',
    '}',
    '.drilldown { @include zf-drilldown-left-right-arrows; }',
  ].join('\n'),
  rebindLeft: 'inline-start',
  rebindRight: 'inline-end',
});

const shadowWorks = shadowProbe.includes('probe-shadow: hit');

console.log(`B1  mixin shadowing after @import honoured by Foundation's @include: ${shadowWorks ? '[OK] YES' : '[WARN] NO'}`);
console.log(
  '    emitted: ' +
    shadowProbe
      .split('\n')
      .filter((l) => l.includes('probe-'))
      .map((l) => l.trim())
      .join(' / '),
);

// B2: is a post-@import FUNCTION redefinition honoured?
const fnProbe = compileFoundation({
  include: '',
  append: ['@function rem-calc($v, $b: null) { @return probe-fn-hit; }', '.f { width: rem-calc(16px); }'].join('\n'),
});

console.log(`B2  function shadowing after @import honoured: ${fnProbe.includes('probe-fn-hit') ? '[OK] YES' : '[WARN] NO'}`);

// B3: what a shadowed css-triangle can and cannot fix. Shadow it so that it maps
// the logical keyword back to a physical branch AND emits the mirror under
// `&:dir(rtl)` -- `&` is live inside a mixin, so this is ELEMENT-scoped.
const SHADOW_TRIANGLE = `
@mixin css-triangle($triangle-size, $triangle-color, $triangle-direction) {
  display: block;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: $triangle-size;
  content: '';

  @if $triangle-direction == down {
    border-bottom-width: 0;
    border-color: $triangle-color transparent transparent;
  } @else if $triangle-direction == up {
    border-top-width: 0;
    border-color: transparent transparent $triangle-color;
  } @else if $triangle-direction == right or $triangle-direction == inline-end {
    border-right-width: 0;
    border-color: transparent transparent transparent $triangle-color;

    @if $triangle-direction == inline-end {
      &:dir(rtl) {
        border-right-width: $triangle-size;
        border-left-width: 0;
        border-color: transparent $triangle-color transparent transparent;
      }
    }
  } @else if $triangle-direction == left or $triangle-direction == inline-start {
    border-left-width: 0;
    border-color: transparent $triangle-color transparent transparent;

    @if $triangle-direction == inline-start {
      &:dir(rtl) {
        border-left-width: $triangle-size;
        border-right-width: 0;
        border-color: transparent transparent transparent $triangle-color;
      }
    }
  }
}
`;

const rebindOnly = compileFoundation({
  rebindLeft: 'inline-start',
  rebindRight: 'inline-end',
  include: EVERYTHING,
  settings: UNLOCK_ALL,
});
const rebindPlusShadow = compileFoundation({
  rebindLeft: 'inline-start',
  rebindRight: 'inline-end',
  include: `${SHADOW_TRIANGLE}\n${EVERYTHING}`,
  settings: UNLOCK_ALL,
});

function ruleFor(css, selectorNeedle) {
  return parseRules(css)
    .filter((r) => r.selector.includes(selectorNeedle))
    .map((r) => `${r.selector} { ${r.decls.map((d) => `${d.prop}: ${d.value}`).join('; ')} }`);
}

const NEEDLE = '.is-drilldown-submenu-parent>a::after';
const isSquare = (rules) => rules.some((r) => r.includes('border-style: solid') && !r.includes('border-color'));

console.log('\nB3  the css-triangle ARGUMENT-level defect (class 6):');
console.log(`    rebind only  -- solid square (no @if branch matched): ${isSquare(ruleFor(rebindOnly, NEEDLE))}`);

for (const r of ruleFor(rebindOnly, NEEDLE)) {
  console.log(`      ${r}`);
}

console.log(`    rebind + shadowed css-triangle -- solid square: ${isSquare(ruleFor(rebindPlusShadow, NEEDLE))}`);

for (const r of ruleFor(rebindPlusShadow, NEEDLE).concat(ruleFor(rebindPlusShadow, ':dir(rtl)::after'))) {
  console.log(`      ${r}`);
}

console.log(`\nB3  invalid declarations, rebind only:      ${invalidCount(rebindOnly).total}`);
console.log(`B3  invalid declarations, rebind + shadow:  ${invalidCount(rebindPlusShadow).total}`);
console.log('    => the mixin hook fixes class 6 and NOTHING else: the invalid-CSS count is');
console.log('       unchanged because classes 1-5 are literal property-name / class-name');
console.log('       interpolation with no callable anywhere in the path.');

// B4: the class-NAME rename (class 5) -- selector-level, so no declaration-level
// mechanism can see it.
const countSel = (css, re) => parseRules(css).filter((r) => re.test(r.selector)).length;

console.log('\nB4  the class-NAME rename (class 5), counted as SELECTORS:');
console.log(`    rebind:      .align-inline-* selectors emitted: ${countSel(rebindOnly, /\.align-inline-(start|end)/)}`);
console.log(`                 Foundation's public .align-left/.align-right survivors: ${countSel(rebindOnly, /\.align-(left|right)\b/)}`);
console.log(`    unmodified:  .align-inline-* selectors emitted: ${countSel(compileFoundation({ include: EVERYTHING, settings: UNLOCK_ALL }), /\.align-inline-(start|end)/)}`);
console.log(
  `                 Foundation's public .align-left/.align-right survivors: ${countSel(compileFoundation({ include: EVERYTHING, settings: UNLOCK_ALL }), /\.align-(left|right)\b/)}`,
);

// ===========================================================================
// C -- the eliminator
// ===========================================================================

hr('C. THE ELIMINATOR -- Foundation unmodified + a :dir(rtl) override layer');

function runEliminator(settings, label) {
  const ltr = compileFoundation({ dir: 'ltr', settings, include: EVERYTHING });
  const rtl = compileFoundation({ dir: 'rtl', settings, include: EVERYTHING });
  const built = buildSingleSheet(ltr, rtl);
  const { ltrMap, rtlMap, diff } = built;
  const single = built.css;

  return {
    label,
    settings,
    ltr,
    rtl,
    ltrMap,
    rtlMap,
    diff,
    built,
    resets: diff.propDiffs.filter((d) => d.rtl === undefined),
    single,
    baseInvalid: invalidCount(ltr),
    rtlInvalid: invalidCount(rtl),
    singleInvalid: invalidCount(single),
    rebindInvalid: invalidCount(
      compileFoundation({ rebindLeft: 'inline-start', rebindRight: 'inline-end', settings, include: EVERYTHING }),
    ),
    mismatches: verifyEquivalence(ltrMap, rtlMap, diff),
  };
}

const base = runEliminator([], 'Foundation defaults');

console.log(`base sheet (Foundation LTR, unmodified):  ${base.built.baseBytes} bytes, ${base.ltrMap.size} rules`);
console.log(`direction twins added:                    ${base.built.overrideBytes} bytes  (+${((base.built.overrideBytes / base.built.baseBytes) * 100).toFixed(1)}%)`);
console.log(`single sheet serving both directions:     ${base.single.length} bytes`);
console.log('');
console.log(`declaration diffs between the two passes: ${base.diff.propDiffs.length}`);
console.log(`  of which selector-level (class 5 shape): ${base.diff.propDiffs.filter((d) => d.selectorOnly).length}`);
console.log(`  present in LTR, ABSENT in RTL (no reset value exists): ${base.resets.length}`);
console.log('');
console.log(`INVALID declarations, Foundation unmodified LTR: ${base.baseInvalid.total}`);
console.log(`INVALID declarations, Foundation unmodified RTL: ${base.rtlInvalid.total}`);
console.log(`INVALID declarations, R004 rebind generalised:   ${base.rebindInvalid.total}`);
console.log(`INVALID declarations, ELIMINATOR single sheet:   ${base.singleInvalid.total}`);
console.log('');
console.log(`EQUIVALENCE to Foundation's own RTL build: ${base.mismatches.length === 0 ? '[OK] EXACT (0 mismatches)' : `[WARN] ${base.mismatches.length} mismatches`}`);

for (const m of base.mismatches.slice(0, 10)) {
  console.log(`  ${m.key} { ${m.prop}: want ${m.want} got ${m.got} }`);
}

// How much of the override layer would a logical-property mapping collapse?
const PHYSICAL_PAIR = [
  ['margin-left', 'margin-right'],
  ['padding-left', 'padding-right'],
  ['border-left', 'border-right'],
  ['border-left-width', 'border-right-width'],
  ['border-left-color', 'border-right-color'],
  ['border-left-style', 'border-right-style'],
  ['left', 'right'],
  ['border-top-left-radius', 'border-top-right-radius'],
  ['border-bottom-left-radius', 'border-bottom-right-radius'],
];
const pairProps = new Set(PHYSICAL_PAIR.flat());
const collapsible = base.diff.propDiffs.filter((d) => pairProps.has(d.prop) && !d.selectorOnly);

console.log('');
console.log(`override rows a logical-property mapping COULD collapse: ${collapsible.length} of ${base.diff.propDiffs.length}`);
console.log(`  irreducible rows (no logical property exists):         ${base.diff.propDiffs.length - collapsible.length}`);

// ===========================================================================
// D -- settings matrix
// ===========================================================================

hr('D. SETTINGS MATRIX -- can any consumer setting reintroduce a defect?');

const MATRIX = [
  [[], 'Foundation defaults'],
  [['$buttongroup-radius-on-each: false;'], 'buttongroup-radius-on-each: false'],
  [['$global-flexbox: false;'], 'global-flexbox: false'],
  [['$global-radius: 3px;'], 'global-radius: 3px'],
  [['$drilldown-arrows: true;', '$dropdownmenu-arrows: true;'], 'arrows on'],
  [['$menu-icon-spacing: 0.5rem;', '$table-padding: 1rem;'], 'spacing tweaks'],
  [UNLOCK_ALL, 'flexbox off + radius-on-each off'],
  [[...UNLOCK_ALL, '$global-radius: 6px;', '$button-radius: 6px;'], 'all latent sites + radii'],
];

console.log('config                                 rebind INVALID   eliminator INVALID   overrides   equiv');
const runs = [];

for (const [settings, label] of MATRIX) {
  const r = runEliminator(settings, label);

  runs.push(r);
  console.log(
    `${label.padEnd(38)} ${String(r.rebindInvalid.total).padStart(9)}   ${String(r.singleInvalid.total).padStart(17)}   ` +
      `${String(r.diff.propDiffs.length).padStart(9)}   ${r.mismatches.length === 0 ? '[OK] exact' : `[WARN] ${r.mismatches.length}`}`,
  );
}

// ===========================================================================
// E -- per-defect-class table
// ===========================================================================

hr('E. PER-DEFECT-CLASS -- the emitted override for one site of each class');

const worst = runs.at(-1);
const rowsBySelector = new Map();

for (const d of worst.diff.propDiffs) {
  const k = `${d.context}||${d.selector}`;

  rowsBySelector.set(k, [...(rowsBySelector.get(k) ?? []), d]);
}

const CLASSES = [
  ['1  text-align', (d) => d.prop === 'text-align'],
  ['2  bare-side positioning', (d) => d.prop === 'left' || d.prop === 'right'],
  ['3  corner radius (2-D)', (d) => /^border-(top|bottom)-(left|right)-radius$/.test(d.prop)],
  ['4  background-position', (d) => d.prop === 'background-position'],
  ['5  class-NAME interpolation', (d) => d.selectorOnly && /\.align-(left|right)/.test(d.selector)],
  ['6  css-triangle argument', (d) => /drilldown/.test(d.selector) && /^border-(left|right|top|bottom)?-?(width|color)?$/.test(d.prop)],
];

for (const [name, match] of CLASSES) {
  const hits = worst.diff.propDiffs.filter(match);

  console.log(`\n--- class ${name}: ${hits.length} override rows ---`);

  if (hits.length === 0) {
    console.log('  (none at this settings config)');

    continue;
  }

  const sample = hits[0];
  const key = `${sample.context}||${sample.selector}`;
  const { css } = buildOverrideSheet({ propDiffs: rowsBySelector.get(key) });

  console.log(`  Foundation LTR:  ${sample.selector} { ${sample.prop}: ${sample.ltr ?? '(absent)'} }`);
  console.log(`  Foundation RTL:  ${sample.selector} { ${sample.prop}: ${sample.rtl ?? '(absent)'} }`);
  console.log('  emitted override:');
  console.log(
    css
      .split('\n')
      .map((l) => `    ${l}`)
      .join('\n'),
  );
}

// ---------------------------------------------------------------------------

const outDir = join(here, 'out');

try {
  writeFileSync(join(outDir, 'eliminator-single-sheet.css'), worst.single);
  writeFileSync(join(outDir, 'eliminator-override-layer.css'), worst.overrideCss);
  writeFileSync(join(outDir, 'foundation-rtl-reference.css'), worst.rtl);
} catch {
  const { mkdirSync } = await import('node:fs');

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'eliminator-single-sheet.css'), worst.single);
  writeFileSync(join(outDir, 'eliminator-override-layer.css'), worst.overrideCss);
  writeFileSync(join(outDir, 'foundation-rtl-reference.css'), worst.rtl);
}

console.log(`\n[OK] wrote out/eliminator-single-sheet.css (${worst.single.length} bytes) for the browser probe`);
