// Ticket 14: does the R004 $global-left/$global-right rebind emit INVALID CSS
// when generalised beyond Button?
//
// The rebind is VARIABLE substitution: `inline-start` is spliced wherever
// Foundation interpolated `left`. That is only correct where the physical
// construct has an identically-shaped logical counterpart. Where it does not,
// Sass still compiles (it does not validate CSS) and the browser SILENTLY drops
// the declaration.
//
// This probe compiles foundation-everything() WITH the rebind and classifies
// every declaration whose value or property mentions inline-start/inline-end.
//
// Read-only. Writes nothing.
// Usage: node rtl-rebind-validity-probe.mjs

import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const loadPaths = [join(repoRoot, 'node_modules'), join(repoRoot, 'packages/ngx-foundation-sites/src/scss')];

const css = sass.compileString(
  `
@import 'foundation-sites/scss/foundation';
$global-left: inline-start;
$global-right: inline-end;
@include foundation-everything();
`,
  { loadPaths, style: 'expanded' },
).css;

// Properties that genuinely accept an inline-start/inline-end VALUE.
const LOGICAL_VALUE_OK = new Set(['float', 'clear', 'caption-side', 'resize']);

// Property NAMES that genuinely exist with an -inline-start/-inline-end suffix
// or infix.
const LOGICAL_PROP_OK = new Set([
  'margin-inline-start',
  'margin-inline-end',
  'padding-inline-start',
  'padding-inline-end',
  'border-inline-start',
  'border-inline-end',
  'border-inline-start-width',
  'border-inline-end-width',
  'border-inline-start-color',
  'border-inline-end-color',
  'border-inline-start-style',
  'border-inline-end-style',
  'inset-inline-start',
  'inset-inline-end',
  'scroll-margin-inline-start',
  'scroll-margin-inline-end',
  'scroll-padding-inline-start',
  'scroll-padding-inline-end',
]);

const ok = new Map();
const bad = new Map();

for (const raw of css.split('\n')) {
  const line = raw.trim().replace(/;$/, '');

  if (!line.includes('inline-start') && !line.includes('inline-end')) {
    continue;
  }

  const colon = line.indexOf(':');

  if (colon < 0) {
    continue;
  }

  const prop = line.slice(0, colon).trim();
  const value = line.slice(colon + 1).trim();
  const propIsLogical = prop.includes('inline-start') || prop.includes('inline-end');
  const valueIsLogical = value.includes('inline-start') || value.includes('inline-end');

  let verdict;

  if (propIsLogical) {
    verdict = LOGICAL_PROP_OK.has(prop) ? 'ok' : `INVALID PROPERTY NAME (no such CSS property '${prop}')`;
  } else if (valueIsLogical) {
    verdict = LOGICAL_VALUE_OK.has(prop) ? 'ok' : `INVALID VALUE for '${prop}' (does not accept inline-start/inline-end)`;
  }

  const bucket = verdict === 'ok' ? ok : bad;
  const key = verdict === 'ok' ? prop : `${verdict}  ->  ${line}`;
  bucket.set(key, (bucket.get(key) ?? 0) + 1);
}

console.log('=== VALID after the rebind ===');

for (const [k, n] of [...ok].sort()) {
  console.log(`  [OK]    x${String(n).padStart(3)}  ${k}`);
}

console.log('\n=== INVALID after the rebind (browsers drop these SILENTLY) ===');
let total = 0;

for (const [k, n] of [...bad].sort()) {
  total += n;
  console.log(`  [BAD]   x${String(n).padStart(3)}  ${k}`);
}

console.log(`\nTOTAL INVALID DECLARATIONS: ${total}`);
console.log(`TOTAL VALID DECLARATIONS:   ${[...ok.values()].reduce((a, b) => a + b, 0)}`);
