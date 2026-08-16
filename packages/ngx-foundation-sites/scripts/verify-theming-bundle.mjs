// D035/R021-lane-4 gate: inspects the built Storybook output (dist/storybook/
// ngx-foundation-sites, produced by the `build-storybook` target this target
// depends on) and confirms the Theming addon's key build-time invariants
// survived bundling.
//
// A green `build-storybook` proves nothing about the addon actually loading:
// an unresolvable addon only warns, and a crashing manager entry is swallowed
// by an esbuild-injected try/catch. So this script's addon-load checks (G2a)
// are two-part on purpose -- bundle presence AND `index.html`'s real
// `import` statement, never the `modulepreload` hint, which is present even
// for an addon that silently fails to load.
//
// The lazy-loading checks (G2c/G2d) exist because the Worker split (D034)
// that keeps the ~800 KiB gzip `sass` payload out of *preview* boot is
// provable only by locating the emitted file(s) that carry it and asserting
// none of them are a static import target of `iframe.html`'s own
// module-import list. The presence assertion is never skipped (never assert
// an absence a broken glob/parse would satisfy vacuously), and neither check
// is phrased against `<script src=...>`: `iframe.html` has zero such
// attributes [VERIFIED] -- it loads everything via `import './...';` inside
// one `<script type="module">` block, so a gate phrased against
// `<script src>` would pass forever, including with `sass` statically
// imported into the preview. This is scoped to the preview specifically:
// the manager bundle legitimately also carries the marker (T02 wired the
// panel to call `computePresets()` directly since the self-referencing
// Worker doesn't function under the manager's esbuild bundler), which is a
// separate, already-accepted trade-off outside this gate's stated goal.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname as pathDirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = pathDirname(fileURLToPath(import.meta.url));

// Overridable so negative-control mutations can be exercised against a
// scratch copy of the build output without touching the real dist/.
const DIST_DIR = process.env.NFS_THEMING_BUNDLE_DIR
  ? resolve(process.env.NFS_THEMING_BUNDLE_DIR)
  : join(here, '../../../dist/storybook/ngx-foundation-sites');

// The addon's registration id passed to `addons.register(...)` in
// `.storybook/manager.ts` -- verified to survive minification (content-match,
// not an AST parse).
const ADDON_ID = 'nfs/theming';

// A generated-source-closure marker: a Foundation Sass variable that only
// reaches the build through `theming-sources.generated.ts` -> the Worker's
// `sass.compileString` payload. Never a literal closure file count (that
// would turn an unrelated Sass addition into a red gate for the wrong
// reason) -- this is one stable, already-present identifier instead.
const SOURCES_MARKER = '$button-background-hover-lightness';

const failures = [];

function fail(message, cause) {
  failures.push({ message, cause });
}

function report() {
  if (failures.length > 0) {
    console.error('Theming bundle verification FAILED:');

    for (const { message, cause } of failures) {
      console.error(`  ${message}`);
      console.error(`    ${cause}`);
    }

    console.error(`  Inspected build output at: ${DIST_DIR}`);
    console.error('  Regenerate it with: nx run ngx-foundation-sites:build-storybook');
    process.exit(1);
  }
}

function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

// Parses `import './specifier';` statements out of a `<script
// type="module">...</script>` block. Deliberately ignores `<script
// src=...>` and `rel="modulepreload"` -- both are hints or dead weight here,
// never the real load-bearing reference.
function parseModuleImportSpecifiers(html) {
  const moduleScriptMatch = /<script type="module">([\s\S]*?)<\/script>/.exec(html);
  if (!moduleScriptMatch) {
    return [];
  }
  const body = moduleScriptMatch[1];
  const specifiers = [];
  const importPattern = /import\s+['"]([^'"]+)['"];/g;
  let match;
  while ((match = importPattern.exec(body)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

if (!existsSync(DIST_DIR)) {
  fail(
    'build output present',
    `Expected a Storybook build at ${DIST_DIR} but the directory does not exist.`,
  );
  report();
}

const jsFiles = listJsFiles(DIST_DIR).map((file) => ({
  path: file,
  rel: relative(DIST_DIR, file).replace(/\\/g, '/'),
  content: readFileSync(file, 'utf8'),
}));

// Positive control before any negative assertion: a broken glob/read would
// silently satisfy every absence check below.
if (jsFiles.length < 5) {
  fail(
    'build output present',
    `Expected at least 5 emitted .js files under ${DIST_DIR} but found ${jsFiles.length}. ` +
      'The Storybook build output looks incomplete or the glob is broken.',
  );
  report();
}

const mainBundle = jsFiles.find((file) => /^main\..+\.iframe\.bundle\.js$/.test(file.rel));
if (!mainBundle) {
  fail(
    'main preview bundle present',
    'Expected a main.*.iframe.bundle.js entry bundle under the build output but none was found.',
  );
  report();
}

const indexHtmlPath = join(DIST_DIR, 'index.html');
const iframeHtmlPath = join(DIST_DIR, 'iframe.html');
if (!existsSync(indexHtmlPath) || !existsSync(iframeHtmlPath)) {
  fail(
    'manager/preview HTML present',
    `Expected both index.html (manager) and iframe.html (preview) under ${DIST_DIR}.`,
  );
  report();
}
const indexHtml = readFileSync(indexHtmlPath, 'utf8');
const iframeHtml = readFileSync(iframeHtmlPath, 'utf8');

// --- G2a: the addon-load assertion -- a green build proves nothing ---------
// Storybook emits one manager-bundle.js per registered addon (a11y, docs,
// this workspace addon, ...) under an order-dependent `<name>-<N>` directory
// -- glob, never a hard-coded path. A wrong `<N>` yields "file not found",
// which a sloppy script reports as "addon not present": correct-looking, and
// equally wrong after any addon reorder.
const managerBundles = jsFiles.filter((file) => /(^|\/)sb-addons\/[^/]+\/manager-bundle\.js$/.test(file.rel));
if (managerBundles.length === 0) {
  fail(
    'manager addon bundle present',
    'Expected at least one sb-addons/*/manager-bundle.js under the build output but none was found.',
  );
  report();
}

const addonMatches = managerBundles.filter((file) => file.content.includes(ADDON_ID));
if (addonMatches.length !== 1) {
  fail(
    `expected exactly one manager bundle to content-match \`${ADDON_ID}\`, found ${addonMatches.length}`,
    addonMatches.length === 0
      ? `likely cause: \`${ADDON_ID}\` was renamed or removed from the addons.register(...) call in ` +
        '.storybook/manager.ts, so the addon never registers its panel.'
      : 'likely cause: more than one manager bundle references this id -- an addon rename or an ' +
        'unrelated bundle now collides with it.',
  );
} else {
  const addonBundle = addonMatches[0];
  const indexSpecifiers = parseModuleImportSpecifiers(indexHtml);
  if (indexSpecifiers.length < 3) {
    fail(
      'index.html module-import parse',
      `Expected at least 3 import specifiers inside index.html's <script type="module"> block, found ` +
        `${indexSpecifiers.length}. The parse itself may be broken, which would make the next check pass vacuously.`,
    );
  } else if (!indexSpecifiers.some((specifier) => specifier.endsWith(addonBundle.rel))) {
    fail(
      `index.html does not import ${addonBundle.rel} via a module-import specifier`,
      'likely cause: index.html only carries a `rel="modulepreload"` hint for this bundle (which does not ' +
        'guarantee it loads) rather than a real `import \'./sb-addons/.../manager-bundle.js\';` statement ' +
        "inside its <script type=\"module\"> block.",
    );
  }
}

// --- G2c/G2d: lazy-loading proof --------------------------------------------
// A marker from the generated source closure must appear in at least one
// emitted .js file (positive control -- a broken regeneration would make the
// absence check below pass vacuously), and none of the file(s) that carry it
// may be a static import target of iframe.html's own module-import list --
// the *preview* entry point must reach it only through the lazy `new
// Worker(new URL(...))` split, never a static import. This is deliberately
// NOT an "exactly one file" count: since T02 wired the manager panel to call
// `computePresets()` directly (the self-referencing Worker doesn't function
// under the manager's esbuild bundler), the marker also legitimately reaches
// the manager bundle -- a separate, already-accepted trade-off (D034's
// stated goal is keeping the payload out of *preview* boot specifically).
// What must never regress is the preview side.
const markerFiles = jsFiles.filter((file) => file.content.includes(SOURCES_MARKER));
if (markerFiles.length === 0) {
  fail(
    `expected the sources marker \`${SOURCES_MARKER}\` in at least one emitted .js file, found 0`,
    'likely cause: theming-sources.generated.ts was not regenerated, or the generated closure no ' +
      'longer reaches the Worker chunk (verify theming-worker.ts still imports THEMING_SOURCES).',
  );
} else {
  const iframeSpecifiers = parseModuleImportSpecifiers(iframeHtml);
  if (iframeSpecifiers.length < 3) {
    fail(
      'iframe.html module-import parse',
      `Expected at least 3 import specifiers inside iframe.html's <script type="module"> block, found ` +
        `${iframeSpecifiers.length}. The parse itself may be broken, which would make the next check pass vacuously.`,
    );
  } else {
    const leakedIntoPreview = markerFiles.filter((file) =>
      iframeSpecifiers.some((specifier) => specifier.endsWith(file.rel)),
    );
    if (leakedIntoPreview.length > 0) {
      fail(
        `${leakedIntoPreview.map((file) => file.rel).join(', ')} (carries the sources marker) ` +
          `${leakedIntoPreview.length === 1 ? 'is' : 'are'} imported directly by iframe.html`,
        'likely cause: the Worker split (D034) collapsed -- the file carrying the generated Sass sources ' +
          'is now statically imported by the preview entry instead of lazily constructed via ' +
          '`new Worker(new URL(...))`, so it loads on every story render instead of only when a compile runs.',
      );
    }
  }
}

// --- Preview-side invariants carried from the original S03/T05 gate --------

if (!/new Worker\(new URL\(/.test(mainBundle.content)) {
  fail(
    'Worker bundle reference',
    'The main preview bundle no longer constructs a Worker via `new Worker(new URL(...))`. ' +
      'theming-inject.ts must lazily construct the compile Worker through a native webpack ' +
      'Worker split so the ~800 KiB sass payload stays out of preview boot (D034).',
  );
}

if (!/["']nfs-theming["']/.test(mainBundle.content) || !mainBundle.content.includes('data-nfs-seq')) {
  fail(
    '#nfs-theming injection target',
    'The main preview bundle no longer contains the exact "nfs-theming" style-element id together ' +
      'with its `data-nfs-seq` sequence attribute. theming-inject.ts must inject compiled CSS into a ' +
      'single <style id="nfs-theming"> node carrying a monotonic data-nfs-seq attribute.',
  );
}

if (!mainBundle.content.includes('discardCurrentResult')) {
  fail(
    'R026-exempted injection file present in build',
    'The main preview bundle no longer contains theming-inject.ts (missing its `discardCurrentResult` ' +
      'D038 reset logic). Confirm the R026-exempted injection file is still imported and bundled.',
  );
}

const themeableModulesFile = jsFiles.find(
  (file) =>
    file.content.includes('THEMEABLE_MODULES') &&
    file.content.includes('nfs:/button') &&
    file.content.includes('nfs-button'),
);
if (!themeableModulesFile) {
  fail(
    'THEMEABLE_MODULES-derived content reachable',
    'No emitted file contains an intact THEMEABLE_MODULES entry for nfs:/button (namespace "nfs-button"). ' +
      'Verify theming-sources.generated.ts was not corrupted or stripped before bundling.',
  );
}

report();

console.log(
  [
    'Theming bundle verification PASSED:',
    `  addon manager bundle content-matches \`${ADDON_ID}\` exactly once and is imported by index.html`,
    `  sources marker \`${SOURCES_MARKER}\` is present but absent from iframe.html's own import list (preview boot stays lazy)`,
    '  Worker split, #nfs-theming injection target, and the R026-exempted injection file are all present',
  ].join('\n'),
);
