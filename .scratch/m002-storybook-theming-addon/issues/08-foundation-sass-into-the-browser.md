# Decision: how does Foundation's Sass reach the browser?

Type: research
Status: open
Blocked by: 03, 05

## Question

Browser-side Sass has no filesystem, so every source the `theme()` chain reaches
must be handed to the compiler as a string. Decide the mechanism.

The chain is: `scss/_button.scss` -> `internal/_foundation-button.scss` (the
legacy `@import` island) -> a subset of `node_modules/foundation-sites/scss`,
plus `internal/_settings.scss`.

**Ticket 03 already sized this, and the number is far smaller than the map first
assumed.** Foundation's whole tree is 367.6 KiB (not 501K), and the **reachable
closure is 13 files / 71.9 KiB -- 23.4 KiB gzipped** including the three nfs
partials. Ticket 03 compiled the entire chain from an in-memory string map, so
"can an importer serve this from strings" is settled *yes*; this ticket decides
only **how those strings get there**. Re-weigh the options accordingly: at 23.4
KiB gzip, mechanisms that looked expensive are cheap, and the dominant payload
is the ~916 KiB gzip `sass` bundle itself, not Foundation.

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
- **Main thread or Web Worker?** Ticket 03 already narrowed this:
  `compileStringAsync` is roughly **10x slower** than `compileString`
  (1.56-2.11 s vs 0.14-0.21 s), so the correct shape is **sync compile inside a
  Worker**, not async on the main thread. Confirm against 05's blocking
  measurement, but do not resurrect async-on-main-thread -- ticket 01's
  reference implementation used async-in-worker, which buys nothing.
- **Guard `build-storybook --test`.** Ticket 03 found that branch uses
  esbuildMinify without `keepNames`, which breaks dart-sass. It is not
  currently used here; decide whether to guard it explicitly.
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
