# Decision: how does Foundation's Sass reach the browser?

Type: research
Status: resolved
Blocked by: 03, 05

## Question

Browser-side Sass has no filesystem, so every source the `theme()` chain reaches
must be handed to the compiler as a string. Decide the mechanism.

The chain is: `scss/_button.scss` -> `internal/_foundation-button.scss` (the
legacy `@import` island) -> a subset of `node_modules/foundation-sites/scss`,
plus `internal/_settings.scss`.

**Tickets 03 and 05 already sized this, and the number is far smaller than the
map first assumed.** Foundation's whole tree is 367.6 KiB (not 501K), and the
**reachable closure is 13 files / 71.9 KiB -- 24.3 KiB gzipped** including the
three nfs partials (ticket 05's measured figure). Both tickets compiled the
entire chain from an in-memory string map, and ticket 05 proved the output is
**byte-identical (same sha256) to a Node filesystem build using
`loadPaths: [node_modules]`** -- so the importer's `foundation-sites/scss/`
rewrite is output-equivalent, and "can an importer serve this from strings" is
settled *yes*.

This ticket therefore decides only **how those strings get there**. Re-weigh
accordingly: at 24.3 KiB gzip the sources are nearly free, and the dominant
payload is the `sass` bundle itself -- measured by ticket 05 at **802 KiB gzip /
436 KiB brotli**, which is **+70% on this preview's current 1140 KiB gzip**.
That bundle, not Foundation, is the cost to manage, so weigh lazy-loading it on
first addon use.

Options to weigh:

1. **Build-time inlining** -- a build step walks the reachable sources and emits
   a virtual filesystem object the importer serves. Deterministic, no network,
   but adds a generator and a staleness risk.
2. **Runtime fetch** -- the addon fetches sources over HTTP as the importer
   requests them. No build step, but async importer semantics, network latency
   inside the compile loop, and a static-build path question.
3. **Pre-flattening** -- resolve the chain to a single Sass string once, at build
   time, so the browser importer has little or nothing to resolve. Cheapest at
   runtime; must not break the `!global` rebind semantics the theme depends on.
4. **Bundler raw imports** -- let the builder inline the sources. NOTE: ticket
   03 corrected the map's premise here. `@storybook/angular@10.5.6` builds with
   **webpack 5** (`@storybook/builder-webpack5`), *not* Vite -- so
   `import.meta.glob` and `?raw` are unavailable, and this option means
   webpack's `asset/source` / `raw-loader` instead. Re-evaluate it on that
   basis rather than the Vite framing.

Decide using ticket 05's measurements -- specifically the byte count of actually
reachable sources and the compile timing -- rather than in the abstract.

Also settle:

- **Where does the `sass` browser bundle itself come from**, and is it
  statically imported or lazily loaded on first use? Ticket 03 verified
  `import 'sass'` resolves to the browser build under Storybook's own webpack
  conditions with **no alias**, and that the bundle is ~916 KiB gzip with zero
  tree-shaking -- so lazy loading is about *when* that cost lands, not whether
  it can be reduced.
- **Main thread or Web Worker? SETTLED by ticket 05: a single Worker, sync
  compile.** Measured in real Chromium: main-thread compilation blocks for
  337 ms (~20 dropped frames), while a single Worker cuts the max main-thread
  gap to 19.1 ms *and* runs ~30% faster (197 ms vs 280-305 ms median). Async is
  6-7x slower again. A pool is not needed (ticket 01). This ticket only needs to
  decide how the sources reach the Worker, noting research/03's "trap B": there
  is no `document` in a Worker, and the missing-importer diagnostic degrades.
- **`build-storybook --test` is a WATCH ITEM, not a blocker.** Ticket 05
  downgraded it by building that branch: it is heavily mangled (254 two-char
  function declarations, zero long locals) yet dart-sass **still produced
  byte-identical CSS** with `sass.Exception` identity intact. The branch is
  reachable (`test` is a first-class option in
  `@storybook/angular/build-schema.json`, unset in this repo) but harmless.
  Decide whether it is worth any guard at all.
- **Does the chosen mechanism survive `build-storybook`** (the static build), not
  just the dev server? A mechanism that only works in dev fails the same way
  M003's host matrix was designed to catch.
- **The `@import` removal horizon.** `internal/_foundation-button.scss`'s own
  header names Dart Sass 3.0.0 (floor 2026-10-17, realistically later) as the
  point `@import` disappears. If in-browser compilation depends on `@import`, the
  addon inherits that clock. State the exposure and whether any option reduces
  it.

## Notes

Note the existing precedent worth not breaking: `internal/*` is deliberately
`null` in the package exports map, and `internal/_foundation-button.scss` is
documented as "the single file to vendor or freeze". Whatever mechanism wins
should not quietly turn internal partials into a public surface.

## Answer

Full reasoning: `../research/08-foundation-sass-into-the-browser.md`.

**LOCKED: build-time inlining.** A generator at
`packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs` compiles
the real chain in Node with a disk-backed importer, records exactly the URLs it
served, and emits a **committed** TS data module under `.storybook/`, which the
Worker feeds to the importer verbatim -- gated by a new `verify-theming-sources`
on `lint`'s `dependsOn`.

**Bundler raw imports are BLOCKED, not merely worse.** Angular's `.scss` webpack
rule applies `resolve-url-loader` + `sass-loader` through an **unconditional**
nested `{ use }`; the `oneOf` branches only on `?ngGlobalStyle` / `?ngResource`
(`@angular-devkit/build-angular/.../styles.js:224-289`). No query escapes it, so
`?raw` has no webpack analogue here. A naive raw import dies in the JS parser,
and adding `type: 'asset/source'` yields **compiled CSS, not raw Sass** -- a
silently wrong string. Escaping needs surgery on Angular's generated rule array,
`raw-loader` is not installed, and it is the only option forcing a
`webpackFinal` into `main.ts` (currently absent).

**Runtime fetch** forfeits the locked sync compile (async is 6-7x slower), needs
`staticDirs` to have anything to fetch in the static build, and would publish
`src/scss/internal/*` as fetchable URLs -- closer to promoting internals than
any other option. **Pre-flattening** saves <0.5% (24.3 KiB gzip against an
801 KiB worker chunk), costs all of option 1's machinery *plus* an unverified
Sass transform whose failure mode is wrong-CSS-that-still-compiles (the
`!global` rebinds run after the `@import` block), and does not move the 3.0.0
clock.

**Sub-decisions:**

1. **`sass` is lazy by construction** -- imported from the worker module and
   nowhere else, so webpack's worker chunk *is* the split point; no
   `await import()` needed. Preview boot stays 1140 KiB gzip, with ~825 KiB
   fetched on first theme interaction. Ticket 07's preset probe must therefore
   also live in the Worker.
2. **Survives `build-storybook`** -- the artifact is a plain TS module, no
   loader, plugin or network. `static-storybook` serves `dist/`, so ticket 04's
   Playwright lane already *is* the static-build proof.
3. **Staleness** -- the closure is *discovered by compiling*, never hand-
   enumerated, so a Foundation in-range bump (`^6.9.0` against pinned `6.9.0`)
   or an upstream `@import`-graph change fails the byte-compare loudly, visible
   in the PR diff. Plus a fitness assertion re-proving string-map CSS ==
   filesystem CSS -- ticket 05's sha256 result turned into a standing gate.
4. **Artifact location `.storybook/`** -- inside `default` (a `build-storybook`
   input) but outside `production`, so no churn on
   `build`/`verify-exports-map`/`lint`; and unreachable by `ng-package.json`'s
   single `src/scss` asset glob, so it cannot ship.

**Ticket 06's rule 2 is AMENDED, not silently broken.** Independently confirmed:
root `node_modules/ngx-foundation-sites` symlinks to the *source* tree, which has
`src/scss/` and no top-level `scss/`, so `ngx-foundation-sites/scss/button` is
unresolvable from the workspace root and rule 2 is unsatisfiable by any
mechanism. Amended boundary: **addon runtime code imports nothing outside
`.storybook/`; the generator is a build script reading workspace-relative
paths** -- already the repo's idiom (`verify-foundation-parity.mjs:34` and
`compile-default-css` use those exact load paths, and `eslint.config.mjs:19-24`
already exempts `scripts/**/*.mjs` from dependency-checks for this reason).

**Routed to ticket 09 as a first-action spike:** Angular gates worker handling on
`worker: !!webWorkerTsConfig` (`common.js:333`) and Storybook never sets it, so
`new Worker(new URL(...))` is unproven in this setup.

**`@import` horizon:** inherits the 3.0.0 clock exactly -- adds nothing, reduces
nothing, and no option on the table reduces it; the Node build has identical
exposure today. One favourable side effect, stated and no further: the generated
module *is* the vendored 16-file snapshot, so the eventual freeze costs one
deleted target.

**Lazier alternative considered and rejected:** regenerate into a gitignored
path (no committed artifact, no gate). It makes staleness impossible but needs
`dependsOn` on two targets, breaks a fresh clone's `lint`, and decisively lets a
Foundation bump change the addon's CSS with zero diff anywhere.
