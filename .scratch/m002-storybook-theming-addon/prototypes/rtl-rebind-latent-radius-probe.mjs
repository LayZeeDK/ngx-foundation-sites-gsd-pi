// Ticket 14, follow-up: the button-group logical-radius defect is LATENT --
// gated behind `@if not $buttongroup-radius-on-each`, whose Foundation default
// is `true`. So it does not appear in a default compile, and DOES appear for any
// consumer who sets `$buttongroup-radius-on-each: false`.
//
// This matters because it means the invalid-CSS count is a function of CONSUMER
// SETTINGS, not a fixed property of the rebind -- so a gate that compiles one
// fixed settings configuration cannot bound it.
//
// Read-only. Usage: node rtl-rebind-latent-radius-probe.mjs

import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const loadPaths = [join(repoRoot, 'node_modules'), join(repoRoot, 'packages/ngx-foundation-sites/src/scss')];

function compile(radiusOnEach) {
  return sass.compileString(
    [
      `$buttongroup-radius-on-each: ${radiusOnEach};`,
      "@import 'foundation-sites/scss/foundation';",
      '$global-left: inline-start;',
      '$global-right: inline-end;',
      '@include foundation-button-group;',
    ].join('\n'),
    { loadPaths, style: 'expanded' },
  ).css;
}

function scanRadius(css, label) {
  const hits = css
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^border-[a-z]+-inline-(start|end)-radius\s*:/.test(l));

  console.log(`\n=== $buttongroup-radius-on-each: ${label} ===`);
  console.log(`css ${css.length} bytes`);
  console.log(`INVALID logical-radius declarations: ${hits.length}`);

  for (const h of [...new Set(hits)]) {
    console.log(`  [BAD] ${h}`);
  }

  return hits.length;
}

const a = scanRadius(compile('true'), 'true  (Foundation DEFAULT)');
const b = scanRadius(compile('false'), 'false (a legitimate consumer setting)');

console.log(`\n=== SUMMARY ===`);
console.log(`default settings:  ${a} invalid logical-radius declarations`);
console.log(`one setting flipped: ${b} invalid logical-radius declarations`);
console.log(`=> the defect count depends on CONSUMER SETTINGS, not on the rebind alone.`);
