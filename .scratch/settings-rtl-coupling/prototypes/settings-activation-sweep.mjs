// Ticket 01, probe B -- the sensitivity map itself.
//
// Compile foundation-everything() WITH the R004 rebind, once per settings
// perturbation, and count all six ticket-14 defect classes. A perturbation that
// changes any count is an ACTIVATING (or MASKING) setting.
//
// Three groups:
//   G-M002   the addon's six live controls (the M002 question)
//   G-GATE   the 10 settings probe A found gating a rebind site
//   G-BOOL   every boolean in Foundation's 490-name settings template, flipped
//            (the bounding sweep -- catches anything probe A's static walk missed)
//
// Read-only. Usage: node settings-activation-sweep.mjs [--group M002|GATE|BOOL|ALL]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

import { classifyCss, fmt } from './rtl-defect-classifier.mjs';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const FND = join(repoRoot, 'node_modules/foundation-sites/scss');
const loadPaths = [join(repoRoot, 'node_modules'), join(repoRoot, 'packages/ngx-foundation-sites/src/scss')];

/// Foundation's settings template is a flat list of `$name: value;` lines with
/// ZERO !default (ticket 15 measured this). So the migration idiom is: declare
/// the overrides BEFORE the @import, and Foundation's own `!default`s stand down.
function compile(preamble) {
  return sass.compileString(
    [
      ...preamble,
      "@import 'foundation-sites/scss/foundation';",
      '$global-left: inline-start;',
      '$global-right: inline-end;',
      '@include foundation-everything();',
    ].join('\n'),
    { loadPaths, style: 'expanded', logger: sass.Logger.silent },
  ).css;
}

function measure(preamble) {
  const css = compile(preamble);
  const { counts, samples } = classifyCss(css);

  return { bytes: css.length, counts, samples };
}

// --- Read Foundation's own defaults out of the settings template. ---
const settingsSrc = readFileSync(join(FND, 'settings/_settings.scss'), 'utf8');
const DEFAULTS = new Map();

for (const line of settingsSrc.split('\n')) {
  const m = /^\$([a-zA-Z0-9_-]+)\s*:\s*(.+);\s*$/.exec(line);

  if (m) {
    DEFAULTS.set(m[1], m[2].trim());
  }
}

const BOOLEANS = [...DEFAULTS].filter(([, v]) => v === 'true' || v === 'false');

// --- Perturbation table. ---
// `pre` is the list of lines placed BEFORE the @import.
const GROUPS = {
  M002: [
    // The five $foundation-palette keys the addon exposes.
    ...['primary', 'secondary', 'success', 'alert', 'warning'].map((key) => ({
      id: `M002 $foundation-palette.${key}`,
      pre: [
        `$foundation-palette: (primary: #1779ba, secondary: #767676, success: #3adb76, warning: #ffae00, alert: #cc4b37);`,
        `$foundation-palette: map-merge($foundation-palette, (${key}: #123456));`,
      ],
    })),
    // $global-radius, the sixth control -- swept across plausible values,
    // including a percentage and a value large enough to change nothing but the
    // emitted number, so "no activation" is not an artefact of one value.
    ...['1px', '4px', '0.25rem', '1rem', '50%', '9999px'].map((v) => ({
      id: `M002 $global-radius: ${v}`,
      pre: [`$global-radius: ${v};`],
    })),
    // The whole palette replaced, plus radius, together -- the addon's worst case.
    {
      id: 'M002 ALL SIX controls at once',
      pre: [
        `$foundation-palette: (primary: #123456, secondary: #654321, success: #0f0f0f, warning: #abcdef, alert: #fedcba);`,
        `$global-radius: 6px;`,
      ],
    },
  ],

  GATE: [
    { id: '$buttongroup-radius-on-each: false', pre: ['$buttongroup-radius-on-each: false;'] },
    { id: '$global-flexbox: false', pre: ['$global-flexbox: false;'] },
    { id: '$dropdownmenu-arrows: false', pre: ['$dropdownmenu-arrows: false;'] },
    { id: '$buttongroup-expand-max: 2', pre: ['$buttongroup-expand-max: 2;'] },
    { id: '$buttongroup-expand-max: 12', pre: ['$buttongroup-expand-max: 12;'] },
    { id: '$drilldown-arrows: false', pre: ['$drilldown-arrows: false;'] },
    { id: '$pagination-arrows: false', pre: ['$pagination-arrows: false;'] },
    { id: '$input-prefix-border: none', pre: ['$input-prefix-border: none;'] },
    { id: '$select-triangle-color: transparent', pre: ['$select-triangle-color: transparent;'] },
    { id: '$accordion-plusminus: false', pre: ['$accordion-plusminus: false;'] },
    { id: '$grid-column-align-edge: false', pre: ['$grid-column-align-edge: false;'] },
    // Not a gate found by probe A, but it selects the grid family that gets
    // emitted at all, so it is the obvious structural confound.
    { id: '$xy-grid: false', pre: ['$xy-grid: false;'] },
    // Ticket 14's escape hatch, for composition.
    { id: "$global-text-direction: rtl", pre: ["$global-text-direction: rtl;"] },
  ],

  BOOL: BOOLEANS.map(([name, v]) => ({
    id: `$${name}: ${v === 'true' ? 'false' : 'true'}  (default ${v})`,
    pre: [`$${name}: ${v === 'true' ? 'false' : 'true'};`],
  })),
};

const which = (() => {
  const i = process.argv.indexOf('--group');

  return i > -1 ? process.argv[i + 1] : 'ALL';
})();

const selected = which === 'ALL' ? [...GROUPS.M002, ...GROUPS.GATE, ...GROUPS.BOOL] : GROUPS[which];

if (!selected) {
  console.error(`[ERROR] unknown group ${which}`);
  process.exit(2);
}

// --- Baseline: Foundation's defaults, with the rebind. ---
const base = measure([]);
console.log('=== BASELINE (Foundation defaults + R004 rebind, foundation-everything) ===');
console.log(`  css ${base.bytes} bytes`);
console.log(`  ${fmt(base.counts)}`);
console.log('\n  baseline samples:');

for (const [k, set] of Object.entries(base.samples)) {
  console.log(`    ${k}: ${[...set].slice(0, 6).join(' | ')}${set.size > 6 ? ` ... (${set.size} distinct)` : ''}`);
}

const KEYS = [
  'c1_textAlignValue',
  'c2_bareSidePositioning',
  'c3_logicalRadius',
  'c4_backgroundPosition',
  'c5_classNameRename',
  'c6_triangleDegenerate',
  'otherInvalidProp',
  'otherInvalidValue',
];

const rows = [];

for (const p of selected) {
  let r;

  try {
    r = measure(p.pre);
  } catch (err) {
    rows.push({ id: p.id, error: String(err.message).split('\n')[0] });
    console.log(`\n[ERROR] ${p.id}\n  ${String(err.message).split('\n')[0]}`);
    continue;
  }

  const deltas = {};
  let changed = false;

  for (const k of KEYS) {
    const d = r.counts[k] - base.counts[k];

    if (d !== 0) {
      deltas[k] = d;
      changed = true;
    }
  }

  rows.push({
    id: p.id,
    bytes: r.bytes,
    bytesDelta: r.bytes - base.bytes,
    counts: r.counts,
    deltas,
    changed,
    cssChanged: r.bytes !== base.bytes,
  });

  const tag = changed ? '[ACTIVATES/MASKS]' : r.bytes !== base.bytes ? '[css changed, defects unchanged]' : '[INERT]';
  const dstr = changed
    ? Object.entries(deltas)
        .map(([k, d]) => `${k} ${d > 0 ? '+' : ''}${d}`)
        .join(', ')
    : '--';
  console.log(`\n${tag} ${p.id}`);
  console.log(`  css ${r.bytes} (${r.bytes - base.bytes >= 0 ? '+' : ''}${r.bytes - base.bytes})  invalid=${r.counts.totalInvalidDecl} (base ${base.counts.totalInvalidDecl})`);
  console.log(`  deltas: ${dstr}`);

  if (changed) {
    for (const k of Object.keys(deltas)) {
      const key = k.startsWith('c1') ? 'c1' : k.startsWith('c2') ? 'c2' : k.startsWith('c3') ? 'c3' : k.startsWith('c4') ? 'c4' : k.startsWith('c5') ? 'c5' : k.startsWith('c6') ? 'c6' : k;
      const set = r.samples[key];

      if (set) {
        console.log(`    ${k} samples: ${[...set].slice(0, 5).join(' | ')}`);
      }
    }
  }
}

console.log('\n\n=== SUMMARY ===');
const activating = rows.filter((r) => r.changed);
const cssOnly = rows.filter((r) => !r.changed && r.cssChanged);
const inert = rows.filter((r) => !r.changed && !r.cssChanged && !r.error);
const errored = rows.filter((r) => r.error);
console.log(`perturbations tested:      ${rows.length}`);
console.log(`ACTIVATE or MASK a defect: ${activating.length}`);
console.log(`change CSS but no defect:  ${cssOnly.length}`);
console.log(`fully inert:               ${inert.length}`);
console.log(`errored:                   ${errored.length}`);
console.log('\nactivating/masking settings:');

for (const r of activating) {
  console.log(
    `  ${r.id}  ->  ${Object.entries(r.deltas)
      .map(([k, d]) => `${k} ${d > 0 ? '+' : ''}${d}`)
      .join(', ')}`,
  );
}

const out = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;

if (out) {
  writeFileSync(out, JSON.stringify({ base: base.counts, baseBytes: base.bytes, rows }, null, 2));
  console.log(`\n[INFO] wrote ${out}`);
}
