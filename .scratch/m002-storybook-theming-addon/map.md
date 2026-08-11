# M002: Storybook theming addon

Label: `wayfinder:map`

## Destination

Every architecture decision M002 needs is **locked with evidence**, and M002's
requirements (R009, R021) are sharpened from one-line wishes into text a GSD
planning pass can decompose into slices. The map ends where GSD milestone
planning picks up.

Two routes into GSD, and the hand-off is written to suit both: the
**`gsd-workflow` MCP tools** (`gsd_plan_milestone`, then `gsd_plan_slice` /
`gsd_plan_task`), which are the only interface available in *this* session; or
the `/gsd ...` slash commands in a later dedicated `gsd` session. The hand-off
states what must end up in GSD, not which route applies it.

The thing being decided: a **Storybook addon that compiles Foundation's Sass in
the browser** (via the `sass` package's browser build, supported since Dart Sass
1.63) and exposes live controls for a curated variable set -- palette colors
(primary / secondary / success / alert / warning) and radius -- so a designer or
developer can retheme without a rebuild.

Done looks like: a preset selector (Foundation default, WCAG-compliant) seeds
the curated controls; controls stay tweakable after seeding; a preset reads as
"selected" only when every control's live value matches that preset exactly.
Verified per R021 with Vitest (compilation / logic) and Playwright (in-Storybook
browser behavior).

**Execution is OUT of scope.** This map produces locked decisions and
requirement text, not built code. GSD owns M002's execution -- it is a `queued`
milestone with 0 slices, and decomposing it belongs to `gsd_plan_milestone`.

## Notes

**Domain.** Angular 22 publishable library in an Nx monorepo (ng-packagr,
`@nx/angular:package`), skinning Foundation for Sites 6.9.0 via its real Sass
mixins. Storybook 10.5 (`@storybook/angular`) is the primary component
dev/test surface, built with **webpack 5** (`@storybook/builder-webpack5`) --
*not* Vite; ticket 03 corrected this premise, and it invalidates any
Vite-specific technique (`?raw`, `import.meta.glob`). `sass ^1.102.0`,
`@playwright/test ^1.37`, `vitest ^4.0.8`, `@storybook/test-runner ^0.24.4` are
already dependencies.

**Verification lanes.** There are **four** (ticket 04 corrected two to three;
ticket 10 added the gate lane): `test` (Vitest, jsdom -- resolves the **Node**
sass build and compiles the real chain there, verified), `test-browser` (Vitest,
real Chromium -- resolves the **browser** sass build, has a real `Worker`, and
is the only Vitest lane with a real cascade, because **jsdom discards `@layer`
rules**), a Playwright lane for anything touching Storybook's manager UI, and
build-time `verify-*.mjs` gates for anything only observable in the emitted
artifact. The axis that matters between the first three is "can it reach the
Storybook **manager**", not "is there a browser".

**BINDING: `ngx-foundation-sites` must support ALL Foundation for Sites
components. Button is merely the FIRST.** Standing user instruction, added
after tickets 01-11 resolved, and it **supersedes any reasoning in this map
that treated "one component" as a premise rather than a snapshot**.

The error class it corrects: several decisions were justified on the repo
having exactly one component -- and they are individually defensible *today*
while encoding an assumption that expires the moment component #2 lands. The
reference project's own measured data (ticket 01, sections C7 and 2.2) shows
precisely what expires: it needed **four stacked mitigations at just TWO
components** (300 ms debounce, compile coalescing, two-level per-component and
combined LRU caching, and pre-compiling the default theme at init), because
per-component compile cost is additive and the slowest component dominates.
This map decided "no debounce, no cache, single worker, no pool" at N=1.

The correction is NOT "build for N components now" -- that would be the
speculative generality this map has rejected throughout, and there is still
only one component to build against. It is the sharper test:

> For each decision, does generalising cost anything **now**? If it is a
> *placement* or *shape* choice that costs nothing today and forces rework
> later, generalise it. If it is *machinery* with real cost and no present
> benefit, do not build it -- but restate the rationale as "one component
> exists today", never "this repo has one component", and keep the seam.

Tickets 12 and 13 carry out that re-evaluation; ticket 11 regenerates the
hand-off from the corrected decisions.

**BINDING: migrating SCSS settings from Foundation for Sites to
`ngx-foundation-sites` must be as SEAMLESS AS POSSIBLE** -- except that modern
Sass modules (`@use`) are preferred over Foundation's legacy global-`!default`
idiom where possible. Standing user instruction, added after ticket 12.

Measured gap: Foundation's `settings/_settings.scss` declares **490 variables**;
`internal/_settings.scss` seeds **26**, privately (`internal/*: null`), and the
public surface is `theme()`'s four arguments. Migration is currently very far
from seamless, and no ticket scoped it.

This also exposes the error class a THIRD time: the Out-of-scope entry
"extending `theme()`'s public Sass API" was justified by *what the addon's
curated control set needs*. A library API boundary must not be set by an addon's
requirements. Corrected below and re-opened as ticket 15.

Note the tension a ticket must reconcile rather than assume away: `@use ...
with (...)` was **measured and rejected** for the theme API (it forced consumers
to type bare Foundation-shaped globals, could not be invoked twice in one
compilation, and emitted 5490 bytes to read one token -- see
`src/scss/_button.scss`'s header). A settings *module* and a theme *mixin* may
legitimately want different mechanisms; "prefer `@use`" is not automatically
"use `@use ... with`".

**No human in the loop.** By explicit user instruction, no ticket may ask the
user to decide. There are therefore no `grilling` tickets. Every ticket is
`research` (including synthesis/decision tickets, resolved AFK), `prototype`
(agent-driven -- the agent builds the artifact and resolves the ticket by
measuring or inspecting it, rather than a human reacting to it), or `task`.

**Decision-locking authorities.** A decision ticket may close on evidence from
any of these alone:

- `.gsd/` artifacts -- `REQUIREMENTS.md`, `DECISIONS.md`, `PROJECT.md`,
  `ROADMAP.md`, `STATE.md`, and `.gsd/phases/`. **Read-only**: these are
  projected from a database. Never write or edit them; use the `gsd-workflow`
  MCP to read canonical state.
- Local clones under `d:/projects/github/<owner>/<repo>` -- notably
  `LayZeeDK/ngx-foundation-sites-next` (the addon R009 names as its reference,
  confirmed present), `foundation/foundation-sites`, `angular/angular`,
  `storybookjs/storybook` if cloned.

**`ngx-foundation-sites-next` shapes REQUIREMENTS ONLY -- no code-copying.**
Standing user instruction, and it binds every ticket that touches the reference.
Read it to answer *what the addon must do and which decisions it had to make* --
which variables were worth exposing, how presets behaved, what went wrong. Do
**not** lift its implementation, file layout, component code, or config into
this repo, and do not let "that is how next did it" stand as an architecture
justification on its own. Findings from it are stated as capability and
constraint, never as a diff to apply.
- Web / GitHub prior art. Explicitly in scope by user instruction: search for
  existing Sass-in-browser Storybook theming addons rather than assuming this
  is unprecedented.

**Fetch fallback chain** for any ticket fetching URLs (try each until one
works): 1. `markdown.new` -- POST JSON `{"url": "<target_url>", "method":
"auto", "retain_images": true}` to `https://markdown.new/`. 2. WebFetch.
3. `node D:\projects\github\LayZeeDK\lz-cybernetics-ai-plugins\tools\url-to-markdown\url-to-markdown.mjs <url> --output <path>`.
4. `playwright-cli`. 5. For known-blocked domains (npmjs.com, code.claude.com,
Cloudflare sites) skip straight to the working tool. Never declare a URL failed
after one method.

**Search tooling.** Never use the Grep tool or `grep`. Use `git grep` for
tracked files, `rg` for anything gitignored (`node_modules/`, `dist/`,
`.nx/`, `.angular/`). Pipe filters are `| rg`, never `| grep`.

### Ground truth from M001 and M003

M002 builds on **M003's** architecture, not M001's. M001's summary is
historically accurate but architecturally superseded -- do not treat its
`key_files` as current.

- **M001 (complete, 15 slices)** delivered the Nx workspace and `NfsButton`,
  styled through a CSS-in-JS runtime loader: `nfs-button.styles.ts`,
  `NfsStyleLoader` (ref-counted), `NfsStyleExtractor` (SSR critical CSS).
  **All of that is deleted.**
- **M003 (complete, 6 slices)** replaced it with a compiled SCSS pipeline:
  Angular's native `styleUrl` + `ViewEncapsulation.None` + `SharedStylesHost`.
  ESLint rule **R026** bans reintroducing CSS-in-JS, with an executable test
  proving the rule fires. RTL is logical-properties-only (no `[dir]`, no
  rtlcss). `verify-exports-map.mjs` is a build-wired Nx gate.

  **CORRECTED by ticket 14:** "logical-properties-only (no `[dir]`, no rtlcss)"
  is accurate as a description of **what M003 built for Button**, and is **not**
  a library-wide prohibition. M003's `:dir()` rejection (D021) is Button-scoped
  and *comparative*; rtlcss and postcss-logical are ruled out library-wide, but
  `:dir()` is re-opened for the residue and needs no decision reversal. The
  `$global-left`/`$global-right` rebind is Button's mechanism, not the
  library's -- it emits invalid CSS at ~50 of ~109 sites elsewhere, silently.

**The public theming API M002 must drive** is
`packages/ngx-foundation-sites/src/scss/_button.scss`, exported as
`ngx-foundation-sites/scss/button`. It is a **theme mixin, not module
configuration**:

```scss
@include nfs-button.theme(
  $selector: '.button',   // scoped/additional theme
  $background: null,      // primary fill; hover derived by Foundation's scale-color
  $palette: null,         // MERGED over defaults; secondary/success/warning/alert
  $radius: null
);
```

The file emits nothing on load, and can be invoked twice in one compilation --
both properties M002's preset/live-tweak model depends on. Its output is
**unlayered on purpose**, so it beats the component's own
`@layer nfs-defaults` default regardless of DOM insertion order (R008).

**The curated control set maps 1:1 onto this existing API** -- primary =
`$background`, the other four = `$palette` keys, plus `$radius`. Confirmed: no
public Sass API extension is needed to build the addon as described.

**QUALIFIED by tickets 12 and 15.** All six are **Foundation globals**
(`$foundation-palette` keys + `$global-radius`) that Button's mixin happens to
consume -- vocabulary, not wiring, since seeding those upstream names is
provably inert. `theme()`'s signature does not grow, and that narrow claim
stands. But M002 does add **one new public Sass data module**,
`ngx-foundation-sites/scss/theme`, for `$wcag-palette` -- so "no exports-map
change" is true of the ADDON and false of M002. And the panel must never be
cited as evidence about the library's settings API.

### Standing constraints M002 inherits

- **D020** (human, standing): SCSS variable theming **only**. No CSS custom
  property theming surface. Exactly one theming mechanism -- Sass variables --
  with two places compilation can happen: the consumer's build, or the browser.
  M002 *is* that second place. The constraint forbids the mechanism, not the
  runtime-theming capability.
- **D023** (human, standing): Foundation's default theme ships unchanged. A
  WCAG/axe-compliant theme **ships in M002**, and the axe suite runs against it
  for its zero-violations proof. The default theme keeps an exact
  expected-failure assertion for its three known shortfalls (alert fill 4.498,
  hollow success 1.799, hollow warning 1.842) -- never a blanket suppression.
- **R008**: consumer-authored theme output must win the cascade over library
  defaults.
- **R019**: publishing `packages/` to npm is deferred -- explicitly not in
  scope for M001 or M002.
- **R026**: no CSS-in-JS. Note the tension worth naming: the addon injects
  browser-compiled CSS through JavaScript. R026 bans a *hand-fed CSS string
  shipped as the component's styling source*; it does not obviously ban a
  dev-only Storybook addon injecting compiled output. Ticket 09 must state
  where that line falls rather than assume it.

### Correction to the founding brief

The brief assumed M002's WCAG preset could be "sourced verbatim from M003's
already-proven compliant theme, no duplicated values." **There is no such
artifact to source from.** M003's compliant theme exists only as a hand-written
invocation in the demo app plus prose in README's Accessibility section:

```scss
// apps/nfs-demo/src/styles.scss:27
@include nfs-button.theme(
  $selector: '.theme-compliant',
  $palette: (success: #238648, warning: #9e6c00, alert: #cb4b37)
);
```

The library ships nothing. So D023's "a compliant theme ships in M002" is
**not** discharged, and M002 must *create* the single source rather than
reference one. That is ticket 07. The duplication is worse than first recorded:
ticket 01 counted the palette restated across **five tracked files**, and found
the reference project carrying *three mutually inconsistent* compliant palettes
at HEAD -- the exact drift ticket 07 exists to prevent.

Note the preset shape this implies: the compliant preset overrides only
success / warning / alert, and inherits Foundation's defaults for primary,
secondary and radius. So "WCAG preset" = "Foundation default preset + 3
overrides" -- expressible in the curated control set, but it means preset
equality checks compare a full resolved control set, not a sparse override map.

## Decisions so far

<!-- one line per closed ticket -->

- [Re-evaluate the performance decisions against N components](issues/13-scaling-performance-re-evaluation.md)
  -- **all four decisions SURVIVE; three of the four rationales do not**, and are
  replaced with measured thresholds. Curve measured across 4 architectures, 2
  runs: **additive in emitted components, NOT floor-dominated** -- ticket 12's
  *closure* is floor-dominated but *time* is not, and inferring one from the
  other would have been wrong. Cost tracks palette colour math, not component
  count or CSS volume (`off-canvas`: 8945 bytes for ~10 ms; `badge`: 479 bytes
  for ~133-173 ms), so the set is bounded by the **controls** -- only 19 of 35
  partials read them. **Ceiling ~1.2-1.4 s for the ENTIRE library, less than the
  reference needed for TWO components.** The reference's 20.5% pool gain is an
  N=2 artifact (measured 4.1x by N=20) but a pool is still rejected on price.
  Caught and discarded its own fake finding -- declaration-order sampling
  reproduced ticket 05's "1.7x regime shift" as an artifact.
- [The Foundation settings migration surface, and what M002 must not foreclose](issues/15-foundation-settings-migration-surface.md)
  -- **M002 owns NOTHING of the settings API; it belongs to a dedicated later
  milestone.** 481 of Foundation's 490 settings are read only by component
  partials this library has not wrapped (only 42 reachable in the button
  closure), so an API designed now would be validated by one component -- the
  expiring premise inverted. `@use ... with` applies **once per compilation,
  before any other load**, so a half-shipped surface publishes an ordering
  constraint every later addition inherits. **Silent ignore confirmed as
  today's behaviour**: pasting Foundation's entire 490-variable settings file
  compiles byte-identically (5839 B) with no warning. Seven non-foreclosure
  constraints, all zero-cost but one (two README sentences) -- notably
  `_theme.scss` must stay a DATA module, since a module consumers READ can never
  be the module they CONFIGURE.
- [How RTL/LTR works across the whole Foundation component set](issues/14-rtl-across-the-component-set.md)
  -- **the rebind is NOT a general mechanism**: invalid CSS at ~50 of ~109
  source sites, SIX defect classes, ~11 components, all silent. Three classes
  went beyond the coordinator's report, including **class-NAME interpolation**
  (`.align-#{$global-left}` silently renames Foundation's public `.align-right`
  -- valid CSS matching nothing, which no validity oracle can catch) and
  `css-triangle` emitting a solid square. `button-group`'s radius defects are
  **LATENT and activated by consumer settings**, so no fixed-settings gate can
  bound them. "Extend the rebind" is CLOSED on measurement; `:dir()` re-opened;
  **dual build ruled out by a shipped artifact** (the `Rtl` story renders both
  directions in ONE document). `$global-text-direction`: **accept and honour**
  -- it composes correctly, reaching only the residue.
- [Correct the single-component ARCHITECTURE assumptions](issues/12-multi-component-architecture-corrections.md)
  -- **total bill for every correction: one new Sass file, one `exports` line,
  one cache invalidation, and wording.** `$wcag-palette` moves to a new
  `src/scss/_theme.scss` exported as `./scss/theme` (ticket 07's cost argument
  did not survive -- Angular's own Sass importer falls back past `exports`
  entirely, which ticket 07 did not know). The compile call becomes a generated
  `THEMEABLE_MODULES` list, one entry today, and **one compile over two modules
  serves the Foundation island once** -- 13 partials, not 26. The generator MUST
  take N entry points today: a single-entry closure is structurally blind to
  `_theme.scss`. Closure re-measured -- the shared floor is 12 of 13 partials,
  so marginal cost per component is ~1 file, and all 35 Foundation components
  come to 46.2 KiB gzip. Tickets 04, 06, 10 verified UNAFFECTED. **Its item 7
  ($global-text-direction "ruled OUT, inert twice over") is SUPERSEDED by ticket
  14** -- correct for Button, wrong forward: direction is IN as a public settings
  entry, OUT only as an addon control.
- [Write M002's locked decisions and sharpened requirements](issues/11-write-m002-requirements.md)
  -- **THE MAP IS CLOSED. [`HANDOFF.md`](HANDOFF.md) REGENERATED** from the
  corrected decision set (06-10 plus corrections 12-15), not patched, and
  route-agnostic throughout. It opens with a **19-row supersession ledger**, and
  **no single-component premise survives as a live rationale anywhere** -- the
  output was grepped for its known phrasings and every hit sits inside the
  ledger marked superseded or false-as-stated ("no second component exists",
  "6 controls and one component", "a pool would convert nothing to nothing").
  Contains: sharpened **R009** (three-column control table -- Foundation global /
  how it reaches Button's mixin today / default / wire format -- with the
  inertness footnote; `THEMEABLE_MODULES` compile call; N-entry-point generator;
  ordered config-first entry string; self-tuning coalescer; default theme never
  compiled; the **split** exports-map claim and **qualified** API-growth claim;
  `$global-text-direction` as a reasoned exclusion; mappable validation);
  sharpened **R021** (four lanes, plus the `_theme.scss`-in-closure assertion,
  module-agnostic subject framings, the no-literal-file-count gate rule, the
  do-not-narrow constraint on `test-browser`, and one conditional
  island-preamble item); **D032-D040** in the register's exact eight-column
  shape (D032 next free, verified against `.gsd/DECISIONS.md`) -- D033/D034/D035
  rewritten, and new **D037** (direction: accept and honour), **D038** (no cache
  / pool / pre-compile), **D039** (cross-component RTL), **D040** (settings
  scoping + seven non-foreclosure constraints); the **D023 closure** clause by
  clause, now a *stronger* discharge, with the three `expectedContrastFailures`
  literals **FROZEN**; touched-but-not-owned requirements
  (R003/R008/R026/R019/R007/**R004**) plus the port-4400 refactor, the atomic
  3-part demo rewire (part 1 now adds the `exports` key), and the latent
  **under-imported island** defect; **D020 recorded as deliberate, costed and
  reinforced** (compile time goes into exactly the palette colour math the
  payload buys); a dedicated section for the **cross-ticket coupling neither T14
  nor T15 owns** -- a more seamless settings surface activates more latent RTL
  defects; and VERIFIED-vs-INFERRED carried forward, including that every
  multi-component performance figure is a **projection** and a **fourth**
  silently-green failure class (browser-dropped invalid CSS, not gated in M002
  and not required to be).
- [What Vitest proves, what Playwright proves](issues/10-r021-verification-design.md)
  -- **LOCKED: four lanes.** The lane boundary moved BOTH ways, measured: `test`
  (jsdom) resolves the **Node** sass build and compiles the real chain to the
  same **sha256 `49bfb1a2e67bf91a`** as ticket 05's producers, so all
  compilation / preset / equality / validation / error-shape assertions land
  there -- but **jsdom DISCARDS `@layer` rules**, making any R008 cascade
  assertion vacuous, so cascade + real `Worker` + the **browser** sass build go
  to `test-browser`. Playwright owns only the manager. Two vacuity traps found
  in the inherited gate design: `iframe.html` has **zero** `<script src=...>`
  (it uses `import './...'`), and the addon bundle index is order-dependent --
  so the new `verify-theming-bundle` globs + content-matches `ADDON_ID` and
  asserts `index.html` **imports** it. **D023's axe proof STAYS in
  `apps/nfs-demo`** (tarball route, CSR+SSR); the preset is bound to it by a
  unit identity assertion, and the default theme's three expected-failure
  literals are frozen. Port 4400 resolved by moving `test-storybook` off
  `concurrently` onto `dependsOn: static-storybook`.
- [Control surface, preset semantics, and CSS injection](issues/09-control-surface-and-state-model.md)
  -- **the Worker spike CLOSED positively** (webpack emits a separate worker
  chunk; Angular's `worker: false` parser option is discarded by Storybook's
  merge), so no fallback is needed. Panel-only; globals hold a **sparse
  canonical-minimal** override map, which makes sparse equality equal resolved
  equality and reduces preset matching to six scalars. One
  `<style id="nfs-theming">` in `document.head`; R008's unlayered cascade win
  verified in real Chromium across all four insertion orders. No debounce timer
  -- a **latest-wins coalescer**. R026 resolved by one `ignores` on the existing
  block, keeping the count at 2.
- [How does Foundation's Sass reach the browser?](issues/08-foundation-sass-into-the-browser.md)
  -- **LOCKED: build-time inlining.** A generator compiles the chain in Node,
  records the URLs its importer served, and emits a **committed** TS data module
  under `.storybook/`, gated by a new `verify-theming-sources` on `lint`.
  Bundler raw imports are *blocked*, not merely worse: Angular's unconditional
  `.scss` rule means `asset/source` returns compiled CSS, not raw Sass. `sass`
  is lazy by construction (worker chunk = split point), so preview boot stays
  1140 KiB gzip. Staleness is caught because the closure is discovered by
  compiling, never hand-enumerated. Amended ticket 06's rule 2 openly, since
  `ngx-foundation-sites/scss/button` is unresolvable from the workspace root.
- [Where does the WCAG-compliant palette live as a single source of truth?](issues/07-compliant-preset-single-source.md)
  -- **LOCKED: `$wcag-palette` as a public Sass map inside the EXISTING
  `scss/_button.scss` entry point**, read by the demo app directly and by the
  addon via a custom Sass function on its `compileString` call (verified to
  return a real `SassMap` on the browser path). No new file, no `exports` key,
  no gate change. The palette turned out to have **one executable instance and
  five descriptions** of it. `internal/*: null` does not block reading
  Foundation's defaults -- Dart Sass ignores `exports` for subpaths. Discharges
  D023 clause 2 literally. Surfaced that `apps/nfs-demo` consumes a real
  published tarball, which makes `ngx-foundation-sites/scss/button` unresolvable
  from the workspace root.
- [Compile the real theme() chain in a browser and measure it](issues/05-compile-the-real-chain-and-measure.md)
  -- **the approach holds, measured in real Chromium.** Output is byte-identical
  across four producers (same sha256); the RTL `!global` rebind survives
  (`margin-left` -> `margin-right` flip from one stylesheet, no `[dir]`); warm
  compile 280-305 ms median, cold 556 ms. The Terser contradiction is settled in
  ticket 03's favour by real-build evidence, and the `--test` branch is harmless
  (byte-identical output even when mangled). **A single Worker is required and
  free**: it removes a 337 ms main-thread block and is ~30% faster (197 ms
  median). Real cost 802 KiB gzip, +70% on the current preview bundle.
- [Workspace-local addon or publishable package?](issues/06-delivery-shape.md)
  -- **LOCKED: workspace-local, resident in
  `packages/ngx-foundation-sites/.storybook/`** with auto-discovered entry
  points. No new package, no `addons: []` wiring, no exports-map or
  `verify-exports-map` change. A separate directory loses on `nx.json` cache
  coupling (`.storybook/**` is excluded from the `production` input; a sibling
  addon dir is not); a package loses on live `workspaces`, R019, stale-cache
  silence, and pushing the ~916 KiB `sass` cost onto consumers. Surfaced two
  onward findings: **R026 actually fires** on the addon's injection code (2
  errors, verified), and the addon-load assertion has a precise bundle target.
- [Prior art: how next themed, and what the ecosystem already built](issues/01-prior-art-next-and-ecosystem.md)
  -- **prior art is thin, and that is the answer**: zero Storybook addons
  compile Sass in the browser, and no first-party design system (Carbon,
  Spectrum, Fluent, Polaris, SLDS) ships a compiler -- all chose the CSS
  custom-property mechanism D020 forbids. The one architectural precedent
  (`storybook-addon-customize-antd-theme`, browser-compiled Less) has been
  stranded since 2021, and Ant Design Pro published why it regretted the
  approach. The reference's worker pool, style-suppression stack and Sass regex
  rewriting are all inapplicable here.
- [Storybook 10 custom addon anatomy](issues/02-storybook-10-addon-anatomy.md)
  -- a workspace-local unpublished addon **can** be wired by relative path
  (verified three ways), so ticket 06's decision is open rather than forced;
  `.storybook/manager.ts` auto-discovery makes the floor 2 files and zero
  config. **Globals** is the confirmed state mechanism, with three constraints
  (undeclared keys silently dropped, shallow merges, URL round-trip rejects
  `0.5rem`). A green build is NOT proof the addon loaded.
- [Dart Sass in the browser: what is actually supported](issues/03-dart-sass-in-the-browser.md)
  -- **feasible, proven by execution**: the real `theme()` chain compiled to 5842
  bytes from a pure in-memory string map on the browser code paths. The importer
  API treats `@import` and `@use` identically (14/17 calls `fromImport: true`,
  all resolved). Costs: ~916 KiB gzip `sass` bundle, 150-215 ms blocking per
  compile, and the Dart Sass 3.0.0 `@import` removal clock is inherited.
- [Running Playwright against Storybook in this Nx workspace](issues/04-playwright-against-storybook.md)
  -- `@storybook/test-runner` **cannot** reach manager-side addon panels (its
  `page` is the preview iframe, proven three ways); R021's Playwright half needs
  a dedicated `@playwright/test` project at `apps/nfs-storybook-e2e/` with
  `dependsOn: ngx-foundation-sites:static-storybook`, zero new dependencies,
  harness proven live in this repo against the real addon-a11y panel.

## Not yet specified

<!-- GRADUATED: "Recompile trigger and loading/error UX" moved into ticket 09
     once ticket 05 measured the latency (280-305 ms warm, worker-backed 197 ms,
     main thread otherwise blocked for 337 ms). It is now specifiable, so it
     lives as part of the control-surface decision rather than as fog. -->
**NOTHING REMAINS. All three items were closed by ticket 11; each is recorded
below with where it landed, so nothing vanished silently.**

**Re-checked after the correction pass (tickets 12-15): still empty.** The four
correction tickets opened no new fog -- everything they deferred is deferred to a
**named owner** (a later milestone, or a component-onboarding obligation), which
is a scope ruling rather than an unknown, and each is recorded under Out of scope
below. One item that could have become fog did not: the latent
under-imported-island defect ticket 13 found is a *flagged, no-code-in-M002*
finding with a named trigger (the 2nd themeable module), carried in `HANDOFF.md`
section 5.3 and as a conditional R021 assertion.

<!-- CLOSED by ticket 11 (HANDOFF.md section 6.1): "Preset extensibility and
     persistence" -- SPLIT. PERSISTENCE IS ANSWERED, reconciled with ticket 09
     rather than treated as untouched: the URL is the mechanism, the sparse
     canonical-minimal map makes post-reload state byte-identical to in-session
     state, globals survive story navigation, and there is no localStorage. The
     "one invalid value drops the ENTIRE theme from ?globals=" hazard is named
     and mitigated by making the panel the validation boundary, which turns the
     shareable-link guarantee from best-effort into total. All folded into R009.
     USER-SAVED PRESETS are ruled out of scope -- see Out of scope below. -->
<!-- CLOSED by ticket 11 (HANDOFF.md section 6.2): "Behavior as more nfs-*
     components land" -- folded into R009 as a stated decision plus a bounded
     open question. The control surface is GLOBAL by decision, not by accident:
     the addon passes no $selector, so it compiles the mixin's default `.button`
     and rethemes everything. Grounds recorded (it is what the addon is for; it
     has zero divergence from what a consumer writes; scoping would need
     story-wrapper machinery that exists only to undo the first ground). A
     component with no theme mixin is simply unaffected. Growing the compile
     call when a second nfs-* theme mixin lands is explicitly NOT M002 scope --
     no second component exists. Per-component control surfaces are ruled out of
     scope below. -->
<!-- CLOSED by ticket 11 (HANDOFF.md section 6.3): "Docs surface" -- folded into
     R009 as ONE named deliverable: a README section covering the six controls
     with units and ranges, the two presets and the exact-match rule, the
     URL-sharing guarantee, and the story-mode-only panel limitation. Extending
     verify-autodocs-coverage to the addon is ruled out of scope below. -->
<!-- Historical note: ticket 01 found the reference project shipped its addon
     with ZERO tests and ZERO documentation, so there is no pattern to inherit
     here -- that absence is precisely what the README deliverable avoids
     repeating. -->

<!-- GRADUATED: "D023's axe obligation under a preset model" is decided by
     ticket 10 -- the axe proof STAYS in apps/nfs-demo (real tarball, CSR+SSR),
     nothing is re-pointed, and the addon's preset is bound to that proof by a
     data-identity unit assertion plus one rendered-colour Playwright
     assertion. The default theme's three expected-failure literals are
     frozen. -->

## Out of scope

- **Publishing the addon (or anything else) to npm** -- R019 defers publishing
  for M001 and M002. Delivery-shape decisions stop at "does it live in a
  publishable directory", never at "ship it".
- **The Foundation settings API** -- out of scope, **ruling RE-MADE on ticket
  15's grounds** after the original entry ("extending `theme()`'s public Sass
  API") was withdrawn for justifying a *library* API boundary with *what the
  addon's control set needs*. M002 owns **NOTHING** of the settings surface; it
  belongs to a dedicated later milestone. Measured grounds: 481 of Foundation's
  490 settings are read only by component partials this library has not wrapped;
  every viable mechanism requires rewriting `internal/_settings.scss`; and
  `@use ... with` applies once per compilation before any other load, so a
  half-shipped surface publishes an ordering constraint every later addition
  inherits. What M002 DOES own is seven non-foreclosure constraints (D040) plus
  one README limitation. The narrow claim survives -- M002's addon needs no
  public Sass API extension -- but it must never bound the library's settings
  surface.
- **Cross-component RTL design** (ticket 14). The full per-component strategy
  belongs to the milestone that adds component #2, and it is a
  *component-onboarding* obligation: each new island classifies its own
  `$global-left`/`$global-right` sites against the six-class table. M002's bill
  is zero code plus one README paragraph. Three constraints would cost real
  rework if broken -- do not lift the `!global` rebind into a shared partial, do
  not copy `verify-foundation-parity.mjs`'s physical-to-logical value tables into
  a new gate, do not narrow or remove the `test-browser` lane.
- **`$global-text-direction` as an addon control** (ticket 14 D3) -- out on
  merit, not omission: mechanically unreachable through the addon's entry, it
  breaks the six-scalar preset equality, and the existing side-by-side `Rtl`
  story already meets the demonstration need better than a preview-wide toggle
  could. It is **IN** as an accepted-and-honoured library *settings* entry
  (D037); out of scope here means out of the panel, not out of the contract.
- **Performance machinery** (ticket 13) -- no cache, no worker pool, no debounce
  timer. Pre-compiling the default theme and any persistent cache are **rejected
  outright rather than deferred**. The other three have measured thresholds
  rather than a component-count premise (see `HANDOFF.md` D038).
- **CSS custom property theming** -- forbidden by D020. Ticket 11 records D020
  as load-bearing, unusual and deliberately costed: no Storybook addon compiles
  Sass in the browser, and every first-party design system surveyed chose this
  forbidden mechanism. See `HANDOFF.md` section 7 for the single condition under
  which D020 should be revisited. **Scope clarified by ticket 14:** every clause
  of D020 is scoped to the *theming surface*, so a custom property carrying an
  RTL transform's direction sign is not forbidden by it -- though it is also not
  an independent option, since something must still set it with `:dir()`.
- **User-saved presets** (ticket 11, closing the "preset extensibility" fog).
  Two presets ship -- Foundation default and WCAG-compliant -- which is what
  D023 requires and what the Destination describes. User-saved presets need a
  storage mechanism the globals/URL model does not provide, plus naming and
  management UI and a collision story against the shipped presets. Persistence
  itself is NOT out of scope -- it is answered (the URL), and folded into R009.
- **Per-component control surfaces** -- STILL out of scope, but the reasoning is
  CORRECTED (see the multi-component constraint in Notes). The original entry
  justified this with "no second component exists", which is exactly the
  expiring premise the constraint forbids. The decision survives on a better
  argument: the curated variables are **Foundation-global concepts**
  (`$foundation-palette` keys and `$global-radius`), not button properties, so a
  global surface is the *correct* shape and becomes more correct as components
  land -- not a shortcut taken because only one exists.

  What that original entry wrongly bundled in, and is now **back in scope** for
  ticket 12: the compile call being hard-wired to `nfs-button.theme()` and the
  `.button` selector with no extension point. That is plumbing, not surface, and
  deferring it was the single-component error.
- **Extending `verify-autodocs-coverage` to the addon** (ticket 11, closing the
  "docs surface" fog, and consistent with ticket 10 section 6.3). That gate
  proves Angular component input tables render JSDoc; the addon has no component
  and no autodocs page. Extending a docs gate to an undocumented surface invents
  the requirement. A README hex-literal drift check is out for the same reason:
  documentation drift is not correctness drift, and the axe fixture is the real
  gate.
- **Building M002.** GSD owns execution. This map hands off to GSD milestone
  planning, by whichever route the consuming session has available.
