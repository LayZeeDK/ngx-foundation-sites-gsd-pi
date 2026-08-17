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
// imported into the preview.
//
// MEM101 fix: the manager bundle used to legitimately carry the `sass`
// marker too (T02 wired the panel to call `computePresets()` directly since
// the self-referencing Worker didn't function under the manager's esbuild
// bundler) -- an accepted trade-off this gate deliberately did not cover.
// The probe now runs in the preview's compile Worker instead (shared with
// theme compiles, not a second payload), so the manager bundle must carry
// NEITHER sass marker, and G2e below asserts that.
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

// Part of `sass`'s public API surface but never called by theming-worker.ts
// (which only calls the sync `compileString`) -- moved up here (was declared
// only beside the D034 preview-boot guard) so G2e (manager side) and the
// preview-boot guard below can share it.
const SASS_PACKAGE_MARKER = 'compileStringAsync';

const failures = [];

function fail(message, cause) {
  failures.push({ message, cause });
}

/**
 * Prints every accumulated failure and exits 1, or returns silently when there
 * are none. Named for the exit, not the printing: every call site relies on it
 * aborting, and several dereference values on the next line that only exist
 * because the check above passed.
 */
function failFast() {
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
  failFast();
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
  failFast();
}

const mainBundle = jsFiles.find((file) => /^main\..+\.iframe\.bundle\.js$/.test(file.rel));
if (!mainBundle) {
  fail(
    'main preview bundle present',
    'Expected a main.*.iframe.bundle.js entry bundle under the build output but none was found.',
  );
  failFast();
}

const indexHtmlPath = join(DIST_DIR, 'index.html');
const iframeHtmlPath = join(DIST_DIR, 'iframe.html');
if (!existsSync(indexHtmlPath) || !existsSync(iframeHtmlPath)) {
  fail(
    'manager/preview HTML present',
    `Expected both index.html (manager) and iframe.html (preview) under ${DIST_DIR}.`,
  );
  failFast();
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
  failFast();
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

  // --- G2e: MEM101 fix -- the manager bundle must carry NEITHER sass marker -
  // Before the fix, the preset probe ran directly on the manager
  // (theming-presets.ts's old `computePresets`), so `compileStringAsync`
  // legitimately reached this bundle -- an accepted trade-off this gate
  // deliberately did not cover. The probe now runs in the preview's compile
  // Worker instead (theming-inject.ts's `requestPresetProbe`), so this bundle
  // must be as sass-free as any other manager addon's.
  if (addonBundle.content.includes(SASS_PACKAGE_MARKER)) {
    fail(
      `manager bundle ${addonBundle.rel} contains the \`sass\` package marker \`${SASS_PACKAGE_MARKER}\``,
      'likely cause: something on the manager side (theming-panel.tsx or theming-presets.ts) calls into ' +
        '`sass` again directly instead of requesting the probe over the channel (theming-channel.ts) from ' +
        "the preview's compile Worker (MEM101).",
    );
  }
  if (addonBundle.content.includes(SOURCES_MARKER)) {
    fail(
      `manager bundle ${addonBundle.rel} contains the generated sources marker \`${SOURCES_MARKER}\``,
      'likely cause: theming-sources.generated.ts (or theming-probe.ts, which reads it) is reachable from ' +
        'the manager bundle again instead of only from the Worker chunk.',
    );
  }
}

// --- G2c/G2d: lazy-loading proof --------------------------------------------
// Both lazy-loading guards below assert an ABSENCE from iframe.html's own
// module-import list, so a broken parse makes both pass vacuously. Parsed once
// here, behind its own positive control, ahead of both. Previously each block
// re-parsed independently and only the first carried the control -- and that
// one sat inside an `else`, so whenever the sources-marker check had already
// failed the guard never ran at all and the `sass`-leak check was left
// genuinely unguarded. `failFast()` hard-exits rather than falling through: an
// absence check must not run on a parse we cannot trust.
const iframeSpecifiers = parseModuleImportSpecifiers(iframeHtml);
if (iframeSpecifiers.length < 3) {
  fail(
    'iframe.html module-import parse',
    `Expected at least 3 import specifiers inside iframe.html's <script type="module"> block, found ` +
      `${iframeSpecifiers.length}. Both lazy-loading absence checks below would pass vacuously, so ` +
      'neither was run. Likely cause: Storybook changed the preview entry markup (e.g. an added ' +
      'attribute on the opening tag, or imports split across two blocks).',
  );
  failFast();
}

// A marker from the generated source closure must appear in at least one
// emitted .js file (positive control -- a broken regeneration would make the
// absence check below pass vacuously), and none of the file(s) that carry it
// may be a static import target of iframe.html's own module-import list --
// the *preview* entry point must reach it only through the lazy `new
// Worker(new URL(...))` split, never a static import. This is deliberately
// NOT an "exactly one file" count: it may also (legitimately) appear in a
// chunk shared by other code. What must never regress is the preview side
// (D034's stated goal); G2e above separately covers the manager side
// (MEM101 fix removed the marker's old, accepted route into the manager
// bundle, so it is now a real assertion there too, not a waived one).
const markerFiles = jsFiles.filter((file) => file.content.includes(SOURCES_MARKER));
if (markerFiles.length === 0) {
  fail(
    `expected the sources marker \`${SOURCES_MARKER}\` in at least one emitted .js file, found 0`,
    'likely cause: theming-sources.generated.ts was not regenerated, or the generated closure no ' +
      'longer reaches the Worker chunk (verify theming-worker.ts still imports THEMING_SOURCES).',
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

// --- D034 preview-boot guard: the `sass` package itself must stay lazy -----
// SOURCES_MARKER only proves OUR scss text stays lazy -- it says nothing
// about a regression that pulls the whole `sass` package into a statically
// imported preview chunk (e.g. a stray `import 'sass'` in preview.ts), since
// `sass`'s own compiled output carries none of our scss source text.
// `compileStringAsync` is part of `sass`'s public API surface but is never
// called by theming-worker.ts (which only calls the sync `compileString`),
// so its presence in a chunk statically imported by iframe.html can only
// mean the whole `sass` package -- not just theming-worker.ts's own code --
// was pulled into preview boot instead of staying behind the lazy `new
// Worker(new URL(...))` split.
const sassCarryingFiles = jsFiles.filter((file) => file.content.includes(SASS_PACKAGE_MARKER));
if (sassCarryingFiles.length === 0) {
  fail(
    `expected the \`sass\` package marker \`${SASS_PACKAGE_MARKER}\` in at least one emitted .js file, found 0`,
    'likely cause: theming-worker.ts no longer imports `sass`, or its Worker chunk was not emitted -- verify ' +
      'the compile call still runs.',
  );
} else {
  const sassLeakedIntoPreview = sassCarryingFiles.filter((file) =>
    iframeSpecifiers.some((specifier) => specifier.endsWith(file.rel)),
  );
  if (sassLeakedIntoPreview.length > 0) {
    fail(
      `${sassLeakedIntoPreview.map((file) => file.rel).join(', ')} (bundles the \`sass\` package itself) ` +
        `${sassLeakedIntoPreview.length === 1 ? 'is' : 'are'} imported directly by iframe.html`,
      "likely cause: something outside theming-worker.ts (e.g. a stray `import 'sass'` in " +
        '.storybook/preview.ts) statically imports the `sass` package, pulling its ~800 KiB payload into ' +
        'preview boot instead of behind the lazy `new Worker(new URL(...))` split (D034).',
    );
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

failFast();

console.log(
  [
    'Theming bundle verification PASSED:',
    `  addon manager bundle content-matches \`${ADDON_ID}\` exactly once and is imported by index.html`,
    `  sources marker \`${SOURCES_MARKER}\` is present but absent from iframe.html's own import list (preview boot stays lazy)`,
    `  \`sass\` package marker \`${SASS_PACKAGE_MARKER}\` is present but absent from iframe.html's own import list (sass payload stays out of preview boot)`,
    '  Worker split, #nfs-theming injection target, and the R026-exempted injection file are all present',
    '  manager bundle carries neither sass marker (MEM101: the probe shares the preview compile Worker)',
  ].join('\n'),
);
