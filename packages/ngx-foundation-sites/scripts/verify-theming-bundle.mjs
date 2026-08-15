// D035 gate: inspects the built Storybook output (dist/storybook/
// ngx-foundation-sites, produced by the `build-storybook` target this target
// depends on) and confirms the Theming addon's key build-time invariants
// survived bundling: the Worker split point (D034), the #nfs-theming
// injection target (D035 part e), the THEMEABLE_MODULES-derived Sass
// payload, the manager panel registration (D035/D032), and the
// R026-exempted injection file (D035 part f, T04). Each check reports a
// specific, actionable message so a broken invariant is diagnosable without
// re-deriving which of the five it was.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname as pathDirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = pathDirname(fileURLToPath(import.meta.url));

// Overridable so negative-control mutations can be exercised against a
// scratch copy of the build output without touching the real dist/.
const DIST_DIR = process.env.NFS_THEMING_BUNDLE_DIR
  ? resolve(process.env.NFS_THEMING_BUNDLE_DIR)
  : join(here, '../../../dist/storybook/ngx-foundation-sites');

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

function fail(checkName, detail) {
  console.error(
    [
      'Theming bundle verification FAILED.',
      `Check: ${checkName}`,
      detail,
      `Inspected build output at: ${DIST_DIR}`,
      'Regenerate it with: nx run ngx-foundation-sites:build-storybook',
    ].join('\n')
  );
  process.exit(1);
}

if (!existsSync(DIST_DIR)) {
  fail(
    'build output present',
    `Expected a Storybook build at ${DIST_DIR} but the directory does not exist.`
  );
}

const jsFiles = listJsFiles(DIST_DIR).map((file) => ({
  path: file,
  rel: relative(DIST_DIR, file).replace(/\\/g, '/'),
  content: readFileSync(file, 'utf8'),
}));

if (jsFiles.length === 0) {
  fail('build output present', `No .js files found under ${DIST_DIR}.`);
}

const mainBundle = jsFiles.find((file) => /^main\..+\.iframe\.bundle\.js$/.test(file.rel));
if (!mainBundle) {
  fail(
    'main preview bundle present',
    'Expected a main.*.iframe.bundle.js entry bundle under the build output but none was found.'
  );
}

// Storybook emits one manager-bundle.js per registered addon (a11y, docs,
// this workspace addon, ...), so the theming registration must be searched
// for across all of them rather than assumed to be in the first one found.
const managerBundles = jsFiles.filter((file) => file.rel.endsWith('manager-bundle.js'));
if (managerBundles.length === 0) {
  fail(
    'manager addon bundle present',
    'Expected at least one manager-bundle.js under sb-addons/ but none was found.'
  );
}

// 1. Worker bundle reference: theming-inject.ts's `ensureWorker()` constructs
// a native webpack Worker split (`new Worker(new URL(...))`), and that split
// must resolve to a real, separately-emitted chunk carrying theming-worker.ts.
if (!/new Worker\(new URL\(/.test(mainBundle.content)) {
  fail(
    'Worker bundle reference',
    'The main preview bundle no longer constructs a Worker via `new Worker(new URL(...))`. ' +
      'theming-inject.ts must lazily construct the compile Worker through a native webpack ' +
      'Worker split so the ~800 KiB sass payload stays out of preview boot (D034).'
  );
}

const workerChunk = jsFiles.find(
  (file) => file !== mainBundle && file.content.includes('theming-worker.ts')
);
if (!workerChunk) {
  fail(
    'Worker bundle reference',
    'No separate build chunk contains theming-worker.ts. The Worker-compile module must be ' +
      'emitted as its own split chunk, not inlined into the main preview bundle or dropped.'
  );
}

// 2. #nfs-theming injection target: theming-inject.ts's STYLE_ELEMENT_ID,
// matched as an exact quoted literal so a rename to a different string (e.g.
// the panel's "nfs-theming-panel" testid) does not accidentally satisfy it.
if (!/["']nfs-theming["']/.test(mainBundle.content) || !mainBundle.content.includes('data-nfs-seq')) {
  fail(
    '#nfs-theming injection target',
    'The main preview bundle no longer contains the exact "nfs-theming" style-element id together ' +
      'with its `data-nfs-seq` sequence attribute. theming-inject.ts must inject compiled CSS into a ' +
      'single <style id="nfs-theming"> node carrying a monotonic data-nfs-seq attribute.'
  );
}

// 3. THEMEABLE_MODULES-derived content reachable: the generated entry-point
// array (theming-sources.generated.ts) must still reach the Worker chunk
// uncorrupted -- not just the identifier name, but its real nfs:/button entry.
if (
  !workerChunk.content.includes('THEMEABLE_MODULES') ||
  !workerChunk.content.includes('nfs:/button') ||
  !workerChunk.content.includes('nfs-button')
) {
  fail(
    'THEMEABLE_MODULES-derived content reachable',
    'The Worker chunk no longer contains an intact THEMEABLE_MODULES entry for nfs:/button ' +
      '(namespace "nfs-button"). Verify theming-sources.generated.ts was not corrupted or stripped ' +
      'before bundling.'
  );
}

// 4. Manager panel registration: manager.ts's `addons.register('nfs/theming', ...)`.
if (!managerBundles.some((file) => /["']nfs\/theming["']/.test(file.content))) {
  fail(
    'manager panel registration',
    'The manager addon bundle no longer registers the "nfs/theming" panel. manager.ts must call ' +
      "addons.register('nfs/theming', ...) so the Theming panel is available in Storybook's manager UI."
  );
}

// 5. R026-exempted injection file present in build: theming-inject.ts is the
// addon's sole R026-ignores-listed file (T04); `discardCurrentResult` is a
// distinguishing identifier unique to its D038 default-theme-reset logic.
if (!mainBundle.content.includes('discardCurrentResult')) {
  fail(
    'R026-exempted injection file present in build',
    'The main preview bundle no longer contains theming-inject.ts (missing its `discardCurrentResult` ' +
      'D038 reset logic). Confirm the R026-exempted injection file is still imported and bundled.'
  );
}

console.log(
  'Theming bundle verification PASSED: Worker split, #nfs-theming injection target, ' +
    'THEMEABLE_MODULES payload, manager panel registration, and the R026-exempted injection file ' +
    'are all present in the build-storybook output.'
);
