# Findings: Dart Sass in the browser -- what is actually supported

Ticket: `.scratch/m002-storybook-theming-addon/issues/03-dart-sass-in-the-browser.md`
Status: resolved
Date: 2026-08-11

Method, in order of authority:

1. **Direct inspection of this repo's own `node_modules/sass@1.102.0`** -- the
   package manifest, the four entry points, the shipped `types/`, and the
   dart2js blob `sass.dart.js` itself (searched with `rg`; it is gitignored).
2. **Executable probes.** Three throwaway Node scripts (kept in the session
   scratchpad, not in the repo) that (a) compile the REAL `theme()` chain with
   zero filesystem access, and (b) re-run the same thing with the sass
   **browser** entry point (`sass.default.js`) loaded under simulated browser
   globals, so the compiler takes its actual browser code paths.
3. **Primary docs** -- the `dart-sass` repo README's "Dart Sass in the Browser"
   section, `sass-lang.com/documentation/js-api/`,
   `sass-lang.com/documentation/breaking-changes/import/`, the GitHub release
   notes for `1.63.0`, and the npm registry's publish timeline.

Every number below is measured on this machine (Snapdragon X Elite, Windows
arm64, Node 24.18.0). Numbers marked INFERRED are not measured.

---

## 0. Verdict up front

**Browser-side compilation of this specific `theme()` chain is feasible, and I
verified it end to end rather than in principle.** The full chain -- `_button.scss`
-> the legacy `@import` island -> 13 Foundation partials -> `_settings.scss` --
compiles to 5842 bytes of CSS from a pure in-memory string map, with the sass
**browser** entry point running in browser mode and with `loadPaths`, `compile()`
and every filesystem path unavailable.

The legacy `@import` chain is **not** a special case for the importer API. It
goes through exactly the same `canonicalize` / `load` pair as `@use`, with a
`context.fromImport` flag. In this chain, 14 of 17 `canonicalize` calls carry
`fromImport: true`, and all of them resolve.

Three things are more expensive than the brief implies, and one premise in the
ticket is wrong:

- The ticket (and `map.md`) say **Storybook 10 builds the preview with Vite**.
  In THIS repo it does not. `@storybook/angular@10.5.6` depends on
  `@storybook/builder-webpack5@10.5.6` + `webpack@5`. Question 4 is a webpack 5
  question. (This is good news -- see section 4.)
- `compileStringAsync` is **~10x slower** than `compileString` (1.56-2.11 s vs
  0.14-0.21 s for this chain). Any design that reaches for the async API to
  "keep the UI responsive" pays an order of magnitude for it.
- The payload is ~5.7 MiB raw / ~915 KiB gzip, in one non-tree-shakeable blob.

Detail below, then the non-obvious costs in section 6.

---

## 1. Is the claim true, and what exactly ships?

**The claim is true.** VERIFIED.

`sass@1.63.0` (published 2023-06-07) release notes, verbatim:

> Dart Sass's JS API now supports running in the browser. Further details and
> instructions for use are in the README (`#dart-sass-in-the-browser`).

The version floor of 1.63 is correct. This repo has `sass@1.102.0` installed
(published 2026-07-25), which is `latest` on npm as of today.

### What the browser entry point is

There is **no `browser` field and no `browser` export condition** in
`node_modules/sass/package.json`. The browser build is what you get by
*elimination*:

```json
"exports": {
  "types": "./types/index.d.ts",
  "node":    { "require": "./sass.node.js",    "default": "./sass.node.mjs" },
  "default": { "require": "./sass.default.cjs", "default": "./sass.default.js" }
}
```

A web-target bundler does not supply the `node` condition, so it falls to
`default`. VERIFIED by running `enhanced-resolve` (webpack's own resolver) with
the exact `conditionNames` Storybook's builder configures:

| Resolver conditions | `sass` resolves to |
| --- | --- |
| `storybook, stories, test, webpack, development, browser, import, module, default` | `sass/sass.default.js` |
| same, but `require` instead of `import` | `sass/sass.default.cjs` |
| `..., node, require, module, default` (contrast) | `sass/sass.node.js` |

So `import * as sass from 'sass'` inside preview code picks up the browser
build **with no alias, no `resolve.alias`, no plugin.** That is the single most
useful practical fact in this document.

### Node vs browser is an ENTRY-POINT difference, not a build difference

Both entries load the SAME `sass.dart.js`. The difference is what they inject:

```js
// sass.node.js  -- Node entry
library.load({ util, stream, nodeModule: require('module'), fs, immutable });

// sass.default.cjs / sass.default.js  -- browser entry
library.load({ immutable });          // <- that is the entire dependency set
```

`sass.dart.js` contains **zero** `require()` calls and zero `import`/`export`
statements; the host injects Node built-ins through that `_cliPkgRequires`
parameter. **This is why the browser build needs no `fs` / `path` / `url`
polyfill: it never asks for one.** VERIFIED by reading the dart2js prelude
(`sass.dart.js` lines 1-125) and by `rg`-ing the whole 5.4 MiB file for
`require(` (zero hits).

### Which API surface is available

`sass.default.js` **exports all 40 names**, including `compile`, `compileAsync`,
`render`, `renderSync` and `NodePackageImporter`. They are exported but they
throw. The guard is a runtime check inside the Dart code:

```js
compile0(path, options) {
  if (!A.isNodeJs())
    A.jsThrow(new self.Error("The compile() method is only available in Node.js."));
  ...
```

Measured, with the browser entry loaded under browser globals:

| Call | Result |
| --- | --- |
| `compile('x.scss')` | THROWS `The compile() method is only available in Node.js.` |
| `compileAsync('x.scss')` | THROWS **synchronously** -- same message. It is NOT a rejected promise, so `.catch()` will not see it. |
| `renderSync({file})` | THROWS `The renderSync() method is only available in Node.js.` |
| `new NodePackageImporter()` | THROWS (`Cannot read properties of undefined` -- it wants `process.argv`) |
| `compileString(...)` no loads | [OK] |
| `compileString('@use "sass:math"; ...')` | [OK] -- built-in `sass:` modules work |
| `compileString('@use "x";')` with no importers | THROWS `Custom importers are required to load stylesheets when compiling in the browser.` |
| `compileString('@use "x";', {loadPaths: ['.']})` | THROWS the same -- **`loadPaths` is inert in the browser** |
| `compileString(...)` with `importers: [...]` | [OK] |
| `initCompiler()` / `compiler.compileString()` / `compiler.dispose()` | [OK] -- works, but see section 3 for the (absent) perf benefit |

This matches the README exactly:

> Since the browser doesn't have access to the filesystem, the `compile()` and
> `compileAsync()` functions aren't available for it. If you want to load other
> files, you'll need to pass a custom importer to `compileString()` or
> `compileStringAsync()`. The legacy API is also not supported in the browser.

**Confirmed: the filesystem-backed entry points are not available.** `compileString`
/ `compileStringAsync` plus `importers` is the whole surface.

### How "browser" is detected -- and two traps in it

```js
isNodeJs()  { return self.process?.release?.name === "node"; }
isBrowser() { return !isNodeJs() && self.document != null
                     && typeof self.document.querySelector == "function"; }
```

- **Trap A -- a `process` shim flips it.** The Node-only guard is evaluated at
  CALL time off `process.release.name`. If a bundler injects a `process`
  polyfill that sets `release.name = 'node'`, `compile()` stops throwing its
  clear message and instead dies deep inside Dart with an opaque
  `TypeError: Instance of 'NullError': type 'NullError' is not a subtype of type
  'JsSystemError'`. I reproduced this exact error accidentally, by having
  `process` present while `fs` was not. Storybook's webpack 5 does not inject
  such a shim by default, so this is a hazard only if someone adds one.
- **Trap B -- a Web Worker is NOT "browser" to Dart Sass.** Workers have no
  `document`, so `isBrowser()` returns `false` there. Consequences: the friendly
  "Custom importers are required..." message never fires (you get the generic
  `Can't find stylesheet to import.` instead), and error colouring flips (see
  section 6). Nothing breaks, but the diagnostics get worse in exactly the
  environment section 3 says you want.

---

## 2. The importer API and the legacy `@import` island -- THE ANSWER

**The importer API does not distinguish `@import` from `@use` in its shape. It
passes a `fromImport` flag and otherwise behaves identically.** VERIFIED three
ways: from the shipped types, from the compiled source, and by executing the
real chain.

### Shape

```ts
interface Importer<sync = 'sync' | 'async'> {
  canonicalize(url: string, context: CanonicalizeContext): PromiseOr<URL | null, sync>;
  load(canonicalUrl: URL): PromiseOr<ImporterResult | null, sync>;
  nonCanonicalScheme?: string | string[];
}

interface CanonicalizeContext {
  fromImport: boolean;    // true when the load came from `@import`, not `@use`/`@forward`
  containingUrl: URL | null;
}

interface ImporterResult { contents: string; syntax: Syntax; sourceMapUrl?: URL; }
```

`types/importer.d.ts` states the intent outright: an `Importer` "implements
custom Sass loading logic for `@use` rules **and** `@import` rules".

In the compiled source, `fromImport` is carried on a `CanonicalizeContext`
stashed in a Dart Zone, and the browser guard sits in `ImportCache.canonicalize`
-- the ONE cache both rule types route through. There is no separate
`@import` resolution channel. `fromImport` exists for exactly one purpose,
per the docs: deciding whether to serve
[import-only files](https://sass-lang.com/documentation/at-rules/import#import-only-files)
(`*.import.scss`).

### Executed against the real chain

I compiled the real public API call

```scss
@use 'nfs:/button' as nfs-button;
@include nfs-button.theme($background: #2a5db0, $palette: (success: #238648), $radius: 6px);
```

with `importers: [inMemoryImporter]`, **no `loadPaths`, no `url`, no filesystem
access of any kind**, serving every byte from a `Map<string, string>`:

```
[OK] compiled. css bytes: 5840
canonicalize calls: 17  (fromImport=true: 14)
load calls: 16
loadedUrls:
  nfs:/_button.scss
  nfs:/internal/_foundation-button.scss
  nfs:/internal/_settings.scss
  fnd:/scss/util/_util.scss        fnd:/scss/util/_math.scss
  fnd:/scss/util/_unit.scss        fnd:/scss/util/_value.scss
  fnd:/scss/util/_direction.scss   fnd:/scss/util/_color.scss
  fnd:/scss/util/_selector.scss    fnd:/scss/util/_flex.scss
  fnd:/scss/util/_breakpoint.scss  fnd:/scss/util/_mixins.scss
  fnd:/scss/util/_typography.scss  fnd:/scss/_global.scss
  fnd:/scss/components/_button.scss
```

The same run, repeated with the **browser** entry (`sass.default.js`) under
browser globals, produced 5842 bytes over the same 16 URLs. (The 2-byte delta
is the `$palette` argument difference between my two probe entry strings, not a
browser-vs-node divergence -- ticket 05 should still do the byte-for-byte diff
it already plans.)

`@use` accounts for 3 of the 17 canonicalize calls; `@import` for 14. Both
resolved through the identical callback pair.

### What the importer must actually implement -- four concrete obligations

1. **Partial and extension resolution is YOURS.** Sass hands `canonicalize` the
   URL as written (relative URLs pre-resolved against the containing canonical
   URL) and does nothing else. You must try `_name.scss`, `name.scss`, and the
   `_index.scss` / `index.scss` forms yourself. `types/importer.d.ts` spells out
   the exact candidate order the built-in filesystem importer uses.
2. **`@import`'s bare load-path URLs need an explicit rewrite.** This is the one
   genuinely awkward part. The island writes

   ```scss
   @import 'foundation-sites/scss/util/util';
   ```

   which today works only because the build passes `--load-path=node_modules`
   (see `packages/ngx-foundation-sites/project.json:36`). It has no URL scheme,
   so Sass treats it as **relative** and hands the importer
   `nfs:/internal/foundation-sites/scss/util/util`. Since `loadPaths` is inert
   in the browser, the importer must recognise the `foundation-sites/scss/`
   segment and re-point it at the Foundation namespace. My probe does exactly
   that in three lines and it works, but **it is a design obligation ticket 08
   must own**, not an accident of the API. The island's `@import` strings are
   shipped source and should not be edited to suit the browser.
3. **Canonical URLs must be stable.** Once rewritten, Foundation's own internal
   relative `@import`s resolve against the canonical `fnd:` URL and come back
   consistently. Verified: no duplicate loads, 16 loads for 16 distinct URLs.
4. **`*.import.scss` handling is NOT needed here.** VERIFIED: `foundation-sites`
   ships zero `.import.scss` files and zero `_index.scss` files, so the
   `fromImport` flag has no behavioural consequence for this chain. Implement
   the candidate list anyway (it is cheap), but no correctness depends on it.

Two further confirmations relevant to 08:

- Foundation's only `@use` statements are `@use "sass:math"` / `@use "sass:color"`
  (in `util/_math.scss`, `util/_mixins.scss`, `util/_color.scss`). Built-in
  `sass:` modules are resolved internally and **never reach the importer**.
- **A SYNCHRONOUS importer is sufficient**, because the sources are strings. That
  unlocks `compileString` (sync), which section 3 shows matters enormously.

### How much source must be served

Measured, not estimated. The ticket cites "501K". The reachable set is far
smaller:

| Scope | Files | Raw | gzip |
| --- | --- | --- | --- |
| Whole `foundation-sites/scss` tree | 106 | 367.6 KiB | -- |
| **Transitive `@import` closure the chain actually reaches** | **13** | **71.9 KiB** | -- |
| Closure + the 3 `nfs` partials (what the addon must ship) | 16 | 84.4 KiB | 23.4 KiB |

So the string map is a ~23 KiB gzip line item, not a 500 KiB one. That should
change how ticket 08 weighs its four options.

---

## 3. Bundle cost, ESM, tree-shaking, workers

### Size -- measured

| Artefact | Raw | gzip | brotli |
| --- | --- | --- | --- |
| `sass/sass.dart.js` | 5535.2 KiB | 853.6 KiB | 427.3 KiB |
| `immutable/dist/immutable.es.js` (the entry a web bundler picks) | 182.6 KiB | 38.9 KiB | 32.2 KiB |
| SCSS string map (16 files) | 84.4 KiB | 23.4 KiB | 20.1 KiB |
| **Total added to the preview** | **~5.66 MiB** | **~916 KiB** | **~480 KiB** |

`immutable` is a hard runtime dependency of the browser build, not optional.
Note the bundler picks the 182.6 KiB `immutable.es.js` via `mainFields: module`,
not the 66.9 KiB `immutable.min.js`.

### ESM? Yes at the entry, no underneath

`sass.default.js` is real ESM: 40 named `export const` bindings. But it is a
thin shim over `import "./sass.dart.js"` -- a **side-effect-only script**.

**Tree-shaking is impossible.** CONFIRMED by measurement, not assumption:
`sass.dart.js` contains **0** top-level `export` statements, **0** top-level
`import` statements, and **0** `/*#__PURE__*/` annotations across 133,224 lines.
It is one dart2js IIFE that publishes itself through a
`globalThis._cliPkgExports` stack. Importing only `compileString` pulls in the
entire compiler, the CLI, the legacy API, the watcher plumbing -- everything.

### Minification: the one real bundler hazard

The dart-sass README states the constraint plainly:

> It's compatible with all major web bundlers **as long as you disable renaming**
> (such as `--keep-names` in esbuild).

dart2js output relies on function/class names surviving. A mangling minifier
breaks it. See section 4 for why this repo is already safe, and where it is not.

### Web Worker: NOT documented, but strongly indicated by the numbers

VERIFIED: the word "worker" appears **nowhere** in the dart-sass README. There is
no documented worker story, no worker entry point, no guidance. The async story
IS documented, and documented as slow -- `sass-lang.com/documentation/js-api/`:
"**The asynchronous variants are much slower**".

Measured on this chain, browser entry, browser mode:

| Path | Timing |
| --- | --- |
| `compileString` (sync) | 176.7, 184.0, 198.9, 200.4, 213.7 ms |
| `compileStringAsync` | 1560.6, 1884.1, 1887.3, 2026.1, 2109.7 ms |

**Async is ~10x slower. That is the headline design input.** The correct shape is
therefore *sync compile inside a Worker*, not *async compile on the main thread*:

- a sync importer serving strings is entirely possible (section 2), so the async
  API buys nothing here;
- ~150-215 ms of synchronous work on the main thread per keystroke is well past
  any interactivity budget, so a Worker is required, not merely nice;
- but Workers see `document === undefined`, so `isBrowser()` is false there --
  degraded diagnostics, per section 1.

Note for ticket 01's record: the `ngx-foundation-sites-next` reference used
`compileStringAsync` inside its worker pool. Inside a Worker there is no reason
to, and this measurement says it costs ~10x.

### Cold start

| Step | Measured |
| --- | --- |
| `import` of `sass.default.js` (parse + dart2js init of 5.4 MiB) | 174.3 ms |
| First `compileString` of the chain | 243.4 ms |
| Warm `compileString`, 10 runs | min 136.1 / median 148.4 / max 168.0 ms |

INFERRED: in a browser these will be worse on a cold HTTP cache -- 5.4 MiB must
be transferred (~854 KiB gzip) and parsed. Ticket 05 should measure it in a real
browser; that is precisely the number a Node probe cannot give you.

### `initCompiler()` does NOT help

Worth recording because it looks like free money. `initCompiler()` returns a
`Compiler` with a shared import cache, works fine in browser mode, and disposes
cleanly -- but for this chain it produced **no speedup**: median 154.2 ms
(compiler) vs 148.4 ms (plain `compileString`). Parsing is not the bottleneck.
Do not plan around it.

---

## 4. Storybook builder integration -- the ticket's premise is wrong, favourably

**CORRECTION: this repo's Storybook preview is built by webpack 5, not Vite.**
VERIFIED from `node_modules/@storybook/angular/package.json` (v10.5.6), whose
dependencies are `@storybook/builder-webpack5@10.5.6` and `webpack@5`. The
repo's own `.storybook/main.ts:14` comment already says so ("you can use the
`webpackFinal` field"). `vite@7.3.6` is present in the workspace, but for
Vitest, not for Storybook's preview.

That makes question 4 much easier than feared:

- **Node built-in polyfills: not needed.** Section 1 established the browser
  entry injects only `immutable`. Webpack 5's removal of automatic Node
  polyfills -- the usual pain -- is a non-issue here. Storybook's preview preset
  additionally sets `resolve.fallback: { crypto: false, assert: false }`, which
  is unrelated but harmless.
- **`process` references: none required.** The dart2js prelude only *reads*
  `typeof process !== "undefined"` and adapts. Do NOT add a `process` shim --
  section 1's Trap A shows it makes failures worse, not better.
- **Condition resolution: automatic.** Storybook's preview preset sets
  `conditionNames: [...base, 'storybook', 'stories', 'test', '...']`. No `node`
  condition on a web target, so `sass` -> `sass.default.js`, verified with
  webpack's own resolver (section 1).
- **Minification: already safe here.** `@storybook/builder-webpack5`'s
  `dist/presets/preview-preset.js` configures Terser for production as
  `{ mangle: false, keep_fnames: true }`. That satisfies the README's
  "disable renaming" requirement out of the box. And the Angular side does not
  undo it: `@storybook/angular` generates its Angular CLI webpack config with
  `optimization: false, buildOptimizer: false` and then spreads `...baseConfig`
  without overriding `optimization`, so Storybook's minimizer survives.
- **`optimizeDeps` / dep pre-bundling: not applicable.** That is a Vite concept.
- **Must it be dynamically imported?** Not for correctness -- static
  `import * as sass from 'sass'` resolves and bundles. But a static import puts
  ~5.4 MiB into the preview's initial graph. INFERRED recommendation:
  `await import('sass')` on first use (or move it into a Worker, which is a
  separate chunk by construction), so opening a story that never touches the
  theming panel does not pay the cost. Ticket 08 owns this.

**The one webpack trap that is real.** The same preset branches on
`options.build?.test?.esbuildMinify`, and that branch builds a Terser plugin
with `minify: TerserWebpackPlugin.esbuildMinify` and **no `keepNames: true`**.
That is the `build-storybook --test` path. This repo's `build-storybook` target
(`project.json`) does not pass `--test`, so it is currently safe -- but
`test-storybook` runs against `static-storybook` -> `build-storybook`, and if
anyone ever adds `--test` for speed, esbuild will mangle names and the sass
browser build will break in the static build only. **Flag this in ticket 08's
"does it survive `build-storybook`" question.** VERIFIED from the builder
source; not yet observed as a failure, because the flag is not in use.

---

## 5. Deprecation horizon -- yes, this inherits the `@import` clock

**Same compiler, same timeline. The browser build has no separate `@import`
support and no separate removal date.** There is exactly one `sass.dart.js`;
`sass.node.js` and `sass.default.js` differ only in injected dependencies.

Facts, from `sass-lang.com/documentation/breaking-changes/import/` and the npm
publish timeline:

- `@import` **and** global built-in functions were deprecated in Dart Sass
  **1.80.0**, published **2024-10-17**.
- Removal is scheduled for **3.0.0**, "released no sooner than two years after
  Dart Sass 1.80.0" -> floor **2026-10-17**. This matches
  `internal/_foundation-button.scss`'s own header comment exactly.
- 2.0.0 has not shipped. npm `latest` is `1.102.0` (2026-07-25). 2.0.0 removes
  the legacy JS API (`render`/`renderSync`) -- which the addon must not use
  anyway, since it is unavailable in the browser regardless.
- `sass ^1.102.0` will not auto-upgrade past 1.x, so the clock is a *maintenance*
  exposure, not a surprise-breakage one.

**Measured exposure.** One compile of this chain emits **16 deprecation warnings**,
across three deprecation IDs, all of which die in 3.0.0:

```
[deprecation] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.
[deprecation] Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0.
[deprecation] The Sass if() syntax is deprecated in favor of the modern CSS syntax.
```

So the chain depends on **two** things surviving, not one: `@import` AND global
built-in functions (Foundation calls `scale-color`, `color-pick-contrast`,
`get-side` etc. unnamespaced). Both are removed together in 3.0.0.

VERIFIED that the warnings are fully silenceable -- 16 warnings -> 0 with any of
`{ quietDeps: true }`, `{ silenceDeprecations: ['import', 'global-builtin', 'if-function'] }`,
or `{ logger: sass.Logger.silent }`. Without one of these, every recompile spams
the Storybook preview console 16 times. `quietDeps: true` is the right default
here: with `compileString` the entrypoint has no URL, so everything the importer
serves counts as a dependency.

**Stated plainly, as the ticket asks: in-browser compilation of this chain
depends on `@import` surviving, and it inherits the exact same 3.0.0 deadline
the island's header already names.** It adds no new exposure -- the Node-side
build has identical exposure today -- but it does **not** reduce it either. If
ticket 08 picks pre-flattening, note that flattening does not escape the clock
either: the flattened output is still legacy-`@import`-era Sass full of global
built-in calls. The only genuine escapes are vendoring/freezing Foundation's
Sass or migrating the island off `@import`, both of which the header already
identifies and neither of which is M002 scope.

---

## 6. Non-obvious costs

Ordered by how likely they are to be missed.

1. **`compileStringAsync` is ~10x slower than `compileString`.** Sync-in-a-Worker,
   not async-on-the-main-thread. See section 3.
2. **~150-215 ms of blocking work per compile.** A Worker is required, not
   optional. But a Worker has no `document`, so Dart Sass's `isBrowser()` is
   false there and the "Custom importers are required" diagnostic degrades to a
   generic "Can't find stylesheet to import."
3. **Error messages carry ANSI escape codes by default on the main thread.**
   `alertColor` defaults to `hasTerminal() || isBrowser()`. In a browser tab
   that is `true`, so `Exception.message` arrives with `[33m...` sequences
   -- which render as literal garbage in a Storybook panel. Pass
   `{ alertColor: false }`. VERIFIED both ways: with it, `e.message` is escape-free;
   `e.sassMessage` (`"$color: notacolor is not a color."`) and `e.span.url`
   (`fnd:/scss/components/_button.scss`, i.e. the importer's own canonical URL)
   are clean and panel-ready. Errors are `sass.Exception` instances.
4. **16 deprecation warnings per compile unless silenced.** Section 5.
5. **The browser build pollutes `globalThis`.** In a browser the dart2js prelude
   sets `self = globalThis` and then assigns `self.immutable`, `self.chokidar`,
   `self.readline`, `self.fs`, `self.nodeModule`, `self.stream`, `self.util`
   (the last six as `undefined`) and defines a `parcel_watcher` accessor.
   VERIFIED: after import, `typeof globalThis.immutable === 'object'` and
   `'fs' in globalThis === true`. Feature-detection code elsewhere in the preview
   that does `if ('fs' in globalThis)` or `if (globalThis.immutable)` will now
   see different answers. `_cliPkgExports` is correctly cleaned up.
6. **`compileAsync` throws synchronously.** If any error path calls it
   defensively, `.catch()` will not catch it.
7. **Zero tree-shaking, confirmed by measurement** -- 0 exports, 0 imports, 0
   `__PURE__` markers across 133k lines. You ship the CLI, the watcher and the
   legacy API to the browser whether you want them or not.
8. **The `foundation-sites/scss/...` bare-URL rewrite is an unavoidable importer
   responsibility**, because `loadPaths` is inert in the browser and the island's
   `@import` strings are shipped source. Section 2, obligation 2.
9. **`build-storybook --test` would break it.** Section 4. Not currently used;
   worth a guard or a comment so nobody adds it for speed later.
10. **The npm package's own README does not document any of this.** The browser
    section exists only in the `dart-sass` GitHub README, not in the published
    `sass` package README (verified by reading `node_modules/sass/README.md` --
    it has no browser section at all). Anyone re-deriving this from the installed
    package will conclude, wrongly, that there is no browser support.

---

## 7. What is verified vs inferred vs still open

**VERIFIED by execution or direct source inspection**

- Browser support since 1.63.0; `sass@1.102.0` is current.
- `sass.default.js` / `.cjs` is the browser entry; picked automatically by a
  web-target webpack resolver with Storybook's own condition names.
- Browser entry injects only `immutable`; no Node built-ins, no polyfills.
- `compile` / `compileAsync` / `render` / `renderSync` / `NodePackageImporter`
  all unavailable; `loadPaths` inert; `compileString(+Async)` + `importers` is
  the whole surface.
- The importer API resolves `@import` and `@use` through the same
  `canonicalize`/`load` pair, differing only by `context.fromImport`.
- The full real `theme()` chain compiles from strings alone -- 16 files, 5842
  bytes CSS, 14/17 canonicalize calls with `fromImport: true`.
- Reachable Foundation closure: 13 files / 71.9 KiB (not 501K).
- Sizes, timings, warning counts, warning silencing, error shape, global
  pollution, `initCompiler` non-benefit.
- Storybook 10.5.6 + `@storybook/angular` = webpack 5, and its Terser is
  configured `mangle: false, keep_fnames: true`.
- `@import` deprecated 1.80.0 (2024-10-17); removal in 3.0.0, floor 2026-10-17.

**INFERRED (reasoned, not measured)**

- Real-browser cold-start will exceed the 174 ms Node module-init figure, since
  ~854 KiB gzip must transfer and 5.4 MiB must parse.
- Dynamic import / worker chunking is the right default for the 5.4 MiB payload.
- A `process` polyfill added by someone else would degrade failure modes.

**Only a running prototype can settle these -- hand to ticket 05**

- Real in-browser compile latency distribution (cold and warm) on this hardware,
  main thread vs Worker. My numbers are Node/V8 and are a floor, not a promise.
- Byte-for-byte equality of browser output vs the Node-side
  `compile-default-css` output for the same input. My two probes agree to within
  a deliberate 2-byte input difference, which is suggestive, not proof.
- Whether the `!global` rebinds (`$button-radius` via `with-radius`, and
  `$global-left` / `$global-right` after the `@import`s) behave identically in
  the browser. The chain compiled and the emitted `border-radius: 6px` shows the
  radius rebind works; the RTL logical-property rebind was not separately
  asserted.
- Actual transferred/parsed cost inside a real `build-storybook` output, and
  whether the static build serves it correctly.
