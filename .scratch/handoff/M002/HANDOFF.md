# M002 hand-off: Storybook theming addon

**Everything M002 needs to be planned and executed.** Every decision below is
locked; nothing here is a proposal. Derived from two closed wayfinding efforts --
see `../README.md` for provenance, the supersession map, the boundary manifest, and
the five reusable measurement traps referenced from this file.

**Route-agnostic.** This states *what must end up in GSD*, not which interface puts
it there. Either the `gsd-workflow` MCP tools or a later `/gsd` session can apply it.

**Do not edit `.gsd/` by hand.** Those files are projected from a database.

**Evidence discipline.** `[VERIFIED]` / `[V-EXEC]` / `[V-BROWSER]` / `[V-REPO]` =
executed or read from shipped source. `[INFERRED]` = reasoned but not executed.
Section 11 lists everything still unverified. Much of this material's value is that
its claims were executed, not argued -- **do not let that distinction get flattened
during planning.**

**Depth** lives in `.scratch/m002-storybook-theming-addon/research/01..10` and
`research/12..15`, and (for the RTL clearance in section 3) in
`.scratch/settings-rtl-coupling/research/01..02`. Both source folders are read-only.

---

## Local index -- this hand-off is TWO files

Split only because the single file exceeded ~1000 lines. **Section numbers are
unchanged across the split**, so every cross-reference in either file still
resolves. Use this table to find a section.

| Section | Lives in |
| --- | --- |
| **0.** One-paragraph summary | `HANDOFF.md` (this file) |
| **1.** Sharpened R009 | **`REGISTER-TEXT.md`** |
| **2.** Sharpened R021 | **`REGISTER-TEXT.md`** |
| **3.** M002's RTL clean bill of health | `HANDOFF.md` |
| **4.** The D023 closure statement | `HANDOFF.md` |
| **5.** Decision-register rows D032-D045 | **`REGISTER-TEXT.md`** |
| **6.** R027 -- text lands here, work owned elsewhere | **`REGISTER-TEXT.md`** |
| **7.** R004 -- Notes-only amendment | **`REGISTER-TEXT.md`** |
| **8.** Requirements touched but not owned | `HANDOFF.md` |
| **9.** D020 costed | `HANDOFF.md` |
| **10.** Plan inputs | `HANDOFF.md` |
| **11.** VERIFIED vs INFERRED | `HANDOFF.md` |
| **12.** Application checklist | `HANDOFF.md` |

**Rule of thumb:** `REGISTER-TEXT.md` is the text to WRITE INTO GSD (requirement
replacements, register rows, the new requirement, the Notes amendment).
`HANDOFF.md` is everything needed to UNDERSTAND and PLAN it. Section 12 is the
checklist that drives both.

---

## 0. One-paragraph summary for a planner who never read either map

M002 adds a **workspace-local Storybook addon** that compiles the library's real
Foundation Sass **in the browser, inside a Web Worker**, and injects the result into
the preview, so a designer can **retheme the library live** without a rebuild. Six
curated controls (five palette colours + radius) are **Foundation globals**;
Button's `theme()` mixin is today's only consumer of them, and the controls map 1:1
onto that mixin's existing `$background` / `$palette` / `$radius` arguments, so
**`theme()`'s public signature does not grow**. M002 does add **one new public Sass
data module**, `ngx-foundation-sites/scss/theme`, holding `$wcag-palette` as the
single source of the WCAG-compliant palette -- which is what finally discharges the
standing human decision D023. The addon's compile call is a generated
**`THEMEABLE_MODULES` list** with one entry today, and the source generator takes
**N entry points today** because a single-entry closure is structurally blind to the
new `_theme.scss`. Two presets ship (Foundation default, WCAG-compliant); preset
"selected" is a *derived* property of live control values, never a stored flag.
Verification is four lanes: Vitest jsdom, Vitest real-Chromium, a new Playwright
project against the static Storybook build, and build-time `verify-*.mjs` gates.
**The addon also has a clean bill of health on RTL** -- verified three ways, and for
a structural reason rather than a numerical one (section 3).

`ngx-foundation-sites` is a library for **all** Foundation for Sites components.
Button is the first, not the scope. Nothing in this hand-off is justified on the repo
having one component; where a decision still holds only at today's scale, the
**threshold that changes it** is written down instead.

**What M002 does NOT own**, each with a named owner in `../deferred/HANDOFF.md`: the
Foundation settings-migration surface, cross-component RTL, `verify-foundation-parity.mjs`'s
mechanism-coupled defect, and the CI gate that satisfies R027.

---

## 3. M002's RTL clean bill of health

**Stated positively, so a closed milestone is not left under suspicion.** The
coupling effort existed partly because a more seamless settings surface could
activate RTL defects that are dormant at Foundation's defaults. It tested M002's
controls explicitly. They are clear.

> **M002 is NOT implicated. None of the addon's six live controls (`$global-radius`
> plus the five `$foundation-palette` colours) can activate RTL residue in any of the
> six defect classes, at any value tested. No M002 decision is re-opened, and M002's
> non-foreclosure list stands unchanged with its bill still at zero code plus one
> README paragraph.**

**Verified THREE independent ways** [T01 s1]:

1. **The shipped route** -- the real public `theme()` chain, which already carries
   R004's rebind: `invalid=0`, all six defect classes zero, for every control
   individually **and** for all six together.
2. **The maximal route** -- all 41 Foundation component mixins with the rebind, and
   the six controls driven as bare Foundation globals: 13 perturbations, six classes
   each, **zero change in every cell**. This is the **strong** form, not an inertness
   result restated: the controls are provably **live** at that level
   (`$global-radius: 6px` = +128 bytes) and still activate nothing.
3. **Statically** -- the transitive gate closure over all 109 rebind sites contains
   **none** of the six control names.

Static and dynamic agree, so the verdict is **not a value-sampling artefact**.

**The radius worry fails STRUCTURALLY, not by luck.** The radius-shaped defect class
is gated by a **boolean, not a radius**: c3 = 0/20 for `$buttongroup-radius-on-each`
true/false, **identically** at `$global-radius` 0, 6px and 50%. Independently,
Button's five direction-dependent declarations are a `float` and two margins, so its
radius sites are not directional at all [T02 s9]. The coupling map's own re-entry
condition ("unless the sensitivity map shows one of the addon's six controls activates
residue") was tested and is **NOT triggered**.

**Why this belongs beside R009's control table, and what it obliges.** The controls
are safe because they are *value* settings, and that is a general mechanism rather
than a measured list. The **value-vs-shape rule** and the standing re-entry condition
are written into R009's replacement text in section 1 (note beside the table, part 2),
merged with the pre-existing "vocabulary, not wiring" footnote. **Do not restate the
rule elsewhere** -- one statement, in the requirement text where a future control
author will actually read it.

**M002 action: none in code.** One M002 *recommendation* is refuted on measurement
(ticket 14's D1e hybrid) and one is upheld on stronger grounds (ticket 14's D1b, the
rebind stays Button-only). Nothing M002 shipped or decided needs to change. Both are
carried in `../README.md` section 2.1 and their live form is in
`../deferred/HANDOFF.md`.

---

## 4. The D023 closure statement

D023 (human, standing, `Revisable?: true`, never re-opened) reads:

> Foundation's default theme ships unchanged (no palette/`$white` alteration). A
> WCAG/axe-compliant theme ships in M002, and the axe suite runs against that
> compliant theme for its zero-violations proof. The default theme keeps an exact
> expected-failure assertion (never a blanket rule suppression) for its three known
> shortfalls.

**M003 left it open despite the founding brief assuming otherwise.** The brief
expected M002's WCAG preset to be "sourced verbatim from M003's already-proven
compliant theme, no duplicated values". **There was no such artifact.** The compliant
palette existed as one app-local `@include` in `apps/nfs-demo/src/styles.scss` plus
five prose/comment descriptions across tracked files. The library shipped nothing.

**Clause 1 -- "Foundation's default theme ships unchanged." Untouched, and verifiably
so.** `theme()`'s zero-argument path still reads `settings.$button-background` and
`settings.$button-palette`. `$wcag-palette` is inert data that emits nothing until a
consumer passes it -- verified at **0 bytes on `@use`**. `verify-foundation-parity`
compares compiled *declarations* and is structurally blind to a variable, so it stays
green **for the right reason**, not by luck. It is also inert with respect to the new
`_theme.scss`: the gate compiles a **fixed** three-`@import` reference island rather
than globbing, so an unreferenced new file cannot perturb it. (That gate has one
unrelated, mechanism-coupled defect. It is **not** an M002 item -- owner, both fault
directions, two threshold triggers and the minimal fix are in
`../deferred/HANDOFF.md` section 5. M002's only obligation is the prohibition: do not
copy its translation tables or Check 4's shape into any new gate.)

**Clause 2 -- "A WCAG/axe-compliant theme SHIPS in M002." This is the clause M003 left
open, and D033 closes it literally.** `$wcag-palette` becomes a member of a **new
public Sass module**, `ngx-foundation-sites/scss/theme`, present in the published
tarball's `scss/_theme.scss` and reachable by any consumer as
`@use 'ngx-foundation-sites/scss/theme' as nfs-theme;` -> `nfs-theme.$wcag-palette`.
"Ships" becomes true of the **artifact**, not of the demo app. The discharge is
**stronger** than under the earlier `_button.scss` placement, because the palette now
ships as a **theme** artifact rather than as a member of one component's module -- and
it still reaches its axe proof through the real `exports`-gated public subpath in both
CSR and SSR.

**Clause 3 -- "the axe suite runs against that compliant theme", and "an exact
expected-failure assertion, never a blanket suppression."** D036 locks the axe proof
**in place**: the `m002-compliant` fixture in
`apps/nfs-demo/e2e/nfs-button-a11y.spec.ts` stays the proof, unchanged in shape, and
after D033's collapse it scans CSS compiled from the **shipped module** rather than
from a hand-typed app-local copy -- delivered through a real published tarball over
the `exports`-gated public subpath, in **both CSR and SSR**. That is a stronger
discharge than the founding brief anticipated.

Because the compliant theme is now *also* a selectable addon preset, the link between
the preset and the axe proof is made by **identity, not by a second scanner** -- three
assertions chained:

1. Those three hexes clear axe (the existing `m002-compliant` fixture, zero
   violations, CSR + SSR, over the published package).
2. The addon seeds exactly those three hexes -- a lane-1 unit assertion reading the
   preset through the addon's own probe mechanism and comparing it against the same
   literals the fixture proves, plus a WCAG AA ratio computation.
3. Seeding renders them -- one Playwright assertion that the preview's success /
   warning / alert buttons compute to `#238648` / `#9e6c00` / `#cb4b37`.

`@storybook/addon-a11y` is **not** re-pointed, and no axe scan is added to any
Storybook lane.

**The frozen literals -- a constraint, not an implementation note.** The default
theme's three `expectedContrastFailures` entries -- `{alert, #fefefe, #cc4b37}`,
`{hollow-success, #3adb76, #ffffff}`, `{hollow-warning, #ffae00, #ffffff}` at
`nfs-button-a11y.spec.ts:67-98` -- are **FROZEN**. They must **not** be collapsed into
`$wcag-palette`, into any shared map, or into an import. An exact-set assertion has to
*name* what it expects; sourcing its expectations from the same map the code under test
uses makes it assert its input against itself, which is the subtle form of the blanket
suppression D023 forbids. Concretely:

- The three failure literals stay hand-written in the spec.
- The `m002-compliant` fixture keeps `expectedContrastFailures: []`.
- D033's comment-only edits at `app.component.ts:105-106` and
  `nfs-button-a11y.spec.ts:107` touch **prose only** -- never the fixture data at
  `:67-98`.
- **No new suppression, no `runOnly` narrowing, no rule disable anywhere in M002.**

One drift surface is knowingly left open: the README's hand-typed hexes. A
README-drift check was considered and **rejected** -- it is documentation drift, not
correctness drift; the axe fixture is the real gate, and the README paragraph's value
is precisely its concrete measured ratios.

---

## 8. Requirements M002 touches but does not own

**Flag these for the planner. Do not edit them as part of applying this hand-off**
(with the sole exception of R004's Notes above, and R003's closeout text below).

| Requirement | How M002 touches it | What the planner must do |
| --- | --- | --- |
| **R003** (WCAG AA + WAI-ARIA, `validated`) | Its scoping note explicitly says R003's full wording "is satisfied by M002's forthcoming WCAG/axe-compliant theme, against which the axe suite will also run once M002 lands". D033 + D036 make that true. | R003's Notes become stale the moment M002 lands. Plan a text update as part of M002's **closeout** -- and **do not** flip anything about the default theme's three disclosed shortfalls, which remain deliberate and gated. |
| **R008** (consumer theme output wins the cascade, `validated`) | The addon's unlayered output must beat the component's `@layer nfs-defaults` defaults. **Verified in real Chromium across all four insertion orders** with an order-detecting control -- inherited for free, no order tricks. | Do not treat this as new work. Do budget lane-2 assertion B2 (both orders + layered-only control), because that is the only lane where the assertion is non-vacuous. |
| **R026** (no CSS-in-JS, `validated`) | The addon injects browser-compiled CSS through JavaScript, and the ESLint rule **actually fires** on that code (2 errors, verified). D035 clause (f) draws the boundary via one `**/`-prefixed `ignores` entry on the existing block. | Budget the two new spec tests (exemption works; a *sibling* file in the same directory still fires) and the path-spelling divergence guard. **The config block count must stay 2** or `nfs-button.r026-lint.spec.ts`'s `toHaveLength(2)` breaks silently. |
| **R019** (publishing deferred) | D032 stops at "workspace-local", never at "ship it". Nothing new becomes publishable. Note that D033 does add one `exports` key to the library's *declared* surface -- that is API shape, not a release. | Confirm no addon `package.json`, no release-config neutralisation, and no publish step appears in any slice. |
| **R007** (docs incl. README theming guide, `validated`) | The addon needs one README section, which now also carries D037's direction disclosure and D040's silent-ignore limitation. `verify-autodocs-coverage` is deliberately **not** extended. | Treat the README section as an M002 deliverable; treat the gate extension as out of scope. |
| **R020** (precompiled default CSS) -- **STALENESS FLAG ONLY** | R020's Description says the library "also ships precompiled default CSS **(both LTR and RTL)**". That parenthetical is **already stale** -- the rtlcss dual-file build was deleted under D021/D026 -- and it goes stale a **second** way under the direction twins, where ONE sheet serves both directions. | **Not an M002 deliverable and not a deferred-milestone deliverable either.** Recorded here so it is not discovered as a surprise during planning. Fix it whenever a milestone next touches R020; do not open work for it now. |

---

## 9. D020 is load-bearing, unusual, and deliberately costed

**Record this so a future reader cannot mistake the unusual path for an accident.**

D020 is a **standing human decision with `Revisable?: false`**: SCSS variable theming
only, no CSS custom property theming surface. Exactly one theming mechanism -- Sass
variables -- with two places compilation can happen: the consumer's build, or the
browser. **M002 is that second place.** The constraint forbids the *mechanism*, not
the runtime-theming *capability*.

**Scope note, because it matters for a later milestone:** every clause of D020 is
scoped to the **theming surface**. A CSS custom property used to carry a *direction
sign* for an RTL transform is neither authored nor a token, so it is **not forbidden
by D020** -- though it is also not an independent option, since a custom property
cannot read direction and still needs a `:dir()` selector to set it. D020 governs
theming, not every use of a custom property.

**What the prior-art search found, and it is the answer rather than a gap in the
search:**

- **Zero Storybook addons compile Sass in the browser.** A code search for
  `compileString storybook addon` across GitHub returns nothing.
  `@storybook/addon-themes`, `storybook-addon-sass-postcss` and
  `storybook-design-token` all swap prebuilt CSS or preprocess at build time.
- **Not one first-party design system ships a compiler.** Carbon, Spectrum, Fluent
  (v8 and v9), Polaris and Ant Design all converged on CSS custom properties or JS
  theme objects -- the mechanism D020 forbids. Angular Material swaps prebuilt
  compiled CSS.
- **The one real architectural precedent is dead.**
  `storybook-addon-customize-antd-theme` compiled **Less** in the browser and has been
  stranded on Storybook 6 / antd 4 since 2021.
- **There is an abandonment report.** Ant Design Pro shipped browser Less compilation
  and published why they regret it: "the whole page is stuck", "not suitable for
  adaptation in a formal environment". Their fix was narrowing what the browser
  recompiles.

**M002 is deliberately doing what the ecosystem consistently chose not to do. That is
a legitimate design choice, not a mistake -- and it needs its justification recorded,
because the justification is narrow.**

**Where the browser compiler genuinely earns its keep:** it evaluates Foundation's own
Sass colour functions, maps and mixins against user input. Foundation derives hover
colours, text-contrast colours and the dropdown arrow colour via `scale-color` and
`color-pick-contrast`. The scaling measurement **reinforces** this from a new angle:
compile cost tracks **palette colour math specifically** (`badge` spends 133-173 ms to
emit 479 bytes; `off-canvas` spends ~10 ms to emit 8945), so the payload is buying
exactly the thing the time is spent on. **The case would NOT hold for a set of literal
pass-through values** -- if the controls were ever reduced to values that are simply
substituted into CSS, the CSS-custom-property mechanism would be strictly better and
D020's cost would be unearned. **That is the condition under which D020 should be
revisited, and it is the only one.**

**Two favourable conditions this repo has that Ant Design Pro did not:**

1. **The chain is narrow, and it stays narrow -- bounded in both size and time.** The
   closure is **floor-dominated**: 12 of the 13 Foundation partials are the shared
   `util/` + `global` floor, so each component's marginal cost is roughly one file
   (0.2-13.7 KiB). All 35 Foundation components come to **52 files / 212.9 KiB /
   46.2 KiB gzip**, and even the absolute `foundation-everything()` ceiling stays under
   ~11% of the `sass` payload. In time: **a theme apply over every component the six
   controls can affect costs ~1.2-1.4 s in the Worker -- less than the reference
   project needed for TWO components** -- because only 19 of Foundation's 35 component
   partials read any of the six curated globals and only 6 are in the expensive tier.
   Ant Design Pro's fix (narrow what recompiles) is this repo's starting point.
2. **The "whole page is stuck" failure is measured and eliminated.** Main-thread
   compilation blocks for 337 ms (~20 dropped frames). A single Worker takes the max
   main-thread frame gap to **19.1 ms** and is **~30% faster** (197 ms median vs
   280-305 ms). **One Worker converts the jank to nothing. A pool has nothing to
   overlap, because the apply is one compile** -- and the reference's own 20.5% is an
   N=2 artifact, not a law (measured pool gain reaches 4.1x by N=20 when there *is*
   something to overlap). The Worker decision gets **stronger** with component count:
   at the full-coverage 1.2-1.4 s apply, a main-thread compile would block **72-84
   frames**.

**The cost, attributed to the decision that causes it:**

> The **802 KiB gzip / 436 KiB brotli** Dart Sass payload is a cost of **D020**, not
> of the addon's implementation. It is what "no CSS custom properties, ever" buys, and
> it is the price of evaluating Foundation's real Sass functions against live input.
> No implementation choice in M002 reduces it: the sass bundle has **zero
> tree-shaking** (0 exports, 0 imports, 0 `__PURE__` across 133k lines), so lazy
> loading is about *when* the cost lands, not whether it can be reduced. Every design
> decision in this milestone already pushes it as late as possible -- it is fetched
> only on first theme interaction, and preview boot stays at 1140 KiB gzip.

**Number hygiene, because several figures circulate.** An early **~916 KiB gzip**
figure was a raw-file estimate and is **not** authoritative. **802 KiB gzip / 436 KiB
brotli** is the measured real bundled `sass` cost and is the figure to use; the
**emitted worker chunk** (sass plus the inlined sources) lands at roughly **801-825
KiB gzip** today and would reach **~890 KiB gzip** at full Foundation component
coverage. Also note **+70% on the preview's current 1140 KiB gzip** as the relative
framing.

**One more inherited clock, stated plainly:** the chain depends on Sass's `@import`
*and* global built-in functions, which are removed together in Dart Sass 3.0.0
(deprecated 1.80.0, floor 2026-10-17, realistically later). M002 inherits that clock
**exactly** -- it adds nothing and reduces nothing, and the Node build has identical
exposure today. One favourable side effect, stated and no further: the generated
sources module *is* the vendored snapshot of whatever closure the entry-point list
reaches -- 16 files today -- so the eventual freeze costs one deleted target.

---

## 10. Plan inputs

Six items a planner must schedule explicitly. Two of them **modify working targets**,
so they must be **named tasks**, not side effects.

### 10.1 The port-4400 collision -- a change to EXISTING wiring

`test-storybook` currently starts its **own** `static-storybook` on port 4400 via
`concurrently`. The new Playwright project also depends on `static-storybook`, on the
same port. `nx run-many -t e2e,test-storybook` would race two servers onto one port.

**Locked resolution:** refactor `test-storybook` off `concurrently` onto
`dependsOn: ["verify-autodocs-coverage", "static-storybook"]`. Nx then runs one
`static-storybook` task and both lanes attach to it, provably exercising the same
served artifact. `static-storybook` is genuinely `continuous: true` [VERIFIED], and
`apps/nfs-demo:e2e` already depends on four continuous serve targets, so the pattern
is proven in this repo.

**`wait-on tcp:4400` is KEPT, deliberately.** Nx's continuous-task ordering is
start-based, not readiness-based -- dropping `wait-on` trades a port collision for a
start-up race. The new Playwright lane gets the same treatment via a `globalSetup`
copied from `nfs-demo`'s polling one.

**Named fallback if continuous-task sharing misbehaves in CI:** give the e2e lane its
own port via a `static-storybook` configuration. Lower blast radius, but it leaves
`concurrently` in place, keeps two servers, and adds a port to remember.

**Carried as [INFERRED]:** that Nx shares one `static-storybook` task between two
dependents in a single `run-many`. Grounded in `continuous: true` and the
`nfs-demo:e2e` precedent, but the two-dependents case was not executed.

### 10.2 The atomic 3-part demo-app rewire

`apps/nfs-demo` consumes a **real published tarball**, not the workspace (D014 / D015,
gated by `verify-registry-consumption.mjs`). The installed tarball is a **snapshot**:
adding `$wcag-palette` to source does not reach the demo app.

If `styles.scss` is re-pointed at `nfs-theme.$wcag-palette` without refreshing the
tarball, the demo's Sass compile fails outright -- and it fails in `nfs-demo:build`,
which `serve` / `serve-static` / `serve-ssr` / `serve-ssr-node` all feed and which
`e2e` depends on. **The axe suite would go red for a resolution reason, not a contrast
one.**

**So this is ONE atomic change with three ordered parts:**

1. Add `$wcag-palette` to the **new**
   `packages/ngx-foundation-sites/src/scss/_theme.scss`, **and** add the
   `"./scss/theme"` key to the library `package.json`'s `exports` map.
2. Run `nx run nfs-demo:verify-registry-consumption` (rebuild -> republish ->
   reinstall) and commit the refreshed
   `apps/nfs-demo/.registry-consumption-evidence.txt`. This is already the established
   workflow.
3. Re-point `apps/nfs-demo/src/styles.scss:27-34` to
   `@use 'ngx-foundation-sites/scss/theme' as nfs-theme;` +
   `$palette: nfs-theme.$wcag-palette`.

Splitting this across commits leaves a broken demo build in between. Deferring it to a
follow-up is worse: the demo's copy is the **one executable restatement**, so leaving
it uncollapsed defeats D033 entirely.

**There is deliberately no gate for this. The sequencing IS the requirement.**
`verify-registry-consumption` gains no `dependsOn` -- it publishes to a local Verdaccio
and reinstalls, and making it a dependency of `lint` or `e2e` would put a registry
server in the standard battery. It does not need wiring because the failure it guards
is already loud. **Note one side effect of part 1**: adding the `exports` key
invalidates `verify-exports-map` -> `lint` once, which is expected and requires no
config change.

**Carried as [INFERRED]:** that a stale tarball fails `nfs-demo:build` with an
*undefined-variable* error specifically. The failure is certain; its exact message was
not executed. A missing `exports` key would additionally be a resolution failure --
though D033's evidence says Angular's importer would find the file anyway.

### 10.3 The four verification lanes

Full assignment is in R021's replacement text (section 2). What the planner must
schedule: four distinct lanes with **no assertion moved to a cheaper lane that cannot
observe its failure mode**, plus these two hard constraints --

- **`test-browser` must not be narrowed or removed.** It is the only lane with a real
  cascade (jsdom discards `@layer`-wrapped rules entirely) and the only place an
  authoritative CSS-validity oracle can exist. The deferred contract's C8 re-purposes
  the same lane as a regression tripwire, so removing it would break a later
  milestone's obligation too.
- **`verify-theming-sources` must never assert a literal closure file count.** Adding a
  module would turn a correct change into a red gate for the wrong reason. Assert the
  entry-point arrays and the byte-compare.

### 10.4 The addon-load assertion -- a GREEN BUILD PROVES NOTHING

This is the one assertion most likely to be quietly dropped as redundant. It is not.

- An **unresolvable addon only warns**. A **crashing manager entry is swallowed by an
  esbuild-injected try/catch**. So `build-storybook` exiting 0 is compatible with the
  addon being completely absent at runtime.
- **The gate is two-part, and both parts are required.**
  1. **Build-time (`verify-theming-bundle`)**: glob `sb-addons/*/manager-bundle.js` --
     **glob, never a hard-coded path**, because the addon bundle directory carries an
     order-dependent index and a hard-coded path yields "file not found", which a
     sloppy script reports as "addon not present": correct-looking, and equally wrong
     after any addon reorder. Then **content-match `ADDON_ID`** (verified to survive
     minification), assert **exactly one** match, and assert `index.html` **imports**
     it -- the `modulepreload` link is only a hint, and `iframe.html` contains **zero**
     `<script src=...>` attributes [VERIFIED], so a gate phrased against `<script src>`
     would have passed forever. Parse module-import specifiers instead.
  2. **Runtime (Playwright lane)**: panel tab present **AND zero manager
     `console.error`**. The console half is the only thing that catches the swallowed
     crash.

### 10.5 The mandatory negative controls

**A committed negative-control evidence file is a DELIVERABLE**, matching the repo's
existing `.autodocs-coverage-evidence.txt` / `.registry-consumption-evidence.txt`
precedent and M001/S11's break-and-observe practice. **Five entries, each a
break-and-observe run:**

1. Blank a generated source entry.
2. Rename `ADDON_ID`.
3. Add a static `import 'sass'` to `.storybook/preview.ts`.
4. Change the R026 `ignores` glob to the config-dir-relative spelling.
5. Comment out the `textContent` assignment.

**Entry 4 has no runtime symptom at all**, and **entry 3 protects a decision (lazy
loading) rather than a behaviour** -- which is exactly why both are mandatory rather
than nice-to-have.

**The anti-vacuity rules that go with them, restated as requirements:** every absence
assertion is preceded by a **presence** assertion over the same collection; every
compilation assertion is **differential**; every preset-equality assertion asserts
**both polarities**; the error-serialisation subject is meaningful only because of its
`structuredClone` control; the cascade assertion is **disqualified if its layered-only
control fails**.

**Four silently-green failure modes, each with a gate that is not optional:**

1. **The Worker silently not bundled.** If `@storybook/angular` ever spreads
   `cliConfig.module` wholesale, Angular's `worker: false` reaches the config and the
   worker module is not bundled anywhere -- **zero errors, zero warnings**, and a
   runtime 404. Gated by asserting the sources marker appears in exactly one emitted
   chunk.
2. **The R026 carve-out going inert.** A config-dir-relative `ignores` glob is exempt
   under the spec harness and **fires** under Nx's workspace-root cwd: green
   `nx test`, red `nx lint`. Gated per-commit by running the exempt file under both
   path spellings in one process, plus a one-line static assertion that every `ignores`
   glob starts with `**/`.
3. **A green build proving the addon loaded.** See section 10.4.
4. **Invalid CSS the browser silently drops.** **Not gated in M002 and not required to
   be** -- Button emits none of it. Named owner and named mechanism are in
   `../deferred/HANDOFF.md`; the M002-side obligation is only that the `test-browser`
   lane survives.

### 10.6 The latent island-preamble under-import defect -- FLAG, do not fix in M002

The repo's three-`@import` island shape (`util/util`, `global`, `components/button`) is
**under-imported for EMISSION**, not merely for compilation. `menu` and its relatives
need sassy-lists' `sl-remove()` via `-zf-each-breakpoint-in()`, and `dropdown-menu` /
`tooltip` need `typography/typography` -- Foundation's own `foundation.scss` imports
both preambles. Cost to fix: **+8 ms of floor, once.**

Why it matters to the planner and not to M002's code:

- **It is invisible today.** It fails only when a *second* component's rules are
  actually emitted, and it does so **inside the Worker**, where the diagnostic degrades
  (`isBrowser()` is false there).
- It is **not a compile failure**, it is an **emission** failure -- so no gate that
  compiles Button alone can see it.
- The trigger is the **2nd themeable module, any tier** -- correctness, not
  performance.
- The same three-`@import` shape is `verify-foundation-parity.mjs`'s fixed reference
  island, so that gate inherits the same insufficiency the moment a component beyond
  Button gets a parity gate. That is the second of the two triggers on that gate's
  disposition (`../deferred/HANDOFF.md` section 5).

**M002 action: none in code.** Record it, and carry R021's conditional lane-1
assertion (section 2) so it is asserted the moment it can fire.

---

## 11. VERIFIED BY EXECUTION vs INFERRED

**Do not let planning promote anything in section 11.2 or 11.3 to settled.**

### 11.1 VERIFIED -- the load-bearing M002 quantities

- The real `theme()` chain compiles to **5839 bytes, sha256 prefix
  `49bfb1a2e67bf91a`**, byte-identical across **six** producers including jsdom.
- The `sass` payload is **802 KiB gzip / 436 KiB brotli** measured; the emitted worker
  chunk is **801-825 KiB gzip** today; preview boot stays **1140 KiB gzip**.
- The generated closure is **16 files / 84.4 KiB raw / 24.1 KiB gzip**, bounded at
  **52 files / 212.9 KiB / 46.2 KiB gzip** for all 35 Foundation components.
- **Negative control: a single-entry closure over `nfs:/button` does NOT contain
  `nfs:/_theme.scss`.** This is why the generator takes N entry points today.
- **One compile over two themeable modules** emits both selectors and serves the
  Foundation island **once** (13 partials, not 26).
- **`_theme.scss` emits 0 bytes on `@use`** and is capturable through the custom Sass
  function on both the Node and browser paths (+1 file / +0.4 KiB raw).
- **jsdom discards `@layer`-wrapped rules entirely** (a layered-only rule computes
  `rgba(0,0,0,0)`). R008's unlayered-beats-`@layer` win is verified in real Chromium
  across **all four insertion orders** with an order-detecting control.
- **`@storybook/test-runner` cannot reach manager-side addon panels** [three ways].
  The Playwright harness was proven live against the real `addon-a11y` panel.
- **One invalid value drops the ENTIRE theme** from `?globals=` (five valid hex
  colours discarded alongside one bad radius), diagnosed only by an uncaught `warn`.
- **The R026 `ignores` glob must be `**/`-prefixed**: `@nx/eslint:lint` calls
  `process.chdir(systemRoot)`, so a config-dir-relative glob is inert under Nx while
  still passing the spec harness (green `nx test`, red `nx lint`). The rule **fires**
  on the addon's injection code (2 errors).
- **A four-variant real-webpack spike** emitted a separate worker chunk with the marker
  absent from the entry chunk; the `worker: false` negative control produced **zero
  errors and zero warnings** with the module bundled nowhere.
- Worker vs main thread: **197 ms median vs 280-305 ms**, max main-thread frame gap
  **19.1 ms vs 337 ms**. Full-coverage ceiling **~1.2-1.4 s**. The preset probe itself
  measured **1.1 / 0.7 ms**.
- **`ADDON_ID` content-matching survives minification**; `iframe.html` has **zero**
  `<script src=...>` attributes.
- **Pasting Foundation's entire 490-variable `_settings.scss` compiles
  byte-identically (5839 B) with no warning**, even with a value deliberately changed.
  `theme()`'s four arguments are airtight; a typo'd map key silently emits
  `.button.sucess` plus 932 B of junk CSS.
- **The `exports`-partial-name inference graduated to VERIFIED TRUE** (Node's resolver
  refuses the partial-name form under the identity map) -- and separately verified not
  to bind any consumer in this repo, because Dart Sass `loadPaths`,
  `NodePackageImporter` **and Angular's own importer** all bypass `exports` for
  subpaths.
- **M002's RTL clearance, three ways** (section 3), with the controls provably live at
  raw-Foundation level.
- `static-storybook` is genuinely `continuous: true`.

### 11.2 Untestable under the effort's no-code-changes constraint -- FOUR items

These are not "not yet done"; they were **structurally unreachable** while the effort
could not change code. Each needs a real acceptance step during execution.

1. **`sass` inside the REAL Storybook preview bundle.** A standalone webpack build with
   the verbatim Storybook config, plus static analysis of the real emitted bundle, was
   substituted.
2. **Cold HTTP-cache-over-network timing.** Every timing figure is warm-cache and
   local. The first real fetch of the ~802 KiB gzip chunk over a network is
   **unmeasured**.
3. **`build-storybook` with `test: true`.** The `--test` / esbuildMinify branch was
   built standalone and produced byte-identical CSS from a genuinely mangled bundle, so
   it is a **watch item, not a blocker** -- but the real Storybook `--test` path was
   not run, and D036 deliberately adds **no guard** for it.
4. **Non-Chromium engines.** Every browser measurement is Chromium. D036 deliberately
   excludes non-Chromium browsers from the Playwright lane: a Storybook addon's
   behaviour is not a CSS-engine claim, unlike `nfs-demo`'s logical-properties matrix.

### 11.3 [INFERRED] -- reasoned, not executed

- `import.meta.url` survives `@ngtools/webpack`'s transpile given `module: "preserve"`.
  Strong, and caught by the build-artifact gate if wrong.
- The worker `.ts` entry passes through `@ngtools/webpack`'s loader chain once it is
  inside `.storybook/tsconfig.json`'s `include`. Failure mode is a **hard build
  error**, not silence.
- The real `test-browser` lane (`@nx/angular:unit-test`, `ChromiumHeadless`) resolves
  `sass` the same way the standalone browser-mode probe did.
- `optimizeDeps.include: ['sass']` will be wanted in the browser lane.
- Nx shares one `static-storybook` task between `test-storybook` and
  `nfs-storybook-e2e:e2e` in one `run-many`. Fallback named in section 10.1.
- A stale tarball fails `nfs-demo:build` with an *undefined-variable* error
  specifically. The failure is certain; the message was not executed.
- The addon's emitted bundle directory will be
  `sb-addons/packages-ngx-foundation-sites-storybook-<N>/`. **The design never depends
  on it** -- the gate globs and content-matches (section 10.4).
- The end-to-end sparse-map URL round trip is verified **by parts**: `buildArgsParam`
  was executed; `parseArgsParam` and `updateFromPersisted` were read from source.
  `parseArgsParam` is not exported, so the composition was not run in one go.
- Un-debounced `updateGlobals` on every `input` event is acceptable channel traffic.
  Upgrade path named: a 50 ms trailing debounce on the **write** only.
- `data-nfs-seq` is a sufficient readiness signal for every Playwright style assertion.
  Derived from an already-required sequence number; the addon does not exist yet to
  observe it.
- Each themeable module's default selector (`.button` today) has no collisions in the
  preview chrome. Stated per-module rather than once.
- **The nfs half of the multi-component closure bound** -- ~200 KiB raw / ~43 KiB gzip
  for 35 public wrapper modules, extrapolated from `_button.scss`'s measured 12.5 KiB
  raw at the Foundation half's measured 21.7% gzip ratio. The Foundation half is
  measured; this half cannot be, because the modules do not exist. So the "~11% of the
  `sass` payload" ceiling is part-measured, part-inferred; the **measured-only** ceiling
  is **8.8%**.
- That a realistic multi-component architecture keeps **one** shared island rather than
  one per component. Grounded in the island existing to hold Foundation's globals as
  module members; not executed against a real second component.
- That a future component's `theme()` mixin accepts the same
  `$background` / `$palette` / `$radius` argument set. **The per-module argument-filter
  seam exists precisely because this is not known.**
- That the `THEMEABLE_MODULES`-driven entry string behaves identically inside the Worker
  to the Node probe. Strong -- same string construction, same `compileString` -- but the
  browser/Worker path was not re-executed in that pass.
- **Every browser-Worker figure in the scaling re-evaluation is a PROJECTION**, anchored
  on the measured 197.4 ms, not a direct browser measurement. The nfs wrapper modules
  for 34 of 35 components do not exist, so one series models them with Foundation's own
  component export mixins and another with N emissions of the real `_button.scss`.
  `progress-bar`'s emission cost specifically is `[INFERRED]`.
- That a custom property cannot read direction without a direction selector. Follows
  from CSS having no direction-valued function; not executed.

### 11.4 Measurement traps

**Five reusable measurement traps are stated once in `../README.md` section 5** --
`foundation-everything()` overwriting `$global-flexbox`; the truthy empty
`CSSRuleList`; declaration-order timing artefacts (three sightings, two of them from
M002's own probes); same-variable pairs invalidating additivity; intra-file guard walks
missing guards around the `@include`. **Trap 3 applies directly to any M002 timing
work**: two M002 findings ("1.7x regime shift", and a spurious uniform delta) were
declaration-order artefacts caught only by shuffling. **Trap 2 applies to any CSSOM
assertion added to lane 2.**

---

## 12. Application checklist

State-changes that must end up in GSD. **Route-agnostic** -- apply by whichever
interface is available.

1. **Update R009** -- replace Description and Validation with section 1's text,
   including the control table with **both** notes beside it (vocabulary-not-wiring
   AND the value-vs-shape rule with its trigger-6 re-entry condition), the
   delivery/mechanism block, the preset model with the corrected global-name probe, the
   split `exports`-map and qualified API-growth claims, the explicit
   `$global-text-direction` exclusion, and the README deliverable including the
   silent-ignore limitation. Status stays `active`.
2. **Update R021** -- replace Description and Validation with section 2's four-lane
   text, including the lane-1 `_theme.scss`-in-closure assertion, the module-agnostic
   subject framings, the "no literal file count" gate rule, the do-not-narrow
   constraint on `test-browser`, and the conditional island-preamble item.
3. **Append D032-D044** to the decisions register, from section 5, in that order, using
   the existing eight-column shape. Append-only; **D032 is the next free number**
   [VERIFIED]. **Apply D039 in its AMENDED form** -- the amendment notice explains why,
   and it must be made before the append, not after. Optionally append **D045** (D035
   clause (f) split out) last.
4. **Add R027** with section 6's text. Note explicitly in its record that its
   validation shape and owner live in `../deferred/HANDOFF.md`, and that **no M002
   slice schedules R027 work**.
5. **Append R004's Notes** from section 7. **Status stays `validated`; do NOT re-open.**
6. **Record the D023 closure** (section 4) wherever M002's milestone context lives,
   including the explicit statement that the default theme's three
   `expectedContrastFailures` literals are **FROZEN**.
7. **Record the D020 costing** (section 9) as milestone context. Do **not** edit D020's
   register row -- it is human, `Revisable?: false`, and append-only.
8. **Carry section 8 into planning as constraints on existing surfaces**, including
   R020's staleness flag as a note rather than as work.
9. **Carry section 10 into slice design**, especially the two items that change working
   code: the port-4400 refactor of `test-storybook` (a named task, not a side effect)
   and the atomic three-part demo-app rewire (one change, three ordered parts, no gate
   -- part 1 includes the `exports` key edit, which invalidates `verify-exports-map` ->
   `lint` once). Plus the flagged, no-code-in-M002 island-preamble defect.
10. **Carry section 11 forward** so the unverified items stay visible during slice
    design rather than being rediscovered during execution -- including that every
    multi-component performance figure is a projection anchored on one measured Worker
    median, and that the four items in 11.2 need real acceptance steps.
11. **Record M002's out-of-scope rulings with their named owners** so a later milestone
    inherits the ruling and its grounds rather than re-deriving them: the Foundation
    settings API (D040), cross-component RTL (D039 as amended, D042, D044),
    performance machinery (D038), user-saved presets, per-component control surfaces,
    and the `verify-autodocs-coverage` extension. **The map's "Not yet specified"
    section is empty and stays empty** -- everything deferred is deferred to a named
    owner, which is a scope ruling rather than an unknown.
12. **Do NOT carry the old "cross-ticket coupling / sequencing" item into the ROADMAP.**
    It is SUPERSEDED: there is no sequencing constraint between the two deferred
    milestones, and a fixed-settings gate of two compiles IS sufficient. What goes into
    the roadmap is `../deferred/HANDOFF.md`'s contract. See `../README.md` section 2.1.
