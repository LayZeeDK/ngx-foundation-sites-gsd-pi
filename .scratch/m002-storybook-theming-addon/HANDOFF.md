# M002 hand-off: Storybook theming addon

Produced by wayfinder ticket 11, which closes the map at
`.scratch/m002-storybook-theming-addon/map.md`. Every decision below is locked;
nothing here is a proposal.

**What this document is.** The complete input to GSD milestone planning for
M002. It contains sharpened text for R009 and R021, decision-register entries for
the five decision tickets (06-10), the D023 closure statement, the list of
requirements M002 touches but does not own, and the record of why D020 makes this
milestone architecturally unusual.

**Route-agnostic.** This states *what must end up in GSD*, not which interface
puts it there. Either the `gsd-workflow` MCP tools or a later `/gsd` session can
apply it.

**Do not edit `.gsd/` by hand.** Those files are projected from a database.

**Evidence discipline.** Claims below are tagged where it matters:
`[VERIFIED]` = executed or read from shipped source during the effort;
`[INFERRED]` = reasoned but not executed. Section 8 lists everything still
unverified. Much of this map's value is that its claims were executed, not
argued -- do not let that distinction get flattened during planning.

Depth lives in `.scratch/m002-storybook-theming-addon/research/01..10-*.md`;
each section below cites the file that owns it.

---

## 0. One-paragraph summary for a planner who never read the map

M002 adds a **workspace-local Storybook addon** that compiles the library's real
Foundation Sass **in the browser, inside a Web Worker**, and injects the result
into the preview, so a designer can retheme `NfsButton` live without a rebuild.
Six curated controls (five palette colours + radius) map 1:1 onto the library's
already-shipped `nfs-button.theme()` mixin -- **no public Sass API growth is
required**. Two presets ship (Foundation default, WCAG-compliant); preset
"selected" is a *derived* property of live control values, never a stored flag. A
new public Sass constant `$wcag-palette` becomes the single source of the
WCAG palette, which finally discharges the standing human decision D023.
Verification is four lanes: Vitest jsdom, Vitest real-Chromium, a new Playwright
project against the static Storybook build, and build-time `verify-*.mjs` gates.

---

## 1. Sharpened R009

Replace R009's Description and Validation. Class stays `differentiator`, Status
stays `active`, Source stays `user`.

### R009 -- proposed replacement text

> **Title:** Storybook ships a workspace-local theming addon that compiles the
> library's real Foundation Sass in the browser and exposes six curated live
> controls plus two presets, with no CSS-custom-property theming surface (D020)
> and no public Sass API growth.
>
> **Description:**
>
> A theming addon resident in `packages/ngx-foundation-sites/.storybook/`
> (workspace-local Storybook tooling, auto-discovered via `.storybook/manager.ts`
> manager-side and the existing `.storybook/preview.ts` preview-side; **no new
> package, no `addons: []` wiring, no `exports`-map or `verify-exports-map`
> change**) lets a developer or designer retheme the library live in Storybook
> without a rebuild.
>
> **The curated control set is exactly six values, and it is closed:**
>
> | Control | `theme()` argument | Foundation default | Wire format |
> | --- | --- | --- | --- |
> | primary | `$background` | `#1779ba` | lowercase `#rrggbb` |
> | secondary | `$palette.secondary` | `#767676` | lowercase `#rrggbb` |
> | success | `$palette.success` | `#3adb76` | lowercase `#rrggbb` |
> | warning | `$palette.warning` | `#ffae00` | lowercase `#rrggbb` |
> | alert | `$palette.alert` | `#cc4b37` | lowercase `#rrggbb` |
> | radius | `$radius` | `0` | JS `number`, integer CSS px, clamped 0..32 |
>
> No other variable is exposed. Font size, padding and hover-lightness are
> explicitly out of scope (they would require growing `theme()`'s public API).
> `rem` radii remain available to consumers compiling at build time; the addon's
> control is px-only by design.
>
> **Delivery and mechanism:**
>
> - A single custom addon **PANEL** titled `Theming` (`types.PANEL`), story-mode
>   only (`match: viewMode === 'story' && !tabId`). No toolbar entry.
> - Colour controls are a native `<input type="color">` paired with a text field
>   accepting `#rgb` / `#rrggbb` only, normalised to lowercase `#rrggbb`. Radius
>   is a range slider plus numeric stepper.
> - **The panel is the validation boundary.** Invalid input is marked in the UI
>   and never written to globals. This is a requirement, not an implementation
>   note: Storybook's `buildArgsParam` validates the *top-level* global, so one
>   invalid nested value silently drops the **entire theme** from `?globals=`,
>   diagnosed only by a `warn` that no existing gate catches. Because the panel
>   validates on write, **every reachable control state is URL-encodable** --
>   the shareable-link guarantee is total, not best-effort.
> - State lives on **Storybook globals** under one key, whose value is a
>   **sparse, canonical-minimal override map** with `initialGlobals.nfsTheme = {}`
>   meaning "Foundation's default theme". A key is present **iff** its value
>   differs from the Foundation default; setting a control back to the default
>   *deletes* the key. Consequence: in-session state is byte-identical to
>   post-reload state, the default theme produces an **empty** `?globals=`, and
>   "reset to default" is `updateGlobals({ nfsTheme: undefined })` with no reset
>   code to write.
> - Compilation runs **sync `sass.compileString` inside a single Web Worker**,
>   constructed lazily on the first theme change. Sources reach the compiler from
>   a **committed, generated TS data module** under `.storybook/`, produced by
>   `scripts/generate-theming-sources.mjs` and gated by a new
>   `verify-theming-sources` target on `lint`. No network fetch, no bundler raw
>   imports (Angular's unconditional `.scss` webpack rule makes `asset/source`
>   return *compiled CSS*, not raw Sass -- a silently wrong string).
> - Recompile policy: **no debounce timer**; a single-slot latest-wins coalescer.
>   In-flight compiles are superseded, never cancelled (terminate+respawn costs
>   3-4x a warm compile). A `Compiling...` indicator appears in the panel only
>   past 300 ms. **The last good CSS is never cleared on error**; the panel shows
>   `sassMessage` plus a friendly source name derived from `span.url`.
> - Compiled CSS is injected as **one `<style id="nfs-theming">` node in
>   `document.head`**, get-or-create by id, `textContent` replaced per compile.
>   One node total, shared across story and docs mode. The addon passes **no
>   `$selector`**, so it compiles the mixin's own default `.button` and rethemes
>   every button in the preview -- exactly what a zero-config consumer's build
>   produces.
> - The addon carries **explicit test hooks as part of its contract**, not as a
>   test-authoring detail: `data-nfs-seq="N"` (the coalescer's monotonic sequence
>   number) on the injected style node, `data-testid="nfs-theming-panel"` with
>   `data-nfs-panel-state="loading|ready|compiling|error"` on the panel root, and
>   stable control ids `nfs-preset-select`, `nfs-color-<key>`,
>   `nfs-color-<key>-text`, `nfs-radius`.
>
> **Preset model:**
>
> - Two presets ship: **Foundation default** and **WCAG-compliant**. The
>   compliant preset is exactly three overrides -- `success: #238648`,
>   `warning: #9e6c00`, `alert: #cb4b37` -- inheriting Foundation's defaults for
>   primary, secondary and radius.
> - Both presets are **read from Sass at runtime** via a custom Sass function
>   registered on the addon's own `compileString` call, in one probe compile at
>   panel init. **No TypeScript copy of any of the six values exists anywhere.**
> - **Seeding is not locking.** Applying a preset is a single `updateGlobals`
>   with that preset's canonical map; afterwards the controls are ordinary
>   controls.
> - **A preset reads as "selected" only on exact match**, and selection is
>   **derived on every render, never stored**. Formally: preset P is selected iff
>   `equal(canonical(live), canonical(P))`, a six-scalar deep-equal. Because both
>   sides are canonical-minimal, *sparse equality is resolved equality* -- a user
>   who leaves `primary` untouched and a user who explicitly types Foundation's
>   own `#1779ba` are the same object, not two states. Presets are ordered and
>   the first match wins. When nothing matches, a literal `Custom` entry is shown
>   as selected; choosing `Custom` is a no-op.
> - **The panel loads asynchronously on first open, by design.** Sequence:
>   construct Worker (which is when the lazily-split sass chunk is fetched) ->
>   run the preset probe compile -> render controls. Until it resolves the panel
>   is in `loading`. This is intended behaviour, not a defect: on a cold panel
>   the addon genuinely does not yet know Foundation's defaults, and a loading
>   state is preferable to a confidently-wrong preset selection. The preview
>   never waits on this probe -- `theme()` resolves omitted arguments internally,
>   so a themed story renders straight from the sparse map.
>
> **Stated user-visible consequences (accepted, not defects):**
>
> - The panel is unavailable on autodocs pages, but the theme still applies
>   there -- docs pages render under whatever theme was last chosen, and
>   retheming requires navigating to a story.
> - Control state persists **through the URL only** (`?globals=`), which
>   round-trips across reload and survives story navigation. There is no
>   `localStorage` persistence and no user-saved presets (see section 6).
> - The radius control's unit is implicit px, 0..32 integer.
> - The sass compiler payload is **802 KiB gzip / 436 KiB brotli** [VERIFIED,
>   measured], fetched lazily on first theme interaction, +70% on the preview's
>   current 1140 KiB gzip. Preview boot is unchanged. This cost is attributable
>   to **D020**, not to the addon -- see section 7.
>
> **No public Sass API growth.** The curated set maps 1:1 onto `theme()`'s
> existing `$background` / `$palette` keys / `$radius` [VERIFIED against
> `src/scss/_button.scss:58-63`]. The only Sass addition anywhere in M002 is the
> `$wcag-palette` data constant (section 3, D033), which emits 0 bytes on
> `@use`.
>
> **Validation (mappable):** R009 is proven by the Playwright lane's P1-P8 and
> the `verify-theming-bundle` gate G2a described in R021 -- specifically: the
> addon panel loads in the **static** Storybook build with zero manager
> `console.error` (P1 + G2a); driving the primary colour control changes the
> preview button's computed background-colour with a pre/post differential (P2);
> selecting `WCAG-compliant` seeds all six controls to their named values and
> renders `#238648` / `#9e6c00` / `#cb4b37` (P3); tweaking one control flips the
> selector to `Custom` and setting it back flips it to `WCAG-compliant` (P4 --
> the exact-match semantics under test); `?globals=` round-trips a single sparse
> override and the default theme yields an empty param (P5); the panel goes
> `loading -> ready` on first open (P6).

### Open questions R009 must carry for the planner

These are folded in deliberately rather than left as fog (see section 6):

1. **Per-component vs global control surface.** `theme()` is button-only today
   and the addon compiles with the default `.button` selector, so the control
   surface is **global by decision**, not by accident. When a second `nfs-*`
   component ships its own theme mixin, the addon's single compile call must
   grow to include it; the control surface stays one global theme. That growth
   is **not M002 scope** -- no second component exists.
2. **Docs deliverable.** One README section in
   `packages/ngx-foundation-sites/README.md` documenting the addon: the six
   controls and their units, the two presets and the exact-match rule, the
   URL-sharing guarantee, and the story-mode-only panel limitation. Extending
   `verify-autodocs-coverage` to the addon is explicitly **out of scope** (that
   gate covers Angular component input tables; the addon has no component).

---

## 2. Sharpened R021

Replace R021's Description and Validation. Class stays `quality-attribute`,
Status stays `active`, Source stays `user`.

### R021 -- proposed replacement text

> **Title:** The M002 theming addon is verified across four lanes -- Vitest
> `test` (jsdom), Vitest `test-browser` (real Chromium), a dedicated Playwright
> project against the static Storybook build, and build-time `verify-*.mjs`
> gates -- with each lane assigned the assertions it is the cheapest lane able to
> fail on for the right reason.
>
> **Description:**
>
> The original text said "Vitest unit tests and Playwright e2e tests". That is
> **two lanes short**. The verified split is four, and the axis is *capability*,
> not preference. The governing rule is: **the cheapest lane that can fail for
> the right reason. A lane that cannot observe the failure mode is not cheaper,
> it is vacuous.**
>
> **Lane 1 -- `test` (Vitest, jsdom). Proves: everything compiler-side and
> logic-side.**
> jsdom resolves the **Node** sass build and compiles the real `theme()` chain
> from the committed in-memory source map to **5839 bytes, sha256 prefix
> `49bfb1a2e67bf91a`** -- byte-identical to five other producers [VERIFIED]. So
> this lane owns: the sources-map fitness digest; per-control differential
> compilation (compile with A and B, assert the literal **and** `cssA !== cssB`);
> the preset baseline probe returning Foundation's six defaults and
> `$wcag-palette`'s three overrides by exact key set; **preset-equality**
> (canonicalisation deleting a default-valued key is the load-bearing assertion
> -- without it the whole "sparse equality is resolved equality" property
> silently fails and no other test notices); input validation including feeding
> the panel's write output through the real `buildArgsParam` with a
> deliberately-invalid control producing an empty `?globals=`; Sass error shape
> (`sassMessage`, `span.url`, no ANSI) **and** the friendly missing-importer
> diagnostic, which only survives outside a Worker; the error-serialisation
> contract with a `structuredClone`-loses-the-fields control; the coalescer state
> machine; and the R026 config assertions including the new path-spelling
> divergence guard.
>
> **Lane 2 -- `test-browser` (Vitest, real Chromium). Proves: the four things
> jsdom structurally cannot.** Keep it to one spec file; each file pays the sass
> bundle cost. It resolves the **browser** sass build -- the same dart2js
> artifact the Worker chunk ships -- so a browser-only Dart Sass regression is
> observable without a Storybook build. It has a real `Worker`, for the
> theme-in / CSS-out and error-object round trip. And it is the **only** lane
> with a real cascade: **jsdom discards `@layer`-wrapped rules entirely** (a
> layered-only rule computes `rgba(0,0,0,0)`) [VERIFIED], so every R008 cascade
> assertion in jsdom would be vacuously green. The R008 assertion here runs in
> both insertion orders **plus a layered-only control** proving layered rules
> apply at all -- the control is what makes the result real. Injection
> idempotency (three calls, one `#nfs-theming` node, last CSS wins) sits here
> beside it. Any computed-colour read in this lane must first inject
> `*, *::before, *::after { transition: none !important }`.
>
> **Lane 3 -- Playwright at `apps/nfs-storybook-e2e/`. Proves: only what needs
> the Storybook manager.** `@storybook/test-runner` **cannot** reach manager-side
> addon panels -- its `page` is the preview iframe [VERIFIED three ways]. So a
> dedicated `@playwright/test` project is required: new project directory, an
> `e2e` target with `dependsOn: ["ngx-foundation-sites:verify-theming-bundle",
> "ngx-foundation-sites:static-storybook"]`, a polling `globalSetup` copied from
> `nfs-demo`'s, and a ~40-line local `SbPage`. **Zero new dependencies.** The
> harness was proven live in this repo against the real `addon-a11y` panel, which
> registers through the same `addons.add(PANEL_ID, {type: types.PANEL})`
> mechanism M002's addon uses. Because it runs against `static-storybook`, this
> lane **is** the static-build proof -- ticket 04's probes ran against the dev
> server only, so the first run against the static build is an explicit
> acceptance step, not an assumption. It owns: addon load (panel tab present
> **and** zero manager `console.error` -- the console half is the only thing that
> catches esbuild's injected try/catch swallowing a crashing manager entry);
> control-to-computed-style with a pre/post differential; preset seeding all six
> controls by name; the tweak-then-restore `Custom` <-> `WCAG-compliant` flip
> (the derived-selection proof, and the assertion a stored mode flag would fail);
> the `?globals=` round trip including the empty-param case; the panel's
> `loading -> ready` first open; and the autodocs-page consequence. Every style
> assertion waits on the `data-nfs-seq` readiness signal, never a timeout, and
> uses auto-retrying `toHaveCSS`/`toPass` -- Foundation's 0.25s
> `background-color` transition made one-shot `getComputedStyle` reads return
> stale values twice during probing.
>
> **Lane 4 -- build-time gates. Proves: what no test can observe.**
> `verify-theming-sources` (on `lint`'s `dependsOn`) regenerates the source
> closure in memory and byte-compares it against the committed module, plus
> re-proves string-map CSS == filesystem CSS. A **new** `verify-theming-bundle`
> (`dependsOn: build-storybook`, modelled on `verify-autodocs-coverage`'s
> one-script/`failures[]`+`cause` shape) globs
> `sb-addons/*/manager-bundle.js`, content-matches `ADDON_ID` (verified to
> survive minification), asserts **exactly one** match, and asserts `index.html`
> **imports** it -- the `modulepreload` link is only a hint. It also asserts the
> sass marker appears in exactly one emitted `.js` file and that that file is
> **not** among `iframe.html`'s module import specifiers, which proves the
> lazy-loading decision still holds.
>
> **Two vacuity traps in the inherited gate design, both fixed here and both
> worth stating as requirements:**
>
> 1. `iframe.html` contains **zero** `<script src=...>` attributes [VERIFIED] --
>    it loads the preview via `import './...'` inside one `<script
>    type="module">`. A gate phrased as "not referenced by any `<script src>`"
>    would have passed forever, including with `sass` statically imported into
>    the preview. The gate must parse the module-import specifiers instead.
> 2. The addon bundle directory carries an **order-dependent index**. A
>    hard-coded path yields "file not found", which a sloppy script reports as
>    "addon not present" -- correct-looking, and equally wrong after any addon
>    reorder.
>
> **General rule adopted for the whole lane: every absence assertion is preceded
> by a presence assertion over the same collection.**
>
> **Anti-vacuity is a first-class requirement, per M003's RTL precedent.** Every
> compilation assertion is differential; every preset-equality assertion asserts
> both polarities; the error-serialisation subject is meaningful only because of
> its control; the cascade assertion is disqualified if its layered-only control
> fails. An addon that silently emits nothing must fail node-existence,
> `textContent.length > 0`, the `data-nfs-seq` increment, and the computed-style
> change.
>
> **A committed negative-control evidence file is a deliverable**, matching the
> repo's existing `.autodocs-coverage-evidence.txt` /
> `.registry-consumption-evidence.txt` precedent and M001/S11's
> break-and-observe practice. Five entries, each a break-and-observe run:
> blank a generated source entry; rename `ADDON_ID`; add a static `import 'sass'`
> to `.storybook/preview.ts`; change the R026 `ignores` glob to the
> config-dir-relative spelling; comment out the `textContent` assignment. The
> fourth has **no runtime symptom at all** and the third protects a decision
> (lazy loading) rather than a behaviour.
>
> **Validation:** R021 is satisfied when all four lanes are wired and green, the
> Playwright lane's first run is against `static-storybook` (not the dev server),
> the negative-control evidence file is committed with all five entries red-then-
> green, and one real `nx lint ngx-foundation-sites` run with the addon's
> injection code present has been performed as a once-off acceptance step
> (distinct from the per-commit path-spelling assertion, which the spec harness
> structurally cannot model on its own).

---

## 3. Decision-register entries (D032-D036)

Append these to `.gsd/DECISIONS.md`'s table. **The register is append-only** --
never edit an existing row. **D031 is the highest existing number, so D032 is the
next free.** Columns, in order:
`# | When | Scope | Decision | Choice | Rationale | Revisable? | Made By`.

All five operate **under** the standing human decisions D020 (SCSS-variable
theming only) and D023 (compliant theme ships in M002) and re-decide neither.

### D032 -- delivery shape (ticket 06)

- **When:** M002 wayfinding effort (`.scratch/m002-storybook-theming-addon/`), 2026-08-11
- **Scope:** architecture
- **Decision:** Whether the R009 theming addon ships as workspace-local Storybook tooling or as a publishable addon package
- **Choice:** Workspace-local, resident in `packages/ngx-foundation-sites/.storybook/`, entry points auto-discovered (`.storybook/manager.ts` manager-side, the existing `.storybook/preview.ts` preview-side). No new package, no `addons: []` wiring, no `local-preset.ts`, no change to the library `package.json`, its `exports` map, or the `verify-exports-map` gate. The module boundary is kept extractable-later in file terms only (entries literally named `manager.ts` / `preview.ts`; the addon reaches the library only through published specifiers), with any `package.json`, `dist/` build, addon-kit scaffold, Nx project or path alias written "for later" explicitly rejected as speculative generality. Costs one `include` line in `.storybook/tsconfig.json`, whose `"*.ts"` glob is non-recursive.
- **Rationale:** Ticket 02 verified three ways that a workspace-local unpublished addon can be wired by relative path and that `resolveAddonName` returns structurally identical records for local paths and published packages -- so a package buys zero functional gain. A separate addon *directory* loses on a cache-coupling asymmetry verified in `nx.json`: the `production` named input excludes `.storybook/**` but not a sibling directory, so every addon edit would invalidate `build` -> `verify-exports-map` -> `lint`. A *package* loses four further ways: `workspaces: ["packages/*"]` is live, the library package is non-private with no `release.projects` filter (so honouring R019 would mean writing config to neutralise what you just created), a separate package sits outside `{projectRoot}` and would make `build-storybook` go stale-cache **silent**, and it would convert the sass payload into a consumer cost. Operates under D020 and R019; re-decides neither.
- **Revisable?:** true
- **Made By:** agent

### D033 -- where the WCAG-compliant palette lives (ticket 07)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** library
- **Decision:** Where the WCAG/axe-compliant palette lives as a single source of truth, given the founding brief's assumption that M003 already produced one was false
- **Choice:** `$wcag-palette` becomes a plain public Sass map inside the **existing** public entry point `packages/ngx-foundation-sites/src/scss/_button.scss` (already exported as `ngx-foundation-sites/scss/button`) -- a new *member* of an existing module, not a new `scss/_presets.scss`. The demo app reads it as `$palette: nfs-button.$wcag-palette`; the addon reads it, plus Foundation's defaults from `internal/_settings.scss`, through a custom Sass function registered on the `compileString` call it already makes. No new Sass file, no `exports` key, no `verify-exports-map` change, no `ng-package.json` change, no new Nx target, no generated artifact, and **no TypeScript copy of the values anywhere**. The demo-app rewire is M002 scope and is one atomic three-part change (see section 5).
- **Rationale:** The palette had **one executable instance and five descriptions** of it across five tracked files; the library shipped nothing, so D023's "a compliant theme ships in M002" was genuinely undischarged. Ticket 01 found the reference project carrying **three mutually inconsistent** compliant palettes at HEAD -- the exact drift this collapse prevents, and the strongest argument against the "accept another copy plus an equality test" baseline. Verified by execution: a custom Sass function returns a real `SassMap` on both the Node and the **browser** code paths, and adding a public variable still emits **0 bytes** on `@use`, so `_button.scss`'s "emits nothing on load" contract survives. `internal/*: null` in the exports map does **not** block reading Foundation's defaults -- Dart Sass ignores `exports` for subpaths entirely -- so the defaults are not promoted to public API. Operates under D023; decides the mechanism, not the substance.
- **Revisable?:** true
- **Made By:** agent

### D034 -- how Foundation's Sass reaches the browser (ticket 08)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** How the Sass sources the in-browser `theme()` compile reaches (13 Foundation partials + 3 library partials, 71.9 KiB / 24.3 KiB gzip) are delivered to a compiler that has no filesystem
- **Choice:** Build-time inlining. A generator at `packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs` compiles the real chain in Node with a disk-backed importer, records exactly the URLs it served, and emits a **committed** TS data module under `.storybook/`, which the Worker feeds to its importer verbatim -- gated by a new `verify-theming-sources` target on `lint`'s `dependsOn`. `sass` is lazy **by construction**: it is imported from the worker module and nowhere else, so webpack's worker chunk *is* the split point and no `await import()` is needed. Preview boot stays 1140 KiB gzip. The artifact lives in `.storybook/` -- inside the `default` input but outside `production`, and unreachable by `ng-package.json`'s `src/scss` asset glob, so it cannot ship.
- **Rationale:** Bundler raw imports are **blocked, not merely worse**: Angular's `.scss` webpack rule applies `resolve-url-loader` + `sass-loader` through an unconditional nested `{ use }`, so no query escapes it and adding `type: 'asset/source'` yields **compiled CSS, not raw Sass** -- a silently wrong string. Runtime fetch forfeits the locked sync compile (async in-browser is 6-7x slower), needs `staticDirs` to have anything to fetch in the static build, and would publish `src/scss/internal/*` as fetchable URLs. Pre-flattening saves <0.5% against the worker chunk, costs all of option 1's machinery plus an unverified Sass transform whose failure mode is wrong-CSS-that-still-compiles, and moves nothing. Staleness is caught because the closure is **discovered by compiling, never hand-enumerated** -- a Foundation in-range bump or an upstream `@import`-graph change fails the byte-compare loudly and visibly in the PR diff. Amends ticket 06's boundary rule openly: `ngx-foundation-sites/scss/button` is unresolvable from the workspace root (the root symlink targets the source tree, which has no top-level `scss/`), so the amended rule is "addon *runtime* code imports nothing outside `.storybook/`; the generator is a build script reading workspace-relative paths" -- already the repo's idiom for `scripts/**/*.mjs`. Inherits the Dart Sass 3.0.0 `@import`-removal clock exactly; no option on the table reduces it, and the Node build has identical exposure today.
- **Revisable?:** true
- **Made By:** agent

### D035 -- control surface, preset semantics, CSS injection, and R026's boundary (ticket 09)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** The addon's user-facing model and the state that backs it -- control surface, preset-selection semantics, CSS injection and cascade, recompile UX, and where R026's ban actually falls given that it fires on the addon's injection code
- **Choice:** (a) A single `types.PANEL` titled `Theming`, story-mode only, no toolbar; native `<input type="color">` plus a validating text field; radius as a JS `number` of integer CSS px clamped 0..32. (b) Globals hold a **sparse canonical-minimal** override map with `initialGlobals.nfsTheme = {}`; the panel is the validation boundary and invalid input never reaches globals. (c) Preset selection is **derived from live state on every render, never stored**; canonical form makes sparse equality equal resolved equality, reducing the check to six scalars; a literal `Custom` entry, first match wins. (d) One `<style id="nfs-theming">` in `document.head`, shared across story and docs mode; the addon passes no `$selector` and rethemes everything. (e) Worker-backed sync compile, lazily constructed; **no debounce timer, a single-slot latest-wins coalescer**; supersede never cancel; progress indicator only past 300 ms; last good CSS survives errors; the Worker serialises errors to a plain object. (f) **R026's boundary is stated for the first time**: R026 bans a hand-fed CSS string as the *component's styling source*; a dev-only Storybook addon injecting browser-compiled output is outside that ban. Encoded as exactly one `ignores` entry on the **existing** non-spec `no-restricted-syntax` block, so the block count stays 2 and `nfs-button.r026-lint.spec.ts`'s `toHaveLength(2)` is untouched.
- **Rationale:** The ticket's highest-risk unknown -- whether `new Worker(new URL(...))` survives Storybook's Angular webpack merge -- closed **positively** two ways: `@storybook/angular` spreads only `cliConfig.module.rules`, discarding the `module.parser` that carries Angular's `worker: false`, and a four-variant real-webpack spike emitted a separate worker chunk with the marker absent from the entry chunk. The negative control matters: with `worker: false` the worker module is not bundled **anywhere**, with zero errors and zero warnings -- a silently-green failure mode, which is why the build-artifact gate is not optional. The sparse-map model is the decision that removes the most machinery: `buildArgsParam` encodes only `deepDiff(initialGlobals, globals)` and `GlobalsStore` merges shallowly at the top level, so a canonical-minimal map has **one** runtime shape in-session and post-reload, where a padded six-key map has two. Verified corrections to prior assumptions: **one invalid value drops the ENTIRE theme** from `?globals=` (five valid hex colours were discarded alongside one bad radius), diagnosed only by a `warn` that `.storybook/test-runner.ts` does not catch; the R026 `ignores` glob **must** be `**/`-prefixed because `@nx/eslint:lint` calls `process.chdir(systemRoot)` and ESLint 9 resolves flat-config ignores against cwd, so a config-dir-relative glob is inert under Nx while still passing the spec harness -- green `nx test`, red `nx lint`; and R008's unlayered-beats-`@layer` cascade win is verified in real Chromium across all four insertion orders with an order-detecting control, so **no order tricks, no `!important`, no MutationObserver** are needed. Relocating the addon to escape R026 was rejected outright -- it would silence the rule by geography with no record that an exemption was decided. Operates under D019/D020/R008/R026; states R026's edge rather than re-deciding it.
- **Revisable?:** true
- **Made By:** agent

### D036 -- R021's verification split, D023's axe location, and the port-4400 collision (ticket 10)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** quality-attribute
- **Decision:** What R021's Vitest half and Playwright half each prove, where D023's axe obligation runs once the compliant theme is also a selectable addon preset, and how the port-4400 collision between `test-storybook` and the new Playwright lane is resolved
- **Choice:** **Four lanes**, not two -- `test` (jsdom), `test-browser` (real Chromium), Playwright at `apps/nfs-storybook-e2e/`, and build-time gates (`verify-theming-sources` on `lint`, plus a new `verify-theming-bundle` on `build-storybook`). **D023's axe proof STAYS in `apps/nfs-demo`; nothing is re-pointed and no axe scan is added to any Storybook lane.** The addon's preset is bound to the axe-proven palette by a data-identity unit assertion plus one rendered-colour Playwright assertion. The default theme's three `expectedContrastFailures` literals are **frozen**. Port 4400 is resolved by refactoring `test-storybook` off `concurrently` onto `dependsOn: ["verify-autodocs-coverage", "static-storybook"]`, keeping `wait-on tcp:4400`.
- **Rationale:** The lane boundary moved in **both** directions, measured. jsdom is far more capable than assumed -- it resolves the Node sass build and compiles the real chain to the same sha256 as five other producers, and ticket 07's custom-`functions` probe works there -- so all compilation, preset, equality, validation and error-shape assertions land in the cheapest lane. But **jsdom discards `@layer`-wrapped rules entirely**, so every R008 cascade assertion there would be vacuously green; an earlier probe pass reported "unlayered wins" in jsdom and it was true for the wrong reason. Cascade, a real `Worker`, and the browser sass build go to `test-browser`. Playwright owns only the manager, which `@storybook/test-runner` structurally cannot reach. The axe proof stays in the demo app because the tarball route is a **strictly stronger** proof -- it scans the compliant palette through the real `exports`-gated public subpath in both CSR and SSR -- while an addon-driven scan would re-measure colours already measured through an async-Worker-probe wait, and would mean adding an axe dependency to a lane whose entire purpose is the manager UI. `wait-on` is kept deliberately because Nx's continuous-task ordering is start-based, not readiness-based. Operates under D023 and R008; discharges D023's third clause without re-deciding it.
- **Revisable?:** true
- **Made By:** agent

### One optional split, flagged rather than taken

Research/09 section G.6 recommends recording **R026's stated boundary** as its own
register row, since it is the first time that rule's edge has been drawn. Ticket
11's brief asked for exactly one row per resolved ticket, so it lives as clause
(f) of D035 above. If the planner would rather it be independently findable, the
lazy split is: keep D035 as-is minus clause (f), and add a D037 carrying (f) with
scope `anti-feature` and the same `Made By: agent`.

---

## 4. The D023 closure statement

D023 (human, standing, `Revisable?: true`, never re-opened here) reads:

> Foundation's default theme ships unchanged (no palette/`$white` alteration). A
> WCAG/axe-compliant theme ships in M002, and the axe suite runs against that
> compliant theme for its zero-violations proof. The default theme keeps an exact
> expected-failure assertion (never a blanket rule suppression) for its three
> known shortfalls.

**M003 left it open despite the founding brief assuming otherwise.** The brief
expected M002's WCAG preset to be "sourced verbatim from M003's already-proven
compliant theme, no duplicated values". **There was no such artifact.** The
compliant palette existed as one app-local `@include` in
`apps/nfs-demo/src/styles.scss` plus five prose/comment descriptions across
tracked files. The library shipped nothing.

Here is how each clause is discharged in M002.

**Clause 1 -- "Foundation's default theme ships unchanged." Untouched, and
verifiably so.** `theme()`'s zero-argument path still reads
`settings.$button-background` and `settings.$button-palette`. `$wcag-palette`
is inert data that emits nothing until a consumer passes it -- verified at **0
bytes on `@use`**. `verify-foundation-parity` compares compiled *declarations*
and is structurally blind to a variable, so it stays green **for the right
reason**, not by luck.

**Clause 2 -- "A WCAG/axe-compliant theme SHIPS in M002." This is the clause
M003 left open, and D033 closes it literally.** `$wcag-palette` becomes a
member of the library's public Sass API inside the already-exported
`ngx-foundation-sites/scss/button` entry point, present in the published
tarball's `scss/_button.scss`, reachable by any consumer as
`@use 'ngx-foundation-sites/scss/button' as nfs-button;` ->
`nfs-button.$wcag-palette`. "Ships" becomes true of the **artifact**, not of
the demo app.

**Clause 3 -- "the axe suite runs against that compliant theme", and "an exact
expected-failure assertion, never a blanket suppression."** D036 locks the axe
proof **in place**: the `m002-compliant` fixture in
`apps/nfs-demo/e2e/nfs-button-a11y.spec.ts` stays the proof, unchanged in shape,
and after D033's collapse it scans CSS compiled from the **shipped constant**
rather than from a hand-typed app-local copy -- delivered through a real
published tarball over the `exports`-gated public subpath, in **both CSR and
SSR**. That is a stronger discharge than the founding brief anticipated.

Because the compliant theme is now *also* a selectable addon preset, the link
between the preset and the axe proof is made by **identity, not by a second
scanner** -- three assertions chained:

1. Those three hexes clear axe (the existing `m002-compliant` fixture, zero
   violations, CSR + SSR, over the published package).
2. The addon seeds exactly those three hexes -- a lane-1 unit assertion reading
   the preset through the addon's own probe mechanism and comparing it against
   the same literals the fixture proves, plus a WCAG AA ratio computation.
3. Seeding renders them -- one Playwright assertion that the preview's success /
   warning / alert buttons compute to `#238648` / `#9e6c00` / `#cb4b37`.

`@storybook/addon-a11y` is **not** re-pointed, and no axe scan is added to any
Storybook lane.

**The frozen literals -- stated as a constraint, not an implementation note.**
The default theme's three `expectedContrastFailures` entries --
`{alert, #fefefe, #cc4b37}`, `{hollow-success, #3adb76, #ffffff}`,
`{hollow-warning, #ffae00, #ffffff}` at `nfs-button-a11y.spec.ts:67-98` -- are
**FROZEN**. They must **not** be collapsed into `$wcag-palette`, into any
shared map, or into an import. An exact-set assertion has to *name* what it
expects; sourcing its expectations from the same map the code under test uses
makes it assert its input against itself, which is the subtle form of the blanket
suppression D023 forbids. Concretely:

- The three failure literals stay hand-written in the spec.
- The `m002-compliant` fixture keeps `expectedContrastFailures: []`.
- D033's comment-only edits at `app.component.ts:105-106` and
  `nfs-button-a11y.spec.ts:107` touch **prose only** -- never the fixture data at
  `:67-98`.
- **No new suppression, no `runOnly` narrowing, no rule disable anywhere in
  M002.**

One drift surface is knowingly left open: the README's hand-typed hexes. A
README-drift check was considered and **rejected** -- it is documentation drift,
not correctness drift; the axe fixture is the real gate, and the README
paragraph's value is precisely its concrete measured ratios.

---

## 5. Requirements M002 touches but does not own

**Flag these for the planner. Do not edit them as part of applying this
hand-off.** Each is an existing requirement whose text or wiring M002's work
interacts with.

| Requirement | How M002 touches it | What the planner must do |
| --- | --- | --- |
| **R003** (WCAG AA + WAI-ARIA, `validated`) | Its scoping note explicitly says R003's full wording "is satisfied by M002's forthcoming WCAG/axe-compliant theme, against which the axe suite will also run once M002 lands". D033 + D036 make that true. | R003's Notes become stale the moment M002 lands. Plan a text update as part of M002's closeout -- **do not** flip anything about the default theme's three disclosed shortfalls, which remain deliberate and gated. |
| **R008** (consumer theme output wins the cascade, `validated`) | The addon's unlayered output must beat the component's `@layer nfs-defaults` defaults. **Verified in real Chromium across all four insertion orders** with an order-detecting control -- inherited for free, no order tricks. | Do not treat this as new work. Do budget lane-2 assertion B2 (both orders + layered-only control), because that is the only lane where the assertion is non-vacuous. |
| **R026** (no CSS-in-JS, `validated`) | The addon injects browser-compiled CSS through JavaScript, and the ESLint rule **actually fires** on that code (2 errors, verified). D035 clause (f) draws the boundary via one `**/`-prefixed `ignores` entry on the existing block. | Budget the two new spec tests (exemption works; a *sibling* file in the same directory still fires) and the path-spelling divergence guard. The config block count must stay **2** or `nfs-button.r026-lint.spec.ts`'s `toHaveLength(2)` breaks silently. |
| **R019** (publishing deferred) | D032 stops at "workspace-local", never at "ship it". Nothing new becomes publishable. | Confirm no addon `package.json`, `exports` key or release-config neutralisation appears in any slice. |
| **R007** (docs incl. README theming guide, `validated`) | The addon needs one README section (section 6, fog item 3). `verify-autodocs-coverage` is deliberately **not** extended. | Treat the README section as an M002 deliverable; treat the gate extension as out of scope. |

### 5.1 The port-4400 collision -- a change to EXISTING wiring

This is the one item in this list that modifies a working target, so it must be a
**named task**, not a side effect of adding the e2e project.

`test-storybook` currently starts its **own** `static-storybook` on port 4400 via
`concurrently`. The new Playwright project also depends on `static-storybook`, on
the same port. `nx run-many -t e2e,test-storybook` would race two servers onto
one port.

**Locked resolution:** refactor `test-storybook` off `concurrently` onto
`dependsOn: ["verify-autodocs-coverage", "static-storybook"]`. Nx then runs one
`static-storybook` task and both lanes attach to it, provably exercising the same
served artifact. `static-storybook` is genuinely `continuous: true` [VERIFIED],
and `apps/nfs-demo:e2e` already depends on four continuous serve targets, so the
pattern is proven in this repo.

**`wait-on tcp:4400` is KEPT, deliberately.** Nx's continuous-task ordering is
start-based, not readiness-based -- dropping `wait-on` trades a port collision for
a start-up race. The new Playwright lane gets the same treatment via a
`globalSetup` copied from `nfs-demo`'s polling one.

**Named fallback if continuous-task sharing misbehaves in CI:** give the e2e lane
its own port via a `static-storybook` configuration. Lower blast radius, but it
leaves `concurrently` in place, keeps two servers, and adds a port to remember.

**Carried as [INFERRED]:** that Nx shares one `static-storybook` task between two
dependents in a single `run-many`. Grounded in `continuous: true` and the
`nfs-demo:e2e` precedent, but the two-dependents case was not executed.

### 5.2 The atomic 3-part demo-app rewire

`apps/nfs-demo` consumes a **real published tarball**, not the workspace
(D014/D015, gated by `verify-registry-consumption.mjs`). The installed tarball is
a **snapshot**: adding `$wcag-palette` to source does not reach the demo app.

If `styles.scss` is re-pointed at `nfs-button.$wcag-palette` without
refreshing the tarball, the demo's Sass compile fails outright with an undefined
variable -- and it fails in `nfs-demo:build`, which `serve` / `serve-static` /
`serve-ssr` / `serve-ssr-node` all feed and which `e2e` depends on. **The axe
suite would go red for a resolution reason, not a contrast one.**

**So this is one atomic change with three ordered parts:**

1. Add `$wcag-palette` to
   `packages/ngx-foundation-sites/src/scss/_button.scss`.
2. Run `nx run nfs-demo:verify-registry-consumption` (rebuild -> republish ->
   reinstall) and commit the refreshed
   `apps/nfs-demo/.registry-consumption-evidence.txt`. This is already the
   established workflow -- HEAD's `1c1f770` is literally "Captured fresh,
   current-main execution evidence".
3. Re-point `apps/nfs-demo/src/styles.scss:27-34` to
   `$palette: nfs-button.$wcag-palette`.

Splitting this across commits leaves a broken demo build in between. Deferring it
to a follow-up is worse: the demo's copy is the **one executable restatement**,
so leaving it uncollapsed defeats D033 entirely.

**There is deliberately no gate for this. The sequencing IS the requirement.**
`verify-registry-consumption` gains no `dependsOn` -- it publishes to a local
Verdaccio and reinstalls, and making it a dependency of `lint` or `e2e` would put
a registry server in the standard battery. It does not need wiring because the
failure it guards is already loud.

**Carried as [INFERRED]:** that a stale tarball fails `nfs-demo:build` with an
undefined-variable error specifically. The failure is certain; its exact message
was not executed.

---

## 6. Fog closed -- the map's three "Not yet specified" items

All three are resolved here. None is graduated into a new ticket: this ticket
closes the map, and a new ticket would reopen it. Each is either folded into
requirement text as an explicit, planner-visible statement, or ruled out of
scope.

### 6.1 Preset extensibility and persistence -- SPLIT: persistence answered, extensibility out of scope

**Persistence is answered, not open.** Ticket 09 settled it and the answer is
folded into R009 above. Reconciled precisely:

- **The URL is the persistence mechanism.** Control state round-trips through
  `?globals=`. Because the globals value is a sparse canonical-minimal map with
  `initialGlobals.nfsTheme = {}`, the post-reload value is **byte-identical to
  the in-session value** -- the shallow top-level merge that would otherwise be a
  trap becomes the correct semantics, because the object genuinely is the
  complete override set.
- **Story switch is a non-event.** Globals are owned by the Preview and survive
  story navigation, and the single `<style id="nfs-theming">` node is
  document-wide.
- **The hazard the map's fog entry gestured at is real and is mitigated by
  design:** one invalid value drops the **entire theme** from the URL, not just
  its own key. R009 answers it by making the panel the validation boundary, which
  turns the shareable-link guarantee from best-effort into total.
- **No `localStorage` persistence.** Not needed -- the URL already covers reload
  and navigation -- and adding it would create a second state shape that can
  disagree with the URL.

**User-saved presets are OUT OF SCOPE for M002.** They require a storage
mechanism the globals/URL model does not provide, a naming and management UI, and
a collision story against the two shipped presets. Two presets is what D023
requires and what the destination describes. A line is added to the map's Out of
scope section.

### 6.2 Behavior as more `nfs-*` components land -- folded into R009 as a stated decision plus a bounded open question

`theme()` is button-only today. Resolved as follows, and stated in R009's open
questions rather than left implicit:

- **The control surface is GLOBAL, not per-component, and that is a decision.**
  The addon passes no `$selector`, so it compiles the mixin's default `.button`
  and rethemes everything in the preview. Three grounds: it is what the addon is
  for (a scoped selector produces a comparison tool, not a theming tool); it has
  **zero divergence** from what a consumer writes, so the addon's output is
  reproducible by a real consumer's build; and scoping would need story-wrapper
  machinery whose only purpose is undoing the first ground.
- **What happens with a component that has no theme mixin: nothing.** The addon
  compiles the theme mixins it knows about; a component without one is simply
  unaffected.
- **The bounded open question for the planner:** when a second `nfs-*` component
  ships its own theme mixin, the addon's single compile call must grow to include
  it, and the control surface stays one global theme. **That growth is not M002
  scope** -- no second component exists, and building the extension point now is
  speculative generality. Per-component control surfaces are ruled out of scope.

### 6.3 Docs surface -- folded into R009 as one named deliverable; the gate extension ruled out of scope

- **In scope, named:** one README section in
  `packages/ngx-foundation-sites/README.md` documenting the addon -- the six
  controls with their units and ranges, the two presets and the exact-match rule,
  the URL-sharing guarantee, and the story-mode-only panel limitation (docs pages
  inherit the current theme but cannot change it). This is exactly the surface a
  user needs and nothing more. Note ticket 01's finding that the reference
  project shipped its addon with **zero tests and zero documentation** -- there is
  no pattern to inherit, and that absence is precisely what this deliverable
  avoids repeating.
- **Out of scope, with reason:** extending `verify-autodocs-coverage` to the
  addon. That gate exists to prove Angular component input tables render JSDoc;
  the addon has no Angular component and no autodocs page. Extending a docs gate
  to an undocumented surface is inventing the requirement.
- Also out of scope for the same "documentation drift is not correctness drift"
  reason: a README hex-literal drift check (section 4).

---

## 7. D020 is load-bearing, unusual, and deliberately costed

**Record this so a future reader cannot mistake the unusual path for an
accident.**

D020 is a **standing human decision with `Revisable?: false`**: SCSS variable
theming only, no CSS custom property theming surface. Exactly one theming
mechanism -- Sass variables -- with two places compilation can happen: the
consumer's build, or the browser. **M002 is that second place.** The constraint
forbids the *mechanism*, not the runtime-theming *capability*.

**What ticket 01 found, and it is the answer rather than a gap in the search:**

- **Zero Storybook addons compile Sass in the browser.** A code search for
  `compileString storybook addon` across GitHub returns nothing.
  `@storybook/addon-themes`, `storybook-addon-sass-postcss` and
  `storybook-design-token` all swap prebuilt CSS or preprocess at build time.
- **Not one first-party design system ships a compiler.** Carbon, Spectrum,
  Fluent (v8 and v9), Polaris and Ant Design all converged on CSS custom
  properties or JS theme objects -- the mechanism D020 forbids. Angular Material
  swaps prebuilt compiled CSS.
- **The one real architectural precedent is dead.**
  `storybook-addon-customize-antd-theme` compiled **Less** in the browser and has
  been stranded on Storybook 6 / antd 4 since 2021.
- **There is an abandonment report.** Ant Design Pro shipped browser Less
  compilation and published why they regret it: "the whole page is stuck", "not
  suitable for adaptation in a formal environment". Their fix was narrowing what
  the browser recompiles.

**M002 is deliberately doing what the ecosystem consistently chose not to do.
That is a legitimate design choice, not a mistake -- and it needs its
justification recorded, because the justification is narrow.**

**Where the browser compiler genuinely earns its keep:** it evaluates
Foundation's own Sass colour functions, maps and mixins against user input.
Foundation derives hover colours, text-contrast colours and the dropdown arrow
colour via `scale-color` and `color-pick-contrast`. For the curated set (5
colours + radius) that case holds. **It would NOT hold for a set of literal
pass-through values** -- if the controls were ever reduced to values that are
simply substituted into CSS, the CSS-custom-property mechanism would be strictly
better and D020's cost would be unearned. That is the condition under which D020
should be revisited, and it is the only one.

**Two favourable conditions this repo has that Ant Design Pro did not:**

1. **The chain is already narrow.** The reachable closure is **13 Foundation
   partials + 3 library partials, 71.9 KiB / 24.3 KiB gzip** -- which is exactly
   where the reference project's own optimisation pass converged after measuring
   a 70-file alternative. Ant Design Pro's fix (narrow what recompiles) is this
   repo's starting point.
2. **The "whole page is stuck" failure is measured and eliminated.** Main-thread
   compilation blocks for 337 ms (~20 dropped frames). A single Worker takes the
   max main-thread frame gap to **19.1 ms** and is **~30% faster** (197 ms median
   vs 280-305 ms). One Worker converts the jank to nothing; a pool would convert
   nothing to nothing.

**The cost, attributed to the decision that causes it:**

> The **802 KiB gzip / 436 KiB brotli** Dart Sass payload is a cost of **D020**,
> not of the addon's implementation. It is what "no CSS custom properties, ever"
> buys, and it is the price of evaluating Foundation's real Sass functions
> against live input. No implementation choice in M002 reduces it: the sass
> bundle has **zero tree-shaking** (0 exports, 0 imports, 0 `__PURE__` across
> 133k lines), so lazy loading is about *when* the cost lands, not whether it can
> be reduced. Every design decision in this milestone already pushes it as late
> as possible -- it is fetched only on first theme interaction, and preview boot
> stays at 1140 KiB gzip.

**Number hygiene, because two figures circulate.** Ticket 03's **~916 KiB gzip**
was a raw-file estimate. Ticket 05's **802 KiB gzip / 436 KiB brotli** is the
**measured real bundled cost** and is the authoritative figure; the emitted
worker chunk lands at roughly 801-825 KiB gzip across tickets 08 and 09's
reporting. Use 802 KiB gzip. Also note **+70% on the preview's current 1140 KiB
gzip** as the relative framing.

**One more inherited clock, stated plainly:** the chain depends on Sass's
`@import` *and* global built-in functions, which are removed together in Dart
Sass 3.0.0 (deprecated 1.80.0, floor 2026-10-17, realistically later). M002
inherits that clock **exactly** -- it adds nothing and reduces nothing, and the
Node build has identical exposure today. One favourable side effect, stated and
no further: the generated sources module *is* the vendored 16-file snapshot, so
the eventual freeze costs one deleted target.

---

## 8. Carried forward: what is explicitly NOT verified

Much of this map's value is that its claims were executed. These are the ones
that were not. **Do not let planning promote any of them to settled.**

### Untestable under the effort's no-code-changes constraint

- **`sass` inside the REAL Storybook preview bundle.** A standalone webpack build
  with the verbatim Storybook config, plus static analysis of the real emitted
  bundle, was substituted.
- **Cold HTTP-cache-over-network timing.** Every timing figure is warm-cache and
  local. The first real fetch of the ~802 KiB gzip chunk over a network is
  unmeasured.
- **`build-storybook` with `test: true`.** The `--test` / esbuildMinify branch
  was built standalone and produced byte-identical CSS from a genuinely mangled
  bundle, so it is a **watch item, not a blocker** -- but the real Storybook
  `--test` path was not run, and D036 deliberately adds **no guard** for it. A
  comment, nothing more.
- **Non-Chromium engines.** Every browser measurement is Chromium. Ticket 10
  deliberately excludes non-Chromium browsers from the Playwright lane: a
  Storybook addon's behaviour is not a CSS-engine claim, unlike `nfs-demo`'s
  logical-properties matrix.

### [INFERRED] -- reasoned, not executed

- `import.meta.url` survives `@ngtools/webpack`'s transpile given
  `module: "preserve"`. Strong, and caught by the build-artifact gate if wrong.
- The worker `.ts` entry passes through `@ngtools/webpack`'s loader chain once it
  is inside `.storybook/tsconfig.json`'s `include`. Failure mode is a **hard
  build error**, not silence.
- The real `test-browser` lane (`@nx/angular:unit-test`, `ChromiumHeadless`)
  resolves `sass` the same way the standalone browser-mode probe did.
- `optimizeDeps.include: ['sass']` will be wanted in the browser lane. The
  probe's reload warning is the only evidence; assertions passed either way.
- Nx shares one `static-storybook` task between `test-storybook` and
  `nfs-storybook-e2e:e2e` in one `run-many`. Fallback named in section 5.1.
- A stale tarball fails `nfs-demo:build` with an *undefined-variable* error
  specifically.
- The addon's emitted bundle directory will be
  `sb-addons/packages-ngx-foundation-sites-storybook-<N>/`. **The design never
  depends on it** -- the gate globs and content-matches.
- The end-to-end sparse-map URL round trip is verified **by parts**:
  `buildArgsParam` was executed, `parseArgsParam` and `updateFromPersisted` were
  read from source. `parseArgsParam` is not exported, so the composition was not
  run in one go.
- `.button` has no collisions elsewhere in the preview chrome.
- Un-debounced `updateGlobals` on every `input` event is acceptable channel
  traffic. Upgrade path named: a 50 ms trailing debounce on the **write** only,
  changing nothing else.
- `data-nfs-seq` is a sufficient readiness signal for every Playwright style
  assertion. Derived from an already-required sequence number; the addon does not
  exist yet to observe it.

### Silently-green failure modes to keep gated

Three failure classes in this design produce **zero errors and zero warnings**.
Each has a gate; none of those gates is optional.

1. **The Worker silently not bundled.** If `@storybook/angular` ever spreads
   `cliConfig.module` wholesale, Angular's `worker: false` reaches the config and
   the worker module is not bundled anywhere -- **zero errors, zero warnings**,
   and a runtime 404. Gated by asserting the sass marker appears in exactly one
   emitted chunk.
2. **The R026 carve-out going inert.** A config-dir-relative `ignores` glob is
   exempt under the spec harness and **fires** under Nx's workspace-root cwd:
   green `nx test`, red `nx lint`. Gated per-commit by running the exempt file
   under both path spellings in one process, plus a one-line static assertion
   that every `ignores` glob starts with `**/`.
3. **A green build proving the addon loaded.** An unresolvable addon only warns,
   and a crashing manager entry is swallowed by an esbuild-injected try/catch.
   Gated by the bundle content-match **plus** a Playwright zero-manager-
   `console.error` check.

---

## 9. Application checklist for the consuming session

State-changes that must end up in GSD. Route-agnostic -- apply by whichever
interface is available.

1. **Update R009** -- replace Description and Validation with section 1's text,
   including the six-row control table, the delivery/mechanism block, the preset
   model, and the two carried open questions. Status stays `active`; owner
   becomes M002's relevant slice once decomposed.
2. **Update R021** -- replace Description and Validation with section 2's
   four-lane text.
3. **Append D032-D036** to the decisions register, verbatim from section 3,
   using the existing eight-column shape. Append-only; D032 is the next free
   number. Optionally split D035's clause (f) into D037 per section 3's note.
4. **Record the D023 closure** (section 4) wherever M002's milestone context
   lives, including the explicit statement that the default theme's three
   `expectedContrastFailures` literals are **FROZEN**.
5. **Record the D020 costing** (section 7) as milestone context. Do **not** edit
   D020's register row -- it is human, `Revisable?: false`, and append-only.
6. **Carry section 5 into planning as constraints on existing surfaces**,
   especially the two that change working code: the port-4400 refactor of
   `test-storybook` (a named task, not a side effect) and the atomic three-part
   demo-app rewire (one change, three ordered parts, no gate -- the sequencing is
   the requirement).
7. **Carry section 8 forward** so the unverified items stay visible during slice
   design rather than being rediscovered during execution.
