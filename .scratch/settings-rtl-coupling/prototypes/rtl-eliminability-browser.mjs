// Ticket 02 -- browser-side verification of the eliminator, in real Chromium.
//
// Node's css-tree lexer is a good offline oracle but it is not the engine that
// ships. Five checks here, all against the engine that would actually drop a
// declaration in production:
//
//   1. CSSOM validity oracle -- setProperty + read-back per declaration.
//   2. Selector validity -- the `::after:dir(rtl)` shape the Sass `&` hook
//      produces, versus the `:dir(rtl)::after` shape the override layer builds.
//   3. Behaviour equivalence -- computed styles under the ELIMINATOR sheet in an
//      rtl subtree, versus Foundation's own RTL build. The dual-build reference.
//   4. Nested opposite-direction islands -- element-scoped vs descendant-scoped.
//   5. R008 -- unlayered consumer rule still beats @layer nfs-defaults even
//      though `:dir()` adds a pseudo-class of specificity.
//
// Read-only. Usage: node rtl-eliminability-browser.mjs

import { chromium } from 'playwright';

import {
  buildOverrideSheet,
  buildSingleSheet,
  compileFoundation,
  diffPasses,
  flatten,
  parseRules,
} from './rtl-eliminator.mjs';

const EVERYTHING = '@include foundation-everything();';
const SETTINGS = ['$global-flexbox: false;', '$buttongroup-radius-on-each: false;'];

const ltr = compileFoundation({ dir: 'ltr', settings: SETTINGS, include: EVERYTHING });
const rtl = compileFoundation({ dir: 'rtl', settings: SETTINGS, include: EVERYTHING });
const rebind = compileFoundation({
  rebindLeft: 'inline-start',
  rebindRight: 'inline-end',
  settings: SETTINGS,
  include: EVERYTHING,
});
// The cascade-preserving construction: `:where(:dir(rtl))` (zero specificity),
// interleaved right after the rule it overrides.
const built = buildSingleSheet(ltr, rtl);
const eliminator = built.css;

// The NAIVE construction, kept as a control -- the shape anyone would reach for
// first: the base sheet verbatim, then an override layer appended at the end,
// using plain `:dir(rtl)` and `revert-layer` to unset LTR-only declarations.
const naiveAppended = `${ltr}\n${buildOverrideSheet(diffPasses(flatten(parseRules(ltr)), flatten(parseRules(rtl)))).css}`;

// Markup exercising one site of each of the six defect classes.
const MARKUP = `
<table id="t"><thead><tr><th id="th">h</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table>
<div class="switch"><input class="switch-input" id="si" type="checkbox"><label class="switch-paddle" id="paddle" for="si"></label></div>
<div class="button-group" id="bg"><a class="button" id="b1">a</a><a class="button" id="b2">b</a><a class="button" id="b3">c</a></div>
<ul class="menu align-right" id="menu"><li id="mli"><a>x</a></li></ul>
<ul class="drilldown" id="dd"><li class="is-drilldown-submenu-parent" id="ddp"><a id="dda">y</a><ul class="menu"><li>z</li></ul></li></ul>
<select id="sel"><option>o</option></select>
<div class="input-group"><span class="input-group-label" id="igl">L</span><input class="input-group-field" type="text"></div>
`;

const PROBE_IDS = ['th', 'paddle', 'bg', 'b1', 'b3', 'menu', 'mli', 'ddp', 'dda', 'sel', 'igl'];

const browser = await chromium.launch();
const page = await browser.newPage();

function hr(t) {
  console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`);
}

// ===========================================================================
// 1. CSSOM validity oracle
// ===========================================================================

hr('1. CSSOM VALIDITY ORACLE (real Chromium: setProperty + read-back)');

await page.setContent('<!doctype html><html><body></body></html>');

async function cssomDrops(css, label) {
  const dropped = await page.evaluate((sheetText) => {
    const style = document.createElement('style');

    style.textContent = sheetText;
    document.head.append(style);

    const out = [];
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules) {
          walk(rule.cssRules);

          continue;
        }

        if (!rule.style) {
          continue;
        }

        // Chromium keeps only the declarations it accepted. Re-parse the
        // authored text of the rule is not available, so instead re-set each
        // authored declaration on a detached element and read it back.
        void rule;
      }
    };

    walk(style.sheet.cssRules);

    // Authoritative pass: feed every authored declaration through the engine.
    const probe = document.createElement('div');

    document.body.append(probe);

    const decls = sheetText.match(/[a-zA-Z-]+\s*:[^;{}]+;/g) ?? [];

    for (const decl of decls) {
      const colon = decl.indexOf(':');
      const prop = decl.slice(0, colon).trim();
      const value = decl.slice(colon + 1).replace(/;$/, '').trim();

      if (prop.startsWith('--') || /^(from|to|src|font-family|content)$/.test(prop)) {
        continue;
      }

      probe.style.cssText = '';
      probe.style.setProperty(prop, value);

      if (probe.style.getPropertyValue(prop) === '') {
        out.push(`${prop}: ${value}`);
      }
    }

    probe.remove();
    style.remove();

    return out;
  }, css);

  const counts = new Map();

  for (const d of dropped) {
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  console.log(`  ${label.padEnd(34)} declarations Chromium DROPS: ${dropped.length}`);

  for (const [k, n] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`      x${String(n).padStart(3)}  ${k}`);
  }

  return dropped.length;
}

const dropRebind = await cssomDrops(rebind, 'R004 rebind generalised');
const dropLtr = await cssomDrops(ltr, 'Foundation unmodified (LTR)');
const dropElim = await cssomDrops(eliminator, 'ELIMINATOR single sheet');

// ===========================================================================
// 2. Selector validity
// ===========================================================================

hr('2. SELECTOR VALIDITY -- where the :dir() goes inside a compound');

const selectorResults = await page.evaluate(() => {
  const cases = [
    '.x::after:dir(rtl)',
    '.x:dir(rtl)::after',
    '.x:dir(rtl)',
    '.menu.align-right li:dir(rtl)',
  ];
  const style = document.createElement('style');

  style.textContent = cases.map((s) => `${s} { color: red; }`).join('\n');
  document.head.append(style);

  const kept = [...style.sheet.cssRules].map((r) => r.selectorText);

  style.remove();

  return cases.map((s) => ({ selector: s, parsed: kept.some((k) => k.replace(/\s+/g, '') === s.replace(/\s+/g, '')) }));
});

for (const r of selectorResults) {
  console.log(`  ${r.parsed ? '[OK]  ' : '[WARN]'} ${r.selector}${r.parsed ? '' : '   <- Chromium DROPS the whole rule'}`);
}

// ===========================================================================
// 3. Behaviour equivalence vs the dual-build reference
// ===========================================================================

hr('3. BEHAVIOUR -- eliminator in an rtl subtree vs Foundation\'s own RTL build');

async function computedFor(css, dir) {
  await page.setContent(
    `<!doctype html><html dir="ltr"><head><style>${css}</style></head><body><div dir="${dir}" id="root">${MARKUP}</div></body></html>`,
  );

  return page.evaluate((ids) => {
    const snap = {};

    for (const id of ids) {
      const el = document.getElementById(id);

      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        const bag = {};

        for (const p of cs) {
          bag[p] = cs.getPropertyValue(p);
        }

        snap[`${id}${pseudo ?? ''}`] = bag;
      }
    }

    return snap;
  }, PROBE_IDS);
}

const gotRtl = await computedFor(eliminator, 'rtl');
const wantRtl = await computedFor(rtl, 'rtl');
const gotLtr = await computedFor(eliminator, 'ltr');
const wantLtr = await computedFor(ltr, 'ltr');

function compare(got, want, label) {
  const diffs = [];

  for (const key of Object.keys(want)) {
    for (const prop of Object.keys(want[key])) {
      if (got[key][prop] !== want[key][prop]) {
        diffs.push(`${key} { ${prop}: got ${got[key][prop]} | want ${want[key][prop]} }`);
      }
    }
  }

  console.log(`  ${label.padEnd(52)} ${diffs.length === 0 ? '[OK] IDENTICAL' : `[WARN] ${diffs.length} differing computed values`}`);

  for (const d of diffs.slice(0, 12)) {
    console.log(`      ${d}`);
  }

  return diffs;
}

const rtlDiffs = compare(gotRtl, wantRtl, 'rtl subtree vs Foundation RTL build');
const ltrDiffs = compare(gotLtr, wantLtr, 'ltr subtree vs Foundation LTR build');

console.log('\n  CONTROL -- the naive construction (:dir() adds specificity, layer appended):');
const naiveDiffs = compare(await computedFor(naiveAppended, 'rtl'), wantRtl, 'naive rtl subtree vs Foundation RTL build');

// And the shipped Rtl story's shape: both directions in ONE document.
await page.setContent(
  `<!doctype html><html dir="ltr"><head><style>${eliminator}</style></head><body>` +
    `<div dir="ltr" id="A">${MARKUP}</div><div dir="rtl" id="B">${MARKUP}</div></body></html>`,
);

const sideBySide = await page.evaluate(() => {
  const q = (root, sel) => document.querySelector(`#${root} ${sel}`);
  const pick = (el, ps) => {
    const cs = getComputedStyle(el, ps ?? null);

    return {
      textAlign: cs.textAlign,
      marginLeft: cs.marginLeft,
      marginRight: cs.marginRight,
      borderTopLeftRadius: cs.borderTopLeftRadius,
      borderTopRightRadius: cs.borderTopRightRadius,
      backgroundPosition: cs.backgroundPosition,
      borderLeftWidth: cs.borderLeftWidth,
      borderRightWidth: cs.borderRightWidth,
      left: cs.left,
      right: cs.right,
    };
  };

  return {
    thA: pick(q('A', 'th')),
    thB: pick(q('B', 'th')),
    b1A: pick(q('A', '.button-group .button:first-child')),
    b1B: pick(q('B', '.button-group .button:first-child')),
    selA: pick(q('A', 'select')),
    selB: pick(q('B', 'select')),
    ddA: pick(q('A', '.is-drilldown-submenu-parent > a'), '::after'),
    ddB: pick(q('B', '.is-drilldown-submenu-parent > a'), '::after'),
    menuA: pick(q('A', '.menu.align-right')),
    menuB: pick(q('B', '.menu.align-right')),
    paddleA: pick(q('A', '.switch-paddle'), '::after'),
    paddleB: pick(q('B', '.switch-paddle'), '::after'),
  };
});

console.log('\n  SIDE BY SIDE in ONE document (the shape the shipped `Rtl` story needs):');

for (const k of ['th', 'b1', 'sel', 'dd', 'menu', 'paddle']) {
  const a = sideBySide[`${k}A`];
  const b = sideBySide[`${k}B`];
  const changed = Object.keys(a).filter((p) => a[p] !== b[p]);

  console.log(`    ${k.padEnd(7)} mirrors on: ${changed.map((p) => `${p} ${a[p]} -> ${b[p]}`).join(' | ') || '(nothing)'}`);
}

// ===========================================================================
// 4. Nested opposite-direction islands
// ===========================================================================

hr('4. NESTED OPPOSITE-DIRECTION ISLAND -- element-scoped vs descendant-scoped');

const nested = await page.evaluate(() => {
  document.head.innerHTML = '';
  document.body.innerHTML =
    '<div dir="rtl"><div dir="ltr"><p class="probe" id="inner">x</p></div></div>' +
    '<div dir="rtl"><p class="probe" id="outer">y</p></div>';

  const style = document.createElement('style');

  style.textContent = [
    '.probe { margin-left: 10px; margin-right: 0px; }',
    // element-scoped -- the shape the override layer emits
    '.probe:dir(rtl) { margin-left: 0px; margin-right: 20px; }',
    // descendant-scoped -- the shape a Sass `:dir(rtl) { @include ... }` wrapper
    // would be forced to emit, because Sass cannot rewrite generated selectors
    ':dir(rtl) .probe { padding-left: 0px; padding-right: 30px; }',
    '.probe { padding-left: 5px; padding-right: 0px; }',
  ].join('\n');
  document.head.append(style);

  const read = (id) => {
    const cs = getComputedStyle(document.getElementById(id));

    return {
      elementScoped: `${cs.marginLeft}/${cs.marginRight}`,
      descendantScoped: `${cs.paddingLeft}/${cs.paddingRight}`,
    };
  };

  return { inner: read('inner'), outer: read('outer') };
});

console.log(`  ltr island inside an rtl region  element-scoped: ${nested.inner.elementScoped}  descendant-scoped: ${nested.inner.descendantScoped}`);
console.log(`  plain rtl region                 element-scoped: ${nested.outer.elementScoped}  descendant-scoped: ${nested.outer.descendantScoped}`);
console.log('  expected for the ltr island: the LTR base (10px/0px, 5px/0px) must survive.');
console.log(
  `  element-scoped correct: ${nested.inner.elementScoped === '10px/0px'}   descendant-scoped correct: ${nested.inner.descendantScoped === '5px/0px'}`,
);

// ===========================================================================
// 5. R008 -- does :dir() specificity disturb unlayered-beats-@layer?
// ===========================================================================

hr('5. R008 -- unlayered consumer rule vs @layer nfs-defaults + :dir()');

const r008 = await page.evaluate(() => {
  const run = (sheet) => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<div dir="rtl"><p class="btn" id="p">x</p></div>';

    const style = document.createElement('style');

    style.textContent = sheet;
    document.head.append(style);

    const cs = getComputedStyle(document.getElementById('p'));

    return { marginLeft: cs.marginLeft, marginRight: cs.marginRight };
  };

  return {
    // consumer rule authored BEFORE the layer, lower specificity, unlayered
    consumerFirst: run(
      '.btn { margin-right: 99px; }\n' +
        '@layer nfs-defaults { .btn { margin-right: 1px; } .btn:dir(rtl) { margin-right: 2px; margin-left: 3px; } }',
    ),
    // consumer rule authored AFTER the layer
    consumerLast: run(
      '@layer nfs-defaults { .btn { margin-right: 1px; } .btn:dir(rtl) { margin-right: 2px; margin-left: 3px; } }\n' +
        '.btn { margin-right: 99px; }',
    ),
    // revert-layer inside the layer: does it fall back past the layer only?
    revertLayer: run(
      '.btn { margin-left: 77px; }\n' +
        '@layer nfs-defaults { .btn { margin-left: 3px; } .btn:dir(rtl) { margin-left: revert-layer; } }',
    ),
    // revert-layer with NO consumer rule: falls back to the initial value
    revertLayerBare: run('@layer nfs-defaults { .btn { margin-left: 3px; } .btn:dir(rtl) { margin-left: revert-layer; } }'),
    // the danger case: revert-layer in an UNLAYERED sheet
    revertLayerUnlayered: run('.btn { margin-left: 77px; }\n.btn { margin-left: 3px; }\n.btn:dir(rtl) { margin-left: revert-layer; }'),
  };
});

console.log(`  consumer rule authored FIRST, unlayered:  margin-right = ${r008.consumerFirst.marginRight}  (want 99px)`);
console.log(`  consumer rule authored LAST,  unlayered:  margin-right = ${r008.consumerLast.marginRight}   (want 99px)`);
console.log(`  layered :dir() override still applies:    margin-left  = ${r008.consumerFirst.marginLeft}    (want 3px)`);
console.log(`  revert-layer inside the layer:            margin-left  = ${r008.revertLayer.marginLeft}   (want 77px -- consumer value restored)`);
console.log(`  revert-layer, no consumer rule:           margin-left  = ${r008.revertLayerBare.marginLeft}    (want 0px -- initial)`);
console.log(`  revert-layer in an UNLAYERED sheet:       margin-left  = ${r008.revertLayerUnlayered.marginLeft}    (rolls back to the UA origin, NOT to 77px)`);

// ===========================================================================
// 6. Graceful degradation on a browser that does not know :dir()
// ===========================================================================

hr('6. DEGRADATION -- is `:where()` forgiving, so an unknown :dir() costs nothing?');

const forgiving = await page.evaluate(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '<p class="probe" id="p">x</p>';

  const style = document.createElement('style');

  // `:nfs-not-a-real-pseudo` stands in for `:dir()` on a browser that predates
  // it. The question is what happens to the REST of the rule.
  style.textContent = [
    '.probe { margin-left: 1px; }',
    '.probe:where(:nfs-not-a-real-pseudo) { margin-left: 2px; }',
    '.probe:nfs-not-a-real-pseudo { margin-left: 3px; }',
    '.probe { padding-left: 1px; }',
  ].join('\n');
  document.head.append(style);

  const kept = [...style.sheet.cssRules].map((r) => r.selectorText);
  const cs = getComputedStyle(document.getElementById('p'));

  return { kept, marginLeft: cs.marginLeft, paddingLeft: cs.paddingLeft };
});

console.log(`  rules Chromium kept: ${JSON.stringify(forgiving.kept)}`);
console.log(`  computed margin-left: ${forgiving.marginLeft} (want 1px -- the base survives, the twin matches nothing)`);
console.log(`  computed padding-left: ${forgiving.paddingLeft} (want 1px -- a later rule is unaffected either way)`);

// Simulate chrome/edge 119 (the 2 pinned baseline targets without `:dir()`) by
// renaming the pseudo-class to one no engine knows. `:where()` stays forgiving,
// so the rules survive -- but they match nothing.
const simulated = eliminator.replaceAll(':dir(ltr)', ':nfs-dir-unsupported(ltr)').replaceAll(':dir(rtl)', ':nfs-dir-unsupported(rtl)');
const degradedLtr = await computedFor(simulated, 'ltr');
const degradedRtl = await computedFor(simulated, 'rtl');

console.log('\n  SIMULATED :dir()-less engine, split-twin sheet:');
const degLtrDiffs = compare(degradedLtr, wantLtr, 'ltr subtree vs Foundation LTR build');
const baselineRtlSubtree = await computedFor(ltr, 'rtl');
const degRtlDiffs = compare(degradedRtl, baselineRtlSubtree, 'rtl subtree vs TODAY (Foundation LTR sheet, rtl subtree)');

// The GRACEFUL variant: the LTR values stay in the base rule, only an RTL twin
// is added. Degrades to pure LTR on a :dir()-less engine -- at the cost of not
// being able to express "this declaration is ABSENT in RTL".
const graceful = buildSingleSheet(ltr, rtl, { keepLtrInBase: true }).css;
const gracefulSim = graceful.replaceAll(':dir(rtl)', ':nfs-dir-unsupported(rtl)');

console.log('\n  GRACEFUL variant (LTR values stay in the base rule):');
const gracefulExactness = compare(await computedFor(graceful, 'rtl'), wantRtl, 'rtl subtree vs Foundation RTL build (exactness)');
const gracefulDegraded = compare(await computedFor(gracefulSim, 'rtl'), baselineRtlSubtree, 'on a :dir()-less engine, vs TODAY (Foundation LTR sheet)');

// ===========================================================================

hr('SUMMARY');
console.log(`  Chromium-dropped declarations -- rebind: ${dropRebind} | Foundation: ${dropLtr} | ELIMINATOR: ${dropElim}`);
console.log(`  computed-style diffs vs the dual build -- rtl: ${rtlDiffs.length} | ltr: ${ltrDiffs.length} | naive control: ${naiveDiffs.length}`);

await browser.close();
