# Prototype: compile the real theme() chain in a browser and measure it

Type: prototype
Status: open
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
