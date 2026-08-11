// Ticket 01 (settings-rtl-coupling), probe A -- INVERT THE SEARCH.
//
// Do not sweep 490 settings. Instead: for every Foundation SOURCE site that
// interpolates $global-left / $global-right, walk UP the block structure and
// record every enclosing guard (@if / @else if / @else / @each / @for / @media /
// @include breakpoint / @mixin) plus the settings variables named in those
// guards. Those variables are the ONLY ones that can gate whether that site
// emits at all.
//
// Also records the settings variables that appear in the site's own VALUE, since
// a value of `0` / `null` can make a site emit a harmless no-op rather than
// nothing at all (a weaker form of gating).
//
// Cross-references the extracted variable names against Foundation's own 490-name
// settings template, so "consumer-settable gate" is a measured claim.
//
// Read-only. Writes nothing outside stdout.
// Usage: node rebind-site-gates.mjs [--json <path>]

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

// --- Foundation's own settings vocabulary: the 490 names. ---
const settingsSrc = readFileSync(join(FND, 'settings/_settings.scss'), 'utf8');
const SETTINGS_NAMES = new Set();

for (const line of settingsSrc.split('\n')) {
  const m = /^\$([a-zA-Z0-9_-]+)\s*:/.exec(line);

  if (m) {
    SETTINGS_NAMES.add(m[1]);
  }
}

// Component-partial !default declarations are ALSO consumer-settable settings
// (the settings template is a curated copy; e.g. $buttongroup-child-selector).
const DEFAULT_NAMES = new Set();

for (const file of walk(FND)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\$([a-zA-Z0-9_-]+)\s*:.*!default\s*;/.exec(line);

    if (m) {
      DEFAULT_NAMES.add(m[1]);
    }
  }
}

// --- Site classification, carried verbatim from ticket 14's probe so the two
// --- measurements are comparable. Ordered: first match wins.
const CLASSES = [
  { id: 'SAFE margin/padding longhand', re: /\b(margin|padding)-#\{\$global-(left|right)\}\s*:/ },
  { id: 'SAFE border longhand/shorthand', re: /\bborder-#\{\$global-(left|right)\}(-(color|width|style))?\s*:/ },
  { id: 'SAFE float/clear value', re: /\b(float|clear)\s*:\s*\$global-(left|right)\b/ },
  { id: 'SAFE scroll-margin/padding', re: /\bscroll-(margin|padding)-#\{\$global-(left|right)\}\s*:/ },
  { id: 'BROKEN bare-side positioning', re: /^\s*#\{\$global-(left|right)\}\s*:/ },
  { id: 'BROKEN corner radius', re: /\bborder-(top|bottom)-#\{\$global-(left|right)\}-radius\s*:/ },
  { id: 'BROKEN text-align value', re: /\btext-align\s*:\s*[^;]*\$global-(left|right)\b/ },
  { id: 'BROKEN background-position value', re: /\bbackground-position\s*:\s*[^;]*\$global-(left|right)\b/ },
  { id: 'BROKEN class-NAME interpolation', re: /[.&][a-zA-Z0-9_-]*#\{\$global-(left|right)\}/ },
  { id: 'BROKEN css-triangle keyword arg', re: /css-triangle\([^)]*\$global-(left|right)/ },
];

function classify(line) {
  const hit = CLASSES.find((c) => c.re.test(line));

  return hit ? hit.id : 'UNCLASSIFIED';
}

// Strip strings and comments so brace counting and $var extraction do not trip
// on `content: "}"` or `// { note`.
function scrub(line) {
  let out = line.replace(/\/\/.*$/, '');
  out = out.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");

  return out;
}

const GUARD_RE = /^\s*(@if\b|@else\s+if\b|@else\b|@each\b|@for\b|@media\b|@mixin\b|@include\s+breakpoint\b|@function\b|@supports\b)/;

const sites = [];

for (const file of walk(FND)) {
  const rel = relative(FND, file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split('\n');
  const stack = [];
  let depth = 0;

  lines.forEach((raw, i) => {
    const s = scrub(raw);
    const opens = (s.match(/\{/g) ?? []).length;
    const closes = (s.match(/\}/g) ?? []).length;

    // A site is recorded against the stack as it stands BEFORE this line's own
    // braces are applied, plus this line's own header if it opens a block.
    const hasHook = raw.includes('$global-left') || raw.includes('$global-right');
    const isRebindHook = rel === '_global.scss' && /^\s*\$global-(left|right)\s*:/.test(raw);

    if (hasHook && !isRebindHook) {
      sites.push({
        file: rel,
        line: i + 1,
        text: raw.trim(),
        cls: classify(raw),
        guards: stack.filter((f) => f.guard).map((f) => ({ kind: f.kind, header: f.header })),
      });
    }

    // Update the stack.
    if (opens > 0) {
      const g = GUARD_RE.exec(s);
      const frame = {
        guard: Boolean(g),
        kind: g ? g[1].replace(/\s+/g, ' ').trim() : 'rule',
        header: s.trim().replace(/\s*\{.*$/, ''),
        depth,
      };

      // Multiple opens on one line: push the header once, filler for the rest.
      stack.push(frame);

      for (let k = 1; k < opens; k += 1) {
        stack.push({ guard: false, kind: 'rule', header: '(inline)', depth: depth + k });
      }
    }

    depth += opens - closes;

    for (let k = 0; k < closes; k += 1) {
      stack.pop();
    }
  });
}

// --- Extract settings variables named in each site's guards. ---
function varsIn(text) {
  const out = new Set();
  const re = /\$([a-zA-Z0-9_-]+)/g;
  let m;

  while ((m = re.exec(text)) !== null) {
    out.add(m[1]);
  }

  return out;
}

const gateHits = new Map(); // setting name -> [site keys]

for (const site of sites) {
  const gateVars = new Set();

  for (const g of site.guards) {
    if (g.kind === '@mixin' || g.kind === '@function' || g.kind === '@media' || g.kind === '@include breakpoint') {
      continue; // parameters / media, not consumer gates in themselves
    }

    for (const v of varsIn(g.header)) {
      gateVars.add(v);
    }
  }

  site.gateVars = [...gateVars].filter((v) => SETTINGS_NAMES.has(v) || DEFAULT_NAMES.has(v)).sort();
  site.guardKinds = site.guards.map((g) => g.kind);

  for (const v of site.gateVars) {
    if (!gateHits.has(v)) {
      gateHits.set(v, []);
    }

    gateHits.get(v).push(`${site.file}:${site.line} [${site.cls}]`);
  }
}

// --- Report ---
console.log('=== 0. vocabulary ===');
console.log(`settings template names: ${SETTINGS_NAMES.size}`);
console.log(`!default names anywhere in Foundation's tree: ${DEFAULT_NAMES.size}`);
console.log(`union (consumer-settable vocabulary): ${new Set([...SETTINGS_NAMES, ...DEFAULT_NAMES]).size}`);

console.log(`\n=== 1. rebind source sites ===`);
console.log(`total sites: ${sites.length}`);
const byCls = new Map();

for (const s of sites) {
  byCls.set(s.cls, (byCls.get(s.cls) ?? 0) + 1);
}

for (const [k, n] of [...byCls].sort()) {
  console.log(`  ${String(n).padStart(3)}  ${k}`);
}

const guarded = sites.filter((s) => s.gateVars.length > 0);
console.log(`\nsites with >=1 SETTINGS-VALUED enclosing guard: ${guarded.length} / ${sites.length}`);
console.log(`sites with NO settings-valued guard (emit unconditionally): ${sites.length - guarded.length}`);

console.log(`\n=== 2. GATE SETTINGS (the inverted search result) ===`);
console.log(`distinct settings that gate at least one rebind site: ${gateHits.size}`);

for (const [v, rows] of [...gateHits].sort((a, b) => b[1].length - a[1].length)) {
  const brokenRows = rows.filter((r) => r.includes('[BROKEN'));
  console.log(`\n  $${v}  -- gates ${rows.length} sites (${brokenRows.length} in a BROKEN class)`);

  for (const r of rows) {
    console.log(`      ${r}`);
  }
}

console.log(`\n=== 3. BROKEN-class sites, gate view ===`);

for (const s of sites.filter((x) => x.cls.startsWith('BROKEN'))) {
  const gv = s.gateVars.length ? s.gateVars.map((v) => `$${v}`).join(', ') : '(none -- unconditional)';
  console.log(`  ${s.file}:${s.line}  ${s.cls}`);
  console.log(`      guards: ${s.guardKinds.join(' > ') || '(top level)'}`);
  console.log(`      gate settings: ${gv}`);
}

console.log(`\n=== 4. RAW guard headers for every conditionally-emitted site ===`);
console.log('(catches gates driven by a MIXIN PARAMETER whose default is a setting --');
console.log(' those would be filtered out of section 2 because the param name is not a setting name)');

for (const s of sites) {
  const conds = s.guards.filter((g) => /^@(if|else|each|for|supports)/.test(g.kind));

  if (conds.length === 0) {
    continue;
  }

  console.log(`\n  ${s.file}:${s.line}  ${s.cls}`);

  for (const g of conds) {
    console.log(`      ${g.header}`);
  }
}

console.log(`\n=== 5. UNCLASSIFIED sites (verbatim, for hand review) ===`);

for (const s of sites.filter((x) => x.cls === 'UNCLASSIFIED')) {
  console.log(`  ${s.file}:${s.line}  ${s.text}`);
}

const jsonIdx = process.argv.indexOf('--json');

if (jsonIdx > -1 && process.argv[jsonIdx + 1]) {
  writeFileSync(process.argv[jsonIdx + 1], JSON.stringify({ sites, gates: [...gateHits] }, null, 2));
  console.log(`\n[INFO] wrote ${process.argv[jsonIdx + 1]}`);
}
