# Decision: where does the WCAG-compliant palette live as a single source of truth?

Type: research
Status: resolved
Blocked by: 06

## Question

The founding brief wants the WCAG preset "sourced verbatim from M003's
already-proven compliant theme, no duplicated values -- single-source-of-truth
wiring, not a copy". **That source does not exist.** The compliant palette is
already restated across **five tracked files** (ticket 01's count, which
supersedes the two this ticket originally recorded -- enumerate all five before
deciding, since the collapse target must account for every one). None of them is
the library. The canonical-looking instance:

```scss
// apps/nfs-demo/src/styles.scss:27
@include nfs-button.theme(
  $selector: '.theme-compliant',
  $palette: (success: #238648, warning: #9e6c00, alert: #cb4b37)
);
```

...plus prose in `packages/ngx-foundation-sites/README.md`'s Accessibility
section. So M002 must **create** the single source, and D023's promise that "a
WCAG/axe-compliant theme ships in M002" is **not** discharged by M003's work.

Decide where it lives and how everything consumes it. Options to weigh:

1. **Exported Sass map in the library** -- e.g. `scss/_presets.scss` exporting a
   `$compliant-palette` map (and possibly a `compliant-theme()` convenience
   mixin). The demo app, README, and the addon all consume it. Genuinely
   discharges D023. Cost: a public Sass API addition, which touches the exports
   map and `verify-exports-map.mjs`.
2. **Workspace-level data constant** -- a TS/JSON constant the addon imports,
   with the SCSS side generated from or asserted against it. Keeps the public
   API frozen. Cost: D023 stays undischarged, and SCSS/TS sync needs a
   mechanism.
3. **Demo app remains the source**, addon derives from it. Smallest change, but
   inverts the dependency (library tooling depending on an app) and leaves D023
   open.
4. **Accept a third copy** with a test asserting the values match. Cheapest;
   contradicts the stated intent. Include it only as the honest baseline to
   argue against.

Whichever wins, answer these too:

- **How does the addon read Sass values?** The addon's controls are TS/JS state;
  the preset's canonical form may be Sass. Is there a supported way to read a
  Sass map into JS (compile-and-extract? generate a JSON artifact at build
  time?), or does the direction have to reverse?
- **Preset shape.** The compliant preset overrides only success/warning/alert
  and inherits Foundation defaults for primary, secondary and radius. So preset
  equality (the brief's "selected only when every control matches exactly")
  compares a **fully resolved** control set, not a sparse override map. Confirm
  where the Foundation default values themselves come from -- `internal/_settings.scss`
  is currently `internal/*` and explicitly **null in the exports map**, so it is
  not publicly readable. That may force a decision.
- **Does the demo app get rewired** to the new source, and does that count as
  M002 scope or a follow-up?

## Notes

Blocked by 06 because "where it lives" depends on whether the addon is inside
the publishable package or workspace-local. **Ticket 06 has resolved**, and it
constrains this ticket concretely:

The addon is workspace-local, resident in
`packages/ngx-foundation-sites/.storybook/`. **The compliant palette must NOT
live in `.storybook/`** -- that directory is excluded from `nx.json`'s
`production` named input, is unreachable by `ng-package.json`'s `src/scss` asset
glob, and is invisible to three of the five tracked files this ticket must
re-point. So the source belongs under `src/scss/`, with the addon consuming it.

That effectively selects option 1 (exported Sass map in the library) unless you
can show otherwise -- so spend the effort on the *mechanism* questions below
(how the addon reads Sass values into JS state; whether `internal/_settings.scss`
being `null` in the exports map blocks reading Foundation's defaults) rather
than re-litigating the location.

## Answer

Full reasoning: `../research/07-compliant-preset-single-source.md`.

**LOCKED: `$compliant-palette` becomes a plain public Sass map inside the
EXISTING public entry point `packages/ngx-foundation-sites/src/scss/_button.scss`**
(already exported as `ngx-foundation-sites/scss/button`). The demo app reads it
as `$palette: nfs-button.$compliant-palette`; the addon reads it -- plus
Foundation's defaults from `internal/_settings.scss` -- through a **custom Sass
function registered on the `compileString` call it already makes**. No new Sass
file, no `exports` key, no `verify-exports-map` change, no `ng-package.json`
change, no new Nx target, no generated artifact.

This is option 1 in substance but one rung lazier than the ticket assumed: a new
*member* of an existing public module, not a new `scss/_presets.scss`.

**Enumeration: five files, six sites, exactly ONE executable.**
`apps/nfs-demo/src/styles.scss:27-34` (the only compiled instance), `README.md`
:171 and :90, `app.component.ts:105-106`, `nfs-button-a11y.spec.ts:107`,
`_button.scss:13`. So the repo holds one app-local invocation plus five
*descriptions* of it -- there is no artifact anywhere, confirming the map's
founding-brief correction.

**Mechanism, verified by execution:** a custom Sass function returns a real
`SassMap` on both Node and the **browser** code paths (control: `compile()` threw
its Node-only message). `meta.inspect()` is a zero-`functions` fallback. Adding a
public variable still emits **0 bytes** on `@use`, so `_button.scss`'s "emits
NOTHING on load" contract survives.

**`internal/*: null` does NOT block reading Foundation's defaults** -- Dart Sass
1.102.0 ignores `exports` for subpaths entirely. Probe-confirmed, and the repo
had pre-recorded it: `package.json:8`'s own comment says the null "is what the
planned in-browser theming addon compiles against", and `README.md:123` records
the measured behaviour. Defaults are therefore NOT promoted to public API.

**Undocumented finding, routed to tickets 08 and 10: `apps/nfs-demo` consumes a
real published TARBALL, not the workspace.**
`apps/nfs-demo/node_modules/ngx-foundation-sites` is a real extracted directory
(D014/D015, gated by `verify-registry-consumption.mjs`), and the root symlink's
target has no top-level `scss/` at all. Three consequences:

1. Re-pointing `styles.scss` **hard-fails against a stale tarball**, so the
   rewire is one atomic 3-part change including a `verify-registry-consumption`
   re-run. That is M002 scope, not a follow-up.
2. It makes D023's proof *stronger* -- the axe fixture runs through the real,
   `exports`-gated public subpath in both CSR and SSR.
3. `ngx-foundation-sites/scss/button` is currently **unresolvable from the
   workspace root**, which is ticket 08's problem for getting `.scss` text to
   the addon.

**D023 discharge:** clause 2 ("a compliant theme ships in M002") becomes
literally true -- the palette lands in the published tarball's
`scss/_button.scss`. Clauses 1 and 3 are untouched, and the default theme's three
`expectedContrastFailures` literals must **NOT** be collapsed into the shared
map: an exact-set assertion has to name what it expects.

D023 is a **standing human decision** -- its substance (default theme unchanged,
compliant theme ships, exact expected-failure assertion never a blanket
suppression) is not re-openable here. This ticket decides the *mechanism* that
finally satisfies it.

Corroborating evidence for why this matters (ticket 01): the reference project
carries **three mutually inconsistent "WCAG-compliant palettes" at HEAD**. That
is precisely the drift this ticket exists to prevent, and it is the strongest
available argument against the "accept a third copy" option.
