# How does one `styleUrl` stylesheet mirror Foundation's physical-property mixins for RTL?

Type: research
Status: resolved
Blocked by: —

## Question

D018 solved RTL by building two files (sass then rtlcss: `nfs-button.css` +
`nfs-button.rtl.css`) and let the runtime CSS-in-JS path hand-author logical
properties instead. A `styleUrl`-delivered stylesheet is a *single* stylesheet
baked into the component, so neither half of that answer survives -- yet R004
still requires `dir="rtl"` mirroring and D017 still requires reusing Foundation's
real mixins rather than hand-rolling.

The physical properties are confirmed present in Foundation 6.9.0
(`scss/components/_button.scss`): `button-base` emits
`margin: $button-margin` (a four-value shorthand whose last value is
directional), `button-expand` emits `margin-right` / `margin-left`, and
`button-dropdown` emits `float: #{$global-right}` and `margin-#{$global-left}`.
`$global-left` / `$global-right` are plain (non-`!default`) assignments in
`scss/_global.scss:127-128`, derived from `$global-text-direction` at import
time.

Evaluate these single-stylesheet mechanisms and recommend one:

1. **Re-`@include` Foundation's mixins for a second direction in the same
   compilation.** Because Foundation is legacy `@import` (one global scope) and
   `$global-left` / `$global-right` are read at `@include` time via
   interpolation, reassigning them -- plus `$global-text-direction` and any
   import-time derivations like `$button-margin` and `$-zf-flex-justify` -- and
   re-including inside a `[dir="rtl"]` block may emit correct mirrored rules.
   **Verify this empirically** against the local `foundation/foundation-sites`
   clone with a throwaway compile; do not reason about it only. Report exactly
   which globals must be reassigned and whether any value is baked at import
   time in a way that makes the second pass wrong (note `_button.scss:84`
   already re-`!default`s `$button-margin` under an RTL check, which is a hint
   the mechanism is import-time-only).
2. **`postcss-rtlcss`** -- unlike the installed `rtlcss`, it emits a *single*
   stylesheet with `[dir="rtl"]` selectors. Check its output modes (`combined` /
   `override` / `diff`), whether the `[dir]` selector strategy composes with a
   `@layer nfs-defaults` wrapper, and its specificity impact on consumer
   overrides.
3. **`postcss-logical`** -- rewriting physical to logical properties
   mechanically, so `dir` alone mirrors (the approach S14 hand-authored).
4. **The `:dir()` pseudo-class** -- check support against this repo's
   `.browserslistrc` (`baseline widely available`) before recommending it;
   R022 pins the baseline to Angular 22's supported browsers.

For each: does it survive `@layer` wrapping, does it keep working when a
consumer re-themes, and does it hold under the existing Playwright RTL gate
(`apps/nfs-demo/e2e/nfs-button-rtl.spec.ts`, which asserts computed-style
mirroring against the LTR baseline)?

## Answer

Full findings, with compiled output and in-browser observations:
[research/03-rtl-in-one-stylesheet.md](../research/03-rtl-in-one-stylesheet.md)

**Recommendation: emit logical properties through Foundation's own interpolation
hooks.** Two assignments in `_foundation-button.scss`, after the `@import`s:

```scss
$global-left: inline-start;
$global-right: inline-end;
```

Foundation's **unmodified** `button-dropdown` then emits
`float: inline-end; margin-inline-start: 1em` (observed). One stylesheet, no
`[dir]` selector, no second `@include`, no new dependency, no specificity cost,
and D017's "reuse Foundation's real mixins" fully intact -- the mixin is never
touched, only the variables it interpolates.

**The crux that shrinks the whole question:** this repo's entire compiled
stylesheet contains exactly **two** genuinely directional declarations, both on
`.button.dropdown::after` -- `float: right` and `margin-left: 1em`. Everything else
(`margin: 0 0 1rem 0`, `.expanded`'s `margin-right/left: 0`, `text-align: center`)
is inline-symmetric. postcss-rtlcss independently identified the same two.

Verdicts:

- **Mechanism 1, re-`@include` for a second direction -- works, but rejected.**
  `$global-left` + `$global-right` alone suffice (`$global-text-direction` is
  cosmetic for button output). But three values are baked at import time and are
  **silently wrong on pass 2**: `$button-margin`, `$-zf-flex-justify`, and fatally
  `button-dropdown`'s `$offset` -- `_button.scss:297` hardcodes
  `get-side($button-padding, right)` rather than `$global-right`, so with
  asymmetric padding RTL emits `margin-right: 3em` where the end side is `1em`,
  unfixable by any global. Also costs +1 specificity class, defeating unlayered
  consumer overrides. Incidental finding: `_button.scss:84`'s RTL flip is **dead
  code** in this repo, because `_foundation-button.scss:32` assigns
  `$button-margin` pre-import so the `!default` never takes.
- **Mechanism 2, postcss-rtlcss 6.0.0 -- rejected.** Its `combined`-mode analysis
  is accurate and `@layer` survives verbatim, but it **breaks LTR in this repo's
  actual DOM**: `index.html` is `<html lang="en">` with no `dir`, so
  `[dir="ltr"] .button.dropdown::after` never matches -- confirmed in Chromium.
  That turns a styling choice into a silent DOM contract for every consumer.
  `override`/`diff` are README-discouraged, `diff` is D018's two-file shape again,
  and `safeBothPrefix: true` prefixes the entire sheet with `[dir]`.
- **Mechanism 3, logical properties -- recommended, but not via the plugin.**
  `postcss-logical` 9.0.0 is the wrong tool and actively harmful: it transforms
  logical -> physical, was a byte-for-byte no-op on this repo's CSS, and on logical
  input it destroyed `margin-inline-start` -> `margin-left` while ignoring
  `float: inline-end`. The working route is the variable substitution above.
  Mirrors correctly in-browser, layered and unlayered; survives esbuild 0.28.1 and
  lightningcss 1.33.0 at this repo's targets. `float: inline-start/end` needs
  Chrome 118 / Safari 15 against a resolved floor of Chrome 121 / Safari 17.2 --
  **0 of 125 browserslist targets unsupported**. The only mechanism where an
  unlayered consumer override wins outright.
- **Mechanism 4, `:dir()` -- support objection WITHDRAWN by user decision; back in
  contention, but still not the recommendation.** The user has approved `:dir()`
  despite the Chrome/Edge 119 gap, on the reasoning that Angular 23 will have
  shipped before this library reaches a stable release. So support is no longer an
  objection and no further approval is needed to use it. What remains is the
  non-support trade-off, and it is unchanged: `:dir()` costs +1 specificity class,
  which half-applies a consumer override -- the override lands in one direction and
  not the other, a worse failure mode than a support gap because time does not fix
  it. Note that the token architecture ticket 04 recommends **largely dissolves
  even this**, since consumers override custom-property *values*, which resolve by
  inheritance independently of the component rule's specificity. The remaining
  honest reason to prefer logical properties is that they are smaller (no
  duplicated per-direction rules), simpler (two variable assignments, Foundation's
  mixin untouched), and have real headroom (`float: inline-start/end` needs Chrome
  118, two versions below the floor). **`:dir()`'s one genuine capability advantage
  stands: it can mirror a shorthand, which a logical property cannot.** No
  inline-asymmetric shorthand exists today (`$button-margin` is `0 0 1rem 0`), so
  keep logical properties and hold `:dir()` as the now-pre-approved escape hatch
  for the moment one appears.

  Original support finding, retained for the record: It works functionally, and unlike postcss-rtlcss `:dir(ltr)`
  matches with no `dir` attribute present. But the "0 of 125 targets unsupported"
  measurement used browserslist's **rolling** `baseline widely available` query,
  and the project's actual requirement is the baseline **pinned to 2026-05-07** to
  match Angular 22 exactly. Re-measured against the pinned set:
  **`css-dir-pseudo` fails 2 of 136 targets** (chrome 119, edge 119), because the
  pinned floor is Chrome/Edge 119 rather than 121. So `:dir()` is out, not merely
  second. It also carried the +1 specificity cost that half-applies consumer
  overrides.

  Verified against both authoritative sources, and it misses by **exactly one
  version**: `baseline-browser-mapping` -- the package the supported-browsers page
  is built on, and the one browserslist 4.28.7 itself calls (`index.js:1`) --
  returns chrome 119 / edge 119 for `widelyAvailableOnDate: '2026-05-07'` with
  `includeDownstream: false`, while live caniuse lists Chrome and Edge **91-119 as
  "disabled by default"** with support beginning at 120. One version short is still
  short: two shipping targets in the supported set would render the dropdown arrow
  on the wrong side with no fallback.

**Baseline re-check of the recommendation (post-correction).** Against the pinned
2026-05-07 set (136 targets, floors Chrome/Edge/Firefox 119, Safari/iOS 17.0),
`css-logical-props` fails **0 of 136**, so the recommended mechanism survives the
stricter baseline intact. `@layer` (`css-cascade-layers`) is also 0/136. This
matters because the pinned baseline is stricter than the rolling one the original
measurement used -- 11 more targets, floors two to three versions older -- so the
recommendation is now verified against the correct target set rather than a
drifting one. postcss-rtlcss and postcss-logical remain rejected on behaviour;
`:dir()` is the runner-up again now that its support objection has been withdrawn
by user decision.

**Gate warning -- R004's proof is currently vacuous.**
`apps/nfs-demo/e2e/nfs-button-rtl.spec.ts` reads only inline-symmetric properties
off a **plain** button; no `.dropdown` instance exists in `app.component.ts`. Its
assertions pass under all four mechanisms *and* under no mechanism at all, so it
does not gate mirroring at all. It needs a `.dropdown` instance plus
`marginLeft`/`marginRight` assertions -- and must **not** assert `float`, because
under the recommended mechanism `getComputedStyle(el, '::after').float` returns
`"inline-end"` in both directions.

Carried forward:

- Whether any PostCSS stage runs over a `styleUrl` stylesheet in an
  `@nx/angular:package` build -- ticket 02 is probing it. Load-bearing only for the
  rejected M2, so it does not affect this recommendation.
- All browser observations are headless Chromium. WebKit/Gecko confirmation needs
  the extended spec under Playwright's `webkit`/`firefox` projects -- folded into
  ticket 10.
