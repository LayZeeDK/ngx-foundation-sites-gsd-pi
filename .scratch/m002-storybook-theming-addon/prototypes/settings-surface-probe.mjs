// Ticket 15 probe A -- what happens TODAY when a consumer tries to bring
// Foundation settings to ngx-foundation-sites.
//
// Read-only: compiles strings against the REAL tracked library files and the
// REAL node_modules/foundation-sites. Writes nothing outside stdout.
//
// Usage: node settings-surface-probe.mjs

import { readFileSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const nodeModules = join(repoRoot, 'node_modules');
const foundationScss = join(nodeModules, 'foundation-sites/scss');
const buttonUrl = pathToFileURL(
  join(repoRoot, 'packages/ngx-foundation-sites/src/scss/_button.scss'),
).href;

const opts = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  alertColor: false,
  loadPaths: [nodeModules, foundationScss],
};

const results = [];

function run(id, question, source) {
  let row;

  try {
    const out = sass.compileString(source, opts);
    row = {
      id,
      question,
      outcome: 'COMPILED',
      bytes: Buffer.byteLength(out.css),
      css: out.css,
      detail: '',
    };
  } catch (error) {
    row = {
      id,
      question,
      outcome: 'ERROR',
      bytes: 0,
      css: '',
      detail: String(error.message).split('\n')[0],
    };
  }

  results.push(row);

  return row;
}

const foundationSettings = readFileSync(
  join(foundationScss, 'settings/_settings.scss'),
  'utf8',
);

// ---------------------------------------------------------------------------
// P0 -- baseline
// ---------------------------------------------------------------------------
const p0 = run(
  'P0',
  'baseline: default theme',
  `@use '${buttonUrl}' as nfs-button;\n@include nfs-button.theme;\n`,
);

// ---------------------------------------------------------------------------
// P1 -- unknown named argument on theme()
// ---------------------------------------------------------------------------
run(
  'P1',
  'theme() with an argument it does not declare ($button-font-size)',
  `@use '${buttonUrl}' as nfs-button;\n@include nfs-button.theme($button-font-size: 2rem);\n`,
);

// ---------------------------------------------------------------------------
// P2 -- @use ... with on the public entry point
// ---------------------------------------------------------------------------
run(
  'P2',
  '@use the public entry point WITH a real Foundation variable name',
  `@use '${buttonUrl}' as nfs-button with ($button-background: #ff0000);\n@include nfs-button.theme;\n`,
);

run(
  'P2b',
  '@use the public entry point WITH an INVENTED variable name',
  `@use '${buttonUrl}' as nfs-button with ($totally-made-up: 1px);\n@include nfs-button.theme;\n`,
);

// ---------------------------------------------------------------------------
// P3 -- consumer declares the Foundation-shaped global in their own file
// ---------------------------------------------------------------------------
const p3a = run(
  'P3a',
  'consumer declares $button-background AFTER the @use (legal placement)',
  `@use '${buttonUrl}' as nfs-button;\n$button-background: #ff0000;\n@include nfs-button.theme;\n`,
);

run(
  'P3b',
  'consumer declares $button-background BEFORE the @use (Foundation habit)',
  `$button-background: #ff0000;\n@use '${buttonUrl}' as nfs-button;\n@include nfs-button.theme;\n`,
);

// ---------------------------------------------------------------------------
// P4 -- typo'd key inside the one map argument that IS public
// ---------------------------------------------------------------------------
const p4 = run(
  'P4',
  "typo'd palette key: $palette: (sucess: ...)",
  `@use '${buttonUrl}' as nfs-button;\n@include nfs-button.theme($palette: (sucess: #238648));\n`,
);

// ---------------------------------------------------------------------------
// P5 -- paste Foundation's real 490-variable _settings.scss unchanged
// ---------------------------------------------------------------------------
const p5a = run(
  'P5a',
  "paste Foundation's real _settings.scss AFTER the @use, then @include",
  `@use '${buttonUrl}' as nfs-button;\n${foundationSettings}\n@include nfs-button.theme;\n`,
);

run(
  'P5b',
  "paste Foundation's real _settings.scss BEFORE the @use (verbatim migration)",
  `${foundationSettings}\n@use '${buttonUrl}' as nfs-button;\n@include nfs-button.theme;\n`,
);

// P5c: the same paste, but with one value CHANGED, to prove effectlessness is
// not an artifact of pasting the defaults.
const changedSettings = foundationSettings.replace(
  '"primary": #1779ba,',
  '"primary": #ff0000,',
);

if (changedSettings === foundationSettings) {
  throw new Error('P5c setup failed: $foundation-palette primary line not found');
}

const p5c = run(
  'P5c',
  "paste Foundation's _settings.scss with $foundation-palette primary CHANGED to #ff0000",
  `@use '${buttonUrl}' as nfs-button;\n${changedSettings}\n@include nfs-button.theme;\n`,
);

// ---------------------------------------------------------------------------
// P6 -- @import Foundation's settings the legacy way, alongside the @use
// ---------------------------------------------------------------------------
run(
  'P6',
  "@import 'foundation-sites/scss/settings/settings' next to the @use",
  `@use '${buttonUrl}' as nfs-button;\n@import 'foundation-sites/scss/settings/settings';\n@include nfs-button.theme;\n`,
);

// ---------------------------------------------------------------------------
// P7 -- can the private internal settings table be reached and configured?
// ---------------------------------------------------------------------------
const internalUrl = pathToFileURL(
  join(repoRoot, 'packages/ngx-foundation-sites/src/scss/internal/_settings.scss'),
).href;

run(
  'P7a',
  'read internal/_settings.scss directly (exports map says null)',
  `@use '${internalUrl}' as s;\na { color: s.$primary-color; }\n`,
);

run(
  'P7b',
  '@use internal/_settings.scss WITH a configuration',
  `@use '${internalUrl}' as s with ($primary-color: #ff0000);\na { color: s.$primary-color; }\n`,
);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log('=== Ticket 15 probe A: settings surface, as it exists TODAY ===\n');

for (const row of results) {
  const same = row.css === p0.css ? ' [BYTE-IDENTICAL TO DEFAULT THEME]' : '';
  console.log(`${row.id}  ${row.outcome.padEnd(8)} ${row.question}`);

  if (row.outcome === 'COMPILED') {
    console.log(`     css=${row.bytes}B${same}`);
  } else {
    console.log(`     ${row.detail}`);
  }

  console.log('');
}

console.log('--- targeted checks ---');
console.log(
  `P3a emitted the consumer's red #ff0000 anywhere: ${p3a.css.includes('#ff0000')}`,
);
console.log(
  `P4 emitted a rule for the TYPO key '.button.sucess': ${p4.css.includes('.sucess')}`,
);
console.log(
  `P4 emitted a rule for the correct key '.button.success': ${p4.css.includes('.success')}`,
);
console.log(
  `P5a css === P0 css (490 pasted defaults changed nothing): ${p5a.css === p0.css}`,
);
console.log(
  `P5c css === P0 css (490 pasted, ONE value changed, still nothing): ${p5c.css === p0.css}`,
);
console.log(
  `P5c emitted the changed #ff0000 anywhere: ${p5c.css.includes('#ff0000')}`,
);
