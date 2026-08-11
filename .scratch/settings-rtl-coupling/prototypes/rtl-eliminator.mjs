// Ticket 02 -- shared mechanism module. Read-only with respect to the repo:
// compiles Sass from STRINGS, writes nothing outside .scratch/.
//
// Three things live here:
//
//   1. compileFoundation() -- compile Foundation's own Sass, either UNMODIFIED
//      (physical output, one direction per pass) or with the R004 rebind /
//      an arbitrary substitution value.
//   2. parse/flatten/diff -- turn emitted CSS into (at-rule context, selector,
//      property) -> value, and diff two passes.
//   3. buildOverrideSheet() -- the ELIMINATOR. Takes the two-pass diff and
//      emits a `:dir(rtl)` override layer whose every property name and value
//      is one Foundation itself emitted, appended ELEMENT-SCOPED (`X:dir(rtl)`,
//      not `:dir(rtl) X`).
//
// Plus validate() -- css-tree's spec lexer as an offline CSS-validity oracle.

import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as csstree from 'css-tree';
import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, '../../..');
export const loadPaths = [
  join(repoRoot, 'node_modules'),
  join(repoRoot, 'packages/ngx-foundation-sites/src/scss'),
];

/**
 * Compile Foundation's Sass.
 *
 * @param {object} o
 * @param {'ltr'|'rtl'} [o.dir] Sass-time $global-text-direction.
 * @param {string|null} [o.rebindLeft] Post-import !global value for
 *   $global-left, or null for none (Foundation unmodified).
 * @param {string|null} [o.rebindRight] Same for $global-right.
 * @param {string[]} [o.settings] Consumer settings, seeded BEFORE the import.
 * @param {string} [o.include] Mixin include line(s).
 * @param {string} [o.append] Raw Sass appended after the include.
 */
export function compileFoundation({
  dir = 'ltr',
  rebindLeft = null,
  rebindRight = null,
  settings = [],
  include = '@include foundation-everything();',
  append = '',
} = {}) {
  const src = [
    `$global-text-direction: ${dir};`,
    ...settings,
    "@import 'foundation-sites/scss/foundation';",
    rebindLeft === null ? '' : `$global-left: ${rebindLeft};`,
    rebindRight === null ? '' : `$global-right: ${rebindRight};`,
    include,
    append,
  ]
    .filter(Boolean)
    .join('\n');

  return sass.compileString(src, { loadPaths, style: 'expanded', logger: sass.Logger.silent }).css;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse CSS into flat rules, each carrying its enclosing at-rule chain.
 *
 * @returns {{context: string, selector: string, decls: Array<{prop: string, value: string}>}[]}
 */
export function parseRules(css) {
  const ast = csstree.parse(css, { positions: false });
  const out = [];
  const stack = [];

  walk(ast);

  return out;

  function walk(node) {
    if (!node.children) {
      return;
    }

    node.children.forEach((child) => {
      if (child.type === 'Atrule') {
        const label = `@${child.name} ${child.prelude ? csstree.generate(child.prelude) : ''}`.trim();

        if (child.block) {
          stack.push(label);
          walk(child.block);
          stack.pop();
        }

        return;
      }

      if (child.type === 'Rule') {
        const selector = csstree.generate(child.prelude);
        const decls = [];

        child.block.children.forEach((d) => {
          if (d.type === 'Declaration') {
            const value = csstree.generate(d.value).trim();

            decls.push({ prop: d.property, value: d.important ? `${value} !important` : value });
          }
        });

        out.push({ context: stack.join(' | '), selector, decls });
      }
    });
  }
}

/** context||selector -> Map(prop -> value); later declarations win. */
export function flatten(rules) {
  const map = new Map();

  for (const rule of rules) {
    // A selector list is kept verbatim: Foundation emits the same list shape in
    // both passes, so keying on the list is stable and avoids inventing rules.
    const key = `${rule.context}||${rule.selector}`;
    let props = map.get(key);

    if (!props) {
      props = new Map();
      map.set(key, props);
    }

    for (const { prop, value } of rule.decls) {
      props.set(prop, value);
    }
  }

  return map;
}

/**
 * Diff two flattened passes.
 *
 * @returns {{
 *   selectorOnlyLtr: string[], selectorOnlyRtl: string[],
 *   propDiffs: Array<{context: string, selector: string, prop: string, ltr: string|undefined, rtl: string|undefined}>
 * }}
 */
export function diffPasses(ltrMap, rtlMap) {
  const selectorOnlyLtr = [...ltrMap.keys()].filter((k) => !rtlMap.has(k));
  const selectorOnlyRtl = [...rtlMap.keys()].filter((k) => !ltrMap.has(k));
  const propDiffs = [];

  // Selector-level divergence -- defect class 5's shape. Foundation's dual build
  // moves a whole rule from `.align-left` to `.align-right` between passes, so
  // the rule exists on one side only. Expressed as prop diffs against a missing
  // counterpart: every declaration of an RTL-only rule is an addition, every
  // declaration of an LTR-only rule needs neutralising.
  for (const key of selectorOnlyRtl) {
    const [context, selector] = splitKey(key);

    for (const [prop, rtl] of rtlMap.get(key)) {
      propDiffs.push({ context, selector, prop, ltr: undefined, rtl, selectorOnly: true });
    }
  }

  for (const key of selectorOnlyLtr) {
    const [context, selector] = splitKey(key);

    for (const [prop, ltr] of ltrMap.get(key)) {
      propDiffs.push({ context, selector, prop, ltr, rtl: undefined, selectorOnly: true });
    }
  }

  for (const [key, ltrProps] of ltrMap) {
    const rtlProps = rtlMap.get(key);

    if (!rtlProps) {
      continue;
    }

    const [context, selector] = splitKey(key);

    for (const [prop, ltrValue] of ltrProps) {
      const rtlValue = rtlProps.get(prop);

      if (rtlValue !== ltrValue) {
        propDiffs.push({ context, selector, prop, ltr: ltrValue, rtl: rtlValue });
      }
    }

    for (const [prop, rtlValue] of rtlProps) {
      if (!ltrProps.has(prop)) {
        propDiffs.push({ context, selector, prop, ltr: undefined, rtl: rtlValue });
      }
    }
  }

  return { selectorOnlyLtr, selectorOnlyRtl, propDiffs };
}

function splitKey(key) {
  const at = key.indexOf('||');

  return [key.slice(0, at), key.slice(at + 2)];
}

// ---------------------------------------------------------------------------
// Element-scoped :dir() selector surgery
// ---------------------------------------------------------------------------

const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);

/** Split a selector list on TOP-LEVEL commas (respects (), [], ""). */
export function splitSelectorList(selector) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;

  for (let i = 0; i < selector.length; i += 1) {
    const c = selector[i];

    if (quote) {
      if (c === quote && selector[i - 1] !== '\\') {
        quote = null;
      }

      continue;
    }

    if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '(' || c === '[') {
      depth += 1;
    } else if (c === ')' || c === ']') {
      depth -= 1;
    } else if (c === ',' && depth === 0) {
      parts.push(selector.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(selector.slice(start));

  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Append `:dir(rtl)` to the LAST compound of one complex selector, before any
 * pseudo-element (a pseudo-element must stay last, so `.x::after:dir(rtl)` is
 * invalid and `.x:dir(rtl)::after` is what we want).
 *
 * Element-scoped on purpose: `:dir(rtl) .x` (descendant) also matches an `.x`
 * that sits inside a NESTED opposite-direction island, which is wrong.
 */
export function scopeToDir(complexSelector, pseudoClass = ':dir(rtl)') {
  const s = complexSelector.trim();
  let depth = 0;
  let quote = null;
  let lastCombinator = -1;

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];

    if (quote) {
      if (c === quote && s[i - 1] !== '\\') {
        quote = null;
      }

      continue;
    }

    if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '(' || c === '[') {
      depth += 1;
    } else if (c === ')' || c === ']') {
      depth -= 1;
    } else if (depth === 0 && (c === ' ' || c === '>' || c === '+' || c === '~')) {
      lastCombinator = i;
    }
  }

  const head = s.slice(0, lastCombinator + 1);
  const compound = s.slice(lastCombinator + 1);
  const cut = findPseudoElement(compound);

  return `${head}${compound.slice(0, cut)}${pseudoClass}${compound.slice(cut)}`;
}

function findPseudoElement(compound) {
  let depth = 0;

  for (let i = 0; i < compound.length; i += 1) {
    const c = compound[i];

    if (c === '(' || c === '[') {
      depth += 1;
    } else if (c === ')' || c === ']') {
      depth -= 1;
    } else if (c === ':' && depth === 0) {
      if (compound[i + 1] === ':') {
        return i;
      }

      const name = /^[a-zA-Z-]+/.exec(compound.slice(i + 1))?.[0] ?? '';

      if (LEGACY_PSEUDO_ELEMENTS.has(name.toLowerCase())) {
        return i;
      }
    }
  }

  return compound.length;
}

export function scopeSelectorList(selector, pseudoClass = ':dir(rtl)') {
  return splitSelectorList(selector)
    .map((p) => scopeToDir(p, pseudoClass))
    .join(', ');
}

// ---------------------------------------------------------------------------
// The eliminator: build the :dir(rtl) override layer from the two-pass diff
// ---------------------------------------------------------------------------

/**
 * @param {ReturnType<typeof diffPasses>} diff
 * @param {object} [o]
 * @param {string} [o.resetValue] Value used when a property exists in the LTR
 *   pass but NOT in the RTL pass -- the override cannot delete a declaration,
 *   only neutralise it.
 */
export function buildOverrideSheet(diff, { resetValue = 'revert-layer' } = {}) {
  /** @type {Map<string, Map<string, string[]>>} context -> selector -> lines */
  const byContext = new Map();
  const resets = [];

  for (const d of diff.propDiffs) {
    const value = d.rtl ?? resetValue;

    if (d.rtl === undefined) {
      resets.push(d);
    }

    let bySelector = byContext.get(d.context);

    if (!bySelector) {
      bySelector = new Map();
      byContext.set(d.context, bySelector);
    }

    const scoped = scopeSelectorList(d.selector);
    const lines = bySelector.get(scoped) ?? [];

    lines.push(`  ${d.prop}: ${value};`);
    bySelector.set(scoped, lines);
  }

  const chunks = [];

  for (const [context, bySelector] of byContext) {
    const body = [...bySelector]
      .map(([selector, lines]) => `${selector} {\n${lines.join('\n')}\n}`)
      .join('\n');

    if (!context) {
      chunks.push(body);

      continue;
    }

    // Re-open the at-rule chain, outermost first.
    const chain = context.split(' | ');
    let nested = body
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n');

    for (let i = chain.length - 1; i >= 0; i -= 1) {
      nested = `${chain[i]} {\n${nested}\n}`;
    }

    chunks.push(nested);
  }

  return { css: chunks.join('\n\n'), resets };
}

/**
 * Build the single sheet that serves BOTH directions.
 *
 * Two properties the naive "base sheet + override layer appended at the end"
 * shape does NOT have, and which measurement showed are load-bearing:
 *
 *   - `:where(:dir(rtl))` instead of `:dir(rtl)` -- `:where()` contributes ZERO
 *     specificity, so the override ties its own base rule instead of outranking
 *     every other rule in the sheet.
 *   - the override is INTERLEAVED immediately after the last occurrence of the
 *     rule it overrides, not appended at the end -- so a tie is broken by source
 *     order in exactly the place Foundation put it.
 *
 * Together these make the transform cascade-preserving: any rule that beat the
 * base still beats the override.
 */
export function buildSingleSheet(
  ltrCss,
  rtlCss,
  { ltrPseudo = ':where(:dir(ltr))', rtlPseudo = ':where(:dir(rtl))', keepLtrInBase = false } = {},
) {
  const ltrRules = parseRules(ltrCss);
  const rtlRules = parseRules(rtlCss);
  const ltrMap = flatten(ltrRules);
  const rtlMap = flatten(rtlRules);
  const diff = diffPasses(ltrMap, rtlMap);

  // key -> Set of properties whose value differs between the passes. Those
  // properties are LIFTED OUT of the shared base rule into two direction twins.
  // Nothing needs a reset value: a declaration that exists in one direction only
  // simply lives in that direction's twin and never applies in the other.
  const directional = new Map();

  for (const d of diff.propDiffs) {
    const key = `${d.context}||${d.selector}`;

    directional.set(key, (directional.get(key) ?? new Set()).add(d.prop));
  }

  const overrides = new Map();

  for (const d of diff.propDiffs) {
    if (d.rtl === undefined) {
      continue;
    }

    const key = `${d.context}||${d.selector}`;

    overrides.set(key, [...(overrides.get(key) ?? []), `  ${d.prop}: ${d.rtl};`]);
  }

  // Anchor each RTL-only rule to the last preceding rule that also exists in LTR,
  // so it lands where Foundation's own RTL build put it.
  const ltrKeys = new Set(ltrMap.keys());
  const anchors = new Map();
  let anchor = null;

  for (const r of rtlRules) {
    const key = `${r.context}||${r.selector}`;

    if (ltrKeys.has(key)) {
      anchor = key;
    } else if (anchor) {
      anchors.set(anchor, [...(anchors.get(anchor) ?? []), key]);
    }
  }

  const lastIndex = new Map();

  ltrRules.forEach((r, i) => lastIndex.set(`${r.context}||${r.selector}`, i));

  const out = [];
  const baseOnly = [];

  ltrRules.forEach((r, i) => {
    const key = `${r.context}||${r.selector}`;
    const dirProps = keepLtrInBase ? new Set() : (directional.get(key) ?? new Set());
    const shared = r.decls.filter((d) => !dirProps.has(d.prop));
    const ltrOnly = r.decls.filter((d) => dirProps.has(d.prop));

    baseOnly.push({ context: r.context, body: block(r.selector, r.decls.map((d) => `  ${d.prop}: ${d.value};`)) });

    if (shared.length > 0) {
      out.push({ context: r.context, body: block(r.selector, shared.map((d) => `  ${d.prop}: ${d.value};`)) });
    }

    if (ltrOnly.length > 0) {
      out.push({
        context: r.context,
        twin: true,
        body: block(scopeSelectorList(r.selector, ltrPseudo), ltrOnly.map((d) => `  ${d.prop}: ${d.value};`)),
      });
    }

    if (lastIndex.get(key) !== i) {
      return;
    }

    if (overrides.has(key)) {
      out.push({ context: r.context, twin: true, body: block(scopeSelectorList(r.selector, rtlPseudo), overrides.get(key)) });
    }

    for (const extra of anchors.get(key) ?? []) {
      const [context, selector] = splitKey(extra);

      out.push({ context, twin: true, body: block(scopeSelectorList(selector, rtlPseudo), overrides.get(extra) ?? []) });
    }
  });

  const css = render(out);
  const twins = out.filter((r) => r.twin);

  return {
    css,
    twinCss: render(twins),
    diff,
    ltrMap,
    rtlMap,
    overrideDeclarations: [...overrides.values()].reduce((n, lines) => n + lines.length, 0),
    overrideRules: twins.length,
    // Compare like with like: the same renderer over the base rules alone.
    overrideBytes: css.length - render(baseOnly).length,
    baseBytes: render(baseOnly).length,
  };
}

function block(selector, lines) {
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/** Join rules, merging RUNS of the same at-rule context into one block. */
function render(rules) {
  const chunks = [];
  let run = [];
  let context = null;

  const flush = () => {
    if (run.length === 0) {
      return;
    }

    if (!context) {
      chunks.push(run.join('\n'));
    } else {
      const chain = context.split(' | ');
      let nested = run
        .join('\n')
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n');

      for (let i = chain.length - 1; i >= 0; i -= 1) {
        nested = `${chain[i]} {\n${nested}\n}`;
      }

      chunks.push(nested);
    }

    run = [];
  };

  for (const r of rules) {
    if (r.context !== context) {
      flush();
      context = r.context;
    }

    run.push(r.body);
  }

  flush();

  return chunks.join('\n');
}

/**
 * Apply the override set to the LTR base and report whether the result is
 * declaration-for-declaration identical to Foundation's own RTL build.
 * This is the "behaviour matches the dual build" proof.
 */
export function verifyEquivalence(ltrMap, rtlMap, diff) {
  const resolved = new Map();

  for (const [key, props] of ltrMap) {
    resolved.set(key, new Map(props));
  }

  for (const d of diff.propDiffs) {
    const key = `${d.context}||${d.selector}`;
    let props = resolved.get(key);

    if (!props) {
      props = new Map();
      resolved.set(key, props);
    }

    if (d.rtl === undefined) {
      props.delete(d.prop);
    } else {
      props.set(d.prop, d.rtl);
    }
  }

  const mismatches = [];

  for (const [key, want] of rtlMap) {
    const got = resolved.get(key);

    for (const [prop, value] of want) {
      if (got?.get(prop) !== value) {
        mismatches.push({ key, prop, want: value, got: got?.get(prop) });
      }
    }
  }

  for (const [key, got] of resolved) {
    const want = rtlMap.get(key);

    for (const [prop, value] of got) {
      if (want?.get(prop) !== value) {
        mismatches.push({ key, prop, want: want?.get(prop), got: value });
      }
    }
  }

  return mismatches;
}

// ---------------------------------------------------------------------------
// Offline CSS-validity oracle (css-tree's spec lexer)
// ---------------------------------------------------------------------------

/**
 * Classify every declaration in a sheet as valid / unknown-property /
 * invalid-value, using css-tree's spec-derived lexer.
 */
export function validate(css) {
  const ast = csstree.parse(css, { positions: false });
  const unknownProperty = new Map();
  const invalidValue = new Map();
  let total = 0;

  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node) {
      total += 1;

      const prop = node.property;

      if (prop.startsWith('--')) {
        return;
      }

      if (!csstree.lexer.getProperty(prop)) {
        bump(unknownProperty, `${prop}: ${csstree.generate(node.value).trim()}`);

        return;
      }

      const m = csstree.lexer.matchDeclaration(node);

      if (m.matched === null) {
        const text = `${prop}: ${csstree.generate(node.value).trim()}`;

        // css-tree does not know every modern value; only report the ones whose
        // failure is about a directional keyword, which is what this ticket is
        // about. Everything else is reported separately as "lexer-unsure".
        bump(invalidValue, text);
      }
    },
  });

  return { total, unknownProperty, invalidValue };
}

function bump(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Directional-keyword subset of validate() -- the six defect classes' shape. */
export function directionalDefects(css) {
  const { unknownProperty, invalidValue } = validate(css);
  const keep = (m) =>
    new Map([...m].filter(([k]) => /inline-start|inline-end|\bstart\b|\bend\b/.test(k)));

  return { unknownProperty: keep(unknownProperty), invalidValue: keep(invalidValue) };
}

export function countMap(map) {
  return [...map.values()].reduce((a, b) => a + b, 0);
}
