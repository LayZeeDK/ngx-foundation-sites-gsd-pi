# Which settings activate RTL residue, and by how much -- the sensitivity map

Resolves ticket `.scratch/settings-rtl-coupling/issues/01-settings-sensitivity-map.md`.
Status: **resolved** (AFK -- no human in the loop, per map.md Notes).

No file outside `.scratch/` was created, edited or deleted. No `research/*.md` under
`.scratch/m002-storybook-theming-addon/` was touched. Six new probes, all read-only,
in `.scratch/settings-rtl-coupling/prototypes/`:

- `rebind-site-gates.mjs` -- inverts the search: from each of the 109 rebind source
  sites, walks UP the block structure to the settings that gate it.
- `gate-closure.mjs` -- the same, transitively through the mixin call graph
  (closes the one leak the intra-file walk had).
- `rtl-defect-classifier.mjs` -- shared detector for all six ticket-14 defect
  classes, including the two that emit VALID CSS.
- `settings-activation-sweep.mjs` -- perturbation sweep over `foundation-everything()`.
- `per-component-sweep.mjs` -- the same over this library's own per-component
  include model, plus the additivity (pairwise) test and an order-independence control.
- `m002-and-class-name-probe.mjs` -- the M002 question through both the shipped
  and the maximal route, plus the class-name defect enumerated.
- `unboundedness-law.mjs` -- held-out prediction test for the growth law.

## Evidence key

- **[V-EXEC]** -- verified by executing a probe here, output quoted.
- **[V-SRC]** -- verified by reading shipped `node_modules` source (path + line).
- **[V-PRIOR]** -- carried from the M002 map's own verification, cited.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

---

## 1. THE M002 VERDICT, UP FRONT: **CLEAN BILL OF HEALTH**

> **None of the M002 addon's six live controls can activate RTL residue in any
> Foundation component, in any of the six defect classes, at any value tested.
> M002's closed hand-off is NOT implicated. Verified three independent ways.**

The worry was concrete and reasonable: `$global-radius` is one of the six controls,
and `button-group`'s latent class is radius-shaped. **The worry does not land, and
the reason is sharper than "it happens not to":**

> **The radius-shaped defect is gated by a BOOLEAN, not by a radius.** The 14
> `button-group` sites sit behind `@if not $buttongroup-radius-on-each`
> [V-SRC: `_button-group.scss:71`]. Once that boolean opens the gate, Foundation
> emits `border-top-#{$global-left}-radius: $button-radius` **whatever the radius
> is** -- including `0`, which is the default and which still emits an invalid
> declaration. So `$global-radius` cannot open the gate and cannot close it.

Measured, crossing the radius control against the setting that DOES activate the
class [V-EXEC, `m002-and-class-name-probe.mjs` D3]:

```
  $global-radius: 0      $buttongroup-radius-on-each: true   -> c3_radius=0   invalid=102
  $global-radius: 0      $buttongroup-radius-on-each: false  -> c3_radius=20  invalid=122
  $global-radius: 6px    $buttongroup-radius-on-each: true   -> c3_radius=0   invalid=102
  $global-radius: 6px    $buttongroup-radius-on-each: false  -> c3_radius=20  invalid=122
  $global-radius: 50%    $buttongroup-radius-on-each: true   -> c3_radius=0   invalid=102
  $global-radius: 50%    $buttongroup-radius-on-each: false  -> c3_radius=20  invalid=122
```

The radius value moves nothing. The boolean moves everything, identically at every
radius.

### 1.1 Evidence 1 -- the SHIPPED route (what the addon actually drives today)

The real public `theme()` chain, which already carries the R004 rebind, driven with
each control [V-EXEC, `m002-and-class-name-probe.mjs` D1a]:

```
    5839B  invalid=0  c1=0 c2=0 c3=0 c4=0 c5=0 c6=0   defaults
    5841B  invalid=0  c1=0 c2=0 c3=0 c4=0 c5=0 c6=0   radius 6px          [control 6]
    5839B  invalid=0  c1=0 c2=0 c3=0 c4=0 c5=0 c6=0   radius 0
    5844B  invalid=0  c1=0 c2=0 c3=0 c4=0 c5=0 c6=0   radius 9999px
    5938B  invalid=0  c1=0 c2=0 c3=0 c4=0 c5=0 c6=0   all five palette colours [1-5]
    5940B  invalid=0  c1=0 c2=0 c3=0 c4=0 c5=0 c6=0   ALL SIX controls
```

Zero in every class, every case. This confirms ticket 14's 4.4 from the other
direction: Button hits only the two SAFE classes, so there is nothing for a control
to activate.

### 1.2 Evidence 2 -- the MAXIMAL route (the exposure a future settings surface creates)

The stronger test, because a clean bill that only holds at N=1 is worth nothing.
All 41 Foundation component mixins, rebind applied, the six controls driven as bare
Foundation globals -- i.e. ticket 15's "bar 3" settings surface, which NF7's M4/D2
result proves DOES restore the derivation cascade the island kills
[V-EXEC, `m002-and-class-name-probe.mjs` D1b]:

```
  BASELINE (radius default 0): invalid=102 c1=3 c2=98 c3=0 c4=1 c5=13 c6=2 valid=257
  $global-radius: 0        -> ...identical...  [NO DEFECT CHANGE]
  $global-radius: 1px      -> ...identical...  [NO DEFECT CHANGE]
  $global-radius: 3px      -> ...identical...  [NO DEFECT CHANGE]
  $global-radius: 6px      -> ...identical...  [NO DEFECT CHANGE]
  $global-radius: 0.5rem   -> ...identical...  [NO DEFECT CHANGE]
  $global-radius: 2rem     -> ...identical...  [NO DEFECT CHANGE]
  $global-radius: 50%      -> ...identical...  [NO DEFECT CHANGE]
  $global-radius: 9999px   -> ...identical...  [NO DEFECT CHANGE]
  $foundation-palette.primary    -> ...identical...  [NO DEFECT CHANGE]
  $foundation-palette.secondary  -> ...identical...  [NO DEFECT CHANGE]
  $foundation-palette.success    -> ...identical...  [NO DEFECT CHANGE]
  $foundation-palette.alert      -> ...identical...  [NO DEFECT CHANGE]
  $foundation-palette.warning    -> ...identical...  [NO DEFECT CHANGE]
```

13 perturbations, six defect classes each, **zero change in every cell**.

**And note this is NOT the NF7 inertness result restated.** NF7 measured the six
globals inert *through the island's pre-seeding*. Here they are **live**:
`$global-radius: 6px` changes the emitted CSS by +128 bytes
[V-EXEC, `per-component-sweep.mjs`], and the palette keys by -213. The clean bill is
therefore the strong form -- **the controls reach the CSS and still activate no
residue** -- not the weak form "they are wired to nothing". A settings milestone
that deliberately restores the cascade (ticket 15's section 6 item 3, "the single
most consequential item") does not thereby import an RTL problem via these six
names.

### 1.3 Evidence 3 -- static, from the source rather than from compiles

The transitive gate closure over all 109 rebind sites -- every settings variable
that can conditionally admit or suppress a site through *any* call path
[V-EXEC, `gate-closure.mjs`]:

```
=== M002 STATIC CHECK: are the addon's six controls in the gate closure? ===
  $global-radius        in closure: [OK] NO
  $foundation-palette   in closure: [OK] NO
  $primary-color        in closure: [OK] NO
  $secondary-color      in closure: [OK] NO
  $success-color        in closure: [OK] NO
  $alert-color          in closure: [OK] NO
  $warning-color        in closure: [OK] NO
```

Static and dynamic agree. **The verdict is not a value-sampling artefact.**

### 1.4 What M002 owes the settings/RTL coupling: nothing, and one sentence

No M002 decision needs re-opening. The map's Out-of-scope entry
("Re-opening M002's closed decisions -- unless the sensitivity map shows one of the
addon's six controls activates residue") is **not triggered**.

One thing worth recording next to R009's control table, because it is the
non-obvious half of the result: **the six controls are safe for a structural
reason, not a numerical one.** They are all *value* settings -- a colour or a
length. Every setting measured to activate residue is a *shape* setting -- a
boolean, a keyword, a count, or a map length -- because activating residue requires
changing which declarations are emitted, and only shape settings do that. If the
addon's control set is ever widened, **the test is not "is it a Foundation global?"
but "can it change WHICH rules are emitted?"** A single boolean control would put
the addon back in scope.

---

## 2. The sensitivity map

### 2.1 The two harnesses, and a measurement artefact caught on the way

Two compile models, because they give different answers and only one matches this
library:

| Harness | What it is | Baseline with the rebind, Foundation defaults |
| --- | --- | --- |
| `foundation-everything()` | Foundation's own top-level entry | 143020 B, **invalid=36** (c1=3, c2=32, c3=0, c4=1), c5=13, c6=2, valid=127 |
| per-component includes (41 mixins) | **this library's island idiom** [V-SRC: `internal/_foundation-button.scss:53-55` imports partials then the component `@include`s] | 187013 B, **invalid=102** (c1=3, c2=98, c3=0, c4=1), c5=13, c6=2, valid=257 |

The first row **exactly reproduces ticket 14's 36 invalid / 127 valid** [V-PRIOR],
so the new classifier is calibrated against the prior measurement rather than
replacing it.

> **[WARN] MEASUREMENT ARTEFACT, recorded so it is not repeated.**
> `foundation-everything()` executes `$global-flexbox: true !global;` when its
> `$flex` argument is true, which is the default [V-SRC: `foundation.scss:80-87`].
> **It silently overwrites the consumer's `$global-flexbox` setting.** Measured
> through that entry point, `$global-flexbox: false` is byte-identical -- which
> reads as "inert" and is not. Measured through per-component includes, the same
> setting activates 4 `text-align` defects and masks 7 class-name defects. Any
> future gate that compiles `foundation-everything()` will report a false clean on
> every `$global-flexbox`-gated site.

Order-independence control, because count-based measurements can be corrupted by
emission order: 4 shuffled mixin orders, defect counts **identical** in every class,
bytes identical [V-EXEC, `per-component-sweep.mjs --shuffle 4`].

**Second-order finding worth its own line: the defect count is also a function of
the COMPONENT SET, not only of settings.** 36 vs 102 at identical settings, purely
from which mixins are included. A gate must pin the component set as well as the
settings, and this library's component set grows by design.

### 2.2 Which settings activate residue -- the map

From 109 rebind source sites: **64 emit unconditionally** (no settings guard on any
call path), **45 sit behind at least one settings guard**. The transitive closure
names **15 distinct settings** out of a **498-name consumer-settable vocabulary**
(Foundation's 490-name template plus every `!default` elsewhere in the tree) --
**3.0 %** [V-EXEC, `gate-closure.mjs`].

Of those 15, **13 were measured to change a defect count** [V-EXEC,
`per-component-sweep.mjs`]. Full map, against the per-component baseline:

| Setting | Default | Tested value | Effect on defect counts | Class touched | Components |
| --- | --- | --- | --- | --- | --- |
| `$grid-column-count` | 12 | 24 | **c2 +72** | 2 | xy-grid / grid position |
| | | 6 | c2 -36 | 2 | |
| `$breakpoint-classes` | `(small medium large)` | + xlarge xxlarge | **c2 +50** | 2 | xy-grid position |
| | | `(small)` | c2 -50 | 2 | |
| `$breakpoints` (+2 names, all classes) | 5 names | 7 names | **c2 +100** | 2 | xy-grid position |
| `$buttongroup-radius-on-each` | `true` | `false` | **c3 +20** (0 -> 20) | 3 | button-group |
| `$global-flexbox` | `true` | `false` | **c1 +4**, **c5 -7** | 1 and 5 | menu, accordion-menu |
| `$dropdownmenu-arrows` | `true` | `false` | c2 -10 | 2 | dropdown-menu |
| `$drilldown-arrows` | `true` | `false` | c2 -1, **c6 -2** (2 -> 0) | 2 and 6 | drilldown |
| `$accordion-plusminus` | `true` | `false` | c2 -1 | 2 | accordion |
| `$accordionmenu-arrows` | `true` | `false` | c2 -1 | 2 | accordion-menu |
| `$select-triangle-color` | `#333` | `transparent` | **c4 -1** (1 -> 0) | 4 | forms/select |

The remaining 2 of the 15 (`$-zf-zero-breakpoint`, plus `$menu-centered-back-compat`)
change emitted CSS but no defect count; `$buttongroup-expand-max`,
`$pagination-arrows`, `$input-prefix-border` and `$grid-column-align-edge` gate only
SAFE-class sites [V-EXEC].

**Independent cross-check.** A brute-force sweep flipping **all 31 booleans** in
Foundation's 490-name settings template found exactly the same activating set and
nothing else -- and it caught `$accordionmenu-arrows`, which the intra-file walk had
missed because its `@if` guard sits around the `@include` of the mixin, 51 lines
from the declaration [V-SRC: `_accordion-menu.scss:62` inside the mixin,
`:113` the guard]. That miss is what motivated the transitive-closure probe; after
it, the static and brute-force answers agree.

---

## 3. Is the class BOUNDED? **NO -- and there is an exact law that says so**

**The SET of activating settings is bounded: 15 names, 3.0 % of the vocabulary.
The COUNT of defects is NOT bounded, at all.**

Two of the 15 are not gates. They are **multipliers**: they control how many times a
responsive, per-column site is emitted. Fitting the 12 measured `(columns,
breakpoint-classes)` points gives

```
    c2_bareSidePositioning = 2 * $grid-column-count * |$breakpoint-classes|
                               + |$breakpoint-classes| + 23
```

which was then tested against **9 combinations never used to fit it**
[V-EXEC, `unboundedness-law.mjs`]:

```
  cols   bps   predicted   measured   verdict     css bytes
    16     4         155        155   [OK]        224706
     8     6         125        125   [OK]        281065
    12     4         123        123   [OK]        220898
    20     3         146        146   [OK]        192981
    12     8         223        223   [OK]        367409
    32     3         218        218   [OK]        206907
    12    12         323        323   [OK]        537694
    48     6         605        605   [OK]        377509
     5     9         122        122   [OK]        380989

  held-out points predicted exactly: 9 / 9
```

**Both inputs have unbounded domains.** `$breakpoints` is a plain Sass map a consumer
may extend with any number of arbitrarily-named breakpoints; `$grid-column-count` is
any integer. Measured extreme: **1187 invalid `inline-start`/`inline-end` positioning
declarations at 48 columns x 12 breakpoints**, against 98 at Foundation's defaults --
a 12x growth from two settings a consumer is entitled to set.

Crucially, the other five classes are **flat** across that entire range
[V-EXEC, same probe]:

```
  cols   bps   c1  c2     c3  c4  c5  c6
    12     1    3     48    0   1  13   2
    12     3    3     98    0   1  13   2
    12    12    3    323    0   1  13   2
    48     6    3    605    0   1  13   2
    48    12    3   1187    0   1  13   2
```

**Is a cartesian-product gate conceivable?** Over the *set*, almost: 11 of the 13
activating settings are booleans and 2 more (`$select-triangle-color`,
`$input-prefix-border`) reduce to a two-valued predicate, so a 2^13 = 8192-cell grid
would cover them. **But the two multipliers have infinite domains, and they are the
two that drive the count.** No finite cartesian product covers them, so the answer
is **no** -- not because the grid is too large, but because it is the wrong shape.
This is a *stronger* refutation than "dozens of settings interact", and it is the
map's decisive input: **the sensitivity class is bounded in NAMES and unbounded in
MAGNITUDE.**

> Consequence for the map's destination: a fixed-settings gate is refuted for a
> second, independent reason on top of ticket 14's "CI never sees consumer input".
> Even a gate given a consumer's exact settings file must compile *that* file; there
> is no finite set of representative configurations. This is direct evidence for the
> **elimination** arm of the map's hypothesis, though it does not prove
> eliminability -- that is ticket 02's question.

---

## 4. Is it MONOTONE? **NO. Is it ADDITIVE? MOSTLY -- and the exceptions are exactly the multipliers**

### 4.1 Not monotone, in two distinct senses

**Sense 1: moving a setting off default can REDUCE the defect count.** 6 of the 13
activating settings only ever reduce it. Three drive a whole class to **zero**:

- `$drilldown-arrows: false` -> c6 goes 2 -> **0** (the entire `css-triangle` class
  disappears).
- `$select-triangle-color: transparent` -> c4 goes 1 -> **0** (the entire
  `background-position` class disappears).
- `$breakpoint-classes: (small)` -> c2 goes 98 -> 48.

**Sense 2: ONE setting can add to one class while masking another.** `$global-flexbox:
false` **adds 4 `text-align` defects and removes 7 class-name defects in the same
compile** [V-EXEC]. So even per-setting the effect is not signed.

> **The planning consequence is the sharp one, and it is worse than the ticket
> anticipated.** The ticket asked whether one setting can mask another's defect. It
> can -- but the more damaging fact is that **a setting can mask a defect that is
> present at Foundation's defaults.** Three of the six classes can be switched off
> by a legitimate consumer setting. A gate that compiles a consumer's real
> configuration and reports "class 4 and class 6 clean" may be reporting nothing but
> `$select-triangle-color: transparent` and `$drilldown-arrows: false`. **Absence of
> a class in one configuration is not evidence the class is fixed.** Any gate must
> report per-class counts against a stated configuration, never a pass/fail.

### 4.2 Additive, with exactly one interacting mechanism

Pairwise, over all activating settings [V-EXEC, `per-component-sweep.mjs --pairs`]:

```
  valid pairs tested: 71   additive: 59   NON-additive: 12   (same-variable pairs skipped: 7)
```

Additive means `count(A+B) - base == (count(A) - base) + (count(B) - base)` for
every class. **All 12 non-additive pairs involve `$breakpoint-classes`** -- 8 crossed
with `$grid-column-count`, 4 with `$dropdownmenu-arrows`. That is precisely the
product term in the section-3 law: a per-breakpoint site's contribution scales with
the breakpoint count, so anything that adds or removes such a site interacts
multiplicatively with it. Every pair not involving a multiplier is additive.

> **[WARN] A second artefact, caught and excluded.** The first pairwise run reported
> 19 non-additive pairs of 78. Seven of those were pairs of two perturbations of the
> **same variable** (`$grid-column-count: 6` with `$grid-column-count: 24`; the four
> `$breakpoint-classes` variants against each other). The later declaration simply
> wins, so the additivity "prediction" is meaningless -- not a finding. The probe now
> skips same-variable pairs explicitly and reports the skip count. Corrected figure:
> **12 non-additive of 71 valid pairs.**

**So per-setting reasoning IS valid, with one named exception.** The defect count
decomposes as: an unconditional floor, plus an independent additive contribution per
gate setting, all multiplied through by the breakpoint/column product. Worst measured
combination at one value per variable: **invalid=296 against a base of 102**
(c1=7, c2=268, c3=20, c4=1, c5=6, c6=2).

---

## 5. The six defect classes, mapped to settings-sensitivity

Baselines are the per-component harness at Foundation's defaults with the rebind.

| # | Class | At defaults | Settings-sensitive? | Activating settings (count UP) | Masking settings (count DOWN) |
| --- | --- | --- | --- | --- | --- |
| 1 | `text-align: inline-start` (invalid value) | **3** | **YES** | `$global-flexbox: false` **+4** (3 -> 7) | -- |
| 2 | bare-side positioning `inline-end: 1rem` (invalid property) | **98** | **YES, UNBOUNDED** | `$grid-column-count` and `$breakpoint-classes`/`$breakpoints`, **multiplicatively** (measured to 1187) | `$dropdownmenu-arrows` -10, `$accordion-plusminus` -1, `$accordionmenu-arrows` -1, `$drilldown-arrows` -1, smaller grids/breakpoints |
| 3 | `border-top-inline-start-radius` (invalid property) -- the known-latent one | **0** | **YES -- the only class latent from ZERO** | `$buttongroup-radius-on-each: false` **+20** (0 -> 20) | -- (already 0) |
| 4 | `background-position` (no logical keyword) | **1** | **YES, masking only** | -- | `$select-triangle-color: transparent` -> **0** |
| 5 | class-NAME interpolation `.align-inline-start` | **13** | **YES, masking only** -- see section 6 | -- | `$global-flexbox: false` -> **6** |
| 6 | `css-triangle` emitting a solid square | **2** | **YES, masking only** | -- | `$drilldown-arrows: false` -> **0** |

**All six classes are settings-sensitive.** That is the headline correction to the
one-case premise the ticket started from: ticket 14 measured settings-dependence for
class 3 only, and the reasonable prior was that class 3 was special. It is not --
it is merely the only class whose *default* count is zero, which is why it read as
"latent" and the others did not.

Restating the distinction the map needs:

- **Latent-from-zero: class 3 only.** A default-settings compile sees nothing and a
  consumer setting creates 20 defects.
- **Present-at-default and settings-amplified: classes 1 and 2.** A default compile
  sees a floor; consumer settings raise it, without limit for class 2.
- **Present-at-default and settings-maskable: classes 4, 5 and 6.** A default
  compile sees the MAXIMUM; consumer settings can only lower it, to zero for 4 and 6.

The third row is the only good news in the table, and it is worth stating for the
gating ticket: **for classes 4, 5 and 6 a default-settings gate is sound, because
default settings are the worst case.** For classes 1, 2 and 3 it is not.

---

## 6. The class-NAME interpolation defect -- the map's fog item, GRADUATED

The map's "Not yet specified" entry reads: *"Whether the class-rename defect is
settings-dependent too ... cannot be phrased sharply until the sensitivity map
exists."* It can now be phrased sharply.

> **YES, it is settings-dependent -- but only downward, and through exactly one
> setting. `$global-flexbox: false` takes it from 13 emitted selectors to 6. No
> setting increases it. Foundation's defaults are therefore the worst case for this
> class, which makes it the ONE broken class a fixed-settings gate can bound.**

Enumerated rather than counted [V-EXEC, `m002-and-class-name-probe.mjs` D2]:

```
  defaults  ->  13 selectors
      .menu.align-inline-start
      .menu.align-inline-end li
      .menu.align-inline-end li .submenu li
      .menu.align-inline-end.vertical li
      .menu.align-inline-end.vertical li .submenu li
      .menu.align-inline-end.icon-top li a img / i / svg
      .menu.align-inline-end.icon-bottom li a img / i / svg
      .menu.align-inline-end .nested
      .accordion-menu.align-inline-end .nested.is-accordion-submenu

  $global-flexbox: false  ->  6 selectors
```

Explicitly measured NOT to move it: `$breakpoint-classes` at 1, 3 and 5 classes
(13 in all three -- **it is not breakpoint-multiplied**, unlike class 2),
`$menu-centered-back-compat: false`, `$accordionmenu-arrows: false`, and
`$global-radius: 6px`.

And the contract that is broken, measured against a no-rebind control
[V-EXEC, D2b]:

```
  physical class names emitted WITHOUT the rebind: .align-left, .align-right
  class names emitted WITH the rebind:             .align-inline-end, .align-inline-start
```

**Both of Foundation's public alignment class names disappear.** A consumer's
`<ul class="menu align-right">` silently stops matching. This is valid CSS, so no
validity oracle -- including the CSSOM oracle ticket 14 recommends -- can see it;
detection needs a per-component class-name parity check, which is D1g's onboarding
obligation.

Suggested replacement text for the map's fog entry:

> **RESOLVED (ticket 01).** The class-rename defect IS settings-dependent, via
> `$global-flexbox` only, and only in the masking direction (13 -> 6). Foundation's
> defaults are the worst case, so a fixed-settings gate bounds this class -- unlike
> classes 1, 2 and 3. It is not breakpoint-multiplied. It renames both of
> Foundation's public `.align-left` / `.align-right` classes.

---

## 7. What this hands the rest of the map

Stated as inputs, not decisions -- tickets 02-05 own the decisions.

1. **Ticket 02 (eliminability) gains a strengthened motive.** Detection is refuted
   twice over now: once by ticket 14's "CI never sees consumer input", and once by
   section 3's unbounded-magnitude law. The elimination arm is the one with a live
   hypothesis.
2. **Ticket 03 (can a consumer-dependent defect be gated?) gains a partition.**
   Classes 4, 5 and 6 ARE bounded by a default-settings gate, because defaults are
   their maximum. Classes 1, 2 and 3 are not, and class 2 is not boundable by any
   finite configuration set. A uniform answer to ticket 03 would be wrong; the
   answer is per-class.
3. **Ticket 04 (the gating contract) gains three hard constraints:**
   - A gate must pin the **component set** as well as the settings (36 vs 102 at
     identical settings).
   - A gate must not compile through `foundation-everything()` (the
     `$global-flexbox: true !global` overwrite, section 2.1).
   - A gate must report **per-class counts against a stated configuration**, never a
     pass/fail, because three classes can be masked to zero by legitimate settings.
4. **Ticket 05 (the hand-off) gains the M002 clearance in section 1**, and the
   forward rule that goes with it: the addon's six controls are safe because they are
   *value* settings; **the test for any new control is "can it change WHICH rules are
   emitted?", not "is it a Foundation global?"**

---

## 8. VERIFIED vs INFERRED

### VERIFIED by execution here [V-EXEC]

- The classifier reproduces ticket 14's headline exactly: `foundation-everything()`
  with the rebind at Foundation defaults emits **36 invalid and 127 valid** logical
  declarations.
- The per-component include model (this library's idiom), same settings, same
  rebind, emits **102 invalid and 257 valid** -- so the count depends on the
  component set, not only on settings.
- Defect counts are **order-independent**: 4 shuffled mixin orders give identical
  counts and identical byte length.
- `foundation-everything()` **overwrites `$global-flexbox` with `!global`**, making
  that setting appear byte-identically inert through that entry point while it
  activates 4 and masks 7 defects through per-component includes.
- **109 rebind source sites**; 64 emit under no settings guard, 45 are gated.
  The transitive gate closure names **15 settings** out of a **498-name**
  consumer-settable vocabulary.
- **13 settings measured to change a defect count**; a brute-force flip of all 31
  booleans in Foundation's settings template found no others.
- The intra-file gate walk missed `$accordionmenu-arrows` (guard around the
  `@include`, not around the declaration); the transitive closure and the
  brute-force sweep both catch it.
- **All six M002 controls activate nothing**: 6 cases through the shipped `theme()`
  chain (invalid=0 in every class) and 13 cases through the maximal raw-Foundation
  route (every class identical to baseline). The controls are **live** at the raw
  level (`$global-radius: 6px` = +128 bytes) and still activate nothing.
- The radius-shaped class is gated by a boolean, not a radius: c3 = 0 / 20 for
  `$buttongroup-radius-on-each` true/false, identically at `$global-radius` 0, 6px
  and 50%.
- **The growth law** `c2 = 2 * cols * bps + bps + 23`, fitted on 12 points and
  confirmed on **9/9 held-out** combinations. Extreme measured: **1187** invalid
  bare-side declarations at 48 columns x 12 breakpoints (98 at defaults). Classes
  c1, c3, c4, c5, c6 are constant across that whole range.
- **Additivity: 59 of 71 valid pairs.** All 12 non-additive pairs involve
  `$breakpoint-classes`. Seven same-variable pairs were excluded as an invalid test.
- **Non-monotone**: `$global-flexbox: false` adds 4 class-1 defects and removes 7
  class-5 defects in one compile. Three classes can be masked to zero
  (`$drilldown-arrows` -> c6=0, `$select-triangle-color: transparent` -> c4=0).
- **Class 5 enumerated**: 13 selectors at defaults, 6 with `$global-flexbox: false`,
  13 at 1 / 3 / 5 breakpoint classes, 13 under `$menu-centered-back-compat: false`,
  `$accordionmenu-arrows: false` and `$global-radius: 6px`. The rebind removes both
  `.align-left` and `.align-right` from the emitted sheet.

### VERIFIED by reading source [V-SRC]

- `foundation.scss:80-87` -- `foundation-everything($flex: true)` assigns
  `$global-flexbox: true !global`.
- `_button-group.scss:71` -- `@if not $buttongroup-radius-on-each` guards all 14
  radius sites; the emitted value is `$button-radius`, unconditioned on its own value.
- `_accordion-menu.scss:62` vs `:113` -- the declaration and its guard are in
  different blocks, 51 lines apart.
- `util/_mixins.scss:45-72` -- `css-triangle` emits `border-style: solid;
  border-width: N` before any direction branch, so a non-matching keyword yields a
  rule with no `border-color` and no zeroed side. That is the structural signature
  the class-6 detector keys on.
- Foundation's settings template carries **490** names and **31** booleans; the
  whole tree carries **470** `!default` names; the union is **498**.

### INFERRED, flagged

- That `$breakpoints` and `$grid-column-count` are "unbounded in practice". Their
  *domains* are unbounded by construction (an arbitrary-length map; any integer) and
  the law was confirmed to 12 breakpoints and 48 columns; that a real consumer would
  go further is a judgement, not a measurement. The refutation of a cartesian gate
  does not depend on how far a real consumer goes.
- That the 15-name gate closure is complete. It is complete over Foundation's *static*
  call graph as parsed by `gate-closure.mjs`, and it agrees with an independent
  brute-force boolean sweep -- but a guard driven by a value computed at runtime from
  a setting (rather than by the setting itself) would evade both. None was found; none
  was proven absent.
- That the 2^13 cartesian grid over the finite gates is "feasible in principle". The
  cell count is arithmetic; **no compile-time measurement was taken here**, and the
  map's "whether elimination costs compile time" item is still open.
- That "value settings are safe, shape settings are not" generalises beyond the 13
  measured. It is a mechanism-level claim (only shape settings can change which
  declarations are emitted) consistent with every measurement here, but it was not
  tested against the ~470 non-boolean settings individually.
- That a CSSOM validity oracle would catch classes 1-4 and miss 5-6. Carried from
  ticket 14 [V-PRIOR], not re-executed.
