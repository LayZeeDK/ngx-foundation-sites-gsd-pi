// TICKET 09 FIRST-ACTION SPIKE (routed from ticket 08 section 6).
//
// Question: does `new Worker(new URL('./x', import.meta.url))` get processed
// into a separate worker chunk under the webpack config Storybook's Angular
// preview actually ends up with?
//
// Ticket 08's worry: @angular-devkit/build-angular sets
// `module.parser.javascript.worker = !!webWorkerTsConfig` (= false, because
// @storybook/angular never supplies webWorkerTsConfig).
//
// This script builds the SAME entry three ways and compares emitted chunks:
//   A. no module.parser at all      -- what the merged Storybook config has
//   B. parser.javascript.worker=false -- what Angular's config alone would give
//   C. classic vs module worker syntax
//
// Read-only w.r.t. the repo: everything is written under the OS temp dir.
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(
  'D:/projects/github/LayZeeDK/ngx-foundation-sites-gsd-pi/package.json',
);
const webpack = require('webpack');

const MARKER = 'NFS_WORKER_SPIKE_MARKER_ONLY_IN_WORKER';

function makeProject(workerOptions) {
  const dir = mkdtempSync(join(tmpdir(), 'nfs-worker-spike-'));
  mkdirSync(join(dir, 'src'), { recursive: true });

  writeFileSync(
    join(dir, 'src', 'theming-worker.js'),
    [
      `const marker = '${MARKER}';`,
      "self.onmessage = (e) => { self.postMessage(marker + ':' + e.data); };",
      'export {};',
    ].join('\n'),
  );

  writeFileSync(
    join(dir, 'src', 'index.js'),
    [
      'export function startWorker() {',
      `  const w = new Worker(new URL('./theming-worker.js', import.meta.url)${workerOptions});`,
      '  return w;',
      '}',
    ].join('\n'),
  );

  return dir;
}

function build(label, { workerOptions, parser }) {
  const dir = makeProject(workerOptions);
  const out = join(dir, 'dist');

  const config = {
    mode: 'production',
    devtool: false,
    target: 'web',
    entry: join(dir, 'src', 'index.js'),
    output: { path: out, filename: 'main.[contenthash:8].js', clean: true },
    optimization: { minimize: false },
    module: parser ? { parser } : {},
  };

  return new Promise((resolve) => {
    webpack(config, (err, stats) => {
      if (err) {
        console.log(`${label}: HARD ERROR ${err.message}`);

        return resolve(null);
      }

      const info = stats.toJson({ all: false, errors: true, warnings: true, assets: true });
      const files = readdirSync(out);
      const withMarker = files.filter((f) =>
        readFileSync(join(out, f), 'utf8').includes(MARKER),
      );
      const entryFile = files.find((f) => f.startsWith('main.'));
      const entryHasMarker = withMarker.includes(entryFile);
      const separateWorkerChunk = withMarker.filter((f) => f !== entryFile);

      console.log(`--- ${label}`);
      console.log(`    assets emitted        : ${files.length} -> ${files.join(', ')}`);
      console.log(`    chunks with marker    : ${withMarker.join(', ') || '(none)'}`);
      console.log(`    marker in ENTRY chunk : ${entryHasMarker}`);
      console.log(`    SEPARATE worker chunk : ${separateWorkerChunk.length > 0 ? separateWorkerChunk.join(', ') : 'NO'}`);
      console.log(`    errors                : ${(info.errors ?? []).length}`);

      for (const e of info.errors ?? []) {
        console.log(`      ERR ${(e.message || '').split('\n')[0]}`);
      }

      console.log(`    warnings              : ${(info.warnings ?? []).length}`);

      for (const w of info.warnings ?? []) {
        console.log(`      WARN ${(w.message || '').split('\n')[0]}`);
      }

      console.log('');
      resolve({ label, separateWorkerChunk, entryHasMarker, errors: (info.errors ?? []).length });
    });
  });
}

console.log(`webpack ${require('webpack/package.json').version}\n`);

const results = [];
results.push(await build('A. classic Worker, NO module.parser  (= merged Storybook config)', { workerOptions: '', parser: null }));
results.push(await build("B. classic Worker, parser.javascript.worker=false  (= Angular's own)", { workerOptions: '', parser: { javascript: { worker: false } } }));
results.push(await build("C. module Worker {type:'module'}, NO module.parser", { workerOptions: ", { type: 'module' }", parser: null }));
results.push(await build("D. module Worker {type:'module'}, parser.worker=false", { workerOptions: ", { type: 'module' }", parser: { javascript: { worker: false } } }));

console.log('================ VERDICT ================');

for (const r of results) {
  if (!r) {
    continue;
  }

  const split = r.separateWorkerChunk.length > 0;
  console.log(
    `${split ? '[OK]  ' : '[FAIL]'} ${r.label.padEnd(66)} split=${split ? 'YES' : 'NO'} inlined-in-entry=${r.entryHasMarker}`,
  );
}
