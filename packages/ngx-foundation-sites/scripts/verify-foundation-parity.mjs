// D017 parity gate: NfsButton's compiled stylesheet against Foundation for
// Sites' OWN compiled button CSS, compared DECLARATION BY DECLARATION.
//
// Replaces the retired `src/scss/verify-parity.mjs`, which compared the
// SELECTORS of `nfs-button.styles.ts` (the deleted CSS-in-JS source) against
// the precompiled bundle. That contract was structurally blind: ticket 08
// found `.button.hollow` shipping the solid primary fill -- the SCSS included
// `button-hollow-style` (border and text colour) but never `button-hollow`
// (`background-color: transparent`) -- and a selector-level check stayed green
// because the SELECTOR existed. Comparing values is the only way to see it.
//
// Two traps this script is built around:
//
// * Ticket 01 -- never compare CSS TEXT. `SharedStylesHost` passes styles
//   through verbatim but the BUILD does not: dev reformats and prepends an
//   `angular:styles/component:css` marker comment, production minifies
//   (`rgb(9, 8, 7)` -> `#090807`). So both sides are compiled here with the
//   same Sass and compared as PARSED declarations -- Sass output against Sass
//   output, never against a shipped bundle.
// * Ticket 14 -- Foundation's hand-rolled `pow()` does not converge for small
//   inputs, so its contrast RATIOS are implementation-specific while its
//   PICKS are stable. Nothing here asserts a ratio; the contrast-picked text
//   colours are compared as picked VALUES, which is what the shared-selector
//   `color` declarations below already do.
//
// ponytail: the reference is stock Foundation with no seeding at all. That is
// the strongest available form of the check -- it proves `internal/_settings.scss`
// really does mirror Foundation's defaults -- and it needs no fixture to drift.
import postcss from 'postcss';
import * as sass from 'sass';

const COMPONENT_STYLESHEET =
  'packages/ngx-foundation-sites/src/lib/nfs-button/nfs-button.scss';
const LOAD_PATHS = ['packages/ngx-foundation-sites/src/scss', 'node_modules'];

// Foundation's own zero-config button output, plus one probe rule that
// re-derives the `auto` hover colour using Foundation's own `scale-color` and
// its own `$button-background-hover-lightness`. The probe exists so the one
// intentional hover deviation below can be expressed as "Foundation's own
// computation" instead of a pinned literal that a Sass upgrade would rot.
const AUTO_HOVER_PROBE_SELECTOR = '.nfs-auto-hover-probe';
const FOUNDATION_REFERENCE = [
  "@import 'foundation-sites/scss/util/util';",
  "@import 'foundation-sites/scss/global';",
  "@import 'foundation-sites/scss/components/button';",
  '@include foundation-button;',
  `${AUTO_HOVER_PROBE_SELECTOR} {`,
  '  background-color: scale-color($button-background, $lightness: $button-background-hover-lightness);',
  '}',
].join('\n');

// R004 / ticket 03: `$global-left`/`$global-right` are reassigned to
// `inline-start`/`inline-end` after Foundation's @imports, so Foundation's
// UNMODIFIED `button-dropdown` emits logical properties where stock Foundation
// emits physical ones. Normalising the reference this way keeps those two
// declarations inside the parity check rather than excusing them from it.
const PHYSICAL_TO_LOGICAL_PROPERTY = new Map([
  ['margin-left', 'margin-inline-start'],
  ['margin-right', 'margin-inline-end'],
  ['padding-left', 'padding-inline-start'],
  ['padding-right', 'padding-inline-end'],
]);
const PHYSICAL_TO_LOGICAL_VALUE = new Map([
  ['left', 'inline-start'],
  ['right', 'inline-end'],
]);
const DIRECTIONAL_VALUE_PROPERTIES = new Set(['float', 'clear', 'text-align']);

// Every declaration NfsButton emits on a selector Foundation also emits, whose
// value Foundation would NOT produce. Each entry pins the expected value, so a
// deviation is a recorded decision rather than a blind spot -- drift inside an
// allowlisted declaration still fails the gate.
//
// `expected: 'auto-hover'` means "whatever Foundation's own
// scale-color($button-background, $lightness: $button-background-hover-lightness)
// evaluates to", read from the probe rule above.
const DEVIATIONS = [
  {
    selector: '.button:hover',
    property: 'background-color',
    expected: 'auto-hover',
    reason:
      'ticket 08: Foundation contradicts ITSELF -- $button-background-hover ' +
      'defaults to scale-color(..., -15%) (components/_button.scss:36) while ' +
      '$button-background-hover-lightness is -20% (:77). Resolved toward the ' +
      '`auto` path, so a consumer-set $background derives its own hover.',
  },
  {
    selector: '.button:focus',
    property: 'background-color',
    expected: 'auto-hover',
    reason: 'as .button:hover -- Foundation emits both from one declaration.',
  },
  {
    selector: '.button.tiny',
    property: 'padding',
    expected: '0.5em 1em',
    reason:
      "pre-existing NfsButton behaviour: Foundation's $button-sizes varies " +
      'only font-size, NfsButton varies padding too (README size table).',
  },
  {
    selector: '.button.small',
    property: 'padding',
    expected: '0.75em 1em',
    reason: 'as .button.tiny.',
  },
  {
    selector: '.button.large',
    property: 'padding',
    expected: '1em 2em',
    reason: 'as .button.tiny.',
  },
  {
    selector: '.button.disabled',
    property: 'pointer-events',
    expected: 'none',
    reason:
      "Foundation's button-disabled sets only opacity and cursor. " +
      "pointer-events backs nfs-button.spec.ts's click-prevention assertions " +
      'for a soft-disabled <a> host.',
  },
  {
    selector: '.button[disabled]',
    property: 'pointer-events',
    expected: 'none',
    reason: 'as .button.disabled.',
  },
];

// Foundation variant families NfsButton deliberately does not implement. Any
// OTHER Foundation-only selector fails the gate, which is what catches a
// Foundation upgrade adding a variant NfsButton silently never learns -- the
// regression the retired script's reverse check was aiming at.
const UNIMPLEMENTED_FOUNDATION_FAMILIES = [
  {
    token: '.primary',
    reason:
      'the base .button selector IS the primary variant; NfsButton never ' +
      'emits a .primary class.',
  },
  {
    token: '.clear',
    reason: 'NfsButton offers solid and hollow fills only, not clear.',
  },
  {
    token: '.arrow-only',
    reason: 'no arrow-only dropdown variant is exposed as an input.',
  },
  {
    token: '-expanded',
    reason:
      '$button-responsive-expanded breakpoint classes are not part of the ' +
      "component's API.",
  },
  {
    token: 'a.button',
    reason:
      'the anchor text-decoration reset belongs to a consumer global ' +
      'stylesheet, not to a component that styles its own host element.',
  },
];

// Selectors NfsButton emits that Foundation does not, each an R026 content
// exception rather than a styling decision.
const NFS_ONLY_SELECTORS = [
  {
    selector: '.button:focus:not(:focus-visible)',
    reason:
      'R026 accessibility-only CSS: the browser-native replacement for ' +
      "Foundation's inert disable-mouse-outline rule, whose [data-whatinput] " +
      'hook needs the what-input JS that R016 forbids.',
  },
];

function compileCss() {
  const component = sass.compile(COMPONENT_STYLESHEET, {
    loadPaths: LOAD_PATHS,
    quietDeps: true,
  }).css;
  const foundation = sass.compileString(FOUNDATION_REFERENCE, {
    loadPaths: ['node_modules'],
    quietDeps: true,
    // Silenced deliberately: this is stock Foundation used as a REFERENCE, and
    // its @import/global-builtin deprecations are not this repo's to fix.
    logger: sass.Logger.silent,
  }).css;

  return { component, foundation };
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parses CSS into `selector -> (property -> value)`, walking into at-rules so
 * `@layer nfs-defaults` and `@media` wrappers are transparent. Later
 * declarations overwrite earlier ones, matching the cascade within one sheet.
 */
function declarationsBySelector(css) {
  const bySelector = new Map();

  postcss.parse(css).walkRules((rule) => {
    for (const rawSelector of rule.selectors) {
      const selector = normalizeWhitespace(rawSelector);
      let declarations = bySelector.get(selector);

      if (!declarations) {
        declarations = new Map();
        bySelector.set(selector, declarations);
      }

      rule.each((node) => {
        if (node.type === 'decl') {
          declarations.set(node.prop, normalizeWhitespace(node.value));
        }
      });
    }
  });

  return bySelector;
}

function toLogical(declarations) {
  const logical = new Map();

  for (const [property, value] of declarations) {
    const logicalProperty =
      PHYSICAL_TO_LOGICAL_PROPERTY.get(property) ?? property;
    const logicalValue = DIRECTIONAL_VALUE_PROPERTIES.has(property)
      ? (PHYSICAL_TO_LOGICAL_VALUE.get(value) ?? value)
      : value;

    logical.set(logicalProperty, logicalValue);
  }

  return logical;
}

function toLogicalSheet(bySelector) {
  return new Map(
    [...bySelector].map(([selector, declarations]) => [
      selector,
      toLogical(declarations),
    ]),
  );
}

function findDeviation(selector, property) {
  return DEVIATIONS.find(
    (deviation) =>
      deviation.selector === selector && deviation.property === property,
  );
}

function isZeroLength(value) {
  return /^0([a-z%]+)?$/i.test(value);
}

const failures = [];

function fail(check, message) {
  failures.push({ check, message });
}

const { component: componentCss, foundation: foundationCss } = compileCss();
const rawComponent = declarationsBySelector(componentCss);
const rawFoundation = declarationsBySelector(foundationCss);

const autoHoverColor = rawFoundation
  .get(AUTO_HOVER_PROBE_SELECTOR)
  ?.get('background-color');

if (autoHoverColor === undefined) {
  throw new Error(
    `Reference compile did not emit ${AUTO_HOVER_PROBE_SELECTOR}; the auto-hover probe is broken.`,
  );
}

rawFoundation.delete(AUTO_HOVER_PROBE_SELECTOR);

const ours = toLogicalSheet(rawComponent);
const theirs = toLogicalSheet(rawFoundation);

function expectedValue(deviation) {
  return deviation.expected === 'auto-hover'
    ? autoHoverColor
    : deviation.expected;
}

// ---------------------------------------------------------------------------
// Check 1 (forward, completeness). Every declaration Foundation emits on a
// selector NfsButton also emits must be present with an equal value. This is
// the check that catches ticket 08's `.button.hollow` bug: Foundation's
// `background-color: transparent` would simply be absent.
// ---------------------------------------------------------------------------
let comparedSelectors = 0;
let comparedDeclarations = 0;

for (const [selector, foundationDeclarations] of theirs) {
  const ourDeclarations = ours.get(selector);

  if (!ourDeclarations) {
    continue;
  }

  comparedSelectors++;

  for (const [property, foundationValue] of foundationDeclarations) {
    comparedDeclarations++;
    const deviation = findDeviation(selector, property);
    const expected = deviation ? expectedValue(deviation) : foundationValue;

    if (!ourDeclarations.has(property)) {
      fail(
        'forward',
        `${selector} is missing Foundation's \`${property}: ${foundationValue}\``,
      );
      continue;
    }

    const ourValue = ourDeclarations.get(property);

    if (ourValue !== expected) {
      fail(
        'forward',
        deviation
          ? `${selector} { ${property} } drifted from its recorded deviation: ` +
              `expected \`${expected}\`, got \`${ourValue}\`. Deviation reason: ${deviation.reason}`
          : `${selector} { ${property} } is \`${ourValue}\`, Foundation emits \`${foundationValue}\``,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check 2 (reverse, no hand-rolling). Every declaration NfsButton emits must
// come from Foundation, be a recorded deviation, or sit on a recorded
// NfsButton-only selector. D017: nothing hand-rolled that Foundation can emit.
// ---------------------------------------------------------------------------
const nfsOnlySelectors = new Set(
  NFS_ONLY_SELECTORS.map((entry) => entry.selector),
);

for (const [selector, ourDeclarations] of ours) {
  if (nfsOnlySelectors.has(selector)) {
    continue;
  }

  const foundationDeclarations = theirs.get(selector);

  if (!foundationDeclarations) {
    fail(
      'reverse',
      `${selector} is emitted by NfsButton but not by Foundation, and is not a recorded NfsButton-only selector`,
    );
    continue;
  }

  for (const [property, ourValue] of ourDeclarations) {
    if (foundationDeclarations.has(property)) {
      continue;
    }

    const deviation = findDeviation(selector, property);

    if (!deviation) {
      fail(
        'reverse',
        `${selector} { ${property}: ${ourValue} } is hand-rolled -- Foundation emits no such declaration and there is no recorded deviation`,
      );
    } else if (ourValue !== expectedValue(deviation)) {
      fail(
        'reverse',
        `${selector} { ${property} } drifted from its recorded deviation: expected \`${expectedValue(deviation)}\`, got \`${ourValue}\``,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check 3 (Foundation variants NfsButton never learned). Replaces the retired
// script's reverse check at family level, and fires when a Foundation upgrade
// adds a button variant this component does not implement.
// ---------------------------------------------------------------------------
for (const selector of theirs.keys()) {
  if (ours.has(selector)) {
    continue;
  }

  const known = UNIMPLEMENTED_FOUNDATION_FAMILIES.some((family) =>
    selector.includes(family.token),
  );

  if (!known) {
    fail(
      'unimplemented',
      `Foundation emits ${selector}, NfsButton does not, and it belongs to no recorded unimplemented family`,
    );
  }
}

// ---------------------------------------------------------------------------
// Check 4 (R004 logical properties). Re-anchors the retired
// `NFS_BUTTON_STYLES logical-property compliance` specs, which regexed the
// deleted CSS-in-JS string. Runs on the RAW component output, before the
// physical-to-logical normalisation above.
//
// Zero-valued physical margins/paddings pass on purpose: `margin-left: 0;
// margin-right: 0` from Foundation's `button-expand` is direction-symmetric
// and mirrors trivially. Ticket 03 measured that the whole sheet contains
// exactly two genuinely directional declarations, both on
// `.button.dropdown::after`.
// ---------------------------------------------------------------------------
for (const [selector, declarations] of rawComponent) {
  for (const [property, value] of declarations) {
    if (PHYSICAL_TO_LOGICAL_PROPERTY.has(property) && !isZeroLength(value)) {
      fail(
        'logical-properties',
        `${selector} { ${property}: ${value} } is a physical directional property; use its logical equivalent (R004)`,
      );
    }

    if (
      DIRECTIONAL_VALUE_PROPERTIES.has(property) &&
      PHYSICAL_TO_LOGICAL_VALUE.has(value)
    ) {
      fail(
        'logical-properties',
        `${selector} { ${property}: ${value} } is a physical directional value; use its logical equivalent (R004)`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Foundation parity check FAILED:');

  for (const { check, message } of failures) {
    console.error(`  [${check}] ${message}`);
  }

  process.exit(1);
}

console.log(
  [
    'Foundation parity check PASSED.',
    `  ${comparedDeclarations} declarations compared across ${comparedSelectors} shared selectors`,
    `  ${DEVIATIONS.length} recorded deviations, all still at their expected values`,
    `  ${NFS_ONLY_SELECTORS.length} recorded NfsButton-only selector(s)`,
    `  ${ours.size} NfsButton selectors, ${theirs.size} stock Foundation selectors`,
  ].join('\n'),
);
