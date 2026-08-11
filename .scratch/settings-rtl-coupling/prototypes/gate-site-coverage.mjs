// Ticket 03, probe A -- IS A PRESENCE GATE COMPLETE OVER SOURCE SITES?
//
// Ticket 01 proved the defect COUNT is unbounded in magnitude:
//     c2 = 2 * $grid-column-count * |$breakpoint-classes| + |$breakpoint-classes| + 23
// and concluded a cartesian-product gate is the wrong SHAPE. That kills a gate
// that tries to bound the COUNT.
//
// This probe asks the different question a gate actually needs answered:
//
//   Does the unbounded growth introduce NEW BROKEN SOURCE SITES, or does it
//   replicate a FIXED site set more times?
//
// If it replicates, then a gate that asserts "zero invalid declarations" over a
// small set of compiles chosen to make every gated site EMIT AT LEAST ONCE is
// COMPLETE over sites -- and the magnitude never matters, because a defect that
// never ships cannot be amplified by a consumer setting.
//
// Method: compile with a source map, walk every emitted declaration, classify it
// with the shared ticket-01 classifier's rules, and trace the emitted line back
// to its ORIGINAL Foundation `file:line`. Then compare SETS of source sites
// across settings configurations.
//
// Read-only. Nothing outside .scratch/ is touched. No new dependency:
// @jridgewell/trace-mapping is already in node_modules.
//
// Usage: node gate-site-coverage.mjs

import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import * as sass from 'sass';

import { LOGICAL_PROP_OK, LOGICAL_VALUE_OK } from './rtl-defect-classifier.mjs';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const loadPaths = [join(repoRoot, 'node_modules'), join(repoRoot, 'packages/ngx-foundation-sites/src/scss')];

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

const BP_NAMES = ['small', 'medium', 'large', 'xlarge', 'xxlarge', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12'];

function bpPre(n) {
  const names = BP_NAMES.slice(0, n);
  const map = names.map((name, i) => `${name}: ${i === 0 ? 0 : `${i * 320}px`}`).join(', ');

  return [`$breakpoints: (${map});`, `$breakpoint-classes: (${names.join(' ')});`];
}

const BARE_SIDE_RE = /^(inline-start|inline-end)$/;
const RADIUS_RE = /^border-(top|bottom)-inline-(start|end)-radius$/;

function compile(preamble) {
  return sass.compileString(
    [
      ...preamble,
      "@import 'foundation-sites/scss/foundation';",
      '$global-left: inline-start;',
      '$global-right: inline-end;',
      ...ALL_MIXINS.map((m) => `@include ${m};`),
    ].join('\n'),
    { loadPaths, style: 'expanded', logger: sass.Logger.silent, sourceMap: true, sourceMapIncludeSources: false },
  );
}

function shortSource(src) {
  if (src == null) {
    return '<unmapped>';
  }

  // Sass emits file:// URLs; keep the tail from `foundation-sites/` onward.
  const decoded = decodeURIComponent(src);
  const cut = decoded.indexOf('foundation-sites/');

  return cut >= 0 ? decoded.slice(cut) : decoded.replace(/^.*[\\/]/, '');
}

/// Walk the expanded CSS line-by-line, classify each defect, and map it to a
/// Foundation source site. Expanded style is one declaration per line, so a
/// line-oriented walk is exact here (asserted by the unmapped-count guard below).
function sitesFor(result) {
  const tracer = new TraceMap(result.sourceMap);
  const lines = result.css.split('\n');
  const sites = {
    c1_textAlignValue: new Set(),
    c2_bareSidePositioning: new Set(),
    c3_logicalRadius: new Set(),
    c4_backgroundPosition: new Set(),
    c5_classNameRename: new Set(),
    c6_triangleDegenerate: new Set(),
    otherInvalid: new Set(),
  };
  const counts = Object.fromEntries(Object.keys(sites).map((k) => [k, 0]));
  let unmapped = 0;

  const at = (lineIndex, text) => {
    const column = Math.max(0, text.length - text.trimStart().length);
    const pos = originalPositionFor(tracer, { line: lineIndex + 1, column });

    if (pos.source == null) {
      unmapped += 1;

      return null;
    }

    return `${shortSource(pos.source)}:${pos.line}`;
  };

  const add = (key, lineIndex, text) => {
    counts[key] += 1;
    const site = at(lineIndex, text);

    if (site != null) {
      sites[key].add(site);
    }
  };

  // Rule-level state, for class 6 (a whole degenerate rule) and class 5 (selector).
  let ruleStartLine = -1;
  let ruleProps = null;
  let ruleSolidBorderStyle = false;

  const closeRule = () => {
    if (
      ruleProps != null &&
      ruleSolidBorderStyle &&
      ruleProps.has('border-width') &&
      !ruleProps.has('border-color') &&
      !['top', 'bottom', 'left', 'right', 'inline-start', 'inline-end'].some((s) =>
        ruleProps.has(`border-${s}-width`),
      )
    ) {
      add('c6_triangleDegenerate', ruleStartLine, lines[ruleStartLine] ?? '');
    }

    ruleProps = null;
    ruleSolidBorderStyle = false;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('/*')) {
      continue;
    }

    if (trimmed === '}') {
      closeRule();
      continue;
    }

    if (trimmed.endsWith('{')) {
      const header = trimmed.slice(0, -1).trim();

      if (header.startsWith('@')) {
        continue;
      }

      closeRule();
      ruleStartLine = i;
      ruleProps = new Set();

      // class 5: an interpolated side landed inside a CLASS NAME. Valid CSS that
      // matches nothing. Selector lists span lines, so scan back over the header
      // block that ends here.
      let j = i;

      while (j >= 0 && (j === i || lines[j].trim().endsWith(','))) {
        for (const m of lines[j].matchAll(/\.[A-Za-z0-9_-]*-inline-(?:start|end)\b/g)) {
          void m;
          add('c5_classNameRename', j, lines[j]);
        }

        j -= 1;
      }

      continue;
    }

    const colon = trimmed.indexOf(':');

    if (colon < 0 || ruleProps == null) {
      continue;
    }

    const prop = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).replace(/;$/, '').trim();
    ruleProps.add(prop);

    if (prop === 'border-style' && value === 'solid') {
      ruleSolidBorderStyle = true;
    }

    const propLogical = prop.includes('inline-start') || prop.includes('inline-end');
    const valueLogical = /\binline-(start|end)\b/.test(value);

    if (!propLogical && !valueLogical) {
      continue;
    }

    if (propLogical) {
      if (LOGICAL_PROP_OK.has(prop)) {
        continue;
      }

      if (RADIUS_RE.test(prop)) {
        add('c3_logicalRadius', i, line);
      } else if (BARE_SIDE_RE.test(prop)) {
        add('c2_bareSidePositioning', i, line);
      } else {
        add('otherInvalid', i, line);
      }

      continue;
    }

    if (LOGICAL_VALUE_OK.has(prop)) {
      continue;
    }

    if (prop === 'text-align') {
      add('c1_textAlignValue', i, line);
    } else if (prop === 'background-position') {
      add('c4_backgroundPosition', i, line);
    } else {
      add('otherInvalid', i, line);
    }
  }

  closeRule();

  return { sites, counts, unmapped };
}

const CLASSES = [
  'c1_textAlignValue',
  'c2_bareSidePositioning',
  'c3_logicalRadius',
  'c4_backgroundPosition',
  'c5_classNameRename',
  'c6_triangleDegenerate',
];

// --- Configurations -------------------------------------------------------
//
// GROUP 1 -- the candidate GATE: the smallest set of compiles that tries to make
// every gated broken site emit at least once. Chosen from ticket 01's table:
// exactly the settings measured to ADMIT sites (count UP), nothing else.
const GATE_CONFIGS = [
  { id: 'A_defaults', pre: [] },
  {
    id: 'B_admit_all',
    pre: ['$buttongroup-radius-on-each: false;', '$global-flexbox: false;'],
  },
];

// GROUP 2 -- the ORACLE the gate is tested against: every activating setting
// individually, both multipliers at the extremes ticket 01 reached, the masking
// settings, and the kitchen sink. If GROUP 1's union already contains GROUP 2's
// union, the 2-compile gate is complete over sites.
const ORACLE_CONFIGS = [
  { id: 'buttongroup-radius-on-each=false', pre: ['$buttongroup-radius-on-each: false;'] },
  { id: 'global-flexbox=false', pre: ['$global-flexbox: false;'] },
  { id: 'xy-grid=false', pre: ['$xy-grid: false;'] },
  { id: 'dropdownmenu-arrows=false', pre: ['$dropdownmenu-arrows: false;'] },
  { id: 'drilldown-arrows=false', pre: ['$drilldown-arrows: false;'] },
  { id: 'accordion-plusminus=false', pre: ['$accordion-plusminus: false;'] },
  { id: 'accordionmenu-arrows=false', pre: ['$accordionmenu-arrows: false;'] },
  { id: 'select-triangle-color=transparent', pre: ['$select-triangle-color: transparent;'] },
  { id: 'menu-centered-back-compat=false', pre: ['$menu-centered-back-compat: false;'] },
  { id: 'buttongroup-expand-max=2', pre: ['$buttongroup-expand-max: 2;'] },
  { id: 'pagination-arrows=false', pre: ['$pagination-arrows: false;'] },
  { id: 'input-prefix-border=none', pre: ['$input-prefix-border: none;'] },
  { id: 'grid-column-align-edge=false', pre: ['$grid-column-align-edge: false;'] },
  { id: 'grid-column-count=24', pre: ['$grid-column-count: 24;'] },
  { id: 'grid-column-count=48', pre: ['$grid-column-count: 48;'] },
  { id: 'grid-column-count=6', pre: ['$grid-column-count: 6;'] },
  { id: 'breakpoints x1', pre: bpPre(1) },
  { id: 'breakpoints x5', pre: bpPre(5) },
  { id: 'breakpoints x12', pre: bpPre(12) },
  { id: 'MULTIPLIER EXTREME 48 cols x 12 bps', pre: [...bpPre(12), '$grid-column-count: 48;'] },
  {
    id: 'KITCHEN SINK (admit + extreme multipliers)',
    pre: [
      ...bpPre(12),
      '$grid-column-count: 48;',
      '$buttongroup-radius-on-each: false;',
      '$global-flexbox: false;',
    ],
  },
  {
    id: 'ALL MASKS ON (every masking setting at once)',
    pre: [
      '$dropdownmenu-arrows: false;',
      '$drilldown-arrows: false;',
      '$accordion-plusminus: false;',
      '$accordionmenu-arrows: false;',
      '$select-triangle-color: transparent;',
      ...bpPre(1),
    ],
  },
];

function unionOf(runs) {
  const u = Object.fromEntries(CLASSES.map((c) => [c, new Set()]));

  for (const r of runs) {
    for (const c of CLASSES) {
      for (const s of r.sites[c]) {
        u[c].add(s);
      }
    }
  }

  return u;
}

function run(configs, label) {
  const out = [];
  console.log(`\n=== ${label} ===`);

  for (const cfg of configs) {
    const { sites, counts, unmapped } = sitesFor(compile(cfg.pre));
    out.push({ id: cfg.id, sites, counts });
    const total = CLASSES.reduce((a, c) => a + counts[c], 0);
    console.log(
      `  ${cfg.id.padEnd(38)} defects=${String(total).padStart(5)}  distinctSites=${String(
        CLASSES.reduce((a, c) => a + sites[c].size, 0),
      ).padStart(3)}  ` +
        CLASSES.map((c) => `${c.slice(0, 2)}:${counts[c]}/${sites[c].size}`).join(' ') +
        (unmapped ? `  [WARN] unmapped=${unmapped}` : ''),
    );
  }

  return out;
}

const gateRuns = run(GATE_CONFIGS, 'GROUP 1 -- the candidate 2-compile gate');
const oracleRuns = run(ORACLE_CONFIGS, 'GROUP 2 -- the oracle (22 configurations)');

const gateUnion = unionOf(gateRuns);
const oracleUnion = unionOf([...gateRuns, ...oracleRuns]);

console.log('\n=== Q1. Does MAGNITUDE growth introduce NEW SOURCE SITES? ===');
const base = gateRuns.find((r) => r.id === 'A_defaults');
const extreme = oracleRuns.find((r) => r.id === 'MULTIPLIER EXTREME 48 cols x 12 bps');

for (const c of CLASSES) {
  const newSites = [...extreme.sites[c]].filter((s) => !base.sites[c].has(s));
  console.log(
    `  ${c.padEnd(24)} defaults ${String(base.counts[c]).padStart(4)} decls / ${String(
      base.sites[c].size,
    ).padStart(2)} sites   ->   48x12 ${String(extreme.counts[c]).padStart(4)} decls / ${String(
      extreme.sites[c].size,
    ).padStart(2)} sites   NEW SITES: ${newSites.length === 0 ? '[OK] none' : newSites.join(', ')}`,
  );
}

console.log('\n=== Q2. Is the 2-compile gate COMPLETE over source sites? ===');
let complete = true;

for (const c of CLASSES) {
  const missed = [...oracleUnion[c]].filter((s) => !gateUnion[c].has(s));

  if (missed.length > 0) {
    complete = false;
  }

  console.log(
    `  ${c.padEnd(24)} gate covers ${String(gateUnion[c].size).padStart(2)} of ${String(
      oracleUnion[c].size,
    ).padStart(2)} sites   ${missed.length === 0 ? '[OK] complete' : `[FAIL] missed: ${missed.join(', ')}`}`,
  );
}

console.log(
  `\n  VERDICT: the 2-compile gate is ${complete ? '[OK] COMPLETE' : '[FAIL] INCOMPLETE'} over every broken source site reached by 24 configurations.`,
);

console.log('\n=== Q3. The site inventory the gate must cover (union over all runs) ===');

for (const c of CLASSES) {
  console.log(`  ${c} (${oracleUnion[c].size} sites)`);

  for (const s of [...oracleUnion[c]].sort()) {
    console.log(`      ${s}`);
  }
}

console.log('\n=== Q4. Which compile of the gate is load-bearing for each class? ===');
const runA = gateRuns[0];
const runB = gateRuns[1];

for (const c of CLASSES) {
  const onlyB = [...runB.sites[c]].filter((s) => !runA.sites[c].has(s));
  const onlyA = [...runA.sites[c]].filter((s) => !runB.sites[c].has(s));
  console.log(
    `  ${c.padEnd(24)} A_defaults=${String(runA.sites[c].size).padStart(2)} sites  B_admit=${String(
      runB.sites[c].size,
    ).padStart(2)} sites   B-only=${onlyB.length}  A-only=${onlyA.length}` +
      (onlyB.length ? `   <- B is REQUIRED (${onlyB.join(', ')})` : '') +
      (onlyA.length ? `   <- A is REQUIRED (${onlyA.join(', ')})` : ''),
  );
}
