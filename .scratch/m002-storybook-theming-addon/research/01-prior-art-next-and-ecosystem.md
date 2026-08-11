# Findings: prior art -- `ngx-foundation-sites-next` and the wider ecosystem

Ticket: `.scratch/m002-storybook-theming-addon/issues/01-prior-art-next-and-ecosystem.md`
Status: resolved
Method, three independent passes:
1. Read the local clone at `d:/projects/github/LayZeeDK/ngx-foundation-sites-next`
   (HEAD `85f21b1`, 2026-01-07) -- source, commit messages, and its two planning
   documents.
2. Direct inspection of THIS repo's own `node_modules/sass@1.102.0`,
   `node_modules/storybook@10.5.6`, `package-lock.json` and `src/scss` graph, so
   the Sass and Storybook claims rest on installed artefacts rather than on the
   reference's assertions.
3. Web / GitHub / npm prior-art search (section 4), including `gh api
   search/code`, the npm registry, storybook.js.org docs and the dart-sass
   README/CHANGELOG.

**Binding constraint honoured.** `ngx-foundation-sites-next` is read as
REQUIREMENTS ONLY. Everything below is stated as a capability the addon must
have, a decision this map still owes, or a trap. No file layout, component code
or config from that repo is proposed for adoption, and no finding rests on
"next did it that way".

---

## 0. Answering the ticket's question 1 directly

| Ticket sub-question | Answer (verified) |
| --- | --- |
| Which Sass variables were live controls? | ~56, across 7 sections: brand palette (5), global colors (7), typography (7), spacing (4), layout (3), accordion (13), button (19). Source: `packages/ngx-foundation-sites/.storybook/addons/theme-panel/types.ts` (the `ThemeState` interface) and `src/storybook/theme-defaults.ts:484` (`VARIABLE_SECTIONS`). |
| Why those? | They are the union of Foundation's documented global Sass reference and each component's Sass reference. `types.ts` cites `get.foundation/sites/docs/global.html`, `.../accordion.html#sass-reference` and `.../button.html#sass-reference` per section. There is no evidence of curation beyond "expose what Foundation documents". |
| Presets? | Yes -- `PALETTE_PRESETS` in `src/storybook/theme-defaults.ts:80`. 10+ entries: `foundation-wcag` (the default), `foundation-original`, Bootstrap 5, Material Design 3, Tailwind, Bulma, Chakra, Ant Design, Evergreen, Fluent. Presets cover the 5 palette colors ONLY -- never radius, spacing, typography or component variables. |
| Preset-vs-custom state? | No stored "selected preset" field. The dropdown DERIVES its selection by comparing all 5 live palette values against every preset and falling back to a literal `'custom'` option: `PaletteSelectorControl.tsx:93-103`. Selecting `custom` is a no-op (`:107-110`). |
| Where did compilation happen? | Browser, in a Web Worker pool -- one worker per component -- using `compileStringAsync` (`src/storybook/sass-compiler.worker.ts:486`). Dart Sass itself is pre-bundled at BUILD time by esbuild into a static asset (`tools/bundle-sass-compiler.mjs` -> `.storybook/static/sass-browser.mjs`), and the Sass SOURCES are pre-bundled at build time into a generated TS module (`tools/bundle-sass-sources.mjs` -> `src/storybook/generated/sass-bundle.ts`). Both are cached Nx targets (`project.json`, targets `bundle-sass`, `bundle-sass-compiler`). |
| Delivery shape? | **Workspace-local Storybook config, not a published package.** The addon is `packages/ngx-foundation-sites/.storybook/addons/theme-panel/`, registered by absolute path via a local preset: `main.ts:12` does `join(__dirname, 'addons/theme-panel/preset.js')`. `preset.js` exports only `managerEntries`. Nothing in `ng-package.json`/`project.json` publishes it. |
| Visibly unfinished / worked around? | See section 4 (Traps) and section 5 (what the reference never finished). Headline gaps: **zero automated test coverage of the addon**, **zero README/AGENTS documentation of it**, and **three mutually inconsistent "WCAG-compliant palettes"** inside one repo. |

---

## 1. Capabilities the addon must have

Each item is something the reference proved was NECESSARY (not merely something
it built), or something this repo's own artefacts force.

### C1. Ship Dart Sass to the browser as a pre-bundled artefact, not a bare import

VERIFIED against this repo's own dependency, not inferred from the reference:
`node_modules/sass/package.json` (v1.102.0) has no `browser` field; its
non-`node` export condition resolves to `sass.default.js` / `sass.default.cjs`.
`sass.default.js` begins with a bare specifier import:

```js
import * as immutable from "immutable"
import "./sass.dart.js";
```

So the browser build is a thin ESM wrapper over a 5.67 MB `sass.dart.js` plus an
unresolved bare specifier. It cannot be loaded by a plain
`<script type="module">`, a blob URL, or a raw `import()` of the package path --
a bundler (or an import map) must resolve `immutable` first. The addon therefore
needs a build step that produces one self-contained module.

Second constraint from the same file: `sass.dart.js` contains `process.stdout`
(2 occurrences) and `isTTY` -- VERIFIED in `sass@1.102.0`. The reference hit this
and recorded it (`SASS_OPTIMIZATION_PLAN.md:920-970`): the default
`esbuild-plugin-polyfill-node` process polyfill defines `process.stdout` as
`undefined` with `configurable: false`, producing
`TypeError: Cannot read properties of undefined (reading 'get$isTTY')`. Its
recorded fix was to disable the plugin's `process` polyfill and supply TTY stubs
before re-exporting `sass`.

**Reconciliation, because this matters and the two sources disagree in tone.**
Upstream dart-sass [#2113](https://github.com/sass/dart-sass/issues/2113) is the
same probe, and the CHANGELOG says it was fixed in **1.69.2** ("Fix a bug where
Sass crashed when running in the browser if there was a global variable named
`process`"). This repo pins 1.102.0, well past that. The reference loaded Sass
from the JSPM CDN at the time and may have been on an older build. So the honest
statement is: the probe is still present in the shipped code, upstream claims to
tolerate a stray `process` global since 1.69.2, and the remaining risk is a
bundler that *defines a non-conformant* `process` rather than leaving it absent.
That risk is live for this repo specifically -- `@storybook/angular@10.5.7` uses
`@storybook/builder-webpack5`, whose preview config runs
`new DefinePlugin({'process.env': ...})`
([iframe-webpack.config.ts](https://github.com/storybookjs/storybook/blob/next/code/builders/builder-webpack5/src/preview/iframe-webpack.config.ts)).
Treat it as a spike item for ticket 03, not a settled failure.

Third constraint, unique to a webpack builder and NOT something the reference had
to deal with: dart-sass's README states the browser build "is compatible with all
major web bundlers **as long as you disable renaming** (such as `--keep-names` in
esbuild)"
([dart-sass README](https://github.com/sass/dart-sass/blob/main/README.md#dart-sass-in-the-browser)).
The webpack/Terser equivalent is `keep_fnames` + `keep_classnames`. The reference
never hit this because it bundled with esbuild out-of-band and served the result
as a static asset. If this repo instead imports `sass` through Storybook's own
webpack preview build, Terser mangling is an unmitigated risk. **This is the
single highest-risk unknown in M002 and should be spiked before anything else.**

Measured cost in the reference, for calibration only (their bundle, their
Foundation subset, their machine): bundle ~3.1 MB; module load ~145-150 ms;
worker-pool init ~177 ms (`SASS_OPTIMIZATION_PLAN.md:980-1001`).

### C2. Supply every Sass source as a string through a custom importer

Browser Sass has no filesystem. The reference built a synthetic URL scheme
(`nfs-bundle:`) with `canonicalize`/`load` over a build-generated
`Record<string, string>` of file contents, and had to hand-implement relative
resolution from `containingUrl` (`sass-compiler.worker.ts:245-308`). It also had
to explicitly return `null` for `sass:` specifiers so Sass's own built-in modules
still resolve.

**This repo's graph is far smaller than the reference's 18-file bundle.** The
whole `theme()` chain is 3 library files plus 3 Foundation entry points:

- `packages/ngx-foundation-sites/src/scss/_button.scss` -> `@use 'internal/foundation-button'`, `@use 'internal/settings'`, `@use 'sass:map'`
- `.../src/scss/internal/_foundation-button.scss` -> `@use 'settings'`, then `@import 'foundation-sites/scss/util/util'`, `'foundation-sites/scss/global'`, `'foundation-sites/scss/components/button'`
- `.../src/scss/internal/_settings.scss`

(verified: `git grep -n "@use \|@import \|@forward " -- packages/ngx-foundation-sites/src/scss`)

Notably the reference's own optimisation pass converged on those SAME three
Foundation entry points after measuring that importing all of
`foundation-sites/scss/foundation` cost 70+ files
(`SASS_OPTIMIZATION_PLAN.md:43-76`, measured 17.6-54.2% compile-time reduction).
This repo already starts where the reference finished. Ticket 08 owns the
mechanism.

### C3. Generate SCSS that drives the PUBLIC theming API, not bare globals

This is where the reference's requirement and this repo's architecture diverge
hardest, and it is a genuine capability statement, not a style preference.

The reference's worker string-templates ~80 lines of BARE Foundation globals
(`$foundation-palette: (...)`, `$button-background: ...`,
`$global-text-direction: ...`) in front of `@import '<component>'`
(`sass-compiler.worker.ts:369-467`). That works because its library stylesheets
consume Foundation's `!default` globals directly.

This repo deliberately closed that door. `packages/ngx-foundation-sites/src/scss/_button.scss:21-25`
records the ticket-06 decision verbatim: `@use ... with (...)` "forced the
consumer to type bare Foundation-shaped globals, could not be used twice in one
compilation even with byte-identical values, and emitted 5490 bytes of unwanted
rules just to read one token". The public API is a mixin with exactly four
parameters (`_button.scss:58-63`): `$selector`, `$background`, `$palette`,
`$radius`.

Consequence -- capability, not preference: **the addon's generated SCSS is a
`@use` + `@include nfs-button.theme(...)` invocation of a handful of lines**, not
a globals preamble. Two things fall out of that for free:

1. The "copy/export this theme" feature the reference shipped
   (`ThemePanel.tsx:318-339`, `generateScssExport` at `theme-defaults.ts:1204`)
   becomes trivially faithful here: the string the addon compiles IS the string
   the consumer pastes. In the reference those were two separate code paths
   (`buildScssSource` in the worker vs `generateScssExport` in the panel) that
   could drift.
2. `theme()` "emits nothing on load and can be invoked twice in one compilation"
   (`_button.scss:17-25`) means the addon can compile a preset and a live tweak
   in one pass without the module-configuration collision the reference never
   had to face.

### C4. A curated control set is enough -- and the reference's breadth is a warning, not a target

The reference exposed ~56 controls. R009's curated set is 6 (5 palette colors +
radius) and the map already confirms it maps 1:1 onto `theme()`'s existing
parameters. Nothing in the reference argues the extra 50 were needed: the
palette presets -- the reference's own headline feature -- touch **only the 5
palette colors**, and its measured caching work was all keyed on
component-scoped subsets of state. The breadth is what forced its
variable-to-component dependency map, its per-component cache-key hashing and
its 12 bespoke control widgets.

Capability: the addon needs exactly the control types the curated set implies --
a color input (x5) and a length input (x1) -- plus a preset selector.

### C5. Cross-process state: manager panel <-> preview iframe

The panel UI runs in the Storybook MANAGER; the story renders in the PREVIEW
iframe. The reference carried theme state in Storybook **globals**
(`constants.ts:12` `THEME_STATE_KEY = 'nfsThemeState'`; seeded via
`preview.ts:72-75` `initialGlobals`; read in the panel via `useGlobals()` at
`ThemePanel.tsx:242` and in a preview decorator via `context.globals[...]` at
`preview.ts:91-97`), and used the addon channel only for transient compile
status (`constants.ts:15-24`: `COMPILE_START` / `COMPILE_END`, consumed by
`useChannel` at `ThemePanel.tsx:250-253`).

That split -- durable state on globals, ephemeral progress on the channel -- is a
capability the addon needs either way. Ticket 02 owns the mechanism; ticket 09
owns the state model.

VERIFIED for this repo: authoring a manager panel needs no new declared
dependency. `storybook@10.5.6` is installed and exports `./manager-api`,
`./theming` and `./preview-api`; `react@19.2.8` and `@storybook/icons` are
already in the tree transitively. `package.json` declares no React -- the
reference's `package.json` didn't either, and it set `"jsx": "react-jsx"` in its
`.storybook/tsconfig.json` to compile `.tsx` panel files. That is a real
undeclared-peer risk worth naming (see T7).

### C6. Compiled CSS must be injected so it BEATS the component's own stylesheet

The reference needed three separate mechanisms and still called it a race
condition it had to fix after the fact (commit `e0671e5`,
"ensure runtime theme CSS applies before rendering"):

1. a DI swap replacing the production style loader with a Storybook one that
   creates `<link>` elements pre-`disabled` when runtime theming is active
   (`src/storybook/nfs-storybook-style-loader.ts:79-83`),
2. an imperative sweep disabling already-present `link[id^="nfs-style"]`
   (`runtime-theme-injector.ts:181-187`), and
3. a `MutationObserver` on `document.head` to catch stylesheets added LATER by
   lazily-rendered components (`runtime-theme-injector.ts:193-212`).

Root cause it recorded: "same specificity, but loaded later" -- pure
DOM-order cascade.

**This repo's problem is structurally different and probably easier**, which is
exactly why the reference must not be copied here: M003 puts the library's own
rules in `@layer nfs-defaults` and emits `theme()` output UNLAYERED on purpose,
so consumer theme output wins "regardless of DOM insertion order" (R008;
`_button.scss:27-31`). An unlayered `<style>` injected by the addon should
already beat `@layer nfs-defaults` by cascade-layer precedence, with no
disabling, no observer, and no DI swap. That is a hypothesis this map should
CHECK (ticket 09 / ticket 05), not assume -- but if it holds, the single largest
chunk of the reference's complexity does not transfer.

### C7. Compilation is slow enough that the UI must manage it explicitly

Measured in the reference (its subset, its machine -- treat as an order of
magnitude, not a target):

| Measurement | Value | Source |
| --- | --- | --- |
| Dart Sass module load (local bundle) | ~145-150 ms | `SASS_OPTIMIZATION_PLAN.md:980` |
| Worker pool init | ~177 ms | same |
| accordion compile | ~500-570 ms | `SASS_OPTIMIZATION_PLAN.md:998`, `:611-614` |
| button compile | ~1359-1655 ms | `SASS_OPTIMIZATION_PLAN.md:999`, `:616-619` |
| Full 2-component theme apply | ~1464-1504 ms avg | `SASS_OPTIMIZATION_PLAN.md:484`, `:1000` |
| In-memory cache hit | ~1 ms | `SASS_OPTIMIZATION_PLAN.md:229` |

**Button was the slow one** (~1.3-1.6 s), and this repo's only component IS the
button. So a naive implementation here plausibly lands near the reference's
worst case, not its best. The reference needed FOUR stacked mitigations to make
that tolerable:

- 300 ms input debounce in the panel (`constants.ts:27`),
- compilation coalescing so overlapping requests collapse to latest-wins
  (`runtime-theme-injector.ts:474-507`),
- two-level LRU caching, per-component and combined (`runtime-theme-injector.ts:74-82`),
- pre-compiling the default theme during init so first paint is a cache hit
  (`runtime-theme-injector.ts:600-627`).

Capability: the addon needs a visible in-progress state (the reference used a
spinner plus "Compiling Sass..." text, `ThemePanel.tsx:490-495`) and at minimum a
debounce. Whether it needs a worker at all is ticket 05's measurement to make --
with one component and a 6-file graph the number may be much smaller than the
reference's. Do not import the worker pool as a premise.

### C8. Preset equality must be computed from live values

The reference derives "which preset is selected" by comparing every live palette
value against every preset and falling back to `'custom'`
(`PaletteSelectorControl.tsx:93-103`). That is exactly the semantics this map's
Destination already states ("a preset reads as 'selected' only when every
control's live value matches that preset exactly"), and it is the semantics the
map's own founding-brief correction requires: because the compliant preset is
"Foundation default + 3 overrides", equality must compare a fully RESOLVED
control set, never a sparse override map.

Independent confirmation of that resolved-set requirement: the reference's
presets are full 5-color objects, never partials -- including `foundation-wcag`,
which restates `primary`/`secondary` identically to `foundation-original`
(`theme-defaults.ts:83-105`).

### C9. Deterministic readiness for a11y/axe runs

The reference's a11y suite failed until it added a Storybook `loaders` entry that
awaits a `waitForInitialTheme()` promise before ANY story renders
(`preview.ts:49-56`; promise at `runtime-theme-injector.ts:109-117, 579-581`),
with `a11y.test: 'error'` failing CI on violations (`preview.ts:126-137`).

This is the map's open question "what D023's 'the axe suite runs against the
compliant theme' means once the compliant theme is a selectable preset" in its
concrete form: **once CSS arrives asynchronously, every style-dependent
assertion needs an explicit readiness gate.** The reference paid for this twice
-- besides the loader, its story `play` functions had to wrap computed-style
assertions in `waitFor(..., { timeout: 5000 })`
(`src/lib/accordion/accordion.stories.ts:77-87`, `:859-868`).

---

## 2. Decisions this map still has to make

Prior art narrows these but does not settle them. Each names the ticket that
owns it where one exists.

1. **Does the cascade-layer argument (C6) actually remove the need for style
   suppression?** The reference needed a DI swap + a MutationObserver; M003's
   layered/unlayered split suggests this repo needs neither. Must be measured,
   not assumed. -> ticket 09, evidence from ticket 05.
2. **Worker or main thread?** The reference went worker-pool-per-component, then
   measured only a 20.5% end-to-end gain (1842 ms -> 1464 ms) because the slowest
   component dominates (`SASS_OPTIMIZATION_PLAN.md:480-500`). With ONE component
   a pool has no parallelism to exploit at all -- the only remaining argument for
   a worker is not blocking the main thread for ~1 s. -> ticket 05 measures, then
   this map decides.
3. **How much caching is warranted?** The reference ended with in-memory LRU +
   IndexedDB + a manually-incremented `CACHE_VERSION` string
   (`theme-cache-db.ts:42`). That version counter is a maintenance liability (T3).
   With 6 controls and one component the cache key space is tiny; a plain Map may
   be the whole answer.
4. **Preset extensibility and persistence.** The reference persisted state only
   incidentally via Storybook's URL globals, and that leaked a real bug (T1). It
   never offered user-saved presets. This map's "Not yet specified" entry stands
   unresolved by prior art. -> ticket 09.
5. **Delivery shape.** The reference is 100% workspace-local, wired by
   `join(__dirname, ...)` in `main.ts`, with no publish path. R019 defers
   publishing anyway, so prior art supplies no counter-example -- but it also
   supplies no evidence that a publishable shape was ever attempted and
   rejected. -> ticket 06 (which is blocked by this ticket; this is its input).
6. **RTL.** The reference exposed `$global-text-direction` as a live control and
   had to keep panel state and toolbar global bidirectionally in sync
   (commits `ca20a7d`, `4d35d17`; `ThemePanel.tsx:260-272, 341-356`), and its
   RTL story assertion needed a 5 s `waitFor`. This repo's RTL is
   logical-properties-only with no `[dir]` and no rtlcss (M003), and direction is
   NOT in the curated control set. Confirm that RTL simply falls out of scope
   here rather than inheriting the reference's sync problem.
7. **Which axe target.** D023 says the compliant theme gets the zero-violations
   proof while the default keeps its exact expected-failure assertion (alert fill
   4.498, hollow success 1.799, hollow warning 1.842). Once both are selectable
   presets in one Storybook, decide whether that is two stories, two globals
   values, or a test-runner-level switch. Prior art does not answer this -- the
   reference had exactly one default and made it the compliant one.
8. **Does Terser mangling break the Dart Sass browser build under Storybook's
   webpack5 preview builder?** dart-sass requires renaming to be disabled
   (`--keep-names` in esbuild terms). The reference sidestepped this entirely by
   bundling with esbuild out-of-band and serving a static asset, so it offers no
   evidence either way. **This is the highest-risk unknown in M002** and should
   be spiked first -- if it fails, the out-of-band-bundle shape is forced.
   -> ticket 03, before ticket 05.
9. **Sync `compileString` on a worker, or async on the main thread?** The browser
   build exports both, plus `initCompiler`/`Compiler` for reusing a compiler
   across recompiles. dart-sass documents `compileAsync()` as "substantially
   slower" than sync. So the fastest arrangement is sync-inside-a-worker, and the
   simplest is async-on-main. -> ticket 05 measures; ticket 02 owns the wiring.
10. **What "customised" looks like in the UI.** Three shipped patterns: a fake
    `Custom` dropdown entry (the reference, Polaris, Carbon), an explicit `Auto`
    entry whose value is `''` (Spectrum), or keep the preset selected and show an
    "N Changes" dirty counter with per-control Reset (Ant Design v5). All three
    satisfy this map's stated equality rule. Pick deliberately. -> ticket 09.

---

## 3. Traps to avoid

### T1. Storybook globals round-trip through the URL and come back PARTIAL

Verified: commit `bd522a2`, "restore theme state correctly after page refresh".
Recorded root cause: "Storybook's URL globals restoration creates partial objects
with undefined values for unchanged properties, causing compilation errors." The
fix was a hand-written 140-line deep merge
(`theme-defaults.ts:1043-1195` `mergeWithDefaults`), called defensively in BOTH
the panel (`ThemePanel.tsx:255-258`) and the preview decorator
(`preview.ts:89-93`).

Why it matters here even with 6 controls: an `undefined` reaching the generated
SCSS interpolates as the literal string `undefined` and produces a Sass error at
runtime, in the browser, with no build to catch it. Any state read from globals
must be normalised against defaults at every read site.

### T2. A CDN-delivered Sass forces you to rewrite Foundation's source

The reference's `tools/bundle-sass-sources.mjs:132-246` regex-rewrites Foundation
`.scss` before bundling: `round(` -> `math.round(`, `red(` -> `color.red(`,
`color.channel($c,"red",$space:rgb)` -> `color.red($c)`, plus injecting
`@use "sass:math"` / `@use "sass:color"` at a computed insertion point. Its own
comment names the cause: "The JSPM CDN's Sass build has removed deprecated global
functions... JSPM CDN may serve an older version". It ALSO hand-implemented
`round`, `ceil`, `floor`, `abs`, `percentage`, `red`, `green`, `blue`, `alpha`,
`opacity` as custom Sass `functions` passed to every compile
(`sass-compiler.worker.ts:322-360`).

This is a self-inflicted trap, and this repo can skip all of it. VERIFIED: this
repo already compiles the same Foundation 6.9 with the pinned `sass@1.102.0` and
NO shims and NO source rewriting -- just `--quiet-deps`
(`packages/ngx-foundation-sites/project.json:36`) and, in the parity harness,
`quietDeps: true` + `sass.Logger.silent`
(`packages/ngx-foundation-sites/scripts/verify-foundation-parity.mjs:176-190`).
Bundling the workspace's own pinned `sass` rather than fetching one from a CDN
keeps that property. Regex-rewriting a vendored framework's Sass is a
maintenance bomb; do not adopt it.

Related recorded dead end, same root cause: caching the CDN module in IndexedDB
was tried and CANCELLED because a blob URL breaks the module's internal
specifiers -- `TypeError: Failed to resolve module specifier "/npm:immutable@4"`
(`SASS_OPTIMIZATION_PLAN.md:724-766`). That is the same unresolved `immutable`
import I verified in `sass.default.js` (C1). A Service Worker cache was built for
the same problem and then REMOVED as redundant once the bundle went local
(`SASS_OPTIMIZATION_PLAN.md:865-898`). Two abandoned subsystems, both downstream
of "load Sass from a CDN".

### T3. A hand-maintained cache-version string is drift waiting to happen

`src/storybook/theme-cache-db.ts:31-42` documents a `CACHE_VERSION` that reached
`'v5'`, with a changelog including "`v2 -> v3`: WCAG-compliant default palette
(`#0c5f91` replaces `#1779ba`)" and "`v4 -> v5`: Adjusted WCAG palette to barely
exceed 4.5:1 minimum (`#146ba5` etc.)". Persisting compiled CSS across sessions
means every change to Sass sources or defaults silently serves stale CSS unless a
human remembers to bump a constant. Only take on persistent caching if ticket 05
proves it is needed.

### T4. The "single compliant theme" fragmented in the reference -- and is already fragmenting here

Three DIFFERENT palettes all described as WCAG-compliant coexist in the reference
at HEAD:

- `src/storybook/_nfs-settings.scss:24-30`: `#0d5a89`, `#595959`, `#1a7f3e`, `#8a6500`, `#a33a2a`
- `src/storybook/theme-defaults.ts:65-71` (`DEFAULT_PALETTE`, also the `foundation-wcag` preset): `#146ba5`, `#666666`, `#16763a`, `#8a5e00`, `#b3402e`
- `theme-cache-db.ts:38` records a third, superseded `#0c5f91`

This directly corroborates the map's founding-brief correction. In THIS repo the
compliant palette (`#238648` / `#9e6c00` / `#cb4b37`) is already restated in five
tracked files -- `apps/nfs-demo/src/styles.scss`,
`apps/nfs-demo/src/app/app.component.ts`, `apps/nfs-demo/e2e/nfs-button-a11y.spec.ts`,
`packages/ngx-foundation-sites/README.md`,
`packages/ngx-foundation-sites/src/scss/_button.scss` (verified via
`git grep -c` on the three hex values). Ticket 07 must create ONE source and
re-point all five, or M002 ships the same fragmentation the reference shipped.

### T5. The reference shipped the addon with ZERO tests and ZERO docs

Verified by exhaustive search of the clone:

- `git grep -n -i "theme" -- "*.spec.ts"` -> no matches. No unit test of the
  compiler, the importer, `mergeWithDefaults`, `generateScssExport`, preset
  matching, the LRU cache, or the coalescing loop. The two e2e specs that mention
  theming (`apps/consumer-test-app-e2e/src/consumer-sass-theming.spec.ts`,
  `packages/ngx-foundation-sites-e2e/src/consumer-theming.spec.ts`) test
  CONSUMER build-time theming, not the addon.
- `git grep -n -i "theming\|theme" -- README.md AGENTS.md` -> no matches in
  README at all; one unrelated hit in AGENTS.md. The whole subsystem is
  undocumented.

The correctness evidence that does exist is prose in two ad-hoc planning
documents (`SASS_OPTIMIZATION_PLAN.md`, `SASS_CHANGE_DETECTION_PLAN.md`) with
manual "Verification" checklists. R021 explicitly requires Vitest for
compilation/logic and Playwright for in-Storybook behaviour, so this repo must do
better -- and the reference offers no test patterns to reuse. Note that this
repo already has a Node-side `sass.compileString(..., { loadPaths, quietDeps })`
harness in `packages/ngx-foundation-sites/scripts/verify-foundation-parity.mjs:176-190`
that Vitest can follow for the compilation half. -> ticket 10.

### T6. Async CSS turns every style assertion into a timing bug

Beyond the a11y loader (C9), the reference had to (a) `await waitFor` computed
transition-duration in `play` with a 5 s timeout
(`accordion.stories.ts:77-87`), (b) do the same for an RTL icon-position check
(`:859-868`), and (c) record in commit `9766fa5` that "Runtime theming compiles
CSS for LTR only" and that the visual RTL check was skipped while runtime theming
was active. Budget for this in ticket 10's Playwright design: an addon-driven
Storybook has no synchronous "styles are ready" moment.

### T7. React is an undeclared transitive dependency of the panel

A Storybook manager panel is React. In the reference the panel is 13 `.tsx`
files importing `react`, `storybook/manager-api`, `storybook/theming` and
`@storybook/icons`, while `package.json` declares no React at all -- it resolves
only because Storybook pulls it in (confirmed present in its
`package-lock.json`), and `.storybook/tsconfig.json` sets `"jsx": "react-jsx"`
to compile it. This repo is in the identical position (react 19.2.8 installed,
undeclared). It works, but it is an unpinned transitive contract; decide
deliberately whether to declare it. -> ticket 02 / ticket 06.

### T8. Do not inherit the reference's control breadth or its state shape

The reference's 56-variable `ThemeState` forced: a duplicated copy of the entire
interface inside the worker because "workers can't share imports with the main
thread" (`sass-compiler.worker.ts:14-108`), a 140-line hand-written deep merge
(T1), a hand-maintained `sassVar -> state path` lookup table
(`ThemePanel.tsx:151-231`), a separate variable-to-component dependency map, and
two divergent SCSS-generation code paths. Every one of those is a direct
consequence of breadth. With 6 controls the state is a flat object of 5 colors
and one length; none of that machinery is warranted. The map's "Out of scope"
entry (no font-size/padding/hover-lightness controls) is load-bearing -- hold it.

### T9. The reference's addon registration shape is invalid on Storybook 10

`preset.js` in the reference is CommonJS (`const { join } = require('path')`;
`module.exports = { managerEntries }`). Storybook 10's migration guide states
plainly: "**Storybook 10 requires all addons to be built as ESM-only**", and
replaces `exportEntries` with `previewEntries` / `managerEntries`
([addon migration guide](https://storybook.js.org/docs/addons/addon-migration-guide)).
A concrete instance of the standing constraint: the reference's wiring cannot be
lifted even if someone wanted to.

### T10. Do not derive Sass values into JS via SCSS `:export`

If any later ticket proposes reading the curated defaults out of the `.scss` at
runtime through SCSS `:export`, reject it: it works under `storybook dev` and
**fails on `storybook build`**
([discussion #28719](https://github.com/storybookjs/storybook/discussions/28719),
[issue #14050](https://github.com/storybookjs/storybook/issues/14050)). Given
ticket 07 must create a single source for the compliant palette, this is a
tempting and wrong shortcut.

### T11. Theming addons die at Storybook major boundaries

Six of the eight theming addons surveyed are deprecated, archived, or stranded on
Storybook 6/7 (section 4.5). None of the surviving ones compile anything. A
workspace-local addon carries far less of this risk than a published one -- a
real input to ticket 06.

---

## 4. Web / GitHub / npm prior art

### 4.1 Headline: no Storybook addon compiles Sass in the browser. None.

This was searched, not assumed. Negative evidence:

- `gh api search/code q='compileString storybook addon language:typescript'` -> `total_count: 0`
- `gh api search/code q='"sass.default.js" storybook'` -> 2 hits, both irrelevant
  (a `vite.config.js` and a TODO list)
- npm registry searches for `storybook-addon-sass`, `storybook sass theme`,
  `storybook addon theme editor` -> no runtime-compile package
- the storybook.js.org addon catalogue's `style` tag (19 addons) -> no compiler

**Thin prior art is itself the finding.** M002 is not re-treading a solved
problem; it is walking off the paved road, deliberately, because D020 forecloses
the paved road. That should be stated in the requirements, not discovered later.

What the near-misses actually do, so nobody re-checks them:

| Package | What it really does |
| --- | --- |
| `storybook-addon-sass-postcss` (0.4.0, 2025-10) | A webpack preset. sass-loader + postcss-loader at BUILD time. No runtime surface. [npm](https://registry.npmjs.org/storybook-addon-sass-postcss) |
| `@storybook/addon-themes` (10.5.7, official) | `withThemeByClassName` / `withThemeByDataAttribute` / `withThemeFromJSXProvider`. Toggles a class, attribute, or provider over PREBUILT stylesheets. Compiles nothing. [docs](https://storybook.js.org/docs/essentials/themes) |
| `@square360/drupal-scss-addon` (0.1.3, 2022) | Swaps prebuilt `<link>` stylesheets from a toolbar dropdown. [npm](https://registry.npmjs.org/@square360%2Fdrupal-scss-addon) |
| `storybook-design-token` v5 | Parses `.scss` at BUILD time for annotated tokens; edit surface is CSS custom properties. A docs tool. [repo](https://github.com/UX-and-I/storybook-design-token) |
| `@etchteam/storybook-addon-css-variables-theme` | **Archived 2025-06-27**; README deprecation notice points at `@storybook/addon-themes`. Was lazy `<style>` tags over prebuilt CSS. [repo](https://github.com/etchteam/storybook-addon-css-variables-theme) |

### 4.2 The one real architectural precedent -- and it is Less, and it is dead

`storybook-addon-customize-antd-theme` ([repo](https://github.com/letshare/storybook-addon-customize-antd-theme))
is the closest existing thing: browser-compiled **Less** driving live antd
theming from a Storybook manager panel. Last npm publish 2021-10-11 (v1.1.0),
requires Storybook >= 6, antd ^4. Stranded on two dead majors.

Its topology, which does transfer, verified by reading its source:

- a `preset.js` uses `webpackFinal` + `CopyPlugin` to copy the framework's raw
  `.less` tree into `static/` so the browser compiler can `fetch()` sources at
  runtime ([preset.js](https://github.com/letshare/storybook-addon-customize-antd-theme/blob/master/packages/storybook-addon-customize-antd-theme/preset.js));
- the manager panel emits `EVENT_CHANGE_LESS` / `EVENT_RESET_LESS` /
  `TRIGGER_EXPORT_LESS` over `addons.getChannel()`;
- a **preview-side** component listens on that channel and calls
  `window.less.modifyVars(...)`, removing its generated `<style>` by id on
  deactivate ([LessModify.tsx](https://github.com/letshare/storybook-addon-customize-antd-theme/blob/master/packages/storybook-addon-customize-antd-theme/src/components/LessModify.tsx));
- its curated variables are literally `primary-color` and `border-radius-base` --
  **the same shape as R009's palette-plus-radius set.**

Independent corroboration of C5 and of "compile in the preview": two unrelated
implementations, five years and two preprocessors apart, both put durable state
on a manager-to-preview transport and the compile on the preview side.

Non-Storybook precedents in the right preprocessor: Picostrap / PicoSASS and
bootstrap.build compile Dart Sass in-browser by building a source string of
`$variables` + one `@import` and injecting the result into a preview iframe.
SEARCH-SOURCED, not fetched -- treat as a pointer, not evidence.

### 4.3 The abandonment report -- read this before designing the compile loop

Ant Design Pro shipped browser Less compilation and then published why they
regret it ([beta-pro.ant.design/blog/change-theme](https://beta-pro.ant.design/blog/change-theme/)):

- "Compiling less in the browser is not a good solution. **The compilation of
  less will cause the main process of the browser to be stuck, and the whole page
  is stuck.**"
- "`antd-pro-merge-less` will cause some of the introduction of less to fail. And
  it is difficult to check."
- "The current online theme is a demo, with some issues and **is not suitable for
  adaptation in a formal environment**."

Their mitigation was a webpack plugin that walked the Less AST and extracted
**only the rules containing colour variables** into a small file, so the browser
recompiled a fraction of the framework instead of all of it. Ant Design v5 then
dropped Less for CSS-in-JS tokens outright.

Two design lessons, both of which this repo is already structurally positioned to
take:

1. **Do not hand the browser compiler the whole framework per keystroke.** This
   repo's `theme()` chain is 3 library files + 3 Foundation entry points (C2) --
   already the narrow entry point Ant Design Pro had to build tooling to
   synthesise. Do not widen it.
2. **A stuck compile must not be able to freeze the UI.** This is the strongest
   argument for a worker, and it is a *responsiveness* argument, not a throughput
   one -- which is exactly why the reference's worker-POOL (a throughput
   optimisation for N components) does not transfer to a one-component repo.

### 4.4 How the large design systems actually do it

| System | Where the editor lives | Control surface | Preset-vs-custom semantics | Mechanism |
| --- | --- | --- | --- | --- |
| Angular Material | Docs site header (no Storybook) | 4-preset menu | radio on selected; no custom, no reset | swap prebuilt compiled CSS |
| MUI | Docs page (no Storybook) | 2 color pickers + hex | "Set Docs Colors" / "Reset Docs Colors" | JS theme object |
| IBM Carbon | Storybook, via the built-in Backgrounds toolbar | 4-preset dropdown | selection only | Sass mixin -> CSS custom props per `data-carbon-theme` |
| Adobe Spectrum | Storybook custom `types.TOOL` toolbar | 4 inline selects | **`Auto` (`value: ''`) is the reset**, state mirrored to URL params | JS theme objects |
| Fluent UI v9 | **Storybook doc page with chrome hidden** (`showToolbar: false`, `viewMode: 'canvas'`) | hex input + `<input type=color>` + 2 sliders | always custom, no presets | JS theme object |
| Fluent UI v8 | Standalone app (`aka.ms/themedesigner`) | 3 color pickers + a11y checker | none | `createTheme` |
| Shopify Polaris | Storybook `globalTypes` toolbar, `dynamicTitle: true` | 4-preset dropdown | selection only | CSS custom props |
| Ant Design v5 | **Standalone page** `ant.design/theme-editor` | full token panel | **"N Changes" counter + per-token Reset** | CSS-in-JS tokens |

Three findings that bear directly on this map:

1. **Not one first-party design-system Storybook ships a compiler.** All of them
   converged on CSS custom properties or JS theme objects -- the mechanism D020
   forbids. D020 is therefore load-bearing and expensive, and the requirements
   should say so plainly: the browser compiler earns its keep only by evaluating
   Foundation's own Sass colour functions, maps and mixins against user input.
   For the curated set (5 colors + radius, where Foundation derives hover, text
   contrast and dropdown arrow colors via `scale-color` / `color-pick-contrast`
   -- see `_button.scss:84-88, 96, 151-160`) that case genuinely holds. It would
   NOT hold for a set of literal pass-through values.
2. **Several put the editor outside Storybook entirely**, and Fluent UI v9
   deliberately moved theirs INTO Storybook as a chrome-less MDX doc page. That
   is proven prior art for "the control surface outgrew a toolbar dropdown" --
   relevant input for ticket 09 if a 6-control panel later grows.
3. **Preset-vs-custom: Ant Design v5's pattern is better than the reference's.**
   The reference (and Polaris, Carbon) model "customised" as a fake `Custom`
   entry inside the preset dropdown -- which is why selecting it is a no-op
   (`PaletteSelectorControl.tsx:107-110`), a small UX wart. Ant Design v5 instead
   keeps the preset selected and shows a live **"N Changes"** dirty counter with
   a per-control Reset. Spectrum's variant is an explicit `Auto` entry whose
   value is `''`. This map's Destination requires "a preset reads as 'selected'
   only when every control's live value matches that preset exactly", which is
   compatible with all three; ticket 09 should pick deliberately rather than
   inherit the fake-`Custom` shape.

### 4.5 What NOT to repeat: the graveyard

All verified via registry.npmjs.org and GitHub repo status.

| Package | Status |
| --- | --- |
| `@storybook/addon-styling` | **Deprecated**; last 1.3.7 (2023-08). npm notice: split into `@storybook/addon-styling-webpack` + `@storybook/addon-themes` |
| `@etchteam/storybook-addon-css-variables-theme` | **Repo archived** 2025-06-27 |
| `storybook-addon-themes` (tonai) | last publish 2021-04, Storybook 6 era |
| `storybook-addon-theme-playground` | last publish 2023-09, peers pinned `^7.0.0`; **never reached 8/9/10**. Closest UX precedent to a generated-control panel, but it tweaks a JS theme object |
| `storybook-addon-customize-antd-theme` | last publish 2021-10, SB >= 6, antd 4 |
| `eBay/storybook-addon-themepicker`, `nickofthyme/storybook-addon-theme-toggle`, `JumboInteractiveLimited/storybook-addon-emotion-theme` | **archived** |

Pattern: theming addons die at Storybook major boundaries. That is a live risk
for a workspace-local addon too, but a much smaller one -- which is a real input
to ticket 06's delivery-shape decision.

### 4.6 Storybook 10 constraints that bind M002

From the [addon migration guide](https://storybook.js.org/docs/addons/addon-migration-guide),
[writing-addons](https://storybook.js.org/docs/addons/writing-addons) and
[addons-api](https://storybook.js.org/docs/addons/addons-api):

- **"Storybook 10 requires all addons to be built as ESM-only."** CJS support is
  gone; `preset.js` must be ESM; `.storybook/local-preset.cjs` becomes
  `local-preset.ts`; Node target `node20.19`. Note the reference's `preset.js`
  is CommonJS (`const { join } = require('path')`) -- a concrete example of a
  reference detail that must NOT be carried over.
- `exportEntries` is replaced by `previewEntries` and `managerEntries`.
- "Addons with a UI must use the same React version as Storybook" -- reinforces T7.
- **Convenient alignment:** the Dart Sass browser build is ESM-only too
  (dart-sass CHANGELOG 1.63.4: "On the browser and other ESM-only platforms, only
  `import * as sass from 'sass'` is supported"). The two constraints agree.
- **"The addon panel cannot directly touch story DOM."** State crosses by globals
  or channel; a decorator is the bridge. The official example injects a `<style>`
  into the preview iframe from a decorator -- the same shape as C6.
- **Angular means webpack, not Vite.** `@storybook/angular@10.5.7` depends on
  `@storybook/builder-webpack5`. That is what makes the Terser/`keep_names`
  question (C1) real rather than theoretical.
- **Known trap, do not use:** routing SCSS values into JS via SCSS `:export`
  works under `storybook dev` and **fails on `storybook build`**
  ([discussion #28719](https://github.com/storybookjs/storybook/discussions/28719),
  [issue #14050](https://github.com/storybookjs/storybook/issues/14050)). If any
  ticket proposes deriving the curated defaults from the `.scss` at runtime via
  `:export`, reject it.

### 4.7 Dart Sass browser-build facts, independently sourced

Corroborates and extends C1/C2. From the
[dart-sass README](https://github.com/sass/dart-sass/blob/main/README.md#dart-sass-in-the-browser)
and [CHANGELOG](https://github.com/sass/dart-sass/blob/main/CHANGELOG.md):

- Browser support landed in **1.63.0** -- the map's founding claim is correct.
- **No filesystem**, so `compile()` / `compileAsync()` are unavailable; only
  `compileString()` / `compileStringAsync()`.
- "If you want to load other files, you'll need to pass a custom importer" --
  confirming C2 is mandatory, not a choice.
- `NodePackageImporter` (1.71.0) is filesystem-based and therefore unusable in
  the browser (INFERRED from its definition; the README does not name it).
- The legacy `render`/`renderSync` API is unavailable in the browser.
- **Sync `compileString` IS exported** by the browser build (I verified the
  export list in `node_modules/sass/sass.default.js` locally), as are
  `initCompiler` / `Compiler` for reusing a compiler across recompiles. The
  README notes `compileAsync()` is "substantially slower than `compile()`", so
  async is the worse choice for raw latency and the only choice for main-thread
  responsiveness -- which is precisely the tradeoff ticket 05 must measure.
- **Payload:** `sass.dart.js` is ~5,535 KB raw / ~874 KB gzipped, plus
  `immutable`. That lands in the PREVIEW iframe bundle, not the manager.

---

## 5. Verified vs inferred

**Verified** (read directly, path/line cited): everything in sections 0-3 that
cites a clone path, a commit SHA, or a `git grep` result; the `sass@1.102.0`
package-shape and `process.stdout`/`isTTY`/`immutable` findings, which I checked
against THIS repo's `node_modules`, not the reference's claims; the absence of
addon tests and addon docs in the reference; the five-file duplication of this
repo's compliant palette. In section 4: the zero-result GitHub code searches; the
dart-sass README and CHANGELOG statements; the Storybook 10 addon migration
requirements; the Ant Design Pro blog quotes; the deprecation/archive status of
each package in 4.5; the `storybook-addon-customize-antd-theme` topology, read
from its source.

**Inferred** (reasoned, needs a ticket to confirm): that M003's
layered/unlayered cascade split removes the need for the reference's
style-suppression machinery (C6, decision 1); that a single-component graph makes
the worker pool and the persistent cache unnecessary (decisions 2-3); that this
repo's `theme()` mixin makes the compile-source and the export-source one string
(C3, second half); that `NodePackageImporter` is unusable in the browser; that
the 874 KB gzipped compiler necessarily lands in the preview bundle rather than
the manager.

**Search-sourced, not fetched** (treat as pointers, not evidence): Picostrap /
PicoSASS and bootstrap.build as non-Storybook Dart-Sass-in-browser precedents.

**Conflict resolved explicitly**: the reference's `process.stdout.isTTY` crash vs
upstream dart-sass's claim to have fixed it in 1.69.2. See the reconciliation
paragraph in C1 -- the residual risk is a bundler that defines a non-conformant
`process`, which Storybook's webpack5 preview builder does.

**Reference performance numbers are calibration, not targets.** They were
measured on a different Foundation subset (accordion + button), a different Sass
delivery path, and unknown hardware. Ticket 05 must measure this repo's real
chain.
