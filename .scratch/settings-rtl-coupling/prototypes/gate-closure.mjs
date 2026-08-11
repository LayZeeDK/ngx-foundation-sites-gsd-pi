// Ticket 01, probe E -- the COMPLETE static gate set.
//
// Probe A walked only the block structure INSIDE the file where a rebind site
// lives. That misses a guard placed around the @include of the mixin that
// contains the site -- which is exactly how $accordionmenu-arrows gates
// _accordion-menu.scss:62 (the declaration is inside
// @mixin zf-accordion-menu-left-right-arrows; the `@if $accordionmenu-arrows`
// sits around the @include, 51 lines away). The brute-force sweep caught that
// one; this probe closes the class.
//
// Method: build the mixin call graph over Foundation's whole tree, then for each
// rebind site propagate its guard set UP through every @include of the enclosing
// mixin, to a fixed point. The result is every settings variable that can
// conditionally suppress or admit that site through ANY call path.
//
// Read-only. Usage: node gate-closure.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname as pathDirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const FND = join(repoRoot, 'node_modules/foundation-sites/scss');

function walk(dir) {
  const out = [];

  for (const name of readdirSync(dir)) {
    const p = join(dir, name);

    if (statSync(p).isDirectory()) {
      out.push(...walk(p));
    } else if (name.endsWith('.scss')) {
      out.push(p);
    }
  }

  return out;
}

// --- consumer-settable vocabulary: settings template + every !default name ---
const SETTABLE = new Set();

for (const line of readFileSync(join(FND, 'settings/_settings.scss'), 'utf8').split('\n')) {
  const m = /^\$([a-zA-Z0-9_-]+)\s*:/.exec(line);

  if (m) {
    SETTABLE.add(m[1]);
  }
}

for (const file of walk(FND)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\$([a-zA-Z0-9_-]+)\s*:.*!default\s*;/.exec(line);

    if (m) {
      SETTABLE.add(m[1]);
    }
  }
}

function scrub(line) {
  return line
    .replace(/\/\/.*$/, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

const GUARD_RE = /^\s*(@if\b|@else\s+if\b|@else\b|@each\b|@for\b|@while\b)/;
const MIXIN_RE = /^\s*@mixin\s+([A-Za-z0-9_-]+)/;
const INCLUDE_RE = /@include\s+([A-Za-z0-9_-]+)/;

function settingsIn(text) {
  const out = new Set();

  for (const m of text.matchAll(/\$([a-zA-Z0-9_-]+)/g)) {
    if (SETTABLE.has(m[1])) {
      out.add(m[1]);
    }
  }

  return out;
}

// --- Pass 1: walk every file, recording (a) rebind sites with their local
// --- guard settings + enclosing mixin, (b) @include edges with their local
// --- guard settings + enclosing mixin.
const sites = []; // { file, line, cls, guards:Set, inMixin }
const edges = []; // { caller, callee, guards:Set, file, line }
const mixinFiles = new Map(); // mixin -> file

for (const file of walk(FND)) {
  const rel = relative(FND, file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split('\n');
  const stack = [];

  lines.forEach((raw, i) => {
    const s = scrub(raw);
    const opens = (s.match(/\{/g) ?? []).length;
    const closes = (s.match(/\}/g) ?? []).length;

    const localGuards = new Set();
    let inMixin = null;

    for (const f of stack) {
      if (f.kind === 'guard') {
        for (const v of f.settings) {
          localGuards.add(v);
        }
      } else if (f.kind === 'mixin') {
        inMixin = f.name;
      }
    }

    const isRebindHook = rel === '_global.scss' && /^\s*\$global-(left|right)\s*:/.test(raw);

    if ((raw.includes('$global-left') || raw.includes('$global-right')) && !isRebindHook && !/^\s*\/\/\//.test(raw)) {
      sites.push({ file: rel, line: i + 1, text: raw.trim(), guards: new Set(localGuards), inMixin });
    }

    const inc = INCLUDE_RE.exec(s);

    if (inc) {
      edges.push({ caller: inMixin, callee: inc[1], guards: new Set(localGuards), file: rel, line: i + 1 });
    }

    if (opens > 0) {
      const g = GUARD_RE.exec(s);
      const mx = MIXIN_RE.exec(s);
      const frame = g
        ? { kind: 'guard', settings: settingsIn(s), header: s.trim() }
        : mx
          ? { kind: 'mixin', name: mx[1] }
          : { kind: 'rule' };

      if (mx) {
        mixinFiles.set(mx[1], rel);
      }

      stack.push(frame);

      for (let k = 1; k < opens; k += 1) {
        stack.push({ kind: 'rule' });
      }
    }

    for (let k = 0; k < closes; k += 1) {
      stack.pop();
    }
  });
}

// --- Pass 2: fixed-point propagation. A mixin's gate set is the union over all
// --- its call sites of (that call site's local guards + the caller's gate set).
const mixinGates = new Map(); // mixin -> Set(settings)

for (const e of edges) {
  if (!mixinGates.has(e.callee)) {
    mixinGates.set(e.callee, new Set());
  }
}

let changed = true;
let rounds = 0;

while (changed && rounds < 50) {
  changed = false;
  rounds += 1;

  for (const e of edges) {
    const target = mixinGates.get(e.callee);
    const contribution = new Set(e.guards);

    if (e.caller && mixinGates.has(e.caller)) {
      for (const v of mixinGates.get(e.caller)) {
        contribution.add(v);
      }
    }

    for (const v of contribution) {
      if (!target.has(v)) {
        target.add(v);
        changed = true;
      }
    }
  }
}

// --- Pass 3: each site's total gate set. ---
const totals = new Map(); // setting -> [site refs]

for (const s of sites) {
  const all = new Set(s.guards);

  if (s.inMixin && mixinGates.has(s.inMixin)) {
    for (const v of mixinGates.get(s.inMixin)) {
      all.add(v);
    }
  }

  s.allGates = [...all].sort();

  for (const v of s.allGates) {
    if (!totals.has(v)) {
      totals.set(v, []);
    }

    totals.get(v).push(`${s.file}:${s.line}`);
  }
}

console.log('=== TRANSITIVE GATE CLOSURE over all rebind sites ===');
console.log(`rebind sites: ${sites.length}`);
console.log(`fixed point reached in ${rounds} rounds`);
console.log(`consumer-settable vocabulary: ${SETTABLE.size} names`);
console.log(`\ndistinct settings that can gate at least one rebind site: ${totals.size}`);

for (const [v, refs] of [...totals].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  $${v.padEnd(34)} gates ${String(refs.length).padStart(3)} sites`);
}

const ungated = sites.filter((s) => s.allGates.length === 0);
console.log(`\nsites reachable under NO settings guard (always emit if the component is included): ${ungated.length}`);
console.log(`sites with at least one gate: ${sites.length - ungated.length}`);

// Is $global-radius or any $foundation-palette key in the closure? THE M002 CHECK.
console.log('\n=== M002 STATIC CHECK: are the addon-s six controls in the gate closure? ===');

for (const name of ['global-radius', 'foundation-palette', 'primary-color', 'secondary-color', 'success-color', 'alert-color', 'warning-color']) {
  console.log(`  $${name.padEnd(20)} in closure: ${totals.has(name) ? '[WARN] YES' : '[OK] NO'}`);
}
