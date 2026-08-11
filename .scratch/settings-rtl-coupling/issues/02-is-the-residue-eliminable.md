# Can the residue be eliminated, making settings safe by construction?

Type: prototype
Status: resolved
Blocked by: --

## Question

If invalid CSS cannot be produced at all, then no consumer setting can activate
a defect and the coupling dissolves. **Prove or refute eliminability**, by
building a mechanism and measuring what it emits.

Ticket 14 of the M002 effort recommended a **hybrid** -- logical properties where
verified safe, `:dir()` overrides for the residue, `$global-text-direction` as
the single-direction escape hatch -- but it never proved the hybrid actually
eliminates the defect classes. Do that.

For each of the six defect classes, show a mechanism that emits **valid** CSS
whose behaviour matches Foundation's dual-build output, or show that it cannot:

1. `text-align: inline-start` -> the logical values are `start`/`end`. Trivial in
   principle; confirm a mechanism reaches it.
2. Bare-side positioning `inline-end: 1rem` -> `inset-inline-end`.
3. `border-top-inline-start-radius` -> `border-start-start-radius` and friends.
   Note the mapping is not a string substitution: the physical-to-logical corner
   mapping is 2-dimensional.
4. `background-position` -- no logical keyword exists. This one may be
   irreducible; if so, say what covers it (`:dir()` override? a custom property?).
5. **Class-NAME interpolation** `.align-inline-start`. This is the hard one: it
   is valid CSS matching nothing, so it must be prevented rather than detected,
   and it is a *selector*, not a declaration -- a property-name mapping layer
   does not touch it.
6. `css-triangle` emitting a solid square -- it takes a side as an ARGUMENT and
   matches no `@if` branch. Argument-level, not property-level.

Then answer the design question that follows:

- **Property-name mapping vs `:dir()` vs both.** A mapping layer fixes classes
  1-3 (and maybe 4) but structurally cannot fix 5 or 6, which are selector- and
  argument-level. So the answer is likely a combination. State it precisely, and
  state what each mechanism does NOT cover -- the residue-of-the-residue.
- **Is the rebind still the right foundation?** Ticket 14 closed "extend the
  rebind" on measurement and said the rebind must **not** be lifted into a shared
  partial for future islands. Given that, does a general mechanism keep the
  rebind for Button and do something different elsewhere -- and is that
  divergence acceptable, or does it mean Button eventually migrates too?
- **Cost.** Ticket 13 measured the compile curve as additive with a ~1.2-1.4 s
  ceiling for the entire library. `:dir()` duplication increases emitted volume;
  a mapping layer adds Sass work. Measure the delta on at least the worst
  component, and graduate the map's fog item on elimination cost.

## Notes

**Do not build this into the library.** `.scratch/settings-rtl-coupling/prototypes/`
only -- no file under `packages/`, `apps/`, `scripts/` or `.storybook/`. You are
proving a mechanism is possible and pricing it, not shipping it.

Constraints that bind the mechanism (all verified in the M002 map, see its Notes
and `research/14-*.md`):

- **Dual build is ruled out by a shipped artifact** -- the `Rtl` story renders
  both directions in ONE document. Whatever you propose must serve that page.
- **D020** forbids CSS custom properties as the *theming surface*; ticket 14
  established a direction *sign* is not that, but also that a custom property
  cannot read direction alone -- it still needs `:dir(rtl){--nfs-dir:-1}`, so it
  compresses `:dir()` rather than replacing it.
- **M003's `:dir()` rejection was Button-specific** (D021's question is scoped to
  the button-dropdown arrow, its `:dir()` ground purely comparative), so
  re-opening it needs no decision reversal. R004 remains validated.
- **R008**: the unlayered-beats-`@layer` split must survive. `:dir()` adds
  specificity -- check it does not disturb that win.

A refutation is as valuable as a proof. "Classes 5 and 6 are not eliminable by
any mechanism short of forking Foundation's Sass" would be a strong, decision-
shaping result -- provided it is demonstrated.

## Answer

Full findings: `.scratch/settings-rtl-coupling/research/02-is-the-residue-eliminable.md`.
Mechanism and probes: `.scratch/settings-rtl-coupling/prototypes/` (captured
output in `prototypes/out/run-*.txt`).

**ELIMINABLE -- all six classes, verified by execution and confirmed in real
Chromium.** The mechanism is neither the rebind nor a mapping layer:

> **Do not substitute anything.** Compile Foundation UNMODIFIED twice at Sass
> time (`$global-text-direction: ltr` and `rtl`), diff the two outputs, and emit
> ONE sheet where each direction-dependent declaration appears twice -- under
> `:where(:dir(ltr))` and `:where(:dir(rtl))`, element-scoped and interleaved at
> its original position. The **direction-twin** construction.

Its defining property: every property name, value and class name it emits is one
Foundation itself emitted, so **no consumer settings configuration can produce
invalid CSS** -- by construction, not by table lookup. Measured across 8 settings
configurations: rebind 36-56 invalid declarations, twins **0**, with **exact**
declaration-level equivalence to Foundation's own RTL build every time. In
Chromium: **0 differing computed values** vs the dual build in BOTH directions,
side by side in ONE document -- so the shipped `Rtl` story is served, and no dual
build is resurrected.

**Ticket 14's D1e hybrid is refuted as stated.** The rebind that produces its
"logical properties where safe" is *itself* the sole source of all six defect
classes; keeping it anywhere keeps the settings-dependent defect alive. D1e's
shape survives (`:dir()` is right, custom properties only compress it,
`$global-text-direction` stays the escape hatch); its substance does not.

**Per class:** (1) `text-align` -- eliminated; also found LATENT behind
`$global-flexbox`, a second settings-activated class. (2) bare-side positioning --
eliminated. (3) corner radius -- eliminated, and the 2-D mapping problem
*disappears* because the logical corner names are never needed. (4)
`background-position` -- irreducible to a logical keyword (correct suspicion) but
NOT to `:dir()`; eliminated. (5) class-NAME interpolation -- eliminated, and it is
the cleanest of the six: the name is only renamed because something renames it.
Foundation unmodified emits 20 `.align-left`/`.align-right` survivors and 0
renames; the rebind destroys 8. (6) `css-triangle` -- eliminated with NO fork.

**Mapping vs `:dir()` vs both: `:dir()` alone.** A Sass mapping layer is
*impossible* (the property name is assembled by interpolation inside Foundation's
source; the only hook -- post-`@import` mixin/function redefinition, verified
working -- reaches class 6 and nothing else). A post-process mapping layer is
already ruled out by D021. Priced anyway: it would collapse 282 of 321 twin rows,
leaving 39 irreducible -- a byte optimisation on top of `:dir()`, never a
substitute.

**Residue-of-the-residue (5 items, one with a real cost):** `:dir()` fails **2 of
the 136** pinned R022 baseline targets (chrome 119, edge 119); `:where()` is
forgiving so nothing breaks, but BOTH twins stop matching, costing 47 regressed
computed values *in LTR*. Two priced options: split twins (exact; 47 regressions
on those 2 targets) or the graceful variant with LTR values kept in the base
(0 regressions; 32 values of RTL inexactness) -- or bump the chrome/edge floor
119 -> 120, which the rolling baseline query already does. Also: **Sass cannot
rewrite selectors it did not author**, so the twin layer must be library-build-time
generated or hand-authored, never consumer-compile-time. Plus sub-component
direction changes (parity with the dual build, no better),
`$global-text-direction` as the twin-free single-direction escape hatch (now
genuinely meaningful), and `verify-foundation-parity.mjs:64,67` becoming actively
wrong under the mechanism.

**The rebind survives -- for Button only, and D1b is now a rule rather than a
judgement.** Button's whole directional surface is 5 declarations, all in SAFE
classes: the rebind gives 3 valid declarations and ZERO twins, versus 4 twin rules
and a `:dir()` dependency. Rule: *use the rebind iff 100% of a component's
`$global-left`/`$global-right` sites are SAFE, proved by compiling that component
with and without it at the widest settings config.* Button is today the only
component that passes. D1b's prohibition sharpens: do not lift the rebind into a
shared partial, because "shared" is exactly the scope at which its precondition
stops holding.

**Cost -- the map's fog item graduates: elimination does NOT cost compile time.**
Interleaved + shuffled, 7 replicates: BASE for the whole library 1350 ms
(independently reproducing ticket 13's 1.2-1.4 s ceiling); the twins' consumer
Sass cost is **not distinguishable from noise** (-4% to +7%, cell spread wider
than the medians -- an unshuffled run of the same code reported a spurious uniform
+2%); the generator is exactly one extra pass (1.9-2.1x, build-time only).
Emitted volume **+14.1%** library-wide, but **+62% for `button-group`** -- and a
metric correction: ticket 14 called `button-group` the worst component, which is
true by *defects introduced* (14 latent radius sites); by *twin work*
`xy-grid-classes` is 2x worse (144 direction-dependent declarations), though all
of its sites are SAFE.

**R008 survives.** Cascade layers sort above specificity, so unlayered consumer
rules win regardless -- verified in both authoring orders; and `:where(:dir())`
adds no specificity at all. Two new constraints: the twins MUST be emitted inside
the library's layer, and `revert-layer` is a trap in an unlayered sheet (it rolls
back past the author origin, discarding the consumer's value).

**M002 is not implicated.** No setting can activate an invalid declaration under
the mechanism; while the rebind is still shipped, `$global-radius` cannot reach
Button's directional sites (they are `float` and two margins). Exposure begins
with component #2, as ticket 14 said.
