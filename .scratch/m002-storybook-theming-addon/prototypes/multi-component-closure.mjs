// Ticket 12: bound the SOURCE CLOSURE across a realistic multi-component set.
//
// Ticket 08 measured the closure for the button chain alone (16 files served:
// 13 Foundation partials + 3 nfs partials, 71.9 KiB of Foundation source).
// That figure is button-only. This probe measures, by COMPILING rather than
// extrapolating:
//
//   1. the per-component closure for every Foundation component that compiles
//      standalone through the same legacy-@import island shape the repo uses;
//   2. the UNION closure across all of them (what a real multi-component addon
//      would have to inline);
//   3. the marginal cost of each additional component.
//
// It never writes into packages/. It reads node_modules/foundation-sites and
// packages/ngx-foundation-sites/src/scss from disk, compiles in memory, and
// prints numbers.
//
// Usage: node multi-component-closure.mjs

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const NFS_ROOT = join(repoRoot, 'packages/ngx-foundation-sites/src/scss');
const FND_ROOT = join(repoRoot, 'node_modules/foundation-sites');

function diskPathFor(canonical) {
  if (canonical.startsWith('nfs:/')) {
    return join(NFS_ROOT, canonical.slice('nfs:/'.length));
  }

  if (canonical.startsWith('fnd:/')) {
    return join(FND_ROOT, canonical.slice('fnd:/'.length));
  }

  return null;
}

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

function makeImporter(served) {
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

const COMPILE_OPTIONS = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  alertColor: false,
};

/** Compile an entry and return { served, cssBytes } or { error }. */
function measure(entry) {
  const served = new Map();

  try {
    const result = sass.compileString(entry, {
      ...COMPILE_OPTIONS,
      importers: [makeImporter(served)],
    });

    return { served, cssBytes: Buffer.byteLength(result.css, 'utf8') };
  } catch (e) {
    return { served, error: e.message.split('\n')[0] };
  }
}

function bytes(map) {
  let raw = 0;

  for (const contents of map.values()) {
    raw += Buffer.byteLength(contents, 'utf8');
  }

  return raw;
}

function gz(map) {
  // Gzip the concatenated sources -- the same way the generated data module
  // would compress inside one bundle chunk.
  const blob = [...map.keys()].sort().map((k) => `${k}\n${map.get(k)}`).join('\n');

  return gzipSync(Buffer.from(blob, 'utf8')).length;
}

function kib(n) {
  return (n / 1024).toFixed(1);
}

// ---------------------------------------------------------------------------
// 0. The REAL button chain, exactly as the repo compiles it today.
// ---------------------------------------------------------------------------

const real = measure(`@use 'nfs:/button' as nfs-button;\n@include nfs-button.theme();\n`);
const realFnd = new Map([...real.served].filter(([k]) => k.startsWith('fnd:')));
const realNfs = new Map([...real.served].filter(([k]) => k.startsWith('nfs:')));

console.log('=== 0. BASELINE: the real nfs button chain (nfs:/button) ===');
console.log(
  `served ${real.served.size} files -- ${realFnd.size} foundation + ${realNfs.size} nfs`,
);
console.log(
  `foundation raw ${kib(bytes(realFnd))} KiB | all raw ${kib(bytes(real.served))} KiB | all gzip ${kib(gz(real.served))} KiB`,
);
console.log(`default-theme CSS ${real.cssBytes} bytes`);

// ---------------------------------------------------------------------------
// 1. Per-component closures through the SAME island shape.
//
// Every nfs component wrapper would repeat the island's three @imports and
// swap only the third. So the marginal cost of component #N is
// closure(util+global+component N) minus closure(util+global).
// ---------------------------------------------------------------------------

function islandEntry(componentImports) {
  const lines = [
    `@import 'foundation-sites/scss/util/util';`,
    `@import 'foundation-sites/scss/global';`,
    ...componentImports.map((c) => `@import 'foundation-sites/scss/components/${c}';`),
  ];

  return lines.join('\n') + '\n';
}

const shared = measure(islandEntry([]));

console.log('\n=== 1. SHARED FLOOR: util + global, no component ===');

if (shared.error) {
  console.log(`ERROR: ${shared.error}`);
} else {
  console.log(
    `served ${shared.served.size} files | raw ${kib(bytes(shared.served))} KiB | gzip ${kib(gz(shared.served))} KiB`,
  );
}

const componentNames = readdirSync(join(FND_ROOT, 'scss/components'))
  .filter((f) => f.startsWith('_') && f.endsWith('.scss'))
  .map((f) => f.slice(1, -'.scss'.length))
  .sort();

console.log(`\n=== 2. PER-COMPONENT marginal closure (${componentNames.length} components) ===`);
console.log('component            | files | +files | +raw KiB | status');

const ok = [];

for (const name of componentNames) {
  const m = measure(islandEntry([name]));

  if (m.error) {
    console.log(
      `${name.padEnd(20)} |     - |      - |        - | FAILS STANDALONE: ${m.error}`,
    );
    continue;
  }

  const extraFiles = m.served.size - shared.served.size;
  const extraRaw = bytes(m.served) - bytes(shared.served);
  ok.push(name);
  console.log(
    `${name.padEnd(20)} | ${String(m.served.size).padStart(5)} | ${String(extraFiles).padStart(6)} | ${kib(extraRaw).padStart(8)} | ok`,
  );
}

// ---------------------------------------------------------------------------
// 3. The UNION: every standalone-compilable component in ONE island.
// ---------------------------------------------------------------------------

console.log(`\n=== 3. UNION closure: util + global + all ${ok.length} working components ===`);
const union = measure(islandEntry(ok));

if (union.error) {
  console.log(`ERROR: ${union.error}`);
} else {
  console.log(
    `served ${union.served.size} files | raw ${kib(bytes(union.served))} KiB | gzip ${kib(gz(union.served))} KiB`,
  );
  console.log(`emitted CSS ${union.cssBytes} bytes (${kib(union.cssBytes)} KiB)`);
  console.log(
    `vs button-only closure: files ${real.served.size} -> ${union.served.size}, ` +
      `raw ${kib(bytes(real.served))} -> ${kib(bytes(union.served))} KiB, ` +
      `gzip ${kib(gz(real.served))} -> ${kib(gz(union.served))} KiB`,
  );
}

// ---------------------------------------------------------------------------
// 4. THE CEILING: Foundation's own foundation.scss -- everything it ships.
// ---------------------------------------------------------------------------

console.log('\n=== 4. CEILING: the whole Foundation Sass tree (foundation.scss) ===');
const all = measure(
  `@import 'foundation-sites/scss/foundation';\n@include foundation-everything();\n`,
);

if (all.error) {
  console.log(`ERROR: ${all.error}`);
} else {
  console.log(
    `served ${all.served.size} files | raw ${kib(bytes(all.served))} KiB | gzip ${kib(gz(all.served))} KiB`,
  );
  console.log(`emitted CSS ${all.cssBytes} bytes (${kib(all.cssBytes)} KiB)`);
}

// ---------------------------------------------------------------------------
// 5. Which components read $global-text-direction (correction 7 evidence)?
// ---------------------------------------------------------------------------

console.log('\n=== 5. $global-text-direction readers in the Foundation tree ===');

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);

    if (e.isDirectory()) {
      walk(p, out);
    } else if (e.name.endsWith('.scss')) {
      out.push(p);
    }
  }

  return out;
}

for (const f of walk(join(FND_ROOT, 'scss'))) {
  const text = readFileSync(f, 'utf8');
  const hits = text
    .split('\n')
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => line.includes('$global-text-direction'));

  for (const [n, line] of hits) {
    console.log(`${f.slice(FND_ROOT.length + 1)}:${n}: ${line.trim()}`);
  }
}
