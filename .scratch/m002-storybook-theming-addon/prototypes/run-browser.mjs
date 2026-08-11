// Drive a real Chromium against the harness and answer jobs 1-4.
//
// Usage: node run-browser.mjs <outDir> [terser|esbuild|none] [warmRuns]

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname as pathDirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = pathDirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? join(here, 'out');
const bundleMode = process.argv[3] ?? 'terser';
const WARM_RUNS = Number(process.argv[4] ?? 25);

const CASES = {
  default: {},
  themed: { background: '#2a5db0', palette: 'success: #238648', radius: '6px' },
  compliant: { palette: 'success: #238648, warning: #9e6c00, alert: #cb4b37' },
};

const html = readFileSync(join(here, 'harness.html'), 'utf8').replace(
  'sass-bundle.BUNDLE.js',
  `sass-bundle.${bundleMode}.js`,
);

const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html' };

const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];

  if (url === '/' || url === '/harness.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(html);

    return;
  }

  const file = join(outDir, url.replace(/^\//, ''));

  if (!existsSync(file)) {
    res.writeHead(404);
    res.end('nope');

    return;
  }

  const body = readFileSync(file);
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  res.end(body);
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;

const report = { bundleMode, base, transferred: {} };

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    consoleErrors.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  }
});
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 400)}`));

page.on('response', async (resp) => {
  try {
    const sizes = await resp.request().sizes();
    report.transferred[new URL(resp.url()).pathname] = {
      transferred: sizes.responseBodySize + sizes.responseHeadersSize,
      body: sizes.responseBodySize,
      status: resp.status(),
    };
  } catch {
    /* ignore */
  }
});

// ---- COLD: navigation through sass bundle parse + dart2js init ----
const navStart = Date.now();
await page.goto(base, { waitUntil: 'load' });

let ready = false;

try {
  await page.waitForFunction(() => globalThis.__nfsReady === true, null, { timeout: 30000 });
  ready = true;
} catch {
  ready = false;
}

report.bundleInitOk = ready;
report.consoleErrors = consoleErrors.slice(0, 20);

if (!ready) {
  report.fatal = 'sass bundle failed to initialise in the browser';
  console.log(JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, `browser-report.${bundleMode}.json`), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
  process.exit(0);
}

report.bundleReadyMs = await page.evaluate(() => globalThis.__nfs.sassLoadedAt);
report.navToReadyWallMs = Date.now() - navStart;
report.sassExportCount = (await page.evaluate(() => globalThis.__nfs.sassKeys)).length;
report.sourceCount = await page.evaluate(() => globalThis.__nfs.sourceCount);
report.nodeApiProbe = await page.evaluate(() => globalThis.__nfs.probeNodeApis());

// ---- COLD compile (first ever) ----
const cold = await page.evaluate((c) => {
  const r = globalThis.__nfs.compile(c);

  return {
    ms: r.ms,
    bytes: new TextEncoder().encode(r.css).length,
    canonicalizeCalls: r.canonicalizeCalls,
    fromImportCalls: r.fromImportCalls,
    loadCalls: r.loadCalls,
    misses: r.misses,
    loadedUrls: r.loadedUrls,
  };
}, CASES.default);
report.coldCompile = cold;

// ---- WARM distribution, per case ----
report.warm = {};

for (const [name, opts] of Object.entries(CASES)) {
  const runs = await page.evaluate(
    ([o, n]) => {
      const out = [];

      for (let i = 0; i < n; i += 1) {
        out.push(globalThis.__nfs.compile(o).ms);
      }

      return out;
    },
    [opts, WARM_RUNS],
  );
  report.warm[name] = runs;
}

// ---- ERROR PATH + RESPONSIVENESS ----
report.errorProbe = await page.evaluate(() => globalThis.__nfs.probeError());
report.frameGap = await page.evaluate(
  (o) => globalThis.__nfs.measureFrameGap(o),
  CASES.themed,
);

// ---- ASYNC comparison ----
report.asyncCompile = await page.evaluate(
  (o) => globalThis.__nfs.compileAsyncOnce(o),
  CASES.themed,
);

// ---- LONG TASKS ----
report.longTasks = await page.evaluate(() => globalThis.__longTasks.map((t) => t.duration));
report.longTaskError = await page.evaluate(() => globalThis.__longTaskError ?? null);

// ---- CSS capture + injection + computed style (job 2 and job 3) ----
report.css = {};
report.computed = {};

for (const [name, opts] of Object.entries(CASES)) {
  const css = await page.evaluate((o) => globalThis.__nfs.compile(o).css, opts);
  report.css[name] = css;

  await page.evaluate((c) => {
    document.getElementById('nfs-theme').textContent = c;
  }, css);

  report.computed[name] = await page.evaluate(() => {
    const el = document.querySelector('.button.dropdown');
    const cs = getComputedStyle(el, '::after');
    const base = getComputedStyle(el);
    const primary = getComputedStyle(document.querySelector('.button'));

    return {
      afterFloat: cs.float,
      afterCssFloat: cs.cssFloat,
      afterMarginLeft: cs.marginLeft,
      afterMarginRight: cs.marginRight,
      afterMarginInlineStart: cs.marginInlineStart,
      afterMarginInlineEnd: cs.marginInlineEnd,
      dropdownPaddingRight: base.paddingRight,
      primaryBg: primary.backgroundColor,
      primaryRadius: primary.borderTopLeftRadius,
      dir: document.documentElement.dir || 'ltr',
    };
  });
}

// RTL: same stylesheet, dir=rtl -- inline-end must resolve to the other side.
await page.evaluate((c) => {
  document.documentElement.setAttribute('dir', 'rtl');
  document.getElementById('nfs-theme').textContent = c;
}, report.css.themed);
report.computedRtl = await page.evaluate(() => {
  const el = document.querySelector('.button.dropdown');
  const cs = getComputedStyle(el, '::after');

  return {
    afterFloat: cs.float,
    afterMarginLeft: cs.marginLeft,
    afterMarginRight: cs.marginRight,
    dir: document.documentElement.dir,
  };
});

// ---- SECOND COLD LOAD, warm HTTP cache (reload) ----
const reloadStart = Date.now();
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__nfsReady === true, null, { timeout: 30000 });
report.reloadWallMs = Date.now() - reloadStart;
report.reloadBundleInitMs = await page.evaluate(() => globalThis.__nfs.sassLoadedAt);

await browser.close();
server.close();

writeFileSync(join(outDir, `browser-report.${bundleMode}.json`), JSON.stringify(report, null, 2));

const summary = { ...report };
delete summary.css;
console.log(JSON.stringify(summary, null, 2));
