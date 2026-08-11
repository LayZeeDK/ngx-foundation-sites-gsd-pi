# Which settings activate RTL residue, and by how much?

Type: prototype
Status: resolved
Blocked by: --

## Question

The whole map hangs on this. Ticket 14 of the M002 effort measured **one** case:
`button-group`'s 14 radius sites emit **0** invalid declarations at Foundation's
defaults and **20** with `$buttongroup-radius-on-each: false`. Generalise that
into a **sensitivity map**: which of Foundation's 490 settings, when moved off
their default, activate additional invalid-CSS sites under the
`$global-left`/`$global-right` -> `inline-start`/`inline-end` rebind -- and by how
much?

Answer, with measurements:

1. **Is the class bounded?** Count the settings that can activate residue. If it
   is a handful, a cartesian-product gate becomes conceivable. If it is dozens
   or is combinatorial (settings interacting), detection is likely hopeless and
   the map should turn to elimination. Ticket 13 found a useful precedent for
   bounding: only **19 of Foundation's 35** component partials read any of the
   six curated globals, and the expensive tier was 6. Establish whether a
   similar bound applies here.
2. **Is it monotone?** Does moving a setting off default only ever ADD invalid
   sites, or can one setting mask another's defect (making the count
   non-additive)? Non-monotone behaviour would rule out per-setting reasoning
   entirely.
3. **THE M002 QUESTION -- answer this explicitly and early.** The M002 addon
   exposes six live controls: primary / secondary / success / alert / warning
   (Foundation `$foundation-palette` keys) and **`$global-radius`**. Ticket 15
   verified five inert when seeded, and Button hits only safe classes -- but
   `button-group`'s latent class is *radius-shaped*. **Can `$global-radius`, or
   any of the six, activate RTL residue in any Foundation component?** If yes,
   M002's closed hand-off is implicated and this map must say so loudly. If no,
   say so with the same force -- a closed milestone deserves a clean bill of
   health, not silence.
4. **Which defect classes are settings-sensitive?** Ticket 14 found six classes.
   Map each to whether settings can activate it:
   - `text-align: inline-start` (invalid value)
   - bare-side positioning `inline-end: 1rem` (invalid property)
   - `border-top-inline-start-radius` (invalid property) -- the known-latent one
   - `background-position` (no logical keyword)
   - **class-NAME interpolation** `.align-inline-start` -- valid CSS matching
     nothing, so no validity oracle catches it. Graduate the map's fog item here
     if you can now say whether it varies with settings.
   - `css-triangle` emitting a solid square instead of an arrow

## Notes

Reuse the existing probes rather than rebuilding: `rtl-rebind-validity-probe.mjs`,
`rtl-rebind-latent-radius-probe.mjs`, `rtl-rebind-source-sites.mjs`,
`rtl-residue-probe.mjs` and `settings-reachability-probe.mjs`, all in
`.scratch/m002-storybook-theming-addon/prototypes/`.

You do not need to sweep all 490 settings blindly. A cheaper route: from the ~109
rebind source sites, work backwards to the settings that gate whether each site
emits at all (`@if` guards, `!default` values that zero a length, maps whose
emptiness skips a loop). That inverts the search from 490 candidates to ~109
sites.

Measure; do not reason. The M002 map's standard was executed evidence, and the
one number this ticket already has (0 -> 20) came from a probe, not an argument.

## Answer

Full findings: `.scratch/settings-rtl-coupling/research/01-settings-sensitivity-map.md`.
Six probes in `prototypes/`: `rebind-site-gates.mjs`, `gate-closure.mjs`,
`rtl-defect-classifier.mjs`, `settings-activation-sweep.mjs`,
`per-component-sweep.mjs`, `m002-and-class-name-probe.mjs`, `unboundedness-law.mjs`.

**Q3 -- M002: CLEAN BILL OF HEALTH. Not implicated.** None of the six controls
activates residue in any of the six classes, verified three ways: (a) the shipped
`theme()` route, 6 cases, **invalid=0 in every class**; (b) the maximal route -- all
41 Foundation mixins with the rebind and the controls driven as bare globals -- 8
`$global-radius` values plus each of the 5 palette keys, **every class identical to
baseline in all 13**; (c) statically, none of the six is in the transitive gate
closure of the 109 rebind sites. The radius worry does not land because **the
radius-shaped class is gated by a BOOLEAN, not a radius**: c3 = 0 / 20 for
`$buttongroup-radius-on-each` true/false, identically at radius 0, 6px and 50%.
Note the strong form -- `$global-radius` IS live at the raw level (+128 B), so this
is not NF7's inertness restated. Forward rule: the six are safe because they are
*value* settings; the test for any new control is **"can it change WHICH rules are
emitted?"**, not "is it a Foundation global?" -- a single boolean control would put
the addon back in scope.

**Q1 -- BOUNDED IN NAMES, UNBOUNDED IN MAGNITUDE.** 109 rebind sites: 64 emit
unconditionally, 45 are gated. The transitive gate closure names **15 settings of
498** (3.0 %); **13 measured to move a defect count**; a brute-force flip of all 31
template booleans found no others. But two of the 15 are **multipliers**, and fitting
12 points then testing **9 held-out combinations (9/9 exact)** gives
`c2 = 2 * $grid-column-count * |$breakpoint-classes| + |$breakpoint-classes| + 23`.
Both inputs have infinite domains. Measured **1187** invalid declarations at 48 cols
x 12 breakpoints vs **98** at defaults. A cartesian gate over the 13 finite gates is
2^13 cells and would still be the wrong shape. Baselines: 102 invalid per-component
(c1=3 c2=98 c3=0 c4=1 c5=13 c6=2); 36 via `foundation-everything()` -- which
reproduces ticket 14 exactly and shows the count also depends on the COMPONENT SET.

**Q2 -- NOT MONOTONE; ADDITIVE EXCEPT THROUGH THE MULTIPLIER.** `$global-flexbox:
false` **adds 4 class-1 defects and removes 7 class-5 defects in one compile**.
Three classes can be masked to **zero** by legitimate settings (`$drilldown-arrows`
-> c6=0, `$select-triangle-color: transparent` -> c4=0). So absence of a class in one
configuration is not evidence the class is fixed. Additivity: **59 of 71 valid pairs**;
all 12 non-additive pairs involve `$breakpoint-classes` (the product term). Seven
same-variable pairs were excluded as an invalid test -- a first-run artefact, corrected.

**Q4 -- ALL SIX CLASSES ARE SETTINGS-SENSITIVE**, in three distinct shapes.
Latent-from-zero: **class 3 only** (`$buttongroup-radius-on-each` 0 -> 20).
Present-at-default and amplified: **classes 1** (`$global-flexbox` 3 -> 7) and
**2** (unbounded). Present-at-default and maskable-only: **classes 4, 5, 6** --
defaults are their MAXIMUM, so a fixed-settings gate bounds those three and only
those three.

**Fog item graduated -- class 5 IS settings-dependent, downward only.** 13 selectors
at defaults, 6 with `$global-flexbox: false`; no setting raises it; **not**
breakpoint-multiplied (13 at 1, 3 and 5 breakpoint classes); unmoved by
`$menu-centered-back-compat`, `$accordionmenu-arrows`, `$global-radius`. Measured
against a no-rebind control, the rebind removes **both** of Foundation's public
`.align-left` and `.align-right` classes.

**Two measurement artefacts caught and recorded, both would fake a clean result.**
(1) `foundation-everything()` executes `$global-flexbox: true !global`, so a
consumer's `$global-flexbox` is silently overwritten -- byte-identical through that
entry point, 4 activated + 7 masked through per-component includes. Any gate built on
`foundation-everything()` reports a false clean on every `$global-flexbox`-gated site.
(2) The first pairwise run reported 19/78 non-additive; 7 were same-variable pairs
where the later declaration simply wins. Corrected to 12/71. Order-independence was
controlled for separately: 4 shuffled mixin orders, identical counts and bytes.
