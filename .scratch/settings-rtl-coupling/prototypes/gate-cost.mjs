// Ticket 03, probe D -- what does the GATE cost? (a different quantity from
// ticket 02's mechanism cost)
//
// Ticket 02 measured the MECHANISM: BASE vs REBIND vs TWINS vs GENERATOR, all at
// Foundation's DEFAULT settings. That is not what this measures. Ticket 03's
// recommendation needs the cost of the two-compile ENVELOPE that defines "the
// widest settings configuration" for ticket 02's per-component onboarding test --
// and its second compile runs at the ADMITTING settings
// (`$buttongroup-radius-on-each: false`, `$global-flexbox: false`), which nobody
// has compiled and timed. `$global-flexbox: false` sends Foundation down different
// branches, so assuming the second compile costs the same as the first is exactly
// the kind of unmeasured arithmetic this map keeps catching.
//
// Measurement hygiene: every (variant, replicate) pair goes in one list, shuffled
// with Fisher-Yates before execution, medians reported, warm-up outside the
// measurement. A prior agent in this effort reproduced a fake finding from
// declaration-order sampling, and ticket 02 caught a spurious uniform +2% from an
// unshuffled run of identical code.
//
// Read-only. Usage: node gate-cost.mjs [replicates]

import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const loadPaths = [join(repoRoot, 'node_modules'), join(repoRoot, 'packages/ngx-foundation-sites/src/scss')];

const REPLICATES = Number(process.argv[2] ?? 7);

const ALL_MIXINS = [
  'foundation-global-styles', 'foundation-forms', 'foundation-typography', 'foundation-grid',
  'foundation-flex-grid', 'foundation-xy-grid-classes', 'foundation-button', 'foundation-button-group',
  'foundation-close-button', 'foundation-label', 'foundation-progress-bar', 'foundation-slider',
  'foundation-switch', 'foundation-table', 'foundation-badge', 'foundation-breadcrumbs',
  'foundation-callout', 'foundation-card', 'foundation-dropdown', 'foundation-pagination',
  'foundation-tooltip', 'foundation-accordion', 'foundation-media-object', 'foundation-orbit',
  'foundation-responsive-embed', 'foundation-tabs', 'foundation-thumbnail', 'foundation-menu',
  'foundation-menu-icon', 'foundation-accordion-menu', 'foundation-drilldown-menu',
  'foundation-dropdown-menu', 'foundation-off-canvas', 'foundation-reveal', 'foundation-sticky',
  'foundation-title-bar', 'foundation-top-bar', 'foundation-float-classes', 'foundation-flex-classes',
  'foundation-visibility-classes', 'foundation-prototype-classes',
];

// The gate is a per-component onboarding obligation (ticket 14 D1g, ticket 02
// s5.2), so the realistic unit is ONE component. button-group is the worked hard
// case: 14 latent radius sites, and ticket 02 measured it as the worst by twin
// ratio (+62% bytes).
const TARGETS = {
  'whole library': ALL_MIXINS,
  'button-group  ': ['foundation-global-styles', 'foundation-button', 'foundation-button-group'],
  'menu          ': ['foundation-global-styles', 'foundation-menu'],
};

// The two compiles of the envelope. A is Foundation's defaults; B flips the two
// settings measured to ADMIT sites.
const CONDITIONS = {
  'A defaults': [],
  'B admitting': ['$buttongroup-radius-on-each: false;', '$global-flexbox: false;'],
};

function compile(preamble, mixins) {
  return sass.compileString(
    [
      ...preamble,
      "@import 'foundation-sites/scss/foundation';",
      '$global-left: inline-start;',
      '$global-right: inline-end;',
      ...mixins.map((m) => `@include ${m};`),
    ].join('\n'),
    { loadPaths, style: 'expanded', logger: sass.Logger.silent },
  ).css;
}

// Build the full work list, then shuffle it. Every cell is interleaved with every
// other, so no variant occupies a fixed position in the run.
const jobs = [];

for (const [targetName, mixins] of Object.entries(TARGETS)) {
  for (const [condName, pre] of Object.entries(CONDITIONS)) {
    for (let r = 0; r < REPLICATES; r += 1) {
      jobs.push({ key: `${targetName} | ${condName}`, pre, mixins });
    }
  }
}

for (let i = jobs.length - 1; i > 0; i -= 1) {
  const j = Math.floor(Math.random() * (i + 1));
  [jobs[i], jobs[j]] = [jobs[j], jobs[i]];
}

// Warm-up outside the measurement, once per cell, so module load and Sass importer
// cache priming are not charged to whichever cell happens to run first.
for (const [targetName, mixins] of Object.entries(TARGETS)) {
  void targetName;

  for (const pre of Object.values(CONDITIONS)) {
    compile(pre, mixins);
  }
}

const samples = new Map();
const bytes = new Map();

for (const job of jobs) {
  const t0 = performance.now();
  const css = compile(job.pre, job.mixins);
  const ms = performance.now() - t0;

  if (!samples.has(job.key)) {
    samples.set(job.key, []);
  }

  samples.get(job.key).push(ms);
  bytes.set(job.key, css.length);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);

  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

console.log(
  `=== Ticket 03 GATE cost: the two-compile envelope ===\n` +
    `${REPLICATES} replicates per cell, all ${jobs.length} runs interleaved and shuffled.\n`,
);

for (const targetName of Object.keys(TARGETS)) {
  const keyA = `${targetName} | A defaults`;
  const keyB = `${targetName} | B admitting`;
  const a = samples.get(keyA);
  const b = samples.get(keyB);
  const mA = median(a);
  const mB = median(b);

  console.log(`  ${targetName}`);
  console.log(
    `    A defaults    median=${mA.toFixed(0).padStart(5)} ms  spread ${Math.min(...a).toFixed(0)}..${Math.max(...a).toFixed(0)}  ${bytes.get(keyA)} B`,
  );
  console.log(
    `    B admitting   median=${mB.toFixed(0).padStart(5)} ms  spread ${Math.min(...b).toFixed(0)}..${Math.max(...b).toFixed(0)}  ${bytes.get(keyB)} B`,
  );
  console.log(
    `    B - A         ${(mB - mA >= 0 ? '+' : '')}${(mB - mA).toFixed(0)} ms (${(((mB - mA) / mA) * 100).toFixed(0)}%)` +
      `   -- spreads ${
        Math.max(...a) - Math.min(...a) > Math.abs(mB - mA) || Math.max(...b) - Math.min(...b) > Math.abs(mB - mA)
          ? 'WIDER than the difference, so it is NOISE'
          : 'narrower than the difference, so it is REAL'
      }`,
  );
  console.log(`    GATE TOTAL    ${(mA + mB).toFixed(0)} ms\n`);
}

console.log(
  '  Compare: ticket 01 showed a cartesian gate needs 2^13 = 8192 cells over the FINITE gates alone,\n' +
    '  and still misses the two infinite-domain multipliers entirely.',
);
