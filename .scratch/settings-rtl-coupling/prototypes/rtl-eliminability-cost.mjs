// Ticket 02 -- what the eliminator COSTS.
//
// Ticket 13 measured the library's compile curve as additive with a ~1.2-1.4 s
// ceiling for the whole library. This prices the mechanism against that.
//
// Four conditions, per component and for the whole library:
//   BASE    Foundation as shipped, one pass                  (today's floor)
//   REBIND  BASE + the R004 $global-left/$global-right rebind (today's mechanism)
//   TWINS   BASE + the generated direction twins as literal Sass
//           (the CONSUMER-time shape of the eliminator -- an authored partial)
//   GEN     two Sass passes (ltr + rtl), i.e. the GENERATOR / gate cost
//
// Timing hygiene: every (condition, replicate) pair goes into one list which is
// SHUFFLED before execution, so declaration order cannot manufacture a ratio.
// Medians are reported, not means.
//
// Read-only. Usage: node rtl-eliminability-cost.mjs

import { buildSingleSheet, compileFoundation, diffPasses, flatten, parseRules } from './rtl-eliminator.mjs';

const SETTINGS = ['$global-flexbox: false;', '$buttongroup-radius-on-each: false;'];
const REPS = 7;

const COMPONENTS = [
  'foundation-everything',
  'foundation-button-group',
  'foundation-menu',
  'foundation-drilldown-menu',
  'foundation-accordion-menu',
  'foundation-switch',
  'foundation-forms',
  'foundation-table',
  'foundation-xy-grid-classes',
  'foundation-button',
];

function hr(t) {
  console.log(`\n${'='.repeat(78)}\n${t}\n${'='.repeat(78)}`);
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);

  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

// ---------------------------------------------------------------------------
// Which component carries the most direction-dependent output?
// ---------------------------------------------------------------------------

hr('WHICH COMPONENT IS WORST -- direction-dependent declarations per component');

const twinSass = new Map();
const rows = [];

for (const mixin of COMPONENTS) {
  const include = `@include ${mixin}();`;
  let ltr;
  let rtl;

  try {
    ltr = compileFoundation({ dir: 'ltr', settings: SETTINGS, include });
    rtl = compileFoundation({ dir: 'rtl', settings: SETTINGS, include });
  } catch (error) {
    console.log(`  ${mixin.padEnd(28)} [SKIP] ${String(error.message).split('\n')[0]}`);

    continue;
  }

  const built = buildSingleSheet(ltr, rtl);
  const diff = diffPasses(flatten(parseRules(ltr)), flatten(parseRules(rtl)));

  twinSass.set(mixin, built.twinCss);
  rows.push({
    mixin,
    bytes: ltr.length,
    rules: flatten(parseRules(ltr)).size,
    diffs: diff.propDiffs.length,
    twinBytes: built.overrideBytes,
    twinRules: built.overrideRules,
  });
}

rows.sort((a, b) => b.diffs - a.diffs);
console.log('component                      base bytes   rules   dir-dependent decls   twin bytes   twin rules');

for (const r of rows) {
  console.log(
    `${r.mixin.padEnd(30)} ${String(r.bytes).padStart(10)}  ${String(r.rules).padStart(6)}   ${String(r.diffs).padStart(19)}   ` +
      `${String(r.twinBytes).padStart(10)}   ${String(r.twinRules).padStart(10)}`,
  );
}

const worst = rows.find((r) => r.mixin !== 'foundation-everything');

console.log(`\nworst single component by direction-dependent declarations: ${worst.mixin}`);

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

hr(`COMPILE COST -- ${REPS} replicates per cell, interleaved and SHUFFLED`);

const TIMED = ['foundation-everything', worst.mixin, 'foundation-button-group', 'foundation-menu', 'foundation-button'];
const jobs = [];

for (const mixin of TIMED) {
  for (let i = 0; i < REPS; i += 1) {
    for (const condition of ['BASE', 'REBIND', 'TWINS', 'GEN']) {
      jobs.push({ mixin, condition });
    }
  }
}

// Fisher-Yates, seeded so the run is reproducible.
let seed = 20260811;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;

  return seed / 2147483648;
};

for (let i = jobs.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rnd() * (i + 1));

  [jobs[i], jobs[j]] = [jobs[j], jobs[i]];
}

// Warm up the Sass compiler once, outside the measurement.
compileFoundation({ include: '@include foundation-button();' });

const samples = new Map();

for (const { mixin, condition } of jobs) {
  const include = `@include ${mixin}();`;
  const t0 = performance.now();

  if (condition === 'BASE') {
    compileFoundation({ dir: 'ltr', settings: SETTINGS, include });
  } else if (condition === 'REBIND') {
    compileFoundation({ dir: 'ltr', settings: SETTINGS, include, rebindLeft: 'inline-start', rebindRight: 'inline-end' });
  } else if (condition === 'TWINS') {
    compileFoundation({ dir: 'ltr', settings: SETTINGS, include, append: twinSass.get(mixin) ?? '' });
  } else {
    compileFoundation({ dir: 'ltr', settings: SETTINGS, include });
    compileFoundation({ dir: 'rtl', settings: SETTINGS, include });
  }

  const dt = performance.now() - t0;
  const key = `${mixin}|${condition}`;

  samples.set(key, [...(samples.get(key) ?? []), dt]);
}

console.log('component                       BASE ms   REBIND ms    TWINS ms   TWINS delta      GEN ms');

for (const mixin of TIMED) {
  const m = (c) => median(samples.get(`${mixin}|${c}`));
  const base = m('BASE');

  console.log(
    `${mixin.padEnd(30)} ${base.toFixed(1).padStart(8)}  ${m('REBIND').toFixed(1).padStart(9)}  ${m('TWINS').toFixed(1).padStart(10)}  ` +
      `${`${(m('TWINS') - base >= 0 ? '+' : '')}${(m('TWINS') - base).toFixed(1)} ms (${(((m('TWINS') - base) / base) * 100).toFixed(0)}%)`.padStart(13)}  ${m('GEN').toFixed(1).padStart(10)}`,
  );
}

console.log('\nspread check (min..max ms per cell, to show the medians are not noise):');

for (const mixin of TIMED) {
  const cells = ['BASE', 'REBIND', 'TWINS', 'GEN'].map((c) => {
    const xs = samples.get(`${mixin}|${c}`);

    return `${c} ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)}`;
  });

  console.log(`  ${mixin.padEnd(30)} ${cells.join('   ')}`);
}
