// Ticket 15 probe B -- how many of Foundation's 490 settings can reach the
// emitted CSS at all, today.
//
// Two halves:
//   1. STATIC partition of all 490 names across Foundation's whole scss tree,
//      and against the ACTUAL loaded closure of the nfs button chain.
//   2. DYNAMIC injection: seed a chosen Foundation global inside a COPY of the
//      island (in memory -- no repo file is touched) and diff the emitted CSS
//      against the baseline. Proves whether "in the closure" means "effective".
//
// Usage: node settings-reachability-probe.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname as pathDirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const fndRoot = join(repoRoot, 'node_modules/foundation-sites');
const nfsRoot = join(repoRoot, 'packages/ngx-foundation-sites/src/scss');
const settingsFile = join(fndRoot, 'scss/settings/_settings.scss');

// ---------------------------------------------------------------------------
// 0. The 490 names
// ---------------------------------------------------------------------------
const settingsSrc = readFileSync(settingsFile, 'utf8');
const names = [];

for (const line of settingsSrc.split('\n')) {
  const m = /^\$([a-zA-Z0-9_-]+)\s*:/.exec(line);

  if (m) {
    names.push(m[1]);
  }
}

const unique = [...new Set(names)];
console.log(
  `=== 0. Foundation settings template ===\n` +
    `${names.length} assignments, ${unique.length} unique names\n` +
    `carrying !default: ${(settingsSrc.match(/!default/g) ?? []).length}\n`,
);

// ---------------------------------------------------------------------------
// 1. In-memory importer over the real files, with an override hook
// ---------------------------------------------------------------------------
const CANDIDATE_SUFFIXES = ['.scss', '.css', ''];

function candidates(pathname, fromImport) {
  const i = pathname.lastIndexOf('/');
  const dir = i <= 0 ? '' : pathname.slice(0, i);
  const name = pathname.slice(i + 1);
  const out = [];

  const push = (n) => {
    for (const ext of CANDIDATE_SUFFIXES) {
      if (ext === '' && !n.endsWith('.scss')) {
        continue;
      }

      out.push(`${dir}/${n}${ext}`);
    }
  };

  if (fromImport) {
    push(`_${name}.import`);
    push(`${name}.import`);
  }

  push(`_${name}`);
  push(name);
  out.push(`${dir}/${name}/_index.scss`);
  out.push(`${dir}/${name}/index.scss`);

  return out;
}

function makeImporter(overrides) {
  const served = [];

  const importer = {
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

      const fsIndex = pathname.indexOf('foundation-sites/scss/');

      if (fsIndex !== -1) {
        scheme = 'fnd';
        pathname = `/${pathname.slice(fsIndex + 'foundation-sites/'.length)}`;
      }

      const root = scheme === 'nfs' ? nfsRoot : fndRoot;

      for (const candidate of candidates(pathname, context.fromImport)) {
        const key = `${scheme}:${candidate}`;

        if (Object.prototype.hasOwnProperty.call(overrides, key)) {
          return new URL(key);
        }

        const abs = join(root, candidate);

        try {
          if (statSync(abs).isFile()) {
            return new URL(key);
          }
        } catch {
          // not a file -- try the next candidate
        }
      }

      return null;
    },

    load(canonicalUrl) {
      const key = canonicalUrl.toString();
      served.push(key);

      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        return { contents: overrides[key], syntax: 'scss' };
      }

      const scheme = key.slice(0, 3);
      const pathname = key.slice(4);
      const root = scheme === 'nfs' ? nfsRoot : fndRoot;

      return {
        contents: readFileSync(join(root, pathname), 'utf8'),
        syntax: key.endsWith('.css') ? 'css' : 'scss',
      };
    },
  };

  return { importer, served };
}

const opts = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  alertColor: false,
};

const ENTRY = "@use 'nfs:/button' as nfs-button;\n@include nfs-button.theme;\n";

function compile(overrides = {}) {
  const { importer, served } = makeImporter(overrides);
  const out = sass.compileString(ENTRY, { ...opts, importers: [importer] });

  return { css: out.css, served };
}

const baseline = compile();
console.log(
  `=== 1. baseline ===\nserved ${baseline.served.length} files, css ${Buffer.byteLength(baseline.css)}B\n` +
    `${baseline.served.join('\n')}\n`,
);

// ---------------------------------------------------------------------------
// 2. STATIC: which of the 490 are even referenced inside the loaded closure
// ---------------------------------------------------------------------------
const closureFnd = baseline.served
  .filter((u) => u.startsWith('fnd:'))
  .map((u) => join(fndRoot, u.slice(4)));

function refRegex(name) {
  // A REFERENCE, not the declaration: `$name` not followed by a word char,
  // `-`, or `:` (a `:` right after means it is being assigned).
  return new RegExp(`\\$${name}(?![\\w-])(?!\\s*:)`);
}

const closureText = closureFnd.map((p) => readFileSync(p, 'utf8')).join('\n');
const inClosure = unique.filter((n) => refRegex(n).test(closureText));

console.log(
  `=== 2. STATIC reachability against the loaded closure ===\n` +
    `${closureFnd.length} Foundation partials loaded\n` +
    `settings names REFERENCED somewhere in that closure: ${inClosure.length} / ${unique.length}\n`,
);
console.log(`  ${inClosure.join(', ')}\n`);

// Which of those does the island already seed non-!default (repo has taken
// control of the name), and which are left to Foundation's own !default?
const islandSrc = readFileSync(join(nfsRoot, 'internal/_foundation-button.scss'), 'utf8');
const seeded = new Set();

for (const line of islandSrc.split('\n')) {
  const m = /^\$([a-zA-Z0-9_-]+)\s*:/.exec(line);

  if (m) {
    seeded.add(m[1]);
  }
}

const inClosureSeeded = inClosure.filter((n) => seeded.has(n));
const inClosureFree = inClosure.filter((n) => !seeded.has(n));

console.log(`  already seeded by the island (${inClosureSeeded.length}): ${inClosureSeeded.join(', ')}`);
console.log(`  NOT seeded, Foundation's own !default stands (${inClosureFree.length}): ${inClosureFree.join(', ')}\n`);

// ---------------------------------------------------------------------------
// 3. Whole-tree partition: which file(s) consume each of the 490
// ---------------------------------------------------------------------------
function walk(dir) {
  const out = [];

  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);

    if (statSync(abs).isDirectory()) {
      out.push(...walk(abs));
    } else if (entry.endsWith('.scss')) {
      out.push(abs);
    }
  }

  return out;
}

const treeFiles = walk(join(fndRoot, 'scss')).filter((p) => p !== settingsFile);
const treeText = new Map(treeFiles.map((p) => [p, readFileSync(p, 'utf8')]));
const consumers = new Map();

for (const n of unique) {
  const re = refRegex(n);
  const hits = [];

  for (const [p, text] of treeText) {
    if (re.test(text)) {
      hits.push(relative(join(fndRoot, 'scss'), p).split(sep).join('/'));
    }
  }

  consumers.set(n, hits);
}

const orphans = unique.filter((n) => consumers.get(n).length === 0);
const globalOnly = unique.filter((n) => {
  const hits = consumers.get(n);

  return (
    hits.length > 0 &&
    hits.every((h) => h.startsWith('util/') || h === '_global.scss' || h === 'settings/_settings.scss')
  );
});
const componentPartitioned = unique.filter(
  (n) => consumers.get(n).length > 0 && !globalOnly.includes(n),
);

console.log(
  `=== 3. WHOLE-TREE partition of the ${unique.length} names ===\n` +
    `  consumed ONLY by util/ + _global.scss (always in any closure): ${globalOnly.length}\n` +
    `  consumed by at least one component/other partial: ${componentPartitioned.length}\n` +
    `  referenced NOWHERE outside the settings template itself: ${orphans.length}\n`,
);
console.log(`  the ${orphans.length} orphans: ${orphans.join(', ')}\n`);
console.log(`  the ${globalOnly.length} global-only: ${globalOnly.join(', ')}\n`);

// How many component partials would have to exist for full reachability?
const perFile = new Map();

for (const n of componentPartitioned) {
  for (const h of consumers.get(n)) {
    if (!perFile.has(h)) {
      perFile.set(h, []);
    }

    perFile.get(h).push(n);
  }
}

const ranked = [...perFile.entries()].sort((a, b) => b[1].length - a[1].length);
console.log('  top consuming partials (file -> settings it reads):');

for (const [f, ns] of ranked.slice(0, 20)) {
  console.log(`    ${String(ns.length).padStart(3)}  ${f}`);
}

console.log('');

// ---------------------------------------------------------------------------
// 4. DYNAMIC: inject a seed into a COPY of the island and diff the CSS
// ---------------------------------------------------------------------------
const ISLAND_KEY = 'nfs:/internal/_foundation-button.scss';
const IMPORT_ANCHOR = "@import 'foundation-sites/scss/util/util';";

if (!islandSrc.includes(IMPORT_ANCHOR)) {
  throw new Error('island anchor not found -- probe setup broken');
}

function injectBeforeImports(assignments) {
  return {
    [ISLAND_KEY]: islandSrc.replace(
      IMPORT_ANCHOR,
      `${assignments}\n${IMPORT_ANCHOR}`,
    ),
  };
}

function injectAfterImports(assignments) {
  const anchor = "@import 'foundation-sites/scss/components/button';";

  return {
    [ISLAND_KEY]: islandSrc.replace(anchor, `${anchor}\n${assignments}`),
  };
}

const CASES = [
  ['$foundation-palette', '$foundation-palette: ("primary": #ff0000, "secondary": #767676, "success": #3adb76, "warning": #ffae00, "alert": #cc4b37);'],
  ['$primary-color', '$primary-color: #ff0000;'],
  ['$global-radius', '$global-radius: 9px;'],
  ['$button-radius', '$button-radius: 9px;'],
  ['$button-padding', '$button-padding: 3em 4em;'],
  ['$button-font-family', '$button-font-family: "Probe Sans";'],
  ['$global-text-direction', "$global-text-direction: rtl;"],
  ['$global-font-size', '$global-font-size: 21px;'],
  ['$button-transition', '$button-transition: all 9s linear;'],
  ['$callout-background', '$callout-background: #ff0000;'],
  ['$global-margin', '$global-margin: 4rem;'],
];

console.log('=== 4. DYNAMIC injection: seeded BEFORE the @imports (the island idiom) ===');

for (const [label, assignment] of CASES) {
  let verdict;

  try {
    const out = compile(injectBeforeImports(assignment));
    verdict =
      out.css === baseline.css
        ? 'NO EFFECT on emitted CSS'
        : `CHANGED css (${Buffer.byteLength(out.css)}B vs ${Buffer.byteLength(baseline.css)}B)`;
  } catch (error) {
    verdict = `ERROR: ${String(error.message).split('\n')[0]}`;
  }

  console.log(`  ${label.padEnd(24)} -> ${verdict}`);
}

console.log('\n=== 4b. same seeds AFTER the @imports (what a late settings hook would do) ===');

for (const [label, assignment] of CASES) {
  let verdict;

  try {
    const out = compile(injectAfterImports(assignment));
    verdict =
      out.css === baseline.css
        ? 'NO EFFECT on emitted CSS'
        : `CHANGED css (${Buffer.byteLength(out.css)}B)`;
  } catch (error) {
    verdict = `ERROR: ${String(error.message).split('\n')[0]}`;
  }

  console.log(`  ${label.padEnd(24)} -> ${verdict}`);
}

// ---------------------------------------------------------------------------
// 5. A misspelled Foundation global, seeded the same way
// ---------------------------------------------------------------------------
console.log('\n=== 5. a MISSPELLED Foundation global, seeded into the island ===');

for (const [label, assignment] of [
  ['$buton-radius (typo)', '$buton-radius: 9px;'],
  ['$button-radiuss (typo)', '$button-radiuss: 9px;'],
]) {
  try {
    const out = compile(injectBeforeImports(assignment));
    console.log(
      `  ${label.padEnd(24)} -> ${out.css === baseline.css ? 'COMPILED, NO EFFECT, NO WARNING' : 'COMPILED, changed css'}`,
    );
  } catch (error) {
    console.log(`  ${label.padEnd(24)} -> ERROR: ${String(error.message).split('\n')[0]}`);
  }
}
