// Bundle worker-entry.mjs with the same Storybook Terser config, then run it
// in a real Chromium Worker and measure main-thread responsiveness while the
// worker compiles.
//
// Usage: node run-worker.mjs <outDir>

import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname as pathDirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import webpack from 'webpack';
import TerserWebpackPlugin from 'terser-webpack-plugin';
import { chromium } from '@playwright/test';

const here = pathDirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? join(here, 'out');

await new Promise((done, fail) => {
  webpack(
    {
      mode: 'production',
      devtool: false,
      target: 'webworker',
      entry: join(here, 'worker-entry.mjs'),
      output: { path: outDir, filename: 'sass-worker.js' },
      resolve: {
        extensions: ['.mjs', '.js', '.json'],
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['webpack', 'production', 'browser', 'import', 'module', 'default'],
        alias: { 'nfs-sources': join(outDir, 'sources.json') },
      },
      optimization: {
        minimize: true,
        minimizer: [
          new TerserWebpackPlugin({
            parallel: true,
            terserOptions: { sourceMap: true, mangle: false, keep_fnames: true },
          }),
        ],
      },
      performance: { hints: false },
      infrastructureLogging: { level: 'error' },
      stats: 'errors-only',
    },
    (err, stats) => {
      if (err || stats.hasErrors()) {
        fail(err ?? new Error(stats.toString()));

        return;
      }

      done();
    },
  );
});

const PAGE = `<!doctype html><html><body><script>
window.__result = null;
window.__gaps = [];
(function(){
  var last = performance.now();
  function tick(){ var n = performance.now(); window.__gaps.push(n-last); last = n; requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
})();
var w = new Worker('./sass-worker.js');
window.__start = null;
w.onmessage = function(e){ window.__result = { ...e.data, wallMs: performance.now() - window.__start }; };
window.__run = function(opts, runs){ window.__gaps.length = 0; window.__start = performance.now(); w.postMessage({opts: opts, runs: runs}); };
</script></body></html>`;

const MIME = { '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];

  if (url === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE);

    return;
  }

  const file = join(outDir, url.replace(/^\//, ''));

  if (!existsSync(file)) {
    res.writeHead(404);
    res.end('');

    return;
  }

  const body = readFileSync(file);
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(body);
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') {
    errors.push(m.text());
  }
});

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.evaluate(() =>
  globalThis.__run({ background: '#2a5db0', palette: 'success: #238648', radius: '6px' }, 10),
);
await page.waitForFunction(() => globalThis.__result !== null, null, { timeout: 120000 });

const result = await page.evaluate(() => ({
  ...globalThis.__result,
  maxMainThreadGapMs: Math.max(...globalThis.__gaps),
  frames: globalThis.__gaps.length,
}));

const workerBytes = readFileSync(join(outDir, 'sass-worker.js')).length;
const report = { ...result, workerBundleBytes: workerBytes, errors };
writeFileSync(join(outDir, 'worker-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();
server.close();
