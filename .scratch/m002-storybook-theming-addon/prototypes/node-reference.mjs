// Node-side reference compiles for the byte-for-byte diff (job 2).
//
// Two references per input:
//   A. same in-memory string map + same importer  -> isolates runtime differences
//   B. real filesystem importer + loadPaths       -> what the repo's build does
//
// Usage: node node-reference.mjs <outDir>

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as sass from 'sass';

import { createImporter, entryFor } from './importer.mjs';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const outDir = process.argv[2] ?? join(here, 'out');
const sources = JSON.parse(readFileSync(join(outDir, 'sources.json'), 'utf8'));

export const CASES = {
  default: {},
  themed: {
    background: '#2a5db0',
    palette: 'success: #238648',
    radius: '6px',
  },
  compliant: {
    palette: 'success: #238648, warning: #9e6c00, alert: #cb4b37',
  },
};

const opts = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  alertColor: false,
};

// Reference B needs the island's bare `foundation-sites/scss/...` @imports to
// resolve exactly the way project.json's `--load-path=node_modules` does.
const fsEntry = (name) =>
  entryFor(CASES[name]).replace(
    "@use 'nfs:/button'",
    `@use '${pathToFileURL(join(repoRoot, 'packages/ngx-foundation-sites/src/scss/_button.scss')).href}'`,
  );

const out = {};
const timings = {};

for (const name of Object.keys(CASES)) {
  const { importer } = createImporter(sources);
  const a = sass.compileString(entryFor(CASES[name]), {
    ...opts,
    importers: [importer],
  });

  const b = sass.compileString(fsEntry(name), {
    ...opts,
    loadPaths: [join(repoRoot, 'node_modules')],
  });

  out[name] = { stringMap: a.css, filesystem: b.css };

  const runs = [];

  for (let i = 0; i < 15; i += 1) {
    const { importer: imp } = createImporter(sources);
    const t = performance.now();
    sass.compileString(entryFor(CASES[name]), { ...opts, importers: [imp] });
    runs.push(performance.now() - t);
  }

  timings[name] = runs;

  console.log(
    `[${name}] stringMap=${Buffer.byteLength(a.css)}B filesystem=${Buffer.byteLength(b.css)}B identical=${a.css === b.css}`,
  );
}

writeFileSync(join(outDir, 'node-reference.json'), JSON.stringify(out));
writeFileSync(join(outDir, 'node-timings.json'), JSON.stringify(timings));
console.log('[OK] wrote node-reference.json');
