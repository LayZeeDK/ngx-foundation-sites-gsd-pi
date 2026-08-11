# M002 hand-off: Storybook theming addon

Produced by wayfinder ticket 11, which closes the map at
`.scratch/m002-storybook-theming-addon/map.md`. Every decision below is locked;
nothing here is a proposal.

**This document REPLACES an earlier version of itself.** That version was
generated from tickets 06-10. Four correction tickets (12, 13, 14, 15) then
landed under two standing user instructions, and this document is regenerated
from the corrected decision set rather than patched. Section 0.1 is the
supersession ledger -- every superseded decision is carried **as superseded**,
naming what supersedes it, so nothing here silently contradicts the research
record.

**What this document is.** The complete input to GSD milestone planning for
M002: sharpened text for R009 and R021, decision-register entries, the D023
closure statement, the requirements M002 touches but does not own, and the record
of why D020 makes this milestone architecturally unusual.

**Route-agnostic.** This states *what must end up in GSD*, not which interface
puts it there. Either the `gsd-workflow` MCP tools or a later `/gsd` session can
apply it.

**Do not edit `.gsd/` by hand.** Those files are projected from a database.

**Evidence discipline.** Claims are tagged where it matters: `[VERIFIED]` =
executed or read from shipped source during the effort; `[INFERRED]` = reasoned
but not executed. Section 9 lists everything still unverified. Much of this map's
value is that its claims were executed, not argued -- do not let that distinction
get flattened during planning.

Depth lives in `.scratch/m002-storybook-theming-addon/research/01..15-*.md`; each
section cites the file that owns it.

---

## 0. One-paragraph summary for a planner who never read the map

M002 adds a **workspace-local Storybook addon** that compiles the library's real
Foundation Sass **in the browser, inside a Web Worker**, and injects the result
into the preview, so a designer can **retheme the library live** without a
rebuild. Six curated controls (five palette colours + radius) are **Foundation
globals**; Button's `theme()` mixin is today's only consumer of them, and the
controls map 1:1 onto that mixin's existing `$background` / `$palette` / `$radius`
arguments, so **`theme()`'s public signature does not grow**. M002 does add
**one new public Sass data module**, `ngx-foundation-sites/scss/theme`, holding
`$wcag-palette` as the single source of the WCAG-compliant palette -- which is
what finally discharges the standing human decision D023. The addon's compile
call is a generated **`THEMEABLE_MODULES` list** with one entry today, and the
source generator takes **N entry points today** because a single-entry closure is
structurally blind to the new `_theme.scss`. Two presets ship (Foundation
default, WCAG-compliant); preset "selected" is a *derived* property of live
control values, never a stored flag. Verification is four lanes: Vitest jsdom,
Vitest real-Chromium, a new Playwright project against the static Storybook
build, and build-time `verify-*.mjs` gates.

`ngx-foundation-sites` is a library for **all** Foundation for Sites components.
Button is the first, not the scope. Nothing in this hand-off is justified on the
repo having one component; where a decision still holds only at today's scale,
the **threshold that changes it** is written down instead.

---

## 0.1 What this hand-off changes, and what supersedes what

Two standing user instructions landed after tickets 01-11 resolved, and both are
**BINDING**:

1. **`ngx-foundation-sites` must support ALL Foundation for Sites components.**
   Button is merely the first. Anything optimising for a single component is
   re-evaluated or corrected.
2. **Migrating SCSS settings from Foundation for Sites must be as SEAMLESS AS
   POSSIBLE**, preferring modern Sass modules (`@use`) over Foundation's legacy
   global-`!default` idiom where possible.

The correction test applied throughout (from the map's Notes): *does generalising
cost anything NOW? If it is a placement or shape choice that is free today and
forces rework later, generalise it. If it is machinery with real cost and no
present benefit, do not build it -- but restate the rationale durably and keep the
seam.*

### Supersession ledger

| Superseded | Superseded by | Effect on the decision |
| --- | --- | --- |
| Ticket 07: `$wcag-palette` lives in `src/scss/_button.scss` | **Ticket 12 C1** | **CORRECTED.** It lives in a new `src/scss/_theme.scss`, exported `"./scss/theme"` |
| Ticket 07's cost argument for reusing `_button.scss` (a new file "needs" a costly new `exports` key) | **Ticket 12 C1** | **DOES NOT SURVIVE.** One `package.json` line; no script, target or `ng-package.json` change. Ticket 07's one self-flagged `[INFER]` is now **VERIFIED TRUE** and graduates out of the unverified list |
| Ticket 09: the compile call is hard-wired to `nfs-button.theme()` with `$selector: '.button'` | **Ticket 12 C2** | **CORRECTED.** A generated `THEMEABLE_MODULES` list, one entry today. The "pass no `$selector`" half is RESTATED, not corrected |
| Ticket 08: the generator compiles "the chain" (singular) | **Ticket 12 C3** | **CORRECTED, and required TODAY** -- not a generalisation. A single-entry closure provably cannot see `_theme.scss` |
| Ticket 08's closure sizing: 13 Foundation + 3 library partials, 71.9 KiB / 24.3 KiB gzip | **Ticket 12 C4** | **NUMBERS CORRECTED** (16 files / 84.4 KiB / 24.1 KiB gzip, plus multi-component bounds); **conclusion RESTATED** -- sources are still a bounded rider on the `sass` payload |
| Ticket 07/09: the defaults probe reads `$button-palette` / `$button-background` / `$button-radius` | **Ticket 12 C5** | **CORRECTED.** Read the Foundation-global names instead; verified byte-identical today, and it drops a spurious `primary` key |
| Ticket 09: "at 197 ms a debounce timer is a magic number" | **Ticket 13 D1** | Decision UNAFFECTED, **rationale replaced**: the coalescer self-tunes because its interval *is* the machine's compile time. Timer threshold: a measured 1000 ms apply |
| Tickets 01/09: "6 controls and one component make the cache key space tiny" | **Ticket 13 D2** | Decision UNAFFECTED, **rationale replaced**: one compile means one cache key; a cache is unwarranted until a repeat theme crosses the 300 ms indicator threshold |
| Previous hand-off s7: "a pool would convert nothing to nothing" | **Ticket 13 D3** | **FALSE as a general claim** -- measured pool gain reaches 4.1x by N=20. No pool still stands, on three durable grounds |
| Ticket 01's reading of the reference project's 20.5% pool gain as a general law | **Ticket 13 D3** | **N=2, 2.7:1-imbalance artifact.** Must not survive as a law |
| Ticket 01: this repo "plausibly lands near the reference's worst case" (1.3-1.6 s) | **Ticket 13** | **Wrong by ~7x** -- measured 197 ms |
| Ticket 05's "1.7x regime shift" | **Ticket 13 s1** | A **declaration-order sampling artifact**. Ticket 13 reproduced it as a fake finding in its own first pass and discarded it |
| Ticket 12 C7: `$global-text-direction` "ruled OUT, provably inert twice over" | **Ticket 14 D2 + D3** | **SPLIT.** OUT as an addon control (upheld, re-grounded on merit); **IN** as an accepted-and-honoured public settings entry. The inertness ground was Button-specific -- the single-component premise reappearing inside the pass meant to remove it |
| Ticket 12 C7 ground 4: "the correct treatment is the post-import logical-property rebind" | **Ticket 14 D1a/D1b** | **MEASURED FALSE as a general mechanism.** The rebind emits invalid CSS at ~50 of ~109 source sites, six defect classes, ~11 components, silently |
| map.md Ground truth: "RTL is logical-properties-only (no `[dir]`, no rtlcss)" read as a library-wide prohibition | **Ticket 14 D1c / s5** | Accurate as a description of **what M003 built**; not a prohibition. M003's `:dir()` rejection (D021) is Button-scoped and **comparative**; using `:dir()` later needs **no decision reversal** |
| map.md Out-of-scope: "extending `theme()`'s public Sass API" (justified by what the addon's panel needs) | **Ticket 15** | Ruling **withdrawn and re-made on correct grounds**: M002 owns NOTHING of the settings API; it belongs to a dedicated later milestone. The narrow claim survives -- M002's addon needs no public Sass API extension -- but it must never bound the library's settings surface |
| Previous hand-off: "no `exports`-map or `verify-exports-map` change" (stated flatly) | **Ticket 12 C1** | **SPLIT.** True of the ADDON's delivery shape (D032); **false of M002 as a whole** |
| Previous hand-off: "no public Sass API growth" (stated flatly) | **Ticket 12 C1** | **QUALIFIED.** No growth of `theme()`'s public signature; one new public data module carrying one member |
| Previous hand-off R009 open question 1 and s6.2: "that growth is not M002 scope -- no second component exists" | **Ticket 12 C2/C6/C8** | **ANSWERED, not carried.** The compile call is a list; adding a component is one array entry plus regenerating the sources module. The phrase "no second component exists" does not survive as a rationale anywhere |
| Previous hand-off s3's optional split "add a D037 carrying D035 clause (f)" | This document | **Renumbered to D041** -- D037-D040 are now taken by real decisions |

**Tickets 04, 06 and 10 were swept and are UNAFFECTED** [VERIFIED, not assumed]:
zero single-component-premise hits and zero `'.button'` literals across all three;
no gate or lane assignment hard-codes the button. Two *subject framings* in
research/10 are reworded in section 2 below; no assertion changes.

---

## 1. Sharpened R009

Replace R009's Description and Validation. Class stays `differentiator`, Status
stays `active`, Source stays `user`.

### R009 -- proposed replacement text

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
> `verify-exports-map` change**) lets a developer or designer retheme **the
> library** live in Storybook without a rebuild.
>
> **The curated control set is exactly six values, and it is closed.** All six are
> **Foundation global theme variables**; Button's `theme()` mixin is today's only
> consumer of them, and the control set is therefore correctly shaped for a
> library that will wrap every Foundation component:
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
> **Footnote on the "Foundation global" column -- it is VOCABULARY, not wiring.**
> Seeding those upstream global names into the library's island has **NO EFFECT
> on emitted CSS** [VERIFIED: `$foundation-palette`, `$primary-color`,
> `$global-radius`, `$global-font-size`, `$global-margin`,
> `$global-text-direction` all measured inert]. The island pre-seeds the
> *derived* names non-`!default` before Foundation's `@import`s, so Foundation's
> own derivation cascade never fires. The column names what each control **is** in
> Foundation's vocabulary; the mechanism by which it reaches CSS is the third
> column and nothing else. A future settings milestone that routes these controls
> through `$foundation-palette` / `$global-radius` would ship a silent no-op.
>
> No other variable is exposed. Font size, padding and hover-lightness are not
> addon controls. **`$global-text-direction` is explicitly excluded as a control**
> -- it is layout, not theming; it is mechanically unreachable through the addon's
> `@use` + `@include theme()` entry; it would break the six-scalar preset
> equality; and the demonstration need is already met better by the existing
> side-by-side `Rtl` story, which a preview-wide direction toggle could not
> express. (It is *accepted and honoured* as a library **settings** entry -- see
> D037. Excluded as a control is not excluded from the contract.) `rem` radii
> remain available to consumers compiling at build time; the addon's control is
> px-only by design.
>
> **The six controls are an ADDON surface, never the library's settings
> vocabulary.** The panel is a live-tweak subset of `theme()`'s arguments, chosen
> for what is useful to drag a slider on. The library's settings vocabulary is
> Foundation's 490-name surface, and it is a compile-time concern owned by a later
> milestone (D040). The panel must never be cited as evidence about the library's
> Sass API -- in either direction, and least of all as a reason to keep that API
> small.
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
>   validates on write, **every reachable control state is URL-encodable** -- the
>   shareable-link guarantee is total, not best-effort.
> - State lives on **Storybook globals** under one key, whose value is a
>   **sparse, canonical-minimal override map** with `initialGlobals.nfsTheme = {}`
>   meaning "Foundation's default theme". A key is present **iff** its value
>   differs from the Foundation default; setting a control back to the default
>   *deletes* the key. Consequence: in-session state is byte-identical to
>   post-reload state, the default theme produces an **empty** `?globals=`, and
>   "reset to default" is `updateGlobals({ nfsTheme: undefined })` with no reset
>   code to write.
> - **The compile call is a generated `THEMEABLE_MODULES` list, one entry
>   today.** The addon builds its entry string by mapping over that list -- one
>   `@use '<url>' as <ns>;` and one `@include <ns>.theme(<args>);` per entry --
>   rather than hard-coding a single module. This is **free today**: the entry
>   builder is already a string builder, so one hard-coded pair becomes a `.map()`
>   over a one-element array. Verified: ONE compile over two themeable modules
>   emits both selectors and serves the Foundation `@import` island **once** (13
>   partials, not 26). Entries stay `{url, namespace}` **object literals**, not
>   bare strings, so a future entry can carry per-module argument or direction
>   fields without a shape change. Per-module argument filters are a **named seam,
>   not built**.
> - **The entry string is an ordered array of sections whose FIRST section is
>   reserved for configuration and is empty today**, not a concatenation with
>   extras appended. `@use 'nfs:/button'` transitively loads the settings module
>   immediately, and Sass configuration must precede every `@use` of any module
>   that loads it -- so an appended configuration clause can never work. Cost:
>   zero, the same ~4 lines either way. Getting it wrong means restructuring the
>   entry builder inside a Worker whose diagnostics are degraded.
> - **The addon passes no `$selector` to any themeable module**, so each emits
>   under its own default selector (`.button` today) -- exactly what a zero-config
>   consumer's build produces. The addon must **not** seed bare Foundation globals
>   in its entry; that is the mechanism `_button.scss` records as
>   measured-and-rejected, and it is the exact channel that would make direction
>   accidentally reachable and then load-bearing.
> - Compilation runs **sync `sass.compileString` inside a single Web Worker**,
>   constructed lazily on the first theme change. Sources reach the compiler from
>   a **committed, generated TS data module** under `.storybook/`, produced by
>   `scripts/generate-theming-sources.mjs` and gated by a new
>   `verify-theming-sources` target on `lint`. **The generator takes N entry
>   points and unions their closures** -- two arrays, `THEMEABLE_MODULES` and
>   `DATA_MODULES` -- and this is **required today, not a generalisation**:
>   negative control verified that a single-entry closure over `nfs:/button` does
>   **not** contain `nfs:/_theme.scss`, because nothing `@use`s a data module until
>   a consumer does. The entry-point arrays stay **data**, and the themeable list
>   is emitted into the data module so the byte-compare covers it. **No gate may
>   freeze a literal closure file count** -- adding a module would turn a correct
>   change into a red gate for the wrong reason. No network fetch, no bundler raw
>   imports (Angular's unconditional `.scss` webpack rule makes `asset/source`
>   return *compiled CSS*, not raw Sass -- a silently wrong string).
> - Recompile policy: **no debounce timer**; a single-slot latest-wins coalescer.
>   In-flight compiles are superseded, never cancelled (terminate+respawn costs
>   3-4x a warm compile). A `Compiling...` indicator appears in the panel only
>   past 300 ms. **The last good CSS is never cleared on error**; the panel shows
>   `sassMessage` plus a friendly source name derived from `span.url`.
>   **Why a coalescer and not a timer, stated durably:** the coalescer's
>   coalescing interval **is** the machine's actual compile time, so it self-tunes
>   and needs no re-tuning as components land -- whereas a 250-300 ms constant
>   picked today would fire mid-compile forever at full library coverage. A
>   trailing debounce would go **in FRONT of** the coalescer, never instead of it,
>   and only past a measured 1000 ms apply (reached at the 5th-6th palette-driven
>   component, i.e. full coverage).
> - **The default theme is never compiled.** The addon compiles only non-default
>   themes. Foundation's default theme is already on screen as the library's
>   static `@layer nfs-defaults` CSS, so there is no first-paint compile, no
>   pre-compile at init, and no `waitForInitialTheme()`-style readiness gate.
>   Zero-compile beats cache-hit. This is what makes the reference project's
>   fourth mitigation structurally inapplicable here (D038).
> - Compiled CSS is injected as **one `<style id="nfs-theming">` node in
>   `document.head`**, get-or-create by id, `textContent` replaced per compile.
>   One node total, shared across story and docs mode.
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
>   panel init. The probe reads `$wcag-palette` from **`nfs:/theme`** and the six
>   **Foundation-global** names from `internal/settings` -- `$primary-color`,
>   `$secondary-color`, `$success-color`, `$warning-color`, `$alert-color`,
>   `$global-radius` -- **not** the button-derived `$button-palette` /
>   `$button-background` / `$button-radius`. Verified byte-identical today, so the
>   swap is free, it drops a spurious `primary` key `theme()` skips, and it reads
>   names that survive the eventual split of `internal/_settings.scss`. **No
>   TypeScript copy of any of the six values exists anywhere.** The probe's
>   variable list lives in the generated data module beside `THEMEABLE_MODULES`,
>   not inline in the Worker, and it is a **named seam owned by the settings
>   milestone**.
> - **Seeding is not locking.** Applying a preset is a single `updateGlobals`
>   with that preset's canonical map; afterwards the controls are ordinary
>   controls.
> - **A preset reads as "selected" only on exact match**, and selection is
>   **derived on every render, never stored**. Formally: preset P is selected iff
>   `equal(canonical(live), canonical(P))`, a six-scalar deep-equal. Because both
>   sides are canonical-minimal, *sparse equality is resolved equality* -- a user
>   who leaves `primary` untouched and a user who explicitly types Foundation's
>   own `#1779ba` are the same object, not two states. Presets are ordered and the
>   first match wins. When nothing matches, a literal `Custom` entry is shown as
>   selected; choosing `Custom` is a no-op.
> - **The panel loads asynchronously on first open, by design, and the window is
>   ~1 ms.** Sequence: construct Worker (which is when the lazily-split sass chunk
>   is fetched) -> run the preset probe compile -> render controls. The probe
>   itself measured **1.1 / 0.7 ms** over 2 data files and never enters the
>   Foundation island. Until it resolves the panel is in `loading`. This is
>   intended behaviour, not a defect, and it must **not** be merged with a default
>   pre-compile -- there is no default pre-compile, and merging would drag the
>   island into a 1 ms data read. The preview never waits on the probe: `theme()`
>   resolves omitted arguments internally, so a themed story renders straight from
>   the sparse map.
>
> **Stated user-visible consequences (accepted, not defects):**
>
> - The panel is unavailable on autodocs pages, but the theme still applies there
>   -- docs pages render under whatever theme was last chosen, and retheming
>   requires navigating to a story.
> - Control state persists **through the URL only** (`?globals=`), which
>   round-trips across reload and survives story navigation. There is no
>   `localStorage` persistence and no user-saved presets (see section 6).
> - The radius control's unit is implicit px, 0..32 integer.
> - The sass compiler payload is **802 KiB gzip / 436 KiB brotli** [VERIFIED,
>   measured], fetched lazily on first theme interaction, +70% on the preview's
>   current 1140 KiB gzip. Preview boot is unchanged. This cost is attributable to
>   **D020**, not to the addon -- see section 7.
>
> **Sass API growth, stated exactly (this claim was previously overbroad):**
>
> - **`theme()`'s public signature does not grow.** The six controls map 1:1 onto
>   its existing `$background` / `$palette` keys / `$radius` [VERIFIED against
>   `src/scss/_button.scss:58-63`]. That is the load-bearing claim and it stands.
> - **M002 does add one new public Sass module:** `src/scss/_theme.scss`, exported
>   as `"./scss/theme"`, carrying exactly one member (`$wcag-palette`) and
>   emitting **0 bytes** on `@use`. It is a **DATA module** and must never gain a
>   `!default` member or become the settings entry point (D040 / NF1).
> - **The `exports`-map claim splits.** The **addon** adds no `exports` key
>   (D032, unaffected). **M002 as a whole adds exactly one**, `"./scss/theme"` --
>   one line in `package.json`, with no script, no `ng-package.json` and no new
>   target, because `verify-exports-map.mjs` diffs source-vs-dist keys and is
>   agnostic to key count. Do not read D032's "no exports-map change" as covering
>   D033's key.
>
> **Documentation deliverable (one README section in
> `packages/ngx-foundation-sites/README.md`)**, covering: the six controls with
> units and ranges; the two presets and the exact-match rule; the URL-sharing
> guarantee; the story-mode-only panel limitation; **`$global-text-direction`'s
> accepted-and-honoured status with its inert-today disclosure** (D037); and
> **today's silent-ignore behaviour as a named known limitation** -- name
> `theme()`'s four arguments as the entire compile-time surface today, and state
> explicitly that Foundation `$variable` declarations in consumer stylesheets have
> no effect. That last item is M002's one positive obligation towards the
> seamless-migration constraint: pasting Foundation's entire 490-variable settings
> file compiles **byte-identically** (5839 B) with **no warning** [VERIFIED], and
> M002 is the only milestone in flight that ships theming documentation.
>
> **Validation (mappable):** R009 is proven by the Playwright lane's P1-P8 and the
> `verify-theming-bundle` gate G2a described in R021 -- specifically: the addon
> panel loads in the **static** Storybook build with zero manager `console.error`
> (P1 + G2a); driving the primary colour control changes the computed
> background-colour of a themed element with a pre/post differential (P2);
> selecting `WCAG-compliant` seeds all six controls to their named values and
> renders `#238648` / `#9e6c00` / `#cb4b37` (P3); tweaking one control flips the
> selector to `Custom` and setting it back flips it to `WCAG-compliant` (P4 -- the
> exact-match semantics under test); `?globals=` round-trips a single sparse
> override and the default theme yields an empty param (P5); the panel goes
> `loading -> ready` on first open (P6).

### Open questions R009 carries for the planner

**The previously-carried "what happens when a second component lands" question is
ANSWERED, not carried** (see section 6.2). What remains:

1. **Docs deliverable scope.** The README section above is the deliverable.
   Extending `verify-autodocs-coverage` to the addon is explicitly **out of
   scope** (that gate covers Angular component input tables; the addon has no
   component).
2. **A conditional, not-yet-fireable assertion**, recorded so it is not
   rediscovered: once a **second** themeable module lands, the generated sources
   module must carry the island's dependency preamble (sassy-lists +
   typography) -- see section 5.3. It cannot fire today.

---

## 2. Sharpened R021

Replace R021's Description and Validation. Class stays `quality-attribute`,
Status stays `active`, Source stays `user`.

### R021 -- proposed replacement text

> **Title:** The M002 theming addon is verified across four lanes -- Vitest
> `test` (jsdom), Vitest `test-browser` (real Chromium), a dedicated Playwright
> project against the static Storybook build, and build-time `verify-*.mjs` gates
> -- with each lane assigned the assertions it is the cheapest lane able to fail
> on for the right reason.
>
> **Description:**
>
> The original text said "Vitest unit tests and Playwright e2e tests". That is
> **two lanes short**. The verified split is four, and the axis is *capability*,
> not preference. The governing rule is: **the cheapest lane that can fail for the
> right reason. A lane that cannot observe the failure mode is not cheaper, it is
> vacuous.**
>
> **Lane 1 -- `test` (Vitest, jsdom). Proves: everything compiler-side and
> logic-side.**
> jsdom resolves the **Node** sass build and compiles the real `theme()` chain
> from the committed in-memory source map to **5839 bytes, sha256 prefix
> `49bfb1a2e67bf91a`** -- byte-identical to five other producers [VERIFIED]. So
> this lane owns: the sources-map fitness digest; **an assertion that the
> generated sources module contains `nfs:/_theme.scss`** (ticket 12's negative
> control turned into a standing check -- a single-entry-generator regression is
> otherwise visible only as a Worker runtime error with a degraded diagnostic);
> per-control differential compilation (compile with A and B, assert the literal
> **and** `cssA !== cssB`); the preset baseline probe returning Foundation's six
> **global** defaults and `$wcag-palette`'s three overrides by exact key set;
> **preset-equality** (canonicalisation deleting a default-valued key is the
> load-bearing assertion -- without it the whole "sparse equality is resolved
> equality" property silently fails and no other test notices); input validation
> including feeding the panel's write output through the real `buildArgsParam`
> with a deliberately-invalid control producing an empty `?globals=`; Sass error
> shape (`sassMessage`, `span.url`, no ANSI) **and** the friendly missing-importer
> diagnostic, which only survives outside a Worker; the error-serialisation
> contract with a `structuredClone`-loses-the-fields control; the coalescer state
> machine; and the R026 config assertions including the new path-spelling
> divergence guard.
>
> **Lane 2 -- `test-browser` (Vitest, real Chromium). Proves: the four things
> jsdom structurally cannot.** Keep it to one spec file; each file pays the sass
> bundle cost. It resolves the **browser** sass build -- the same dart2js artifact
> the Worker chunk ships -- so a browser-only Dart Sass regression is observable
> without a Storybook build. It has a real `Worker`, for the theme-in / CSS-out
> and error-object round trip. And it is the **only** lane with a real cascade:
> **jsdom discards `@layer`-wrapped rules entirely** (a layered-only rule computes
> `rgba(0,0,0,0)`) [VERIFIED], so every R008 cascade assertion in jsdom would be
> vacuously green. The R008 assertion here runs in both insertion orders **plus a
> layered-only control** proving layered rules apply at all -- the control is what
> makes the result real. Injection idempotency (three calls, one `#nfs-theming`
> node, last CSS wins) sits here beside it. Any computed-colour read in this lane
> must first inject `*, *::before, *::after { transition: none !important }`.
> **This lane must not be narrowed or removed** -- it is the only place an
> authoritative CSS-validity oracle can exist (the browser's own CSSOM), and the
> library's one known silent-drop failure class needs one (section 8).
>
> **Lane 3 -- Playwright at `apps/nfs-storybook-e2e/`. Proves: only what needs the
> Storybook manager.** `@storybook/test-runner` **cannot** reach manager-side
> addon panels -- its `page` is the preview iframe [VERIFIED three ways]. So a
> dedicated `@playwright/test` project is required: new project directory, an
> `e2e` target with `dependsOn: ["ngx-foundation-sites:verify-theming-bundle",
> "ngx-foundation-sites:static-storybook"]`, a polling `globalSetup` copied from
> `nfs-demo`'s, and a ~40-line local `SbPage`. **Zero new dependencies.** The
> harness was proven live in this repo against the real `addon-a11y` panel, which
> registers through the same `addons.add(PANEL_ID, {type: types.PANEL})` mechanism
> M002's addon uses. Because it runs against `static-storybook`, this lane **is**
> the static-build proof -- ticket 04's probes ran against the dev server only, so
> the first run against the static build is an explicit acceptance step, not an
> assumption. It owns: addon load (panel tab present **and** zero manager
> `console.error` -- the console half is the only thing that catches esbuild's
> injected try/catch swallowing a crashing manager entry); control-to-computed-
> style with a pre/post differential, read from **a themed element of each
> themeable module** (the button today); preset seeding all six controls by name;
> the tweak-then-restore `Custom` <-> `WCAG-compliant` flip (the derived-selection
> proof, and the assertion a stored mode flag would fail); the `?globals=` round
> trip including the empty-param case; the panel's `loading -> ready` first open;
> and the autodocs-page consequence. Every style assertion waits on the
> `data-nfs-seq` readiness signal, never a timeout, and uses auto-retrying
> `toHaveCSS`/`toPass` -- Foundation's 0.25s `background-color` transition made
> one-shot `getComputedStyle` reads return stale values twice during probing.
>
> **Lane 4 -- build-time gates. Proves: what no test can observe.**
> `verify-theming-sources` (on `lint`'s `dependsOn`) regenerates the source
> closure in memory and byte-compares it against the committed module, plus
> re-proves string-map CSS == filesystem CSS. It asserts on the **entry-point
> arrays and the byte-compare, never on a literal closure file count.** A **new**
> `verify-theming-bundle` (`dependsOn: build-storybook`, modelled on
> `verify-autodocs-coverage`'s one-script/`failures[]`+`cause` shape) globs
> `sb-addons/*/manager-bundle.js`, content-matches `ADDON_ID` (verified to survive
> minification), asserts **exactly one** match, and asserts `index.html`
> **imports** it -- the `modulepreload` link is only a hint. It also asserts that
> **a marker from the generated source closure**
> (`$button-background-hover-lightness` today) appears in exactly one emitted
> `.js` file and that that file is **not** among `iframe.html`'s module import
> specifiers, which proves the lazy-loading decision still holds.
>
> **Two vacuity traps in the inherited gate design, both fixed here and both worth
> stating as requirements:**
>
> 1. `iframe.html` contains **zero** `<script src=...>` attributes [VERIFIED] --
>    it loads the preview via `import './...'` inside one `<script
>    type="module">`. A gate phrased as "not referenced by any `<script src>`"
>    would have passed forever, including with `sass` statically imported into the
>    preview. The gate must parse the module-import specifiers instead.
> 2. The addon bundle directory carries an **order-dependent index**. A hard-coded
>    path yields "file not found", which a sloppy script reports as "addon not
>    present" -- correct-looking, and equally wrong after any addon reorder.
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
> `.registry-consumption-evidence.txt` precedent and M001/S11's break-and-observe
> practice. Five entries, each a break-and-observe run: blank a generated source
> entry; rename `ADDON_ID`; add a static `import 'sass'` to
> `.storybook/preview.ts`; change the R026 `ignores` glob to the
> config-dir-relative spelling; comment out the `textContent` assignment. The
> fourth has **no runtime symptom at all** and the third protects a decision (lazy
> loading) rather than a behaviour.
>
> **One CONDITIONAL item, recorded now because it cannot fire yet.** When a second
> themeable module lands, lane 1 must additionally assert that the generated
> sources module contains the island's dependency preamble (sassy-lists +
> typography). A missing preamble is not a compile failure -- it is an *emission*
> failure that fires only when that component's rules are actually emitted, inside
> the Worker where the diagnostic degrades. Record it as a conditional item, not
> as a gate that would be vacuous today. See section 5.3.
>
> **Validation:** R021 is satisfied when all four lanes are wired and green, the
> Playwright lane's first run is against `static-storybook` (not the dev server),
> the negative-control evidence file is committed with all five entries
> red-then-green, and one real `nx lint ngx-foundation-sites` run with the addon's
> injection code present has been performed as a once-off acceptance step
> (distinct from the per-commit path-spelling assertion, which the spec harness
> structurally cannot model on its own).

---

## 3. Decision-register entries (D032-D040)

Append these to `.gsd/DECISIONS.md`'s table. **The register is append-only** --
never edit an existing row. **D031 is the highest existing number [VERIFIED by
reading `.gsd/DECISIONS.md`], so D032 is the next free.** Columns, in order:
`# | When | Scope | Decision | Choice | Rationale | Revisable? | Made By`.

All nine operate **under** the standing human decisions D020 (SCSS-variable
theming only) and D023 (compliant theme ships in M002) and re-decide neither.

### D032 -- delivery shape (ticket 06)

- **When:** M002 wayfinding effort (`.scratch/m002-storybook-theming-addon/`), 2026-08-11
- **Scope:** architecture
- **Decision:** Whether the R009 theming addon ships as workspace-local Storybook tooling or as a publishable addon package
- **Choice:** Workspace-local, resident in `packages/ngx-foundation-sites/.storybook/`, entry points auto-discovered (`.storybook/manager.ts` manager-side, the existing `.storybook/preview.ts` preview-side). No new package, no `addons: []` wiring, no `local-preset.ts`, and **no `exports`-map or `verify-exports-map` change attributable to the ADDON** (M002 does add one `exports` key, for D033's palette module -- that key belongs to D033, not here). The module boundary is kept extractable-later in file terms only (entries literally named `manager.ts` / `preview.ts`; the addon reaches the library only through published specifiers), with any `package.json`, `dist/` build, addon-kit scaffold, Nx project or path alias written "for later" explicitly rejected as speculative generality. Costs one `include` line in `.storybook/tsconfig.json`, whose `"*.ts"` glob is non-recursive.
- **Rationale:** Ticket 02 verified three ways that a workspace-local unpublished addon can be wired by relative path and that `resolveAddonName` returns structurally identical records for local paths and published packages -- so a package buys zero functional gain. A separate addon *directory* loses on a cache-coupling asymmetry verified in `nx.json`: the `production` named input excludes `.storybook/**` but not a sibling directory, so every addon edit would invalidate `build` -> `verify-exports-map` -> `lint`. A *package* loses four further ways: `workspaces: ["packages/*"]` is live, the library package is non-private with no `release.projects` filter (so honouring R019 would mean writing config to neutralise what you just created), a separate package sits outside `{projectRoot}` and would make `build-storybook` go stale-cache **silent**, and it would convert the sass payload into a consumer cost. Verified component-agnostic in ticket 12's sweep -- the shape holds at any component count. Operates under D020 and R019; re-decides neither.
- **Revisable?:** true
- **Made By:** agent

### D033 -- where the WCAG-compliant palette lives (ticket 07, CORRECTED by ticket 12)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** library
- **Decision:** Where the WCAG/axe-compliant palette lives as a single source of truth, given the founding brief's assumption that M003 already produced one was false
- **Choice:** `$wcag-palette` becomes a plain public Sass map in a **NEW** `packages/ngx-foundation-sites/src/scss/_theme.scss`, exported as `"./scss/theme"` -- one added line in `package.json`. `src/scss/_button.scss` is **UNCHANGED** and does **not** `@forward` it: `theme()` takes `$palette` as an argument, so a component module never needs to see theme data. The demo app reads it as `@use 'ngx-foundation-sites/scss/theme' as nfs-theme;` -> `$palette: nfs-theme.$wcag-palette`; the addon reads it, plus Foundation's **global** defaults from `internal/_settings.scss`, through a custom Sass function registered on the `compileString` call it already makes. No script change, no `ng-package.json` change, no new Nx target, no generated artifact, and **no TypeScript copy of the values anywhere**. `_theme.scss` is a **DATA module**: plain assignments, one member, **no `!default`**, and it is **not** the settings entry point (D040/NF1). The demo-app rewire is M002 scope and is one atomic three-part change (section 5.2).
- **Rationale:** `success` / `warning` / `alert` are **Foundation `$foundation-palette` keys -- a global concept**, not button variants. Ticket 07 placed the map in `_button.scss` because that was the only public entry point that existed, i.e. for exactly the single-component reason the multi-component constraint forbids; **ticket 12 re-weighed that cost argument and it did not survive.** Ticket 07's one self-flagged inference is now **VERIFIED TRUE** (Node's own resolver refuses `fakepkg/scss/theme` under the identity map `"./scss/*"`; only the literal `scss/_theme.scss` passes) -- but it binds **no consumer in this repo**: Dart Sass `loadPaths`, Dart Sass's `NodePackageImporter`, **and Angular's own Sass importer** all bypass `exports` for subpaths. Angular's is the decisive one and was unknown to ticket 07: `@angular/build`'s `findFileUrl` falls back to `join(packageRoot, ...pathSegments)` after an exports-honouring miss, which resolved even the `null`-mapped `scss/internal/settings` against the REAL tarball. The key is therefore added for the *published* surface's correctness and costs one line -- `verify-exports-map.mjs` diffs source-vs-dist keys in two loops and never enumerates `.scss` files, and `ng-package.json`'s `src/scss/**/*.scss` asset glob already ships any new file. The placement is **free now and expensive later**: `$wcag-palette` does not exist yet, so moving it costs nothing today and would later be a breaking rename of published API or a permanent `@forward` shim. Substance unchanged from ticket 07: the palette had **one executable instance and five descriptions** across five tracked files, the library shipped nothing, and ticket 01 found the reference project carrying **three mutually inconsistent** compliant palettes at HEAD -- the exact drift this collapse prevents. Verified by execution: a standalone `nfs:/theme` module compiles, is capturable through the addon's custom-Sass-function mechanism on both the Node and **browser** paths, adds +1 file / +0.4 KiB raw to the closure, and emits **0 bytes** on `@use`. Operates under D023; decides the mechanism, not the substance.
- **Revisable?:** true
- **Made By:** agent

### D034 -- how Foundation's Sass reaches the browser (ticket 08, CORRECTED by ticket 12)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** How the Sass sources the in-browser `theme()` compile reaches are delivered to a compiler that has no filesystem -- measured today at **16 files / 84.4 KiB raw / 24.1 KiB gzip**, bounded at **52 files / 212.9 KiB / 46.2 KiB gzip** across all 35 Foundation components and **111 files / 349.1 KiB / 70.1 KiB gzip** at the absolute `foundation-everything()` ceiling
- **Choice:** Build-time inlining, with an **N-entry-point** generator. `packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs` takes two data arrays (`THEMEABLE_MODULES`, `DATA_MODULES`), compiles each entry's real chain in Node with a disk-backed importer, **unions the closures**, records exactly the URLs it served, and emits a **committed** TS data module under `.storybook/` -- with `THEMEABLE_MODULES` emitted into that module so `verify-theming-sources`' byte-compare covers it. The Worker feeds the sources to its importer verbatim. Gated by a new `verify-theming-sources` target on `lint`'s `dependsOn`, which asserts on the arrays and the byte-compare and **never on a literal file count**. `sass` is lazy **by construction**: it is imported from the worker module and nowhere else, so webpack's worker chunk *is* the split point and no `await import()` is needed. Preview boot stays 1140 KiB gzip. The artifact lives in `.storybook/` -- inside the `default` input but outside `production`, and unreachable by `ng-package.json`'s `src/scss` asset glob, so it cannot ship.
- **Rationale:** N entry points are **required today, not a generalisation**: negative control verified that a single-entry closure over `nfs:/button` does **not** contain D033's `nfs:/_theme.scss`, because nothing `@use`s a data module until a consumer does -- so a single-entry generator would silently omit it and fail at runtime inside the Worker with a degraded diagnostic. Bundler raw imports are **blocked, not merely worse**: Angular's `.scss` webpack rule applies `resolve-url-loader` + `sass-loader` through an unconditional nested `{ use }`, so no query escapes it and adding `type: 'asset/source'` yields **compiled CSS, not raw Sass** -- a silently wrong string. Runtime fetch forfeits the locked sync compile (async in-browser is 6-7x slower), needs `staticDirs` to have anything to fetch in the static build, and would publish `src/scss/internal/*` as fetchable URLs. Pre-flattening saves ~0.4% against the worker chunk and moves nothing. Ticket 08's "sources are nearly free" conclusion **SURVIVES the multi-component re-measurement**, reworded from "noise" to **a bounded rider**: 3.0% of the 801 KiB gzip `sass` bundle today, 8.8% measured at the ceiling (~11% including a bounded `[INFERRED]` estimate for 35 library wrapper modules), taking the emitted worker chunk from ~825 to ~890 KiB gzip at full Foundation coverage. The closure is **floor-dominated**: the shared `util/` + `global` floor is **12 of the 13 Foundation partials**, so each component's marginal cost is roughly **one file** (0.2-13.7 KiB). Staleness is caught because the closure is **discovered by compiling, never hand-enumerated** -- a Foundation in-range bump or an upstream `@import`-graph change fails the byte-compare loudly and visibly in the PR diff. Amends ticket 06's boundary rule openly: `ngx-foundation-sites/scss/button` is unresolvable from the workspace root (the root symlink targets the source tree, which has no top-level `scss/`), so the amended rule is "addon *runtime* code imports nothing outside `.storybook/`; the generator is a build script reading workspace-relative paths" -- already the repo's idiom for `scripts/**/*.mjs`. Inherits the Dart Sass 3.0.0 `@import`-removal clock exactly; no option on the table reduces it, and the Node build has identical exposure today.
- **Revisable?:** true
- **Made By:** agent

### D035 -- control surface, preset semantics, CSS injection, and R026's boundary (ticket 09, CORRECTED by tickets 12 and 13)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** The addon's user-facing model and the state that backs it -- control surface, preset-selection semantics, CSS injection and cascade, recompile UX, and where R026's ban actually falls given that it fires on the addon's injection code
- **Choice:** (a) A single `types.PANEL` titled `Theming`, story-mode only, no toolbar; native `<input type="color">` plus a validating text field; radius as a JS `number` of integer CSS px clamped 0..32. (b) Globals hold a **sparse canonical-minimal** override map with `initialGlobals.nfsTheme = {}`; the panel is the validation boundary and invalid input never reaches globals. (c) Preset selection is **derived from live state on every render, never stored**; canonical form makes sparse equality equal resolved equality, reducing the check to six scalars; a literal `Custom` entry, first match wins; the defaults probe reads the **Foundation-global** names, not the button-derived ones. (d) **The compile call is a generated `THEMEABLE_MODULES` list of `{url, namespace}` object literals, one entry today**, mapped into the entry string, whose FIRST section is an ordered, empty-today slot reserved for configuration; the addon passes **no `$selector` to any themeable module**, so each emits under its own default selector (`.button` today) and rethemes everything; the addon seeds no bare Foundation globals. One `<style id="nfs-theming">` in `document.head`, shared across story and docs mode. (e) Worker-backed sync compile, lazily constructed; **no debounce timer, a single-slot latest-wins coalescer**; supersede never cancel; progress indicator only past 300 ms; last good CSS survives errors; the Worker serialises errors to a plain object; **no cache, no worker pool, and no pre-compiled default theme** -- the default theme is never compiled at all. (f) **R026's boundary is stated for the first time**: R026 bans a hand-fed CSS string as the *component's styling source*; a dev-only Storybook addon injecting browser-compiled output is outside that ban. Encoded as exactly one `**/`-prefixed `ignores` entry on the **existing** non-spec `no-restricted-syntax` block, so the block count stays 2 and `nfs-button.r026-lint.spec.ts`'s `toHaveLength(2)` is untouched.
- **Rationale:** The ticket's highest-risk unknown -- whether `new Worker(new URL(...))` survives Storybook's Angular webpack merge -- closed **positively** two ways: `@storybook/angular` spreads only `cliConfig.module.rules`, discarding the `module.parser` that carries Angular's `worker: false`, and a four-variant real-webpack spike emitted a separate worker chunk with the marker absent from the entry chunk. The negative control matters: with `worker: false` the worker module is not bundled **anywhere**, with zero errors and zero warnings -- a silently-green failure mode, which is why the build-artifact gate is not optional. The sparse-map model is the decision that removes the most machinery: `buildArgsParam` encodes only `deepDiff(initialGlobals, globals)` and `GlobalsStore` merges shallowly at the top level, so a canonical-minimal map has **one** runtime shape in-session and post-reload, where a padded six-key map has two. The module-list form of the compile call is **genuinely free** -- the entry builder is already a string builder -- and one compile over two themeable modules is verified to emit both selectors while serving the Foundation island **once** (13 partials, not 26). **Recompile policy, restated durably** (ticket 09's "at 197 ms a timer adds a magic number" was an N=1 fact and is dropped): the coalescer is chosen because its coalescing interval **is** the machine's actual compile time, so it self-tunes at any component count, where a 250-300 ms constant would fire mid-compile forever at full coverage; a trailing debounce goes **in front of** the coalescer, never instead of it, and only past a measured **1000 ms** apply. **Cache, restated** ("6 controls and one component make the key space tiny" is void twice over -- the key space is six scalars at any N, and size was never the question): one compile means **one** cache key, so the reference project's second, per-component cache level has no counterpart here; a cache is unwarranted until a repeat theme crosses the 300 ms indicator threshold this same decision locks (reached at the **2nd** palette-driven component); and any cache must be in-memory and Worker-scoped, which is what makes a `CACHE_VERSION` string structurally unnecessary -- *a cache may not outlive the artifact that determines its contents*, and the sources ship in the same Worker chunk as the cache, so a new build is a new empty Map. That rules out IndexedDB or any persistent cache permanently. **Pool, restated** (the previous "a pool would convert nothing to nothing" is **false as a general claim** -- measured pool gain, favourable to the pool, is 1.3x at N=2, 2.8x at N=5, **4.1x at N=20**, so the reference's 20.5% is an N=2, 2.7:1-imbalance artifact): a pool is out because a theme apply is **ONE indivisible compile**; creating parallelism means splitting it per component, which measures **+50%** (per-component islands) to **+77%** (separate compiles) in total work at N=20; and **4 of 31 Foundation components cannot be islanded alone at all** (`button-group`, `accordion-menu`, `dropdown-menu`, `menu-icon`), so the split unit is a dependency-closed group, not a component. Its threshold needs all three of: apply > 1000 ms, a valid grouping, and P >= 4 -- not reached by Foundation's own component set. The lazier move, named first: narrow what recompiles, using the measured 19-of-35 sensitivity map. Verified corrections to prior assumptions: **one invalid value drops the ENTIRE theme** from `?globals=` (five valid hex colours were discarded alongside one bad radius), diagnosed only by a `warn` that `.storybook/test-runner.ts` does not catch; the R026 `ignores` glob **must** be `**/`-prefixed because `@nx/eslint:lint` calls `process.chdir(systemRoot)` and ESLint 9 resolves flat-config ignores against cwd, so a config-dir-relative glob is inert under Nx while still passing the spec harness -- green `nx test`, red `nx lint`; and R008's unlayered-beats-`@layer` cascade win is verified in real Chromium across all four insertion orders with an order-detecting control, so **no order tricks, no `!important`, no MutationObserver** are needed. Relocating the addon to escape R026 was rejected outright -- it would silence the rule by geography with no record that an exemption was decided. Operates under D019/D020/R008/R026; states R026's edge rather than re-deciding it.
- **Revisable?:** true
- **Made By:** agent

### D036 -- R021's verification split, D023's axe location, and the port-4400 collision (ticket 10)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** quality-attribute
- **Decision:** What R021's Vitest half and Playwright half each prove, where D023's axe obligation runs once the compliant theme is also a selectable addon preset, and how the port-4400 collision between `test-storybook` and the new Playwright lane is resolved
- **Choice:** **Four lanes**, not two -- `test` (jsdom), `test-browser` (real Chromium), Playwright at `apps/nfs-storybook-e2e/`, and build-time gates (`verify-theming-sources` on `lint`, plus a new `verify-theming-bundle` on `build-storybook`). **D023's axe proof STAYS in `apps/nfs-demo`; nothing is re-pointed and no axe scan is added to any Storybook lane.** The addon's preset is bound to the axe-proven palette by a data-identity unit assertion plus one rendered-colour Playwright assertion. The default theme's three `expectedContrastFailures` literals are **frozen**. Port 4400 is resolved by refactoring `test-storybook` off `concurrently` onto `dependsOn: ["verify-autodocs-coverage", "static-storybook"]`, keeping `wait-on tcp:4400`. **The `test-browser` lane must not be narrowed or removed** -- beyond `@layer`, it is the only lane where an authoritative CSS-validity oracle can exist.
- **Rationale:** The lane boundary moved in **both** directions, measured. jsdom is far more capable than assumed -- it resolves the Node sass build and compiles the real chain to the same sha256 as five other producers, and ticket 07's custom-`functions` probe works there -- so all compilation, preset, equality, validation and error-shape assertions land in the cheapest lane. But **jsdom discards `@layer`-wrapped rules entirely**, so every R008 cascade assertion there would be vacuously green; an earlier probe pass reported "unlayered wins" in jsdom and it was true for the wrong reason. Cascade, a real `Worker`, and the browser sass build go to `test-browser`. Playwright owns only the manager, which `@storybook/test-runner` structurally cannot reach. The axe proof stays in the demo app because the tarball route is a **strictly stronger** proof -- it scans the compliant palette through the real `exports`-gated public subpath in both CSR and SSR -- while an addon-driven scan would re-measure colours already measured through an async-Worker-probe wait, and would mean adding an axe dependency to a lane whose entire purpose is the manager UI. `wait-on` is kept deliberately because Nx's continuous-task ordering is start-based, not readiness-based. Verified component-agnostic in ticket 12's sweep: no gate or lane assignment hard-codes the button; two subject framings are reworded (the Foundation marker is "a marker from the generated source closure"; the computed-style subject is "a themed element of each themeable module"), with no assertion changes. Operates under D023 and R008; discharges D023's third clause without re-deciding it.
- **Revisable?:** true
- **Made By:** agent

### D037 -- `$global-text-direction` in the public contract, and as an addon control (ticket 14, SUPERSEDES ticket 12's item 7)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** library
- **Decision:** `$global-text-direction`'s status in `ngx-foundation-sites`' public contract -- given a migrating consumer's Foundation settings file always contains it -- and whether it becomes a Storybook addon control in M002
- **Choice:** **ACCEPT AND HONOUR**, with an explicit inert-today disclosure, and **NOT a control in M002, and never a member of the theme map.** The settings surface (D040's later milestone) must carry it as a recognised, honoured, narrowly-documented setting: it must not drop it, must not `@error` on it, and must not accept it into a channel that discards it silently. The documented contract text: *it sets the Sass-time direction for the constructs CSS logical properties cannot express -- transforms, generated content, and direction-conditional rules; it has no effect on the box-model and float properties this library emits logically, which mirror at runtime from the document's `dir` in either setting; and as of M002 the shipped surface (Button) contains zero such constructs, so the setting is currently a no-op.* Separately, `_theme.scss` must not acquire a direction member, and `theme()`'s signature must not grow a direction argument. If RTL preview breadth is ever wanted, the shape is a `dir` attribute toggle on the preview root -- a decorator costing **zero Sass compile** -- never a Sass variable in the theme map.
- **Rationale:** **This supersedes ticket 12's C7 ruling ("OUT, provably inert twice over"), which was verified correct for Button and wrong as a forward-looking ruling** -- the single-component premise reappearing inside the pass meant to remove it. `$global-text-direction` is read in **9 places across 7 Foundation files**, and at least two drive output logical properties **cannot** express (`drilldown`'s `translateX` sign flip; `breadcrumbs`' separator-character swap). The deciding discovery is that it **composes correctly** with the library's rebind rather than conflicting with it: the rebind is unconditional and post-`@import`, so the properties it reaches stay runtime-directional in either setting, and the variable therefore reaches **only the residue** -- exactly the constructs logical properties cannot express. It is not a legacy wart; it is the correct escape hatch in Foundation's own vocabulary, i.e. the maximally seamless answer available under the BINDING seamless-migration constraint. The alternatives were each rejected explicitly: `@error` fails the build on a variable sitting at its own default (`ltr`), which is indefensible; **silent acceptance is ruled out by name** as the worst migration outcome; `@warn` is wrong because the setting is not meaningless and warning on a setting that works trains consumers to ignore warnings. The inert-today sentence is what converts silence into disclosure, and it is **VERIFIED** -- the public `theme()` chain compiles **byte-identically (5839 bytes)** under both values. As an addon control it is out on merit, not omission: it is mechanically unreachable through the addon's `@use` + `@include theme()` entry (it must be set before the island's `@import`s, and `theme()` runs after -- reaching it needs the bare-Foundation-globals mechanism `_button.scss` records as measured-and-rejected); it breaks R009's six-scalar preset equality; it costs a compile per toggle against a 197-305 ms baseline; **decisively, the demonstration need is already met better**, because the existing `Rtl` story renders `dir="ltr"` and `dir="rtl"` side by side in ONE document and a preview-wide toggle cannot express that; and ticket 01 measured the reference project's panel<->toolbar globals sync plus a 5 s `waitFor` as real cost buying nothing. Ticket 12's C7 *conclusion* (not a control) is upheld; its *ground* (inertness) is retired rather than repaired.
- **Revisable?:** true
- **Made By:** agent

### D038 -- no cache, no pool, no pre-compiled default theme (ticket 13)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** anti-feature
- **Decision:** Whether M002 ships any of the four mitigations the reference project needed at two components -- input debounce, LRU caching, a worker pool, and pre-compiling the default theme at init
- **Choice:** **None of the four, and pre-compiling the default theme is rejected outright rather than deferred.** The default theme is **never compiled at all**: it is already on screen as the library's static `@layer nfs-defaults` CSS, so there is no first-paint compile and no readiness gate. Persistent caching (IndexedDB or any storage) is likewise **rejected permanently, not deferred**. The other three are **not built today but have named thresholds and named seams**: a cache (one level, in-memory, Worker-scoped, capped, keyed on the entry string, ~3 lines at the single Worker call site) when a repeat theme apply crosses **300 ms** -- reached at the **2nd** palette-driven component; a trailing debounce **in front of** the coalescer when an apply crosses **1000 ms** -- reached at the **5th-6th** palette-driven component, i.e. full library coverage; a worker pool only when apply > 1000 ms **AND** a dependency-closed grouping exists **AND** P >= 4 -- not reached by Foundation's own component set. One correctness item does have a real trigger: a multi-component-capable island preamble is needed at the **2nd themeable module**, any tier (section 5.3).
- **Rationale:** Measured across four architectures and two independent runs, anchored on ticket 05's 197.4 ms Worker median. The curve is **ADDITIVE in emitted components, not floor-dominated** -- floor plus the sum of per-component emission costs predicts the all-31 compile to within 2% and 7%. **Ticket 12's *closure* is floor-dominated; *time* is not, and inferring one from the other would have been wrong.** But the additive term is near zero for most components: cost tracks **palette-driven colour math**, not component count and not CSS volume (`off-canvas` emits 8945 bytes for ~10 ms; `badge` emits 479 bytes for ~133-173 ms), and only **19 of Foundation's 35** component partials read any of the six curated globals, with the expensive tier at **6**. `T_worker(N) ~= 58 ms island floor + ~1 ms per partial parsed + 135-210 ms per palette-driven component emitted + 0-20 ms per remaining themeable component`. **The ceiling is the headline: a theme apply over every component the six controls can affect costs ~1.2-1.4 s -- still LESS than the reference project needed for TWO components (1464-1504 ms).** The reference's curve does not transfer, and that is **priced rather than asserted**: per-component islands cost +50% and separate compiles +77% over one shared-island compile at N=20. Pre-compiling the default theme is rejected on **architecture**, not on cost: the reference pre-compiled to fill a hole it created by *suppressing* the library's stylesheets (DI swap + disable sweep + MutationObserver), whereas this addon is **additive** (R008's unlayered overlay), so zero-compile beats cache-hit; it would also construct the Worker at init, fetching ~825 KiB gzip on every story load and destroying D034's lazy split; and the `loading -> ready` window it would supposedly fix measured **1.1 / 0.7 ms**. Persistent caching is excluded by a rule that does not expire: *a cache may not outlive the artifact that determines its contents.* Two prior readings are corrected here: the reference's 20.5% pool gain is an **N=2 artifact** (measured 4.1x by N=20) and must not survive as a law, and "a pool would convert nothing to nothing" is false as stated. The Worker decision itself gets **stronger** with N -- at the full-coverage 1.2-1.4 s apply a main-thread compile would block 72-84 frames. No machinery was built; this row records four considered rejections and the measurements that would reverse three of them.
- **Revisable?:** true
- **Made By:** agent

### D039 -- the library's cross-component RTL strategy (ticket 14)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** How `ngx-foundation-sites` supports RTL/LTR across all Foundation components, given that M003 delivered Button's RTL by rebinding `$global-left`/`$global-right` to `inline-start`/`inline-end`
- **Choice:** **"Extend the rebind" is CLOSED on measurement, not deferred.** The rebind **stays exactly where it is**, inside `internal/_foundation-button.scss`, and must **not** be lifted into a shared partial for future islands to `@use` -- that is the obvious DRY move and it is the trap. **`:dir()` / `[dir]` is RE-OPENED** for the residue; using it later needs **no decision reversal**. CSS custom properties for the transform sign are **not forbidden by D020** and are **also not a separate option** -- a custom property cannot read direction, so it still needs `:dir(rtl) { --nfs-dir: -1 }`; it is a *compression* of the `:dir()` option, decided with it. **A dual build is ruled out by a shipped artifact.** The recommended default for the milestone that adds component #2 is the **HYBRID**: logical properties where verified safe, a small set of `:dir()` overrides for the 8 residue rows, and `$global-text-direction` honoured as the Sass-time escape hatch (D037). The full per-component design is **DEFERRED and is a component-onboarding obligation**: each new island must classify its own `$global-left`/`$global-right` sites against the six-class table before shipping. **M002 forecloses none of this**, and its cost is **zero code plus one README paragraph**.
- **Rationale:** The rebind is **not a general mechanism** -- it is *variable substitution*, where correct logical CSS needs *property-name mapping*. Measured across Foundation's whole tree: **~50 of ~109 interpolation sites are broken by it, in six distinct defect classes, across ~11 components, and every failure is silent** (browsers discard unknown properties and invalid values without error); 36 invalid vs 127 valid declarations in `foundation-everything()`. Button hits **only the two safest classes** (`float:` value and `margin-#{side}`) and passes a literal `down` to `css-triangle` -- which is exactly why R004 is sound for Button and generalises to nothing. Three defect classes went beyond the report that prompted the ticket, including **class-NAME interpolation** (`&.align-#{$global-left}` silently renames Foundation's public `.align-right` class -- *valid CSS that matches nothing*, which no validity oracle can catch) and `css-triangle($size, $color, $global-right)` matching no `@if` branch and emitting a solid square instead of an arrow. The `button-group` radius sites are **LATENT**: 0 invalid declarations at Foundation's defaults, **20** with `$buttongroup-radius-on-each: false` -- so the defect count is a function of **consumer settings** and no fixed-settings gate can bound it (see section 8). M003's `:dir()` rejection was **Button-specific and comparative**, with evidence: D021's Question is scoped to "the button-dropdown arrow"; its `[dir="ltr"]`-never-matches finding rules out rtlcss's `dirAttribute` mode and its wrong-transform finding rules out postcss-logical (both library-wide), but the `:dir()` ground is purely comparative ("a viable runner-up but costs specificity; Foundation's own interpolation hooks cost neither") and that comparison's cheaper arm exists only where the interpolation hooks are in the SAFE classes, i.e. only for Button. D028 adds nothing -- it carries D021 by reference. R004's own **Description** names `$global-text-direction` as the behaviour to match; the "no `:dir()`" phrase sits in its **Validation** field, describing what was built. The dual build is ruled out by `nfs-button.stories.ts`'s `Rtl` story, which renders both directions **in one document** and asserts numeric mirroring -- no dual build can serve it, and ruling it out costs deleting a passing test. Detection is a real gap and is named rather than built: **`verify-foundation-parity.mjs` would not catch the worst class -- it BLESSES it**, mapping `text-align: left -> text-align: inline-start` so its own translation table asserts the invalid form is correct (harmless today, since Button emits no `text-align`); and any gate built on "diff LTR vs RTL output" is structurally blind to selector-swap residue. The missing gate, named for a later milestone: a **CSS validity check using the browser's own CSSOM as oracle** in the existing `test-browser` lane -- authoritative, zero new dependencies, no allowlist to rot. Operates under R004/D021/D028 and reverses none of them.
- **Revisable?:** true
- **Made By:** agent

### D040 -- the Foundation settings-migration surface, and M002's non-foreclosure constraints (ticket 15)

- **When:** M002 wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** What part, if any, of the Foundation settings-migration surface M002 owns, given the BINDING constraint that migrating SCSS settings must be as seamless as possible with `@use` preferred over the legacy global-`!default` idiom
- **Choice:** **M002 owns NOTHING of the Foundation settings API and must not invent one; the settings surface belongs to a dedicated later milestone.** What M002 does own is **seven non-foreclosure constraints** plus one positive documentation obligation: (1) `_theme.scss` stays a **DATA** module -- no `!default` member, and it is **not** the settings entry point; the future settings module is a separate file with its own `exports` key. (2) The addon's six controls are documented as an **addon** surface, never the library's settings vocabulary. (3) The generated entry string reserves an ordered **leading** slot for configuration, empty today. (4) The generator's entry-point arrays stay **data**, and no gate freezes a literal closure file count. (5) M002 does **not touch `internal/_settings.scss`** -- no `!default`, no split, no new members; the addon's six-name defaults probe against it is recorded as a **named seam owned by the settings milestone**, with the variable list living in the generated data module. (6) M002's README documents today's **silent-ignore** as a known limitation. (7) R009's "Foundation global" identity column is **vocabulary, not wiring**, with a footnote that the named globals are provably inert as inputs. **Costs: all zero but constraint 6, which is two README sentences.**
- **Rationale:** Three measured grounds for the scoping verdict. **First**, the surface is unbuildable at today's component count as a structural fact, not a scheduling preference: **481 of Foundation's 490 settings are read only by component partials this library has not wrapped**, only **42** are referenced anywhere in the button chain's real 13-partial closure, and only **6** by `util/` + `_global` alone -- an API designed against 42 names would be validated by exactly one component, which is the expiring-premise error inverted. **Second**, every viable mechanism requires rewriting `internal/_settings.scss`'s 26 deliberate plain assignments into `!default` or map-driven reads, a change to the library's compile-time contract that touches the island's seeding idiom `verify-foundation-parity` gates -- library-milestone work M002 does not do. **Third and decisively**, `@use ... with (...)` is verified viable and verified **LOUD** on unknown names, but applies **exactly once per compilation, before any other load** [VERIFIED three ways, including the realistic case of two consumer partials each configuring], so a half-shipped surface publishes an ordering constraint every later addition inherits. The `@use ... with` tension the map flagged resolves ground by ground: "forces bare Foundation-shaped globals" **APPLIES and INVERTS** (a defect for a theme mixin whose point is that no global is named; the *goal* for a settings module, because a migrator arrives holding exactly those names); "cannot be invoked twice" **APPLIES and bites harder**, but is survivable as "configure once, first, from the entry stylesheet" -- it is Foundation's own legacy requirement, now enforced with an error instead of silence, and it does not touch `theme()` (configured settings plus two scoped `theme()` calls in one compilation is verified to work); "emitted 5490 bytes" **DOES NOT APPLY** -- a settings module emits **0 bytes**. The property nobody costed: under `@use ... with`, an unknown or misspelled name is a **hard compile error with no validation code at all** -- the exact inverse of today's behaviour. **Today's behaviour is SILENT IGNORE, confirmed by probe and named as the worst outcome:** pasting Foundation's entire 490-variable `_settings.scss` below the `@use` compiles **byte-identically** (5839 B) with no warning, even with a value deliberately changed; the same holds for the legacy `@import` route and for hand-declared globals. Two mercies and one extra trap: `theme()`'s four public arguments are airtight (any undeclared argument or `with` clause is a hard error), pasting **above** the `@use` is a hard Sass error, but a typo'd key in the one public map argument silently emits `.button.sucess` plus 932 B of junk CSS. Constraint 1 is mechanical, not aesthetic: **a module consumers READ can never be the module they CONFIGURE**, because reading it loads it and configuring an already-loaded module is a hard error -- so merging the roles would lock the demo app and every README-following consumer out of configuring settings by the act of reading the compliant palette. Constraint 7 rests on a verified general rule: the island pre-seeds derived names non-`!default` before the `@import`s, so Foundation's derivation cascade never fires and `$foundation-palette`, `$primary-color`, `$global-radius`, `$global-font-size`, `$global-margin` and `$global-text-direction` are **all** inert as inputs -- ticket 12's direction finding is one instance of a general rule, not a special case. This decision also **replaces the map's withdrawn Out-of-scope entry** "extending `theme()`'s public Sass API", which justified a *library* API boundary with *what the addon's panel needs*. The narrow claim survives -- M002's addon needs no public Sass API extension -- but it must never bound the library's settings surface.
- **Revisable?:** true
- **Made By:** agent

### One optional split, flagged rather than taken

Research/09 section G.6 recommends recording **R026's stated boundary** as its own
register row, since it is the first time that rule's edge has been drawn. It lives
as clause (f) of D035 above. If the planner would rather it be independently
findable, the lazy split is: keep D035 as-is minus clause (f), and add a **D041**
carrying (f) with scope `anti-feature` and the same `Made By: agent`. (The
previous hand-off proposed D037 for this; D037-D040 are now taken by real
decisions, so the free number is D041.)

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
`settings.$button-background` and `settings.$button-palette`. `$wcag-palette` is
inert data that emits nothing until a consumer passes it -- verified at **0 bytes
on `@use`**. `verify-foundation-parity` compares compiled *declarations* and is
structurally blind to a variable, so it stays green **for the right reason**, not
by luck. It is also inert with respect to the new `_theme.scss`: the gate compiles
a **fixed** three-`@import` reference island rather than globbing, so an
unreferenced new file cannot perturb it. (One unrelated known defect in that gate
is recorded in section 8 -- it must not be propagated into a new gate.)

**Clause 2 -- "A WCAG/axe-compliant theme SHIPS in M002." This is the clause M003
left open, and D033 closes it literally -- and now more strongly than the previous
hand-off claimed.** `$wcag-palette` becomes a member of a **new public Sass
module**, `ngx-foundation-sites/scss/theme`, present in the published tarball's
`scss/_theme.scss` and reachable by any consumer as
`@use 'ngx-foundation-sites/scss/theme' as nfs-theme;` -> `nfs-theme.$wcag-palette`.
"Ships" becomes true of the **artifact**, not of the demo app. The discharge is
**stronger** than under ticket 07's placement, because the palette now ships as a
**theme** artifact rather than as a member of one component's module -- and it
still reaches its axe proof through the real `exports`-gated public subpath in
both CSR and SSR.

**Clause 3 -- "the axe suite runs against that compliant theme", and "an exact
expected-failure assertion, never a blanket suppression."** D036 locks the axe
proof **in place**: the `m002-compliant` fixture in
`apps/nfs-demo/e2e/nfs-button-a11y.spec.ts` stays the proof, unchanged in shape,
and after D033's collapse it scans CSS compiled from the **shipped module** rather
than from a hand-typed app-local copy -- delivered through a real published
tarball over the `exports`-gated public subpath, in **both CSR and SSR**. That is
a stronger discharge than the founding brief anticipated.

Because the compliant theme is now *also* a selectable addon preset, the link
between the preset and the axe proof is made by **identity, not by a second
scanner** -- three assertions chained:

1. Those three hexes clear axe (the existing `m002-compliant` fixture, zero
   violations, CSR + SSR, over the published package).
2. The addon seeds exactly those three hexes -- a lane-1 unit assertion reading
   the preset through the addon's own probe mechanism and comparing it against the
   same literals the fixture proves, plus a WCAG AA ratio computation.
3. Seeding renders them -- one Playwright assertion that the preview's success /
   warning / alert buttons compute to `#238648` / `#9e6c00` / `#cb4b37`.

`@storybook/addon-a11y` is **not** re-pointed, and no axe scan is added to any
Storybook lane.

**The frozen literals -- stated as a constraint, not an implementation note.** The
default theme's three `expectedContrastFailures` entries --
`{alert, #fefefe, #cc4b37}`, `{hollow-success, #3adb76, #ffffff}`,
`{hollow-warning, #ffae00, #ffffff}` at `nfs-button-a11y.spec.ts:67-98` -- are
**FROZEN**. They must **not** be collapsed into `$wcag-palette`, into any shared
map, or into an import. An exact-set assertion has to *name* what it expects;
sourcing its expectations from the same map the code under test uses makes it
assert its input against itself, which is the subtle form of the blanket
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
| **R019** (publishing deferred) | D032 stops at "workspace-local", never at "ship it". Nothing new becomes publishable. Note that D033 does add one `exports` key to the library's *declared* surface -- that is API shape, not a release. | Confirm no addon `package.json`, no release-config neutralisation, and no publish step appears in any slice. |
| **R007** (docs incl. README theming guide, `validated`) | The addon needs one README section, which now also carries D037's direction disclosure and D040's silent-ignore limitation. `verify-autodocs-coverage` is deliberately **not** extended. | Treat the README section as an M002 deliverable; treat the gate extension as out of scope. |
| **R004** (RTL, `validated`) | M002 changes nothing about RTL, but D039 records that R004's mechanism is **Button-specific** and D037 changes `$global-text-direction`'s contract status. | Do not re-open R004. Do carry D039's constraint that the `!global` rebind must not be lifted into a shared partial, and D037's disclosure text into the README deliverable. |

### 5.1 The port-4400 collision -- a change to EXISTING wiring

This is one of two items that modify working targets, so it must be a **named
task**, not a side effect of adding the e2e project.

`test-storybook` currently starts its **own** `static-storybook` on port 4400 via
`concurrently`. The new Playwright project also depends on `static-storybook`, on
the same port. `nx run-many -t e2e,test-storybook` would race two servers onto one
port.

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

`apps/nfs-demo` consumes a **real published tarball**, not the workspace (D014 /
D015, gated by `verify-registry-consumption.mjs`). The installed tarball is a
**snapshot**: adding `$wcag-palette` to source does not reach the demo app.

If `styles.scss` is re-pointed at `nfs-theme.$wcag-palette` without refreshing the
tarball, the demo's Sass compile fails outright -- and it fails in
`nfs-demo:build`, which `serve` / `serve-static` / `serve-ssr` / `serve-ssr-node`
all feed and which `e2e` depends on. **The axe suite would go red for a resolution
reason, not a contrast one.**

**So this is one atomic change with three ordered parts:**

1. Add `$wcag-palette` to the **new**
   `packages/ngx-foundation-sites/src/scss/_theme.scss`, **and** add the
   `"./scss/theme"` key to the library `package.json`'s `exports` map. (This is
   the one part that changed from the previous hand-off -- the file is new and the
   `exports` key is new.)
2. Run `nx run nfs-demo:verify-registry-consumption` (rebuild -> republish ->
   reinstall) and commit the refreshed
   `apps/nfs-demo/.registry-consumption-evidence.txt`. This is already the
   established workflow -- HEAD's `1c1f770` is literally "Captured fresh,
   current-main execution evidence".
3. Re-point `apps/nfs-demo/src/styles.scss:27-34` to
   `@use 'ngx-foundation-sites/scss/theme' as nfs-theme;` +
   `$palette: nfs-theme.$wcag-palette`.

Splitting this across commits leaves a broken demo build in between. Deferring it
to a follow-up is worse: the demo's copy is the **one executable restatement**, so
leaving it uncollapsed defeats D033 entirely.

**There is deliberately no gate for this. The sequencing IS the requirement.**
`verify-registry-consumption` gains no `dependsOn` -- it publishes to a local
Verdaccio and reinstalls, and making it a dependency of `lint` or `e2e` would put
a registry server in the standard battery. It does not need wiring because the
failure it guards is already loud. **Note one side effect of part 1**: adding the
`exports` key invalidates `verify-exports-map` -> `lint` once, which is expected
and requires no config change.

**Carried as [INFERRED]:** that a stale tarball fails `nfs-demo:build` with an
undefined-variable error specifically. The failure is certain; its exact message
was not executed. A missing `exports` key would additionally be a resolution
failure -- though D033's evidence says Angular's importer would find the file
anyway.

### 5.3 A latent library defect the corrections surfaced -- flag, do not fix in M002

The repo's three-`@import` island shape (`util/util`, `global`,
`components/button`) is **under-imported for EMISSION**, not merely for
compilation. `menu` and its relatives need sassy-lists' `sl-remove()` via
`-zf-each-breakpoint-in()`, and `dropdown-menu` / `tooltip` need
`typography/typography` -- Foundation's own `foundation.scss` imports both
preambles. Cost to fix: **+8 ms of floor, once.**

Why it matters to the planner and not to M002's code:

- **It is invisible today.** It fails only when a *second* component's rules are
  actually emitted, and it does so **inside the Worker**, where the diagnostic
  degrades (`isBrowser()` is false there).
- It is **not a compile failure**, it is an emission failure -- so no gate that
  compiles Button alone can see it.
- The trigger is the **2nd themeable module, any tier** -- correctness, not
  performance.
- The same three-`@import` shape is `verify-foundation-parity.mjs`'s fixed
  reference island, so that gate inherits the same insufficiency the moment a
  component beyond Button gets a parity gate.

**M002 action: none in code.** Record it, and carry R021's conditional lane-1
assertion (section 2) so it is asserted the moment it can fire.

---

## 6. Scope rulings, and the map's fog

The map's "Not yet specified" section is **empty and stays empty**. The three
original fog items were closed by ticket 11 and remain closed; the four correction
tickets opened no new fog, because everything they deferred is deferred to a
**named owner** (a later milestone or a component-onboarding obligation), which is
a scope ruling rather than an unknown.

### 6.1 Preset extensibility and persistence -- SPLIT: persistence answered, extensibility out of scope

**Persistence is answered, not open.** Ticket 09 settled it and the answer is
folded into R009 above:

- **The URL is the persistence mechanism.** Control state round-trips through
  `?globals=`. Because the globals value is a sparse canonical-minimal map with
  `initialGlobals.nfsTheme = {}`, the post-reload value is **byte-identical to the
  in-session value** -- the shallow top-level merge that would otherwise be a trap
  becomes the correct semantics, because the object genuinely is the complete
  override set.
- **Story switch is a non-event.** Globals are owned by the Preview and survive
  story navigation, and the single `<style id="nfs-theming">` node is
  document-wide.
- **The hazard the map's fog entry gestured at is real and is mitigated by
  design:** one invalid value drops the **entire theme** from the URL, not just
  its own key. R009 answers it by making the panel the validation boundary, which
  turns the shareable-link guarantee from best-effort into total.
- **No `localStorage` persistence.** Not needed -- the URL already covers reload
  and navigation -- and adding it would create a second state shape that can
  disagree with the URL. Note the independent, stronger reason from D038: *a cache
  may not outlive the artifact that determines its contents*, which rules out
  storage-backed compiled state permanently.

**User-saved presets are OUT OF SCOPE for M002.** They require a storage mechanism
the globals/URL model does not provide, a naming and management UI, and a
collision story against the two shipped presets. Two presets is what D023 requires
and what the destination describes.

### 6.2 Behaviour as more `nfs-*` components land -- ANSWERED, not carried

The previous hand-off carried this as an open question resting on "no second
component exists". **That premise is removed and the question is answered.**

- **The control surface is GLOBAL, and that is correct on merit, not convenience.**
  The six curated variables are **Foundation global concepts**
  (`$foundation-palette` keys plus `$global-radius`), not button properties -- so a
  global surface is the *right* shape and becomes *more* right as components land.
  The addon passes no `$selector` to any themeable module, so each emits under its
  own default selector and the preview rethemes wholesale -- exactly what a
  zero-config consumer's build produces, with zero divergence from what a real
  consumer writes.
- **Adding component #2 to the addon is an array entry, not a rework.** The
  compile call is a `THEMEABLE_MODULES.map()` and the generator unions N closures.
  One compile over two themeable modules emits both selectors and serves the
  Foundation island **once** [VERIFIED]. What is **not** M002 scope is the second
  *component* itself.
- **A component with no theme mixin is simply unaffected.**
- **Performance half, with numbers instead of a premise:** apply cost grows by
  ~135-210 ms per **palette-driven** component and ~0-20 ms per other themeable
  component, with a ceiling of **~1.2-1.4 s at full library coverage** -- less than
  the reference project needed for two components. Only 19 of Foundation's 35
  component partials read any of the six controls, and only 6 are in the expensive
  palette-times-contrast tier. The thresholds that would add a cache, a debounce or
  a pool are tabulated in `research/13-scaling-performance-re-evaluation.md`
  section 8 and summarised in D038.
- **One real correctness trigger at component #2**, not a performance one: the
  island preamble (section 5.3).
- **Per-component control surfaces stay out of scope**, on the merit argument
  above rather than on component count.

### 6.3 Docs surface -- one named deliverable; the gate extension out of scope

- **In scope, named:** one README section in
  `packages/ngx-foundation-sites/README.md` covering the six controls with units
  and ranges, the two presets and the exact-match rule, the URL-sharing guarantee,
  the story-mode-only panel limitation, **`$global-text-direction`'s
  accepted-and-honoured status plus its inert-today disclosure** (D037), and
  **today's silent-ignore behaviour as a known limitation** (D040). Ticket 01
  found the reference project shipped its addon with **zero tests and zero
  documentation** -- there is no pattern to inherit, and that absence is precisely
  what this deliverable avoids repeating.
- **Out of scope, with reason:** extending `verify-autodocs-coverage` to the
  addon. That gate exists to prove Angular component input tables render JSDoc;
  the addon has no Angular component and no autodocs page. Extending a docs gate to
  an undocumented surface is inventing the requirement. A README hex-literal drift
  check is out for the same "documentation drift is not correctness drift" reason
  (section 4).

### 6.4 The Foundation settings API -- OUT OF SCOPE for M002, with a named owner

Per D040: M002 owns **nothing** of it. The ruling replaces the map's withdrawn
Out-of-scope entry, which had justified a *library* API boundary with *what the
addon's panel needs*. What M002 owns is the seven non-foreclosure constraints and
the README limitation. The shape of the question a later settings milestone must
answer is enumerated in `research/15-*.md` section 6 -- eight items, each with its
measured starting input, notably: bare-name `with` vs a single `$settings` map;
what happens to a real Foundation name whose component does not exist yet; and
whether the library restores Foundation's derivation cascade or keeps the flat
pre-seeded names (the most consequential, because it decides whether a migrator's
`$foundation-palette` edit does anything).

### 6.5 Cross-component RTL -- OUT OF SCOPE for M002, with a named owner and an onboarding obligation

Per D039: the full per-component design belongs to the milestone that adds
component #2, and it is a **component-onboarding obligation** -- each new island
classifies its own `$global-left`/`$global-right` sites against the six-class
table before shipping. M002's bill is **zero code plus one README paragraph**.
Three constraints would cost real rework if broken, so they are planner-visible:
do not lift the `!global` rebind into a shared partial; do not copy
`verify-foundation-parity.mjs`'s `PHYSICAL_TO_LOGICAL_VALUE` /
`DIRECTIONAL_VALUE_PROPERTIES` tables into any new gate (the `text-align` entry
**blesses an invalid declaration**); do not narrow or remove the `test-browser`
lane.

### 6.6 Performance machinery -- OUT OF SCOPE, with thresholds instead of premises

Per D038: no cache, no pool, no debounce timer, no pre-compiled default theme, no
persistent cache. Three of the five have measured thresholds; two are rejected
outright rather than deferred. Nothing here rests on component count.

---

## 7. D020 is load-bearing, unusual, and deliberately costed

**Record this so a future reader cannot mistake the unusual path for an
accident.**

D020 is a **standing human decision with `Revisable?: false`**: SCSS variable
theming only, no CSS custom property theming surface. Exactly one theming
mechanism -- Sass variables -- with two places compilation can happen: the
consumer's build, or the browser. **M002 is that second place.** The constraint
forbids the *mechanism*, not the runtime-theming *capability*.

**Scope note added by ticket 14, because it matters for a later milestone:**
every clause of D020 is scoped to the **theming surface**. A CSS custom property
used to carry a *direction sign* for an RTL transform is neither authored nor a
token, so it is **not forbidden by D020** -- though it is also not an independent
option, since a custom property cannot read direction and still needs a `:dir()`
selector to set it (D039). D020 governs theming, not every use of a custom
property.

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

**M002 is deliberately doing what the ecosystem consistently chose not to do. That
is a legitimate design choice, not a mistake -- and it needs its justification
recorded, because the justification is narrow.**

**Where the browser compiler genuinely earns its keep:** it evaluates Foundation's
own Sass colour functions, maps and mixins against user input. Foundation derives
hover colours, text-contrast colours and the dropdown arrow colour via
`scale-color` and `color-pick-contrast`. Ticket 13's measurement **reinforces**
this from a new angle: compile cost tracks **palette colour math specifically**
(`badge` spends 133-173 ms to emit 479 bytes; `off-canvas` spends ~10 ms to emit
8945), so the payload is buying exactly the thing the time is spent on. The case
**would NOT hold for a set of literal pass-through values** -- if the controls were
ever reduced to values that are simply substituted into CSS, the
CSS-custom-property mechanism would be strictly better and D020's cost would be
unearned. That is the condition under which D020 should be revisited, and it is
the only one.

**Two favourable conditions this repo has that Ant Design Pro did not:**

1. **The chain is narrow, and it stays narrow -- now bounded in both size and
   time.** The closure is **floor-dominated**: 12 of the 13 Foundation partials
   are the shared `util/` + `global` floor, so each component's marginal cost is
   roughly one file (0.2-13.7 KiB). All 35 Foundation components come to **52
   files / 212.9 KiB / 46.2 KiB gzip**, and even the absolute
   `foundation-everything()` ceiling stays under ~11% of the `sass` payload. In
   time: **a theme apply over every component the six controls can affect costs
   ~1.2-1.4 s in the Worker -- less than the reference project needed for TWO
   components** -- because only 19 of Foundation's 35 component partials read any
   of the six curated globals and only 6 are in the expensive tier. Ant Design
   Pro's fix (narrow what recompiles) is this repo's starting point.
2. **The "whole page is stuck" failure is measured and eliminated.**
   Main-thread compilation blocks for 337 ms (~20 dropped frames). A single Worker
   takes the max main-thread frame gap to **19.1 ms** and is **~30% faster**
   (197 ms median vs 280-305 ms). **One Worker converts the jank to nothing. A
   pool has nothing to overlap, because the apply is one compile -- and the
   reference's own 20.5% is an N=2 artifact, not a law** (measured pool gain
   reaches 4.1x by N=20 when there *is* something to overlap). The Worker decision
   gets **stronger** with component count: at the full-coverage 1.2-1.4 s apply, a
   main-thread compile would block **72-84 frames**.

**The cost, attributed to the decision that causes it:**

> The **802 KiB gzip / 436 KiB brotli** Dart Sass payload is a cost of **D020**,
> not of the addon's implementation. It is what "no CSS custom properties, ever"
> buys, and it is the price of evaluating Foundation's real Sass functions against
> live input. No implementation choice in M002 reduces it: the sass bundle has
> **zero tree-shaking** (0 exports, 0 imports, 0 `__PURE__` across 133k lines), so
> lazy loading is about *when* the cost lands, not whether it can be reduced.
> Every design decision in this milestone already pushes it as late as possible --
> it is fetched only on first theme interaction, and preview boot stays at
> 1140 KiB gzip.

**Number hygiene, because several figures circulate.** Ticket 03's **~916 KiB
gzip** was a raw-file estimate and is **not** authoritative. Ticket 05's
**802 KiB gzip / 436 KiB brotli** is the measured real bundled `sass` cost and is
the figure to use; the **emitted worker chunk** (sass plus the inlined sources)
lands at roughly **801-825 KiB gzip** today and would reach **~890 KiB gzip** at
full Foundation component coverage. Also note **+70% on the preview's current
1140 KiB gzip** as the relative framing.

**One more inherited clock, stated plainly:** the chain depends on Sass's
`@import` *and* global built-in functions, which are removed together in Dart Sass
3.0.0 (deprecated 1.80.0, floor 2026-10-17, realistically later). M002 inherits
that clock **exactly** -- it adds nothing and reduces nothing, and the Node build
has identical exposure today. One favourable side effect, stated and no further:
the generated sources module *is* the vendored snapshot of whatever closure the
entry-point list reaches -- 16 files today -- so the eventual freeze costs one
deleted target.

---

## 8. The cross-ticket coupling neither ticket owns alone

**A more seamless settings surface activates more latent RTL defects.** This falls
between tickets 14 and 15 and belongs to the planner rather than to either.

The mechanism, both halves measured:

- **Ticket 14:** `button-group`'s 14 rebind sites are **LATENT**. At Foundation's
  default settings they emit **0** invalid declarations; with
  `$buttongroup-radius-on-each: false` they emit **20**. The defect count is a
  **function of consumer settings**, so no fixed-settings gate can bound it.
- **Ticket 15:** the whole point of a seamless settings surface is to let a
  migrating consumer's Foundation settings actually take effect -- today they are
  **silently ignored** (pasting all 490 compiles byte-identically with no
  warning).

Put together: **the settings milestone's success condition is exactly the trigger
for the RTL milestone's latent defect class.** Today's silent ignore is
accidentally suppressing them. Consequences to carry:

1. **Sequencing is a real constraint, not a preference.** A settings surface that
   lands before the cross-component RTL strategy converts a dormant defect class
   into a live one, silently (browsers drop invalid declarations without error).
2. **No fixed-settings gate is sufficient.** Any RTL validity gate must be able to
   run under consumer-supplied settings, or it will certify a component that
   breaks the moment a consumer configures it.
3. **This strengthens D039's constraint** against lifting the `!global` rebind
   into a shared partial: the blast radius is not the ~50 measured sites, it is
   ~50 plus however many latent sites consumers activate.
4. **It also strengthens D040's constraint 5** (do not put `!default` on
   `internal/_settings.scss` names piecemeal): partial configurability would
   activate latent sites with no key validation and no version story.

**M002 action: none in code.** It is a planning input for the two later
milestones, and it must not be lost between them.

---

## 9. Carried forward: what is explicitly NOT verified

Much of this map's value is that its claims were executed. These are the ones that
were not. **Do not let planning promote any of them to settled.**

### Untestable under the effort's no-code-changes constraint

- **`sass` inside the REAL Storybook preview bundle.** A standalone webpack build
  with the verbatim Storybook config, plus static analysis of the real emitted
  bundle, was substituted.
- **Cold HTTP-cache-over-network timing.** Every timing figure is warm-cache and
  local. The first real fetch of the ~802 KiB gzip chunk over a network is
  unmeasured.
- **`build-storybook` with `test: true`.** The `--test` / esbuildMinify branch was
  built standalone and produced byte-identical CSS from a genuinely mangled bundle,
  so it is a **watch item, not a blocker** -- but the real Storybook `--test` path
  was not run, and D036 deliberately adds **no guard** for it.
- **Non-Chromium engines.** Every browser measurement is Chromium. D036
  deliberately excludes non-Chromium browsers from the Playwright lane: a Storybook
  addon's behaviour is not a CSS-engine claim, unlike `nfs-demo`'s
  logical-properties matrix.

### [INFERRED] -- reasoned, not executed

- `import.meta.url` survives `@ngtools/webpack`'s transpile given
  `module: "preserve"`. Strong, and caught by the build-artifact gate if wrong.
- The worker `.ts` entry passes through `@ngtools/webpack`'s loader chain once it
  is inside `.storybook/tsconfig.json`'s `include`. Failure mode is a **hard build
  error**, not silence.
- The real `test-browser` lane (`@nx/angular:unit-test`, `ChromiumHeadless`)
  resolves `sass` the same way the standalone browser-mode probe did.
- `optimizeDeps.include: ['sass']` will be wanted in the browser lane.
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
- Un-debounced `updateGlobals` on every `input` event is acceptable channel
  traffic. Upgrade path named: a 50 ms trailing debounce on the **write** only.
- `data-nfs-seq` is a sufficient readiness signal for every Playwright style
  assertion. Derived from an already-required sequence number; the addon does not
  exist yet to observe it.
- Each themeable module's default selector (`.button` today) has no collisions in
  the preview chrome. Now stated per-module rather than once.
- **The nfs half of the multi-component closure bound** -- ~200 KiB raw /
  ~43 KiB gzip for 35 public wrapper modules, extrapolated from `_button.scss`'s
  measured 12.5 KiB raw at the Foundation half's measured 21.7% gzip ratio. The
  Foundation half is measured; this half cannot be, because the modules do not
  exist. So the "~11% of the `sass` payload" ceiling is part-measured,
  part-inferred; the **measured-only** ceiling is 8.8%.
- That a realistic multi-component architecture keeps **one** shared island rather
  than one per component. Grounded in the island existing to hold Foundation's
  globals as module members; not executed against a real second component.
- That a future component's `theme()` mixin accepts the same
  `$background` / `$palette` / `$radius` argument set. The per-module argument-filter
  seam exists precisely because this is not known.
- That the `THEMEABLE_MODULES`-driven entry string behaves identically inside the
  Worker to the Node probe. Strong -- same string construction, same
  `compileString` -- but the browser/Worker path was not re-executed in that pass.
- **Every browser-Worker figure in ticket 13 is a PROJECTION**, anchored on ticket
  05's measured 197.4 ms, not a direct browser measurement. The nfs wrapper modules
  for 34 of 35 components do not exist, so one series models them with Foundation's
  own component export mixins and another with N emissions of the real
  `_button.scss`. `progress-bar`'s emission cost specifically is `[INFERRED]`.
- The CSSOM validity-oracle mechanics (`setProperty` + read-back) recommended in
  D039. Not executed; the lane's availability is carried from tickets 05 and 10.
- That a custom property cannot read direction without a direction selector.
  Follows from CSS having no direction-valued function; not executed.
- The hybrid RTL strategy's *relative* cost at full component coverage. The
  residue is enumerated (8 rows) and the broken-site count measured (~50), but no
  `:dir()` override set has been written, so its byte cost and specificity impact
  are unmeasured. That is the later milestone's work.

**Graduated OUT of this list:** ticket 07's `exports`-partial-name inference is
now **VERIFIED TRUE** (Node's resolver refuses the partial-name form under the
identity map) -- and separately verified not to bind any consumer in this repo.

### Silently-green failure modes to keep gated

Four failure classes in this design produce **zero errors and zero warnings**.
Each has a gate or a named owner; none of those gates is optional.

1. **The Worker silently not bundled.** If `@storybook/angular` ever spreads
   `cliConfig.module` wholesale, Angular's `worker: false` reaches the config and
   the worker module is not bundled anywhere -- **zero errors, zero warnings**, and
   a runtime 404. Gated by asserting the sources marker appears in exactly one
   emitted chunk.
2. **The R026 carve-out going inert.** A config-dir-relative `ignores` glob is
   exempt under the spec harness and **fires** under Nx's workspace-root cwd:
   green `nx test`, red `nx lint`. Gated per-commit by running the exempt file
   under both path spellings in one process, plus a one-line static assertion that
   every `ignores` glob starts with `**/`.
3. **A green build proving the addon loaded.** An unresolvable addon only warns,
   and a crashing manager entry is swallowed by an esbuild-injected try/catch.
   Gated by the bundle content-match **plus** a Playwright zero-manager-
   `console.error` check.
4. **Invalid CSS the browser silently drops** (D039's six defect classes, and the
   latent-by-settings variant in section 8). **Not gated in M002 and not required
   to be** -- Button emits none of it. The named owner is the milestone that adds
   component #2, and the named mechanism is a CSSOM validity check in the
   `test-browser` lane, which is why that lane must not be narrowed or removed.
   Note the related known defect: `verify-foundation-parity.mjs`'s
   `PHYSICAL_TO_LOGICAL_VALUE` table maps `text-align: left -> inline-start` and
   therefore **blesses an invalid declaration**. Harmless today (Button emits no
   `text-align`); **no M002 code change**; a landmine on reuse.

---

## 10. Application checklist for the consuming session

State-changes that must end up in GSD. Route-agnostic -- apply by whichever
interface is available.

1. **Update R009** -- replace Description and Validation with section 1's text,
   including the three-column control table with its inertness footnote, the
   delivery/mechanism block (`THEMEABLE_MODULES` list, N-entry-point generator,
   ordered config-first entry string, self-tuning coalescer, default theme never
   compiled), the preset model with the corrected global-name probe, the split
   `exports`-map and qualified API-growth claims, the explicit
   `$global-text-direction` exclusion, and the README deliverable including the
   silent-ignore limitation. Status stays `active`.
2. **Update R021** -- replace Description and Validation with section 2's
   four-lane text, including the new lane-1 `_theme.scss`-in-closure assertion,
   the reworded module-agnostic subject framings, the "no literal file count"
   gate rule, the do-not-narrow constraint on `test-browser`, and the conditional
   island-preamble item.
3. **Append D032-D040** to the decisions register, verbatim from section 3, using
   the existing eight-column shape. Append-only; **D032 is the next free number**
   [VERIFIED against `.gsd/DECISIONS.md`, whose highest row is D031]. D033, D034
   and D035 carry the corrected Choice and Rationale text -- do not apply their
   pre-correction forms from the superseded hand-off. Optionally split D035's
   clause (f) into **D041** per section 3's note.
4. **Record the D023 closure** (section 4) wherever M002's milestone context
   lives, including the explicit statement that the default theme's three
   `expectedContrastFailures` literals are **FROZEN**.
5. **Record the D020 costing** (section 7) as milestone context. Do **not** edit
   D020's register row -- it is human, `Revisable?: false`, and append-only.
6. **Carry section 5 into planning as constraints on existing surfaces**,
   especially the two that change working code: the port-4400 refactor of
   `test-storybook` (a named task, not a side effect) and the atomic three-part
   demo-app rewire (one change, three ordered parts, no gate -- and part 1 now
   includes the `exports` key edit, which invalidates `verify-exports-map` ->
   `lint` once). Plus section 5.3's latent island-preamble defect as a flagged,
   no-code-in-M002 item.
7. **Carry section 8's cross-ticket coupling into the ROADMAP**, not just into
   M002: a seamless settings surface activates latent RTL defects, so the two
   later milestones have a real sequencing constraint and no fixed-settings gate
   can bound the defect class.
8. **Carry section 9 forward** so the unverified items stay visible during slice
   design rather than being rediscovered during execution -- including that every
   multi-component performance figure is a projection anchored on one measured
   Worker median.
9. **Record the scope rulings in section 6** (settings API, cross-component RTL,
   performance machinery, user-saved presets, per-component control surfaces,
   `verify-autodocs-coverage` extension) as M002 out-of-scope with their named
   owners, so a later milestone inherits the ruling and its grounds rather than
   re-deriving them.
