# Dart Sass in the browser: what is actually supported

Type: research
Status: resolved
Blocked by: --

## Question

The founding brief asserts in-browser Sass compilation is available "via the
`sass` npm package's browser build, supported since Dart Sass 1.63". Verify that
claim and map its real limits. This repo already depends on `sass ^1.102.0`.

1. **Is the claim true, and what exactly ships?** Confirm the version floor and
   what the browser entry point provides. Which API is available in a browser:
   `compileString` / `compileStringAsync` only, or also `compile` /
   `compileAsync`? Confirm that the filesystem-backed entry points are *not*
   available in a browser, since that determines everything downstream.
2. **The importer API in a browser.** Foundation's Sass is reached through a
   legacy `@import` island
   (`packages/ngx-foundation-sites/src/scss/internal/_foundation-button.scss`)
   which pulls in `node_modules/foundation-sites/scss` -- 501K of source with no
   filesystem in the browser. What is the exact shape of a custom importer
   (`importers` / `Importer` / `canonicalize` + `load`) that resolves those
   `@import`s from in-memory strings? Does the importer API differ between
   `@import` and `@use` resolution, and does it work for the legacy `@import`
   path specifically?
3. **Bundle cost and loading.** How large is the browser build of `sass` (it is
   Dart compiled to JS)? Does it ship ESM, and is it tree-shakeable (probably
   not -- confirm)? Is a Web Worker the recommended host, and does the package
   document a worker or async story?
4. **Vite / Storybook builder integration.** Storybook 10 builds the preview
   with Vite. What breaks when `sass` is imported into *browser* code rather
   than config code -- Node built-in polyfills (`fs`, `path`, `url`), `process`
   references, `optimizeDeps` handling? Find the known-good pattern, including
   whether it must be dynamically imported.
5. **Deprecation horizon.** Dart Sass 3.0.0 removes `@import`. The repo's own
   `internal/_foundation-button.scss` header names this as a known future
   break. Does the browser build have the same `@import` support and the same
   removal timeline? If in-browser compilation depends on `@import` surviving,
   say so plainly -- it is a material risk to the whole approach.

Deliver a findings document that ends with a clear verdict: **is browser-side
compilation of this specific `theme()` chain feasible as described**, and what
the non-obvious costs are.

## Notes

Primary sources: `sass-lang.com` documentation (JS API + browser section), the
`sass` package's own README and release notes for 1.63, and
`node_modules/sass` in this repo (use `rg`, not `git grep` -- it is gitignored).
Do not answer this from memory; the browser story has changed repeatedly.

## Answer

Full findings: `../research/03-dart-sass-in-the-browser.md` (585 lines).

**Verdict: feasible, and verified by execution rather than argued.** The real
`theme()` chain -- `_button.scss` -> the legacy `@import` island -> 13
Foundation partials -> `_settings.scss` -- compiled to **5842 bytes of CSS from
a pure in-memory string map**, using the actual browser entry point under
simulated browser globals so the compiler took its real browser code paths
(no filesystem, `loadPaths` inert, `compile()` throwing).

- **The 1.63 claim is true.** Browser entry is `sass.default.js` / `.cjs`,
  selected by *elimination* -- there is no `browser` field; a web-target
  resolver simply misses the `node` condition. Verified with webpack's own
  `enhanced-resolve` under Storybook's exact condition names: `import 'sass'`
  resolves to the browser build with **no alias needed**.
  `compile`/`compileAsync`/`render`/`renderSync`/`NodePackageImporter` are
  exported but throw; `loadPaths` is inert. `compileString(+Async)` +
  `importers` is the entire usable surface.
- **The importer API does NOT differ between `@import` and `@use`** -- same
  `canonicalize`/`load` pair, same `ImportCache`, differing only by
  `context.fromImport`. On this chain **14 of 17 canonicalize calls carry
  `fromImport: true` and all resolve**. Foundation ships zero `.import.scss`
  and zero index files, so the flag has no behavioural consequence here. One
  real obligation: `@import 'foundation-sites/scss/util/util'` is a bare
  load-path URL, so Sass treats it as *relative* -- the importer must rewrite
  it, since `--load-path=node_modules` has no browser equivalent.
- **The `@import` deadline is inherited.** There is one `sass.dart.js`; entries
  differ only in injected deps. Deprecated 1.80.0 (2024-10-17), removal in
  3.0.0, floor 2026-10-17 -- matching the island header exactly. The chain
  depends on **two** things surviving, not one: `@import` *and* global built-in
  functions, which are removed together.

**Non-obvious costs:** ~916 KiB gzip payload with zero tree-shaking (0 exports,
0 imports, 0 `__PURE__` across 133k lines); 150-215 ms blocking per compile;
ANSI escape codes in `e.message` by default on the main thread
(`alertColor: false` fixes it); 16 deprecation warnings per compile unless
`quietDeps: true`; `globalThis` pollution (`immutable`, plus `fs`/`util`/
`stream` as undefined keys); `compileAsync` throws *synchronously*;
`initCompiler()` gives no speedup; and **`build-storybook --test` would break
it** (that branch uses esbuildMinify without `keepNames`) -- not currently used,
but worth guarding.

Left deliberately to ticket 05: real in-browser latency, a byte-for-byte diff
against the Node build, and the `$global-left`/`$global-right` RTL rebind
assertion.
