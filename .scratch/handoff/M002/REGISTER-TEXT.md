# M002 register text: what to write into GSD

**Companion to `HANDOFF.md` in this folder.** This file holds only the text that
must be written into `.gsd/` -- the two requirement replacements, the fourteen
decision-register rows, the one new requirement, and the one Notes amendment.
Everything needed to understand and plan it is in `HANDOFF.md`; the application
order is its section 12.

**Section numbers are shared with `HANDOFF.md` and unchanged by the split**, so
cross-references in either direction resolve. Sections **1, 2, 5, 6 and 7** are
here; sections **0, 3, 4, 8, 9, 10, 11 and 12** are in `HANDOFF.md`.

**Do not edit `.gsd/` by hand.** Those files are projected from a database.

**The decision register is APPEND-ONLY.** Never edit or remove an existing row.
Rows that have not yet landed are still editable -- which is why D039's
amendment (section 5) must be made BEFORE the append, not after.

---

## 1. Sharpened R009

Replace R009's Description and Validation. Class stays `differentiator`, Status stays
`active`, Source stays `user`.

### R009 -- replacement text

> **Title:** Storybook ships a workspace-local theming addon that compiles the
> library's real Foundation Sass in the browser and exposes six curated live
> controls over Foundation's global theme variables, plus two presets, with no
> CSS-custom-property theming surface (D020) and no growth of `theme()`'s public
> Sass signature.
>
> **Description:**
>
> A theming addon resident in `packages/ngx-foundation-sites/.storybook/`
> (workspace-local Storybook tooling, auto-discovered via `.storybook/manager.ts`
> manager-side and the existing `.storybook/preview.ts` preview-side; **the addon
> itself adds no new package, no `addons: []` wiring, and no `exports`-map or
> `verify-exports-map` change**) lets a developer or designer retheme **the library**
> live in Storybook without a rebuild.
>
> **The curated control set is exactly six values, and it is closed.** All six are
> **Foundation global theme variables**; Button's `theme()` mixin is today's only
> consumer of them, and the control set is therefore correctly shaped for a library
> that will wrap every Foundation component:
>
> | Control | Foundation global | How it reaches Button's mixin today | Foundation default | Wire format |
> | --- | --- | --- | --- | --- |
> | primary | `$foundation-palette.primary` | `theme($background:)` | `#1779ba` | lowercase `#rrggbb` |
> | secondary | `$foundation-palette.secondary` | `theme($palette.secondary)` | `#767676` | lowercase `#rrggbb` |
> | success | `$foundation-palette.success` | `theme($palette.success)` | `#3adb76` | lowercase `#rrggbb` |
> | warning | `$foundation-palette.warning` | `theme($palette.warning)` | `#ffae00` | lowercase `#rrggbb` |
> | alert | `$foundation-palette.alert` | `theme($palette.alert)` | `#cc4b37` | lowercase `#rrggbb` |
> | radius | `$global-radius` | `theme($radius:)` | `0` | JS `number`, integer CSS px, clamped 0..32 |
>
> **Note beside the table, part 1 -- the "Foundation global" column is VOCABULARY,
> not wiring.** Seeding those upstream global names into the library's island has
> **NO EFFECT on emitted CSS** [VERIFIED: `$foundation-palette`, `$primary-color`,
> `$global-radius`, `$global-font-size`, `$global-margin`, `$global-text-direction`
> all measured inert]. The island pre-seeds the *derived* names non-`!default` before
> Foundation's `@import`s, so Foundation's own derivation cascade never fires. The
> column names what each control **is** in Foundation's vocabulary; the mechanism by
> which it reaches CSS is the third column and nothing else. A future settings
> milestone that routes these controls through `$foundation-palette` /
> `$global-radius` would ship a silent no-op.
>
> **Note beside the table, part 2 -- the VALUE-vs-SHAPE rule, which is the forward
> test for any control added later.** The six controls are RTL-safe for a
> **structural** reason, not a numerical one: they are all *value* settings (a colour,
> a length). Every setting measured to activate RTL residue is a *shape* setting -- a
> boolean, a keyword, a count, or a map length -- because activating residue requires
> changing **which declarations are emitted**. So:
>
> > **The test for any new addon control is "can it change WHICH rules are
> > emitted?", never "is it a Foundation global?"**
>
> **A single BOOLEAN control would put the addon back in scope.** That is the standing
> re-entry condition (trigger 6 of the contract in `../deferred/HANDOFF.md`), and it is
> why the forward test is phrased mechanically rather than as a list of cleared names.
> Part 1 and part 2 answer different questions and both belong here: part 1 answers
> "does naming these globals do anything?" (no); part 2 answers "could a control added
> later activate an RTL defect?" (only if it is a shape setting). The clearance
> evidence for today's six is in section 3.
>
> No other variable is exposed. Font size, padding and hover-lightness are not addon
> controls. **`$global-text-direction` is explicitly excluded as a control** -- it is
> layout, not theming; it is mechanically unreachable through the addon's `@use` +
> `@include theme()` entry; it would break the six-scalar preset equality; and the
> demonstration need is already met better by the existing side-by-side `Rtl` story,
> which a preview-wide direction toggle could not express. (It is *accepted and
> honoured* as a library **settings** entry -- see D037. Excluded as a control is not
> excluded from the contract.) `rem` radii remain available to consumers compiling at
> build time; the addon's control is px-only by design.
>
> **The six controls are an ADDON surface, never the library's settings vocabulary.**
> The panel is a live-tweak subset of `theme()`'s arguments, chosen for what is useful
> to drag a slider on. The library's settings vocabulary is Foundation's 490-name
> surface, and it is a compile-time concern owned by a later milestone (D040). The
> panel must never be cited as evidence about the library's Sass API -- in either
> direction, and least of all as a reason to keep that API small.
>
> **Delivery and mechanism:**
>
> - A single custom addon **PANEL** titled `Theming` (`types.PANEL`), story-mode only
>   (`match: viewMode === 'story' && !tabId`). No toolbar entry.
> - Colour controls are a native `<input type="color">` paired with a text field
>   accepting `#rgb` / `#rrggbb` only, normalised to lowercase `#rrggbb`. Radius is a
>   range slider plus numeric stepper.
> - **The panel is the validation boundary.** Invalid input is marked in the UI and
>   never written to globals. This is a requirement, not an implementation note:
>   Storybook's `buildArgsParam` validates the *top-level* global, so one invalid
>   nested value silently drops the **entire theme** from `?globals=`, diagnosed only
>   by a `warn` that no existing gate catches. Because the panel validates on write,
>   **every reachable control state is URL-encodable** -- the shareable-link guarantee
>   is total, not best-effort.
> - State lives on **Storybook globals** under one key, whose value is a **sparse,
>   canonical-minimal override map** with `initialGlobals.nfsTheme = {}` meaning
>   "Foundation's default theme". A key is present **iff** its value differs from the
>   Foundation default; setting a control back to the default *deletes* the key.
>   Consequence: in-session state is byte-identical to post-reload state, the default
>   theme produces an **empty** `?globals=`, and "reset to default" is
>   `updateGlobals({ nfsTheme: undefined })` with no reset code to write.
> - **The compile call is a generated `THEMEABLE_MODULES` list, one entry today.** The
>   addon builds its entry string by mapping over that list -- one
>   `@use '<url>' as <ns>;` and one `@include <ns>.theme(<args>);` per entry -- rather
>   than hard-coding a single module. This is **free today**: the entry builder is
>   already a string builder, so one hard-coded pair becomes a `.map()` over a
>   one-element array. Verified: ONE compile over two themeable modules emits both
>   selectors and serves the Foundation `@import` island **once** (13 partials, not
>   26). Entries stay `{url, namespace}` **object literals**, not bare strings, so a
>   future entry can carry per-module argument or direction fields without a shape
>   change. Per-module argument filters are a **named seam, not built**.
> - **The entry string is an ordered array of sections whose FIRST section is reserved
>   for configuration and is empty today**, not a concatenation with extras appended.
>   `@use 'nfs:/button'` transitively loads the settings module immediately, and Sass
>   configuration must precede every `@use` of any module that loads it -- so an
>   appended configuration clause can never work. Cost: zero, the same ~4 lines either
>   way. Getting it wrong means restructuring the entry builder inside a Worker whose
>   diagnostics are degraded.
> - **The addon passes no `$selector` to any themeable module**, so each emits under
>   its own default selector (`.button` today) -- exactly what a zero-config consumer's
>   build produces. The addon must **not** seed bare Foundation globals in its entry;
>   that is the mechanism `_button.scss` records as measured-and-rejected, and it is
>   the exact channel that would make direction accidentally reachable and then
>   load-bearing.
> - Compilation runs **sync `sass.compileString` inside a single Web Worker**,
>   constructed lazily on the first theme change. Sources reach the compiler from a
>   **committed, generated TS data module** under `.storybook/`, produced by
>   `scripts/generate-theming-sources.mjs` and gated by a new `verify-theming-sources`
>   target on `lint`. **The generator takes N entry points and unions their closures**
>   -- two arrays, `THEMEABLE_MODULES` and `DATA_MODULES` -- and this is **required
>   today, not a generalisation**: negative control verified that a single-entry
>   closure over `nfs:/button` does **not** contain `nfs:/_theme.scss`, because nothing
>   `@use`s a data module until a consumer does. The entry-point arrays stay **data**,
>   and the themeable list is emitted into the data module so the byte-compare covers
>   it. **No gate may freeze a literal closure file count** -- adding a module would
>   turn a correct change into a red gate for the wrong reason. No network fetch, no
>   bundler raw imports (Angular's unconditional `.scss` webpack rule makes
>   `asset/source` return *compiled CSS*, not raw Sass -- a silently wrong string).
> - Recompile policy: **no debounce timer**; a single-slot latest-wins coalescer.
>   In-flight compiles are superseded, never cancelled (terminate+respawn costs 3-4x a
>   warm compile). A `Compiling...` indicator appears in the panel only past 300 ms.
>   **The last good CSS is never cleared on error**; the panel shows `sassMessage` plus
>   a friendly source name derived from `span.url`. **Why a coalescer and not a timer,
>   stated durably:** the coalescer's coalescing interval **is** the machine's actual
>   compile time, so it self-tunes and needs no re-tuning as components land --
>   whereas a 250-300 ms constant picked today would fire mid-compile forever at full
>   library coverage. A trailing debounce would go **in FRONT of** the coalescer, never
>   instead of it, and only past a measured 1000 ms apply (reached at the 5th-6th
>   palette-driven component, i.e. full coverage).
> - **The default theme is never compiled.** The addon compiles only non-default
>   themes. Foundation's default theme is already on screen as the library's static
>   `@layer nfs-defaults` CSS, so there is no first-paint compile, no pre-compile at
>   init, and no `waitForInitialTheme()`-style readiness gate. Zero-compile beats
>   cache-hit. This is what makes the reference project's fourth mitigation
>   structurally inapplicable here (D038).
> - Compiled CSS is injected as **one `<style id="nfs-theming">` node in
>   `document.head`**, get-or-create by id, `textContent` replaced per compile. One
>   node total, shared across story and docs mode.
> - The addon carries **explicit test hooks as part of its contract**, not as a
>   test-authoring detail: `data-nfs-seq="N"` (the coalescer's monotonic sequence
>   number) on the injected style node, `data-testid="nfs-theming-panel"` with
>   `data-nfs-panel-state="loading|ready|compiling|error"` on the panel root, and
>   stable control ids `nfs-preset-select`, `nfs-color-<key>`, `nfs-color-<key>-text`,
>   `nfs-radius`.
>
> **Preset model:**
>
> - Two presets ship: **Foundation default** and **WCAG-compliant**. The compliant
>   preset is exactly three overrides -- `success: #238648`, `warning: #9e6c00`,
>   `alert: #cb4b37` -- inheriting Foundation's defaults for primary, secondary and
>   radius.
> - Both presets are **read from Sass at runtime** via a custom Sass function
>   registered on the addon's own `compileString` call, in one probe compile at panel
>   init. The probe reads `$wcag-palette` from **`nfs:/theme`** and the six
>   **Foundation-global** names from `internal/settings` -- `$primary-color`,
>   `$secondary-color`, `$success-color`, `$warning-color`, `$alert-color`,
>   `$global-radius` -- **not** the button-derived `$button-palette` /
>   `$button-background` / `$button-radius`. Verified byte-identical today, so the swap
>   is free, it drops a spurious `primary` key `theme()` skips, and it reads names that
>   survive the eventual split of `internal/_settings.scss`. **No TypeScript copy of
>   any of the six values exists anywhere.** The probe's variable list lives in the
>   generated data module beside `THEMEABLE_MODULES`, not inline in the Worker, and it
>   is a **named seam owned by the settings milestone**.
> - **Seeding is not locking.** Applying a preset is a single `updateGlobals` with that
>   preset's canonical map; afterwards the controls are ordinary controls.
> - **A preset reads as "selected" only on exact match**, and selection is **derived on
>   every render, never stored**. Formally: preset P is selected iff
>   `equal(canonical(live), canonical(P))`, a six-scalar deep-equal. Because both sides
>   are canonical-minimal, *sparse equality is resolved equality* -- a user who leaves
>   `primary` untouched and a user who explicitly types Foundation's own `#1779ba` are
>   the same object, not two states. Presets are ordered and the first match wins. When
>   nothing matches, a literal `Custom` entry is shown as selected; choosing `Custom`
>   is a no-op.
> - **The panel loads asynchronously on first open, by design, and the window is
>   ~1 ms.** Sequence: construct Worker (which is when the lazily-split sass chunk is
>   fetched) -> run the preset probe compile -> render controls. The probe itself
>   measured **1.1 / 0.7 ms** over 2 data files and never enters the Foundation island.
>   Until it resolves the panel is in `loading`. This is intended behaviour, not a
>   defect, and it must **not** be merged with a default pre-compile -- there is no
>   default pre-compile, and merging would drag the island into a 1 ms data read. The
>   preview never waits on the probe: `theme()` resolves omitted arguments internally,
>   so a themed story renders straight from the sparse map.
>
> **Stated user-visible consequences (accepted, not defects):**
>
> - The panel is unavailable on autodocs pages, but the theme still applies there --
>   docs pages render under whatever theme was last chosen, and retheming requires
>   navigating to a story.
> - Control state persists **through the URL only** (`?globals=`), which round-trips
>   across reload and survives story navigation. There is no `localStorage`
>   persistence and no user-saved presets.
> - The radius control's unit is implicit px, 0..32 integer.
> - The sass compiler payload is **802 KiB gzip / 436 KiB brotli** [VERIFIED,
>   measured], fetched lazily on first theme interaction, +70% on the preview's current
>   1140 KiB gzip. Preview boot is unchanged. **This cost is attributable to D020, not
>   to the addon** -- see section 9.
>
> **Sass API growth, stated exactly:**
>
> - **`theme()`'s public signature does not grow.** The six controls map 1:1 onto its
>   existing `$background` / `$palette` keys / `$radius` [VERIFIED against
>   `src/scss/_button.scss:58-63`]. That is the load-bearing claim and it stands.
> - **M002 does add one new public Sass module:** `src/scss/_theme.scss`, exported as
>   `"./scss/theme"`, carrying exactly one member (`$wcag-palette`) and emitting
>   **0 bytes** on `@use`. It is a **DATA module** and must never gain a `!default`
>   member or become the settings entry point (D040 / non-foreclosure constraint 1).
> - **The `exports`-map claim splits.** The **addon** adds no `exports` key (D032).
>   **M002 as a whole adds exactly one**, `"./scss/theme"` -- one line in
>   `package.json`, with no script, no `ng-package.json` and no new target, because
>   `verify-exports-map.mjs` diffs source-vs-dist keys and is agnostic to key count. Do
>   not read D032's "no exports-map change" as covering D033's key.
>
> **Documentation deliverable (one README section in
> `packages/ngx-foundation-sites/README.md`)**, covering: the six controls with units
> and ranges; the two presets and the exact-match rule; the URL-sharing guarantee; the
> story-mode-only panel limitation; **`$global-text-direction`'s accepted-and-honoured
> status with its inert-today disclosure** (D037); and **today's silent-ignore
> behaviour as a named known limitation** -- name `theme()`'s four arguments as the
> entire compile-time surface today, and state explicitly that Foundation `$variable`
> declarations in consumer stylesheets have no effect. That last item is M002's one
> positive obligation towards the seamless-migration constraint: pasting Foundation's
> entire 490-variable settings file compiles **byte-identically** (5839 B) with **no
> warning** [VERIFIED], and M002 is the only milestone in flight that ships theming
> documentation.
>
> **Validation (mappable):** R009 is proven by the Playwright lane's P1-P8 and the
> `verify-theming-bundle` gate G2a described in R021 -- specifically: the addon panel
> loads in the **static** Storybook build with zero manager `console.error` (P1 + G2a);
> driving the primary colour control changes the computed background-colour of a themed
> element with a pre/post differential (P2); selecting `WCAG-compliant` seeds all six
> controls to their named values and renders `#238648` / `#9e6c00` / `#cb4b37` (P3);
> tweaking one control flips the selector to `Custom` and setting it back flips it to
> `WCAG-compliant` (P4 -- the exact-match semantics under test); `?globals=`
> round-trips a single sparse override and the default theme yields an empty param
> (P5); the panel goes `loading -> ready` on first open (P6).

### Open questions R009 carries for the planner

The previously-carried "what happens when a second component lands" question is
**ANSWERED, not carried**: the compile call is a list, the generator unions N
closures, one compile over two themeable modules emits both selectors and serves the
island once [VERIFIED], adding component #2 to the *addon* is one array entry, a
component with no theme mixin is simply unaffected, and the control surface is
**global on merit** (the six variables are Foundation global concepts, so a global
surface becomes *more* right as components land). What is not M002 scope is the second
*component* itself. Two items remain:

1. **Docs deliverable scope.** The README section above is the deliverable. Extending
   `verify-autodocs-coverage` to the addon is explicitly **out of scope** (that gate
   proves Angular component input tables render JSDoc; the addon has no Angular
   component and no autodocs page). A README hex-literal drift check is out for the
   same "documentation drift is not correctness drift" reason.
2. **A conditional, not-yet-fireable assertion**, recorded so it is not rediscovered:
   once a **second** themeable module lands, the generated sources module must carry
   the island's dependency preamble (sassy-lists + typography) -- see section 10.6. It
   cannot fire today.

---

## 2. Sharpened R021

Replace R021's Description and Validation. Class stays `quality-attribute`, Status
stays `active`, Source stays `user`.

### R021 -- replacement text

> **Title:** The M002 theming addon is verified across four lanes -- Vitest `test`
> (jsdom), Vitest `test-browser` (real Chromium), a dedicated Playwright project
> against the static Storybook build, and build-time `verify-*.mjs` gates -- with each
> lane assigned the assertions it is the cheapest lane able to fail on for the right
> reason.
>
> **Description:**
>
> The original text said "Vitest unit tests and Playwright e2e tests". That is **two
> lanes short**. The verified split is four, and the axis is *capability*, not
> preference. The governing rule is: **the cheapest lane that can fail for the right
> reason. A lane that cannot observe the failure mode is not cheaper, it is vacuous.**
>
> **Lane 1 -- `test` (Vitest, jsdom). Proves: everything compiler-side and
> logic-side.** jsdom resolves the **Node** sass build and compiles the real `theme()`
> chain from the committed in-memory source map to **5839 bytes, sha256 prefix
> `49bfb1a2e67bf91a`** -- byte-identical to five other producers [VERIFIED]. So this
> lane owns: the sources-map fitness digest; **an assertion that the generated sources
> module contains `nfs:/_theme.scss`** (a negative control turned into a standing check
> -- a single-entry-generator regression is otherwise visible only as a Worker runtime
> error with a degraded diagnostic); per-control differential compilation (compile with
> A and B, assert the literal **and** `cssA !== cssB`); the preset baseline probe
> returning Foundation's six **global** defaults and `$wcag-palette`'s three overrides
> by exact key set; **preset-equality** (canonicalisation deleting a default-valued key
> is the load-bearing assertion -- without it the whole "sparse equality is resolved
> equality" property silently fails and no other test notices); input validation
> including feeding the panel's write output through the real `buildArgsParam` with a
> deliberately-invalid control producing an empty `?globals=`; Sass error shape
> (`sassMessage`, `span.url`, no ANSI) **and** the friendly missing-importer
> diagnostic, which only survives outside a Worker; the error-serialisation contract
> with a `structuredClone`-loses-the-fields control; the coalescer state machine; and
> the R026 config assertions including the new path-spelling divergence guard.
>
> **Lane 2 -- `test-browser` (Vitest, real Chromium). Proves: the four things jsdom
> structurally cannot.** Keep it to one spec file; each file pays the sass bundle cost.
> It resolves the **browser** sass build -- the same dart2js artifact the Worker chunk
> ships -- so a browser-only Dart Sass regression is observable without a Storybook
> build. It has a real `Worker`, for the theme-in / CSS-out and error-object round trip.
> And it is the **only** lane with a real cascade: **jsdom discards `@layer`-wrapped
> rules entirely** (a layered-only rule computes `rgba(0,0,0,0)`) [VERIFIED], so every
> R008 cascade assertion in jsdom would be vacuously green. The R008 assertion here
> runs in both insertion orders **plus a layered-only control** proving layered rules
> apply at all -- the control is what makes the result real. Injection idempotency
> (three calls, one `#nfs-theming` node, last CSS wins) sits here beside it. Any
> computed-colour read in this lane must first inject
> `*, *::before, *::after { transition: none !important }`. **This lane must not be
> narrowed or removed** -- it is the only place an authoritative CSS-validity oracle
> can exist (the browser's own CSSOM), and the library's one known silent-drop failure
> class needs one. That constraint is also carried by the deferred contract's C8, which
> re-purposes the same lane as a regression tripwire.
>
> **Lane 3 -- Playwright at `apps/nfs-storybook-e2e/`. Proves: only what needs the
> Storybook manager.** `@storybook/test-runner` **cannot** reach manager-side addon
> panels -- its `page` is the preview iframe [VERIFIED three ways]. So a dedicated
> `@playwright/test` project is required: new project directory, an `e2e` target with
> `dependsOn: ["ngx-foundation-sites:verify-theming-bundle",
> "ngx-foundation-sites:static-storybook"]`, a polling `globalSetup` copied from
> `nfs-demo`'s, and a ~40-line local `SbPage`. **Zero new dependencies.** The harness
> was proven live in this repo against the real `addon-a11y` panel, which registers
> through the same `addons.add(PANEL_ID, {type: types.PANEL})` mechanism M002's addon
> uses. Because it runs against `static-storybook`, this lane **is** the static-build
> proof -- earlier probes ran against the dev server only, so the first run against the
> static build is an explicit acceptance step, not an assumption. It owns: **addon load
> (panel tab present AND zero manager `console.error`** -- see section 10.4); control-to-
> computed-style with a pre/post differential, read from **a themed element of each
> themeable module** (the button today); preset seeding all six controls by name; the
> tweak-then-restore `Custom` <-> `WCAG-compliant` flip (the derived-selection proof,
> and the assertion a stored mode flag would fail); the `?globals=` round trip
> including the empty-param case; the panel's `loading -> ready` first open; and the
> autodocs-page consequence. Every style assertion waits on the `data-nfs-seq`
> readiness signal, never a timeout, and uses auto-retrying `toHaveCSS`/`toPass` --
> Foundation's 0.25s `background-color` transition made one-shot `getComputedStyle`
> reads return stale values twice during probing.
>
> **Lane 4 -- build-time gates. Proves: what no test can observe.**
> `verify-theming-sources` (on `lint`'s `dependsOn`) regenerates the source closure in
> memory and byte-compares it against the committed module, plus re-proves string-map
> CSS == filesystem CSS. It asserts on the **entry-point arrays and the byte-compare,
> never on a literal closure file count.** A **new** `verify-theming-bundle`
> (`dependsOn: build-storybook`, modelled on `verify-autodocs-coverage`'s
> one-script/`failures[]`+`cause` shape) globs `sb-addons/*/manager-bundle.js`,
> content-matches `ADDON_ID` (verified to survive minification), asserts **exactly
> one** match, and asserts `index.html` **imports** it -- the `modulepreload` link is
> only a hint. It also asserts that **a marker from the generated source closure**
> (`$button-background-hover-lightness` today) appears in exactly one emitted `.js`
> file and that that file is **not** among `iframe.html`'s module import specifiers,
> which proves the lazy-loading decision still holds.
>
> **Two vacuity traps in the inherited gate design, both fixed here and both worth
> stating as requirements:**
>
> 1. `iframe.html` contains **zero** `<script src=...>` attributes [VERIFIED] -- it
>    loads the preview via `import './...'` inside one `<script type="module">`. A gate
>    phrased as "not referenced by any `<script src>`" would have passed forever,
>    including with `sass` statically imported into the preview. The gate must parse the
>    module-import specifiers instead.
> 2. The addon bundle directory carries an **order-dependent index**. A hard-coded path
>    yields "file not found", which a sloppy script reports as "addon not present" --
>    correct-looking, and equally wrong after any addon reorder.
>
> **General rule adopted for the whole lane: every absence assertion is preceded by a
> presence assertion over the same collection.**
>
> **Anti-vacuity is a first-class requirement, per M003's RTL precedent.** Every
> compilation assertion is differential; every preset-equality assertion asserts both
> polarities; the error-serialisation subject is meaningful only because of its
> control; the cascade assertion is disqualified if its layered-only control fails. An
> addon that silently emits nothing must fail node-existence, `textContent.length > 0`,
> the `data-nfs-seq` increment, and the computed-style change.
>
> **A committed negative-control evidence file is a deliverable** -- see section 10.5.
>
> **One CONDITIONAL item, recorded now because it cannot fire yet.** When a second
> themeable module lands, lane 1 must additionally assert that the generated sources
> module contains the island's dependency preamble (sassy-lists + typography). A
> missing preamble is not a compile failure -- it is an *emission* failure that fires
> only when that component's rules are actually emitted, inside the Worker where the
> diagnostic degrades. Record it as a conditional item, not as a gate that would be
> vacuous today. See section 10.6.
>
> **Validation:** R021 is satisfied when all four lanes are wired and green, the
> Playwright lane's first run is against `static-storybook` (not the dev server), the
> negative-control evidence file is committed with all five entries red-then-green, and
> one real `nx lint ngx-foundation-sites` run with the addon's injection code present
> has been performed as a once-off acceptance step (distinct from the per-commit
> path-spelling assertion, which the spec harness structurally cannot model on its own).

---

## 5. Decision-register rows -- D032 through D045

Append these to `.gsd/DECISIONS.md`'s table in this order. **The register is
APPEND-ONLY** -- never edit an existing row.

**Numbering [VERIFIED 2026-08-11 against `.gsd/DECISIONS.md`]: the highest landed row
is D031, so D032 is the next free.** Both source efforts numbered conditionally
because neither knew the other's application order; applied together from this folder
that conditionality disappears. The flat sequence, with its provenance, is in
`../README.md` section 4. **Assigned range: D032-D044, extending to D045 if the
optional split is taken.**

**Columns, in order:**
`# | When | Scope | Decision | Choice | Rationale | Revisable? | Made By`.
Rendered below as one bullet per column.

**Standing HUMAN decisions all fourteen rows operate UNDER, and none re-decides:**
**D020** (SCSS-variable theming only; no CSS custom property theming *surface*),
**D022** (browser baseline pinned to Baseline "widely available" on 2026-05-07),
**D023** (Foundation's default theme ships unchanged; the compliant theme and the axe
proof are M002's), **D025** (no upstream reports filed for third-party defects, ever).

### D032 -- delivery shape

- **When:** M002 wayfinding effort (`.scratch/m002-storybook-theming-addon/`), 2026-08-11
- **Scope:** architecture
- **Decision:** Whether the R009 theming addon ships as workspace-local Storybook tooling or as a publishable addon package
- **Choice:** Workspace-local, resident in `packages/ngx-foundation-sites/.storybook/`, entry points auto-discovered (`.storybook/manager.ts` manager-side, the existing `.storybook/preview.ts` preview-side). No new package, no `addons: []` wiring, no `local-preset.ts`, and **no `exports`-map or `verify-exports-map` change attributable to the ADDON** (M002 does add one `exports` key, for D033's palette module -- that key belongs to D033, not here). The module boundary is kept extractable-later in file terms only (entries literally named `manager.ts` / `preview.ts`; the addon reaches the library only through published specifiers), with any `package.json`, `dist/` build, addon-kit scaffold, Nx project or path alias written "for later" explicitly rejected as speculative generality. Costs one `include` line in `.storybook/tsconfig.json`, whose `"*.ts"` glob is non-recursive.
- **Rationale:** Verified three ways that a workspace-local unpublished addon can be wired by relative path and that `resolveAddonName` returns structurally identical records for local paths and published packages -- so a package buys zero functional gain. A separate addon *directory* loses on a cache-coupling asymmetry verified in `nx.json`: the `production` named input excludes `.storybook/**` but not a sibling directory, so every addon edit would invalidate `build` -> `verify-exports-map` -> `lint`. A *package* loses four further ways: `workspaces: ["packages/*"]` is live, the library package is non-private with no `release.projects` filter (so honouring R019 would mean writing config to neutralise what you just created), a separate package sits outside `{projectRoot}` and would make `build-storybook` go stale-cache **silent**, and it would convert the sass payload into a consumer cost. Verified component-agnostic in the multi-component correction sweep -- the shape holds at any component count. Operates under D020 and R019; re-decides neither.
- **Revisable?:** true
- **Made By:** agent

### D033 -- where the WCAG-compliant palette lives

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** library
- **Decision:** Where the WCAG/axe-compliant palette lives as a single source of truth, given the founding brief's assumption that M003 already produced one was false
- **Choice:** `$wcag-palette` becomes a plain public Sass map in a **NEW** `packages/ngx-foundation-sites/src/scss/_theme.scss`, exported as `"./scss/theme"` -- one added line in `package.json`. `src/scss/_button.scss` is **UNCHANGED** and does **not** `@forward` it: `theme()` takes `$palette` as an argument, so a component module never needs to see theme data. The demo app reads it as `@use 'ngx-foundation-sites/scss/theme' as nfs-theme;` -> `$palette: nfs-theme.$wcag-palette`; the addon reads it, plus Foundation's **global** defaults from `internal/_settings.scss`, through a custom Sass function registered on the `compileString` call it already makes. No script change, no `ng-package.json` change, no new Nx target, no generated artifact, and **no TypeScript copy of the values anywhere**. `_theme.scss` is a **DATA module**: plain assignments, one member, **no `!default`**, and it is **not** the settings entry point (D040, non-foreclosure constraint 1). The demo-app rewire is M002 scope and is one atomic three-part change (section 10.2).
- **Rationale:** `success` / `warning` / `alert` are **Foundation `$foundation-palette` keys -- a global concept**, not button variants. The earlier placement in `_button.scss` was chosen because that was the only public entry point that existed, i.e. for exactly the single-component reason the multi-component constraint forbids; the correction pass re-weighed that cost argument and **it did not survive**. The `exports`-partial-name inference is now **VERIFIED TRUE** (Node's own resolver refuses `fakepkg/scss/theme` under the identity map `"./scss/*"`; only the literal `scss/_theme.scss` passes) -- but it binds **no consumer in this repo**: Dart Sass `loadPaths`, Dart Sass's `NodePackageImporter`, **and Angular's own Sass importer** all bypass `exports` for subpaths. Angular's is the decisive one: `@angular/build`'s `findFileUrl` falls back to `join(packageRoot, ...pathSegments)` after an exports-honouring miss, which resolved even the `null`-mapped `scss/internal/settings` against the REAL tarball. The key is therefore added for the *published* surface's correctness and costs one line -- `verify-exports-map.mjs` diffs source-vs-dist keys in two loops and never enumerates `.scss` files, and `ng-package.json`'s `src/scss/**/*.scss` asset glob already ships any new file. The placement is **free now and expensive later**: `$wcag-palette` does not exist yet, so moving it costs nothing today and would later be a breaking rename of published API or a permanent `@forward` shim. Substance: the palette had **one executable instance and five descriptions** across five tracked files, the library shipped nothing, and the reference project carried **three mutually inconsistent** compliant palettes at HEAD -- the exact drift this collapse prevents. Verified by execution: a standalone `nfs:/theme` module compiles, is capturable through the addon's custom-Sass-function mechanism on both the Node and **browser** paths, adds +1 file / +0.4 KiB raw to the closure, and emits **0 bytes** on `@use`. Operates under D023; decides the mechanism, not the substance.
- **Revisable?:** true
- **Made By:** agent

### D034 -- how Foundation's Sass reaches the browser

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** How the Sass sources the in-browser `theme()` compile reaches are delivered to a compiler that has no filesystem -- measured today at **16 files / 84.4 KiB raw / 24.1 KiB gzip**, bounded at **52 files / 212.9 KiB / 46.2 KiB gzip** across all 35 Foundation components and **111 files / 349.1 KiB / 70.1 KiB gzip** at the absolute `foundation-everything()` ceiling
- **Choice:** Build-time inlining, with an **N-entry-point** generator. `packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs` takes two data arrays (`THEMEABLE_MODULES`, `DATA_MODULES`), compiles each entry's real chain in Node with a disk-backed importer, **unions the closures**, records exactly the URLs it served, and emits a **committed** TS data module under `.storybook/` -- with `THEMEABLE_MODULES` emitted into that module so `verify-theming-sources`' byte-compare covers it. The Worker feeds the sources to its importer verbatim. Gated by a new `verify-theming-sources` target on `lint`'s `dependsOn`, which asserts on the arrays and the byte-compare and **never on a literal file count**. `sass` is lazy **by construction**: it is imported from the worker module and nowhere else, so webpack's worker chunk *is* the split point and no `await import()` is needed. Preview boot stays 1140 KiB gzip. The artifact lives in `.storybook/` -- inside the `default` input but outside `production`, and unreachable by `ng-package.json`'s `src/scss` asset glob, so it cannot ship.
- **Rationale:** N entry points are **required today, not a generalisation**: negative control verified that a single-entry closure over `nfs:/button` does **not** contain D033's `nfs:/_theme.scss`, because nothing `@use`s a data module until a consumer does -- so a single-entry generator would silently omit it and fail at runtime inside the Worker with a degraded diagnostic. Bundler raw imports are **blocked, not merely worse**: Angular's `.scss` webpack rule applies `resolve-url-loader` + `sass-loader` through an unconditional nested `{ use }`, so no query escapes it and adding `type: 'asset/source'` yields **compiled CSS, not raw Sass** -- a silently wrong string. Runtime fetch forfeits the locked sync compile (async in-browser is 6-7x slower), needs `staticDirs` to have anything to fetch in the static build, and would publish `src/scss/internal/*` as fetchable URLs. Pre-flattening saves ~0.4% against the worker chunk and moves nothing. The "sources are nearly free" conclusion **SURVIVES the multi-component re-measurement**, reworded from "noise" to **a bounded rider**: 3.0% of the 801 KiB gzip `sass` bundle today, 8.8% measured at the ceiling (~11% including a bounded `[INFERRED]` estimate for 35 library wrapper modules), taking the emitted worker chunk from ~825 to ~890 KiB gzip at full Foundation coverage. The closure is **floor-dominated**: the shared `util/` + `global` floor is **12 of the 13 Foundation partials**, so each component's marginal cost is roughly **one file** (0.2-13.7 KiB). Staleness is caught because the closure is **discovered by compiling, never hand-enumerated** -- a Foundation in-range bump or an upstream `@import`-graph change fails the byte-compare loudly and visibly in the PR diff. Amends the delivery-shape boundary rule openly: `ngx-foundation-sites/scss/button` is unresolvable from the workspace root (the root symlink targets the source tree, which has no top-level `scss/`), so the amended rule is "addon *runtime* code imports nothing outside `.storybook/`; the generator is a build script reading workspace-relative paths" -- already the repo's idiom for `scripts/**/*.mjs`. Inherits the Dart Sass 3.0.0 `@import`-removal clock exactly; no option on the table reduces it, and the Node build has identical exposure today.
- **Revisable?:** true
- **Made By:** agent

### D035 -- control surface, preset semantics, CSS injection, and R026's boundary

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** The addon's user-facing model and the state that backs it -- control surface, preset-selection semantics, CSS injection and cascade, recompile UX, and where R026's ban actually falls given that it fires on the addon's injection code
- **Choice:** (a) A single `types.PANEL` titled `Theming`, story-mode only, no toolbar; native `<input type="color">` plus a validating text field; radius as a JS `number` of integer CSS px clamped 0..32. (b) Globals hold a **sparse canonical-minimal** override map with `initialGlobals.nfsTheme = {}`; the panel is the validation boundary and invalid input never reaches globals. (c) Preset selection is **derived from live state on every render, never stored**; canonical form makes sparse equality equal resolved equality, reducing the check to six scalars; a literal `Custom` entry, first match wins; the defaults probe reads the **Foundation-global** names, not the button-derived ones. (d) **The compile call is a generated `THEMEABLE_MODULES` list of `{url, namespace}` object literals, one entry today**, mapped into the entry string, whose FIRST section is an ordered, empty-today slot reserved for configuration; the addon passes **no `$selector` to any themeable module**, so each emits under its own default selector (`.button` today) and rethemes everything; the addon seeds no bare Foundation globals. One `<style id="nfs-theming">` in `document.head`, shared across story and docs mode. (e) Worker-backed sync compile, lazily constructed; **no debounce timer, a single-slot latest-wins coalescer**; supersede never cancel; progress indicator only past 300 ms; last good CSS survives errors; the Worker serialises errors to a plain object; **no cache, no worker pool, and no pre-compiled default theme** -- the default theme is never compiled at all. (f) **R026's boundary is stated for the first time**: R026 bans a hand-fed CSS string as the *component's styling source*; a dev-only Storybook addon injecting browser-compiled output is outside that ban. Encoded as exactly one `**/`-prefixed `ignores` entry on the **existing** non-spec `no-restricted-syntax` block, so the block count stays 2 and `nfs-button.r026-lint.spec.ts`'s `toHaveLength(2)` is untouched.
- **Rationale:** The highest-risk unknown -- whether `new Worker(new URL(...))` survives Storybook's Angular webpack merge -- closed **positively** two ways: `@storybook/angular` spreads only `cliConfig.module.rules`, discarding the `module.parser` that carries Angular's `worker: false`, and a four-variant real-webpack spike emitted a separate worker chunk with the marker absent from the entry chunk. The negative control matters: with `worker: false` the worker module is not bundled **anywhere**, with zero errors and zero warnings -- a silently-green failure mode, which is why the build-artifact gate is not optional. The sparse-map model is the decision that removes the most machinery: `buildArgsParam` encodes only `deepDiff(initialGlobals, globals)` and `GlobalsStore` merges shallowly at the top level, so a canonical-minimal map has **one** runtime shape in-session and post-reload, where a padded six-key map has two. The module-list form of the compile call is **genuinely free** -- the entry builder is already a string builder -- and one compile over two themeable modules is verified to emit both selectors while serving the Foundation island **once** (13 partials, not 26). **Recompile policy, stated durably:** the coalescer is chosen because its coalescing interval **is** the machine's actual compile time, so it self-tunes at any component count, where a 250-300 ms constant would fire mid-compile forever at full coverage; a trailing debounce goes **in front of** the coalescer, never instead of it, and only past a measured **1000 ms** apply. **Cache:** one compile means **one** cache key, so the reference project's second, per-component cache level has no counterpart here; a cache is unwarranted until a repeat theme crosses the 300 ms indicator threshold this same decision locks (reached at the **2nd** palette-driven component); and any cache must be in-memory and Worker-scoped, which is what makes a `CACHE_VERSION` string structurally unnecessary -- *a cache may not outlive the artifact that determines its contents*, and the sources ship in the same Worker chunk as the cache, so a new build is a new empty Map. That rules out IndexedDB or any persistent cache permanently. **Pool:** measured pool gain, favourable to the pool, is 1.3x at N=2, 2.8x at N=5, **4.1x at N=20** -- so the reference's 20.5% is an N=2, 2.7:1-imbalance artifact and must not survive as a law. A pool is nonetheless out because a theme apply is **ONE indivisible compile**; creating parallelism means splitting it per component, which measures **+50%** (per-component islands) to **+77%** (separate compiles) in total work at N=20; and **4 of 31 Foundation components cannot be islanded alone at all** (`button-group`, `accordion-menu`, `dropdown-menu`, `menu-icon`), so the split unit is a dependency-closed group, not a component. Its threshold needs all three of: apply > 1000 ms, a valid grouping, and P >= 4 -- not reached by Foundation's own component set. The lazier move, named first: narrow what recompiles, using the measured 19-of-35 sensitivity map. Verified corrections: **one invalid value drops the ENTIRE theme** from `?globals=` (five valid hex colours were discarded alongside one bad radius), diagnosed only by a `warn` that `.storybook/test-runner.ts` does not catch; the R026 `ignores` glob **must** be `**/`-prefixed because `@nx/eslint:lint` calls `process.chdir(systemRoot)` and ESLint 9 resolves flat-config ignores against cwd, so a config-dir-relative glob is inert under Nx while still passing the spec harness -- green `nx test`, red `nx lint`; and R008's unlayered-beats-`@layer` cascade win is verified in real Chromium across all four insertion orders with an order-detecting control, so **no order tricks, no `!important`, no MutationObserver** are needed. Relocating the addon to escape R026 was rejected outright -- it would silence the rule by geography with no record that an exemption was decided. Operates under D019/D020/R008/R026; states R026's edge rather than re-deciding it.
- **Revisable?:** true
- **Made By:** agent

### D036 -- R021's verification split, D023's axe location, and the port-4400 collision

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** quality-attribute
- **Decision:** What R021's Vitest half and Playwright half each prove, where D023's axe obligation runs once the compliant theme is also a selectable addon preset, and how the port-4400 collision between `test-storybook` and the new Playwright lane is resolved
- **Choice:** **Four lanes**, not two -- `test` (jsdom), `test-browser` (real Chromium), Playwright at `apps/nfs-storybook-e2e/`, and build-time gates (`verify-theming-sources` on `lint`, plus a new `verify-theming-bundle` on `build-storybook`). **D023's axe proof STAYS in `apps/nfs-demo`; nothing is re-pointed and no axe scan is added to any Storybook lane.** The addon's preset is bound to the axe-proven palette by a data-identity unit assertion plus one rendered-colour Playwright assertion. The default theme's three `expectedContrastFailures` literals are **frozen**. Port 4400 is resolved by refactoring `test-storybook` off `concurrently` onto `dependsOn: ["verify-autodocs-coverage", "static-storybook"]`, keeping `wait-on tcp:4400`. **The `test-browser` lane must not be narrowed or removed** -- beyond `@layer`, it is the only lane where an authoritative CSS-validity oracle can exist.
- **Rationale:** The lane boundary moved in **both** directions, measured. jsdom is far more capable than assumed -- it resolves the Node sass build and compiles the real chain to the same sha256 as five other producers, and the custom-`functions` probe works there -- so all compilation, preset, equality, validation and error-shape assertions land in the cheapest lane. But **jsdom discards `@layer`-wrapped rules entirely**, so every R008 cascade assertion there would be vacuously green; an earlier probe pass reported "unlayered wins" in jsdom and it was true for the wrong reason. Cascade, a real `Worker`, and the browser sass build go to `test-browser`. Playwright owns only the manager, which `@storybook/test-runner` structurally cannot reach. The axe proof stays in the demo app because the tarball route is a **strictly stronger** proof -- it scans the compliant palette through the real `exports`-gated public subpath in both CSR and SSR -- while an addon-driven scan would re-measure colours already measured through an async-Worker-probe wait, and would mean adding an axe dependency to a lane whose entire purpose is the manager UI. `wait-on` is kept deliberately because Nx's continuous-task ordering is start-based, not readiness-based. Verified component-agnostic in the multi-component sweep: no gate or lane assignment hard-codes the button; two subject framings are reworded (the Foundation marker is "a marker from the generated source closure"; the computed-style subject is "a themed element of each themeable module"), with no assertion changes. Operates under D023 and R008; discharges D023's third clause without re-deciding it.
- **Revisable?:** true
- **Made By:** agent

### D037 -- `$global-text-direction` in the public contract, and as an addon control

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** library
- **Decision:** `$global-text-direction`'s status in `ngx-foundation-sites`' public contract -- given a migrating consumer's Foundation settings file always contains it -- and whether it becomes a Storybook addon control in M002
- **Choice:** **ACCEPT AND HONOUR**, with an explicit inert-today disclosure, and **NOT a control in M002, and never a member of the theme map.** The settings surface (D040's later milestone) must carry it as a recognised, honoured, narrowly-documented setting: it must not drop it, must not `@error` on it, and must not accept it into a channel that discards it silently. The documented contract text: *it sets the Sass-time direction for the constructs CSS logical properties cannot express -- transforms, generated content, and direction-conditional rules; it has no effect on the box-model and float properties this library emits logically, which mirror at runtime from the document's `dir` in either setting; and as of M002 the shipped surface (Button) contains zero such constructs, so the setting is currently a no-op.* Separately, `_theme.scss` must not acquire a direction member, and `theme()`'s signature must not grow a direction argument. If RTL preview breadth is ever wanted, the shape is a `dir` attribute toggle on the preview root -- a decorator costing **zero Sass compile** -- never a Sass variable in the theme map.
- **Rationale:** This **supersedes** the earlier correction-pass ruling ("OUT, provably inert twice over"), which was verified correct for Button and wrong as a forward-looking ruling -- the single-component premise reappearing inside the pass meant to remove it. `$global-text-direction` is read in **9 places across 7 Foundation files**, and at least two drive output logical properties **cannot** express (`drilldown`'s `translateX` sign flip; `breadcrumbs`' separator-character swap). The deciding discovery is that it **composes correctly** with the library's rebind rather than conflicting with it: the rebind is unconditional and post-`@import`, so the properties it reaches stay runtime-directional in either setting, and the variable therefore reaches **only the residue** -- exactly the constructs logical properties cannot express. It is not a legacy wart; it is the correct escape hatch in Foundation's own vocabulary, i.e. the maximally seamless answer available under the BINDING seamless-migration constraint. The alternatives were each rejected explicitly: `@error` fails the build on a variable sitting at its own default (`ltr`), which is indefensible; **silent acceptance is ruled out by name** as the worst migration outcome; `@warn` is wrong because the setting is not meaningless and warning on a setting that works trains consumers to ignore warnings. The inert-today sentence is what converts silence into disclosure, and it is **VERIFIED** -- the public `theme()` chain compiles **byte-identically (5839 bytes)** under both values. As an addon control it is out on merit, not omission: it is mechanically unreachable through the addon's `@use` + `@include theme()` entry (it must be set before the island's `@import`s, and `theme()` runs after -- reaching it needs the bare-Foundation-globals mechanism `_button.scss` records as measured-and-rejected); it breaks R009's six-scalar preset equality; it costs a compile per toggle against a 197-305 ms baseline; **decisively, the demonstration need is already met better**, because the existing `Rtl` story renders `dir="ltr"` and `dir="rtl"` side by side in ONE document and a preview-wide toggle cannot express that; and the reference project's panel/toolbar globals sync plus a 5 s `waitFor` was measured as real cost buying nothing. The "not a control" conclusion is upheld; its inertness *ground* is retired rather than repaired.
- **Revisable?:** true
- **Made By:** agent

### D038 -- no cache, no pool, no pre-compiled default theme

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** anti-feature
- **Decision:** Whether M002 ships any of the four mitigations the reference project needed at two components -- input debounce, LRU caching, a worker pool, and pre-compiling the default theme at init
- **Choice:** **None of the four, and pre-compiling the default theme is rejected outright rather than deferred.** The default theme is **never compiled at all**: it is already on screen as the library's static `@layer nfs-defaults` CSS, so there is no first-paint compile and no readiness gate. Persistent caching (IndexedDB or any storage) is likewise **rejected permanently, not deferred**. The other three are **not built today but have named thresholds and named seams**: a cache (one level, in-memory, Worker-scoped, capped, keyed on the entry string, ~3 lines at the single Worker call site) when a repeat theme apply crosses **300 ms** -- reached at the **2nd** palette-driven component; a trailing debounce **in front of** the coalescer when an apply crosses **1000 ms** -- reached at the **5th-6th** palette-driven component, i.e. full library coverage; a worker pool only when apply > 1000 ms **AND** a dependency-closed grouping exists **AND** P >= 4 -- not reached by Foundation's own component set. One correctness item does have a real trigger: a multi-component-capable island preamble is needed at the **2nd themeable module**, any tier.
- **Rationale:** Measured across four architectures and two independent runs, anchored on a measured 197.4 ms Worker median. The curve is **ADDITIVE in emitted components, not floor-dominated** -- floor plus the sum of per-component emission costs predicts the all-31 compile to within 2% and 7%. **The *closure* is floor-dominated; *time* is not, and inferring one from the other would have been wrong.** But the additive term is near zero for most components: cost tracks **palette-driven colour math**, not component count and not CSS volume (`off-canvas` emits 8945 bytes for ~10 ms; `badge` emits 479 bytes for ~133-173 ms), and only **19 of Foundation's 35** component partials read any of the six curated globals, with the expensive tier at **6**. `T_worker(N) ~= 58 ms island floor + ~1 ms per partial parsed + 135-210 ms per palette-driven component emitted + 0-20 ms per remaining themeable component`. **The ceiling is the headline: a theme apply over every component the six controls can affect costs ~1.2-1.4 s -- still LESS than the reference project needed for TWO components (1464-1504 ms).** The reference's curve does not transfer, and that is **priced rather than asserted**: per-component islands cost +50% and separate compiles +77% over one shared-island compile at N=20. Pre-compiling the default theme is rejected on **architecture**, not on cost: the reference pre-compiled to fill a hole it created by *suppressing* the library's stylesheets (DI swap + disable sweep + MutationObserver), whereas this addon is **additive** (R008's unlayered overlay), so zero-compile beats cache-hit; it would also construct the Worker at init, fetching ~825 KiB gzip on every story load and destroying D034's lazy split; and the `loading -> ready` window it would supposedly fix measured **1.1 / 0.7 ms**. Persistent caching is excluded by a rule that does not expire: *a cache may not outlive the artifact that determines its contents.* The reference's 20.5% pool gain is an **N=2 artifact** (measured 4.1x by N=20) and must not survive as a law. The Worker decision itself gets **stronger** with N -- at the full-coverage 1.2-1.4 s apply a main-thread compile would block 72-84 frames. No machinery was built; this row records four considered rejections and the measurements that would reverse three of them.
- **Revisable?:** true
- **Made By:** agent

### D039 -- the library's cross-component RTL strategy [AMENDED BEFORE LANDING]

> **AMENDMENT NOTICE, and why it is legitimate.** D039 has **not landed**, and two of
> its forward-looking clauses were refuted by the later coupling effort. Appending it
> verbatim would put a known-false recommendation into an **append-only** register
> where it could never be corrected. So two passages are replaced below, marked
> inline. The amendment is recorded in `../README.md` section 2.3. Everything else is
> unchanged, including the measurements, which stand.
>
> - **REPLACED:** the recommendation that the milestone adding component #2 default to
>   the **D1e HYBRID** ("logical properties where verified safe, plus a small set of
>   `:dir()` overrides for the 8 residue rows"). **Refuted as stated** -- the rebind
>   that produces its "logical properties where safe" half is itself the sole source
>   of all six defect classes. The replacement mechanism is D041's direction twins.
> - **REPLACED:** the onboarding instruction that each new island "classify its own
>   `$global-left`/`$global-right` sites against the six-class table before shipping".
>   Superseded by D043's **two-compile admission test**, which is mechanical rather
>   than a manual classification.

- **When:** M002 wayfinding effort, 2026-08-11 (forward clauses amended at application time per D041/D043)
- **Scope:** architecture
- **Decision:** How `ngx-foundation-sites` supports RTL/LTR across all Foundation components, given that M003 delivered Button's RTL by rebinding `$global-left`/`$global-right` to `inline-start`/`inline-end`
- **Choice:** **"Extend the rebind" is CLOSED on measurement, not deferred.** The rebind **stays exactly where it is**, inside `internal/_foundation-button.scss`, and must **not** be lifted into a shared partial for future islands to `@use` -- that is the obvious DRY move and it is the trap. **`:dir()` / `[dir]` is RE-OPENED** for the residue; using it later needs **no decision reversal**. CSS custom properties for the transform sign are **not forbidden by D020** and are **also not a separate option** -- a custom property cannot read direction, so it still needs `:dir(rtl) { --nfs-dir: -1 }`; it is a *compression* of the `:dir()` option, decided with it. **A dual build is ruled out by a shipped artifact.** *[AMENDED]* The mechanism for the milestone that adds component #2 is **not** decided here: it is decided by **D041** (direction twins by default) admitted per component by **D043**'s two-compile test, with the rebind admissible if and only if that test returns zero (D044 C3). `$global-text-direction` is honoured as the Sass-time escape hatch (D037). The full per-component design is **DEFERRED and is a component-onboarding obligation** discharged by the admission test, not by a manual classification. **M002 forecloses none of this**, and its cost is **zero code plus one README paragraph**.
- **Rationale:** The rebind is **not a general mechanism** -- it is *variable substitution*, where correct logical CSS needs *property-name mapping*. Measured across Foundation's whole tree: **~50 of ~109 interpolation sites are broken by it, in six distinct defect classes, across ~11 components, and every failure is silent** (browsers discard unknown properties and invalid values without error); 36 invalid vs 127 valid declarations in `foundation-everything()`. Button hits **only the two safest classes** (`float:` value and `margin-#{side}`) and passes a literal `down` to `css-triangle` -- which is exactly why R004 is sound for Button and generalises to nothing. Three defect classes went beyond the report that prompted the ticket, including **class-NAME interpolation** (`&.align-#{$global-left}` silently renames Foundation's public `.align-right` class -- *valid CSS that matches nothing*, which no validity oracle can catch) and `css-triangle($size, $color, $global-right)` matching no `@if` branch and emitting a solid square instead of an arrow. The `button-group` radius sites are **LATENT**: 0 invalid declarations at Foundation's defaults, **20** with `$buttongroup-radius-on-each: false` -- so the defect count is a function of **consumer settings**. *[AMENDED: the inference drawn here, that no fixed-settings gate can bound the class, is superseded by D043 -- a fixed-settings gate of exactly TWO compiles is sufficient and complete over source sites, because the magnitude growth is pure replication of a fixed 22-site set.]* M003's `:dir()` rejection was **Button-specific and comparative**, with evidence: D021's Question is scoped to "the button-dropdown arrow"; its `[dir="ltr"]`-never-matches finding rules out rtlcss's `dirAttribute` mode and its wrong-transform finding rules out postcss-logical (both library-wide), but the `:dir()` ground is purely comparative ("a viable runner-up but costs specificity; Foundation's own interpolation hooks cost neither") and that comparison's cheaper arm exists only where the interpolation hooks are in the SAFE classes, i.e. only for Button. D028 adds nothing -- it carries D021 by reference. R004's own **Description** names `$global-text-direction` as the behaviour to match; the "no `:dir()`" phrase sits in its **Validation** field, describing what was built. The dual build is ruled out by `nfs-button.stories.ts`'s `Rtl` story, which renders both directions **in one document** and asserts numeric mirroring -- no dual build can serve it, and ruling it out costs deleting a passing test. Detection is a real gap and is named rather than built: **`verify-foundation-parity.mjs` would not catch the worst class -- it BLESSES it** (fully characterised in both directions by D043/D044 C9); and any gate built on "diff LTR vs RTL output" is structurally blind to selector-swap residue. The missing gate, named for a later milestone: a **CSS validity check using the browser's own CSSOM as oracle** in the existing `test-browser` lane -- authoritative, zero new dependencies, no allowlist to rot. Operates under R004/D021/D028 and reverses none of them.
- **Revisable?:** true
- **Made By:** agent

### D040 -- the Foundation settings-migration surface, and M002's non-foreclosure constraints

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** What part, if any, of the Foundation settings-migration surface M002 owns, given the BINDING constraint that migrating SCSS settings must be as seamless as possible with `@use` preferred over the legacy global-`!default` idiom
- **Choice:** **M002 owns NOTHING of the Foundation settings API and must not invent one; the settings surface belongs to a dedicated later milestone.** What M002 does own is **seven non-foreclosure constraints** plus one positive documentation obligation: (1) `_theme.scss` stays a **DATA** module -- no `!default` member, and it is **not** the settings entry point; the future settings module is a separate file with its own `exports` key. (2) The addon's six controls are documented as an **addon** surface, never the library's settings vocabulary. (3) The generated entry string reserves an ordered **leading** slot for configuration, empty today. (4) The generator's entry-point arrays stay **data**, and no gate freezes a literal closure file count. (5) M002 does **not touch `internal/_settings.scss`** -- no `!default`, no split, no new members; the addon's six-name defaults probe against it is recorded as a **named seam owned by the settings milestone**, with the variable list living in the generated data module. (6) M002's README documents today's **silent-ignore** as a known limitation. (7) R009's "Foundation global" identity column is **vocabulary, not wiring**, with a footnote that the named globals are provably inert as inputs -- and, added by D041, a second note recording the **value-vs-shape rule** as the forward test for any control added later. **Costs: all zero but constraint 6, which is two README sentences.**
- **Rationale:** Three measured grounds for the scoping verdict. **First**, the surface is unbuildable at today's coverage as a structural fact, not a scheduling preference: **481 of Foundation's 490 settings are read only by component partials this library has not wrapped**, only **42** are referenced anywhere in the button chain's real 13-partial closure, and only **6** by `util/` + `_global` alone -- an API designed against 42 names would be validated against a fraction of its own surface, which is the expiring-premise error inverted. **Second**, every viable mechanism requires rewriting `internal/_settings.scss`'s 26 deliberate plain assignments into `!default` or map-driven reads, a change to the library's compile-time contract that touches the island's seeding idiom `verify-foundation-parity` gates -- library-milestone work M002 does not do. **Third and decisively**, `@use ... with (...)` is verified viable and verified **LOUD** on unknown names, but applies **exactly once per compilation, before any other load** [VERIFIED three ways, including the realistic case of two consumer partials each configuring], so a half-shipped surface publishes an ordering constraint every later addition inherits. The `@use ... with` tension resolves ground by ground: "forces bare Foundation-shaped globals" **APPLIES and INVERTS** (a defect for a theme mixin whose point is that no global is named; the *goal* for a settings module, because a migrator arrives holding exactly those names); "cannot be invoked twice" **APPLIES and bites harder**, but is survivable as "configure once, first, from the entry stylesheet" -- it is Foundation's own legacy requirement, now enforced with an error instead of silence, and it does not touch `theme()` (configured settings plus two scoped `theme()` calls in one compilation is verified to work); "emitted 5490 bytes" **DOES NOT APPLY** -- a settings module emits **0 bytes**. The property nobody costed: under `@use ... with`, an unknown or misspelled name is a **hard compile error with no validation code at all** -- the exact inverse of today's behaviour. **Today's behaviour is SILENT IGNORE, confirmed by probe and named as the worst outcome:** pasting Foundation's entire 490-variable `_settings.scss` below the `@use` compiles **byte-identically** (5839 B) with no warning, even with a value deliberately changed; the same holds for the legacy `@import` route and for hand-declared globals. Two mercies and one extra trap: `theme()`'s four public arguments are airtight (any undeclared argument or `with` clause is a hard error), pasting **above** the `@use` is a hard Sass error, but a typo'd key in the one public map argument silently emits `.button.sucess` plus 932 B of junk CSS. Constraint 1 is mechanical, not aesthetic: **a module consumers READ can never be the module they CONFIGURE**, because reading it loads it and configuring an already-loaded module is a hard error -- so merging the roles would lock the demo app and every README-following consumer out of configuring settings by the act of reading the compliant palette. Constraint 7 rests on a verified general rule: the island pre-seeds derived names non-`!default` before the `@import`s, so Foundation's derivation cascade never fires and `$foundation-palette`, `$primary-color`, `$global-radius`, `$global-font-size`, `$global-margin` and `$global-text-direction` are **all** inert as inputs -- the direction finding is one instance of a general rule, not a special case. This decision also **replaces the map's withdrawn Out-of-scope entry** "extending `theme()`'s public Sass API", which justified a *library* API boundary with *what the addon's panel needs*. The narrow claim survives -- M002's addon needs no public Sass API extension -- but it must never bound the library's settings surface.
- **Revisable?:** true
- **Made By:** agent

---

### D041 -- the sensitivity map, M002's clearance, and the value-vs-shape rule

> **These four rows (D041-D044) land in this application pass but are OWNED by the
> deferred milestones.** They are decisions already made and evidenced; their
> consequences are planned in `../deferred/HANDOFF.md`. The only reason they appear
> here is that a single register append is one action.

- **When:** settings-RTL-coupling wayfinding effort (`.scratch/settings-rtl-coupling/`), 2026-08-11
- **Scope:** architecture
- **Decision:** Which Foundation settings can activate the R004 rebind's RTL defect classes, whether M002's six addon controls are among them, and what test governs any control or key added later
- **Choice:** **M002's addon gets a CLEAN BILL OF HEALTH -- none of its six controls activates RTL residue in any of the six defect classes, at any value tested -- and no M002 decision is re-opened.** The forward rule that replaces case-by-case worry: **the test for any new addon control or published settings key is "can it change WHICH rules are emitted?", never "is it a Foundation global?"** *Value* settings (a colour, a length) are structurally safe; *shape* settings (a boolean, a keyword, a count, a map length) are the only ones that can activate residue, because activating residue requires changing which declarations are emitted. Recorded alongside: the activating set is **15 of 498 consumer-settable names (3.0%)**, of which **13** were measured to move a defect count; the class is **bounded in NAMES and UNBOUNDED in MAGNITUDE**, so a cartesian settings gate is the **wrong SHAPE, not merely too large**; and the class is **NOT monotone**. Three constraints bind any future gate: it must pin the **component set** as well as the settings, it must **not** compile through `foundation-everything()`, and it must report **per-class counts against a stated configuration**, never a bare pass/fail.
- **Rationale:** Verified three independent ways [V-EXEC]. (1) The shipped route -- the real public `theme()` chain, which already carries the rebind: `invalid=0`, all six classes zero, for every control and for all six together. (2) The maximal route -- all 41 Foundation component mixins with the rebind and the six controls driven as bare Foundation globals: 13 perturbations, six classes each, **zero change in every cell**. This is the strong form, not an inertness result restated: the controls are **live** at that level (`$global-radius: 6px` = +128 bytes) and still activate nothing. (3) Statically -- the transitive gate closure over all 109 rebind sites contains **none** of the six control names, so the verdict is not a value-sampling artefact. **The radius worry does not land for a structural reason:** the radius-shaped class is gated by a **boolean, not a radius** -- c3 = 0/20 for `$buttongroup-radius-on-each` true/false, **identically** at `$global-radius` 0, 6px and 50%. Unboundedness is exact rather than asserted: a fitted law `c2 = 2*cols*bps + bps + 23` predicted **9/9 held-out** combinations, giving 1187 invalid declarations at 48 columns x 12 breakpoints against 98 at defaults, and both inputs (`$grid-column-count`, `$breakpoints`) have infinite domains. Non-monotonicity is one compile: `$global-flexbox: false` **adds 4 class-1 defects while removing 7 class-5 defects**. Two measurement artefacts were caught that would each have faked a clean result -- `foundation-everything()` executing `$global-flexbox: true !global` (which silently overwrites a consumer's setting, hence the gate constraint), and 7 same-variable pairs corrupting an additivity test. Operates under D020/D022/D023/D025 and re-decides none of them.
- **Revisable?:** true
- **Made By:** agent

### D042 -- the mechanism: direction twins eliminate all six classes

- **When:** settings-RTL-coupling wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** Whether the settings-dependent RTL defect class can be **eliminated** (made structurally impossible, so consumer settings are safe by construction) rather than gated, and by which mechanism
- **Choice:** **ELIMINABLE, all six classes -- by the DIRECTION-TWIN construction, not by substitution and not by a mapping layer.** Compile Foundation **unmodified** twice at Sass time (once at `$global-text-direction: ltr`, once at `rtl`), diff the two outputs, and emit ONE sheet in which every direction-dependent declaration appears twice, once under `:where(:dir(ltr))` and once under `:where(:dir(rtl))`, **element-scoped** (appended to the last compound before any pseudo-element) and interleaved at its original position, **inside the same `@layer` as the rest of the library defaults**. Its defining property is the whole point: **every property name, value and class name it emits is one Foundation itself emitted**, so no consumer settings configuration can produce invalid CSS. **This is NOT a dual build** (one sheet, both directions, serving the shipped `Rtl` story). Three sub-choices are load-bearing and each was found by measurement: `:where()` not bare `:dir()`; element-scoped not descendant-scoped; twins not overrides-with-resets (`revert-layer` is a trap). **D039's D1e hybrid is refuted as stated**, a **Sass mapping layer is impossible rather than unattractive**, and the rebind **stays for Button only, now by mechanical rule** (D044 C3) -- with migration to the twins **discretionary forever**, never owed.
- **Rationale:** Verified by execution and confirmed in real Chromium 151. The emitted sheet has **0 invalid declarations** against the rebind's 36 at defaults and 56 with two legitimate settings flipped, with **exact declaration-level equivalence to Foundation's own RTL build (0 mismatches)** and **0 differing computed values in both directions side by side in ONE document**; Chromium drops 86 declarations from Foundation's own sheet, 86 from the eliminator's and 142 from the rebind's -- delta +0 vs +56. Across **8 settings configurations** the eliminator column is 0 throughout while the twin count moves with settings, which is the settings-dependence turned **benign**: more settings-activated directional output means more twins, never an invalid declaration. No substitution value can work, and the reason is structural and quantified -- the same variable is interpolated into five syntactically different positions and three of the six needed values are mutually exclusive with the other three (`start/end` 160 invalid, `inset-inline-*` 131, and the 2-D corner case reachable by none). The one Sass hook that exists (post-`@import` mixin/function redefinition, verified honoured) reaches exactly **one** of six classes, and its natural `&:dir(rtl)` emits `...::after:dir(rtl)`, which **Chromium drops whole** -- so **Sass cannot rewrite selectors it did not author**, the fact that forces D044's C4. Naive placement was measured wrong (bare `:dir()` + appended layer = **30 wrong computed values**; descendant scoping breaks a nested opposite-direction island; `revert-layer` in an unlayered sheet rolls back **past the author origin**, giving 0px where the consumer set 77px). Cost: **compile time unchanged** (BASE 1350 ms, twins indistinguishable from noise, generator exactly one extra pass at 1.9-2.1x), emitted volume **+14.1%** library-wide and **+62%** for `button-group`, and one browser version (`:dir()` 134/136 pinned targets). R008 survives, and for a stronger reason than the measurement: cascade layers sort **above** specificity, and `:where(:dir())` adds no specificity at all. Operates under D019/D020/D021/D022/R004/R008 and reverses none of them; supersedes D039's D1e hybrid *recommendation* only, on measurement.
- **Revisable?:** true
- **Made By:** agent

### D043 -- what "gated" means, and the two-compile envelope

- **When:** settings-RTL-coupling wayfinding effort, 2026-08-11
- **Scope:** quality-attribute
- **Decision:** Whether a defect class whose count depends on consumer settings can be gated at all, and which of prevent / detect-in-our-CI / detect-in-theirs / disclose the library owes
- **Choice:** **"Gated" resolves to PREVENT. Detection is UNNECESSARY, not merely infeasible**, because prevention was proved (D042). **Detect-in-THEIRS is DROPPED** -- never buildable and now pointless; a consumer-run validator dies with it (the published package ships `./scss/*` and `./css/*` and declares **no `bin`**, so it would have been a new artifact class with its own packaging and support burden). **Exactly two things are owed:** (1) a **feature-vs-baseline gate** extending `scripts/verify-browserslist.mjs` to assert CSS features against the RESOLVED targets (C6), and (2) a **disclosure narrowed to `:dir()`'s 2-of-136 gap and `$global-text-direction`'s status** (C7) -- never a confession about invalid CSS. The **CSSOM validity check is KEPT but re-purposed** as a regression tripwire on the generator's invariant, with a **mandatory positive control** and **paired with a class-name parity check** (C8). And the mechanical definition of "the widest settings configuration": **TWO COMPILES** -- Foundation defaults plus `$buttongroup-radius-on-each: false` with `$global-flexbox: false` -- both required, neither sufficient.
- **Rationale:** The unbounded magnitude turned out to be **pure REPLICATION of a fixed site set**: all 1187 class-2 declarations at 48 columns x 12 breakpoints come from the same **22 source sites** as the 98 at defaults, with **zero new sites in any of the six classes** at either extreme -- so a complete onboarding test is two compiles, not a grid, and it is **COMPLETE over source sites across 24 configurations** (8/8, 22/22, 14/14, 1/1, 11/11, 2/2). Both compiles are needed because non-monotonicity holds at SITE level (class 1: 3 and 6 sites, 1 shared; class 5: 8 and 6, 3 shared). Measured cost: the admitting compile costs the same as the defaults compile within noise (+10%/+2%/-6% across library/`button-group`/`menu`, every cell's own spread wider than the between-condition difference), so the gate is **2x one compile -- ~2.8 s whole library, ~780 ms `button-group`, ~310 ms `menu`** against the refuted cartesian grid's **3+ hours, still incomplete**. The CSSOM oracle graduated from [INFER] to [V-BROWSER]: it drops all class 1-4 declarations at both the declaration and sheet level with five valid controls surviving, and it is **structurally blind** to class 5 (valid CSS matching nothing) and class 6 (a defect of ABSENCE) -- blind by construction, not by bad luck, hence the parity pairing. `verify-browserslist.mjs` was read and checks **no feature against any target** [V-REPO], so C6 is a real gap rather than a suspicion. **Foundation documents ZERO settings/RTL interaction anywhere** -- `$global-text-direction` appears exactly once in its whole shipped docs tree, `sass.md`/`global.md` have zero mentions of "direction", the settings template a consumer edits carries a bare uncommented line, the shipped `customizer/` has no direction handling, and `dir="rtl"` is documented as a JAVASCRIPT requirement -- so there is no upstream hazard to relay and this library's runtime single-sheet model sits **outside** Foundation's documented model, which the twins reconcile. Two contract facts fall out: **`.align-left`/`.align-right` ARE documented public direction-sensitive API** (`docs/pages/menu.md:49-53`, with `float-classes.md:16`, `tooltip.md:80`, `off-canvas.md:236`, `flex-grid.md:197`), so the rebind's rename **breaks a documented contract** and no validity oracle can see it; and `$global-left`/`$global-right` are labelled **"Internal variables"** (`_global.scss:126`), an argument for the twins independent of validity. Operates under D022/D025/R008/R022 and re-decides none.
- **Revisable?:** true
- **Made By:** agent

### D044 -- the locked gating contract between the two deferred milestones

- **When:** settings-RTL-coupling wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** How the Foundation settings-migration surface and the cross-component RTL strategy gate each other, so neither milestone can be planned in ignorance of the other
- **Choice:** **ELIMINATION-FIRST, admitted per component by a mechanical test -- and the gate is NOT TEMPORAL.** Nine clauses (C1-C9), two obligations and eight triggers, recorded in full in `.scratch/handoff/deferred/HANDOFF.md` (derived from `.scratch/settings-rtl-coupling/HANDOFF.md`). **Neither milestone waits for the other and there is no ordering to negotiate**: what gates is the **two-compile admission test on the COMPONENT side**, and because that envelope is complete over source sites while magnitude growth adds none, a component that passes it is safe at **any** settings configuration -- so **no settings key is ever withheld on RTL grounds** (C5). **Both obligations are discharged by ONE artifact**: a CI gate over the shipped component set at the envelope, which the settings milestone builds and the component milestone satisfies per component. The sharp new clause is **C4: a live settings surface FORCES the twin layer to be hand-authored Sass**, since Sass cannot rewrite selectors it did not author and a pre-generated CSS blob is keyed on the library's settings while base rules track the consumer's -- **orphan twins > 0** is the machine-checkable failure. **Every trigger is a threshold or a version number**; the **only expiring clause is C7's `:dir()` disclosure -- delete it when the pin resolves to no chrome/edge below 120**; and **emitted volume is deliberately NOT a trigger**. **M002 is clean; the rebind stays for Button only and migrates never on correctness grounds.**
- **Rationale:** Every rejected shape loses on measurement, not preference. **Per-component coupling** loses on the SETTINGS axis (`@use ... with (...)` applies once per module per compilation and only before anything else has loaded it -- three verified hard errors -- so N per-component settings modules publish a combinatorial ordering contract; and the activating settings are cross-component, so a per-component gate degenerates into a library-wide one for exactly the settings that matter) while its component half **survives verbatim as C2 + C3**, now mechanical rather than a manual classification against a table. **Detection** loses three times: unnecessary (prevention proved), wrong shape (two multipliers with infinite domains), and incapable of reporting pass/fail (non-monotone, three classes maskable to zero). **Disclosure** loses four times: it is what the library does **today by accident** and D040 named it the worst migration outcome (490 settings pasted, byte-identical output, no warning); there is **no upstream hazard to relay** (Foundation documents zero settings/RTL interaction); it means **shipping a documented-API break** (`.align-left`/`.align-right`); and Foundation is dead upstream at 6.9.0, so "accept and document" defers to a maintainer who will not fix it. The contract's own load-bearing assumptions are flagged rather than buried: **C5's settings-independence is [DERIVED]** from two [V-EXEC] results (site completeness plus zero-new-sites) and weakens with trigger 5 if the envelope is ever found incomplete for a new Foundation version; **C4's option (b) tracking consumer settings is the single [INFER]**, which is why trigger 3 is a measurable threshold rather than a rationale. Volume is excluded as a trigger on principle: any budget chosen now would itself be the expiring premise this contract exists to prevent. Operates under D020/D022/D023/D025 and re-decides none of them; supersedes M002 hand-off section 8's sequencing claim, which no register row carries.
- **Revisable?:** true
- **Made By:** agent

---

### D045 -- R026's stated boundary (OPTIONAL split, flagged rather than taken)

The recommendation exists to record **R026's stated boundary** as its own register
row, since D035 clause (f) is the first time that rule's edge has been drawn. If the
planner would rather it be independently findable, the lazy split is: keep D035 as-is
**minus clause (f)**, and add **D045** carrying (f) with scope `anti-feature` and the
same `Made By: agent`.

**Take it or leave it -- but if taken it is D045, at the END of the sequence, not
D041.** Both source efforts guessed at a number for this row (`D037`, then `D041`)
because neither knew the final ordering. Placing it last keeps D041-D044 contiguous
with their own effort, which is what makes the sequence readable in the register.
---

## 6. R027 -- the text lands here, the WORK is owned elsewhere

**State this split explicitly, in both directions.** R027's requirement text lands in
this application pass, because the whole "what must end up in GSD" set should be
appliable from one folder. **Its validation shape, its owner, and the gate that
satisfies it live in `../deferred/HANDOFF.md`.** Neither half is complete without the
other; the cross-reference is deliberate, not an oversight.

**Numbering [VERIFIED 2026-08-11 against `.gsd/REQUIREMENTS.md`]: the highest landed
requirement is R026, and neither source effort proposes any other new requirement
number, so R027 is free and uncontested.**

A new number is needed rather than a widened R004, because **R004 is `validated`
against Button and a validated requirement must not carry a not-yet-built CI gate as
its validation.**

> ### R027 -- Every shipped Foundation component's direction-dependent CSS is valid at any consumer settings configuration, and renames none of Foundation's documented public direction-sensitive class names
>
> - **Class:** quality-attribute
> - **Status:** active
> - **Description:** For every Foundation component the library ships, the emitted CSS
>   contains zero invalid direction-dependent declarations and zero renamed Foundation
>   public direction-sensitive class names, at **any** consumer settings configuration
>   -- so a consumer may set any Foundation setting to any value without silently
>   activating an RTL defect.
> - **Why it matters:** The defect count is a function of **consumer settings**, and
>   every failure mode in this family is **silent** (browsers discard unknown
>   properties and invalid values without error; a renamed class name is valid CSS that
>   matches nothing). Without this requirement the settings-migration surface's success
>   condition -- consumer settings actually taking effect -- is also the trigger for a
>   dormant defect class. It is the requirement that makes the two-compile admission
>   gate plannable, and it is what allows the settings surface to publish every key
>   unconditionally.
> - **Source:** agent (settings-RTL-coupling wayfinding effort,
>   `.scratch/settings-rtl-coupling/`)
> - **Primary owning slice:** the cross-component RTL / component-onboarding milestone
>   / none yet -- **satisfied jointly**: the settings milestone builds and runs the
>   gate, the component milestone satisfies it per component (one artifact, two owners).
> - **Validation:** unmapped. **The validation SHAPE is fixed and is specified in
>   `.scratch/handoff/deferred/HANDOFF.md` (the two-compile admission test and its five
>   mandatory properties).** In brief, so a planner reading only the register knows
>   what it commits to: compile the **entire shipped component set** at the two-compile
>   envelope (Foundation defaults, plus `$buttongroup-radius-on-each: false` with
>   `$global-flexbox: false`), **not** through `foundation-everything()`, and report
>   **per-class** invalid-declaration counts against the stated configuration --
>   failing on any non-zero count in classes 1-4, on any renamed Foundation public
>   class name, and on any orphan twin. A validity oracle alone is insufficient: it is
>   structurally blind to the class-name rename and to the `css-triangle`
>   defect-of-absence, so a class-name parity check is mandatory, and the CSSOM
>   tripwire must carry a positive control or abort.
> - **Notes:** Measured ground, contract clauses and all eight triggers are in
>   `.scratch/handoff/deferred/HANDOFF.md`, derived from
>   `.scratch/settings-rtl-coupling/HANDOFF.md` and `research/01`-`04` (the evidence).
>   Button already satisfies R027 under the rebind; `foundation-table` would not.

**M002 owes R027 nothing.** It is landed here for register-application convenience
only. Do not schedule R027 work in an M002 slice.
---

## 7. R004 -- a Notes-only amendment

**Status stays `validated`. Do NOT re-open it.** Both source efforts say the same, for
their own reasons. R004's Description ("Components support RTL/bidirectional layout,
matching Foundation's `$global-text-direction` behavior") is mechanism-neutral and
stays correct at any component count. The staleness is in its **Validation** field,
which is entirely Button's mechanism, and three phrases in it go stale on component #2:

1. **"no `[dir]` selector, no `:dir()` specificity cost, no postcss-rtlcss, no
   dual-file mechanism"** -- the `[dir]`, rtlcss and dual-file halves stay true
   library-wide forever. The **"no `:dir()`"** half becomes false for any component
   admitted with twins. (The **specificity** half survives on its own terms:
   `:where(:dir())` contributes zero specificity, verified.)
2. **"the only genuinely directional declarations in the sheet"** (the dropdown
   arrow) -- true of Button's sheet, false of the library's the moment a second
   component ships.
3. The whole mechanism sentence describes `internal/_foundation-button.scss`, which
   D044's C3 fixes as **Button-only, by rule**.

**Append this to R004's Notes. Change nothing else.**

> Scoped 2026-08-11 (settings-RTL-coupling wayfinding effort): R004's Validation text
> describes **Button's** mechanism and is Button-scoped by rule, not by accident. The
> `$global-left`/`$global-right` rebind is admissible for a component **if and only
> if** that component emits zero invalid direction-dependent declarations and renames
> no Foundation public class name across a two-compile envelope; Button is the only
> Foundation component that passes today, and `foundation-table` fails on a single
> `text-align`. The rebind must never be lifted into a shared partial. The "no
> `:dir()`" phrase records what was BUILT for Button, not a library-wide prohibition
> -- a `:where(:dir(ltr))`/`:where(:dir(rtl))` direction-twin construction is the
> default mechanism for every component that does not pass, it adds zero specificity,
> and using it needs no reversal of R004, D021 or D028. Cross-component RTL
> correctness is carried by its own requirement rather than by widening R004's proof;
> R004's substance for Button is unchanged and continues to hold.
