# Multi-component architecture corrections -- findings

Resolves ticket `.scratch/m002-storybook-theming-addon/issues/12-multi-component-architecture-corrections.md`.
Status: **resolved, corrections LOCKED** (AFK -- no human in the loop, per map.md Notes).

No repo file was changed. Everything written landed under `.scratch/`. Three
reproducible probes were left behind:

- `prototypes/multi-component-closure.mjs` -- bounds the source closure across a
  realistic component set (correction 4).
- `prototypes/exports-partial-name-probe.mjs` -- verifies ticket 07's one
  self-flagged inference across four resolvers (correction 1).
- `prototypes/global-home-probe.mjs` -- compiles the corrected placement and the
  N-module compile call in memory (corrections 1, 2, 3, 5, 6).

## Evidence key

- **[V-EXEC]** -- verified by executing a read-only command here, output quoted.
- **[V-REPO]** -- verified by reading a tracked file in this repo (path + line).
- **[V-SRC]** -- verified by reading shipped `node_modules` source (path + line).
- **[V-PRIOR]** -- carried from tickets 01-11's own verification, cited.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

## The test applied

From map.md Notes, the BINDING multi-component constraint:

> For each decision, does generalising cost anything **now**? If it is a
> *placement* or *shape* choice that costs nothing today and forces rework
> later, generalise it. If it is *machinery* with real cost and no present
> benefit, do not build it -- but restate the rationale as "one component
> exists today", never "this repo has one component", and keep the seam.

Applied literally. Nothing below builds machinery for absent components. Two
corrections turn out to be **required today** rather than generalised for later,
which is the strongest possible answer to the cost question -- see C1 and C3.

---

## 1. Summary table

| # | Decision touched | Class | One-line correction |
| --- | --- | --- | --- |
| C1 | **D033 / ticket 07** -- `$wcag-palette` lives in `src/scss/_button.scss` | **CORRECTED** | Moves to a new `src/scss/_theme.scss`, exported as `"./scss/theme"`. `_button.scss` is UNCHANGED and does **not** `@forward` it -- the two have no relation, because `theme()` takes the palette as an argument. |
| C1a | Ticket 07 s6 -- "a new module REQUIRES a new `exports` key, and that key is expensive" | **CORRECTED** | The inference is **TRUE** but binds **no consumer in this repo**; and the key costs one line in `package.json` with **zero** script, `ng-package.json` or target change. `verify-exports-map` diffs source-vs-dist keys and is agnostic to key count. |
| C1b | Ticket 07 s5 -- `internal/*: null` does not block the addon's reads | **UNAFFECTED** | Re-verified, and independently strengthened: Angular's own Sass importer bypasses `exports` for subpaths too. |
| C2 | **D035(d) / R009** -- the compile call is hard-wired to `@use 'nfs:/button'` + `@include nfs-button.theme()` | **CORRECTED** | A generated `THEMEABLE_MODULES` list; the entry string is built by mapping over it. One entry today. Genuinely free -- `entryFor()` is already a string builder. |
| C2a | **D035(d)** -- the addon passes no `$selector`, so it compiles `.button` | **RESTATED** | The decision is right and becomes *more* right as components land. `.button` is restated as "each themeable module's own default selector", of which `.button` is today's only instance. |
| C3 | **D034 / ticket 08** -- the generator "compiles the real chain" (singular) | **CORRECTED** | Takes **N entry points** and unions their closures. Required TODAY, not later: C1's `_theme.scss` is invisible to a single-entry closure -- proved by negative control. |
| C4 | **D034 / HANDOFF s7** -- closure is 13 Foundation + 3 library partials, 71.9 KiB / 24.3 KiB gzip | **CORRECTED (numbers) + RESTATED (conclusion)** | Measured bounds: 33-35 components = 52 files / 212.9 KiB / **46.2 KiB gzip**; absolute ceiling = 111 files / 349.1 KiB / **70.1 KiB gzip**. Ticket 08's "sources are nearly free" **survives**, restated as a bounded ~11%-of-`sass` rider, not "noise". |
| C4a | **D034** -- pre-flattening saves <0.5%, strictly dominated | **RESTATED** | Still dominated at full coverage (~0.4% of the worker chunk). The rationale no longer depends on N=1. |
| C5 | `internal/_settings.scss` mixes global and button settings | **FLAG + RESTATED** | Flagged only, as instructed. But the addon's **defaults probe must read the GLOBAL names** (`$primary-color`..`$alert-color`, `$global-radius`), not `$button-palette`/`$button-background`/`$button-radius`. Verified byte-identical today, so the swap is free and survives the eventual file split. |
| C6 | **R009** -- the control set is framed as Button `theme()` arguments | **RESTATED** | All six are Foundation globals (`$foundation-palette` keys + `$global-radius`). The control table gains a "Foundation global" identity column; "`theme()` argument" becomes "how it reaches Button's mixin today". No behaviour change. |
| C7 | `$global-text-direction` -- unconsidered omission | **DECIDED: OUT, on merit** | Provably **inert** in the current chain (two independent mechanisms, both verified), architecturally superseded by R004's logical-properties model, and would require `theme()` public API growth the map rules out. Not an omission any more. |
| C8 | Map "Out of scope -- Per-component control surfaces" | **RESTATED (already)** | Confirmed correct on the map's own better argument. Its "back in scope for ticket 12" clause is **discharged** by C2. |
| C9 | **D032 / ticket 06** -- delivery shape, `.storybook/`-resident | **UNAFFECTED** | Rests on `nx.json` cache coupling, live `workspaces`, R019 and consumer cost. No component-count premise anywhere. |
| C9a | Ticket 06's **amended rule 2** (ticket 08 s4.4) | **UNAFFECTED** | "Addon runtime code imports nothing outside `.storybook/`; it reaches the library's Sass through the generated module" holds unchanged at N -- the module just has more entries. |
| C10 | **D036 / ticket 10** -- four lanes, lane boundaries, gates G1-G3 | **UNAFFECTED** | No gate or lane assignment hard-codes the button in a way that needs rework. Two *subject* framings restated (G2d's marker, P2/P3's "the preview button"). |
| C10a | **D036** -- D023's axe proof stays in `apps/nfs-demo` | **UNAFFECTED** | The tarball route is stronger for the same reasons at any N. C1 makes it *more* natural: the palette becomes a theme artifact consumed through a public subpath. |
| C11 | **Ticket 04** -- Playwright harness at `apps/nfs-storybook-e2e/` | **UNAFFECTED** | Manager-reachability, `SbPage`, polling `globalSetup`, `dependsOn: static-storybook`. Every button reference is an incidental probe fixture. |
| C12 | **D035(f)** -- R026's stated boundary and the one `**/`-prefixed `ignores` | **UNAFFECTED** | A property of the injection file, not of component count. |
| C13 | **HANDOFF s7** -- D020's costing, favourable condition 1 ("the chain is already narrow") | **RESTATED** | Must carry C4's measured multi-component bound. The narrowness claim survives; the *number* backing it was button-only. |
| C14 | **HANDOFF s7** -- the single condition to revisit D020 | **UNAFFECTED** | "Literal pass-through values" is the right trigger and gets *stronger* at N (more Foundation colour functions in play, not fewer). |
| C15 | **D035(e)** -- no debounce, single Worker, no pool, no cache | **ROUTED TO TICKET 13** | Machinery with real cost. Section 6. |

---

## 2. The corrected decisions, in full

### C1 -- `$wcag-palette` moves to `src/scss/_theme.scss`

**CORRECTED. Supersedes ticket 07 section 1 and section 6, and D033's Choice
column.**

#### The problem, stated precisely

`$wcag-palette`'s keys are `success` / `warning` / `alert`. Those are
Foundation's `$foundation-palette` key names, mirrored into this repo at
`internal/_settings.scss:17-21` as `$success-color` / `$warning-color` /
`$alert-color` and assembled into `$button-palette` at `:48-54`
[V-REPO]. They are a **theme-level** vocabulary shared by every Foundation
component that takes a palette -- `callout`, `label`, `badge`, `button-group`,
`progress-bar`, `switch` all key off the same names -- not Button properties.

Ticket 07 chose `_button.scss` because it is "the EXISTING public entry point",
i.e. the only one that exists. That is exactly the expiring premise the map's
constraint forbids.

#### Why the cost argument that justified `_button.scss` does not survive

Ticket 07 flagged one inference as "the one inference the decision leans on":
that a new `scss/_presets.scss` would REQUIRE a new `exports` alias key, because
the identity map `"./scss/*": "./scss/*"` does not resolve the partial-name form
`scss/presets` -> `scss/_presets.scss`.

**The inference is CORRECT -- and it binds nothing that matters here.** Four
resolvers probed against a synthetic package carrying this repo's exact
exports-map shape, plus the real extracted tarball
`apps/nfs-demo/node_modules/ngx-foundation-sites` [V-EXEC,
`prototypes/exports-partial-name-probe.mjs`]:

```
=== F1: synthetic package, this repo's exports-map shape ===
exports: { './scss/internal/*': null, './scss/button': './scss/_button.scss', './scss/*': './scss/*' }
files:   scss/_button.scss, scss/_theme.scss, scss/internal/_settings.scss

R1 node exports  [OK]     RESOLVED  fakepkg/scss/button                    -> scss\_button.scss
R1 node exports  [FAIL]   REFUSED   fakepkg/scss/theme                     -> MODULE_NOT_FOUND
R1 node exports  [OK]     RESOLVED  fakepkg/scss/_theme.scss               -> scss\_theme.scss
R1 node exports  [FAIL]   REFUSED   fakepkg/scss/internal/settings         -> ERR_PACKAGE_PATH_NOT_EXPORTED

R2 sass loadPath [OK]     RESOLVED  fakepkg/scss/theme                     -> a { x: theme; }
R3 pkg: importer [OK]     RESOLVED  pkg:fakepkg/scss/theme                 -> a { x: theme; }
R3 pkg: importer [OK]     RESOLVED  pkg:fakepkg/scss/internal/settings     -> a { x: settings; }
R4 angular shape [OK]     RESOLVED  fakepkg/scss/theme                     -> a { x: theme; }
R4 angular shape [OK]     RESOLVED  fakepkg/scss/internal/settings         -> a { x: settings; }

=== F2: the REAL tarball at apps/nfs-demo/node_modules/ngx-foundation-sites ===
R1 node exports  [FAIL]   REFUSED   ngx-foundation-sites/scss/internal/settings    -> ERR_PACKAGE_PATH_NOT_EXPORTED
R4 angular shape [OK]     RESOLVED  ngx-foundation-sites/scss/internal/settings    -> compiled 13 bytes
```

Reading those rows:

1. **R1 confirms ticket 07's inference.** Node's own exports resolver refuses
   `scss/theme`; only the literal filename `scss/_theme.scss` gets through the
   identity map. So an exports-honouring resolver genuinely needs an alias key
   for a partial-named public module. **VERIFIED, closing ticket 07's open
   `[INFER]`.**
2. **R2 and R3 confirm ticket 07 section 5, extended.** Dart Sass `loadPaths`
   and Dart Sass's own `NodePackageImporter` (`pkg:` scheme) both resolve
   `scss/theme` **and** the `null`-mapped `scss/internal/settings`. `exports` is
   ignored for subpaths, as `README.md:123` records [V-PRIOR: research/07 s5].
3. **R4 is the row that dismantles the cost argument.** `apps/nfs-demo` builds
   with `@angular/build:application` [V-REPO: `apps/nfs-demo/project.json:10,41`],
   whose Sass importer is
   [V-SRC: `@angular/build/src/tools/esbuild/stylesheets/sass-language.js:126-152`]:
   an exports-honouring `resolveUrl` **first**, then a *"Check for package deep
   imports"* fallback that resolves `<pkgName>/package.json` to find the package
   ROOT and returns `join(packageRoot, ...pathSegments)` -- **never consulting
   the exports map for the subpath**. ng-packagr always emits `"./package.json"`
   [V-REPO: `apps/nfs-demo/node_modules/ngx-foundation-sites/package.json`], so
   the fallback's package-root lookup always succeeds. Replicated verbatim and
   executed: it resolves `scss/theme` in F1 and even the `null`-mapped
   `scss/internal/settings` against the REAL tarball in F2.

   *(Probe note worth keeping: F1's first run REFUSED both, because the synthetic
   fixture omitted `"./package.json"` from `exports`. That key's presence is the
   entire mechanism. A reader who reproduces this must include it.)*

So of the three consumers of `$wcag-palette`, **none** requires the exports key:
the addon reads through its own in-memory importer (no resolver at all
[V-PRIOR: research/03 s2]); the Node gates use `loadPaths`
[V-REPO: `scripts/verify-foundation-parity.mjs:34`]; `apps/nfs-demo` uses R4.

The key is still warranted -- a real npm consumer on Vite, esbuild or plain Node
*would* be refused, and `$wcag-palette` is public API discharging D023 clause 2.
But it is warranted for **correctness of the published surface**, not avoidable
at the price of misplacing a global concept.

#### And the key is cheap, verified

`verify-exports-map.mjs` reads the source and dist `exports` maps and diffs them
key-by-key with two loops [V-REPO: `scripts/verify-exports-map.mjs:64-97`]. It
does **not** enumerate `.scss` files, does not hard-code a key list, and treats
any new declared key as data. So adding `"./scss/theme": "./scss/_theme.scss"`:

- edits ONE line of `packages/ngx-foundation-sites/package.json`;
- requires **no** change to `verify-exports-map.mjs` -- the ticket's reading is
  right, the gate "exists to keep declared and built exports in sync, not to
  discourage entries";
- requires **no** `ng-package.json` change: the sole asset glob is
  `{glob: "**/*.scss", input: "src/scss", output: "scss"}`
  [V-REPO: `ng-package.json:5-11`], so a new `src/scss/_theme.scss` ships
  automatically;
- requires **no** new Nx target;
- invalidates the `build` -> `verify-exports-map` -> `lint` cache chain once
  [V-REPO: `project.json:68-99`], because `{projectRoot}/package.json` is a
  declared input of `verify-exports-map`. A one-time cache miss.

#### THE LOCKED CORRECTION

> **`$wcag-palette` lives in a NEW file
> `packages/ngx-foundation-sites/src/scss/_theme.scss`, declared public and
> exported as `"./scss/theme": "./scss/_theme.scss"`. It is Foundation-GLOBAL
> theme data, named for what it is.**
>
> **`_button.scss` is UNCHANGED and has NO relation to it.** It does not
> `@forward` it and does not `@use` it. `theme()`'s `$palette` is an ARGUMENT --
> the palette is data the *caller* supplies, so the component module never needs
> to see it.
>
> Consumers write two `@use` lines:
>
> ```scss
> @use 'ngx-foundation-sites/scss/theme' as nfs-theme;
> @use 'ngx-foundation-sites/scss/button' as nfs-button;
>
> @include nfs-button.theme($palette: nfs-theme.$wcag-palette);
> ```
>
> Declared as a plain assignment, NOT `!default`, for ticket 07's own recorded
> reason (there is no `@use ... with (...)` configuration surface left in this
> API) [V-REPO: `internal/_settings.scss:1-9`].

Verified to compile, with `_button.scss` untouched and the palette captured
through the addon's own custom-Sass-function mechanism [V-EXEC,
`prototypes/global-home-probe.mjs` Q1]:

```
=== Q1. TWO entry points: nfs:/theme + nfs:/button, _button.scss UNCHANGED ===
captured from nfs:/theme -> {"success":"#238648","warning":"#9e6c00","alert":"#cb4b37"}
css 5805 bytes | closure 17 files, 84.8 KiB raw, 24.2 KiB gzip
theme module appears in closure: true (size 462 bytes)
emitted CSS carries the compliant hexes: true
```

#### Why NOT `@forward` from `_button.scss`

The tempting "one-line compatibility" option is rejected on four grounds:

1. It creates **two public names for one member** (`nfs-button.$wcag-palette`
   AND `nfs-theme.$wcag-palette`). That is ticket 07's duplication problem
   relocated from value space into name space.
2. It restores the wrong-way coupling: a *component* module re-exporting a
   *global* concept, which is the error C1 exists to fix.
3. It would hide C3. A `@forward` puts `_theme.scss` back inside the
   single-entry closure, so the generator would keep working by accident and the
   N-entry-point requirement would stay latent (see the Q1b negative control
   below).
4. It buys nothing for consumers: nobody has written
   `nfs-button.$wcag-palette` yet -- `$wcag-palette` does not exist in the repo
   at all. There is no back-compat to preserve.

#### Why this correction is free NOW and expensive LATER -- the crux

`$wcag-palette` **does not exist yet**. It is an unshipped M002 deliverable
[V-PRIOR: map.md "Correction to the founding brief"; the palette has one
executable instance in `apps/nfs-demo/src/styles.scss:27-34` and five
descriptions, and the library ships nothing]. So today this is a pure placement
choice: one new file plus one `exports` line, no migration, no consumer impact.

The day component #2 lands, ticket 07's shape forces one of three bad outcomes:

- `_callout.scss` does `@use '../button'` to reach a palette -- a component
  depending on a sibling component for global data;
- the palette is restated per component -- reintroducing exactly the drift
  ticket 07 collapsed, and which ticket 01 measured in the reference project as
  **three mutually inconsistent** compliant palettes at HEAD
  [V-PRIOR: research/01 T4];
- or it is moved then, which is a **breaking rename of published public API**
  (or a permanent `@forward` shim, spending the "one fewer file" saving anyway).

That is the textbook shape of the map's test: free now, forces rework later,
therefore generalise.

#### What `_theme.scss` does NOT gain

Foundation's resolved DEFAULTS are still **not** promoted to public API. No
`$default-palette` / `$default-background` / `$default-radius`. Ticket 07's
reasoning stands unchanged [V-PRIOR: research/07 s5]: the only consumer of the
resolved defaults is the addon plus its tests, both of which read
`internal/_settings.scss` through an importer that bypasses `exports`. Exporting
them would be speculative generality. `_theme.scss` holds `$wcag-palette` and
nothing else today, and is the named home for future global theme data.

---

### C2 -- the compile call becomes a themeable-module list

**CORRECTED. Supersedes D035 clause (d) as recorded, and R009's
"compiles the mixin's own default `.button`" phrasing.**

#### What is hard-wired today

The addon's entry string is `entryFor()` in `prototypes/importer.mjs:123-141`
[V-REPO]:

```js
return `@use 'nfs:/button' as nfs-button;\n@include nfs-button.theme${args};\n`;
```

Two literals -- the module URL and the namespace -- baked into a template.

#### THE LOCKED CORRECTION

> **The compile call is driven by a LIST of themeable modules, and the entry
> string is built by mapping over it. The list has exactly one entry today.**
>
> ```ts
> // emitted into the generated data module by generate-theming-sources.mjs
> export const THEMEABLE_MODULES = [
>   { url: 'nfs:/button', namespace: 'nfs-button' },
> ] as const;
> ```
>
> ```ts
> const entry = [
>   ...THEMEABLE_MODULES.map((m) => `@use '${m.url}' as ${m.namespace};`),
>   ...THEMEABLE_MODULES.map((m) => `@include ${m.namespace}.theme${args};`),
> ].join('\n');
> ```
>
> **The list is authored in `generate-theming-sources.mjs` and EMITTED into the
> generated TS data module**, so the generator's closure and the Worker's compile
> call are provably the same list, and `verify-theming-sources`' byte-compare
> already covers it (C3).
>
> **No registry class, no plugin API, no config file, no per-component control
> surface.** The list is a `const` array.

#### Cost today: none, and that is verified rather than asserted

`entryFor()` is *already* a string builder with a conditional argument block. The
change replaces one hard-coded template literal with a `.map()` over a
one-element array: ~4 lines, no new file, no new concept, no new dependency, no
runtime branch. It removes an `as const` literal and adds a `const` array.

Proved to work as a **single compile emitting N components' rules**, with the
shared Foundation island compiled ONCE [V-EXEC,
`prototypes/global-home-probe.mjs` Q3]:

```
=== Q3. ONE compile, N themeable modules (button + synthetic #2) ===
entry:
  @use 'nfs:/button' as nfs-button;
  @use 'nfs:/probe-widget' as nfs-probe-widget;
  @include nfs-button.theme($palette: (success: #238648, warning: #9e6c00, alert: #cb4b37));
  @include nfs-probe-widget.theme($palette: (success: #238648, warning: #9e6c00, alert: #cb4b37));
css 6097 bytes
closure 17 files, 84.9 KiB raw, 24.2 KiB gzip (vs 16 / 84.4 / 24.1 at N=1)
Foundation partials served: 13  <- island compiled ONCE, not twice
both selectors present: .button=true .nfs-probe-widget=true
```

`Foundation partials served: 13` is the load-bearing number: the second module
reached Foundation through the same `internal/foundation-button` island, so the
13-file Foundation closure was served once, not twice. **A theme apply is ONE
compile whose CSS grows additively, not N compiles.** That is the compile
architecture ticket 13's scaling law depends on -- routed in section 6.

#### The seam that is deliberately NOT built

A component whose `theme()` mixin accepts a *subset* of
`$background` / `$palette` / `$radius` would error on an argument it does not
declare. The seam is one optional field on the list entry
(`args?: readonly ('background'|'palette'|'radius')[]`) filtering the argument
block. **Not built** -- there is no second mixin to know the shape of, and
guessing it is speculative generality. The list entry is an object literal
precisely so the field can be added without touching the call site.

#### C2a -- `$selector`: RESTATED, not corrected

The addon passing **no** `$selector` is right, and it gets righter as components
land. Its three recorded grounds [V-PRIOR: research/09 C.5] are all
component-agnostic: it is what the addon is for; it has zero divergence from
what a consumer writes; scoping needs story-wrapper machinery that exists only
to undo the first ground. Each module's mixin supplies its own default selector
[V-REPO: `_button.scss:59`, `$selector: '.button'`].

**The recording is what changes.** R009 says the addon "compiles the mixin's own
default `.button`" and D035(d) says "rethemes everything". Restate as: *the addon
passes no `$selector` to any themeable module, so each emits under its own
default selector -- `.button` being the only one that exists today.* The
blast-radius note ("`.button` is Foundation's class and nothing else in the
preview chrome uses it" [INFER, carried]) becomes a per-module property rather
than a global claim.

---

### C3 -- the generator takes N entry points

**CORRECTED. Supersedes D034's "compiles the real chain" and ticket 08
section 4.1 step 1.**

#### THE LOCKED CORRECTION

> **`generate-theming-sources.mjs` compiles a LIST of entry points and unions
> the closures its importer served.** Two arrays at the top of the generator:
>
> ```js
> // Modules whose rules the addon emits.
> const THEMEABLE_MODULES = [{ url: 'nfs:/button', namespace: 'nfs-button' }];
> // Additional modules the addon must be able to READ (preset data, globals).
> const DATA_MODULES = ['nfs:/theme'];
> ```
>
> Closure discovery compiles `@use` of every entry in both arrays plus
> `@include <ns>.theme()` for the themeable ones, and records every canonical URL
> served -- still **discovered by compiling, never hand-enumerated**, which is
> what makes `verify-theming-sources` catch an upstream `@import`-graph change
> [V-PRIOR: research/08 s7 Assertion A].
>
> `THEMEABLE_MODULES` is **emitted into** the generated TS data module (C2), so
> the list and the sources are one artifact and the byte-compare covers both.

#### This is REQUIRED TODAY, not generalised for later

The ticket asked whether the generator "may be nearly free" to generalise since
it already discovers by compiling. It is nearly free -- and C1 makes it
**mandatory**, because a single-entry closure structurally cannot see
`_theme.scss`. Negative control [V-EXEC, `prototypes/global-home-probe.mjs` Q1b]:

```
=== Q1b. NEGATIVE CONTROL: single-entry closure does NOT contain nfs:/_theme.scss ===
single-entry closure contains nfs:/_theme.scss: false  <- must be false
```

Nothing `@use`s `_theme.scss` -- by C1's design, `_button.scss` deliberately does
not -- so compiling only `nfs:/button` never loads it, it never enters the
committed sources module, and the addon's preset probe cannot read it. The
failure mode is a runtime `Can't find stylesheet to import` inside the Worker,
where Dart Sass's `isBrowser()` is false and the diagnostic degrades
[V-PRIOR: research/09 D.7]. **Caught at build time instead**, because the
generator's own compile is the discovery mechanism: if `nfs:/theme` is not in
`DATA_MODULES`, the generator itself fails.

#### Cost today

The generator does not exist yet -- it is an M002 deliverable. Writing it over
two arrays instead of one hard-coded string is not a cost, it is a different
first draft. ~5 lines of loop instead of ~2 lines of literal.

#### One honest complication this surfaces

`verify-foundation-parity.mjs` compiles its *own* reference island with a fixed
three-`@import` shape [V-REPO: `verify-foundation-parity.mjs:43-45`]. That is a
second, independent hard-wiring of "the chain" -- and C4's probe shows the
three-import shape is **not universally sufficient**: `dropdown-menu` and
`tooltip` fail it with `Undefined variable` until
`@import 'foundation-sites/scss/typography/typography'` is added [V-EXEC, below].
**Flagged, not corrected** -- the parity gate is out of this ticket's stated
scope, and a new unreferenced `_theme.scss` is inert for it (the gate compiles a
fixed pair, not a glob, so no declaration changes and it stays green for the
right reason). Route the per-component reference-island question to whoever plans
component #2.

---

### C4 -- closure sizing, measured across a realistic component set

**CORRECTED (numbers) and RESTATED (conclusion). Supersedes D034's decision
line, HANDOFF s7 favourable-condition 1, and HANDOFF s7's "vendored 16-file
snapshot".**

All figures [V-EXEC, `prototypes/multi-component-closure.mjs`], compiled not
extrapolated.

#### The baseline is confirmed exactly

```
=== 0. BASELINE: the real nfs button chain (nfs:/button) ===
served 16 files -- 13 foundation + 3 nfs
foundation raw 71.9 KiB | all raw 84.4 KiB | all gzip 24.1 KiB
default-theme CSS 5839 bytes
```

So the map's "13 files / 71.9 KiB" is the **Foundation subset**; the whole
closure the addon inlines is **16 files / 84.4 KiB raw / 24.1 KiB gzip**. Both
numbers circulate in the hand-off and they measure different things -- C4 fixes
that too.

#### The shared floor dominates, which is the finding

```
=== 1. SHARED FLOOR: util + global, no component ===
served 12 files | raw 59.9 KiB | gzip 17.6 KiB
```

**12 of the 13 Foundation partials are `util/` + `global`, shared by every
component.** Button's own marginal cost is **1 file / 12.0 KiB**. Per-component
marginal cost across all 35 Foundation components (each measured through the same
island shape):

| Marginal cost | Components |
| --- | --- |
| 1 file, 0.2-2.5 KiB | menu-icon, float, sticky, dropdown, badge, label, progress-bar, responsive-embed, thumbnail, title-bar, media-object, card, callout, flex, slider |
| 1 file, 3.0-5.0 KiB | breadcrumbs, drilldown, close-button, accordion, accordion-menu, reveal, visibility, tabs, orbit, top-bar, pagination |
| 1 file, 6.6-13.7 KiB | switch (6.6), table (7.4), button-group (7.6), menu (10.4), **button (12.0)**, off-canvas (13.7) |
| fails standalone | `dropdown-menu` (`$anchor-color`), `tooltip` (`$small-font-size`) -- both resolve once `typography/typography` is imported [V-EXEC] |

Button is in the top tier, matching ticket 01's finding that Button was the
reference's *slowest* component [V-PRIOR: research/01 s2.2].

#### The bounds

```
=== 3. UNION closure: util + global + all 33 working components ===
served 45 files | raw 184.4 KiB | gzip 41.0 KiB
vs button-only closure: files 16 -> 45, raw 84.4 -> 184.4 KiB, gzip 24.1 -> 41.0 KiB
```

With `typography` added so all 35 compile [V-EXEC]:

```
components compiling with util+global+typography: 35/35
UNION(util+global+typography+35 components): files=52 raw=212.9KiB gzip=46.2KiB
```

Absolute ceiling -- Foundation's entire tree via `foundation-everything()`
[V-EXEC]:

```
foundation-everything() closure: 111 unique files | raw 349.1 KiB | gzip 70.1 KiB | css 138.6 KiB
```

*(For reconciliation with the map's 367.6 KiB: that is the on-disk total of all
106 `.scss` files under `foundation-sites/scss` [V-EXEC]. The 111-file closure is
104 of those 106 plus 7 files in `foundation-sites/_vendor/sassy-lists/`, all
`.scss` [V-EXEC]. Both figures are right; they measure different sets.)*

#### The nfs half, bounded

The Foundation half is measured. The library half is not, because 34 of the 35
nfs wrapper modules do not exist. Bounded from what does exist
[V-EXEC]: `_button.scss` 5.7 KiB, `internal/_foundation-button.scss` 4.4 KiB,
`internal/_settings.scss` 2.4 KiB = **12.5 KiB raw / 4.4 KiB gzip** for one
component. At 35 public modules of comparable size that is ~200 KiB raw; applying
the Foundation half's measured gzip ratio (212.9 -> 46.2 = 21.7%) gives
**~43 KiB gzip [INFER]**.

#### The bound, and whether ticket 08's conclusion survives

| Scenario | Files | Raw | Gzip | % of the 801 KiB gzip `sass` bundle |
| --- | --- | --- | --- | --- |
| Button only (today) | 16 | 84.4 KiB | **24.1 KiB** | **3.0%** |
| 35 Foundation components, measured | 52 | 212.9 KiB | **46.2 KiB** | **5.8%** |
| + bounded nfs wrapper half [INFER] | ~89 | ~423 KiB | **~89 KiB** | **~11%** |
| Absolute Foundation ceiling | 111 | 349.1 KiB | **70.1 KiB** | **8.8%** |

**Ticket 08's "sources are nearly free" SURVIVES, and the rationale is
re-grounded rather than assumed.** But the wording must change. "Nearly free"
and "the saving is noise" were true at 3.0%; at full Foundation coverage the
sources are a **bounded ~11% rider on the worker chunk** -- the chunk grows from
~825 KiB gzip to roughly ~890 KiB, about +8%. That is not noise, and it is not a
problem either: it is bounded, it is an order of magnitude below the payload
D020 already commits to, and it lands lazily on first theme interaction
[V-PRIOR: research/08 s5].

The durable statement, replacing the N=1 one:

> The inlined sources are bounded by Foundation's whole Sass tree, which is
> ~70 KiB gzip. Even at full component coverage they stay under ~11% of the
> `sass` compiler payload they travel with, so the inlining decision is not
> sensitive to component count -- and the shared `util/` + `global` floor
> (12 of the 13 partials Button reaches) means the curve is
> **floor-dominated**: 12 files shared, then ~1 file and 0.2-13.7 KiB per
> component.

#### C4a -- pre-flattening stays dominated

Ticket 08 rejected pre-flattening partly on "the saving is under 0.5%"
[V-PRIOR: research/08 s3.2], computed at N=1. Re-grounded: even at the ceiling,
a perfect flatten removes per-file JSON escaping over ~70 KiB gzip of sources
against an ~890 KiB gzip chunk -- **~0.4%**. The saving does not grow with N
because escaping overhead scales with the same sources the flatten consumes.
Ticket 08's other three grounds (a novel Sass transform whose failure mode is
wrong-CSS-that-still-compiles; the load-bearing `!global` rebind ordering; the
vendor/freeze story) are all component-agnostic and get *worse* at N, since the
ordering constraint multiplies. **RESTATED, decision unchanged.**

---

### C5 -- `internal/_settings.scss`: flagged, and the probe's read targets corrected

**FLAG (as instructed -- no redesign) + one RESTATED consequence for the
addon's defaults probe.**

#### The flag

`internal/_settings.scss` currently holds two populations in one file
[V-REPO: `internal/_settings.scss:15-67`]:

| Population | Members |
| --- | --- |
| **Foundation GLOBAL** | `$white`, `$black`, `$primary-color`, `$secondary-color`, `$success-color`, `$warning-color`, `$alert-color`, `$global-margin`, `$global-radius` |
| **Button-scoped** | `$button-padding`, `$button-margin`, `$button-background`, `$button-background-hover-lightness`, `$button-color`, `$button-color-alt`, `$button-radius`, `$button-border`, `$button-hollow-*`, `$button-opacity-disabled`, `$button-transition`, `$button-palette`, `$button-sizes`, `$button-padding-*` |

Its own header calls it "PRIVATE defaults table for NfsButton's theme mixin"
[V-REPO: `:1`], which is accurate today and wrong the moment component #2 needs
`$white` or `$global-radius`. The natural landing shape is a split --
`internal/_global-settings.scss` seeding the nine globals, plus one
`internal/_<component>-settings.scss` per component -- with the island
(`internal/_foundation-button.scss`, which seeds Foundation's real globals from
both populations at `:30-49` [V-REPO]) consuming both. **Not this ticket's call
and not M002 scope.** Flagged so a planner sees it rather than discovers it.

#### The one consequence that IS this ticket's

Ticket 07's probe 2 read `settings.$button-palette`,
`settings.$button-background` and `settings.$button-radius`
[V-PRIOR: research/07 s4], and ticket 09 adopted that as the panel's baseline
source [V-PRIOR: research/09 B.4]. **Those are the three names that MOVE when the
file splits** -- they exist only because Button exists. The nine global names do
not move.

The globals give byte-identical values, verified [V-EXEC,
`prototypes/global-home-probe.mjs` Q2]:

```
=== Q2. defaults probe: GLOBAL names vs BUTTON-derived names ===
button-derived -> {"primary":"#1779ba","secondary":"#767676","success":"#3adb76","warning":"#ffae00","alert":"#cc4b37","radius":"0"}
global names   -> {"primary":"#1779ba","secondary":"#767676","success":"#3adb76","warning":"#ffae00","alert":"#cc4b37","radius":"0"}
IDENTICAL: true  <- the swap is free
note: button.palette also carries a 'primary' key (#1779ba), which theme() skips.
```

Mechanically why: `$button-background: $primary-color` [`:28`],
`$button-radius: $global-radius` [`:36`], and `$button-palette` is assembled from
the five `*-color` globals [`:48-54`] [V-REPO].

> **CORRECTED (probe read targets):** the addon's single probe compile reads
> `settings.$primary-color`, `$secondary-color`, `$success-color`,
> `$warning-color`, `$alert-color` and `$global-radius` -- **not**
> `$button-palette` / `$button-background` / `$button-radius`.

Cost today: **zero** -- six variable names instead of three, same file, same
importer, same compile, byte-identical results. It also removes a wart: reading
`$button-palette` hands the probe a spurious `primary` key that `theme()` skips
[V-REPO: `_button.scss:93-94`], so the probe currently has to know to ignore it.
Reading the globals gives exactly the six controls.

The addon still does **not** read Foundation's own `settings/_settings.scss`; it
reads this repo's `internal/` table, which is what `verify-foundation-parity`
gates [V-REPO: `verify-foundation-parity.mjs:27`]. Unchanged.

---

### C6 -- R009's control set is six Foundation globals

**RESTATED. Framing fix, no behaviour change. Supersedes R009's control table
header and HANDOFF s0's "retheme `NfsButton`".**

The current table's second column is "`theme()` argument", which makes the
control set read as *Button's* surface that happens to be global. It is the other
way round: all six are Foundation globals, and Button's mixin is one consumer.

> **Replacement table shape for R009** -- three columns instead of two, so the
> durable identity leads and the Button mapping is explicitly "today":
>
> | Control | Foundation global | Reaches Button's mixin today as | Default | Wire format |
> | --- | --- | --- | --- | --- |
> | primary | `$foundation-palette.primary` (`$primary-color`) | `$background` | `#1779ba` | lowercase `#rrggbb` |
> | secondary | `$foundation-palette.secondary` | `$palette.secondary` | `#767676` | lowercase `#rrggbb` |
> | success | `$foundation-palette.success` | `$palette.success` | `#3adb76` | lowercase `#rrggbb` |
> | warning | `$foundation-palette.warning` | `$palette.warning` | `#ffae00` | lowercase `#rrggbb` |
> | alert | `$foundation-palette.alert` | `$palette.alert` | `#cc4b37` | lowercase `#rrggbb` |
> | radius | `$global-radius` | `$radius` | `0` | JS `number`, integer CSS px, 0..32 |
>
> **The set stays closed at six.** Nothing is added. What changes is that the
> surface's generality is now explicit rather than accidental, which is what
> makes the map's "Out of scope -- per-component control surfaces" entry correct
> on its merits (C8) and what makes C2's list a plumbing detail rather than a
> surface question.

Evidence: `internal/_settings.scss:17-21` mirrors Foundation's own
`$foundation-palette` naming, with `$global-radius: 0` at `:24`, and its comment
at `:45-47` states the intent -- "Keys and colors match Foundation's own
`$foundation-palette` naming so `_foundation-button.scss` can seed Foundation's
real button mixins with it unmodified" [V-REPO]. Foundation's own
`settings/_settings.scss:97` and `_global.scss` carry the same vocabulary
[V-SRC].

One knock-on: HANDOFF s0 says the addon lets a designer "retheme `NfsButton`
live". Restate as "retheme the library live" -- with Button as the only component
that currently has a theme mixin to retheme.

---

### C7 -- `$global-text-direction` is OUT, on merit

**DECIDED. Ticket 01 exposed it as a live control in the reference; this map
never considered it. It is now considered and declined, with evidence.**

Four independent grounds, three of them verified by execution or source reading.

**1. It is provably INERT in this repo's chain, by two separate mechanisms.**

Foundation derives the directional globals from it, non-`!default`
[V-SRC: `foundation-sites/scss/_global.scss:108,127-128`]:

```
scss/_global.scss:108: $global-text-direction: ltr !default;
scss/_global.scss:127: $global-left: if($global-text-direction == rtl, right, left);
scss/_global.scss:128: $global-right: if($global-text-direction == rtl, left, right);
```

But `internal/_foundation-button.scss:66-67` reassigns them **after** the
`@import`s, unconditionally, to logical properties [V-REPO]:

```scss
$global-left: inline-start;
$global-right: inline-end;
```

So whatever `$global-text-direction` a control set, lines 127-128's result is
overwritten before any mixin reads it. The file's own comment says exactly why:
"Foundation's UNMODIFIED `button-dropdown` then emits
`float: inline-end; margin-inline-start: 1em` and the single stylesheet serves
both directions -- no `[dir]` selector, no `:dir()` specificity cost, no
postcss-rtlcss, D017 intact" [V-REPO: `:55-65`].

The **only** direct read in the button chain is
[V-SRC: `foundation-sites/scss/components/_button.scss:84-86`]:

```scss
@if $global-text-direction == 'rtl' {
  $button-margin: 0 0 $global-margin $global-margin !default;
}
```

That is a top-level `!default` assignment -- and the island already seeds
`$button-margin` non-`!default` **before** the import
[V-REPO: `internal/_foundation-button.scss:37`], so the `!default` never fires
regardless of direction. **Both paths are closed. A direction control would be a
knob wired to nothing.**

**2. It is architecturally superseded.** M003 delivered RTL as
logical-properties-only, no `[dir]`, no rtlcss [V-PRIOR: map.md "Ground truth
from M001 and M003"; R004]. A direction control asks the compiler to emit a
*directional* stylesheet, which is precisely the output that architecture exists
not to produce. The map's own note that M003's RTL "may make a direction control
redundant" is the right instinct, and it resolves to redundant.

**3. It would require public Sass API growth.** `theme()`'s signature is
`$selector` / `$background` / `$palette` / `$radius`
[V-REPO: `_button.scss:58-63`], and extending it is explicitly out of scope
[V-PRIOR: map.md "Out of scope"]. `$global-text-direction` is not in
`internal/_settings.scss` at all [V-REPO] -- this library does not expose it as a
knob anywhere, by design.

**4. And the reason it stays out does NOT expire -- which is why this is not a
"one component" answer.** Direction *does* matter to future components. Six
Foundation files read `$global-text-direction` directly
[V-EXEC, full sweep of the tree]:

```
scss\components\_breadcrumbs.scss:84    scss\components\_drilldown.scss:108,112
scss\components\_dropdown-menu.scss:222 scss\components\_slider.scss:135
scss\forms\_input-group.scss:38,44      scss\_global.scss:131 ($-zf-flex-justify)
```

So component #2 may well have direction-dependent output. But per R004's
architecture the correct treatment is the one `_foundation-button.scss` already
demonstrates -- a post-import logical-property rebind in that component's island
-- **not** a runtime direction toggle in a theming addon. Direction is a *library
RTL* concern owned by R004, not a *theme variable*. That framing holds at any N.

> **LOCKED: `$global-text-direction` is NOT a control, now or as components
> land.** Recorded as a considered rejection, so a future reader does not
> re-derive it. If RTL preview ever becomes a Storybook need, the right shape is
> a `dir` attribute toggle on the preview root (a Storybook-level concern that
> costs no Sass compile), never a Sass variable in the theme map.

---

### C8 -- per-component control surfaces: RESTATED, and the deferred half discharged

The map already corrected this entry's reasoning, and the correction is right:
the curated variables are Foundation-global concepts, so a global surface is the
*correct* shape and becomes more correct as components land. C6 makes that
explicit in R009's own text rather than leaving it in an Out-of-scope note.

The entry's second half -- "**back in scope for ticket 12**: the compile call
being hard-wired to `nfs-button.theme()` and the `.button` selector with no
extension point" -- is **DISCHARGED by C2** (the module list) and **C2a** (the
selector framing). Update the map entry to say so rather than leaving it open.

---

## 3. The sweep: 01, 04, 06, 10

Confirmed rather than assumed. `rg -n -i 'one component|single component|only
component|button-only|two components|per-component|nfs-\*'` over
`research/01,04,06,10` [V-EXEC] returned **seven hits, all in research/01, all
performance**:

```
research/01:238: **Button was the slow one** (~1.3-1.6 s), and this repo's only component IS the
research/01:253: with one component and a 6-file graph the number may be much smaller than the
research/01:298: 2. **Worker or main thread?** The reference went worker-pool-per-component, then
research/01:300:    component dominates ... With ONE component
research/01:307:    With 6 controls and one component the cache key space is tiny; a plain Map may
research/01:168 / :246  -- descriptions of the reference's own per-component machinery
```

Zero hits in 04, 06, 10. A follow-up `rg -F "'.button'"` over 04/06/10 returned
exit 1 -- no hits [V-EXEC], so no gate or lane assignment carries the selector
literal.

| Source | Verdict | Detail |
| --- | --- | --- |
| **research/01** | **ROUTED TO 13** | Every premise-carrying line is a performance rationale (pool, cache, debounce, slowest-component-dominates). Ticket 13 owns them and its own ticket text already enumerates them. Ticket 01's *prior-art* conclusions -- zero Sass-in-browser addons, no first-party design system ships a compiler, the antd-theme precedent, the Ant Design Pro abandonment report -- are component-agnostic. **UNAFFECTED.** |
| **research/04** | **UNAFFECTED** | The lane's whole content is manager-reachability (`@storybook/test-runner`'s `page` is the preview iframe, proven three ways), the `SbPage` shape, the polling `globalSetup`, and `dependsOn: static-storybook`. Every button reference is an incidental probe fixture: story ids (`nfsbutton--primary`, `example-button--primary`), a `locator('button')`, a `getByRole('button', {name:'Rerun'})`, and Foundation's 0.25 s `.button` `background-color` transition -- which is a *Foundation* property that applies to more components as they land, so the "disable transitions before any computed-colour read" rule gets MORE load-bearing, not less. |
| **research/06** | **UNAFFECTED** | The `.storybook/`-resident decision rests on: `nx.json`'s `production` input excluding `.storybook/**` but not a sibling directory; live `workspaces: ["packages/*"]`; R019; stale-cache silence for an out-of-`{projectRoot}` package; and pushing the `sass` cost onto consumers. None mentions a component. The `include`-line cost in `.storybook/tsconfig.json` is per-subdirectory, not per-component. Its **amended rule 2** ("addon runtime code imports nothing outside `.storybook/`; the generator is a build script reading workspace-relative paths") holds unchanged at N -- the generated module simply carries more entries. Only button references are the R026 spec **filename** and the already-amended public specifier. |
| **research/10** | **UNAFFECTED**, two subject framings **RESTATED** | Lane assignment (jsdom vs real Chromium vs manager vs build gates) is a capability axis. G1's byte-compare and fitness digest, G2a's `ADDON_ID` glob, G2b/G2c's sass-marker-and-not-in-`iframe.html`, G3's five negative controls, T9's R026 block count, the port-4400 refactor, D023's axe location, the anti-vacuity rules and the two vacuity traps -- all component-agnostic. **Restate two subjects:** (i) **G2d** names `$button-background-hover-lightness` as the Foundation-source marker [V-PRIOR: research/10 s4 G2d]; durable framing is "a marker from the generated source closure", with the button one as today's instance -- it stays valid because Button will remain an entry point, so this is a wording fix, not a gate change. (ii) **P2/P3** say "the preview button"; restate as "a themed element of each themeable module", Button today. Neither changes an assertion. |
| **D036 / D023 axe location** | **UNAFFECTED, strengthened** | Keeping the axe proof in `apps/nfs-demo` over the published tarball is right at any N. C1 makes it more natural: the compliant palette becomes `ngx-foundation-sites/scss/theme`, a *theme* artifact consumed through a public `exports`-gated subpath -- which is a better thing for a real-consumer axe proof to exercise than a member of a component module. The three frozen `expectedContrastFailures` literals stay frozen, untouched by anything here. |
| **D035(f) / R026 boundary** | **UNAFFECTED** | A property of `inject-theme-style.ts` and of the `**/`-prefixed glob under Nx's workspace-root cwd. Component count is irrelevant. |
| **HANDOFF s7 / D020 costing** | **RESTATED** (see C4 and C13) | The "802 KiB gzip is D020's cost, not the addon's" attribution survives and gets *stronger*: even at full coverage the sources stay an order of magnitude below the compiler payload. Favourable-condition 1's *number* was button-only and must carry C4's bounds. The single D020-revisit condition ("literal pass-through values") is component-agnostic and gets stronger at N. |

---

## 4. What each correction costs TODAY

The crux of the test. Honest, including where a correction has real cost.

| Correction | Cost today | Verdict |
| --- | --- | --- |
| **C1** `_theme.scss` + `"./scss/theme"` exports key | **REAL BUT SMALL.** One new ~0.5 KiB source file; one line in `package.json`'s `exports`; one-time cache invalidation of `build` -> `verify-exports-map` -> `lint`; consumers and the README sample write two `@use` lines instead of one; the closure grows **+1 file / +0.4 KiB raw / +0.1 KiB gzip** [V-EXEC Q1]. **No** script change, **no** `ng-package.json` change, **no** new Nx target, **no** migration (the member does not exist yet). The atomic 3-part demo rewire is unchanged in shape -- only the specifier it points at changes. | **TAKE IT.** This is the one correction with a non-zero bill, and it is the smallest possible one against a later breaking rename of published API. |
| **C1a** restating ticket 07's cost argument | Zero -- a documentation correction. | **TAKE IT.** |
| **C2** themeable-module list | **ZERO.** `entryFor()` is already a string builder; one hard-coded pair becomes a `.map()` over a one-element array. No new file, no new concept, no runtime branch, no new dependency. | **TAKE IT.** Genuinely free, as the ticket hoped. |
| **C2a** `$selector` framing | Zero -- wording. | **TAKE IT.** |
| **C3** N entry points in the generator | **ZERO, and it is not optional.** The generator does not exist yet; two arrays instead of one literal is a different first draft, ~5 lines. C1 makes the second entry point mandatory *today* (Q1b negative control). | **TAKE IT.** |
| **C4** re-grounded closure numbers | Zero -- measurement plus wording. The conclusion does not flip, so no decision reverses. | **TAKE IT.** |
| **C4a** pre-flattening rationale | Zero -- wording. | **TAKE IT.** |
| **C5** probe reads the global names | **ZERO.** Six variable names instead of three, same file, same importer, same compile, byte-identical values [V-EXEC Q2]. It also *removes* the spurious `primary` key the probe currently has to ignore. | **TAKE IT.** |
| **C5** splitting `internal/_settings.scss` | **NOT DONE.** Real cost (touches the island's 20 seed assignments and `verify-foundation-parity`'s subject), zero present benefit. Flagged only, per the ticket. | **DEFER, seam noted.** |
| **C6** R009 control-table reframing | Zero -- one extra table column in requirement text. | **TAKE IT.** |
| **C7** `$global-text-direction` OUT | Zero -- a recorded rejection replaces an unconsidered omission. | **TAKE IT.** |
| **C8** map entry update | Zero -- wording. | **TAKE IT.** |
| **NOT taken: per-module argument filters** | Would need a second mixin's signature to design against. | **SEAM ONLY** (optional field on the list entry). |
| **NOT taken: per-component control surfaces** | Ruled out on merit by C6, not deferred by cost. | **OUT OF SCOPE, correctly.** |
| **NOT taken: per-component source chunks** | Machinery. | **ROUTED TO 13.** |
| **NOT taken: parity gate's per-component reference island** | Real cost, no present need (`_theme.scss` is inert for it). | **FLAGGED for whoever plans component #2.** |

**Net bill for all of C1-C8: one new Sass file, one `exports` line, one cache
invalidation, and wording.** Everything else is free or a deferral with a named
seam.

---

## 5. What supersedes what

Required by the ticket so the hand-off can carry the correction rather than
silently contradicting the research documents. Research files are unedited by
design.

| Superseded | Superseded by |
| --- | --- |
| `research/07` s1 (LOCKED decision: `$wcag-palette` in `_button.scss`) | **C1** |
| `research/07` s6 (why a separate module is "the expensive form") and its `[INFER]` in s11 | **C1a** -- inference verified TRUE for exports-honouring resolvers, and shown to bind no consumer here |
| `research/07` s6's "the file can be extracted the day a second component has a theme mixin, and extracting it is then a mechanical `@forward`" | **C1** -- extraction happens now; the `@forward` is rejected on four grounds |
| `research/07` s4 / s10 (probe reads `$button-palette` / `$button-background` / `$button-radius`) | **C5** |
| `research/07` s9 "Untouched: `package.json`'s `exports` map -- the single most valuable thing this shape protects" | **C1a** -- one key, one line, no script change; the gate is agnostic to key count |
| `research/08` s1 / s4.1 (generator compiles "the real chain", singular) | **C3** |
| `research/08` s3.2 / s5 / s9 closure figures ("16 files / 87.7 KiB raw / 24.3 KiB gzip"; "the saving is noise") | **C4** / **C4a**. Note the baseline re-measures at **84.4 KiB raw / 24.1 KiB gzip** for 16 files [V-EXEC]; ticket 08's 87.7 KiB is close but not what this session measured, and C4's table is authoritative |
| `research/09` A.6 / C.1 / C.5 (`entryFor` hard-wired to `nfs-button.theme()`; "compiles `.button`") | **C2** / **C2a** |
| `research/09` B.4 (baseline read targets) | **C5** |
| `research/10` s4 G2d marker wording; P2/P3 subject wording | sweep row for research/10 -- wording only, assertions unchanged |
| `HANDOFF.md` s0, s1 (R009 table + "no `exports`-map change"), s1 open question 1, s3 D033 + D034 Choice, s6.2, s7 favourable-condition 1 | section 7 below |
| map.md "Out of scope -- Per-component control surfaces", second paragraph ("back in scope for ticket 12") | **C2** + **C2a** + **C8** -- discharged |

---

## 6. Routed to ticket 13

Ticket 13 owns the machinery half. Stayed out of it; these are the inputs it
needs, several of them newly measured here.

1. **The compile architecture is settled, and it is the answer to 13's blocking
   question.** A theme apply is **ONE compile emitting N components' rules**, not
   N compiles. Verified: two themeable modules in one compile served the
   Foundation island **once** -- 13 Foundation partials, not 26 [V-EXEC,
   `global-home-probe.mjs` Q3]. So the scaling curve is **not** the reference
   project's additive per-component curve. The reference paid per-component
   compile cost because it compiled per component; that premise does not
   transfer, and ticket 13 should re-derive rather than inherit its ~1.5 s
   two-component figure.
2. **The cost that DOES scale is CSS emission and mixin work inside one
   compile.** Foundation's own `foundation-everything()` emits **138.6 KiB of
   CSS** from a 111-file closure [V-EXEC]. Measure the compile *time* of one
   multi-module entry as modules are added -- that is 13's measurement, and
   `prototypes/multi-component-closure.mjs` already builds the multi-entry
   strings it needs.
3. **The source closure is floor-dominated, which bears on caching keys.** 12 of
   13 Foundation partials Button reaches are the shared `util/` + `global` floor
   [V-EXEC]. A per-component cache key over *sources* would be mostly identical
   across components; the varying part is the emitted CSS. That argues against
   the reference's two-level per-component/combined LRU on a different ground
   than "6 controls, one component".
4. **The worker chunk grows ~8% at full coverage** (~825 -> ~890 KiB gzip, C4).
   Whether the sources should ever be split into per-component chunks fetched on
   demand is **machinery** and belongs to 13. Today one chunk is right.
5. **Restate, do not rebuild.** Every N=1 rationale the sweep found lives in
   research/01 sections 2.2, C7 and its onward questions 2 and 3, and in
   research/09 D.2 / D.3. Ticket 13's own text already enumerates them.
6. **One new datum for 13's pre-compile question.** C1+C3 mean the probe compile
   now `@use`s two modules (`nfs:/theme`, `nfs:/button`) instead of one. Closure
   cost +0.4 KiB; compile-time cost unmeasured here [INFER: negligible, the
   module is 462 bytes of data with no mixins]. If 13 revisits
   "pre-compile the default theme at init", note the probe compile and a
   default-theme pre-compile are two compiles that could be one.

---

## 7. What ticket 11 must change in `HANDOFF.md`

Precise, section by section. Nothing else in the hand-off changes.

**s0 (one-paragraph summary).**
- "retheme `NfsButton` live" -> "retheme the library live" (C6).
- "A new public Sass constant `$wcag-palette` becomes the single source" -> "A
  new public Sass module `ngx-foundation-sites/scss/theme` holds `$wcag-palette`
  as the single source" (C1).
- "Six curated controls (five palette colours + radius) map 1:1 onto the
  library's already-shipped `nfs-button.theme()` mixin" -> keep, but add: "the
  six are Foundation globals; Button's mixin is today's only consumer of them"
  (C6).

**s1 (R009 text).**
1. **Replace the control table** with C6's three-column form (Foundation global /
   reaches Button's mixin today as / default / wire format).
2. **Split the "no `exports`-map or `verify-exports-map` change" claim.** It is
   true of the ADDON's delivery shape (D032, unaffected) and **false** of M002 as
   a whole after C1. Restate as: *the addon adds no `exports` key; M002 adds
   exactly one, `"./scss/theme"`, for D033's palette module -- one line in
   `package.json`, no script and no `ng-package.json` change.*
3. **"No public Sass API growth" needs qualifying.** `theme()`'s signature does
   not grow -- that is the load-bearing claim and it stands. But M002 now adds
   one new public Sass MODULE. Restate as: *no growth of `theme()`'s public
   signature; one new public data module (`scss/theme`) carrying one member.*
4. **Delivery/mechanism bullets:** the compile call is described as
   `THEMEABLE_MODULES`-driven, one entry today (C2); the addon passes no
   `$selector` **to any themeable module**, so each emits under its own default
   selector, `.button` today (C2a).
5. **Preset model:** "both presets are read from Sass at runtime via a custom
   Sass function ... in one probe compile at panel init" -- keep, and specify
   that the probe reads `nfs:/theme`'s `$wcag-palette` plus the six
   **Foundation-global** names from `internal/settings` (C5), not
   `$button-palette` / `$button-background` / `$button-radius`.
6. **Open question 1 is now ANSWERED, not carried.** Replace "When a second
   `nfs-*` component ships its own theme mixin, the addon's single compile call
   must grow to include it; that growth is not M002 scope -- no second component
   exists" with: *the compile call is a list; adding a component is one array
   entry plus regenerating the sources module. The control surface stays one
   global theme, because the six controls are Foundation globals (C6). What is
   not M002 scope is the second component itself.* The phrase "no second
   component exists" must not survive as a rationale anywhere.
7. **Add `$global-text-direction` as an explicit exclusion** with C7's two-line
   reason (provably inert in the current chain; RTL is R004's logical-properties
   concern, not a theme variable), so the closed six-control set reads as
   considered rather than arbitrary.

**s2 (R021 text).** Two wording fixes only, no assertion changes: the Foundation
source marker is "a marker from the generated source closure"
(`$button-background-hover-lightness` today); the computed-style subjects are
"a themed element of each themeable module" (the button today). Lane 1's list
gains one item implied by C3: **assert the generated sources module contains
`nfs:/_theme.scss`** -- the Q1b negative control turned into a standing check,
because a single-entry generator regression is otherwise only visible as a Worker
runtime error with a degraded diagnostic.

**s3 (decision register).**
- **D033's Choice column is REWRITTEN** to C1: new `src/scss/_theme.scss`,
  exported as `"./scss/theme"`, `_button.scss` unchanged with no `@forward`, no
  new script/target/`ng-package.json` change, one `exports` line. Its Rationale
  gains C1's verified resolver matrix (Node refuses the partial-name form; Sass
  `loadPaths`, Sass `NodePackageImporter` and **Angular's own deep-import
  fallback** all bypass `exports`, so no consumer in this repo needs the key --
  it is added for the published surface's correctness) and the placement argument
  (the member does not exist yet, so moving it now is free and later is a
  breaking rename).
- **D034's Decision column** drops "(13 Foundation partials + 3 library
  partials, 71.9 KiB / 24.3 KiB gzip)" as the sizing and takes C4's bounds:
  16 files / 84.4 KiB / 24.1 KiB gzip today, 52 files / 212.9 KiB / 46.2 KiB
  gzip at 35 Foundation components, 111 files / 349.1 KiB / 70.1 KiB gzip at the
  ceiling. Its **Choice** column takes C3 (N entry points, unioned closures, two
  arrays, `THEMEABLE_MODULES` emitted into the data module).
- **D035's Choice clause (d)** takes C2 and C2a.
- **D032 is UNCHANGED**, but the planner must not read its "no exports-map
  change" as covering D033's key.
- **Consider a D037** carrying C7's `$global-text-direction` rejection with scope
  `anti-feature`. This is the second candidate for the optional split already
  flagged at the end of s3 (R026's boundary being the first); a considered
  rejection is exactly what a register row is for.

**s4 (D023 closure).** Clause 2's mechanics change with C1: `$wcag-palette` is a
member of `ngx-foundation-sites/scss/theme`, present in the published tarball's
`scss/_theme.scss` and reachable as
`@use 'ngx-foundation-sites/scss/theme' as nfs-theme;` ->
`nfs-theme.$wcag-palette`. **The discharge gets stronger, not weaker**: the
palette now ships as a theme artifact rather than as a member of one component's
module, and it still reaches its axe proof through the real `exports`-gated
public subpath in CSR and SSR. Clause 1 and clause 3 are untouched, and the three
frozen `expectedContrastFailures` literals stay frozen.

**s5.2 (the atomic 3-part demo rewire).** Same three ordered parts, same
sequencing-is-the-requirement, same no-gate. Two edits: part 1 adds
`$wcag-palette` to **`src/scss/_theme.scss`** (new file) and the `"./scss/theme"`
exports key; part 3 re-points `apps/nfs-demo/src/styles.scss` to
`@use 'ngx-foundation-sites/scss/theme' as nfs-theme;` +
`$palette: nfs-theme.$wcag-palette`. The tarball-snapshot hazard is unchanged and
if anything more visible -- a missing `exports` key would ALSO be a resolution
failure, though C1's R4 evidence says Angular's importer would find it anyway.

**s6.2 (fog: behaviour as more `nfs-*` components land).** Rewrite per C2/C6/C8:
the control surface is global because the controls are Foundation globals; the
compile call is a list, so a second component is an array entry, not a rework;
"no second component exists" is removed as a rationale everywhere.

**s7 (D020 costing).** Favourable-condition 1's number becomes C4's: the closure
is **floor-dominated** -- 12 of 13 Foundation partials are the shared
`util/` + `global` floor, and full Foundation coverage stays under ~11% of the
`sass` payload. Add the "~825 -> ~890 KiB gzip at full coverage" figure. The
"802 KiB gzip is D020's cost, not the addon's" attribution is **reinforced**, and
the single revisit condition is unchanged. Also fix "the generated sources module
*is* the vendored 16-file snapshot" -> "*is* the vendored snapshot of whatever
closure the entry-point list reaches -- 16 files today".

**s8 (not verified).** Add: the nfs half of the multi-component closure bound
(~43 KiB gzip for 35 wrapper modules) is **[INFER]**, extrapolated from
`_button.scss`'s measured 12.5 KiB raw / 4.4 KiB gzip at the Foundation half's
measured gzip ratio. Remove nothing -- and note ticket 07's
`exports`-partial-name `[INFER]` is now **CLOSED as VERIFIED-TRUE** by C1, so it
graduates out of s8 rather than staying listed as unverified.

**s9 (application checklist).** Item 3 gains: D033 and D034's rows carry the
corrected Choice text; consider D037 for C7. Item 6 gains: the demo rewire's
part 1 now includes an `exports` key edit, which invalidates
`verify-exports-map` -> `lint` once.

---

## 8. VERIFIED vs INFERRED

### VERIFIED by execution or direct source reading, this session

- The identity map `"./scss/*": "./scss/*"` does **NOT** resolve the partial-name
  form under Node's own exports resolver: `fakepkg/scss/theme` ->
  `MODULE_NOT_FOUND`, while `fakepkg/scss/_theme.scss` resolves. **This closes
  ticket 07's single self-flagged inference as TRUE.**
- Dart Sass `loadPaths` resolves `scss/theme` **and** the `null`-mapped
  `scss/internal/settings`; Dart Sass's `NodePackageImporter` (`pkg:`) does too.
  `exports` is ignored for subpaths, confirming ticket 07 s5 independently.
- `@angular/build`'s Sass importer has a two-step shape -- exports-honouring
  `resolveUrl`, then a "package deep imports" fallback joining the package root
  with the raw path segments
  [`sass-language.js:126-152`] -- and that fallback **bypasses `exports`
  entirely**. Executed against the REAL tarball: it resolves
  `ngx-foundation-sites/scss/internal/settings` despite the `null` mapping.
  ng-packagr's always-emitted `"./package.json"` key is what makes the fallback's
  package-root lookup succeed.
- `verify-exports-map.mjs` diffs source-vs-dist `exports` keys in two loops and
  never enumerates `.scss` files, so a new key needs **no script change**
  [`verify-exports-map.mjs:64-97`]; `verify-exports-map`'s only inputs are the
  script and `{projectRoot}/package.json` [`project.json:88-99`].
- `ng-package.json`'s sole asset glob is
  `{glob: "**/*.scss", input: "src/scss", output: "scss"}`, so a new
  `src/scss/_theme.scss` ships with no config change.
- `verify-foundation-parity.mjs` compiles a **fixed** three-`@import` reference
  island (`util/util`, `global`, `components/button`) rather than globbing, so an
  unreferenced new `_theme.scss` is inert for it.
- A standalone `nfs:/theme` module holding `$wcag-palette`, with `_button.scss`
  UNCHANGED and no `@forward`, compiles and is capturable through the addon's own
  custom-Sass-function mechanism; closure cost +1 file / +0.4 KiB raw /
  +0.1 KiB gzip; emitted CSS carries all three compliant hexes.
- **NEGATIVE CONTROL:** a single-entry closure over `nfs:/button` does **not**
  contain `nfs:/_theme.scss`. The N-entry-point generator is therefore required
  today.
- ONE compile over two themeable modules emits both selectors and serves the
  Foundation island **once** (13 Foundation partials, not 26); closure grew by
  exactly the second module's own file.
- Reading `internal/_settings.scss`'s Foundation-**global** names
  (`$primary-color`, `$secondary-color`, `$success-color`, `$warning-color`,
  `$alert-color`, `$global-radius`) yields values **byte-identical** to the
  button-derived `$button-background` / `$button-palette` / `$button-radius`, and
  avoids the spurious `primary` key `theme()` skips.
- Closure sizing, all compiled: button chain **16 files / 84.4 KiB raw /
  24.1 KiB gzip**, CSS 5839 bytes; shared `util/` + `global` floor **12 files /
  59.9 KiB / 17.6 KiB gzip**; Button's marginal cost **1 file / 12.0 KiB**;
  per-component marginal cost across all 35 components **1 file, 0.2-13.7 KiB**;
  union of 33 **45 files / 184.4 KiB / 41.0 KiB gzip**; union of all 35 (with
  `typography`) **52 files / 212.9 KiB / 46.2 KiB gzip**;
  `foundation-everything()` ceiling **111 unique files / 349.1 KiB / 70.1 KiB
  gzip**, emitting **138.6 KiB of CSS**.
- Foundation's `scss/` tree on disk is **106 `.scss` files / 367.6 KiB raw /
  75.1 KiB gzip** (the map's figure); the 111-file closure is 104 of those plus
  7 in `foundation-sites/_vendor/sassy-lists/`.
- `dropdown-menu` and `tooltip` **fail** the repo's three-`@import` island shape
  (`$anchor-color`, `$small-font-size` undefined); all 35 compile once
  `typography/typography` is imported.
- nfs Sass source sizes: `_button.scss` 5.7 KiB,
  `internal/_foundation-button.scss` 4.4 KiB, `internal/_settings.scss` 2.4 KiB
  = 12.5 KiB raw / 4.4 KiB gzip.
- `$global-text-direction` is **inert in this chain, twice over**:
  `_global.scss:127-128` derives `$global-left`/`$global-right` from it
  non-`!default`, and `internal/_foundation-button.scss:66-67` unconditionally
  reassigns both to `inline-start`/`inline-end` **after** the `@import`s; the only
  direct read in the chain, `components/_button.scss:84-86`, guards a `!default`
  assignment to `$button-margin` that `internal/_foundation-button.scss:37`
  already seeded non-`!default` before the import. It appears nowhere in
  `internal/_settings.scss`.
- Six Foundation files read `$global-text-direction` directly
  (`_breadcrumbs.scss:84`, `_drilldown.scss:108,112`, `_dropdown-menu.scss:222`,
  `_slider.scss:135`, `forms/_input-group.scss:38,44`) plus
  `_global.scss:131`'s `$-zf-flex-justify` -- so future components do have
  direction-dependent output.
- `internal/_settings.scss` mixes 9 Foundation-global members with 17
  button-scoped ones in one file whose header calls itself Button's private
  defaults table.
- The sweep: seven single-component-premise hits across `research/01,04,06,10`,
  **all in research/01, all performance**; zero in 04/06/10; and zero `'.button'`
  literals in 04/06/10 (`rg` exit 1).

### INFERRED (reasoned, not executed)

- **The nfs half of the multi-component closure bound** -- ~200 KiB raw /
  ~43 KiB gzip for 35 public wrapper modules, extrapolated from `_button.scss`'s
  measured 12.5 KiB raw at the Foundation half's measured 21.7% gzip ratio. The
  Foundation half is measured; this half cannot be, because the modules do not
  exist. Consequently the "~11% of the `sass` payload" ceiling figure is
  part-measured, part-inferred; the **measured-only** ceiling is 8.8%.
- That a realistic multi-component architecture keeps **one** shared island
  rather than one per component. Grounded: the island exists to hold Foundation's
  globals as module members [V-REPO: `internal/_foundation-button.scss:1-21`] and
  Foundation's globals are shared. Not executed against a real second component.
- That the second `@use` in the probe compile costs negligible compile time
  (462 bytes of data, no mixins).
- That a future component's `theme()` mixin will accept the same
  `$background` / `$palette` / `$radius` argument set. C2's seam exists precisely
  because this is not known.
- That C2's `THEMEABLE_MODULES`-driven entry string behaves identically inside
  the Worker to the Node probe here. Strong -- it is a string built the same way
  and handed to the same `compileString` -- but the browser/Worker path was not
  re-executed this session (ticket 05 and 07 verified the mechanism there).
- That `.button` and each future module's default selector have no collisions in
  the preview chrome. Carried from research/09 as `[INFER]`, now per-module.

### CARRIED from tickets 01-11 without re-verification

The 801 KiB gzip `sass` worker bundle against the preview's 1140 KiB gzip and the
+70% figure; the 197 ms warm / 556-587 ms cold Worker compile timings and the
337 ms main-thread block; the four-producer sha256 identity
(`49bfb1a2e67bf91a`); the custom-`functions` option working on the **browser**
code path and returning a real `SassMap`; `internal/*: null` not blocking Sass
load-path reads (re-verified here from a different angle); `_button.scss` emitting
0 bytes on `@use`; the `apps/nfs-demo` tarball-consumption mechanism and
`verify-registry-consumption`'s unwired-manual-target status; the Worker spike's
four-variant webpack result and the silently-green `worker: false` failure mode;
jsdom discarding `@layer` rules; the unlayered-beats-`@layer` cascade result in
real Chromium across four insertion orders; the `**/`-prefixed R026 `ignores`
requirement under Nx's workspace-root cwd; `buildArgsParam`'s whole-theme-drop on
one invalid value; the sparse canonical-minimal globals model; ticket 04's
manager-reachability proof and the Foundation 0.25 s transition flake; ticket 06's
`nx.json` cache-coupling asymmetry and its `toHaveLength(2)` file-shape
constraint; the Dart Sass 3.0.0 `@import` / global-builtin removal clock; and
ticket 01's prior-art conclusions and reference-project drift evidence.
