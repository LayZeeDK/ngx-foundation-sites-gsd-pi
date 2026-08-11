// Shared classifier for the six ticket-14 defect classes, over EMITTED CSS.
//
// Classes 1-4 are invalid-CSS classes (a validity oracle can see them).
// Class 5 (class-NAME interpolation) and class 6 (css-triangle degenerate)
// are VALID CSS -- they need structural detectors, which is why ticket 14 said
// no validity oracle catches them.
//
// Exported so every probe in this ticket counts the SAME way.

// Property NAMES that genuinely exist with an -inline-start/-inline-end infix.
// Verbatim from ticket 14's rtl-rebind-validity-probe.mjs.
export const LOGICAL_PROP_OK = new Set([
  'margin-inline-start',
  'margin-inline-end',
  'padding-inline-start',
  'padding-inline-end',
  'border-inline-start',
  'border-inline-end',
  'border-inline-start-width',
  'border-inline-end-width',
  'border-inline-start-color',
  'border-inline-end-color',
  'border-inline-start-style',
  'border-inline-end-style',
  'inset-inline-start',
  'inset-inline-end',
  'scroll-margin-inline-start',
  'scroll-margin-inline-end',
  'scroll-padding-inline-start',
  'scroll-padding-inline-end',
]);

// Properties that genuinely accept an inline-start/inline-end VALUE.
export const LOGICAL_VALUE_OK = new Set(['float', 'clear', 'caption-side', 'resize']);

const BARE_SIDE_RE = /^(inline-start|inline-end)$/;
const RADIUS_RE = /^border-(top|bottom)-inline-(start|end)-radius$/;

/// Split expanded CSS into flat rule blocks: { selector, decls: [[prop, value]] }.
/// The compiled output nests only inside @media / @supports, which we flatten by
/// ignoring at-rule headers that end in `{` without a `:` in them.
export function parseRules(css) {
  const rules = [];
  let i = 0;

  while (i < css.length) {
    const open = css.indexOf('{', i);

    if (open < 0) {
      break;
    }

    const header = css.slice(i, open).trim().replace(/^\}/, '').trim();

    if (header.startsWith('@media') || header.startsWith('@supports') || header.startsWith('@layer')) {
      i = open + 1;
      continue;
    }

    const close = css.indexOf('}', open);

    if (close < 0) {
      break;
    }

    const body = css.slice(open + 1, close);
    const decls = [];

    for (const raw of body.split(';')) {
      const line = raw.trim();

      if (!line) {
        continue;
      }

      const c = line.indexOf(':');

      if (c < 0) {
        continue;
      }

      decls.push([line.slice(0, c).trim(), line.slice(c + 1).trim()]);
    }

    rules.push({ selector: header, decls });
    i = close + 1;
  }

  return rules;
}

/// Count all six defect classes in one pass.
export function classifyCss(css) {
  const counts = {
    c1_textAlignValue: 0,
    c2_bareSidePositioning: 0,
    c3_logicalRadius: 0,
    c4_backgroundPosition: 0,
    c5_classNameRename: 0,
    c6_triangleDegenerate: 0,
    otherInvalidProp: 0,
    otherInvalidValue: 0,
    validLogical: 0,
  };
  const samples = {};

  function sample(k, s) {
    (samples[k] ??= new Set()).add(s);
  }

  const rules = parseRules(css);

  for (const rule of rules) {
    // --- class 5: selector contains an interpolated side in a CLASS NAME. ---
    // `.align-inline-start` is valid CSS matching nothing. Exclude attribute /
    // pseudo forms; Foundation's shape is always `.<name>-inline-(start|end)`.
    for (const m of rule.selector.matchAll(/\.[A-Za-z0-9_-]*-inline-(?:start|end)\b/g)) {
      counts.c5_classNameRename += 1;
      sample('c5', m[0]);
    }

    // --- class 6: css-triangle emitted with no direction branch taken. ---
    const props = new Set(rule.decls.map(([p]) => p));

    if (
      props.has('border-style') &&
      props.has('border-width') &&
      !props.has('border-color') &&
      !props.has('border-top-width') &&
      !props.has('border-bottom-width') &&
      !props.has('border-left-width') &&
      !props.has('border-right-width') &&
      !props.has('border-inline-start-width') &&
      !props.has('border-inline-end-width') &&
      rule.decls.some(([p, v]) => p === 'border-style' && v === 'solid')
    ) {
      counts.c6_triangleDegenerate += 1;
      sample('c6', rule.selector.split('\n').pop().trim());
    }

    for (const [prop, value] of rule.decls) {
      const propLogical = prop.includes('inline-start') || prop.includes('inline-end');
      const valueLogical = /\binline-(start|end)\b/.test(value);

      if (!propLogical && !valueLogical) {
        continue;
      }

      if (propLogical) {
        if (LOGICAL_PROP_OK.has(prop)) {
          counts.validLogical += 1;
        } else if (RADIUS_RE.test(prop)) {
          counts.c3_logicalRadius += 1;
          sample('c3', `${prop}: ${value}`);
        } else if (BARE_SIDE_RE.test(prop)) {
          counts.c2_bareSidePositioning += 1;
          sample('c2', `${prop}: ${value}`);
        } else {
          counts.otherInvalidProp += 1;
          sample('otherProp', `${prop}: ${value}`);
        }

        continue;
      }

      if (LOGICAL_VALUE_OK.has(prop)) {
        counts.validLogical += 1;
      } else if (prop === 'text-align') {
        counts.c1_textAlignValue += 1;
        sample('c1', `${prop}: ${value}`);
      } else if (prop === 'background-position') {
        counts.c4_backgroundPosition += 1;
        sample('c4', `${prop}: ${value}`);
      } else {
        counts.otherInvalidValue += 1;
        sample('otherValue', `${prop}: ${value}`);
      }
    }
  }

  counts.totalInvalidDecl =
    counts.c1_textAlignValue +
    counts.c2_bareSidePositioning +
    counts.c3_logicalRadius +
    counts.c4_backgroundPosition +
    counts.otherInvalidProp +
    counts.otherInvalidValue;

  return { counts, samples };
}

export function fmt(counts) {
  return [
    `invalid=${counts.totalInvalidDecl}`,
    `c1_textAlign=${counts.c1_textAlignValue}`,
    `c2_bareSide=${counts.c2_bareSidePositioning}`,
    `c3_radius=${counts.c3_logicalRadius}`,
    `c4_bgPos=${counts.c4_backgroundPosition}`,
    `c5_className=${counts.c5_classNameRename}`,
    `c6_triangle=${counts.c6_triangleDegenerate}`,
    `valid=${counts.validLogical}`,
  ].join(' ');
}
