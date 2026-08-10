# Choose the styling-delivery and theming architecture

Type: research
Status: resolved
Blocked by: 01, 02, 03, 04, 05, 12, 14

## Question

Synthesis and decision ticket -- run AFK per the map's Notes, resolved by
reasoning over the five research findings against the `.gsd/` requirement
contract. No human is asked.

**The user has since settled the central question: compile-time SCSS variable
theming ONLY, no runtime CSS variable theming.** That selects candidate **A** below
and rejects B and C. This ticket is therefore no longer "choose between three
architectures" -- it is "confirm A against the full requirement contract, and pin
down its details". Do not relitigate the token option; ticket 04's evidence that it
works for Material is not in dispute, it is simply out of scope for this library.

Details A still leaves open, which this ticket must fix:

- The exact public Sass API surface (ticket 05's theme mixin, now emitting concrete
  declarations rather than custom properties -- confirm the mixin shape still beats
  `@use ... with` once nothing is tokenised).
- Whether `compile-default-css` and the precompiled `dist/.../css/*.css` files
  survive alongside `styleUrl`, or are retired (currently in the map's fog).
- How the layered default and a consumer's unlayered recompile are documented so the
  duplication is understood as intended rather than as a bug.
- Whether any accessibility-only CSS ships as its own `styleUrls` entry, following
  Material's `button-high-contrast.scss` precedent (ticket 04).

Original framing retained below for the record.

Pick one architecture for how NfsButton's default CSS is authored, compiled,
delivered and themed. The candidates on the table, to be judged not invented:

- **A. `styleUrl` + consumer-recompiles.** Compiled SCSS ships via `styleUrl`
  wrapped in `@layer nfs-defaults`; a consumer themes by `@use`-ing the
  library's unlayered SCSS globally, which wins the cascade per R008's existing
  fix. Cost: the consumer's override duplicates the whole ruleset.
- **B. `styleUrl` + token indirection.** Component CSS references
  `var(--nfs-button-*, <default>)`; the library ships a Sass theme mixin that
  emits the custom properties, with Foundation's `scale-color` /
  `color-pick-contrast` computation still done at the consumer's Sass time. The
  Material shape (see ticket 04). Cost: every themable value needs a token.
- **C. Hybrid.** `styleUrl` defaults plus a token layer only for the values
  consumers actually re-theme (palette, radius), with structural values baked.

State the choice, then walk the full requirement contract explicitly and say how
the choice satisfies each -- not a summary, a per-requirement line: R001, R003,
R004, R005, R006, R007, R008, R010, R018, R020, R022, R024, R025, R026, plus
D017 (reuse Foundation's real mixins) and the user's five stated constraints
(`@use`-only consumer syntax, no globals if avoidable; no duplication of
Foundation styles; RTL and LTR; CSR + SSR + hydration; lazy load/unload with ref
count) -- plus the later-added six-host requirement: SSR production-like host,
static-serve production-like host, Vite dev server in CSR and in SSR mode, and
Storybook in both dev-server and static-build form. Ticket 12 owns the evidence
for that matrix; if it shows one candidate architecture behaves inconsistently
across hosts, that is disqualifying, not a caveat.

**RTL: both mechanisms are now permitted; choose on merits, not support.** The user
has approved `:dir()` despite its Chrome/Edge 119 gap (two of 136 targets, about
five weeks of baseline drift), so support no longer decides between it and logical
properties. Ticket 03 still recommends logical properties -- smaller output, no
duplicated per-direction rules, no specificity cost, and Foundation's mixin
untouched -- with `:dir()` held as a pre-approved escape hatch for the one case
logical properties cannot express: mirroring an inline-asymmetric shorthand, which
does not exist today. Confirm that reasoning against whichever theming architecture
you pick, since token indirection changes how much the specificity difference
actually matters. Do **not** extend the `:dir()` approval to `css-relative-colors`:
that gap is 9 of 136 targets and roughly 20 months, not five weeks.

**`@layer nfs-defaults` stays -- this is now settled, not open.** Ticket 04's
recommendation to drop it rested entirely on replacing cascade competition with
custom-property inheritance, which the compile-time-only theming decision removes.
Under compile-time theming a themed consumer recompiles the library's SCSS into
their own global stylesheet, and the layer is precisely what makes that unlayered
output win regardless of DOM insertion order -- ticket 01 confirmed the component
`<style>` is appended to `<head>` *after* the global `styles.css` `<link>`, so
without a layer the default would beat the consumer. R008 stands as recorded, and
the R008 replay gate is withdrawn: there is nothing to unwind.

**Durability question you must address explicitly.** Ticket 05 established that
`@import` is deprecated as of Dart Sass 1.80.0 with removal in 3.0.0 no sooner
than 2026-10-17, that Foundation for Sites is dead upstream (v6.9.0 is the newest
tag, `develop` HEAD is that release's merge, no v7 branch, no maintained fork),
and that `sass-migrator module --migrate-deps` produces a **non-compiling** tree
because of a `math` <-> `unit` module cycle. The entire D017 "reuse Foundation's
real mixins" strategy therefore rests on a deprecated Sass feature in an
unmaintained library. Say what the chosen architecture's exposure to that is, and
whether it makes the eventual escape easier or harder -- for instance, whether
Foundation's mixins are confined to a single `@import` island that could later be
vendored or frozen without touching the component. Do not treat this as a reason
to abandon Foundation reuse; treat it as a property the architecture should be
chosen to tolerate.

Name what the choice *costs* and what it makes impossible, and record any
requirement it can only satisfy by reinterpretation -- R020's "compiled by the
consumer's own Angular build" is the one most at risk, and if the chosen
architecture cannot honour its literal wording, say so plainly rather than
quietly re-reading it. `.gsd/` is read-only, so any requirement that genuinely
needs rewording is reported to the user, not edited.

## Answer

**Architecture A, confirmed.** The user's compile-time-SCSS-only decision selected it;
this resolution confirms it against the requirement contract and pins the four open
details.

### The architecture

- **Default styling** is authored in SCSS that `@include`s Foundation's real button
  mixins (D017), wrapped in `@layer nfs-defaults`, compiled by the library's own build,
  and delivered via `styleUrl` + `encapsulation: ViewEncapsulation.None`.
- **Theming** is compile-time Sass. A consumer calls a theme mixin from their own
  global stylesheet; the emitted rules are **unlayered** and therefore beat the layered
  default regardless of DOM order. M002 runs the identical mixin through an in-browser
  Sass compiler.
- **No CSS custom properties** anywhere in the theming surface. No tokens, no runtime
  derivation, no JS.

### Detail 1 -- public Sass API: theme mixin, not module configuration

```scss
@use 'ngx-foundation-sites/scss/button' as nfs-button;

@include nfs-button.theme(
  $background: #2a5db0,
  $palette: (secondary: #767676, success: #3adb76, warning: #ffae00, alert: #cc4b37),
  $radius: 6px
);
```

Ticket 05 measured why module configuration loses: the consumer must type a bare
`$primary-color` (breaking the no-globals goal), configuration is inseparable from
emission (5490 bytes of unwanted rules to read one token), and `@use ... with` rejects
even byte-identical duplicate configuration. The mixin costs 0 bytes on load, supports
two themes in one compilation, and lets the consumer choose cascade position. Keep the
`$selector` parameter for scoped themes and `$palette` for whole-palette override --
the latter is M002's compliant-theme hook, so it is not optional.

Zero-config consumers write nothing at all: `styleUrl` ships the defaults.

### Detail 2 -- `compile-default-css` survives, simplified

**Keep a single precompiled stylesheet; drop the RTL twin, `rtlcss`, and
`.rtlcssrc.json`.** R020 explicitly promises "precompiled default CSS ... for
zero-config consumers", and honouring that literally costs one `sass` invocation, so
there is no reason to reinterpret it. The **RTL twin is genuinely obsolete**: ticket 03's
logical-property mechanism makes one stylesheet serve both directions, so
`nfs-button.rtl.css` would be a byte-identical duplicate. Retire the rtlcss dependency
with it.

Retain the `@layer nfs-defaults` post-process wrapper on that artifact, for the same
cascade reason as the `styleUrl` path.

### Detail 3 -- documenting the intentional duplication

A themed consumer ships the ruleset twice: the layered `styleUrl` default plus their own
unlayered override (measured at 5567 bytes / 34 rules, ticket 05). This is the accepted
price of compile-time theming and must read as intentional in the README, not as a bug.
Ticket 11 owns the wording.

### Detail 4 -- accessibility-only CSS stays in the same file

**Do not add a second `styleUrls` entry.** Material's `button-high-contrast.scss`
precedent applies to *conditional* CSS (`forced-colors`); ours is unconditional. Ship
the one R026-sanctioned addition -- a `:focus-visible` rule replacing Foundation's
`disable-mouse-outline`, which is inert because `[data-whatinput]` is set by Foundation's
JS and R016 forbids it -- inside `nfs-button.scss`, marked with a comment naming R026 as
its authority. `css-focus-visible` passes 0/136 at the pinned baseline. One file, one
comment, no new surface.

### Requirement contract

- **R001** variants -- unchanged; Foundation's mixins still emit the full palette plus
  expanded and dropdown (D017).
- **R003** WCAG AA -- the default theme knowingly ships three sub-AA variants
  (Foundation-inherited); M002's compliant theme carries the real proof. Reported, not
  reinterpreted.
- **R004** RTL -- ticket 03's logical properties via Foundation's own
  `$global-left`/`$global-right` interpolation. Existing gate is vacuous and is fixed in
  ticket 10.
- **R005** lazy load/unload with ref count -- native `SharedStylesHost`, empirically
  confirmed to `element.remove()` at zero usage (ticket 01), verified in all six hosts
  (ticket 12).
- **R006** Storybook -- ticket 12 verified stories and `test-storybook` (17/17) under
  this delivery.
- **R007** docs -- ticket 11.
- **R008** cascade -- `@layer nfs-defaults` retained and now load-bearing; the removal
  gate is withdrawn.
- **R010** Material parity -- unaffected; Material uses the same `styleUrl` +
  `ViewEncapsulation.None` shape (ticket 04).
- **R018** SSR/hydration -- native `ng-app-id` adoption by object identity, which also
  eliminates D013's accepted duplicate-`<style>` cost.
- **R020** -- **honoured literally.** "Compiled by the consumer's own Angular build
  against variables the consumer sets in their own settings file" is exactly this. The
  precompiled-CSS clause is kept (detail 2). The tension recorded earlier in this map is
  dissolved by rejecting the token pattern, not by re-reading R020.
- **R022** browser baseline -- must be re-pinned to
  `baseline widely available on 2026-05-07`; the current rolling query drifts. Ticket 08.
- **R024** single package -- unchanged.
- **R025** Directive-first -- satisfied by its own stylesheet-lifecycle exception;
  ticket 07 confirms.
- **R026** no CSS-in-JS -- satisfied by construction; ticket 09 deletes the three
  artifacts.

User constraints: `@use`-only and global-free (detail 1); no duplication of Foundation
styles (leakage measured at 49 bytes / 0.88%, ticket 05); RTL and LTR (ticket 03); CSR,
SSR and hydration (tickets 01, 12); ref-counted lazy load/unload (tickets 01, 12); all
six hosts (ticket 12).

### Costs and what this makes impossible

- Themed consumers ship the ruleset twice.
- No runtime re-theming without a Sass compiler -- which is why M002 ships one rather
  than switching to tokens.
- A consumer cannot theme from plain CSS; a Sass build is mandatory for theming.
- The `:dir()` and relative-colour approvals go unused. Banked, not spent.

### Durability exposure

Foundation's legacy `@import` stays confined to the single `_foundation-button.scss`
island (ticket 05 proved the `@use` boundary is genuinely non-transitive). When Dart Sass
3.0.0 removes `@import` -- floor 2026-10-17, realistically later, and Foundation is dead
upstream with a non-migratable Sass tree -- the escape is to vendor or freeze that one
file, with no change to the component or the public API. Architecture A therefore has the
best available exposure profile: one file to replace, not a pipeline.
