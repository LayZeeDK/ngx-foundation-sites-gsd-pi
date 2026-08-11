// Ticket 13: MEASURE the scaling curve of a theme apply as components land.
//
// Ticket 12 settled the compile ARCHITECTURE (one compile emits N components'
// rules; the Foundation @import island is served once) and measured the SOURCE
// CLOSURE. It did not measure TIME. This probe does, by compiling rather than
// extrapolating, over four shapes so the curve's shape is evidence:
//
//   A  SHARED island, N distinct REAL Foundation components, ONE compile.
//      The architecture ticket 12 locked (C2/C3).
//   B  SHARED island, N emissions of the REPO'S REAL button theme() under
//      distinct selectors, ONE compile. Pessimistic: button was the reference
//      project's SLOWEST component, and this uses the real _button.scss with
//      its full palette x (fill + hollow) loop -- no synthetic Sass at all.
//   C  PER-COMPONENT island (the file shape this repo uses today:
//      internal/_foundation-button.scss @imports util + global + its own
//      component), N components, ONE compile. Prices island DUPLICATION --
//      ticket 12 flagged "one shared island" as [INFER].
//   D  N SEPARATE compiles of single-component chains. The reference project's
//      architecture, and the additive curve ticket 13 must confirm or refute.
//
// Plus: the real nfs button chain as a timing ANCHOR onto ticket 05's measured
// browser-Worker median; the panel-init DATA probe compile; per-component
// EMISSION cost with the parse floor held constant; per-component SOLO compile
// cost (what a worker pool would actually schedule); and a Map cache-hit cost.
//
// MEASUREMENT METHOD. Ticket 05 recorded a ~1.7x mid-run latency regime shift
// (V8 tier-down or Snapdragon DVFS). A first version of this probe reproduced it
// as a false result: the six cases measured earliest came out 2-3x more
// expensive than identical work measured later. So every case here is measured
// INTERLEAVED -- one sample of every case per pass, case order SHUFFLED per
// pass, after two full warm-up passes -- and the reported figure is the median
// across passes. Drift then hits every series equally instead of whichever ran
// first.
//
// Read-only. Reads node_modules/foundation-sites and
// packages/ngx-foundation-sites/src/scss; every synthetic module is served from
// an in-memory overlay. Writes nothing.
//
// Usage: node scaling-curve.mjs [samples]

import { existsSync, readFileSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const NFS_ROOT = join(repoRoot, 'packages/ngx-foundation-sites/src/scss');
const FND_ROOT = join(repoRoot, 'node_modules/foundation-sites');

const SAMPLES = Number(process.argv[2] ?? 7);

const OPTS = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  alertColor: false,
};

// ---------------------------------------------------------------------------
// Importer (same shape as the other prototypes) with an in-memory overlay.
// ---------------------------------------------------------------------------

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

function makeImporter(overlay, stats) {
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

      // Superset of the other prototypes' rewrite: also catches
      // foundation-sites/_vendor/... , which Foundation's own foundation.scss
      // imports and which several component partials transitively need.
      const fsIndex = pathname.indexOf('foundation-sites/');

      if (fsIndex !== -1) {
        scheme = 'fnd';
        pathname = `/${pathname.slice(fsIndex + 'foundation-sites/'.length)}`;
      }

      for (const candidate of candidates(scheme, pathname, context.fromImport)) {
        if (candidate in overlay) {
          return new URL(candidate);
        }

        const disk = diskPathFor(candidate);

        if (disk && existsSync(disk)) {
          return new URL(candidate);
        }
      }

      return null;
    },

    load(canonicalUrl) {
      const key = canonicalUrl.toString();
      const contents = key in overlay ? overlay[key] : readFileSync(diskPathFor(key), 'utf8');
      stats.loadCalls += 1;
      stats.served.add(key);

      return { contents, syntax: 'scss' };
    },
  };
}

function compileOnce(entry, overlay) {
  const stats = { loadCalls: 0, served: new Set() };
  const result = sass.compileString(entry, {
    ...OPTS,
    importers: [makeImporter(overlay, stats)],
  });

  return { css: result.css, stats };
}

function tryCompile(entry, overlay) {
  try {
    return { ok: true, ...compileOnce(entry, overlay) };
  } catch (e) {
    return { ok: false, error: String(e.message).split('\n')[0] };
  }
}

function ms(n) {
  return n.toFixed(1);
}

function kib(n) {
  return (n / 1024).toFixed(1);
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;

  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Component set and the two island shapes.
// ---------------------------------------------------------------------------

// Ordered so components other components depend on come FIRST (button before
// button-group; menu before drilldown / accordion-menu / dropdown-menu), which
// is also the order a library grows in. The preflight is CUMULATIVE for that
// reason.
const CANDIDATES = [
  'button',
  'menu',
  'dropdown',
  'callout',
  'label',
  'badge',
  'card',
  'accordion',
  'tabs',
  'switch',
  'table',
  'button-group',
  'off-canvas',
  'breadcrumbs',
  'close-button',
  'pagination',
  'progress-bar',
  'reveal',
  'thumbnail',
  'title-bar',
  'media-object',
  'top-bar',
  'orbit',
  'drilldown',
  'accordion-menu',
  'dropdown-menu',
  'tooltip',
  'sticky',
  'float',
  'flex',
  'visibility',
  'slider',
  'menu-icon',
  'responsive-embed',
];

/** Foundation's own per-component export mixin. A few do not follow the pattern. */
const EXPORT_MIXIN = {
  float: 'foundation-float-classes',
  flex: 'foundation-flex-classes',
  visibility: 'foundation-visibility-classes',
  drilldown: 'foundation-drilldown-menu',
};

function exportMixin(name) {
  return EXPORT_MIXIN[name] ?? `foundation-${name}`;
}

// The repo's real island imports exactly three things (util/util, global,
// components/button). That shape is NOT sufficient once a component's rules are
// actually EMITTED: menu and friends call -zf-each-breakpoint-in(), which needs
// sassy-lists' sl-remove(), and dropdown-menu / tooltip need typography (ticket
// 12 C3 found the latter). A multi-component-capable island therefore carries
// Foundation's own dependency preamble -- priced as a one-off floor delta below.
const PREAMBLE = [
  ...['missing-dependencies', 'true'].map(
    (n) => `@import 'foundation-sites/_vendor/sassy-lists/stylesheets/helpers/${n}';`,
  ),
  ...['contain', 'purge', 'remove', 'replace', 'to-list'].map(
    (n) => `@import 'foundation-sites/_vendor/sassy-lists/stylesheets/functions/${n}';`,
  ),
];

function islandSource(names, { minimal = false } = {}) {
  return [
    `@use 'settings' as settings;`,
    ``,
    `$white: settings.$white;`,
    `$black: settings.$black;`,
    `$global-margin: settings.$global-margin;`,
    `$global-radius: settings.$global-radius;`,
    ``,
    ...(minimal ? [] : PREAMBLE),
    `@import 'foundation-sites/scss/util/util';`,
    `@import 'foundation-sites/scss/global';`,
    ...(minimal ? [] : [`@import 'foundation-sites/scss/typography/typography';`]),
    ...names.map((n) => `@import 'foundation-sites/scss/components/${n}';`),
    ``,
    `$global-left: inline-start;`,
    `$global-right: inline-end;`,
  ].join('\n');
}

/** A public wrapper module in the nfs shape: theme() over an island namespace. */
function wrapperSource(name, islandUrl) {
  return [
    `@use '${islandUrl}' as fb;`,
    `@use 'internal/settings' as settings;`,
    ``,
    `@mixin theme($background: null, $palette: null, $radius: null) {`,
    `  @include fb.${exportMixin(name)};`,
    `}`,
  ].join('\n');
}

function buildOverlay(names, mode) {
  const overlay = {};

  if (mode === 'shared') {
    overlay['nfs:/internal/_probe-island.scss'] = islandSource(names);

    for (const n of names) {
      overlay[`nfs:/_probe-${n}.scss`] = wrapperSource(n, 'internal/probe-island');
    }
  } else {
    for (const n of names) {
      overlay[`nfs:/internal/_probe-island-${n}.scss`] = islandSource([n]);
      overlay[`nfs:/_probe-${n}.scss`] = wrapperSource(n, `internal/probe-island-${n}`);
    }
  }

  return overlay;
}

function entryFor(names) {
  return [
    ...names.map((n) => `@use 'nfs:/probe-${n}' as probe-${n};`),
    ...names.map((n) => `@include probe-${n}.theme();`),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Preflights (correctness, not timing) -- they also produce real findings.
// ---------------------------------------------------------------------------

console.log(`samples per point: ${SAMPLES} (interleaved, shuffled, 2 warm-up passes)`);
console.log(`node ${process.version}  sass ${sass.info.replace(/\s+/g, ' ')}`);

const COMPONENTS = [];
const REJECTED = [];

for (const name of CANDIDATES) {
  const r = tryCompile(entryFor([name]), buildOverlay([...COMPONENTS, name], 'shared'));

  if (r.ok) {
    COMPONENTS.push(name);
  } else {
    REJECTED.push([name, r.error]);
  }
}

console.log(
  `\n=== 1. CUMULATIVE PREFLIGHT: emit through the SHARED island -- ` +
    `${COMPONENTS.length}/${CANDIDATES.length} OK ===`,
);

for (const [name, err] of REJECTED) {
  console.log(`  EXCLUDED ${name}: ${err}`);
}

const SOLO = [];
const SOLO_REJECTED = [];

for (const name of COMPONENTS) {
  const r = tryCompile(entryFor([name]), buildOverlay([name], 'per'));

  if (r.ok) {
    SOLO.push(name);
  } else {
    SOLO_REJECTED.push([name, r.error]);
  }
}

console.log(
  `\n=== 2. SOLO-ISLAND PREFLIGHT: one component per island -- ` +
    `${SOLO.length}/${COMPONENTS.length} OK ===`,
);

for (const [name, err] of SOLO_REJECTED) {
  console.log(`  CANNOT be islanded alone -- ${name}: ${err}`);
}

// ---------------------------------------------------------------------------
// Cases. Every timed thing is registered here and measured interleaved.
// ---------------------------------------------------------------------------

const NS = [1, 2, 3, 5, 10, 20, COMPONENTS.length].filter(
  (n, i, a) => n <= COMPONENTS.length && a.indexOf(n) === i,
);
const NS_SOLO = [1, 2, 3, 5, 10, 20, SOLO.length].filter(
  (n, i, a) => n <= SOLO.length && a.indexOf(n) === i,
);

const cases = [];
const info = new Map();

function addCase(id, entry, overlay) {
  const one = compileOnce(entry, overlay);
  info.set(id, {
    css: Buffer.byteLength(one.css, 'utf8'),
    files: one.stats.served.size,
    fndFiles: [...one.stats.served].filter((k) => k.startsWith('fnd:')).length,
    loadCalls: one.stats.loadCalls,
  });
  cases.push({ id, run: () => compileOnce(entry, overlay), times: [] });
}

function addMultiCase(id, runs) {
  cases.push({
    id,
    run: () => {
      for (const [entry, overlay] of runs) {
        compileOnce(entry, overlay);
      }
    },
    times: [],
  });
}

// -- anchor + panel-init probe
const REAL_BUTTON = `@use 'nfs:/button' as nfs-button;\n@include nfs-button.theme();\n`;
addCase('anchor:default', REAL_BUTTON, {});
addCase(
  'anchor:themed',
  `@use 'nfs:/button' as nfs-button;\n@include nfs-button.theme($palette: ` +
    `(success: #238648, warning: #9e6c00, alert: #cb4b37), $radius: 6px);\n`,
  {},
);

const THEME_DATA = { 'nfs:/_theme.scss': `$wcag-palette: (success: #238648);\n` };
addCase(
  'probe:panel-init',
  [
    `@use 'nfs:/internal/settings' as s;`,
    `@use 'nfs:/theme' as t;`,
    `a { b: inspect((s.$primary-color, s.$secondary-color, s.$success-color,`,
    `  s.$warning-color, s.$alert-color, s.$global-radius, t.$wcag-palette)); }`,
  ].join('\n'),
  THEME_DATA,
);

// -- island floors, nothing emitted
const ISLAND_USE = `@use 'nfs:/internal/probe-island' as fb;\n`;
addCase('floor:repo-3-import', ISLAND_USE, {
  'nfs:/internal/_probe-island.scss': islandSource([], { minimal: true }),
});
addCase('floor:multi-capable', ISLAND_USE, {
  'nfs:/internal/_probe-island.scss': islandSource([]),
});
const UNION_OVERLAY = buildOverlay(COMPONENTS, 'shared');
addCase('floor:union-parsed', ISLAND_USE, UNION_OVERLAY);

// -- A: shared island, N distinct real components, one compile
for (const n of NS) {
  const names = COMPONENTS.slice(0, n);
  addCase(`A:${n}`, entryFor(names), buildOverlay(names, 'shared'));
}

// -- B: N emissions of the real button theme(), one compile
for (const n of NS) {
  addCase(
    `B:${n}`,
    [
      `@use 'nfs:/button' as nfs-button;`,
      ...Array.from(
        { length: n },
        (_, i) =>
          `@include nfs-button.theme($selector: '.probe-${i}', ` +
          `$palette: (success: #238648, warning: #9e6c00, alert: #cb4b37), $radius: ${i}px);`,
      ),
    ].join('\n'),
    {},
  );
}

// -- C: per-component islands, N components, one compile
for (const n of NS_SOLO) {
  const names = SOLO.slice(0, n);
  addCase(`C:${n}`, entryFor(names), buildOverlay(names, 'per'));
}

// -- D: N separate compiles
for (const n of NS_SOLO) {
  const names = SOLO.slice(0, n);
  addMultiCase(
    `D:${n}`,
    names.map((x) => [entryFor([x]), buildOverlay([x], 'per')]),
  );
}

// -- E1: emission cost of each component, parse floor held constant
for (const name of COMPONENTS) {
  addCase(`E1:${name}`, entryFor([name]), UNION_OVERLAY);
}

// -- E2: SOLO compile cost of each component -- what a pool would schedule
for (const name of SOLO) {
  addCase(`E2:${name}`, entryFor([name]), buildOverlay([name], 'per'));
}

// ---------------------------------------------------------------------------
// Interleaved measurement.
// ---------------------------------------------------------------------------

function shuffled(xs) {
  const a = [...xs];

  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

for (let pass = 0; pass < SAMPLES + 2; pass += 1) {
  for (const c of shuffled(cases)) {
    const t0 = performance.now();
    c.run();
    const dt = performance.now() - t0;

    if (pass >= 2) {
      c.times.push(dt);
    }
  }
}

const T = new Map(cases.map((c) => [c.id, median(c.times)]));

function spread(id) {
  const c = cases.find((x) => x.id === id);

  return { min: Math.min(...c.times), max: Math.max(...c.times) };
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------

console.log('\n=== 3. ANCHOR + panel-init probe ===');
{
  const a = T.get('anchor:default');
  const s = spread('anchor:default');
  const i = info.get('anchor:default');
  console.log(
    `real nfs button chain, default theme : median ${ms(a)} ms ` +
      `(min ${ms(s.min)}, max ${ms(s.max)}) | css ${i.css} B | ` +
      `${i.files} files served, ${i.loadCalls} load() calls`,
  );
  console.log(
    `real nfs button chain, themed        : median ${ms(T.get('anchor:themed'))} ms | ` +
      `css ${info.get('anchor:themed').css} B`,
  );
  const p = info.get('probe:panel-init');
  console.log(
    `panel-init DATA probe (no island)    : median ${ms(T.get('probe:panel-init'))} ms | ` +
      `${p.files} files | css ${p.css} B`,
  );
}

console.log('\n=== 4. ISLAND FLOOR (island @used, no component rules emitted) ===');

for (const [id, label] of [
  ['floor:repo-3-import', "repo's real 3-import shape (util + global + 1 component)"],
  ['floor:multi-capable', 'multi-component-capable (+ sassy-lists + typography)'],
  ['floor:union-parsed', `same, with all ${COMPONENTS.length} component partials imported`],
]) {
  const i = info.get(id);
  console.log(
    `${label.padEnd(56)} | median ${ms(T.get(id)).padStart(7)} ms | ` +
      `${String(i.files).padStart(3)} files (${i.fndFiles} fnd) | css ${i.css} B`,
  );
}

function table(label, ids, ns, note) {
  console.log(`\n=== ${label} ===`);

  if (note) {
    console.log(note);
  }

  console.log('  N | median ms |   min |   max | css KiB | files | load() | ms per component');

  for (let k = 0; k < ns.length; k += 1) {
    const id = ids[k];
    const m = T.get(id);
    const s = spread(id);
    const i = info.get(id) ?? {};
    console.log(
      `${String(ns[k]).padStart(3)} | ${ms(m).padStart(9)} | ${ms(s.min).padStart(5)} | ` +
        `${ms(s.max).padStart(5)} | ${(i.css == null ? '-' : kib(i.css)).padStart(7)} | ` +
        `${String(i.files ?? '-').padStart(5)} | ${String(i.loadCalls ?? '-').padStart(6)} | ` +
        `${ms(m / ns[k]).padStart(6)}`,
    );
  }
}

table(
  'A. SHARED island, N distinct REAL components, ONE compile',
  NS.map((n) => `A:${n}`),
  NS,
);
table(
  "B. N emissions of the REPO'S REAL button theme(), ONE compile",
  NS.map((n) => `B:${n}`),
  NS,
  '(no synthetic Sass: the real _button.scss, N selectors, full palette loop)',
);
table(
  "C. PER-COMPONENT island (repo's real file shape), N components, ONE compile",
  NS_SOLO.map((n) => `C:${n}`),
  NS_SOLO,
);
table(
  "D. N SEPARATE compiles, one per component (the reference's shape)",
  NS_SOLO.map((n) => `D:${n}`),
  NS_SOLO,
);

// -- E1 / E2 tables
console.log('\n=== E. PER-COMPONENT cost ===');
const FLOOR_UNION = T.get('floor:union-parsed');
const FLOOR_MULTI = T.get('floor:multi-capable');
console.log(
  `emission cost = compile(union island, emit ONE) - compile(union island, emit none = ` +
    `${ms(FLOOR_UNION)} ms), so the parse floor is held constant.\n` +
    `solo cost     = compile(own island holding only that component, emit it) -- ` +
    `what a worker POOL would schedule.`,
);
console.log('component            | emit-one ms | emission ms | solo ms | css B');

const per = [];

for (const name of COMPONENTS) {
  const emitOne = T.get(`E1:${name}`);
  const solo = T.get(`E2:${name}`);
  per.push({ name, emission: emitOne - FLOOR_UNION, solo });
  console.log(
    `${name.padEnd(20)} | ${ms(emitOne).padStart(11)} | ` +
      `${ms(emitOne - FLOOR_UNION).padStart(11)} | ` +
      `${(solo == null ? '   n/a' : ms(solo)).padStart(7)} | ` +
      `${String(info.get(`E1:${name}`).css).padStart(6)}`,
  );
}

const sumEmission = per.reduce((s, p) => s + p.emission, 0);
const predicted = FLOOR_UNION + sumEmission;
const measuredUnion = T.get(`A:${COMPONENTS.length}`);
console.log(
  `\nADDITIVITY CHECK: floor ${ms(FLOOR_UNION)} + sum of ${per.length} emission costs ` +
    `${ms(sumEmission)} = ${ms(predicted)} ms predicted vs ${ms(measuredUnion)} ms measured ` +
    `for ONE compile emitting all ${COMPONENTS.length} ` +
    `(predicted / measured = ${(predicted / measuredUnion).toFixed(2)})`,
);

// ---------------------------------------------------------------------------
// F. Pool arithmetic from the measured SOLO costs.
// ---------------------------------------------------------------------------

console.log('\n=== F. POOL arithmetic from the measured SOLO costs ===');
console.log('(split = one compile per component, each paying its own island floor;');
console.log(' LPT-packed into P workers; wall = the busiest worker. Excludes');
console.log(' postMessage and CSS-recombination overhead, so it FAVOURS the pool.)');
console.log('  N | shared ONE compile | split total | P=2 wall | P=4 wall | P=8 wall | best gain');

function lptWall(costs, p) {
  const bins = new Array(p).fill(0);

  for (const c of [...costs].sort((a, b) => b - a)) {
    let min = 0;

    for (let i = 1; i < p; i += 1) {
      if (bins[i] < bins[min]) {
        min = i;
      }
    }

    bins[min] += c;
  }

  return Math.max(...bins);
}

for (const n of NS_SOLO) {
  const costs = SOLO.slice(0, n).map((name) => T.get(`E2:${name}`));
  const total = costs.reduce((s, c) => s + c, 0);
  // The shared-island compile over the SAME solo-islandable subset.
  const sharedIds = SOLO.slice(0, n);
  const sharedCase = `Ashared:${n}`;

  if (!T.has(sharedCase)) {
    // Not pre-registered: compile once, untimed, and reuse series A where the
    // prefix matches. Series A's prefix is COMPONENTS, not SOLO, so use A only
    // when the two prefixes are equal.
    void sharedIds;
  }

  const shared = T.get(`A:${n}`) ?? null;
  const walls = [2, 4, 8].map((p) => lptWall(costs, p));
  const best = Math.min(...walls);
  console.log(
    `${String(n).padStart(3)} | ${(shared == null ? '-' : ms(shared)).padStart(18)} | ` +
      `${ms(total).padStart(11)} | ${ms(walls[0]).padStart(8)} | ${ms(walls[1]).padStart(8)} | ` +
      `${ms(walls[2]).padStart(8)} | ` +
      `${shared == null ? '-' : `${(shared / best).toFixed(2)}x`}`,
  );
}

// ---------------------------------------------------------------------------
// G. Linear fit.
// ---------------------------------------------------------------------------

function fit(points) {
  const n = points.length;
  const sx = points.reduce((s, p) => s + p.n, 0);
  const sy = points.reduce((s, p) => s + p.t, 0);
  const sxx = points.reduce((s, p) => s + p.n * p.n, 0);
  const sxy = points.reduce((s, p) => s + p.n * p.t, 0);
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);

  return { marginal: b, fixed: (sy - b * sx) / n };
}

console.log('\n=== G. LINEAR FIT  T(N) = fixed + marginal * N  (Node ms) ===');
console.log('series                     | fixed ms | marginal ms/comp |   T(1) | T(35) predicted');

for (const [label, ids, ns] of [
  ['A shared, real components', NS.map((n) => `A:${n}`), NS],
  ['B shared, N x real button', NS.map((n) => `B:${n}`), NS],
  ['C per-component islands', NS_SOLO.map((n) => `C:${n}`), NS_SOLO],
  ['D N separate compiles', NS_SOLO.map((n) => `D:${n}`), NS_SOLO],
]) {
  const f = fit(ns.map((n, k) => ({ n, t: T.get(ids[k]) })));
  console.log(
    `${label.padEnd(26)} | ${ms(f.fixed).padStart(8)} | ${ms(f.marginal).padStart(16)} | ` +
      `${ms(f.fixed + f.marginal).padStart(6)} | ${ms(f.fixed + f.marginal * 35).padStart(8)}`,
  );
}

// ---------------------------------------------------------------------------
// H. Anchor onto ticket 05's measured browser-Worker median.
// ---------------------------------------------------------------------------

const ANCHOR_NODE = T.get('anchor:default');
const ANCHOR_WORKER = 197.4; // ticket 05 section 5, measured in a real Worker
const FACTOR = ANCHOR_WORKER / ANCHOR_NODE;

console.log('\n=== H. Projected browser-WORKER time (anchored, NOT measured) ===');
console.log(
  `anchor: real button chain ${ms(ANCHOR_NODE)} ms here == ${ANCHOR_WORKER} ms measured in a ` +
    `real Worker (ticket 05 s5) -> factor ${FACTOR.toFixed(2)}x`,
);
console.log('  N | A worker ms | B worker ms | C worker ms | D worker ms');

for (let k = 0; k < NS.length; k += 1) {
  const n = NS[k];
  const c = T.has(`C:${n}`) ? ms(T.get(`C:${n}`) * FACTOR) : '-';
  const d = T.has(`D:${n}`) ? ms(T.get(`D:${n}`) * FACTOR) : '-';
  console.log(
    `${String(n).padStart(3)} | ${ms(T.get(`A:${n}`) * FACTOR).padStart(11)} | ` +
      `${ms(T.get(`B:${n}`) * FACTOR).padStart(11)} | ${c.padStart(11)} | ${d.padStart(11)}`,
  );
}

// ---------------------------------------------------------------------------
// I. Cache-hit cost, for the 1000x asymmetry claim.
// ---------------------------------------------------------------------------

console.log('\n=== I. Cache-hit cost: JSON key + Map.get on the canonical theme ===');
{
  const cache = new Map();
  const theme = { primary: '#2a5db0', success: '#238648', radius: 6 };
  cache.set(JSON.stringify(theme), 'x'.repeat(5840));
  const iterations = 200000;
  let sink = 0;
  const t0 = performance.now();

  for (let i = 0; i < iterations; i += 1) {
    sink += cache.get(JSON.stringify(theme)).length;
  }

  const perLookup = (performance.now() - t0) / iterations;
  console.log(
    `${(perLookup * 1000).toFixed(2)} us per hit (${perLookup.toFixed(5)} ms), sink ${sink}`,
  );
  console.log(
    `asymmetry vs the N=1 worker compile (197.4 ms): ` +
      `${Math.round(197.4 / perLookup).toLocaleString('en-US')}x`,
  );
}

console.log(`\nFLOOR reference: multi-capable island floor ${ms(FLOOR_MULTI)} ms`);
