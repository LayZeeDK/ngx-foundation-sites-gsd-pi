// D034: how Foundation's Sass reaches the browser.
//
// Storybook's theming addon compiles `theme()` in a Worker that has no
// filesystem. This script compiles the REAL chain in Node -- against the
// same disk `nfs:/...` / `fnd:/...` scheme the Worker's own importer will
// resolve against -- and inlines exactly the files Sass actually served into
// a committed TS data module under `.storybook/`. The closure is DISCOVERED
// by compiling, never hand-enumerated, so a Foundation bump or an
// `@import`-graph change fails the `verify-theming-sources` byte-compare
// loudly instead of silently shipping a stale bundle.
//
// Two entry-point arrays, unioned rather than merged into one compile:
//
// - THEMEABLE_MODULES: modules whose `theme()` mixin the addon calls at
//   runtime. One entry today (`nfs:/button`), and it stays data -- a second
//   themeable module is one array entry, not a generator change.
// - DATA_MODULES: modules the addon reads for data ONLY, never through a
//   `theme()` call -- today just `nfs:/theme` (D033's $wcag-palette), needed
//   for the addon's WCAG-compliant preset probe.
//
// Keeping the two closures separate (rather than one combined compile) is
// what makes the negative control in this file's spec meaningful: nothing in
// the button chain `@use`s a data module, so THEMEABLE_MODULES' closure alone
// must NOT contain `nfs:/_theme.scss` -- proving DATA_MODULES is required
// today, not a generalisation for a hypothetical future consumer.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const NFS_ROOT = join(repoRoot, 'packages/ngx-foundation-sites/src/scss');
const FND_ROOT = join(repoRoot, 'node_modules/foundation-sites');
const OUTPUT_PATH = join(here, '../.storybook/theming-sources.generated.ts');

const COMPILE_OPTIONS = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
};

/** The compile call's entry-point modules -- `theme()` is invoked on each. */
export const THEMEABLE_MODULES = [{ url: 'nfs:/button', namespace: 'nfs-button' }];

/** Data-only modules the addon reads without calling `theme()`. */
export const DATA_MODULES = ['nfs:/theme'];

function diskPathFor(canonical) {
  if (canonical.startsWith('nfs:/')) {
    return join(NFS_ROOT, canonical.slice('nfs:/'.length));
  }

  if (canonical.startsWith('fnd:/')) {
    return join(FND_ROOT, canonical.slice('fnd:/'.length));
  }

  return null;
}

/**
 * Candidate canonical URL strings for a resolved `scheme:/dir/name` path, in
 * the same preference order Sass's own filesystem importer tries them.
 */
function candidates(scheme, pathname, fromImport) {
  const i = pathname.lastIndexOf('/');
  const dir = i <= 0 ? '' : pathname.slice(0, i);
  const name = pathname.slice(i + 1);
  const out = [];

  if (fromImport) {
    out.push(`${scheme}:${dir}/_${name}.import.scss`, `${scheme}:${dir}/${name}.import.scss`);
  }

  out.push(
    `${scheme}:${dir}/_${name}.scss`,
    `${scheme}:${dir}/${name}.scss`,
    `${scheme}:${dir}/${name}/_index.scss`,
    `${scheme}:${dir}/${name}/index.scss`,
  );

  return out;
}

/**
 * A fresh disk-backed Sass importer. `served` is populated as a side effect
 * with every canonical URL -> file contents pair Sass actually loaded --
 * exactly the closure a single compile touches, nothing hand-enumerated.
 *
 * Mirrors `internal/_foundation-button.scss`'s own note: the legacy
 * `@import 'foundation-sites/scss/util/util'` has no URL scheme, so Sass
 * pre-resolves it relative to the containing canonical URL
 * (`nfs:/internal/foundation-sites/scss/util/util`) -- the `fnd:` rewrite
 * below is what makes that resolve to disk.
 */
function createDiskImporter(served) {
  return {
    canonicalize(url, context) {
      let scheme;
      let pathname;

      if (url.startsWith('nfs:') || url.startsWith('fnd:')) {
        scheme = url.slice(0, 3);
        pathname = url.slice(4);
      } else {
        scheme = 'nfs';
        pathname = url.startsWith('/') ? url : `/${url}`;
      }

      if (!pathname.startsWith('/')) {
        pathname = `/${pathname}`;
      }

      const fsIndex = pathname.indexOf('foundation-sites/scss/');

      if (fsIndex !== -1) {
        scheme = 'fnd';
        pathname = `/${pathname.slice(fsIndex + 'foundation-sites/'.length)}`;
      }

      for (const candidate of candidates(scheme, pathname, context.fromImport)) {
        const disk = diskPathFor(candidate);

        if (disk && existsSync(disk)) {
          return new URL(candidate);
        }
      }

      return null;
    },

    load(canonicalUrl) {
      const key = canonicalUrl.toString();
      const disk = diskPathFor(key);
      const contents = readFileSync(disk, 'utf8');
      served.set(key, contents);

      return { contents, syntax: 'scss' };
    },
  };
}

/** The entry stylesheet for a themeable module: `@use ... as ...; @include ....theme();`. */
export function themeEntryFor(module) {
  return `@use '${module.url}' as ${module.namespace};\n@include ${module.namespace}.theme();\n`;
}

/** The entry stylesheet for a data-only module: a bare `@use`, no mixin call. */
export function dataEntryFor(url) {
  return `@use '${url}';\n`;
}

/** Compiles one entry stylesheet and returns its served closure as a Map. */
export function compileEntryClosure(entryScss) {
  const served = new Map();

  sass.compileString(entryScss, {
    ...COMPILE_OPTIONS,
    importers: [createDiskImporter(served)],
  });

  return served;
}

/** Compiles each entry separately and unions the served closures into one Map. */
export function collectClosure(entries) {
  const union = new Map();

  for (const entryScss of entries) {
    for (const [key, contents] of compileEntryClosure(entryScss)) {
      union.set(key, contents);
    }
  }

  return union;
}

/**
 * Computes both halves and their union. Exposed separately (not just the
 * union) so the negative control can assert on `themeableClosure` alone.
 */
export function generateSources() {
  const themeableClosure = collectClosure(THEMEABLE_MODULES.map(themeEntryFor));
  const dataClosure = collectClosure(DATA_MODULES.map(dataEntryFor));
  const sources = new Map([...themeableClosure, ...dataClosure]);

  return { themeableClosure, dataClosure, sources };
}

function rawBytesOf(map) {
  let total = 0;

  for (const contents of map.values()) {
    total += Buffer.byteLength(contents, 'utf8');
  }

  return total;
}

/** Renders the committed TS data module's exact text. Deterministic: no timestamps. */
export function renderModule({ sources }) {
  const sortedEntries = [...sources.entries()].sort(([a], [b]) => a.localeCompare(b));

  const lines = [
    '// AUTO-GENERATED by packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs.',
    '// Do not edit by hand -- regenerate with:',
    '//   node packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs',
    "// Gated by the ngx-foundation-sites:verify-theming-sources Nx target (D034),",
    '// which regenerates this module in memory and byte-compares it against what',
    '// is committed here. `THEMEABLE_MODULES` is emitted so that byte-compare',
    '// covers the entry-point array too, never just the closure contents.',
    '',
    'export const THEMEABLE_MODULES: ReadonlyArray<{ url: string; namespace: string }> =',
    `  ${JSON.stringify(THEMEABLE_MODULES)};`,
    '',
    'export const THEMING_SOURCES: Readonly<Record<string, string>> = {',
    ...sortedEntries.map(([key, contents]) => `  ${JSON.stringify(key)}: ${JSON.stringify(contents)},`),
    '};',
    '',
  ];

  return lines.join('\n');
}

// `--print-closure-keys` prints the three closures' served URL keys as JSON
// instead of writing the module. It exists for this script's own spec: the
// Nx `test` target bundles spec files through Vite, whose resolve conditions
// omit `node`, so `sass`'s package.json `exports` map resolves to its
// browser/dart2js build there instead of the Node build this generator
// needs -- and the browser build cannot canonicalize `nfs:`/`fnd:` URLs
// against real disk paths. Spawning this script as a real `node` subprocess
// (see the spec) sidesteps that bundler-only resolution gap entirely.
function printClosureKeys() {
  const { themeableClosure, dataClosure, sources } = generateSources();

  process.stdout.write(
    JSON.stringify({
      themeableClosureKeys: [...themeableClosure.keys()],
      dataClosureKeys: [...dataClosure.keys()],
      sourcesKeys: [...sources.keys()],
    }),
  );
}

function main() {
  if (process.argv.includes('--print-closure-keys')) {
    printClosureKeys();

    return;
  }

  const { themeableClosure, dataClosure, sources } = generateSources();

  writeFileSync(OUTPUT_PATH, renderModule({ sources }));

  console.log(
    [
      'Theming sources generated.',
      `  ${THEMEABLE_MODULES.length} themeable module(s): ${THEMEABLE_MODULES.map((m) => m.url).join(', ')}`,
      `  ${DATA_MODULES.length} data module(s): ${DATA_MODULES.join(', ')}`,
      `  themeable-only closure: ${themeableClosure.size} file(s), ${rawBytesOf(themeableClosure)} bytes raw`,
      `  data-only closure: ${dataClosure.size} file(s), ${rawBytesOf(dataClosure)} bytes raw`,
      `  union closure: ${sources.size} file(s), ${rawBytesOf(sources)} bytes raw`,
      `  written to ${OUTPUT_PATH}`,
    ].join('\n'),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
