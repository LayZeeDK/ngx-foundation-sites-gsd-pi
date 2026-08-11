# Prototype: compile the real theme() chain in a browser and measure it

Type: prototype
Status: resolved
Blocked by: 03

## Question

Unknown #1 of the founding brief: is in-browser Sass compilation *correct* and
*fast enough* at variable-change frequency?

**Ticket 03 already settled more of this than originally scoped.** It compiled
the real chain (13 Foundation partials + 3 nfs partials, 71.9 KiB) to 5842 bytes
of CSS from a pure in-memory string map, on the browser code paths under
simulated browser globals, and measured 150-215 ms per sync compile
(`compileStringAsync` ~10x slower). Do **not** redo that. Ticket 03 explicitly
left three things to a real browser, and they are this ticket's whole job:

1. **Real in-browser latency** on real hardware (Snapdragon X Elite, arm64) --
   simulated-global timings are indicative, not authoritative.
2. **A byte-for-byte diff** of browser-produced CSS against the Node build's
   output for the same input. Any divergence is a finding.
3. **The `$global-left` / `$global-right` RTL rebind assertion** -- M003's RTL
   correctness depends on Foundation's unmodified `button-dropdown` mixin
   emitting `float: inline-end` / `margin-inline-start` from the `!global`
   rebind. A silent behavioural difference here would be far worse than an
   outright compile failure, and nothing so far has verified it in a browser.

**4. ADJUDICATE A DIRECT CONTRADICTION between tickets 01 and 03.** Dart Sass
requires function renaming to be disabled or it breaks at runtime. The two
research tickets disagree on whether this repo's Storybook already satisfies
that:

- **Ticket 03 says satisfied out of the box** -- it reports Storybook's Terser
  config as `mangle: false, keep_fnames: true`, meeting dart-sass's requirement
  with no action needed.
- **Ticket 01 says unmitigated** -- it reports `@storybook/angular` on
  builder-webpack5 with Terser mangling unaddressed, and flags this as the
  highest-risk unknown. It notes the reference project sidestepped the question
  by bundling out-of-band, so it offers no evidence either way.

Ticket 03's claim is the more specific one (it names the config values) and is
the more likely correct, but **do not resolve this by preferring one report.**
Settle it empirically: build the addon path through this repo's real
`build-storybook` with production minification on, and confirm dart-sass still
runs. This is the single finding most likely to invalidate the approach late,
so it should be proven before any other measurement here.

Note also ticket 03's related trap: `build-storybook --test` uses esbuildMinify
*without* `keepNames` and would break dart-sass regardless. That branch is not
currently used, but confirm it is not silently reachable.

Build the smallest possible **real browser** page (it need not be inside
Storybook -- any throwaway harness is fine for iterating, though note the real
target builds with webpack 5, not Vite) that:

1. Loads `sass`'s browser build.
2. Compiles a string equivalent to
   `@use 'ngx-foundation-sites/scss/button' as nfs-button; @include nfs-button.theme($background: #2a5db0, $palette: (success: #238648), $radius: 6px);`
   with a custom importer serving the real sources: `src/scss/_button.scss`,
   `src/scss/internal/_foundation-button.scss`, `src/scss/internal/_settings.scss`,
   and whatever subset of `node_modules/foundation-sites/scss` the legacy
   `@import` island actually reaches.
3. Injects the output and re-compiles on a control change.

Report:

- **Does it compile at all?** Especially: does the legacy `@import` island
  resolve through a browser importer, and does the `!global` rebind of
  `$global-left`/`$global-right`/`$global-radius` still behave? A silent
  behavioral difference here would be worse than an outright failure.
- **Is the output byte-identical** (or semantically identical) to what Node-side
  `sass` produces for the same input? Diff them. Any divergence is a finding.
- **How long does one compile take?** Cold and warm, on this machine
  (Snapdragon X Elite, arm64). Report a distribution, not one number.
- **How much of Foundation's tree is actually reachable?** Byte count of the
  sources the importer had to serve. This sizes the bundling problem for
  ticket 08.
- **What does the `sass` browser bundle cost** in transferred and parsed bytes?
- **Does it block the main thread**, and for how long? This determines whether a
  Web Worker is required or merely nice.

Keep the prototype in `.scratch/m002-storybook-theming-addon/prototypes/` or a
throwaway branch. It is disposable evidence, not code destined for the repo.

## Notes

Agent-driven despite being a `prototype` ticket: with no human in the loop, the
agent resolves it by measuring the artifact, not by a human reacting to it.

The measured numbers feed three downstream decisions: how Foundation's Sass
reaches the browser (08), whether the control surface needs debounce/worker
machinery (09), and what the "Not yet specified" recompile-UX fog can graduate
into. Report raw numbers even where they look fine -- a fast result is as
decision-relevant as a slow one.

## Answer

Full findings: `../research/05-compile-the-real-chain-and-measure.md`.
Prototype harness: `../prototypes/`.

**Job 4 -- the contradiction is settled: ticket 03 was right, ticket 01 was
wrong, and ticket 03's own `--test` caveat was ALSO wrong.** Three lines of
evidence, two of them executed:

1. **Source:** `builder-webpack5@10.5.6` preview-preset (lines 208-238) sets
   Terser `mangle: false, keep_fnames: true`. `@storybook/angular`'s
   `angular-cli-webpack` returns `{...baseConfig, entry, module, plugins,
   resolve, resolveLoader}` -- `optimization` is *not* in the spread, so it
   survives.
2. **Real build:** `nx run ngx-foundation-sites:build-storybook` (19.0s, exit 0).
   The 2.16 MB preview chunk minifies to 29 lines yet retains **2751 unique
   function names, 441 class names, and 1781 long local variable names**.
   Local-name preservation is the decisive proof `mangle: false` actually
   reaches the bundle.
3. **Executed:** `sass` bundled with the verbatim Storybook minimizer, run in
   real Chromium -- compiles correctly.

**Bonus correction:** the `--test` / esbuildMinify branch was also built. It IS
heavily mangled (1 long fn name vs 3413; 254 two-char fn decls; zero long
locals) and dart-sass **still produced byte-identical CSS** with intact
`sass.Exception` identity. The branch is reachable (`test` is a first-class
option in `@storybook/angular/build-schema.json`, unset here) but harmless.
Downgraded from blocker to watch item for ticket 08.

**Job 2 -- byte diff: `ALL IDENTICAL: true`.** 5839/5840/5805 bytes, same
sha256, across four producers (browser-Terser, browser-esbuild, Node string-map,
Node filesystem with `loadPaths: [node_modules]`). The importer's
`foundation-sites/scss/` rewrite is output-equivalent to
`--load-path=node_modules`.

**Job 3 -- the RTL crux PASSES.** Foundation's unmodified `button-dropdown`
emits `float: inline-end; margin-inline-start: 1em`. Live computed style flips
`margin-left: 14.4px` (LTR) -> `margin-right: 14.4px` (RTL) from one stylesheet.
No `[dir]`, no `:dir()`, exactly 2 logical tokens in the sheet. `with-radius`'s
`!global` restore also verified across repeated compiles.

**Job 1 -- latency.** Warm main-thread median **280-305 ms**, p95 ~350 ms, max
394 ms (40 samples/input); **cold 556 ms**; bundle init 177 ms. That is ~2.2x
ticket 03's Node figures -- its "floor, not a promise" caveat was right, and the
multiplier is now known. Distribution is bimodal with a ~1.7x step change
mid-run.

**Extras that change downstream design:**

- The main thread is **fully blocked**: a 328 ms compile produced a 337 ms max
  rAF gap, roughly 20 dropped frames.
- **A single Worker fixes it and is ~30% FASTER**: max main-thread frame gap
  19.1 ms, median compile 197 ms. A pool remains unnecessary (ticket 01 stands).
  Confirms research/03's "trap B": no `document` in a Worker, and a degraded
  missing-importer diagnostic.
- Async in-browser is ~6-7x slower than sync (1994 ms). Sync-in-Worker is
  confirmed as the right shape.
- **Real bundled cost: 802 KiB gzip / 436 KiB brotli** -- smaller than ticket
  03's 916 KiB raw-file estimate, but **+70%** on this preview's current 1140
  KiB gzip. Sources map is only 24.3 KiB gzip.
- Harness gotcha, independently corroborating ticket 04: Foundation's
  `transition: background-color` makes `getComputedStyle` colour assertions read
  mid-interpolation and appear to lag one case. Disable transitions in any
  browser fixture.

**Untestable under the no-code-changes constraint** (substituted a standalone
webpack build with the verbatim config plus static analysis of the real emitted
bundle): sass inside the *real* Storybook preview bundle, cold
HTTP-cache-over-network timing, `build-storybook` with `test: true`, and
non-Chromium engines.
