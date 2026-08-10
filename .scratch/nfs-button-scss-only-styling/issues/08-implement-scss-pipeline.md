# Implement the chosen SCSS styling pipeline

Type: task
Status: resolved
Blocked by: 06, 07

## Question

Build it. Nothing to decide -- ticket 06 fixed the architecture and ticket 07
fixed the Component/Directive question; this ticket makes the repo match.

Expected shape of the work, to be corrected by 06's actual choice:

- Rewrite `packages/ngx-foundation-sites/src/scss/` -- `_settings.scss`,
  `_foundation-button.scss`, `nfs-button.scss` -- from scratch to the chosen
  module boundary and public Sass API, still `@include`-ing Foundation's real
  button mixins per D017 across the full `$button-palette` plus expanded and
  dropdown.
- Wire the component's styles: `styleUrl` plus `encapsulation:
  ViewEncapsulation.None` on NfsButton (the project convention in
  `.gsd/PROJECT.md`, currently absent from `nfs-button.ts`), with the
  `@layer nfs-defaults` wrapper authored in the SCSS source.
- Apply the chosen RTL mechanism from ticket 03 so one stylesheet serves both
  directions.
- Configure every builder ticket 02 named -- ng-packagr load paths in
  `ng-package.json`, Storybook, both Vitest targets -- so all four compile the
  same SCSS identically.
- Reshape or retire the `compile-default-css` Nx target and
  `packages/ngx-foundation-sites/.rtlcssrc.json` to match.

**Two defects in shipped code, found by ticket 05, that this ticket must fix
regardless of which architecture ticket 06 picks:**

1. `ng-package.json`'s `assets` entry is `{"glob": "**/*", "input": "src/scss"}`,
   which publishes `_foundation-button.scss` **and** `verify-parity.mjs`. Any
   consumer can therefore `@use 'ngx-foundation-sites/scss/foundation-button'` and
   obtain Foundation's entire global namespace. D018's isolation boundary is
   currently advisory, not enforced. Narrow the glob to the files that are actually
   public API.
2. `nfs-button.scss` uses `@use './foundation-button' as *`, and `as *` **silently
   false-passes**: an unresolved function such as `rem-calc(16)` compiles without
   error and ships verbatim as a plain-CSS function. Prefer a namespaced `@use`, or
   an explicit member list, so a typo or a missing member fails the build instead
   of shipping broken CSS.

Also carried in from ticket 05: dropping `@forward 'settings'` is a **breaking
change** for `apps/nfs-demo/src/styles.scss`, which currently themes via
`@use 'ngx-foundation-sites/scss/nfs-button' with ($primary-color: #2a5db0)`.
Tickets 10 and 13 update the demo app; make sure the new public API is in place
before they do.

Leave the deletions to ticket 09 -- get the new path working first, so the old
one stays available as a reference while building.

## Answer

Implemented on branch `feat/scss-only-button-styling`, four commits, `main` untouched.

**All gates green on the committed state** (`--skip-nx-cache`): `lint` exit 0 with the
browserslist gate passing at 136 versions, `test` **59/59**, `test-browser` **2/2**,
`build` exit 0, `build-storybook` exit 0, plus `nx build nfs-demo` as a sanity check.
**Zero Sass deprecation warnings in all four builders**, verified independently -- ticket
02's Route A (reach the Foundation-`@import`ing partial through a load path so
`quietDeps` covers it) works as measured. No pre-existing failures, so nothing deferred
into ticket 09.

Shipped shape:

- `src/scss/_button.scss` -- the public API, `@include nfs-button.theme($selector,
  $background, $palette, $radius)`, 0 bytes on load, deliberately unlayered.
- `src/scss/internal/_settings.scss` + `internal/_foundation-button.scss` -- private.
  `$global-left`/`$global-right` reassigned **after** Foundation's `@import`s per ticket
  03; a `with-radius` helper performs ticket 05's `!global` rebind with an unconditional
  restore so `button-base` can be reached.
- `src/lib/nfs-button/nfs-button.scss` -- `@use 'button'` via load path,
  `@layer nfs-defaults { @include theme; ... }`, plus the single R026 accessibility rule
  `.button:focus:not(:focus-visible) { outline: 0 }` with its authority commented. One
  `styleUrl`, not two.
- `nfs-button.ts` -- `styleUrl` + `encapsulation: ViewEncapsulation.None`, template
  unchanged, still a Component.
- `ng-package.json` -- `lib.styleIncludePaths: ["src/scss"]`, assets glob `**/*.scss`.
  Published tree verified as exactly the three SCSS files; `verify-parity.mjs` no longer
  shipped.
- `project.json` -- `stylePreprocessorOptions.includePaths` on both Storybook targets.
- `.rtlcssrc.json` deleted, `rtlcss` removed from `package.json` and the lockfile.
- `.browserslistrc` -> `baseline widely available on 2026-05-07`; resolves to 136
  targets with floors chrome/edge/firefox 119 and safari/ios_saf 17.0, matching the map.

Compiled-CSS diff against the old artifact is exactly four changes:
`float: right; margin-left: 1em` -> `float: inline-end; margin-inline-start: 1em`;
`.button.hollow` gains `background-color: transparent`; primary hover moves from a
hand-written -15% to Foundation's own -20% `scale-color`; the `:focus-visible` rule is
added. Everything else byte-identical.

### Two real bugs found and fixed

1. **`.button.hollow` was shipping with the solid primary fill.** The old SCSS included
   `button-hollow-style` (border and text colour) but never `button-hollow`, the mixin
   that sets `background-color: transparent`. The CSS-in-JS path hand-wrote the
   transparent declaration, so the two paths disagreed and the SCSS one was wrong.
   Ticket 05's parity script could not have caught it -- it compares selectors, not
   declarations, which is further reason ticket 09 must replace it rather than port it.
2. **`_settings.scss` contradicted itself on hover derivation** -- `$button-background-hover`
   was precomputed at `-15%` while `$button-background-hover-lightness` said `-20%`.
   Resolved toward Foundation per D017 by deleting the precomputed variable and passing
   `auto`, which also makes a consumer-set `$background` derive its own hover with no
   second argument.

### Check G -- delegated from ticket 07, and the answer is worse than expected

**Both halves of R025's recommended shape are unsafe advice.**

- **Non-projected host children are dropped.** `template: ''` on an attribute-selector
  Component yielded `childNodes.length: 0`, `textContent: ""`, `innerHTML: ""` for both
  `<button zzProbe>Save</button>` and `<button zzProbe><span>Save</span></button>`. So
  `<button nfsButton>Save</button>` would silently lose its label.
- **An "omitted" template is not expressible at all** -- omitting both keys fails the
  build with `NG2001: @Component is missing a template`.

So any attribute-selector `nfs-*` Component that decorates existing content **must**
have `<ng-content>`. R025's "stay a Component with an empty/omitted template" wording
would cause silent content loss if followed literally. Report to the user: R025's
exception clause is correct, its prescribed shape is not.

### Accepted deviations

1. **`compile-default-css` has no `@layer` post-process step.** Correct call: the layer
   now lives in the SCSS source, so the target compiles the component stylesheet itself
   and a wrapper would nest `@layer nfs-defaults` inside itself. Keeping the wrapper would
   have needed an unlayered second entry file that could drift from what `styleUrl` ships
   and would omit the `:focus-visible` rule. The target is now one `sass` command.
   Artifact verified to contain exactly one `@layer`.
2. **The public file is `_button.scss`, so the consumer path is
   `ngx-foundation-sites/scss/button`.** Forced, not cosmetic: keeping `nfs-button.scss`
   made the component's own `nfs-button.scss` resolve a bare `@use 'nfs-button'` to
   itself, a module loop. **This is a breaking change to the documented consumer path**
   (`.../scss/nfs-button` -> `.../scss/button`) and must be documented in ticket 11 and
   applied to the demo app.
3. **`apps/nfs-demo/src/styles.scss` still uses the dead `with (...)` form.** It builds
   only because the demo resolves against the Verdaccio-installed copy, not workspace
   source -- so it breaks the moment anyone reinstalls. Tickets 10 and 13 own the fix.
4. **The `hsl(from currentcolor ...)` parse-vs-compute check was not run.** Moot: ticket
   06 banked the relative-colour approval unspent and nothing in the implementation uses
   relative colours. The obligation is withdrawn from the map rather than carried.

### Open API question raised by the implementer

`$palette` is a **whole-palette replace**, so a consumer overriding only `success` loses
`secondary`/`warning`/`alert` unless they restate them. Implemented as ticket 06
specified. A `map.merge` against the defaults is a one-line change and strictly
friendlier, and still serves M002's compliant theme (which passes all five anyway).
Folded into ticket 09 as a small refinement rather than left as a documented sharp edge.

### Residual boundary note

Full non-addressability of internals is not achievable while M002 must fetch and compile
the source. Moving them under `internal/` kills the documented
`@use 'ngx-foundation-sites/scss/foundation-button'` leak, but
`.../scss/internal/foundation-button` still resolves. That is a signalling boundary, not
an enforced one -- document it as such.
