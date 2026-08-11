// Ticket 14: MEASURE the RTL residue -- how much of Foundation's emitted CSS
// actually differs between $global-text-direction: ltr and rtl, and how much of
// that difference the R004 $global-left/$global-right rebind removes.
//
// Read-only. Compiles in memory via loadPaths (the same mechanism
// scripts/verify-foundation-parity.mjs uses). Writes nothing.
//
// Usage: node rtl-residue-probe.mjs

import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const loadPaths = [join(repoRoot, 'node_modules'), join(repoRoot, 'packages/ngx-foundation-sites/src/scss')];

function compile(source) {
  return sass.compileString(source, { loadPaths, style: 'expanded' }).css;
}

// Declaration-level diff: the set of `prop: value` lines present in one sheet
// and not the other. Selector context is ignored on purpose -- we want to know
// WHAT differs, and a stable count.
function declLines(css) {
  const out = new Map();

  for (const raw of css.split('\n')) {
    const line = raw.trim();

    if (!line || line.endsWith('{') || line === '}' || line.startsWith('/*') || line.startsWith('@')) {
      continue;
    }

    out.set(line, (out.get(line) ?? 0) + 1);
  }

  return out;
}

function diff(a, b) {
  const onlyA = [];
  const onlyB = [];

  for (const [k, n] of a) {
    const m = b.get(k) ?? 0;

    if (n > m) {
      onlyA.push(`${k}${n - m > 1 ? ` (x${n - m})` : ''}`);
    }
  }

  for (const [k, n] of b) {
    const m = a.get(k) ?? 0;

    if (n > m) {
      onlyB.push(`${k}${n - m > 1 ? ` (x${n - m})` : ''}`);
    }
  }

  return { onlyA, onlyB };
}

function report(label, ltrCss, rtlCss, showAll) {
  const identical = ltrCss === rtlCss;
  console.log(`\n=== ${label} ===`);
  console.log(`ltr ${ltrCss.length} bytes | rtl ${rtlCss.length} bytes | BYTE-IDENTICAL: ${identical}`);

  if (identical) {
    return 0;
  }

  const { onlyA, onlyB } = diff(declLines(ltrCss), declLines(rtlCss));
  console.log(`declarations only in LTR: ${onlyA.length} | only in RTL: ${onlyB.length}`);
  const cap = showAll ? Number.POSITIVE_INFINITY : 24;

  for (const line of onlyA.slice(0, cap)) {
    console.log(`  LTR-only  ${line}`);
  }

  for (const line of onlyB.slice(0, cap)) {
    console.log(`  RTL-only  ${line}`);
  }

  if (!showAll && (onlyA.length > cap || onlyB.length > cap)) {
    console.log('  ... truncated');
  }

  return onlyA.length + onlyB.length;
}

// ---------------------------------------------------------------------------
// A. The REAL nfs button chain. The island seeds $button-margin and rebinds
//    $global-left/$global-right, so a consumer's direction must be inert.
// ---------------------------------------------------------------------------
const buttonChain = (dir) => `
$global-text-direction: ${dir};
@use 'internal/foundation-button' as fb;
@use 'button' as nfs-button;
@include nfs-button.theme();
`;

report('A. real nfs button chain (public theme() API), consumer sets direction', compile(buttonChain('ltr')), compile(buttonChain('rtl')), true);

// ---------------------------------------------------------------------------
// B. Foundation's WHOLE tree, unmodified, Sass-time direction. This is the
//    residue an ngx-foundation-sites covering all components would inherit if
//    it did nothing.
// ---------------------------------------------------------------------------
const everything = (dir, rebind) => `
$global-text-direction: ${dir};
@import 'foundation-sites/scss/foundation';
${rebind ? '$global-left: inline-start;\n$global-right: inline-end;' : ''}
@include foundation-everything();
`;

const bTotal = report('B. foundation-everything(), NO rebind (Foundation as shipped)', compile(everything('ltr', false)), compile(everything('rtl', false)), false);

// ---------------------------------------------------------------------------
// C. Same, WITH R004's post-import logical-property rebind applied globally.
//    Whatever still differs is the residue the rebind provably cannot reach.
// ---------------------------------------------------------------------------
const cTotal = report('C. foundation-everything(), WITH R004 rebind ($global-left/right -> inline-start/end)', compile(everything('ltr', true)), compile(everything('rtl', true)), true);

console.log(`\n=== SUMMARY ===`);
console.log(`residue without rebind: ${bTotal} differing declarations`);
console.log(`residue WITH rebind:    ${cTotal} differing declarations`);
console.log(`rebind closes:          ${bTotal - cTotal} of ${bTotal} (${bTotal ? Math.round(((bTotal - cTotal) / bTotal) * 100) : 0}%)`);
