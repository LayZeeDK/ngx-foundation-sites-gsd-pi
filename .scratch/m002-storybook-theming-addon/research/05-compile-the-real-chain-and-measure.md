# Findings: compile the real chain in a browser and measure it

Ticket: `.scratch/m002-storybook-theming-addon/issues/05-compile-the-real-chain-and-measure.md`
Status: resolved
Date: 2026-08-11

Hardware / toolchain for every number below: Snapdragon X Elite X1E80100,
Windows 11 arm64, Node v24.18.0, Playwright 1.62.1 driving **Chromium
151.0.7922.34** (headless), `sass@1.102.0`, `webpack@5.105.2`,
`terser-webpack-plugin@5.6.1`, `@storybook/angular@10.5.6` +
`@storybook/builder-webpack5@10.5.6`.

Prototype harness: `.scratch/m002-storybook-theming-addon/prototypes/`
(`importer.mjs`, `collect-sources.mjs`, `build-bundle.mjs`, `browser-entry.mjs`,
`harness.html`, `run-browser.mjs`, `node-reference.mjs`, `diff-css.mjs`,
`worker-entry.mjs`, `run-worker.mjs`). All generated artefacts were written
outside the repo, to the session scratchpad. **No file outside `.scratch/` was
created or modified.**

---

## 0. Verdict up front

**Job 4 (the adjudication) -- ticket 03 is RIGHT, ticket 01 is WRONG, and
ticket 03's own `--test` caveat is ALSO wrong.** Three separate pieces of
evidence, two of them executed:

1. The minifier config ticket 03 named is real and is verbatim in this repo.
2. The **real `build-storybook` output** proves the config actually reaches the
   emitted bundle -- names are fully preserved through production minification.
3. dart-sass bundled with that exact minimizer **compiles the real chain in a
   real Chromium**, correctly, 120+ times across this investigation.

And the bonus finding: **the `--test` / `esbuildMinify` branch does NOT break
dart-sass either.** I built it and ran it. The bundle is genuinely mangled
(function names destroyed) and Dart Sass 1.102.0 still produced **byte-identical
CSS**. Ticket 03's warning at its section 4 / cost 9, and ticket 08's "Guard
`build-storybook --test`" action item, are both based on an untested inference
that does not reproduce. Downgrade, do not delete (reasoning in section 1.4).

**Jobs 1-3 all pass, with one number that is worse than ticket 03's Node
figures.** Browser-produced CSS is byte-identical to both Node references for
all three inputs. The `$global-left`/`$global-right` RTL rebind survives
untouched, and the emitted logical properties resolve correctly in both
directions in a live browser. But real-browser warm compile is a **median 280 ms
on the main thread (p95 351 ms, max 394 ms)**, roughly **2.2x ticket 03's Node
figure of ~125-140 ms** -- so ticket 03's "150-215 ms" is a floor, not a
promise, exactly as it warned. A Worker fixes it completely: max main-thread
frame gap drops from **337 ms to 19.1 ms**.

---

## 1. JOB 4 -- the mangling adjudication

### 1.1 Source of truth: the config is real and unmodified

`node_modules/@storybook/builder-webpack5/dist/presets/preview-preset.js`,
lines 208-238, the `isProd` branch (`!0` is `true`, `!1` is `false` -- esbuild
output):

```js
...isProd ? {
  minimize: !0,
  minimizer: options.build?.test?.esbuildMinify ? [
    new TerserWebpackPlugin({
      parallel: !0,
      minify: TerserWebpackPlugin.esbuildMinify,
      terserOptions: {
        sourcemap: !options.build?.test?.disableSourcemaps,
        treeShaking: !options.build?.test?.disableTreeShaking
      }
    })
  ] : [
    new TerserWebpackPlugin({
      parallel: !0,
      terserOptions: {
        sourceMap: !options.build?.test?.disableSourcemaps,
        mangle: !1,
        keep_fnames: !0
      }
    })
  ]
} : {}
```

VERIFIED: `mangle: false, keep_fnames: true`. Ticket 03 quoted this correctly.

**And the Angular layer provably does not undo it.**
`node_modules/@storybook/angular/dist/_node-chunks/angular-cli-webpack-VNEX2DZH.js`
generates the Angular CLI config with `optimization: !1` (line 117) but its
return statement (lines 152-159) is:

```js
return { ...baseConfig, entry, module, plugins, resolve, resolveLoader };
```

`optimization` is **not** in that spread list, so `baseConfig.optimization`
(Storybook's, with the Terser minimizer above) survives verbatim. Ticket 03's
claim here was also correct, and I confirmed it at the source rather than
trusting the prose.

### 1.2 Executed proof #1: the real `build-storybook` output

```
npx nx run ngx-foundation-sites:build-storybook --skip-nx-cache
-> Successfully ran target build-storybook, 19.0s, exit 0
-> dist/storybook/ngx-foundation-sites (19 MiB; 14 .js files;
   preview JS 4.72 MiB raw / 1140.2 KiB gzip)
```

Static analysis of the largest emitted chunk,
`dist/storybook/ngx-foundation-sites/270.772510a1.iframe.bundle.js`
(2,160,270 bytes):

| Signal | Measured | Meaning |
| --- | --- | --- |
| newlines in file | **29** | it IS minified -- this is not an unminified dev build |
| named `function <name>(` decls, >=7 chars | **2784 (2751 unique)** | `keep_fnames: true` in effect |
| named `class <Name>` decls, >=5 chars | **441** | class names preserved |
| `let/var/const <name>=` decls, >=9 chars | **1781** | `mangle: false` in effect -- even LOCALS keep their names |

Sample survivors: `parserSelectorToR3Selector`, `computeDecimalDigest`,
`areAllEquivalentPredicate`; classes `SelectorlessMatcher`,
`RegularExpressionLiteralExpr`; locals `terminalValuesMap`,
`CUSTOM_ELEMENTS_SCHEMA`.

Local-variable preservation is the decisive one. `keep_fnames` alone would
preserve only function names; 1781 long local names prove `mangle: false` is
genuinely applied to the production preview bundle. **Ticket 01's "Terser
mangling UNMITIGATED" is empirically false for this repo.**

### 1.3 Executed proof #2: dart-sass through that exact minimizer, in Chromium

`prototypes/build-bundle.mjs` bundles `sass` for `target: 'web'` using
Storybook's own `resolve.conditionNames`, `mainFields`, `extensions` and a
minimizer constructed **verbatim from the source above**, then
`run-browser.mjs` loads it in real Chromium.

| | Terser bundle (prod branch) | esbuild bundle (`--test` branch) |
| --- | --- | --- |
| raw | 4,240,116 B (4140.7 KiB) | 3,418,287 B (3339.0 KiB) |
| gzip | 802.3 KiB | 716.9 KiB |
| brotli | 435.7 KiB | 395.7 KiB |
| `sass` resolved to | `sass/sass.default.js` | `sass/sass.default.js` |
| long named fn decls | **3413** | **1** |
| 0-2 char fn decls | 66 | **254** |
| long local decls | **154** | **0** |
| initialises in browser | [OK] | [OK] |
| compiles the real chain | [OK] **5839 B** | [OK] **5839 B** |
| CSS sha256 vs Node | **identical** | **identical** |
| `e instanceof sass.Exception` | true | true |
| `e.sassMessage` | `$color: notacolor is not a color.` | same |
| `e.span.url` | `fnd:/scss/components/_button.scss` | same |

Bare `import * as sass from 'sass'` resolved to the browser entry with **no
alias and no plugin**, confirming ticket 03's most useful practical claim under
a real bundler run rather than a resolver simulation.

### 1.4 The `--test` branch: reachable, and harmless

**Reachability -- VERIFIED, and it is a config option, not a CLI-only flag.**
`node_modules/@storybook/angular/build-schema.json` exposes `test` as a
first-class builder option (full list: `browserTarget, tsConfig, outputDir,
preserveSymlinks, configDir, loglevel, logfile, debugWebpack, enableProdMode,
quiet, docs, test, compodoc, compodocArgs, webpackStatsJson, statsJson,
previewUrl, styles, stylePreprocessorOptions, assets, sourceMap,
experimentalZoneless`). It flows to
`storybook/dist/core-server/presets/common-override-preset.js`, whose
`createTestBuildFeatures(value)` sets `esbuildMinify: value` alongside
`disableTreeShaking`, `disableSourcemaps`, `disableDocgen` and friends.

In THIS repo `test` is **not set** -- `git grep -- "--test"` and the
`build-storybook` / `static-storybook` / `test-storybook` target definitions in
`packages/ngx-foundation-sites/project.json` contain no `test` option.
`test-storybook` runs `test-storybook --url=http://localhost:4400` against
`static-storybook` -> `build-storybook`, inheriting the default (non-test)
build. So the branch is dormant but is one JSON key away.

**Harm -- NOT REPRODUCED.** The esbuild bundle is unambiguously mangled (1 long
function name where Terser kept 3413; 254 two-character function declarations;
zero long locals) and Dart Sass 1.102.0 ran through it flawlessly: correct
compile, byte-identical CSS, intact `sass.Exception` class identity, intact
`e.span.url` from the custom importer, correct browser-vs-Node API gating.

So the dart-sass README's "disable renaming (such as `--keep-names` in esbuild)"
is, at 1.102.0 on this chain, **more conservative than necessary** -- at least
for `compileString` + custom importers + the error path. I did not exercise the
whole API surface, so:

- **DOWNGRADE** ticket 03's cost 9 and ticket 08's "Guard `build-storybook
  --test`" from a correctness blocker to a **watch item**. There is no
  demonstrated breakage to guard against.
- **KEEP** a note, because (a) the upstream README asks for it, (b) I tested one
  chain on one version, and (c) `--test` also sets `disableTreeShaking` and
  `disableSourcemaps`, which change the bundle in other ways.
- Do **not** spend a slice building an enforcement gate for it.

### 1.5 Verdict, stated plainly

> **Ticket 03 was right and ticket 01 was wrong.** This repo's Storybook
> minifies the preview with `mangle: false, keep_fnames: true`; the Angular
> integration does not override it; the emitted production bundle demonstrably
> retains 2751 function names, 441 class names and 1781 local variable names;
> and dart-sass compiled the real `theme()` chain in a real Chromium through
> that exact configuration. **No mitigation is required.** Ticket 01's "highest
> risk unknown" is closed at zero risk.
>
> Ticket 01 was not lying -- it had no evidence either way (its own note says
> the reference project bundled out-of-band, so the question never arose there).
> It recorded an unexamined default assumption as a risk. That is the failure
> mode to remember: an unfalsified worry read as a finding.

---

## 2. JOB 1 -- real in-browser latency, cold and warm

All timings from `run-browser.mjs`, Terser bundle, `performance.now()` inside
the page. Compiles are `compileString` (sync) with a sync in-memory importer.

### 2.1 Load / cold start

| Step | Measured |
| --- | --- |
| navigation -> `__nfsReady` (wall, Playwright) | **205 ms** |
| bundle evaluate + dart2js init (`performance.now()` at module end) | **176.6 ms** |
| **first ever `compileString` of the chain** | **556.2 ms** |
| reload (fresh page, `cache-control: no-store`) wall | 253 ms |
| reload bundle init | 215 ms |
| esbuild-bundle equivalents (init / cold compile) | 163-174 ms / 554-598 ms |

Cold compile is ~2x the warm median. Ticket 03 measured 243.4 ms cold in Node;
the browser is **2.3x that**.

The 205 ms navigation figure is over **localhost with no compression**
(4.24 MiB uncompressed on the wire, measured via Playwright's
`request.sizes()`: 4,240,300 B transferred for the bundle, 1,516 B for the
page). A real deployment serving gzip would move ~802 KiB but pay compression
overhead; a cold HTTP cache over a real network is **NOT measured** -- see
section 7.

### 2.2 Warm compile, main thread -- 40 samples per input

| Input | n | min | p25 | **median** | p75 | p95 | max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `default` (no args) | 40 | 165.4 | 255.4 | **304.6** | 315.6 | 351.0 | 393.6 |
| `themed` (`$background` + 1 palette key + `$radius`) | 40 | 161.7 | 204.2 | **280.1** | 294.2 | 307.1 | 317.0 |
| `compliant` (3 palette keys) | 40 | 218.1 | 265.3 | **279.5** | 283.2 | 298.8 | 330.2 |

All ms. Argument count does not meaningfully move the number -- **the cost is
parsing and evaluating 86 KiB of Foundation Sass, not the theme arguments.**

The distribution is **not** tight and is not normal. Raw sequences show a clear
regime shift: the `default` series runs 303, 226, 214, 196, 192, 184, 180, 184,
176, 190 for ten samples, then jumps to 337, 339, 326, 310, 322, 321, 318, 312,
315, 297 and stays there. That is a ~1.7x step change mid-run with no change in
input. INFERRED cause: V8 tier-down/deopt or thermal/DVFS behaviour on the
Snapdragon under sustained load. Practical consequence for ticket 09: **budget
against p95 (~350 ms), not the 165 ms best case.**

### 2.3 Browser vs Node -- the browser is ~2.2x slower

Same chain, same importer, `sass.node.js`, 15 warm runs each
(`node-reference.mjs`):

| Input | Node median | Browser median | Ratio |
| --- | --- | --- | --- |
| `default` | 139.9 ms | 304.6 ms | 2.18x |
| `themed` | 126.6 ms | 280.1 ms | 2.21x |
| `compliant` | 123.2 ms | 279.5 ms | 2.27x |

**Ticket 03's warning that its Node numbers are "a floor, not a promise" is
confirmed, and the multiplier is ~2.2x.** Any design that budgeted against
150-215 ms should be rebudgeted against 280-350 ms.

### 2.4 Async is still much slower -- confirmed in the browser

`compileStringAsync`, same input, in the browser: **1993.7 ms** (Terser bundle)
and 1684.6 ms on an earlier run. Against a ~280 ms sync median that is
**~6-7x**, versus ticket 03's ~10x in Node. Directionally identical: the async
API buys nothing and costs a lot. **Sync compile, moved off the main thread.**

---

## 3. JOB 2 -- byte-for-byte diff vs the Node build

`diff-css.mjs`, sha256 (first 16 hex chars) over UTF-8 bytes. Four producers per
input:

- **BT** browser, Terser-minified bundle
- **BE** browser, esbuild-minified bundle
- **NS** Node `sass.node.js`, same in-memory string map + same importer
- **NF** Node `sass.node.js`, **real filesystem importer with
  `loadPaths: [node_modules]`** -- i.e. how `compile-default-css` resolves the
  island's bare `@import 'foundation-sites/scss/...'` today

| Input | bytes | sha256[0:16] | BT | BE | NS | NF |
| --- | --- | --- | --- | --- | --- | --- |
| `default` | 5839 | `49bfb1a2e67bf91a` | = | = | = | = |
| `themed` | 5840 | `0ed1b8ba6bf3c86d` | = | = | = | = |
| `compliant` | 5805 | `efc3da5be5bf9dab` | = | = | = | = |

**`ALL IDENTICAL: true`. Zero divergence, zero findings.** Not "semantically
identical" -- the same 5839 / 5840 / 5805 bytes with the same digest.

This closes ticket 03's open item ("my two probes agree to within a deliberate
2-byte input difference, which is suggestive, not proof"). It is now proof, and
it holds across a runtime axis (browser vs Node), a minification axis (Terser vs
esbuild vs none) **and** a resolution axis (in-memory string map vs real
filesystem + `loadPaths`). The last one matters most for ticket 08: the
importer rewrite of `foundation-sites/scss/...` -> `fnd:/scss/...` is
**output-equivalent to `--load-path=node_modules`**, not merely close.

### Importer behaviour in the browser, measured

| Metric | Browser | Ticket 03 (Node, simulated globals) |
| --- | --- | --- |
| `canonicalize` calls | **17** | 17 |
| of which `fromImport: true` | **14** | 14 |
| `load` calls | **16** | 16 |
| unresolved (`misses`) | **0** | 0 |
| `loadedUrls` | 16, same order | 16 |

Identical. The legacy `@import` island resolves through a browser importer with
no special handling beyond the bare-URL rewrite.

### API-surface probe, executed in Chromium

| Call | Result in the browser |
| --- | --- |
| `sass.compile('x.scss')` | throws `The compile() method is only available in Node.js.` |
| `sass.compileAsync('x.scss')` | throws **synchronously**, same message |
| `sass.renderSync({file})` | throws `The renderSync() method is only available in Node.js.` |
| `compileString('@use "x";', {loadPaths:['.']})` | throws `Custom importers are required to load stylesheets when compiling in the browser.` -- **`loadPaths` inert, confirmed live** |
| `Object.keys(sass).length` | **40** |

Every one of ticket 03's Node-simulated API claims reproduces in a real browser.

### Error shape (panel-readiness for ticket 09)

With `alertColor: false`:

```
instanceof sass.Exception : true
constructor.name          : "sass.Exception"
sassMessage               : "$color: notacolor is not a color."
span.url                  : "fnd:/scss/components/_button.scss"
message contains ANSI     : false
```

Ticket 03's `alertColor: false` recommendation is confirmed necessary and
sufficient. `span.url` is the importer's own canonical URL, so a panel can map
it back to a friendly source name. Zero console errors or warnings across the
whole run (`quietDeps: true` + `silenceDeprecations` working as documented).

---

## 4. JOB 3 -- the `$global-left` / `$global-right` RTL rebind (the crux)

**VERIFIED, no silent behavioural difference.** Foundation's *unmodified*
`button-dropdown` mixin, compiled in a real Chromium from the in-memory string
map, emits:

```css
.button.dropdown::after {
  display: block;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0.4em;
  content: "";
  border-bottom-width: 0;
  border-color: #fefefe transparent transparent;
  position: relative;
  top: 0.4em;
  display: inline-block;
  float: inline-end;
  margin-inline-start: 1em;
}
```

That is byte-for-byte what `_foundation-button.scss`'s post-`@import` `!global`
rebind is documented to produce. Static assertions over the browser-produced
CSS:

```
[OK]  float: inline-end present
[OK]  margin-inline-start present
[OK]  NO physical float: right
[OK]  NO physical float: left
[OK]  NO margin-left in dropdown block
[OK]  NO [dir] selector anywhere
[OK]  NO :dir( selector anywhere
logical-direction tokens in the sheet: 2
```

Exactly **2** logical-direction tokens in the entire 5840-byte sheet, matching
the source comment's claim that these are "the only two genuinely directional
declarations the whole sheet contains".

### Live computed-style proof, both directions

The CSS was injected into a real `<style>` and read back with
`getComputedStyle(el, '::after')` -- so this is the browser's own resolution,
not a string match.

| | `dir="ltr"` | `dir="rtl"` |
| --- | --- | --- |
| `float` (computed) | `inline-end` | `inline-end` |
| `margin-left` | **14.4px** | 0px |
| `margin-right` | 0px | **14.4px** |

**The same single stylesheet flips.** `margin-inline-start: 1em` resolves to
`margin-left` in LTR and `margin-right` in RTL, at 14.4px (`1em` at the
inherited 0.9rem font-size). R004's "RTL from one stylesheet" holds under
browser compilation. Chromium reports computed `float` as the logical keyword
`inline-end` rather than resolving it -- that is Chromium's serialisation
behaviour, not a Sass difference, and the margin flip is the load-bearing
evidence.

### The other `!global` rebind (`$button-radius`) also holds

| Case | emitted `border-radius` | computed `borderTopLeftRadius` |
| --- | --- | --- |
| `default` | `0` | `0px` |
| `themed` (`$radius: 6px`) | `6px` | **`6px`** |
| `compliant` (no `$radius`) | `0` | `0px` -- **restored**, not leaked |

And the palette path:

| Case | emitted `background-color` | computed `backgroundColor` |
| --- | --- | --- |
| `default` | `#1779ba` | `rgb(23, 121, 186)` |
| `themed` (`$background: #2a5db0`) | `#2a5db0` | `rgb(42, 93, 176)` |
| `compliant` (no `$background`) | `#1779ba` | `rgb(23, 121, 186)` |

`with-radius`'s unconditional restore works across repeated compiles in one
long-lived page -- the third case reverting to `0` / `#1779ba` is the proof that
nothing leaks between compiles.

**Harness artefact worth recording** (it briefly looked like a real defect):
Foundation emits `transition: background-color 0.25s ease-out` on `.button`, so
`getComputedStyle` sampled a **mid-flight interpolated colour** and the readings
appeared to lag one case behind (`themed` reporting `#1779ba`, `compliant`
reporting `#2a5db0`). It was the transition, not Sass -- the emitted CSS was
correct throughout. `harness.html` now sets `* { transition: none !important }`.
Any future in-Storybook visual assertion on themed colours needs the same
guard, or it will flake.

---

## 5. Worker, blocking and responsiveness

### Main thread blocks for the full compile duration

`measureFrameGap` runs a rAF loop and times a single sync compile inside it:

| Metric | Terser bundle | esbuild bundle |
| --- | --- | --- |
| compile duration | 328.5 ms | 267.5 ms |
| **max rAF gap during it** | **336.9 ms** | **271.9 ms** |

The frame gap tracks the compile 1:1 -- **the main thread is fully blocked, no
yielding.** `PerformanceObserver('longtask')` independently recorded entries of
84 / 329 / 1978 ms (the 1978 ms one is the `compileStringAsync` call, which
blocks just as hard despite being "async").

At ~20 dropped frames per compile, per keystroke, on a control slider, this is
well past any interactivity budget.

### A Worker fixes it completely -- measured

`run-worker.mjs` bundles the same code with `target: 'webworker'` and the same
Terser config, runs 10 compiles in a real `Worker`, and watches rAF on the main
thread:

| Metric | Measured |
| --- | --- |
| worker bundle | 4,235,013 B raw / 801.0 KiB gzip / 434.5 KiB brotli |
| cold compile (in worker) | 587.4 ms |
| warm compiles (9) | min 163.3 / p25 166.0 / **median 197.4** / p75 212.3 / max 289.1 ms |
| wall for all 10 | 2678.8 ms |
| **max MAIN-THREAD frame gap during all 10** | **19.1 ms** |
| frames observed | 162 |
| CSS produced | 5840 B -- identical |

**19.1 ms against a 16.7 ms frame budget. The UI stays live.** A Worker is
required, not merely nice -- and it is cheap: same bundle, `target: 'webworker'`,
one `postMessage` round trip.

Interesting secondary result: **the worker's warm median (197.4 ms) beats the
main thread's (280 ms)** for the same work on the same machine. INFERRED: the
main-thread harness page is also servicing rAF, style recalc and DevTools
protocol traffic; the worker gets a clean thread. So moving to a Worker is not
just a responsiveness win, it looks like a ~30% throughput win too.

Note on ticket 01's finding: it observed the reference project's **worker pool**
was a throughput optimisation that buys nothing for a one-component repo. That
stands -- **a pool is unnecessary; a single worker is not.** One worker is what
converts 337 ms of jank into 19 ms.

### Research/03's "trap B" -- CONFIRMED

Inside the Worker: `typeof self.document === 'undefined'`, so Dart Sass's
`isBrowser()` is false. A `compileString('@use "x";')` with no importers threw
the **generic** `Can't find stylesheet to import.` instead of the main thread's
friendly `Custom importers are required to load stylesheets when compiling in
the browser.` Real but low-impact: it only affects the *missing-importer*
diagnostic, which is a programming error the addon will never hit at runtime.
Ordinary Sass errors keep their full message, `sassMessage` and `span.url` (see
section 3) inside a Worker just as on the main thread.

---

## 6. Payload and source-closure numbers

### What the importer had to serve (sizes the ticket asked for)

16 files, **86,397 bytes raw** -- 13 Foundation partials + 3 `nfs` partials,
exactly the closure ticket 03 measured:

```
nfs:/_button.scss                    fnd:/scss/_global.scss
nfs:/internal/_foundation-button.scss fnd:/scss/components/_button.scss
nfs:/internal/_settings.scss         fnd:/scss/util/_breakpoint.scss
fnd:/scss/util/_color.scss           fnd:/scss/util/_direction.scss
fnd:/scss/util/_flex.scss            fnd:/scss/util/_math.scss
fnd:/scss/util/_mixins.scss          fnd:/scss/util/_selector.scss
fnd:/scss/util/_typography.scss      fnd:/scss/util/_unit.scss
fnd:/scss/util/_util.scss            fnd:/scss/util/_value.scss
```

As a shipped JSON string map: **87.7 KiB raw / 24.3 KiB gzip.** Ticket 03's
23.4 KiB estimate confirmed (delta is JSON escaping).

### What `sass` costs, measured on a real bundle

| Artefact | raw | gzip | brotli |
| --- | --- | --- | --- |
| sass + importer + sources, Terser (prod branch) | **4140.7 KiB** | **802.3 KiB** | **435.7 KiB** |
| same, esbuild (`--test` branch) | 3339.0 KiB | 716.9 KiB | 395.7 KiB |
| same, `target: webworker`, Terser | 4135.8 KiB | 801.0 KiB | 434.5 KiB |

Note these are **smaller than ticket 03's raw-source figures** (it cited ~5.66
MiB raw / ~916 KiB gzip from unbundled file sizes). Bundling + Terser
(whitespace/comment stripping, which survives `mangle: false`) removes ~1.4 MiB
raw / ~114 KiB gzip. Use **~800 KiB gzip / ~436 KiB brotli** as the real number.

**For scale:** this repo's current Storybook preview ships **4.72 MiB raw /
1140.2 KiB gzip** of JS across 14 chunks. Adding sass statically would be a
**+70% gzip** increase to the preview's initial payload. That strongly supports
ticket 03's inferred recommendation, now with a number behind it: put sass in a
Worker (a separate chunk by construction) or behind `await import('sass')`, so
a story that never opens the theming panel pays nothing.

---

## 7. VERIFIED vs INFERRED vs not testable here

### VERIFIED by execution in a real browser (Chromium 151, Playwright)

- Storybook's production Terser config is `mangle: false, keep_fnames: true`,
  the Angular layer does not override it, and the **real `build-storybook`
  output** retains 2751 function names / 441 class names / 1781 local names
  while being minified to 29 lines.
- dart-sass compiles the real `theme()` chain in a real browser through that
  exact minimizer. Also through the `esbuildMinify` (`--test`) minimizer, which
  IS mangling and does NOT break it.
- Bare `import * as sass from 'sass'` on a web target resolves to
  `sass/sass.default.js` under a real webpack run with Storybook's conditions.
- Browser CSS is **byte-identical** to Node's for all three inputs, across four
  producers (browser-Terser, browser-esbuild, Node-stringmap, Node-filesystem
  with `loadPaths`).
- The importer sees 17 `canonicalize` (14 `fromImport`) / 16 `load` / 0 misses
  in the browser -- identical to Node.
- `compile` / `compileAsync` / `renderSync` throw in the browser; `loadPaths` is
  inert; `Object.keys(sass).length === 40`.
- `float: inline-end` + `margin-inline-start: 1em` emitted from Foundation's
  UNMODIFIED `button-dropdown`, and the computed margin flips left<->right with
  `dir` in a live browser. No `[dir]`, no `:dir()`, exactly 2 logical tokens.
- `with-radius`'s `!global` rebind and restore work across repeated compiles in
  one page.
- Warm main-thread compile: median 280-305 ms, p95 ~350 ms, max 394 ms (40
  samples per input); cold compile 556 ms; bundle init 177 ms.
- Async is ~6-7x slower than sync in the browser (1994 ms vs ~280 ms).
- Sync compile fully blocks the main thread (337 ms compile -> 337 ms frame gap).
- A single Worker drops the max main-thread frame gap to **19.1 ms** and is
  ~30% faster per compile than the main thread.
- Inside a Worker `document` is undefined and the missing-importer diagnostic
  degrades to the generic message (research/03's trap B).
- `alertColor: false` yields ANSI-free `message`; `sassMessage` and `span.url`
  are panel-ready; `e instanceof sass.Exception` survives both minifiers.
- Zero console errors/warnings for the whole run with `quietDeps: true` +
  `silenceDeprecations`.

### INFERRED (reasoned from measurements, not directly measured)

- The mid-run ~1.7x latency step change is V8 tier-down or Snapdragon
  DVFS/thermal behaviour. Not isolated; only the effect is measured.
- The Worker's throughput advantage comes from a contention-free thread.
- The `--test` branch is *probably* safe generally, but only `compileString` +
  custom importers + the error path were exercised, on 1.102.0.
- `await import('sass')` / worker chunking remains the right default, now backed
  by the +70%-of-current-preview-gzip figure.

### NOT testable under the no-code-changes constraint

1. **sass inside the REAL Storybook preview bundle.** Wiring an addon or a story
   that imports `sass` requires touching `packages/`, `.storybook/` or a config
   file. I substituted a standalone webpack build using the **verbatim**
   minimizer, resolver conditions, `mainFields`, `extensions` and `fallback`
   from `preview-preset.js`, plus static analysis of the real emitted bundle.
   That is strong, but it is not the same as observing sass survive
   `build-storybook`. **Ticket 08 should re-confirm once the addon exists** --
   it should be a formality.
2. **Cold HTTP cache over a real network.** The harness served uncompressed
   bytes from `127.0.0.1` with `cache-control: no-store`. Transfer time is
   therefore ~0 and the 205 ms navigation figure is essentially
   parse+init-bound. A real deployment moves ~802 KiB gzip. Not measured.
3. **`build-storybook` with `test: true` actually running.** That needs
   `project.json` edited. I proved the branch's *minifier* is harmless by
   reproducing it exactly in a standalone bundle; I did not run the full
   Storybook build under it (it also flips `disableTreeShaking`,
   `disableSourcemaps`, `disableDocgen`, `disableMDXEntries`, `disableAutoDocs`
   and disables addon-docs -- unrelated to sass, but not exercised).
4. **The Storybook manager/panel side.** Ticket 04 owns that lane; nothing here
   touched the manager.
5. **Non-Chromium browsers.** Only Chromium 151 was driven. Firefox/WebKit
   dart2js behaviour is untested (`@playwright/test` is installed, but browser
   binaries for those were not verified and installing them was out of scope).

---

## 8. What this hands to the downstream tickets

**Ticket 08 (Foundation Sass into the browser).**
- The importer's `foundation-sites/scss/...` -> `fnd:/scss/...` rewrite is
  **output-equivalent to `--load-path=node_modules`**, proven byte-for-byte.
  A working reference implementation is `prototypes/importer.mjs` (~100 lines,
  sync, no dependencies).
- Ship 16 files / 87.7 KiB raw / **24.3 KiB gzip** as a string map.
- `sass` itself is **802 KiB gzip / 436 KiB brotli** bundled, = +70% on the
  preview's current 1140 KiB gzip. Do not put it in the initial graph.
- **Drop the "guard `build-storybook --test`" action item to a comment.** No
  breakage exists to guard.

**Ticket 09 (recompile trigger / loading / error UX).** The fog can now lift:
- Budget **~300 ms median, ~350 ms p95** per compile, **556 ms** for the first.
- On the main thread that is a full block -- ~20 dropped frames per compile.
- **A single Worker is required** (19.1 ms max frame gap), and a pool is not
  (ticket 01's finding stands).
- Use **sync** `compileString` inside the worker. Async costs 6-7x for nothing.
- Debounce is still wanted -- ~300 ms per compile means a dragged slider
  outruns the compiler even off-thread. INFERRED starting point: trailing
  debounce at roughly one compile interval (~250-300 ms), plus drop-stale
  (ignore results for superseded input).
- The panel has clean material for errors: `e.sassMessage` and `e.span.url`
  with `alertColor: false`.
- A mid-compile indicator is warranted -- 300 ms is above the ~100 ms
  "instantaneous" threshold.

**Ticket 10 / anyone writing browser assertions on themed colour.** Foundation's
`transition: background-color 0.25s ease-out` will make `getComputedStyle`
colour assertions flake. Disable transitions in the fixture.

**Ticket 03's open items** are all now closed: real-browser latency (2.2x its
Node figures), byte-for-byte equality (exact), and the RTL `!global` rebind
(holds, both directions, live).
