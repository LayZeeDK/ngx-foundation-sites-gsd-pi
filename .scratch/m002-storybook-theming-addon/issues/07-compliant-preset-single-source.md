# Decision: where does the WCAG-compliant palette live as a single source of truth?

Type: research
Status: open
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
the publishable package or workspace-local.

D023 is a **standing human decision** -- its substance (default theme unchanged,
compliant theme ships, exact expected-failure assertion never a blanket
suppression) is not re-openable here. This ticket decides the *mechanism* that
finally satisfies it.

Corroborating evidence for why this matters (ticket 01): the reference project
carries **three mutually inconsistent "WCAG-compliant palettes" at HEAD**. That
is precisely the drift this ticket exists to prevent, and it is the strongest
available argument against the "accept a third copy" option.
