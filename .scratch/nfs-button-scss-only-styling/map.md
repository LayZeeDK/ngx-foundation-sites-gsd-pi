# NfsButton: SCSS-only styling, zero CSS-in-JS

Label: `wayfinder:map`

## Destination

NfsButton's default styling reaches the DOM entirely from compiled SCSS, with
`nfs-button.styles.ts`, `NfsStyleLoader` and `NfsStyleExtractor` deleted and no
replacement that hands a CSS string to JavaScript. Every existing project and
M001 requirement still holds -- R001, R003, R004, R005, R006, R007, R008, R010,
R018, R020, R022, R024 -- and the two active constraints R025 (Directive-first,
with its stylesheet-lifecycle carve-out) and R026 (no hand-fed CSS-in-JS) are
satisfied. Implemented and verified in the repo: lint, test, test-browser,
build, e2e (a11y / RTL / registry-consumption) and test-storybook all green.

**Verified across all six host configurations**, since a styling approach that
works in one delivery mode and silently breaks in another has not met the bar:

1. SSR production-like host (`@angular/ssr` + Express)
2. Static-serve production-like host (production build, CSR only)
3. esbuild/Vite dev server, CSR mode
4. esbuild/Vite dev server, SSR mode
5. Storybook dev server -- component stories and interaction tests
6. Storybook static build + `test-storybook`

Angular delivers component styles through a different mechanism in each of
production, dev-with-HMR, server-render and Storybook's own builder, so this is a
real matrix rather than a formality.

## Notes

**Domain.** Angular 22 publishable library in an Nx monorepo (ng-packagr,
`@nx/angular:package`), styling Foundation for Sites 6.9.0 via its real Sass
mixins. Storybook 10 is the primary test surface; Vitest for services/logic;
Playwright e2e in `apps/nfs-demo` against the Verdaccio-installed package.

**Execution is in scope.** This overrides Wayfinder's plan-only default: the
user asked to "research and implement from scratch", so the map carries the
build through to verified, not just decided.

**No human in the loop.** By explicit user instruction, no ticket may ask the
user to decide. There are therefore no `grilling` or `prototype` tickets --
every ticket is `research` (including synthesis/decision tickets, resolved AFK)
or `task`. Decisions are answered from:

- `.gsd/` artifacts -- `REQUIREMENTS.md`, `DECISIONS.md`, `PROJECT.md`,
  `ROADMAP.md`, `STATE.md`. **Read-only**: these are projected from a database,
  never write or edit them.
- Local clones under `d:/projects/github/<owner>/<repo>` -- `angular/angular`,
  `angular/angular-cli`, `angular/components`, `foundation/foundation-sites`.

These clones are **decision-locking authorities**, not just fact sources: a
decision ticket may be closed on clone evidence alone. `foundation/foundation-sites`
(v6.9.0, branch `develop`) is authoritative for anything about Foundation's Sass
-- what its mixins emit, which globals they read and when, what its RTL model
actually is, and whether a module-system successor exists. Read it and compile
against it rather than deferring the question upward. Likewise `angular/components`
settles what the reference Angular API does, and `angular/angular` settles what
the framework guarantees. If a clone answers the question, the answer is locked.

**Directive is preferred, Component is authorized.** Standing user decision: if
NfsButton needs `styles`/`styleUrl`, it must be a Component -- that is accepted,
not a violation. Use a Directive where possible, but never trade away a styling
requirement to get one. Style requirements outrank the Directive preference, so
Component-hood needs no further approval; only a Directive that *drops* a
styling requirement would.

Note the interaction this creates: the user's own hard requirement list includes
"lazy-loading/-unloading of NfsButton component styles with ref count" (R005).
If ticket 01 confirms that lifecycle is Component-only, then the ref-count
requirement -- not the styling-source requirement -- is what forces Component,
and the Directive preference is simply unreachable. Say that plainly if so.

**SCSS variable theming ONLY -- no CSS custom property theming.** Standing user
decision, and the most consequential constraint on this map. It settles the
architecture question ticket 06 was convened to answer, and it **overrides ticket
04's token-indirection recommendation**: Material's pattern (`var(--mat-*)` tokens
emitted by a theme mixin, re-themeable at runtime) is rejected as a design for this
library, notwithstanding the strong evidence that it works for Material. Ticket 04's
*findings* remain valid and useful; its *recommendation* does not apply.

**Precise scope of the constraint.** Runtime theming *is* a project goal -- M002's
Storybook addon (R009/R021) exists to live-tweak Foundation Sass variables without a
rebuild. But it achieves that by **compiling SCSS in the browser at runtime**, not by
swapping CSS custom properties. So there is exactly one theming mechanism, Sass
variables, with two places the compilation can happen: the consumer's build, or the
browser. The constraint forbids the *mechanism* (custom properties as the theming
surface), not runtime theming as a capability.

That closes the last remaining argument for a CSS-native contrast function. An
earlier note on this map claimed M002 needed one, because changing a background at
runtime would otherwise require recompiling Sass to get a matching text colour. That
was wrong: M002 recompiles Sass by design, so Foundation's own `color-pick-contrast`
runs in the browser alongside everything else.

**Implication for the shipped package.** Runtime SCSS compilation requires the
library's SCSS **source** to be fetchable and compilable at runtime, and Foundation's
SCSS to be resolvable by an in-browser importer. That constrains ticket 08's fix to
the over-broad `ng-package.json` assets glob: narrow it to stop leaking
`_foundation-button.scss` and `verify-parity.mjs` as *public API*, but do not narrow
it so far that M002 can no longer obtain the source it must compile. Note also that
ticket 05's Dart Sass 3.0.0 `@import`-removal risk now applies twice over -- to the
build-time pipeline and to the in-browser compiler.

What follows from it:

- **R020 is honoured literally, not reinterpreted.** "Compiled by the consumer's own
  Angular build against variables the consumer sets in their own settings file" is
  exactly compile-time SCSS theming. The tension recorded earlier in this map
  dissolves -- by rejecting the token pattern, not by adopting it.
- **`@layer nfs-defaults` is load-bearing again, and R008 stands.** Under compile-time
  theming a themed consumer recompiles the library's SCSS into their own global
  stylesheet, and the layer is what lets that unlayered output beat the
  `styleUrl`-delivered default regardless of DOM insertion order. Ticket 04's
  "reject `@layer`" recommendation is void, and **the R008 replay gate is no longer
  needed** -- there is nothing to unwind. Ticket 01's finding stays the reason it
  matters: the component `<style>` is appended to `<head>` *after* the global
  `styles.css` `<link>`, so it wins same-specificity ties without a layer.
- **Contrast is computed by Foundation's Sass at compile time, permanently.** No
  `contrast-color()`, no relative-colour clamp, no JS-to-custom-property. This
  moots most of ticket 14 (see that ticket).
- **Relative colours are no longer needed**, though the approval stays banked. They
  were only wanted to derive hover at runtime from a single consumer-set token --
  a runtime-token feature. With compile-time theming, Foundation's own `scale-color`
  runs in the consumer's Sass and produces the exact value. The `:dir()` approval is
  unaffected: RTL is compile-time output and has nothing to do with theming.
- **Accepted cost:** a themed consumer ships the ruleset twice -- the layered default
  from `styleUrl` plus their own unlayered recompile. That is the known price of this
  architecture and is not a defect to design around.
- **Unaffected:** ticket 12's verdict that `styleUrl` wins across all six hosts,
  ticket 03's logical-property RTL mechanism, ticket 05's theme-mixin-over-module-config
  API (still the right shape -- it just emits concrete declarations rather than
  custom properties), and ticket 02's toolchain configuration.

**`@material/material-color-utilities` is an allowed dependency** where it helps meet
a requirement. Assess honestly rather than adopting it speculatively: under
compile-time-only theming all colour maths happens in Sass, so it serves no
production need identified so far. Its plausible use is **dev-only verification** --
an independent JS implementation of WCAG relative luminance and contrast ratio to
cross-check that Foundation's Sass `color-pick-contrast` picks what we believe it
picks, replacing part of the retired `verify-parity.mjs`. Do not add it to the
library's runtime or peer dependencies without a named requirement.

**Foundation's default theme ships unchanged; a WCAG/axe-compliant theme ships in
M002 and is what the axe tests run against.** Standing user decision, settling the
contrast shortfalls ticket 14 found. Fidelity to Foundation wins for the default
(D017); compliance is delivered as a prebuilt theme in **M002**, and the axe suite is
run with that theme applied.

**Integrity guard -- run axe twice, not once.** If axe only ever runs against the
compliant theme, the suite reports clean while the *default* theme -- what a
zero-config consumer actually gets -- ships three known failures, and nothing detects
a regression in it. So once M002 lands the compliant theme:

- **Compliant theme: assert zero violations.** This becomes R003's real proof, and it
  is a stronger proof than the current one because it is a shipped artifact rather than
  a scoped claim.
- **Default theme: assert the exact known-failure set.** This is the Foundation-fidelity
  regression detector -- it fires if a new failure appears or if Foundation's values
  change.

Both runs share one spec and differ only by which theme is applied. Until M002 exists,
this map ships the default-theme run alone (ticket 10), which is the bridge.

Concretely, for this map:

- **Do not alter Foundation's palette or `$white`.** No `$alert-color` darkening to
  `#cb4b37`, no swap of `#fefefe` for `#ffffff`. Both were on the table and both are
  rejected.
- **Three variants ship knowingly below WCAG AA** in the default theme, all inherited
  from Foundation's own palette values: `alert` fill and `alert` hollow at 4.498
  (AA-large passes), and `hollow success` at 1.799 / `hollow warning` at 1.842, which
  fail even the 3.0 large-text floor.
- **R003 is in tension with this and cannot be silently reinterpreted.** Its wording is
  "comply with WCAG AA ... **not just Foundation's own accessibility baseline**", and it
  is currently recorded as *validated* on an axe scan that never covered any of the
  three failing variants. `.gsd/` is read-only, so this is reported to the user rather
  than edited: R003's default-theme claim needs scoping, and the compliant-theme
  milestone is what eventually satisfies its full intent.
- **Gate it as an exact expected-failure set, never a disabled rule.** Assert that the
  contrast violations axe reports are *exactly* the known three. A blanket
  suppression of the colour-contrast rule would hide genuine future regressions and
  would rot; an exact-set assertion fails loudly if a new failure appears, if
  Foundation's values change, or once a compliant theme lands -- each of which should
  force a deliberate update. Ticket 10 owns the wiring.

**Browser baseline is PINNED to 2026-05-07, not rolling.** Standing user
requirement: the target baseline must match Angular 22 exactly -- Baseline
"widely available" as of **2026-05-07**
([angular.dev](https://angular.dev/reference/versions#browser-support),
[supported-browsers](https://web-platform-dx.github.io/supported-browsers/?widelyAvailableOnDate=2026-05-07&includeDownstream=false),
`includeDownstream=false`).

**This repo currently gets it wrong.** `.browserslistrc` contains the bare
rolling query `baseline widely available`, and its own comment states the intent
as tracking "Angular's rolling definition" -- but Angular 22's definition is
fixed, so the config drifts further from it every day.
`scripts/verify-browserslist.mjs` hard-asserts that exact rolling string, so it
locks the drift in. browserslist 4.28.7 **does** support the pinned form
(`index.js:831`), so the fix is a one-line change to
`baseline widely available on 2026-05-07` plus the matching assertion.

Measured difference (both resolved with this repo's own browserslist, script kept
at `tmp/check-baseline-features.mjs`, gitignored):

| | rolling, today | pinned 2026-05-07 |
|---|---|---|
| targets | 125 | **136** |
| chrome / edge | 121 | **119** |
| firefox | 122 | **119** |
| safari / ios_saf | 17.2 | **17.0** |

The pinned baseline is **stricter** -- 11 more targets, floors two to three
versions older. Feature verdicts against the pinned set, via this repo's
`caniuse-lite`:

- `css-logical-props` -- **0/136 failing.** The recommended RTL mechanism holds.
- `css-dir-pseudo` -- **2/136 failing** (chrome 119, edge 119). `:dir()` passed
  0/125 under the rolling query and is **disqualified** under the pinned one.
  Cross-checked against both sources directly, and it misses by exactly one
  version: `baseline-browser-mapping` (the package behind the supported-browsers
  page, queried with `widelyAvailableOnDate: '2026-05-07', includeDownstream:
  false`) returns floors chrome 119 / chrome_android 119 / edge 119 / firefox 119 /
  firefox_android 119 / safari 17 / safari_ios 17; live caniuse for
  `css-dir-pseudo` lists Chrome and Edge **91-119 as "disabled by default"** and
  120+ as supported. Note that browserslist 4.28.7 resolves this query *through*
  `baseline-browser-mapping` (`index.js:1`), so the local resolution and that page
  are the same data, not two independent estimates.
- `css-relative-colors` -- **9/136 failing** (firefox 119-127). So
  `hsl(from c h s calc(l * 0.8))` is unusable, independently confirming that
  colour derivation must stay Sass-time in the library build.
- `css-cascade-layers` -- 0/136 failing. `@layer` remains available if kept.
- `css-focus-visible` -- 0/136 failing. `:focus-visible` is available.

Any ticket that clears a CSS feature must re-check it against the **pinned**
query. A verdict measured against the rolling query is not evidence.

**Approved exception: `:dir()`, despite Chrome/Edge 119.** Standing user decision.
The gap is exactly two of 136 targets -- Chrome 119 and Edge 119, the floor version
of each Chromium desktop agent; 120 through 150 all pass. Rationale accepted: by
the time this library reaches a stable release Angular 23 will have shipped and
those versions will be ancient. Bisected, the gap is **about five weeks** -- a
baseline date of 2026-06-15 already yields floors of Chrome/Edge 120.

**This exception does not generalise, and specifically does not revive
`css-relative-colors`.** That gap is a different order of magnitude. Its many
"partial" entries are **not** the problem: caniuse note `#2` is
[Mozilla bug 1893966](https://bugzilla.mozilla.org/show_bug.cgi?id=1893966)
(RESOLVED FIXED) -- relative colour syntax rejecting `currentcolor` as the origin
colour -- which never applies here, because the origin would be a token
(`hsl(from var(--nfs-button-background) h s calc(l * 0.8))`). The problem is
**Firefox 119-127, which have no relative-colour support at all** (`n`, not `a`):
9 of 136 targets. Treating partials as acceptable lowers the bar from Firefox 133
to Firefox 128 and pulls the clear date in from ~2027-04-01 to **~2027-01-15** --
still about **17 months**, versus five weeks for `:dir()`. So
`hsl(from c h s calc(l * 0.8))` stays rejected and Sass-time colour derivation in
the library build stands.

Any future request to accept a baseline gap must be sized the same way -- bisect
the date, count the failing targets, **and check whether the partial-support note
actually applies to our usage** -- rather than argued by analogy to this approval.

**Approved exception: CSS relative colours, excluding the `currentcolor` /
system-colour-keyword limitation.** Standing user decision, superseding the
rejection above. caniuse's partial-support note reads "Does not support
currentcolor or system color keywords", matching
[Mozilla bug 1893966](https://bugzilla.mozilla.org/show_bug.cgi?id=1893966)
(RESOLVED FIXED). Relative colours are approved for use; usages whose **origin
colour** is `currentcolor` or a system-colour keyword (`ButtonFace`, `Canvas`,
`AccentColor`, ...) are not. Reading of scope, since the note and the absence are
different things: the approval covers **both** the partial-support versions
(Chrome/Edge 119-130, Firefox 128-132, Safari/iOS 17.0-17.6) **and** the nine
Firefox 119-127 targets that have no support at all -- Firefox 127 is 25.9 months
old, the same "ancient" reasoning applied to Chrome/Edge 119. Note the gap is
larger than the `:dir()` one: 9 targets and ~15 months, versus 2 targets and ~5
weeks.

**Prefer progressive enhancement over spending the exception.** An unsupported
colour function makes a declaration invalid, so it is dropped and the preceding
declaration wins -- the ordinary CSS fallback idiom. Emitting the Sass-baked hover
first and the relative-colour form second gives non-supporting browsers the baked
value and supporting browsers the derived one, from the same rule:

```css
.button:hover { background-color: var(--nfs-button-background-hover, #14679e); }
.button:hover { background-color: hsl(from var(--nfs-button-background) h s calc(l * 0.8)); }
```

If that holds, the Firefox 119-127 gap disappears and no baseline exception is
consumed -- and the `currentcolor` case degrades the same way.

**The verification obligation is withdrawn.** It was assigned to ticket 08, which
correctly declined it: the compile-time-only theming decision means nothing in the
implementation uses relative colours, so there is no declaration to test. The approval is
banked unspent. If a future effort does reach for relative colours, the open question is
whether an affected browser fails at parse time (declaration dropped, fallback wins --
good) or computes something wrong (bad), and it needs a Firefox 119-127 or Chrome 119-130
build this environment does not have.

**The consumer-set-`currentcolor` case is closed by user decision:** assume a
consumer does not set a colour token to `currentcolor` or a system-colour keyword,
or guard against it. Do not design around it, and do not raise it again as a
blocker.

Worth noting the guard is probably free rather than extra work. The
progressive-enhancement shape above *is* the guard: if
`hsl(from currentcolor ...)` is invalid on an affected version, the declaration is
dropped and the preceding Sass-baked declaration wins -- the same mechanism that
covers Firefox 119-127. One empirical check settles both at once (does an affected
browser parse-fail or compute wrongly?), which is why ticket 08 owns it. Registering
the token via `@property` would **not** help here: `currentcolor` is itself a valid
`<color>`, so a `syntax: '<color>'` declaration accepts it. Documentation plus the
fallback declaration is the whole guard.

**No Foundation for Sites JavaScript, at all.** Standing user requirement,
reinforcing R016: everything must be Angular-native or browser-native. This is
not only about the component -- it forbids adopting Foundation's JS-side
dependencies to make its CSS behave. Concretely, Foundation's
`disable-mouse-outline` mixin (pulled in by `button-base`) emits
`[data-whatinput=mouse] .button { outline: 0; }`, and `data-whatinput` is set by
the **what-input** library that ships with Foundation's JS. Adding what-input to
activate that rule is forbidden; leaving it is inert but dead. The browser-native
replacement is `:focus-visible` (0/136 failing at the pinned baseline), which
R026 permits explicitly as accessibility-only CSS.

**D016 is superseded.** D016 formally re-scoped a real Express/Node SSR host out
of M001 and called the boundary "a deliberate scope boundary, not a gap". The
six-host requirement above overrides that. `.gsd/` is read-only, so the
supersession is reported to the user rather than written into the decisions
register. D016's stated *reasons* still matter though -- chiefly that SSR wiring
risks reopening the deliberately fragile D014/D015 registry-only consumption
isolation -- so treat them as risks to manage, not as a veto.

**Skills.** `/research` for every research ticket (background agent, primary
sources only). `/codebase-design` when shaping the SCSS module boundary.

**Research artifacts** land in `research/<NN>-<slug>.md` beside this map, not on
throwaway git branches -- five parallel agents on one Windows worktree would
fight over branch state, and the findings are wanted in the working tree anyway.

**Requirement contract already on the record** (do not re-derive):

- R026 blesses Angular's own `styles`/`styleUrl` + `ViewEncapsulation.None`
  pipeline (SharedStylesHost) as *not* CSS-in-JS, and names compiled SCSS
  referenced via `styleUrl` as the only default-styling source. Narrow content
  exceptions: accessibility-only CSS, and CSS replacing Foundation's JS
  animations.
- R025 mandates Directive for template-less blocks *except* where the
  Component-only per-instance stylesheet lifecycle is needed.
- D017 requires `@include`-ing Foundation's real button mixins over hand-rolled
  CSS, across the full `$button-palette` plus expanded and dropdown.
- D018's dual-file rtlcss RTL mechanism is tied to the precompiled-CSS pipeline,
  not to a `styleUrl`-delivered stylesheet -- so RTL is genuinely reopened.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [What does `styleUrl` + `ViewEncapsulation.None` actually guarantee?](issues/01-angular-style-lifecycle.md)
  -- all five claims confirmed empirically against v22.0.8: SharedStylesHost
  genuinely removes the `<style>` on last destroy, the client adopts
  server-emitted `ng-app-id` nodes by identity (so D013's duplicate-`<style>` cost
  disappears), component CSS is tree-shaken and never emitted as a `.css` file,
  `@layer` survives injection verbatim, and the lifecycle is structurally
  Component-only. Two consequences: D018's rtlcss dual-file RTL cannot survive
  `styleUrl` delivery (no CSS artifact to post-process), and the build reformats
  and minifies component CSS, so text-equality parity tests will fail.
- [How does Material let consumers theme CSS that Material itself compiled?](issues/04-material-theming-pattern.md)
  -- **Material already ships R026 and R020 together**: `button.ts:35` is
  `styleUrls` + `ViewEncapsulation.None`, compiled in Material's own Bazel build,
  and consumers still fully re-theme it via two-level `var()` token indirection
  (measured: 148 `var()` refs, zero hex, zero `@layer`). Sass-variable theming was
  abandoned -- consumer Sass generates token *values*, never rules. Overrides win
  by custom-property inheritance, which is strictly more robust than R008's
  `@layer`. `color-pick-contrast` has no CSS equivalent at any threshold, so
  contrast must stay Sass-time in the library build as the `var()` fallback --
  D017 survives. Provenance cleared on follow-up: audited at tag `v22.0.4` via
  object-database reads (blob hashes differ from `18.2.x` on every load-bearing
  file), and every measurement reproduced on the **published npm artifact** --
  where Material's authoring format is `styleUrl` and its shipping format is CSS
  inlined into `fesm2022/button.mjs`, independently confirming tickets 01 and 02.
  **Gate attached:** the original R008 cascade bug was never reproduced against a
  token build, so replay it before deleting `@layer nfs-defaults`.
- [How does one stylesheet mirror Foundation's physical properties for RTL?](issues/03-rtl-in-one-stylesheet.md)
  -- assign `$global-left: inline-start; $global-right: inline-end;` after
  Foundation's `@import`s and its **unmodified** `button-dropdown` emits
  `float: inline-end; margin-inline-start: 1em`. One stylesheet, no `[dir]`
  selector, no dependency, no specificity cost, D017 intact. The whole question is
  small: exactly two directional declarations exist, both on
  `.button.dropdown::after`. postcss-rtlcss rejected (its `[dir="ltr"]` never
  matches this repo's `dir`-less `index.html`); postcss-logical is the wrong
  direction of transform; `:dir()` is runner-up but costs specificity. **R004's
  existing proof is vacuous** -- the RTL e2e spec passes with no mechanism at all.
- [Can a `@use`-only API sit on Foundation's legacy `@import` Sass?](issues/05-modern-use-api-over-legacy-foundation.md)
  -- yes, via a theme **mixin** API (`@include nfs-button.theme($background: ...)`),
  not `@use ... with (...)`. Module config fails "no globals" twice (consumer must
  type bare `$primary-color`; configuration is inseparable from emission, costing
  5490 bytes of unwanted rules to read one token) and its once-only rule rejects
  even byte-identical duplicate configuration. The mixin API costs 0 bytes and
  reaches globals-only mixins via a proven `!global` rebind. Foundation-globals
  leakage into output measured at 49 bytes / 0.88%, so the no-duplication
  constraint already holds. Two shipped defects found -- the published `assets`
  glob exposes `_foundation-button.scss` so D018's isolation is advisory only, and
  `@use ... as *` silently ships unresolved CSS functions.
- [Can every builder compile the component's `styleUrl` SCSS?](issues/02-scss-toolchain-across-builders.md)
  -- yes, all four. Bare `foundation-sites/...` specifiers resolve in ng-packagr with
  zero configuration; PostCSS is hookable via `.postcssrc.json` at the **library
  root** (JSON only; a workspace-root config is ignored). Storybook is the outlier --
  webpack plus `sass-loader`, blind to `ng-package.json`, needing its own
  workspace-root-relative `stylePreprocessorOptions.includePaths`. A configuration
  exists that yields zero Sass deprecation warnings across build, test and
  build-storybook simultaneously.
- [Does the style pipeline behave identically across all six host configurations?](issues/12-styles-across-hosts.md)
  -- **yes, and `styleUrl` wins.** All six hosts stood up and observed: four distinct
  delivery mechanisms, one behaviour -- `@layer` preserved 8/8, cascade identical 8/8,
  ref-counting working 8/8 by default. The global-stylesheet alternative is *worse*,
  not safer: a plain SCSS import in `.storybook/preview.ts` silently no-ops in dev and
  hard-fails `build-storybook`. External-`<link>` mode preserves `@layer` too, and is
  not the dev default (needs `NG_HMR_CSTYLES=1`). One upstream dev-only defect found
  in that opt-in HMR mode. **D016's isolation concern remains open** -- SSR was never
  run against the Verdaccio-installed package.
- [Is there a CSS-native way to reproduce Foundation's `color-pick-contrast`?](issues/14-css-native-contrast-pick.md)
  -- **no mechanism adopted and none needed**; the compile-time-only theming decision
  closed it by scope. `contrast-color()` is UA-defined, takes no candidate list, and
  compares against pure `#fff`/`#000` rather than Foundation's `#fefefe`/`#0a0a0a`, so
  it picks *black* for `secondary` and `alert` -- a behaviour change, not an upgrade
  path. Houdini is refuted by grammar (`paint()` is an `<image>`; `@property` cannot
  reference another custom property), and the HSL clamp is provably infeasible. The
  ticket's real deliverables are two: a **ground-truth pick/ratio fixture** for the
  test replacing `verify-parity.mjs` (assert picks, not ratios -- Foundation's
  hand-rolled `pow()` inflates small linearised channels by up to 6.73x), and a
  **verified accessibility finding**: `alert`'s white-on-`#cc4b37` is 4.498:1, failing
  AA normal text by 0.002, in a variant R003's axe scan never covered.
- [Choose the styling-delivery and theming architecture](issues/06-choose-styling-architecture.md)
  -- **architecture A confirmed** and its four open details pinned: theme-mixin public
  API (`@include nfs-button.theme(...)`, keeping `$selector` and `$palette`, the latter
  being M002's compliant-theme hook); `compile-default-css` **survives simplified** to a
  single stylesheet with the RTL twin, `rtlcss` and `.rtlcssrc.json` retired as obsolete
  under logical properties; the intentional default-plus-override duplication documented
  rather than engineered away; and accessibility-only CSS (a `:focus-visible` replacement
  for the inert `disable-mouse-outline`) kept **in** `nfs-button.scss` with an R026
  comment rather than as a second `styleUrls` entry. **R020 is honoured literally**, and
  R022 needs its browserslist query re-pinned. Foundation's `@import` stays confined to
  one island, so the Dart Sass 3.0.0 escape is to vendor or freeze a single file.
- [Does the chosen styling architecture free NfsButton to be a Directive?](issues/07-component-or-directive.md)
  -- **no: it stays a Component, and R005 is what forces it**, not the styling-source
  requirement. The ref-counted style lifecycle is structurally Component-only, and the
  Directive-compatible alternative both sacrifices R005 and costs *more* configuration.
  R025 is satisfied by its own exception rather than violated, so **M003 S01's
  Component-to-Directive conversion should not happen** and wants re-scoping. R025's
  literal "empty template" shape is unverified and delegated to ticket 08 as guidance for
  future components.
- [Implement the chosen SCSS styling pipeline](issues/08-implement-scss-pipeline.md)
  -- built on branch `feat/scss-only-button-styling`, four commits, **all gates green**
  (lint, 59/59 unit, 2/2 browser, build, build-storybook) with **zero Sass deprecation
  warnings** in all four builders. Compiled-CSS diff against the old artifact is exactly
  four intended changes. **Two real bugs found and fixed**: `.button.hollow` was shipping
  the solid primary fill (the SCSS included `button-hollow-style` but never
  `button-hollow`), and `_settings.scss` contradicted itself on hover derivation (-15%
  precomputed vs -20% declared). **Check G came back worse than expected: both halves of
  R025's prescribed shape are unsafe** -- a non-projected host's children are dropped
  entirely, and an "omitted" template is not even expressible (`NG2001`). Consumer path
  changed to `ngx-foundation-sites/scss/button` (forced by a module loop) -- a breaking
  change for ticket 11 to document.
- [Delete the CSS-in-JS path and re-anchor the proofs](issues/09-delete-css-in-js-path.md)
  -- all three R026 artifacts gone, **all five gates green** (43/43 unit after the expected
  -16/+6 churn). R005's proof re-anchored on `isConnected`, which distinguishes a real
  `element.remove()` from a decremented counter; R018's on a **pinned `APP_ID`**, converting
  ticket 01's sole residual adoption risk into a covered case. `verify-parity.mjs` replaced
  by a **declaration-level** Foundation parity gate, now wired into `lint` (the old one was
  wired to nothing) and validated by re-injecting both of ticket 08's bugs. Finding:
  **Foundation 6.9.0 contradicts itself upstream** -- `_button.scss:36` defaults hover to
  -15% while `:77` declares -20%, so ticket 08's "bug 2" was inherited verbatim and
  NfsButton's -20% is a recorded deviation from stock Foundation's zero-config hover, not a
  fix. `@angular/common` left `peerDependencies`.
- [Stand up every host configuration as a verification target](issues/13-build-host-harnesses.md)
  -- **all six hosts pass**; `nfs-demo:e2e` is 24 green (4 hosts x 6 specs) plus Storybook
  16/16. **D016's real concern is closed with evidence**: the registry-consumption gate now
  covers the SSR bundle too, and no host fell back to workspace source. It found **two
  latent defects in that gate** -- a cached-tarball path that had already served a stale
  build, and an anti-vacuity needle that matched nothing after ticket 09's deletion, so the
  check was about to pass for the wrong reason. **One app, not two**, and the fog's framing
  was backwards: SSR did not add isolation surface, it exposed a pre-existing duplicate
  `@angular/*` install that broke route extraction with `NG0201`. **Corrects ticket 12:**
  `RenderMode.Server` must be explicit or the builder prerenders, so ticket 12's SSR rows
  were measuring SSG.
- [Re-verify every requirement gate end to end](issues/10-reverify-every-gate.md)
  -- **all fourteen requirements gated and green**; `nfs-demo:e2e` 36 passed, `test` 43/43,
  `test-browser` 2/2, `test-storybook` 17/17, plus lint, build, build-storybook, compodoc and
  registry consumption for both bundles. R004's gate can now **actually fail**, proven by
  re-injecting the physical `margin-left`. RTL ran in Chromium, **WebKit 26.5 and Firefox
  153** -- WebKit snaps the margin to 1/64 px, which broke the first draft's exact-equality
  assertion, and `float: inline-end` computes in both directions in all three engines.
  **Corrects an earlier prediction of mine:** the axe expected-failure set is **three**, not
  four -- `hollow alert` passes, because a hollow button pairs against the *page* background
  and this library ships no global styles, so hosts render on pure white (4.537) rather than
  Foundation's `#fefefe` (4.498). Hollow-variant contrast therefore depends on the consumer's
  page background, which is now a docs obligation.
- [Rewrite the theming docs to the new mechanism](issues/11-update-docs.md)
  -- README retargeted at the shipped pipeline (mixin API, changed entry point, precompiled
  CSS, `scss/internal/` boundary, migration notes, Foundation deviations), and the
  Accessibility section's false "all meet 4.5:1" claim replaced with the three real failures
  plus an unprompted "a green CI run is not a clean bill of health" note for the post-M002
  trap. `parity-review.md`'s RTL claim re-audited, catching a further pre-existing README
  error (`.button.expanded` emits physical-but-zero margins, not `margin-inline`). Autodocs
  verified by rendering. Stale-reference sweep: 10 hits, all deliberate migration references.
  **Surfaced two defects docs cannot fix** -> ticket 15.
- [Make the documented public API actually addressable, and autodocs actually document](issues/15-declare-subpath-exports-and-docgen.md)
  -- both fixed, full battery green. The `exports` declaration had to go in the library's
  **`package.json`**, not `ng-package.json` (which has no `exports` key; ng-packagr seeds its
  generated map from the source manifest). `"./scss/internal/*": null` wins by longest
  `patternBase`, so internals are refused while `./scss/button` and `./css/*` resolve --
  verified with both `require.resolve` and webpack's `enhanced-resolve`. **New finding:** Dart
  Sass's `NodePackageImporter` ignores `exports` for subpaths entirely, so `internal/` is now
  genuinely enforced for Node and exports-reading bundlers but still only a signal for Sass
  resolvers -- the README says exactly that. Autodocs needed three things aligned, not just
  `compodoc: true`: the default `.storybook/tsconfig.json` yields `components: []`, so the
  table would have stayed empty with docgen nominally enabled. Cost +2.6s (~17%) on
  `build-storybook`. Two items carried to ticket 16.
- [Gate the autodocs coverage, and remove the duplicated component description](issues/16-gate-the-autodocs-coverage.md)
  -- `verify-autodocs-coverage.mjs` added and wired so `test-storybook` reaches
  `build-storybook` **through** the gate. **Proven by breaking all three moving parts**: the
  `compodocArgs` tsconfig pin (-> `documents zero components`), `setCompodocJson` (-> source
  check fires), and `compodoc: false` (-> `build-storybook` itself fails first, because
  `preview.ts` imports the artifact). Also fixed a cache-correctness bug found on the way:
  `documentation.json` was missing from `build-storybook`'s `outputs`, so a warm cache would
  have failed the gate spuriously. The duplicated component description is gone and the
  rendered text survived byte-identical. Honest limitation recorded: `compodoc: false` with a
  *stale* artifact still passes locally -- a lesser, populated-but-stale defect that a clean
  tree turns into a hard build failure.

## Not yet specified

<!-- Graduated out of the fog (kept here only as a pointer, since a reader who
     remembers these as open should see where they went):
     * compile-default-css's fate -> decided in ticket 06 (survives, simplified to a
       single stylesheet; RTL twin and rtlcss retired).
     * disable-mouse-outline / focus visibility -> decided in ticket 06 (a
       `:focus-visible` rule inside nfs-button.scss under R026's exception, not a
       separate styleUrls entry). The rule itself is inert: R016 forbids the
       Foundation JS that sets `data-whatinput`.
     * Foundation _global.scss / util/util leakage -> measured in ticket 05 at 49
       bytes / 0.88%; constraint already satisfied, no action.
     * A leaner token API once relative colours clear the baseline -> moot. The
       compile-time-SCSS-only decision removes the token surface entirely. -->

- **Contingency for Dart Sass 3.0.0 removing `@import`.** Deprecated since
  1.80.0 (2024-10-17), removal no sooner than 2026-10-17; 2.0.0 unreleased and no
  3.0.0 milestone exists, so the real date is later but the floor is close.
  Foundation 6.9.0 is unmaintained and `sass-migrator module --migrate-deps`
  produces a non-compiling tree (a `math` <-> `unit` cycle). Options not yet
  sized: vendor and freeze Foundation's button Sass, pin `sass` below 3.0.0, fix
  the cycle upstream or in a fork, or hand-port the mixins. Not a blocker for this
  destination -- the architecture works today -- but ticket 06 must state its
  exposure.
- **What M002's in-browser Sass compilation needs from this package**, now that it is
  confirmed as the runtime-theming mechanism (R009 / R021) rather than a custom-property
  layer. Open: which Sass-in-WASM build to use and whether it supports `@import` at the
  versions required; what custom importer resolves both the library's own partials and
  bare `foundation-sites/...` specifiers in a browser; whether Foundation's SCSS source
  must be bundled into the addon or fetched at runtime; and how the addon's compiled
  output is injected so it beats the `styleUrl` default -- presumably the same
  unlayered-beats-layered mechanism a consumer's build relies on. Cannot be sized until
  ticket 06 fixes the public Sass API surface, since that is what the addon compiles
  against. M002 owns the build; this map only needs to avoid foreclosing it.
- Whether the chosen architecture generalises to the remaining 18 Foundation
  components, since this is the pattern-setting component.
<!-- Graduated: one-app-versus-two was decided in ticket 13, and the evidence inverted
     this patch's framing -- SSR added no isolation surface, it exposed a pre-existing
     duplicate `@angular/*` install. One app, four configurations. -->

<!-- Graduated: the Storybook RTL decorator / story question is now sharp and small
     enough to be part of ticket 10's R006 gate rather than a fog patch of its own. -->

- Layer ordering across multiple `ViewEncapsulation.None` components. Ticket 01
  established that append order is instantiation order, hence lazy- and
  `@defer`-dependent, and did not test two colliding layered sheets. Harmless
  while M001 has one component; becomes a real question the moment a second
  `nfs-*` component ships its own layered defaults, and may force a single shared
  layer name or an explicit `@layer` declaration order.

## Out of scope

- Actually converting NfsButton from Component to Directive -- that is M003
  S01's own job. This effort only decides whether the styling architecture
  *permits* a Directive (see
  [Does the chosen styling architecture free NfsButton to be a Directive?](issues/07-component-or-directive.md)).
- M002's runtime browser-Sass Storybook theming addon (R009 / R021).
- **The prebuilt WCAG/axe-compliant theme -- assigned to M002**, and M002 also owns
  re-pointing the axe suite at it. This map ships Foundation's default theme unchanged
  and documents its three known contrast shortfalls; it does not author an accessible
  palette. Groundwork this map must leave in place so M002 is not blocked:
  - Ticket 06's public Sass API must keep a whole-palette override expressible
    (`$palette:` as a theme-mixin argument, per ticket 05's design).
  - Ticket 10's axe spec must be parameterised by theme rather than hard-wired to the
    default, so M002 adds a second run instead of rewriting the spec.
  - Target numbers are already measured (ticket 14, `tmp/alert-options.mjs`): reaching
    AA on white needs `success` 39% darker (`#238648`) and `warning` 38% darker
    (`#9e6c00`); `alert` needs only 0.5% (`#cb4b37`).
  - Requirement changes to raise when M002 opens: R020's "ships precompiled default
    CSS" clause grows from one stylesheet to a set, and R003's proof moves onto the
    compliant theme.
- Publishing to npm (R019, deferred).
- Writing to `.gsd/` -- read-only projection, so no requirement/decision rows
  are authored here. Findings that belong there are reported to the user
  instead.
- **Filing anything upstream.** Standing user decision: do not file upstream reports.
  This covers Foundation's non-converging `pow()` defect (ticket 14), the
  `NG_HMR_CSTYLES=1` orphaned-`<link>` defect in `@angular/build` (ticket 12), and any
  future upstream finding. Record them in the research artifacts and move on; do not
  raise filing as an option again.
