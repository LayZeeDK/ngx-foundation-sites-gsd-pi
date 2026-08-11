# Correct the single-component ARCHITECTURE assumptions

Type: research
Status: resolved
Blocked by: --

**ITEM 7 SUPERSEDED BY TICKET 14.** This ticket's `$global-text-direction`
ruling ("OUT, provably inert twice over") is verified correct **for Button** but
wrong as a forward-looking ruling: `$global-text-direction` is read in 9 places
across 7 Foundation files, and `drilldown`'s `translateX` sign flip and
`breadcrumbs`' separator-character swap **cannot** be expressed as logical
properties. The single-component premise reappeared inside the pass meant to
remove it. Everything else in this ticket stands.

## Question

`ngx-foundation-sites` must support **all** Foundation for Sites components;
Button is merely the first. Tickets 01-11 resolved under an unstated premise
that the repo has one component. Audit every locked decision for *placement and
shape* choices that encode that premise, and correct the ones where
generalising costs nothing today.

**Apply the test in the map's Notes**: generalise *placement and shape* (free
now, forces rework later); do NOT build *machinery* with real cost and no
present benefit -- restate its rationale instead and keep the seam. Ticket 13
owns the machinery half (worker pool, caching, debounce). Stay out of it.

### Known corrections to make

1. **`$wcag-palette` is in the wrong module.** Ticket 07 put it in
   `src/scss/_button.scss` (`ngx-foundation-sites/scss/button`). But
   `success`/`warning`/`alert` are **Foundation's `$foundation-palette` keys --
   a global concept**, not button variants. `_button.scss` was chosen because it
   is the only public entry point that exists, i.e. for exactly the expiring
   reason the constraint forbids. Decide the global home (e.g.
   `src/scss/_theme.scss` exported as `ngx-foundation-sites/scss/theme`), how
   `_button.scss` relates to it (`@forward`? consume?), and what it costs.

   Re-weigh ticket 07's cost argument, which is weaker than it reads: it leans
   on ONE self-flagged inference -- that a new file needs a new `exports` alias
   key because the identity map `"./scss/*"` does not resolve the partial-name
   form. Verify that inference rather than inheriting it. Note also that a new
   `exports` key is a **supported operation** -- `verify-exports-map` exists to
   keep declared and built exports in sync, not to discourage entries -- and
   that ticket 07 separately verified **Dart Sass ignores `exports` for subpaths
   entirely**, so the resolver question may not even bind the addon's own reads.

2. **The compile call is hard-wired to one component.** Ticket 09 locked
   `$selector: '.button'` and an invocation of `nfs-button.theme()`. Decide the
   shape that lets component #2 join without reworking the addon -- a registry
   or list of themeable modules, even if it has exactly one entry today. State
   plainly whether this costs anything now; if it is genuinely free, take it, and
   if it is not, say so and keep the seam explicit instead.

3. **The source generator assumes a single chain.** Ticket 08's generator
   "compiles the real chain" and its output is described as "the vendored
   16-file snapshot". Decide whether it takes N entry points and unions their
   closures. It already *discovers by compiling*, so this may be nearly free --
   verify rather than assume.

4. **Closure sizing is button-only.** The 13 files / 71.9 KiB / 24.3 KiB gzip
   figure -- and ticket 08's "sources are nearly free" conclusion -- measure the
   button chain alone. Foundation's whole tree is 367.6 KiB. Bound what the
   closure becomes across a realistic component set, and say whether ticket 08's
   conclusion survives. It probably does against an ~802 KiB gzip `sass` bundle,
   but the claim must be re-grounded, not assumed.

5. **`internal/_settings.scss` mixes global and button settings.** It currently
   seeds `$white`, `$black`, `$global-margin`, `$global-radius` alongside
   `$button-*`. Say whether that organisation holds as components land, and
   whether the addon's defaults-probe (ticket 07) reads something that will
   stay stable. Flag only -- do not redesign the internals.

6. **R009's control set is framed as button `theme()` arguments.** All six are
   in fact Foundation globals (`$foundation-palette` keys plus
   `$global-radius`). Reframe them as **global theme variables that Button's
   mixin happens to consume** -- a framing fix that makes the surface's
   generality explicit rather than accidental. This changes no behaviour.

7. **Consider `$global-text-direction`.** Ticket 01 found the reference exposed
   it as a live control, and it is a Foundation global. Decide in or out on
   merit -- note M003 delivered RTL via logical properties, which may make a
   direction control redundant or may make it valuable. A reasoned "out" is a
   fine answer; an unconsidered omission is not.

### Also audit

Sweep the remaining decisions (04, 06, 10) for the same premise. Delivery shape
(`.storybook/`-resident) and the Playwright harness look component-agnostic --
confirm rather than assume. For ticket 10, check that no gate or lane assignment
hard-codes the button in a way that would need rework.

## Notes

Do NOT re-open decisions that are genuinely component-agnostic just because they
are nearby. The output should distinguish clearly:

- **CORRECTED** -- the decision changes, with the new decision stated.
- **RESTATED** -- the decision stands, but its recorded rationale was
  single-component and is replaced with a durable one.
- **UNAFFECTED** -- verified component-agnostic.

Every superseded decision must name what supersedes it, so the hand-off can
carry the correction rather than silently contradicting the research documents.
Do not edit the research/*.md files -- they are the record of what was found at
the time. Corrections live in your findings document and flow into the hand-off.

## Answer

**RESOLVED. Findings and corrections in
[`research/12-multi-component-architecture-corrections.md`](../research/12-multi-component-architecture-corrections.md).**
Three reproducible probes left behind: `prototypes/multi-component-closure.mjs`,
`prototypes/exports-partial-name-probe.mjs`, `prototypes/global-home-probe.mjs`.
No repo file changed.

**Total bill for every correction below: one new Sass file, one `exports` line,
one cache invalidation, and wording.** Nothing else costs anything today, and no
machinery was built for absent components.

### The seven, classified

1. **`$wcag-palette` -- CORRECTED.** Moves out of `_button.scss` into a new
   `src/scss/_theme.scss`, exported as `"./scss/theme"`. `_button.scss` is
   UNCHANGED and does **not** `@forward` it: `theme()` takes `$palette` as an
   argument, so a component module never needs to see theme data. Ticket 07's
   cost argument was re-weighed and **does not survive**. Its one self-flagged
   inference is now **VERIFIED TRUE** (Node's resolver refuses
   `scss/theme`; only the literal `scss/_theme.scss` passes the identity map) --
   but it binds **no consumer in this repo**: Dart Sass `loadPaths`, Dart Sass's
   `NodePackageImporter`, **and Angular's own Sass importer** all bypass
   `exports` for subpaths. Angular's is the decisive one and it was unknown to
   ticket 07: `@angular/build`'s `findFileUrl` falls back to
   `join(packageRoot, ...pathSegments)` after an exports-honouring miss, which
   resolved even the `null`-mapped `scss/internal/settings` against the REAL
   tarball. The key is added for the *published* surface's correctness, and it
   costs one `package.json` line -- `verify-exports-map` diffs source-vs-dist
   keys and is agnostic to key count, so **no script, `ng-package.json` or target
   change**. Free now because `$wcag-palette` does not exist yet; later it is a
   breaking rename of published API or a permanent `@forward` shim.
2. **The compile call -- CORRECTED.** A generated `THEMEABLE_MODULES` list, one
   entry today; the entry string is built by mapping over it. **Genuinely free**
   -- `entryFor()` is already a string builder, so one hard-coded pair becomes a
   `.map()` over a one-element array. Verified: ONE compile over two themeable
   modules emits both selectors and serves the Foundation island **once**
   (13 partials, not 26). Per-module argument filters are a named seam, not
   built. The `$selector` decision itself is **RESTATED, not corrected** --
   passing none is right and gets righter; `.button` is restated as "each
   themeable module's own default selector".
3. **The generator -- CORRECTED, and required TODAY.** Takes N entry points and
   unions their closures. Not a generalisation: correction 1's `_theme.scss` is
   structurally invisible to a single-entry closure, proved by negative control.
   Two arrays (`THEMEABLE_MODULES`, `DATA_MODULES`); the themeable list is
   emitted into the data module so `verify-theming-sources`' byte-compare covers
   it.
4. **Closure sizing -- CORRECTED (numbers), RESTATED (conclusion).** Measured,
   not extrapolated: button chain **16 files / 84.4 KiB / 24.1 KiB gzip**; the
   shared `util/` + `global` floor is **12 of those 13 Foundation partials**, so
   Button's own marginal cost is **1 file / 12.0 KiB** and every component's is
   **1 file / 0.2-13.7 KiB**; all 35 Foundation components together
   **52 files / 212.9 KiB / 46.2 KiB gzip**; absolute ceiling
   **111 files / 349.1 KiB / 70.1 KiB gzip**. Ticket 08's "sources are nearly
   free" **SURVIVES** -- 3.0% of the 801 KiB gzip `sass` bundle today, 8.8%
   measured at the ceiling, ~11% including a bounded estimate for the library's
   own wrappers. Reworded from "noise" to "a bounded rider": the worker chunk goes
   ~825 -> ~890 KiB gzip at full coverage. Pre-flattening stays dominated
   (~0.4%).
5. **`internal/_settings.scss` -- FLAGGED (no redesign), with one corrected
   consequence.** It mixes 9 Foundation-global members with 17 button-scoped ones
   in a file whose header calls itself Button's private defaults table. The
   addon's defaults probe currently targets the **button-derived** names
   (`$button-palette` / `$button-background` / `$button-radius`) -- the exact
   three that move when the file splits. **Corrected: read the GLOBAL names**
   (`$primary-color`..`$alert-color`, `$global-radius`). Verified byte-identical
   today, so the swap is free, and it drops the spurious `primary` key
   `theme()` skips.
6. **R009's control set -- RESTATED.** All six are Foundation globals
   (`$foundation-palette` keys + `$global-radius`), which
   `internal/_settings.scss:45-47` says outright. The table gains a "Foundation
   global" identity column and "`theme()` argument" becomes "how it reaches
   Button's mixin today". No behaviour change -- and it is what makes the global
   control surface correct on merit rather than by convenience.
7. **`$global-text-direction` -- DECIDED: OUT.** Not an omission any more.
   Provably **inert twice over**: `_global.scss:127-128` derives
   `$global-left`/`$global-right` from it, and
   `internal/_foundation-button.scss:66-67` unconditionally reassigns both to
   logical properties **after** the `@import`s; the only direct read in the chain
   (`components/_button.scss:84-86`) guards a `!default` on `$button-margin` that
   line 37 already seeded. It appears nowhere in `internal/_settings.scss`, and
   exposing it would need `theme()` API growth the map rules out. The durable
   reason: M003/R004 made RTL a logical-properties property of ONE stylesheet, so
   direction is a library-RTL concern, not a theme variable -- true at any N,
   even though six other Foundation files do read it.

### The sweep

`research/04`, `research/06`, `research/10` are **UNAFFECTED** -- verified, not
assumed: zero single-component-premise hits and zero `'.button'` literals across
all three. No gate or lane assignment hard-codes the button. Two *subject*
framings restated in research/10 (G2d's Foundation marker, P2/P3's "the preview
button"); no assertion changes. Ticket 06's amended rule 2 and D032's delivery
shape hold unchanged at N. D023's axe location stays in `apps/nfs-demo` and gets
*stronger* under correction 1. All seven premise-carrying lines in `research/01`
are performance rationales -> **routed to ticket 13**.

### Routed to ticket 13

The blocking question is answered: a theme apply is **ONE compile emitting N
components' rules**, not N compiles -- the shared Foundation island is served
once, verified. So the reference project's additive per-component curve does
**not** transfer and must be re-derived, not inherited. Also routed: the closure
is floor-dominated (bears on cache-key design); `foundation-everything()` emits
138.6 KiB of CSS (the cost that *does* scale inside one compile); whether the
sources ever split into per-component chunks; and the fact that the probe compile
is now two `@use`s, which interacts with 13's "pre-compile the default theme"
question.

### Ticket 11 / HANDOFF

Section 7 of the findings lists it section by section. The load-bearing ones:
R009's control table takes correction 6's three-column form; the "no `exports`-map
change" claim must be **split** (true of the addon per D032, false of M002 after
correction 1) and "no public Sass API growth" qualified (`theme()`'s signature
does not grow; one new public data module appears); **R009 open question 1 is now
ANSWERED, not carried**, and the phrase "no second component exists" must not
survive as a rationale anywhere; D033's Choice is rewritten, D034's takes the N
entry points and the measured bounds, D035 clause (d) takes the module list;
s5.2's atomic 3-part rewire re-points at `scss/theme` and part 1 gains the
`exports` key; s7's "the chain is already narrow" carries the measured bounds and
"the vendored 16-file snapshot" becomes closure-relative; ticket 07's
`exports`-partial-name `[INFER]` graduates out of s8 as VERIFIED-TRUE. A **D037**
for correction 7 is recommended -- a considered rejection is what a register row
is for.
