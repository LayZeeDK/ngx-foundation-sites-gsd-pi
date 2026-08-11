# Is the settings-dependent RTL residue eliminable?

Resolves `.scratch/settings-rtl-coupling/issues/02-is-the-residue-eliminable.md`.
Status: **resolved**. AFK, no human in the loop (map.md Notes).

Nothing outside `.scratch/` was created, edited or deleted. Four new probes plus a
shared mechanism module, all under `.scratch/settings-rtl-coupling/prototypes/`:

| file | what it does |
| --- | --- |
| `rtl-eliminator.mjs` | the mechanism: compile, parse, two-pass diff, element-scoped `:dir()` selector surgery, single-sheet builder, css-tree validity oracle |
| `rtl-eliminability-probe.mjs` | substitution sweep, hook inventory, the eliminator, a settings matrix, per-defect-class table |
| `rtl-eliminability-browser.mjs` | real Chromium: CSSOM validity oracle, selector validity, computed-style equivalence vs the dual build, nested islands, R008, degradation |
| `rtl-eliminability-cost.mjs` | interleaved + shuffled compile timing, 4 conditions x 5 targets x 7 replicates |
| `rtl-baseline-support-probe.mjs` | every feature the mechanism uses, against the PINNED `.browserslistrc` (R022) |

Captured output is in `prototypes/out/run-*.txt`; the generated sheets are in
`prototypes/out/*.css`.

**Evidence key.** **[V-EXEC]** executed here, output quoted. **[V-BROWSER]**
executed in real Chromium 151.0.7922.34 via the repo's own Playwright.
**[V-SRC]** read from shipped `node_modules`. **[V-REPO]** read from a tracked
file. **[INFER]** reasoned, flagged.

---

## 1. The verdict, up front

> **ELIMINABLE. All six defect classes. Verified by execution and confirmed in
> real Chromium.** The single sheet the mechanism emits contains **0 invalid
> declarations**, preserves every public class name, and produces
> **computed styles identical to Foundation's own dual-build output in BOTH
> directions, side by side in ONE document** [V-BROWSER].
>
> **The mechanism is not the one ticket 14 recommended, and it is not a mapping
> layer.** It is:
>
> > **Do not substitute anything. Compile Foundation UNMODIFIED twice at Sass
> > time -- once at `$global-text-direction: ltr`, once at `rtl` -- diff the two
> > outputs, and emit ONE sheet in which every direction-dependent declaration
> > appears twice, once under `:where(:dir(ltr))` and once under
> > `:where(:dir(rtl))`, element-scoped and interleaved at its original position.**
>
> Call it the **direction-twin** construction. Its defining property is that
> **every property name, every value and every class name it emits is one
> Foundation itself emitted**. It therefore cannot produce invalid CSS *for any
> consumer settings configuration whatsoever* -- not because a table was checked,
> but because no new token is ever synthesised. That is elimination in the map's
> sense: **safe by construction, not gated**.
>
> **This is NOT a dual build.** A dual build ships one sheet per direction and
> cannot serve the shipped `Rtl` story. This ships ONE sheet, uses the two Sass
> passes only as the *source of truth for what differs*, and serves a
> mixed-direction document. Verified: `dir="ltr"` and `dir="rtl"` side by side in
> one document, each matching its own reference build exactly [V-BROWSER, s3].
>
> **The price is one browser version.** `:dir()` fails **2 of the 136** targets
> the pinned R022 `.browserslistrc` resolves to -- chrome 119 and edge 119, which
> support it only behind a flag. Everything else the mechanism uses (`:where()`,
> `@layer`) is 136/136 [V-EXEC, s6]. That is the single genuine cost, it is
> nameable, and there are two priced ways to pay it (s6.1).

**Ticket 14's hybrid recommendation (D1e) is REFUTED as stated, and replaced.**
D1e proposed "logical properties for the ~59 safe sites, `:dir()` overrides for
the 8 residue rows". Measured, that hybrid does not eliminate anything: the
rebind that produces those logical properties is *itself* the entire source of
all six defect classes, and it emits 36 invalid declarations at Foundation's
defaults and 56 with two legitimate settings flipped [V-EXEC, s3.1]. Keeping the
rebind anywhere keeps the settings-dependent defect class alive. The *shape* of
D1e survives (`:dir()` is the right tool, custom properties compress rather than
replace it, `$global-text-direction` stays the escape hatch); its *substance*
does not.

---

## 2. Why no substitution can work -- the refutation, measured

The rebind is variable substitution. The question "is there a better value than
`inline-start`" has a clean, measurable answer: **no, and the alternatives are
worse.** `foundation-everything()`, invalid declarations counted with css-tree's
spec lexer [V-EXEC, `run-probe.txt` section A]:

```
                                          defaults   latent sites unlocked
  left / right           (unmodified)            0                       0
  inline-start / -end    (R004, as shipped)     36                      56
  start / end                                  160                     180
  inset-inline-start / -end                    131                     151
```

"Latent sites unlocked" is `$global-flexbox: false` plus
`$buttongroup-radius-on-each: false` -- two settings a consumer may legitimately
set. Both are Foundation defaults today, which is exactly why the defect is
latent.

The reason no value works is structural and now quantified: the SAME variable is
interpolated into five syntactically different positions, in the same file and
sometimes the same mixin.

| position | Foundation source | value it needs |
| --- | --- | --- |
| property-name infix | `margin-#{$global-left}: X` | `inline-start` |
| property name, whole | `#{$global-right}: 5px` | `inset-inline-end` |
| property-name 2-D infix | `border-top-#{$global-left}-radius` | *(no substitution reaches it)* |
| declaration VALUE | `text-align: $global-left` | `start` |
| class NAME | `&.align-#{$global-left}` | `left` (unchanged) |
| mixin ARGUMENT | `css-triangle($s, $c, $global-right)` | `right` (unchanged) |

Three of the six needed values are mutually exclusive with the other three, and
the 2-D corner case is reachable by none. `$global-left: start` is instructive:
it fixes the three `text-align` sites and breaks 156 property names.

### 2.1 What CAN be intercepted, and what that buys

Foundation is `@import`ed into one global scope, so **post-`@import` mixin and
function redefinitions ARE honoured by Foundation's own later `@include`**
[V-EXEC, `run-probe.txt` B1/B2 -- both `[OK] YES`]. That is a real hook, and it
is the only one.

It reaches exactly **one** of the six classes: `css-triangle` (class 6), because
that class is the only one where a *callable* sits between the variable and the
output. Classes 1-5 are literal interpolation into a property name, a value or a
selector -- there is no callable anywhere in the path, so **a property-name
mapping layer implemented in Sass is structurally impossible, not merely
awkward**. Measured: shadowing `css-triangle` leaves the invalid-declaration
count at 56, unchanged [V-EXEC, B3].

And the hook has a second, sharper limit. Inside a shadowed mixin, `&` is live,
so the natural way to write the mirror is `&:dir(rtl) { ... }`. At the drilldown
call site `&` is `.drilldown .is-drilldown-submenu-parent>a::after`, so Sass
emits `...a::after:dir(rtl)`, and **Chromium drops that entire rule** -- a
pseudo-class may not follow a pseudo-element [V-BROWSER, s2]:

```
  [WARN] .x::after:dir(rtl)   <- Chromium DROPS the whole rule
  [OK]   .x:dir(rtl)::after
```

So even the one available Sass hook cannot correctly place `:dir()` without the
same selector surgery the generator does in JS. **Sass cannot rewrite selectors
it did not author.** That is the load-bearing structural fact behind the whole
finding.

---

## 3. The mechanism, and what it emits

### 3.1 Construction

1. Compile Foundation UNMODIFIED at `ltr` and at `rtl`, with the consumer's
   settings seeded before the `@import` in both passes.
2. Parse both to `(at-rule context, selector) -> property -> value`.
3. Diff. A property whose value differs, or that exists in only one pass, is
   **direction-dependent**. A rule that exists in only one pass contributes all
   of its declarations (this is defect class 5's shape).
4. Lift every direction-dependent declaration OUT of the shared base rule into
   two twins: `X:where(:dir(ltr))` with the LTR values, `X:where(:dir(rtl))` with
   the RTL values. Emit both immediately after the rule they came from.

Three details are load-bearing, and each was found by measurement rather than
design:

- **`:where()`, not bare `:dir()`.** `:dir()` is a pseudo-class and adds
  specificity, which lets an override outrank rules Foundation intended to win.
  Measured: the naive construction (bare `:dir(rtl)`, layer appended at the end)
  produces **30 wrong computed values**; `:where()` + interleaving produces
  **0** [V-BROWSER, s3]. `:where()` contributes zero specificity, so each twin
  merely ties its own base rule and wins on source order.
- **Element-scoped, appended to the LAST compound before any pseudo-element**
  (`.x:dir(rtl)::after`, `.menu.align-right li:dir(rtl)`), never
  `:dir(rtl) .x`. Descendant scoping is wrong for a nested opposite-direction
  island -- an LTR island inside an RTL region gets the RTL rules, because the
  outer ancestor still matches. Measured [V-BROWSER, s4]:
  `element-scoped correct: true   descendant-scoped correct: false`.
- **Twins, not overrides-with-resets.** 145 of the 321 direction-dependent rows
  at Foundation's defaults are "present in LTR, absent in RTL". An override layer
  must *neutralise* those, and no CSS value expresses "as if this declaration
  were absent": `revert-layer` rolls back the whole layer, so it also discards
  the `padding` shorthand that legitimately supplies `padding-right` in the RTL
  build, and in an UNLAYERED sheet it rolls back past the author origin entirely
  (measured: `margin-left = 0px`, not the consumer's `77px` [V-BROWSER, s5]).
  Splitting into two twins removes the problem instead of solving it: a
  declaration that exists in one direction only simply lives in that direction's
  twin.

### 3.2 What it emits, whole library, Foundation defaults

[V-EXEC, `run-probe.txt` section C]

```
base sheet (Foundation LTR, unmodified):  138075 bytes, 1357 rules
direction twins added:                     19525 bytes  (+14.1%)
single sheet serving both directions:     157600 bytes

declaration diffs between the two passes: 321
  of which selector-level (class 5 shape):  25
  present in LTR, ABSENT in RTL:           145

INVALID declarations, Foundation unmodified LTR: 0
INVALID declarations, Foundation unmodified RTL: 0
INVALID declarations, R004 rebind generalised:  36
INVALID declarations, ELIMINATOR single sheet:   0

EQUIVALENCE to Foundation's own RTL build: [OK] EXACT (0 mismatches)
```

Confirmed in the engine that would actually drop a declaration [V-BROWSER, s1/s3]:

```
Chromium-dropped declarations -- rebind: 142 | Foundation: 86 | ELIMINATOR: 86
computed-style diffs vs the dual build -- rtl: 0 | ltr: 0 | naive control: 30
```

The 86 are a constant floor present identically in all three sheets -- legacy
vendor hacks (`-webkit-overflow-scrolling: touch`,
`-ms-overflow-style`) plus an artefact of the probe's `!important` handling. The
**delta** is the finding: the rebind adds 56 dropped declarations, the eliminator
adds **zero**.

### 3.3 The settings matrix -- this is what dissolves the coupling

[V-EXEC, `run-probe.txt` section D]

```
config                                 rebind INVALID   eliminator INVALID   twins   equiv
Foundation defaults                           36                   0          321   [OK] exact
buttongroup-radius-on-each: false             56                   0          337   [OK] exact
global-flexbox: false                         36                   0          321   [OK] exact
global-radius: 3px                            36                   0          323   [OK] exact
arrows on                                     36                   0          321   [OK] exact
spacing tweaks                                36                   0          321   [OK] exact
flexbox off + radius-on-each off              56                   0          337   [OK] exact
all latent sites + radii                      56                   0          347   [OK] exact
```

**The eliminator column is 0 for every configuration, and it is 0 for reasons
that do not depend on the configuration.** The twin count moves with settings --
that is the settings-dependence, and it is now *benign*: more settings-activated
directional output means more twins, never an invalid declaration. The map's
sharp problem -- "no fixed-settings gate can bound the class, because the defect
count depends on input this repo's CI never sees" -- is answered not by a better
gate but by removing the thing that made settings dangerous.

The residual settings-dependence is **coverage**, not validity, and unlike
validity it fails *visibly* (an unmirrored element) rather than silently (a
dropped declaration). And because the generator derives the twins from the
consumer's own two passes, coverage is automatic for whatever settings the
consumer compiled with.

---

## 4. Class by class

Every row: mechanism, emitted CSS, and whether behaviour matches the dual-build
reference. All emitted CSS quoted verbatim from `run-probe.txt` section E, at the
`all latent sites + radii` configuration. All "matches" verdicts are the
0-computed-style-diff result of [V-BROWSER, s3], which exercises one live site of
each class.

### Class 1 -- `text-align: inline-start`

- **Under the rebind:** `text-align: inline-start`. Invalid: the logical values
  are `start`/`end`. 3 declarations at defaults [V-EXEC].
- **Latent too**, and this was not previously recorded: 7 of the 8 source sites
  sit in `menu-align()`'s `@else` branch behind `@if $global-flexbox`, whose
  default is `true` [V-SRC `components/_menu.scss:110-155`]. Only
  `_table.scss:150` is unconditional. So class 1 is a *second* settings-activated
  class alongside button-group's radii.
- **Eliminated by:** never renaming the value. Foundation emits `left` and
  `right`; the twins carry them.
  ```css
  .menu.align-left.vertical li:where(:dir(rtl)) { display: block; text-align: left; }
  ```
- **Matches the dual build:** YES.
- A logical mapping *could* have reached this class (`start`/`end` exist). It is
  the only one of the six where a mapping layer would have been sufficient.

### Class 2 -- bare-side positioning `inline-end: 1rem`

- **Under the rebind:** `inline-end: 1rem`. There is no bare `inline-end`
  property; logical positioning is `inset-inline-end`. 32 declarations at
  defaults, across 8 files [V-EXEC].
- **Eliminated by:** the twins carry `left`/`right`. 56 twin rows at the widest
  configuration.
  ```css
  .switch-paddle:where(:dir(ltr))::after { left: 0.25rem; }
  .switch-paddle:where(:dir(rtl))::after { right: 0.25rem; }
  ```
- **Matches the dual build:** YES. Note the `:dir()` sits before `::after` --
  the placement Chromium requires (s2.1).

### Class 3 -- `border-top-inline-start-radius`, the 2-D corner mapping

- **Under the rebind:** `border-top-inline-start-radius`. No such property. 20
  declarations once `$buttongroup-radius-on-each: false` [V-EXEC].
- **The 2-D mapping problem disappears.** The ticket is right that
  `border-top-left-radius -> border-start-start-radius` is a 2-dimensional
  mapping and not a string substitution -- but the mechanism never needs the
  logical corner names at all. It keeps Foundation's physical corners and swaps
  which one is set:
  ```css
  .button-group .button:last-child:where(:dir(ltr)) {
    margin-right: 0; border-top-right-radius: 6px; border-bottom-right-radius: 6px;
  }
  .button-group .button:last-child:where(:dir(rtl)) {
    margin-left: 0; border-top-left-radius: 6px; border-bottom-left-radius: 6px;
  }
  ```
- **Matches the dual build:** YES. 24 twin rows.
- This is the class ticket 14 measured as LATENT and used to state the coupling.
  It is fully eliminated, at all settings.

### Class 4 -- `background-position`, "may be irreducible"

- **Under the rebind:** `background-position: inline-end -1rem center`. Invalid;
  `background-position` accepts no logical keyword. 1 declaration,
  `forms/_select.scss:45`.
- **The ticket's suspicion is half right.** It IS irreducible *to a logical
  keyword* -- no such keyword exists and none is coming. It is **not** irreducible
  to `:dir()`, because a direction selector does not need the property to have a
  logical form; it only needs two values.
  ```css
  select:where(:dir(ltr)) { background-position: right -1rem center; padding-right: 1.5rem; }
  select:where(:dir(rtl)) { background-position: left -1rem center;  padding-left: 1.5rem; }
  ```
- **Matches the dual build:** YES. Confirmed at the computed level: the
  side-by-side document shows `backgroundPosition calc(100% + 16px) 50% -> -16px 50%`
  [V-BROWSER, s3].
- The ticket asks what covers it if a mapping cannot: **`:dir()` does, and a
  custom property does not** -- a custom property could hold the value but still
  needs a direction selector to choose it, so it only compresses (ticket 14 D1d,
  confirmed).

### Class 5 -- class-NAME interpolation `.align-inline-start` (the hard one)

- **Under the rebind:** `&.align-#{$global-left}` emits `.align-inline-start`.
  Valid CSS matching nothing; Foundation's public `.align-right` is silently
  renamed. Measured as selectors [V-EXEC, B4]:
  ```
  rebind:      .align-inline-* selectors emitted: 8
               .align-left/.align-right survivors: 12
  unmodified:  .align-inline-* selectors emitted: 0
               .align-left/.align-right survivors: 20
  ```
  8 of Foundation's 20 public alignment selectors are destroyed.
- **The ticket's framing is right and its conclusion is wrong.** Right: it is a
  selector, so a property-name mapping layer structurally cannot touch it, and it
  must be *prevented* rather than detected. Wrong: preventing it is trivial once
  you stop substituting. **The class name is only renamed because something
  renames it.** Foundation unmodified emits `.align-left` and `.align-right` in
  BOTH builds -- 20 survivors, 0 renames, at both directions.
- **What actually varies is the declarations inside**, and this is the subtle
  part. In Foundation's LTR build `.menu.align-right` gets `menu-align(right)`;
  in its RTL build `.menu.align-right` is generated from `align-#{$global-left}`
  and gets `menu-align(left)`. Same class, different declarations, **same
  physical meaning in both** -- because the emitted `flex-start`/`flex-end` values
  are writing-mode relative. So the public contract is "`.align-right` means
  physical right", in both directions, and the single sheet must reproduce that.
  It does: 25 of the 321 rows are selector-level, and the twins carry them.
  ```css
  .menu.align-right:where(:dir(rtl)) { justify-content: flex-start; }
  ```
- **Matches the dual build:** YES. Confirmed at the computed level, including the
  non-obvious part: in the side-by-side document `.menu.align-right` computes
  **identically** in the LTR and RTL halves -- `mirrors on: (nothing)` -- which is
  exactly correct, because a physical class name must not mirror [V-BROWSER, s3].
- **Verdict on "the hard one": eliminable, and it is the class the mechanism
  handles most cleanly.** It is hard only for a mapping layer.

### Class 6 -- `css-triangle` emitting a solid square

- **Under the rebind:** `css-triangle($size, $color, $global-right)` passes
  `inline-end`, which matches no `@if` branch, so the mixin emits its unbranched
  prelude and stops. Reproduced verbatim [V-EXEC, B3]:
  ```
  .drilldown .is-drilldown-submenu-parent>a::after {
    display: block; width: 0; height: 0;
    border-style: solid; border-width: 6px; content: "";
    position: absolute; top: 50%; margin-top: -6px; inline-end: 1rem
  }
  ```
  No `border-color`, no `border-*-width: 0` -- **a solid 12px square**, plus an
  invalid `inline-end`. Every declaration present is valid CSS, so no validity
  oracle can catch it.
- **Two mechanisms reach it, and they are not equivalent.**
  1. *Shadow the mixin.* Works -- post-`@import` redefinition is honoured
     [V-EXEC, B1] -- and produces a correct triangle. But its natural
     `&:dir(rtl)` emits `...::after:dir(rtl)`, which **Chromium drops entirely**
     [V-BROWSER, s2]. It also requires re-implementing ~20 lines of
     `util/_mixins.scss`, i.e. a small fork.
  2. *The twins.* No fork, no hook. The wrong-branch output never occurs because
     the argument is never rewritten; the geometry difference between the two
     builds shows up as ordinary declaration diffs.
     ```css
     .drilldown .is-drilldown-submenu-parent>a:where(:dir(ltr))::after {
       border-right-width: 0; border-color: transparent transparent transparent #1779ba; right: 1rem;
     }
     .drilldown .is-drilldown-submenu-parent>a:where(:dir(rtl))::after {
       border-left-width: 0; border-color: transparent #1779ba transparent transparent; left: 1rem;
     }
     ```
- **Matches the dual build:** YES, mechanism 2. Confirmed at the computed level:
  `borderLeftWidth 6px -> 0px | borderRightWidth 0px -> 6px | left 18px -> 16px | right 16px -> 18px`
  [V-BROWSER, s3].
- **Verdict:** eliminable without forking Foundation's Sass. The refutation the
  ticket invited ("classes 5 and 6 are not eliminable short of a fork") does not
  hold -- but only because the mechanism abandons substitution entirely. It holds
  for every substitution-based or mapping-based mechanism.

---

## 5. The three design questions

### 5.1 Property-name mapping vs `:dir()` vs both

**`:dir()` alone. A mapping layer is not part of the answer, and it is not
available anyway.**

- A Sass mapping layer is **impossible**, not merely unattractive: the property
  name is assembled by interpolation *inside Foundation's source*, and Sass
  offers no interception point for a literal property name, a literal value or a
  literal selector. The one hook that exists (mixin/function redefinition,
  verified working [V-EXEC, B1/B2]) reaches exactly one of the six classes.
- A **post-process** mapping layer is available in principle -- and D021 already
  ruled it out for this library because `styleUrl` leaves no library-controlled
  CSS artifact [V-GSD, via ticket 14]. That ruling stands and this ticket does
  not re-open it.
- What a mapping layer would buy, priced: **282 of the 321 direction-dependent
  rows are 1:1 physical pairs** (`margin-left`/`margin-right`,
  `padding-*`, `border-*`, `left`/`right`, the radius corners) that a logical
  property would collapse to a single declaration. **39 rows are irreducible** --
  no logical property exists for them at all [V-EXEC, s C]. So a mapping layer
  would shrink the twin layer by roughly 88% of its rows and would still need
  `:dir()` for the remainder. It is a **byte optimisation on top of `:dir()`,
  never a substitute for it**, and it costs the one property that makes the
  mechanism worth having: the guarantee that no synthesised token is ever
  emitted.

**What `:dir()` does NOT cover -- see section 6.** **What a mapping layer does
NOT cover:** classes 5 and 6 (selector-level and argument-level), and the 39
irreducible rows. **What a custom property does not cover:** anything, alone --
it cannot read direction, so it compresses `:dir()` rather than replacing it
(ticket 14 D1d, unchanged; the mechanism here has no sign-of-a-number residue
left for it to compress, because the twins carry the values directly).

### 5.2 Is the rebind still the right foundation?

**Yes for Button. No for anything else. And no divergence is created, because
the two are the same mechanism at different settings.**

D1b (the rebind stays in `internal/_foundation-button.scss` and must not be
lifted into a shared partial) **survives, on stronger grounds than before.**
Measured, Button's entire direction-dependent surface is 5 declarations in 4
rules [V-EXEC]:

```
.button.dropdown::after   { float: right -> left }
.button.dropdown::after   { margin-left: 1em -> undefined }
.button.dropdown::after   { margin-right: undefined -> 1em }
.button.arrow-only::after { margin-left: 0 -> undefined }
.button.arrow-only::after { margin-right: undefined -> 0 }
```

All three properties are in the SAFE classes, so the rebind turns them into
`float: inline-end` and `margin-inline-start`, giving **3 valid declarations and
ZERO twins**. The eliminator would give **4 twin rules and 6 declarations** for
the same behaviour, plus a `:dir()` dependency Button does not otherwise have.
For Button the rebind is strictly smaller, strictly valid, and strictly better
supported (`css-logical-props` is 136/136; `:dir()` is 134/136).

**Does Button eventually migrate?** Only if the library later adopts the twins
*and* wants a single uniform mechanism for its own sake. There is no correctness
reason to migrate and one measurable reason not to (the 2 baseline targets).
State it as a rule rather than a per-component judgement:

> **Use the rebind for a component if and only if 100% of its
> `$global-left`/`$global-right` sites fall in the SAFE classes, proved by
> compiling that component with and without the rebind and asserting zero invalid
> declarations at the widest settings configuration. Otherwise use the twins.**

That test is 15 lines against the probes here, it is per-component and
settings-swept, and it makes D1g's "onboarding obligation" mechanical instead of
a manual classification against a table. And it makes the divergence principled:
Button is not a special case, it is the case that passes the test. Today Button
is the ONLY component that passes it -- `foundation-table` comes closest with 1
direction-dependent declaration, and it is a `text-align`, i.e. a BROKEN class.

D1b's prohibition sharpens accordingly: **the rebind must not be lifted into a
shared partial, because "shared" is exactly the scope at which its precondition
stops holding.**

### 5.3 Cost

See section 7. Short version: **consumer compile cost is not distinguishable from
noise; the generator costs exactly one extra Sass pass (2.0x); the sheet grows
14%.** Ticket 13's ~1.2-1.4 s ceiling is reproduced (1350 ms) and not moved.

---

## 6. The residue-of-the-residue -- what NO mechanism covers

Five items. The first is the only one that costs anything.

**R1. `:dir()` is not in the pinned browser baseline.** [V-EXEC,
`run-baseline.txt`]

```
pinned browserslist query resolves to 136 targets

css-dir-pseudo             134 / 136    [WARN] fails 2: chrome 119=n d #1, edge 119=n d #1
css-matches-pseudo         136 / 136    [OK] all targets     :where()
css-cascade-layers         136 / 136    [OK] all targets     @layer  (R008)
css-revert-value           136 / 136    [OK] all targets
css-logical-props          136 / 136    [OK] all targets     (the rebind, for comparison)
```

`:dir()` shipped in Chrome/Edge 120; the pinned query floors at 119. This is the
mechanism's whole cost, and the consequence was measured rather than assumed.

`:where()` is **forgiving** -- an unknown pseudo-class inside it is discarded and
the rule survives, matching nothing [V-BROWSER, s6: Chromium keeps
`.probe:where()`; the unwrapped `.probe:nfs-not-a-real-pseudo` rule is dropped
whole]. So the failure mode is not a parse error. But it is also **not graceful**
for the twin construction, because BOTH twins stop matching:

```
SIMULATED :dir()-less engine, split-twin sheet:
  ltr subtree vs Foundation LTR build                       [WARN] 47 differing computed values
  rtl subtree vs TODAY (Foundation LTR sheet, rtl subtree)  [WARN] 47 differing computed values
```

47 computed values regress *in LTR*, on chrome/edge 119 -- text alignment,
positioning, margins and flex alignment simply vanish. That is worse than today.

**6.1 Two priced ways to pay it.**

| option | exactness vs the dual build | chrome/edge 119 |
| --- | --- | --- |
| **A. Split twins** (the recommendation) | **0 differing computed values** | 47 regressions in LTR |
| **B. Graceful variant** -- LTR values stay in the base rule, only an RTL twin is added | **32 differing computed values** | **[OK] IDENTICAL to today** |
| C. Raise the chrome/edge floor 119 -> 120 | 0 | n/a -- excluded |

[V-BROWSER, s6, both measured on the same markup]

Option B is the honest fallback and its 32-value gap has a single cause: it
cannot express "this declaration is ABSENT in RTL" (145 of 321 rows), so
LTR-only declarations leak into RTL. Option C costs one browser version, and
the `.browserslistrc` header itself records that the ROLLING baseline query
already resolves to chrome/edge 121 [V-REPO] -- so the pin is what excludes
`:dir()`, and the drift is in the mechanism's favour.

**R2. Sass cannot rewrite selectors it did not author.** The mechanism needs
element-scoped `:dir()` inserted before any pseudo-element, per compound, per
selector-list part. Sass has no construct that transforms the selectors an
`@include` generates -- confirmed by the one case where a hook exists, where
`&:dir(rtl)` produced the invalid `::after:dir(rtl)` [V-BROWSER, s2]. **Therefore
the twin layer cannot be generated at consumer compile time.** It must be either
(a) generated at library build time by a script like this one and shipped as
CSS/Sass, or (b) hand-authored as a Sass partial mirroring Foundation's `@if`
guards. (b) tracks consumer settings; (a) does not. This is the one place where
the settings coupling genuinely survives, and it is now a build-shape question
rather than a correctness question.

**R3. Sub-component direction changes.** A twin keyed on
`.menu:where(:dir(rtl)) .submenu li` is correct when the element itself resolves
RTL; the mechanism scopes on the LAST compound, so it is correct per element.
But where Foundation's own rule sets a property on an ancestor that a descendant
inherits, both builds behave the same and **the twins inherit exactly Foundation's
blindness, no more**. Parity with the dual build is maintained; absolute
correctness is not claimed by either.

**R4. `$global-text-direction` remains the only escape hatch for a consumer who
does not want the twins at all.** Under the mechanism it becomes genuinely
meaningful for the first time: compile ONE pass at the chosen direction and skip
the twin layer, yielding a strictly smaller, `:dir()`-free, single-direction
sheet. D2's "accept and honour" verdict survives and gets a real implementation.
The disclosure text in D2 ("currently a no-op") stays accurate only while Button
is the whole surface.

**R5. Nothing here covers `verify-foundation-parity.mjs:64,67`**, which still
maps `text-align: left -> inline-start` and thus blesses a class-1 defect
[V-REPO]. It is out of this map's scope (map.md "Out of scope") and remains
correct-to-not-propagate. Note the mechanism makes it *actively* wrong in a new
way: under the twins the library emits `text-align: left`, matching Foundation
byte for byte, so the gate's translation would report a false failure.

---

## 7. Cost

Measured with every (condition, target, replicate) pair in one list, **shuffled
with a seeded Fisher-Yates before execution**, medians reported, after a warm-up
compile outside the measurement. 7 replicates per cell. [V-EXEC, `run-cost.txt`]

```
component                       BASE ms   REBIND ms    TWINS ms   TWINS delta      GEN ms
foundation-everything            1350.0     1362.5      1340.1  -9.9 ms (-1%)      2608.2
foundation-xy-grid-classes        366.9      383.7       393.6  +26.8 ms (7%)       791.6
foundation-button-group           272.5      249.4       260.3  -12.1 ms (-4%)      497.6
foundation-menu                   150.1      149.4       155.6   +5.5 ms (4%)       299.0
foundation-button                 242.7      246.9       245.2   +2.4 ms (1%)       476.1

spread (min..max per cell):
  foundation-everything          BASE 1249..1413   TWINS 1275..1404   GEN 2523..3099
  foundation-button-group        BASE 245..312     TWINS 227..274     GEN 469..552
```

- **BASE for the whole library is 1350 ms -- inside ticket 13's measured
  1.2-1.4 s ceiling.** Independent reproduction of that number on a different
  code path.
- **The twin layer's consumer-time Sass cost is NOT distinguishable from noise.**
  The delta straddles zero (-4% to +7%) and every cell's own min..max spread is
  wider than the between-condition medians. An earlier unshuffled run of the same
  code reported +2% everywhere; the shuffled run reports -1%. Reporting "+2%"
  would have been the declaration-order artefact the map warns about. **The
  honest statement is: no measurable cost, upper-bounded by roughly 30 ms on the
  whole library.**
- **The generator costs exactly one extra Sass pass: 1.9-2.1x, additive.** For
  the whole library that is 2608 ms instead of 1350 ms. This is a **build-time /
  gate** cost, not a consumer cost.
- **Emitted volume: +14.1% for the whole library** (138,075 -> 157,600 bytes,
  19,525 bytes of twins) [V-EXEC].

**Per-component, and this revises a ticket-14 claim.** Direction-dependent
declarations, at the widest settings configuration [V-EXEC, `run-cost.txt`]:

```
component                      base bytes   rules   dir-dependent decls   twin bytes
foundation-everything              143399    1363                   337        20486
foundation-xy-grid-classes          45289     516                   144         7452
foundation-button-group             27157      86                    72        16787
foundation-switch                    2646      29                    20         1057
foundation-menu                      4396      47                    18         1812
foundation-drilldown-menu            2166      15                    14          867
foundation-forms                     5865      43                    13          743
foundation-accordion-menu            2048      16                    12          637
foundation-button                    9619      54                     5          239
foundation-table                     1964      21                     1          243
```

Ticket 14 named `button-group` the worst component. **By direction-dependent
output volume the worst is `xy-grid-classes` (144 declarations, 2x button-group)
-- but every one of them is in a SAFE class (offset margins), so the rebind does
not break it.** Both statements are true of different metrics and the distinction
matters for planning: `button-group` is worst by *defects introduced*
(14 latent radius sites), `xy-grid-classes` by *work the twins must do*.
`button-group` is also the worst by twin RATIO: **+62% bytes** (16,787 on
27,157), against +14% for the library. Sizing the twin layer from the
library-wide average would underestimate a small radius-heavy component by 4x.

**Graduating the map's fog item** ("Whether elimination costs compile time"):
**it does not.** Elimination costs +14% emitted bytes, one extra Sass pass at
build time, and one browser version. Compile time is unchanged.

---

## 8. R008 -- the cascade win survives

The ticket requires checking that `:dir()`'s specificity does not disturb the
unlayered-beats-`@layer nfs-defaults` split. Measured in real Chromium
[V-BROWSER, s5]:

```
consumer rule authored FIRST, unlayered:  margin-right = 99px  (want 99px)
consumer rule authored LAST,  unlayered:  margin-right = 99px  (want 99px)
layered :dir() override still applies:    margin-left  = 3px   (want 3px)
```

**R008 survives, and it survives for a reason stronger than the measurement:**
cascade layers are sorted **above** specificity, so an unlayered author
declaration beats any layered one regardless of how specific the layered selector
is. `:dir()` adds a pseudo-class (+0,1,0) and `:where(:dir())` adds nothing at
all, so the recommended form does not even change specificity [V-SPEC + V-BROWSER].

Two constraints fall out, and both are new:

- **The twins MUST be emitted inside the same layer as the rest of the library
  defaults.** If they were emitted unlayered they would compete with consumer
  theme rules on specificity and could win, inverting R008.
- **If the naive override construction is ever used instead, `revert-layer` is a
  trap in an unlayered sheet**: it rolls back past the entire author origin, not
  to the consumer's value. Measured: `margin-left = 0px` where the consumer set
  `77px` [V-BROWSER, s5]. The recommended twin construction uses no
  `revert-layer` at all, which is one of the reasons to prefer it.

---

## 9. Does this pull M002 back in?

**No, and the answer is now stronger than "probably not".** map.md asks whether
any of the addon's six controls can activate RTL residue. Under the mechanism the
question dissolves for the whole library: **no setting can activate an invalid
declaration**, because none is ever synthesised (s3.3, 8 configurations,
eliminator column 0 throughout). `$global-radius` -- the control map.md flagged
-- appears in the matrix (`global-radius: 3px`, `all latent sites + radii`) and
changes only the twin count.

The finding that does touch M002 is smaller and is a *confirmation*: while the
rebind remains the shipped mechanism, `$global-radius` cannot activate residue in
**Button**, because Button's radius sites are not directional at all (its 5
direction-dependent declarations are `float` and two margins). The exposure
begins with component #2, exactly as ticket 14 said. **M002's addon is not
implicated.**

---

## 10. VERIFIED vs INFERRED

**VERIFIED BY EXECUTION [V-EXEC]** -- `prototypes/out/run-*.txt`:

- No substitution value works: `left/right` 0 invalid, `inline-start/-end` 36/56,
  `start/end` 160/180, `inset-inline-*` 131/151.
- Post-`@import` mixin AND function redefinition are honoured by Foundation's own
  later `@include`.
- The rebind emits a solid square at the drilldown arrow (no `border-color`, no
  `border-*-width: 0`) plus an invalid `inline-end: 1rem`.
- The rebind destroys 8 of Foundation's 20 public `.align-left`/`.align-right`
  selectors; Foundation unmodified emits 0 renames and 20 survivors.
- Class 1's `text-align` sites are LATENT behind `$global-flexbox` -- a second
  settings-activated class, not previously recorded.
- The direction-twin sheet: 0 invalid declarations, exact declaration-level
  equivalence to Foundation's own RTL build (0 mismatches), across 8 settings
  configurations.
- 282 of 321 direction-dependent rows are collapsible by a logical-property
  mapping; 39 are irreducible.
- Sheet growth +14.1% library-wide, +62% for `button-group`.
- Compile cost: BASE 1350 ms (reproducing ticket 13's ceiling), twins not
  distinguishable from noise, generator exactly 1.9-2.1x.
- `:dir()` fails 2 of 136 pinned baseline targets; `:where()`, `@layer`,
  `revert`, `css-logical-props` all 136/136.

**VERIFIED IN REAL CHROMIUM [V-BROWSER]** -- `prototypes/out/run-browser.txt`:

- The single sheet produces computed styles **identical** to Foundation's own
  LTR build in an LTR subtree AND its own RTL build in an RTL subtree, with both
  subtrees in ONE document.
- The naive construction (bare `:dir()`, layer appended) produces 30 wrong
  computed values; `:where()` + interleaving produces 0.
- `.x::after:dir(rtl)` is dropped whole; `.x:dir(rtl)::after` is kept.
- Element-scoped `:dir()` is correct for a nested opposite-direction island;
  descendant-scoped `:dir()` is wrong.
- R008 holds in both authoring orders; `revert-layer` in an unlayered sheet rolls
  back past the author origin.
- `:where()` is forgiving; on a simulated `:dir()`-less engine the split twins
  cost 47 regressed computed values, and the graceful variant costs 0 (at 32
  values of RTL inexactness).
- Chromium drops 142 declarations from the rebind sheet and 86 from both
  Foundation's own sheet and the eliminator's -- delta +56 vs +0.

**VERIFIED BY READING [V-SRC / V-REPO]:**

- `_menu.scss:110-155` puts 7 of the 8 `text-align` sites in `menu-align()`'s
  non-flexbox `@else` branch.
- `util/_mixins.scss:45-73` `css-triangle` switches on `down|up|right|left` with
  no `@else`, so an unmatched argument silently emits the prelude only.
- `.browserslistrc` pins `baseline widely available on 2026-05-07` and its own
  header records that the rolling query resolves to chrome/edge 121.

**INFERRED, flagged:**

- That a hand-authored Sass partial mirroring Foundation's `@if` guards would
  track consumer settings. Follows from it being Sass; no such partial was
  written (writing 337 twin rules by hand is the milestone's work, not this
  ticket's).
- That the per-component "100% SAFE classes" test (s5.2) is the right onboarding
  gate. The test itself is mechanical and was run for Button and 9 other
  components; its adequacy as a *policy* is a judgement.
- That `:dir()` support will keep improving relative to a pinned baseline. Based
  on the `.browserslistrc` header's own measurement of the rolling query, not on
  a forecast.
- The 86-declaration Chromium floor being entirely legacy vendor hacks plus an
  `!important` artefact of the probe. Spot-checked in the output, not exhaustively
  classified. It is identical across all three sheets, so it does not affect any
  delta.
