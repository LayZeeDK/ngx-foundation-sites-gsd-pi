# Deferred hand-off: the settings-migration surface and cross-component RTL

**Everything deferred to later milestones.** Written for **two future milestones** --
the **Foundation settings-migration surface** and **cross-component RTL /
component-onboarding** -- and for the CI gate they share.

Derived from two closed wayfinding efforts. See `../README.md` for provenance, the
supersession map, the boundary manifest, and the five reusable measurement traps
referenced from this file. **Read this file alone and you can plan either milestone.**

**Route-agnostic.** Everything here states what must END UP in `.gsd/`. It does not
matter whether a later session applies it through the `gsd-workflow` MCP tools or
through `/gsd` slash commands.

**Do not edit `.gsd/` by hand.** Those files are projected from a database.

**Evidence discipline.** `[V-EXEC]` / `[V-BROWSER]` / `[V-REPO]` / `[V-SRC]` = executed
or read from shipped source. `[DERIVED]` = composed from cited measurements, not itself
executed. `[INFER]` = reasoned, not executed. Section 6 is the full split; **do not let
planning promote anything below section 6.2 to settled.**

**Depth** lives in `.scratch/settings-rtl-coupling/research/01..04` (the contract is
`04`), with executable probes in `.scratch/settings-rtl-coupling/prototypes/` and
captured output in `prototypes/out/run-*.txt`. Cross-component RTL's class-by-class
site table is in `.scratch/m002-storybook-theming-addon/research/14-*.md`; the settings
surface's eight open items are in that map's `research/15-*.md` section 6. Both source
folders are read-only.

---

## 0. One-paragraph summary for a planner who never read either map

A coupling was flagged and then **dissolved**. The worry was that a more seamless
Foundation settings surface would let consumers activate RTL defects that are dormant
at Foundation's defaults, so the settings milestone's success condition looked like the
RTL milestone's trigger, and no fixed-settings CI gate could bound the class because
the defect count depends on input this repo's CI never sees. **The coupling is real,
was measured in both halves, and then dissolved.** All the defects originate in ONE
mechanism -- R004's `$global-left`/`$global-right` rebind -- and a different mechanism
(**direction twins**: compile Foundation unmodified twice at Sass time and emit both
directions in one sheet under `:where(:dir(ltr))` / `:where(:dir(rtl))`) eliminates all
six defect classes **by construction**, verified at 0 invalid declarations across 8
settings configurations with 0 differing computed values against Foundation's own RTL
build in real Chromium. Because the unbounded defect magnitude turned out to be **pure
replication of a fixed set of 22 source sites**, a complete per-component admission
test is **two compiles**, not a settings grid. That test is settings-**independent**
even though the defect count is settings-dependent -- so **no settings key is ever
withheld on RTL grounds, and neither milestone waits for the other.** M002's addon has
a clean bill of health (that clearance lives in `../M002/HANDOFF.md` section 3).

---

## 1. The contract

### 1.1 Shape, and the headline correction

> **Shape: ELIMINATION-FIRST, admitted per component by a mechanical test.**
>
> **The gate is NOT temporal.** Neither milestone waits for the other. What gates is a
> two-compile admission test on the **component** side; once it holds over the shipped
> component set, the settings surface is safe for **every** Foundation setting at
> **every** value, by construction.

**Do not reintroduce a sequencing story.** An earlier position held that "sequencing is
a real constraint, not a preference"; it was correct on the evidence available then and
is **superseded** (`../README.md` section 2.1). No register row carries it.

**Prevention, not detection, and not disclosure.** Detection loses three times and
disclosure loses four times; both refutations are recorded in
`.scratch/settings-rtl-coupling/research/04-the-gating-contract.md` section 2 so nobody
re-derives them. The short form: detection is **unnecessary** (there is nothing left to
detect), a cartesian settings gate is the **wrong shape** (two of the activating
settings are multipliers with infinite domains), and disclosure is what the library does
**today by accident** -- a consumer pasting Foundation's entire 490-line `_settings.scss`
compiles clean and emits byte-identical CSS with no warning [V-EXEC].

### 1.2 The nine clauses

Each carries its measured ground and, where it can expire, a threshold or a version
number.

**C1 -- No settings-dependent RTL defect class may exist.** A component's
direction-dependent output is produced by a mechanism proved incapable of synthesising
a property name, value or class name that Foundation did not itself emit. *Ground:* the
direction-twin construction emits **0 invalid declarations across 8 settings
configurations** against the rebind's 36-56, with exact declaration-level equivalence to
Foundation's own RTL build and 0 differing computed values in real Chromium in both
directions in ONE document [T02 s1/s3.3]. **The guarantee is structural, not sampled:
no new token is ever synthesised.**

**C2 -- The admission test (the single gating artifact).** Full spec in section 3. A
component is **ADMITTED** when it emits zero BROKEN-class declarations and zero renamed
Foundation public class names across the two-compile envelope. Five mandatory
properties, none of them a matter of taste. *Cost, so nobody prices it as expensive:*
the envelope is 2x one compile -- ~780 ms for `button-group`, ~310 ms for `menu`, ~2.8 s
for the whole library, measured interleaved and shuffled [T03 s5.1]. The refuted
cartesian gate at the same rate is **over 3 hours and still incomplete**.

**C3 -- Mechanism assignment is a rule, not a per-component judgement.**

> **Direction twins by default. The rebind if and only if C2 returns zero for that
> component. No third mechanism.**

*Ground:* Button's whole direction-dependent surface is 5 declarations in 4 rules, all
in SAFE classes, so the rebind gives 3 valid declarations and ZERO twins where the twins
would give 4 rules and 6 declarations plus a `:dir()` dependency [T02 s5.2]. Every other
mechanism is closed: **no substitution value works** (`start/end` 160 invalid,
`inset-inline-*` 131, and the 2-D corner case reachable by none), and a **Sass mapping
layer is impossible, not merely unattractive** -- the property name, the value and the
selector are all assembled by interpolation inside Foundation's source, and the one hook
that exists (post-`@import` mixin redefinition) reaches exactly **one** of six classes
[T02 s2/s2.1]. A post-process layer is closed by D021 (`styleUrl` leaves no
library-controlled CSS artifact). **The D1e hybrid recommendation is refuted as stated
and must not be resurrected:** the rebind that produces its "logical properties where
safe" half is itself the sole source of all six defect classes.

**C4 -- The twin layer's BUILD SHAPE is forced by the settings surface.** Where a
component ships twins AND the settings surface is live, the twin layer must be
**authored in Sass**, mirroring Foundation's own `@if` guards. **A twin layer
pre-generated at library build time and shipped as static CSS is FORBIDDEN.**

*Ground:* Sass cannot rewrite selectors it did not author -- confirmed by the one case
where a hook exists, where `&:dir(rtl)` produced `...::after:dir(rtl)`, which Chromium
drops whole [T02 R2, V-BROWSER s2]. So the twins cannot be generated at consumer compile
time, leaving exactly two shapes: **(a) pre-generated CSS**, or **(b) hand-authored
Sass**. Foundation's partials compile INSIDE the consumer's compilation under this
library's island idiom, so base rules track consumer settings while a pre-generated blob
is keyed on the LIBRARY's settings; under a live settings surface the two desynchronise,
and **a twin whose selector matches nothing is invisible**, which is this defect
family's signature. Therefore (a) is incompatible with the settings surface and (b) is
the only shape left.

- **Machine-checkable form:** compile the library at any two settings configurations;
  the twin layer's selectors must be a **subset** of the base sheet's selectors.
  **Orphan twins > 0 is a failure.**
- **The twins MUST be emitted inside the same `@layer` as the rest of the library
  defaults.** Unlayered, they would compete with consumer theme rules on specificity and
  could win, inverting R008 [T02 s8].
- **`:where(:dir(...))`, element-scoped, appended to the last compound before any
  pseudo-element** -- never bare `:dir()`, never descendant-scoped. Bare `:dir()` with an
  appended layer produces **30 wrong computed values**; descendant scoping is wrong for a
  nested opposite-direction island [T02 s3.1, V-BROWSER s3/s4]. **`revert-layer` is a
  trap** and the construction uses none.
- **C4 is the contract's single load-bearing INFER.** See section 6.3.

**C5 -- The settings surface is UNCONDITIONALLY open, with one prohibition.** No
Foundation setting is withheld on RTL grounds. Once C2 holds over the shipped component
set, every setting is safe at every value.

> **The single prohibition: no published key may be live-and-unsafe.** A key may be
> **inert** (its component is not shipped yet) or **live-and-safe** (its component is
> admitted); it may never be live and able to activate a defect.

*Ground:* **[DERIVED]** from the two-compile envelope's site completeness plus the
zero-new-sites result, so a component that emits zero BROKEN-class declarations across
the envelope emits zero for **any** settings configuration -- **the admission test is
settings-INDEPENDENT even though the defect count is settings-dependent** [T03 s5]. That
is what makes the surface safe without a per-setting allowlist.

- *The inert tier is a real design seam, not a loophole:* a real Foundation name whose
  component does not exist yet errors today under both candidate mechanisms; a
  warn-and-ignore tier for known-Foundation-but-uncovered names is **the settings
  milestone's decision**. C5 only requires that whichever tier it picks never yields
  **silence** for a live key -- silence is the failure mode.
- *Sharp consequence for the settings milestone's own most consequential item:*
  restoring Foundation's derivation cascade is what makes a migrator's
  `$foundation-palette` edit do anything. C2.3 says the gate must not run through
  `foundation-everything()`; the same `!global` overwrite would corrupt a
  cascade-restoring settings surface itself.

**C6 -- The R022 feature gate (owed, currently absent).** Extend the browserslist check
to assert the CSS features the shipped mechanism uses against the **RESOLVED targets**,
not just the query string. **Owed before the first component that emits a `:dir()`
selector ships.**

*Ground:* `scripts/verify-browserslist.mjs` is **36 lines** and asserts
`config.includes('baseline widely available on 2026-05-07')` plus
`browserslist().length !== 0` -- **it checks no feature against any target** [V-REPO,
re-confirmed], so nothing in this repo would notice `:dir()` failing 2 of 136. **The
feature matrix already exists** as `prototypes/rtl-baseline-support-probe.mjs`:
`:dir()` **134/136**; `:where()`, `@layer`, `revert`, `css-logical-props` all
**136/136**.

*Trigger to run it:* the library's built CSS contains at least one `:dir(` occurrence --
**a grep, not a judgement** (trigger 7).

**C7 -- The `:dir()` disclosure. THE ONLY CLAUSE THAT CAN EXPIRE.** Disclose the
browser-support gap and which of the three ways out is taken.

> **Expiry trigger: the pinned `.browserslistrc` query resolves to a chrome and edge
> floor of 120 or higher.** `:dir()` shipped in chrome/edge **120**. The pin `baseline
> widely available on 2026-05-07` floors at **119**, which is the entire cost. The
> file's own header records the **rolling** query resolving to chrome/edge **121**
> [V-REPO, re-confirmed]. So the drift is in the mechanism's favour and the next re-pin
> closes the clause automatically. **Check:** `browserslist()` returns no `chrome` or
> `edge` version below 120 -> **delete C7.**

The three priced ways out, so the choice is not re-derived [T02 s6.1]:

| option | exactness vs the dual build | chrome/edge 119 |
| --- | --- | --- |
| **A. Split twins** (the recommendation) | **0 differing computed values** | 47 regressions in LTR |
| B. Graceful variant (LTR stays in the base rule, RTL twin only) | 32 differing computed values | **identical to today** |
| C. Bump the floor 119 -> 120 | 0 | the rolling baseline already delivers it |

**This disclosure is NOT a confession about invalid CSS.** It discloses a
browser-support gap in a mechanism this library chose [T03 s3]. **The contract does not
propose changing the pin** -- option C is listed because the rolling query already
delivers it, not as a request against D022.

**`$global-text-direction` is disclosed alongside it.** Its decision, its
accept-and-honour status and its README text are D037, in `../M002/REGISTER-TEXT.md` section 5
-- do not restate them here. **The rider this contract adds:** under the twins the
setting becomes **genuinely meaningful for the first time** -- compile one pass at the
chosen direction and skip the twin layer, yielding a smaller, `:dir()`-free sheet
[T02 R4]. It is also **the only setting with an upstream contract behind it**: public
and SassDoc'd, where `$global-left`/`$global-right` are labelled **"Internal
variables"** (`_global.scss:126`) [T03 s6].

**C8 -- The CSSOM tripwire, re-purposed.** Keep the CSSOM validity check in the existing
`test-browser` lane as a **regression tripwire on the GENERATOR's invariant -- not as a
settings gate**. *Ground:* the guarantee is a property of the generator, not of the
emitted sheet, so a generator bug or a reintroduced rebind breaks it silently [T03 s4].
The lane already exists (`ChromiumHeadless` over `**/*.browser.spec.ts`) and the oracle
is now measured, not inferred: it drops all class 1-4 declarations at both the
declaration and sheet level, with five valid controls surviving.

Two mandatory properties, each bought with a caught false all-clear:

- **A positive control asserting a known-VALID declaration survived. The gate must abort
  without one.** An empty `CSSRuleList` is **truthy** -- see `../README.md` trap 2 for
  the full mechanism and why the natural walk prints `[OK]` from a sheet it never
  examined.
- **Paired with a class-name parity check** (C2.5), or it certifies half the family.
  Note Chromium's CSSOM expands `border-width` into four longhands when enumerated.

***Do not narrow or remove the `test-browser` lane.*** M002 carries the same constraint
from its own side (R021 lane 2), so this is one lane with two dependents.

**C9 -- `verify-foundation-parity.mjs` is MECHANISM-COUPLED.** Its translation tables
must not be propagated to any new gate, and its disposition has an owner and two
triggers. **See section 5 -- it is a deliverable of this hand-off, not a footnote.**

### 1.3 The two obligations -- one testable sentence each, ONE artifact

> **Settings owes RTL:** *a CI gate that compiles the entire shipped component set at
> the two-compile envelope and reports per-class invalid-declaration counts, failing on
> any non-zero count in classes 1-4, on any renamed Foundation public class name, and on
> any orphan twin.*
>
> Testable by staging a regression: reintroduce the rebind for any non-admitted
> component and assert the gate fails; the CSSOM tripwire's positive control must also
> fail-closed when removed (C8).

> **RTL owes settings:** *every component it admits emits zero BROKEN-class declarations
> and zero renamed Foundation public class names across the two-compile envelope, so
> that no settings key ever has to be withheld.*
>
> Testable per component, in ~780 ms for `button-group` [T03 s5.1], against the probes
> already in `prototypes/`.

**They are discharged by the SAME artifact.** One gate, two owners: the settings
milestone builds and runs it; the component milestone satisfies it per component.
**That is why there is no ordering to negotiate.** That artifact is also what satisfies
**R027** -- see section 4.

### 1.4 The two milestones, and what each must not do

**Both milestones may start immediately and proceed in parallel. Neither carries any
ordering dependency on the other; the gate is not temporal.**

Today Button is the only component in the shipped set and it **passes** C2 [T02 s5.2],
so the settings surface is already safe for every Foundation setting at every value.
**That statement's ground is the test, not the component count: it holds for any set
whose members all pass.**

| Milestone | Must not, until |
| --- | --- |
| **Foundation settings-migration surface** | ...ship a live key set before C2 is wired as a CI gate over the shipped component set (C2, C5). ...run any gate of its own through `foundation-everything()` (C2.3). ...publish a key that is live-and-unsafe; **inert or live-and-safe only** (C5). |
| **Cross-component RTL / component onboarding** | ...admit a component before C2 returns zero BROKEN-class declarations and zero renamed public class names (C2, C3). ...**lift the rebind into a shared partial, ever** (section 1.6). ...ship a pre-generated CSS twin blob while the settings surface is live (C4). ...emit a `:dir()` selector before C6 lands. |

**Both are cheap.** Every settings-side item is a property of a gate the settings
milestone needs anyway; every component-side item is a prohibition or a 2x-compile
check.

### 1.5 The eight triggers -- thresholds and version numbers only, never a judgement

| # | Trigger | Threshold / version | What it flips |
| --- | --- | --- | --- |
| **1** | `:dir()` enters the pinned baseline | pinned `.browserslistrc` resolves to **no chrome or edge below 120** (`:dir()` shipped in 120; the pin floors at 119; the rolling query already resolves to 121) | **Delete C7.** Option A becomes unconditional; the A/B choice disappears. |
| **2** | A component passes the admission test | **zero** BROKEN-class declarations AND zero renamed public class names across the two-compile envelope | That component may use the rebind instead of the twins (C3). **Fires routinely; the contract's normal operation, not an exception.** |
| **3** | A hand-authored Sass twin partial fails to track consumer settings | **orphan twins > 0** at any two settings configurations (C4) | C4's option (b) is refuted. Then either the settings surface withholds every shape setting in that component's gate closure, or the component is onboarded via the rebind (trigger 2). **This is the contract's one unproven premise -- section 6.3.** |
| **4** | Sass gains selector rewriting | a Dart Sass release shipping a construct that transforms selectors generated by an `@include` (today: none) | The twins could be generated at consumer compile time; C4 collapses to a non-question. |
| **5** | Foundation's directional source changes | any `foundation-sites` version other than the pinned one, or any edit to `_global.scss:126-131` | Re-derive the 15-name gate closure and the two-compile envelope; the probes do it mechanically. Foundation is dead upstream at 6.9.0, so this is a dependency bump, not a forecast. |
| **6** | A new addon control is a SHAPE setting | the control's domain is a **boolean, keyword, count or map length** -- not a colour or a length | M002's clean bill of health lapses and the addon is back in scope. The test is **"can it change WHICH rules are emitted?"**, never "is it a Foundation global?" **This is the standing re-entry condition into M002's closed decisions**; the rule itself is written into R009's control-table note (`../M002/REGISTER-TEXT.md` section 1). |
| **7** | The library emits a `:dir()` selector | the built CSS contains `:dir(` | C6 is due. |
| **8** | Any component emits `text-align` from a directional site | count of directional `text-align` declarations > 0 | C9's disposition is due (section 5), in whichever direction that component's mechanism makes it wrong. |

**Deliberately NOT a trigger: emitted volume.** The twins cost **+14.1%** library-wide
and **+62%** for `button-group`, and compile time is **indistinguishable from noise**
(BASE 1350 ms; delta -4% to +7% with per-cell spread wider than the between-condition
medians; the generator is exactly one extra pass at 1.9-2.1x) [T02 s7].

> **No volume budget is written into this contract, because any number chosen now would
> itself be the expiring premise this contract exists to prevent.** Volume is a
> **reported quantity, not a gate.**

*Sizing note for planners:* the library-wide average **underestimates a small
radius-heavy component by 4x**, so do not size a component from the +14.1% figure.

### 1.6 The rebind's disposition -- STAYS, Button only, by rule

The rebind stays in
`packages/ngx-foundation-sites/src/scss/internal/_foundation-button.scss`. It is
**not** replaced. What changed is the reason: the original ruling was a judgement about
scope, and it is now a **consequence of C3** -- **Button is not a special case, it is
the case that passes the admission test.** Today Button is the only component that
passes; **`foundation-table` comes closest with 1 direction-dependent declaration, and
it is a `text-align`, i.e. a BROKEN class** [T02 s5.2]. (The decision itself is D039 as
amended, in `../M002/REGISTER-TEXT.md` section 5; these are its mechanical grounds, which
replace it as the live rationale.)

> **The rebind must not be lifted into a shared partial, because "shared" is exactly the
> scope at which its precondition stops holding.**

That is now a mechanical statement, not a warning. A shared partial applies the rebind
to components whose C2 result is non-zero, **which is the definition of inadmissible**.
Getting it wrong spreads six defect classes across ~11 components including **14 latent
radius sites in `button-group`**.

**Does Button eventually migrate to the twins? There is no correctness reason, and there
never will be one.** For Button the rebind is strictly smaller (3 valid declarations vs
4 twin rules and 6 declarations), strictly valid, and strictly better supported
(`css-logical-props` 136/136 vs `:dir()` 134/136). **Migration is discretionary
forever** -- available if the library later wants one uniform mechanism for its own
sake, never owed. If it is ever taken, trigger 1 should have fired first, and C9 flips
direction at the same moment (section 5).

**One rider:** while the rebind remains anywhere, it depends on
`$global-left`/`$global-right`, which Foundation labels **"Internal variables"**. That
is an argument for the twins **independent of validity**, and it is an argument about
*stability*, not correctness -- Foundation 6.x has been stable here, so treat it as a
**preference for the public variable, not a predicted break** [T03 INFER].

### 1.7 One thing the settings milestone should not have to rediscover

**Per-component settings modules are a thing Sass cannot build.** `@use ... with (...)`
applies **once per module per compilation, and only before anything else has loaded it**
-- three verified hard errors: the same module configured twice, configured after the
library loaded it, and two consumer partials each configuring it [V-EXEC]. N
per-component settings modules means N `with` clauses each subject to the
once-and-first rule and each order-coupled to the others: **a combinatorial ordering
contract for the consumer.**

> **The measured conclusion is ONE DOOR, per-component contents.**

Independently, the activating settings are **cross-component** (`$global-flexbox` gates
menu AND accordion-menu; `$breakpoint-classes` / `$breakpoints` / `$grid-column-count`
gate xy-grid position), so a per-component settings gate **degenerates to a
library-wide one for exactly the settings that matter** [T01 s2.2].

A further consequence, mechanical rather than aesthetic: **a module consumers READ can
never be the module they CONFIGURE**, because reading it loads it and configuring an
already-loaded module is a hard error. That is why `_theme.scss` must stay a DATA module
and the settings entry point must be a separate file (section 7, constraint 1).

---

## 2. The direction-twin mechanism, in enough detail to build it

**The construction, in one paragraph.** Compile Foundation **unmodified** twice at Sass
time -- once at `$global-text-direction: ltr`, once at `rtl` -- diff the two outputs,
and emit **ONE sheet** in which every direction-dependent declaration appears twice:
once under `:where(:dir(ltr))` and once under `:where(:dir(rtl))`, **element-scoped**
(the `:where(:dir(...))` appended to the last compound **before any pseudo-element**)
and **interleaved at its original position**, **inside the same `@layer` as the rest of
the library defaults**.

**Its defining property is the whole point:**

> **Every property name, value and class name the twin layer emits is one Foundation
> itself emitted.** So no consumer settings configuration can produce invalid CSS. The
> guarantee is structural, not sampled.

**This is NOT a dual build.** One sheet serves both directions and therefore still
serves the shipped `Rtl` story, which renders `dir="ltr"` and `dir="rtl"` in ONE
document and asserts numeric mirroring between them. The two Sass passes are used
**only as the source of truth for what differs**. Do not resurrect the dual build; it
was ruled out by a shipped artifact and ruling it out costs deleting a passing test.

**Three sub-choices are load-bearing, and each was found by measurement, not
preference:**

| Choice | Wrong alternative, measured |
| --- | --- |
| **`:where(:dir(...))`**, not bare `:dir()` | Bare `:dir()` with an appended layer produces **30 wrong computed values**. `:where()` also contributes **zero specificity**, which is why R008 survives. |
| **Element-scoped**, not descendant-scoped | `.x::after:dir(rtl)` is **dropped whole** by Chromium; `.x:dir(rtl)::after` is kept. Descendant scoping breaks a **nested opposite-direction island**. |
| **Twins**, not overrides-with-resets | `revert-layer` in an unlayered sheet rolls back **past the author origin** -- 0px where the consumer set 77px. **`revert-layer` is a trap; the construction uses none.** |

**Build shape is forced: hand-authored Sass (C4).** Sass cannot rewrite selectors it did
not author, so the twins cannot be generated at consumer compile time; and a
pre-generated CSS blob is keyed on the LIBRARY's settings while base rules track the
consumer's, so under a live settings surface they desynchronise and **a twin whose
selector matches nothing is invisible**. The twin partial mirrors Foundation's own `@if`
guards. Sizing: **~337 twin rows** is the milestone's authoring work.

**Verification the mechanism already has** [T02, V-BROWSER Chromium 151]:

- **0 invalid declarations** from the twin sheet, vs the rebind's **36** at Foundation's
  defaults and **56** with two legitimate settings flipped.
- **Exact declaration-level equivalence to Foundation's own RTL build: 0 mismatches**,
  every time.
- **0 differing computed values** in BOTH directions, side by side in ONE document.
  Naive control: **30 wrong values**.
- Chromium-dropped declarations: rebind **142**, Foundation **86**, eliminator **86** --
  delta **+56 vs +0**.
- Across **8 settings configurations** the eliminator column is 0 throughout while the
  twin count moves with settings. **That is the settings-dependence turned benign:
  more settings-activated directional output means more twins, never an invalid
  declaration.**
- **Cost:** compile time unchanged (BASE 1350 ms and 1344 ms on two independent code
  paths; twins indistinguishable from noise; generator exactly one extra pass at
  1.9-2.1x). Volume **+14.1%** library-wide, **+62%** for `button-group`.
- **Support:** `:dir()` 134/136 pinned targets. On a simulated `:dir()`-less engine the
  split twins cost 47 regressed computed values in LTR; the graceful variant costs 0, at
  32 values of RTL inexactness (C7's options A and B).

**Why no other mechanism is available**, so it is not re-litigated:

- **No substitution value works.** The same variable is interpolated into **five
  syntactically different positions**, and three of the six needed values are mutually
  exclusive with the other three: `start`/`end` yields **160 invalid**,
  `inset-inline-*` yields **131**, and the 2-D corner case is reachable by none.
- **A Sass mapping layer is IMPOSSIBLE, not merely unattractive.** The property name,
  the value and the selector are all assembled by interpolation **inside Foundation's
  source**. The one hook that exists (post-`@import` mixin/function redefinition,
  verified honoured) reaches exactly **one** of six classes -- and its natural
  `&:dir(rtl)` emits `...::after:dir(rtl)`, which Chromium drops whole.
- **A post-process layer** is closed by D021: `styleUrl` leaves no library-controlled
  CSS artifact.
- **A dual build** is closed by the `Rtl` story (above).

### 2.1 The six defect classes -- what the twins eliminate

The rebind breaks **~50 of ~109 interpolation sites, across ~11 components, and every
failure is SILENT** (browsers discard unknown properties and invalid values without
error). The class-by-class site table is in
`.scratch/m002-storybook-theming-addon/research/14-*.md`; what a planner needs is the
**detectability split**, because it decides the gate's shape:

| Class | Nature | Seen by a validity oracle? |
| --- | --- | --- |
| **1-4 (BROKEN)** | Declarations that are **present and rejected** -- an invalid property name or an invalid value produced by substituting a physical keyword where a logical one does not apply. Class 2 is the **breakpoint-multiplied** one (22 source sites; 98 declarations at defaults; 1187 at 48 columns x 12 breakpoints). Class 3 is the **radius-shaped** one, gated by a boolean (0 at defaults, **20** with `$buttongroup-radius-on-each: false`; the 14 latent `button-group` sites). Class 4 is maskable to zero by `$select-triangle-color: transparent`. | **YES** -- the CSSOM oracle drops all of classes 1-4 at both the declaration and sheet level, with five valid controls surviving [V-BROWSER]. |
| **5 (class-NAME interpolation)** | `&.align-#{$global-left}` silently **renames Foundation's public `.align-right` class**. The result is **valid CSS that matches nothing**. The rebind removes **BOTH** `.align-left` and `.align-right`. Settings-dependent only **downward** (13 -> 6 selectors via `$global-flexbox`), never breakpoint-multiplied, so its **maximum IS the default**. | **NO -- structurally blind, by construction.** |
| **6 (defect of ABSENCE)** | `css-triangle($size, $color, $global-right)` matches **no `@if` branch** and emits a solid square instead of an arrow. **The rule and every declaration in it survive intact.** Maskable to zero by `$drilldown-arrows: false`. | **NO -- structurally blind, by construction.** |

**Two consequences that shape the gate:**

1. **A validity oracle alone is insufficient.** It sees only declarations that are
   PRESENT and rejected, so it is blind to class 5 and class 6 **by construction, not by
   bad luck**. Hence C2.5's mandatory class-name parity check.
2. **`.align-left` / `.align-right` are DOCUMENTED PUBLIC direction-sensitive API**
   (`docs/pages/menu.md:49-53`, with `float-classes.md:16`, `tooltip.md:80`,
   `off-canvas.md:236`, `flex-grid.md:197`) [V-SRC]. So the rebind's rename **breaks a
   documented contract** -- which is one of the four reasons "accept and disclose"
   loses.

**Button hits only the two SAFEST classes** (the `float:` value form and the
`margin-#{side}` form, both of which the rebind maps to valid logical CSS) and passes a
literal `down` to `css-triangle` -- which is exactly why R004 is sound for Button and
**generalises to nothing**.

---

## 3. The two-compile admission test (C2) -- full spec

> A component is **ADMITTED** when it emits **zero BROKEN-class declarations** and
> **zero renamed Foundation public class names** across the two-compile envelope.

**Five mandatory properties, none of them a matter of taste.**

**1. Two compiles, not a grid.**

| Compile | Settings |
| --- | --- |
| **A** | Foundation defaults |
| **B** | `$buttongroup-radius-on-each: false` **with** `$global-flexbox: false` |

**Both are required and neither suffices.** *Ground:* the envelope is **COMPLETE over
source sites across 24 configurations** (8/8, 22/22, 14/14, 1/1, 11/11, 2/2), because
magnitude growth is **pure replication** -- all 1187 class-2 declarations at 48 columns
x 12 breakpoints come from the **same 22 source sites** as the 98 at defaults, with
**zero new sites in any class** at either extreme. Both compiles are needed because
**non-monotonicity holds at SITE level** (class 1: 3 and 6 sites, 1 shared; class 5: 8
and 6, 3 shared) [T03 s5]. Non-monotonicity in one compile: `$global-flexbox: false`
**adds 4 class-1 defects while removing 7 class-5 defects.**

**2. The test must pin the COMPONENT SET, not only the settings.** *Ground:* **36
invalid vs 102 at identical settings**, purely from which mixins are included
[T01 s2.1].

**3. The test must NOT compile through `foundation-everything()`.** *Ground:* it executes
`$global-flexbox: true !global`, silently overwriting the consumer's setting, so every
`$global-flexbox`-gated site reports a **false clean** [T01 s2.1]. Full mechanism in
`../README.md` trap 1. **This constraint binds the settings surface's own gate too, not
just the RTL one.**

**4. Per-class counts against a stated configuration, never a bare pass/fail.**
*Ground:* **three of the six classes can be masked to ZERO by a legitimate consumer
setting** (`$drilldown-arrows: false` -> c6=0; `$select-triangle-color: transparent` ->
c4=0; `$breakpoint-classes: (small)` -> c2 98->48). **Absence of a class in one
configuration is not evidence the class is fixed** [T01 s4.1].

**5. A validity oracle alone is insufficient -- pair it with a class-name parity
check.** *Ground:* class 5 is valid CSS matching nothing and class 6 is a defect of
ABSENCE. See section 2.1.

**Plus, where the component ships twins: the orphan-twin check (C4).** Compile at any
two settings configurations; **the twin layer's selectors must be a SUBSET of the base
sheet's selectors. Orphan twins > 0 is a failure.**

**Cost, measured interleaved and shuffled** [T03 s5.1]:

| Target | Envelope (2x one compile) |
| --- | --- |
| Whole library | **~2.8 s** |
| `button-group` | **~780 ms** |
| `menu` | **~310 ms** |

The admitting compile costs the same as the defaults compile within noise (+10% / +2% /
-6% across library / `button-group` / `menu`, **every cell's own spread wider than the
between-condition difference** -- see `../README.md` trap 3). **The refuted cartesian
gate at the same rate is over 3 hours and still incomplete.**

**What the gate must NOT be built from.** Not
`verify-foundation-parity.mjs`'s `PHYSICAL_TO_LOGICAL_VALUE` /
`DIRECTIONAL_VALUE_PROPERTIES` tables, and not Check 4's shape (C9, section 5).
**Validity is measured with a spec lexer and the browser's CSSOM, never with a
hand-written physical-to-logical table.**

**The probes already exist and are reusable, read-only:** `rtl-eliminator.mjs` (the
mechanism), `gate-site-coverage.mjs` (the envelope's completeness),
`rtl-baseline-support-probe.mjs` (the feature matrix C6 needs), `gate-closure.mjs` (the
transitive settings closure), `cssom-oracle-probe.mjs` (the oracle).

---

## 4. R027 -- validation shape and owner

**The requirement TEXT lands with the M002 application pass and lives in
`../M002/REGISTER-TEXT.md` section 6.** That is a register-application convenience only.
**The WORK is here.** Cross-reference both ways so neither half is orphaned.

> **R027** -- Every shipped Foundation component's direction-dependent CSS is valid at
> any consumer settings configuration, and renames none of Foundation's documented
> public direction-sensitive class names.
>
> - **Class:** quality-attribute. **Status:** active. **Source:** agent.
> - **Owner: SATISFIED JOINTLY, one artifact, two owners.** The **settings** milestone
>   **builds and runs** the gate; the **component-onboarding** milestone **satisfies it
>   per component**. Primary owning slice: the cross-component RTL /
>   component-onboarding milestone. **This joint ownership is exactly why there is no
>   ordering to negotiate** (section 1.3).
> - **Validation SHAPE (fixed, not a matter of taste):** compile the **entire shipped
>   component set** at the two-compile envelope (section 3), **not** through
>   `foundation-everything()`, and report **per-class** invalid-declaration counts
>   against the stated configuration -- **failing on any non-zero count in classes
>   1-4, on any renamed Foundation public class name, and on any orphan twin.** A
>   validity oracle alone is insufficient (it is structurally blind to the class-name
>   rename and to the `css-triangle` defect-of-absence), so a **class-name parity check
>   is mandatory**, and the **CSSOM tripwire must carry a positive control or abort**.
> - **Status today:** **Button already satisfies R027 under the rebind**;
>   `foundation-table` would not (one directional `text-align`).
> - **A new number was needed rather than widening R004**, because R004 is `validated`
>   against Button and a validated requirement must not carry a not-yet-built CI gate as
>   its validation. R004 instead takes a **Notes-only amendment**, which lands with M002
>   (`../M002/REGISTER-TEXT.md` section 7). **Do not re-open R004.**
> - **Numbering** [VERIFIED 2026-08-11 against `.gsd/REQUIREMENTS.md`]: highest landed
>   is **R026**, and neither source effort proposes any other new number, so **R027 is
>   free and uncontested**.

**How R027 relates to the two obligations:** the settings-owes-RTL obligation IS R027's
gate; the RTL-owes-settings obligation IS R027's per-component satisfaction condition.
There is one artifact, and closing R027 closes both obligations.

---

## 5. `verify-foundation-parity.mjs` -- disposition, owner, triggers (C9)

`packages/ngx-foundation-sites/scripts/verify-foundation-parity.mjs` is wired as a
`dependsOn` of `ngx-foundation-sites:lint`, so **it runs on every lint. It is
mechanism-coupled and wrong in BOTH directions** [V-REPO, read while writing the source
hand-off].

**Direction 1 -- under the REBIND, it BLESSES the worst defect class.**
`PHYSICAL_TO_LOGICAL_VALUE` (lines 63-66) maps `left -> inline-start` /
`right -> inline-end`, and `DIRECTIONAL_VALUE_PROPERTIES` (line 67) is
`{float, clear, text-align}`. **Both sides of the comparison are normalised through
`toLogicalSheet` (lines 283-284)**, so the gate asserts `text-align: inline-start` is
the correct logical form of `text-align: left`. **It is not** -- `text-align` takes
`start`/`end`, so the blessed form is invalid and browsers drop it. The mapping is
correct for `float` and `clear` (both accept `inline-start`/`inline-end`) and wrong
**only** for `text-align`. **Harmless today because Button emits no `text-align`.**

**Direction 2 -- under the TWINS, it produces a FALSE FAILURE, and the fault is bigger
than the table.** Check 4 (lines 416-435) runs on the **RAW** component output and fails
on **any** physical directional property or value: any of
`margin-left`/`margin-right`/`padding-left`/`padding-right` at a non-zero value (via
`PHYSICAL_TO_LOGICAL_PROPERTY`, lines 57-62), or `left`/`right` as the value of
`float`/`clear`/`text-align`. **A twin sheet emits exactly Foundation's physical
declarations byte for byte -- that is the mechanism's entire guarantee** -- so Check 4
rejects **the whole construction**, not just its `text-align`. **Check 4 is
mechanism-coupled at the CHECK level, not merely at the table level.**

**Owner: the milestone that admits component #2** (cross-component RTL /
component-onboarding). **Not** the settings milestone: the fault is a property of the
RTL mechanism a component chooses, and the gate's own reference island
(`FOUNDATION_REFERENCE`, lines 42-50) is the Button-only three-`@import` island.

**Triggers -- both thresholds, neither a judgement:**

| # | Threshold | Consequence |
| --- | --- | --- |
| **T-a** (= contract trigger 8) | count of directional `text-align` declarations emitted by any shipped component > 0 | The table's wrongness becomes live. Under the rebind it **blesses an invalid declaration**; under the twins Check 4 **falsely fails a byte-exact match**. |
| **T-b** | `FOUNDATION_REFERENCE`'s island covers more than one component | The tables and Check 4 are applied to declarations Button never produced, so **they must be corrected BEFORE that gate extension lands**. This is also the moment the latent island **under-import** defect bites the same island -- `../M002/HANDOFF.md` section 10.6 (flagged there, not fixed in M002). |

**Interim disposition: do NOT fix it now, and do NOT propagate it.** Nothing in the
shipped sheet reaches either fault, and a speculative rewrite would be keyed to a
mechanism choice that has not been made for component #2.

> **C9's prohibition is the part that binds TODAY: neither table, nor Check 4's shape,
> may be copied into any new gate** -- specifically not into the admission gate of
> section 3, which measures validity with a spec lexer and the browser's CSSOM, never
> with a hand-written physical-to-logical table.

**The minimal fix, recorded so the owner does not re-derive it -- two lines, and one of
them serves BOTH mechanisms:**

1. **Remove `text-align` from `DIRECTIONAL_VALUE_PROPERTIES` (line 67)**, leaving
   `{float, clear}`. That alone retires direction 1 -- `float`/`clear` are the only two
   properties for which the `left -> inline-start` mapping is valid. If a component ever
   legitimately emits logical `text-align`, **give it its own map to `start`/`end`**
   rather than reusing the shared one.
2. **Gate Check 4 on the component's declared mechanism.** A **rebind** component must
   fail on physical directional output (today's behaviour, correct for Button); a
   **twin** component must **assert the opposite** -- physical output matching Foundation
   byte for byte, with the direction split carried by `:where(:dir())` twins whose
   selectors are a **subset** of the base sheet's (C4's orphan-twin check).

**Also flip-relevant:** if Button ever migrates to the twins (discretionary forever,
section 1.6), **C9 flips direction at the same moment**.

---

## 6. VERIFIED BY EXECUTION vs DERIVED vs INFERRED

Much of this material's value is that its claims were **measured**, not argued. Keep the
distinction legible; **do not let planning promote anything below section 6.2 to
settled.**

### 6.1 VERIFIED by execution / in real Chromium

Every quantity here is [V-EXEC] or [V-BROWSER] in
`.scratch/settings-rtl-coupling/research/01`-`03`, with the probe named and the output
captured in `prototypes/out/run-*.txt`. The load-bearing ones:

- **0 invalid declarations from the direction-twin sheet across 8 settings
  configurations**, against the rebind's **36** (defaults) and **56** (two legitimate
  settings flipped); **exact declaration-level equivalence to Foundation's own RTL
  build**, 0 mismatches every time.
- **0 differing computed values** vs the dual build, in BOTH directions, side by side in
  ONE document, in real Chromium 151. **Naive control: 30 wrong values.**
- Chromium-dropped declarations: rebind **142**, Foundation **86**, eliminator **86** --
  delta **+56 vs +0**.
- **`.x::after:dir(rtl)` is dropped whole; `.x:dir(rtl)::after` is kept.** Element-scoped
  `:dir()` is correct for a nested opposite-direction island; descendant-scoped is wrong.
  **`revert-layer` in an unlayered sheet rolls back past the author origin** (0px where
  the consumer set 77px).
- **The replication law:** `c2 = 2*cols*bps + bps + 23`, fitted on 12 points, **9/9
  held-out predictions exact**; **1187** invalid declarations at 48 columns x 12
  breakpoints against **98** at defaults; **zero new source sites** in any class at
  either extreme.
- **Two-compile envelope completeness across 24 configurations:** 8/8, 22/22, 14/14,
  1/1, 11/11, 2/2. Site-level non-monotonicity (class 1: 3 and 6 sites, 1 shared; class
  5: 8 and 6, 3 shared) is **why both compiles are required**.
- **Non-monotone in one compile:** `$global-flexbox: false` adds 4 class-1 defects and
  removes 7 class-5 defects. **Three classes maskable to zero** by legitimate settings.
- **15 of 498 consumer-settable names** in the transitive gate closure over 109 rebind
  sites; **13** measured to move a defect count; a brute-force flip of **all 31
  booleans** in Foundation's template found no others.
- **36 invalid vs 102 at identical settings**, purely from which mixins are included --
  which is why the gate must pin the component set.
- **M002's three-way clearance** (shipped route, maximal route, static closure), with the
  controls provably **live** at raw-Foundation level (`$global-radius: 6px` = +128
  bytes). Stated in full in `../M002/HANDOFF.md` section 3.
- **Costs:** envelope 2.8 s / 780 ms / 310 ms; BASE compile 1350 ms and 1344 ms on two
  independent code paths; twins indistinguishable from noise; generator exactly
  1.9-2.1x; volume **+14.1%** library-wide and **+62%** for `button-group`.
- **`:dir()` 134/136 pinned targets**; `:where()`, `@layer`, `revert`,
  `css-logical-props` all **136/136**. On a simulated `:dir()`-less engine the split
  twins cost **47** regressed computed values in LTR; the graceful variant costs 0, at
  **32** values of RTL inexactness.
- **The CSSOM oracle** drops all class 1-4 declarations at both the declaration and
  sheet level with five valid controls surviving, and is **structurally blind to classes
  5 and 6**.
- **`@use ... with (...)` applies once per module per compilation, and only before
  anything else has loaded it** -- three verified hard errors, including the realistic
  case of two consumer partials each configuring.
- **Silent ignore today:** pasting Foundation's entire 490-variable `_settings.scss`
  compiles **byte-identically (5839 B) with no warning**, even with a value deliberately
  changed. Same for the legacy `@import` route and for hand-declared globals.
- **Foundation's docs:** `$global-text-direction` appears **exactly once** in the whole
  shipped tree; `sass.md` / `global.md` have **zero** mentions of "direction"; the
  settings template a consumer edits carries a bare uncommented line; the shipped
  `customizer/` has **no direction handling**; `dir="rtl"` is documented as a
  **JavaScript** requirement. **`.align-left`/`.align-right` are documented public
  direction-sensitive API**; `_global.scss:126` labels `$global-left`/`$global-right`
  **"Internal variables"**.

### 6.1a VERIFIED by reading a tracked file [V-REPO]

- **`.gsd/DECISIONS.md`'s highest landed row is D031**; `.gsd/REQUIREMENTS.md`'s highest
  is **R026**. Re-confirmed 2026-08-11 for this synthesis. See `../README.md` section 4.
- **`.browserslistrc`** pins `baseline widely available on 2026-05-07`, and its own
  header records the rolling query resolving to **chrome/edge 121** against the pin's
  **119**. This is C7's version-number trigger, **read from the file rather than
  recalled**.
- **`scripts/verify-browserslist.mjs` is 36 lines** and asserts only the query string and
  a non-empty resolution -- **no feature-vs-targets check anywhere**. C6 is a real gap,
  not a suspicion.
- **`verify-foundation-parity.mjs`**: lines 57-62 (`PHYSICAL_TO_LOGICAL_PROPERTY`), 63-66
  (`PHYSICAL_TO_LOGICAL_VALUE`), 67 (`DIRECTIONAL_VALUE_PROPERTIES` includes
  `text-align`), 283-284 (both sides normalised), 416-435 (Check 4 fails any physical
  directional output), 42-50 (the Button-only three-`@import` reference island). See
  section 5.

### 6.2 DERIVED -- composed from cited measurements, not itself executed

- **C5's core claim**, that the admission test is settings-**INDEPENDENT** so no key need
  be withheld. Composed from the site-completeness result plus the zero-new-sites result;
  both are [V-EXEC]. **If the envelope is ever found incomplete for a new Foundation
  version, C5 weakens with it** -- that is trigger 5.
- **C4's forcing argument**, that a live settings surface forbids a pre-generated twin
  blob. Composed from "Sass cannot rewrite selectors it did not author" [V-BROWSER] plus
  the island idiom compiling Foundation inside the consumer's compilation [V-SRC].
  **The desynchronisation itself was not staged.**
- **The refutation of per-component coupling on the settings axis.** Both halves are
  [V-EXEC] (the once-and-first hard errors; the cross-component gate map); the
  degeneration argument is composed.

### 6.3 INFERRED -- the contract's unproven premises

- **THAT A HAND-AUTHORED SASS TWIN PARTIAL ACTUALLY TRACKS CONSUMER SETTINGS (C4's
  option (b)). This is the single most load-bearing unverified premise in the contract.**
  It follows from the partial being Sass, but **no such partial was written** -- authoring
  ~337 twin rows is the milestone's work. That is exactly why **trigger 3 is a measurable
  threshold (orphan twins > 0) rather than a rationale.** If it fires, the fallback is
  stated and needs no new decision: **either** the settings surface withholds every shape
  setting in that component's gate closure, **or** the component is onboarded via the
  rebind under trigger 2.
- **That the two-compile envelope stays complete as Foundation's component set grows.**
  Complete over 24 configurations against the CURRENT tree, resting on the 15-name gate
  closure -- itself INFER-flagged: **a guard driven by a value computed at runtime from a
  setting would evade both the static walk and the brute-force sweep.** None was found;
  none was proven absent. Trigger 5 covers it.
- **That the CSSOM tripwire fires on a real regression.** No generator regression was
  staged. C8's positive-control requirement is the mitigation, and the
  settings-owes-RTL obligation makes staging one testable.
- **That "value settings are safe, shape settings are not" generalises beyond the 13
  measured.** A mechanism-level claim consistent with every measurement, not tested
  against the ~470 non-boolean settings individually. **Trigger 6 is written as the
  mechanism test, not as the measured list**, precisely for this reason.
- **That upstream labelling a variable "internal" implies a stability risk.** The label is
  [V-SRC]; that Foundation would change those two lines is a judgement. Treated as a
  **preference for the public variable, never as a predicted break.**
- **That `$breakpoints` and `$grid-column-count` are unbounded "in practice".** Their
  domains are unbounded by construction and the law was confirmed to 12 breakpoints and
  48 columns; how far a real consumer goes is a judgement. **The refutation of a
  cartesian gate does not depend on it.**

### 6.4 Measurement traps

**Five reusable measurement traps are stated once in `../README.md` section 5.** All
five are directly relevant here: trap 1 IS C2.3; trap 2 IS C8's positive-control
requirement; trap 3 governs every cost figure in section 6.1; trap 4 is why the
additivity result reads 12-of-71 rather than 19-of-78; trap 5 is why the 15-name gate
closure is trustworthy (two independent methods agree).

---

## 7. M002's non-foreclosure constraints that bind the LATER milestones

M002 owns **nothing** of the Foundation settings API (D040). What it owns is **seven
non-foreclosure constraints** plus one README obligation. **Five of the seven bind a
later milestone**; the other two are M002's own build shape. Inherit these rather than
re-deriving them.

| # | Constraint | Binds |
| --- | --- | --- |
| **1** | **`_theme.scss` stays a DATA module** -- no `!default` member, and **it is NOT the settings entry point.** The future settings module is a **separate file with its own `exports` key.** | **Settings.** Mechanical, not aesthetic: **a module consumers READ can never be the module they CONFIGURE**, because reading it loads it and configuring an already-loaded module is a hard error. Merging the roles would lock the demo app and every README-following consumer out of configuring settings **by the act of reading the compliant palette**. |
| **2** | **The addon's six controls are documented as an ADDON surface, never the library's settings vocabulary.** The panel must never be cited as evidence about the library's Sass API -- in either direction, and **least of all as a reason to keep that API small.** | **Settings.** The library's settings vocabulary is Foundation's 490-name surface. |
| **4** | **The generator's entry-point arrays stay DATA, and no gate freezes a literal closure file count.** | **Any later gate author.** Adding a module would otherwise turn a correct change into a red gate for the wrong reason. |
| **5** | **M002 does not touch `internal/_settings.scss`** -- no `!default`, no split, no new members. The addon's six-name defaults probe against it is a **named seam OWNED BY THE SETTINGS MILESTONE**, with the variable list living in the generated data module. | **Settings.** This is the seam to pick up: the probe reads `$primary-color`, `$secondary-color`, `$success-color`, `$warning-color`, `$alert-color`, `$global-radius` -- **Foundation-global names, chosen because they survive the eventual split of `internal/_settings.scss`.** |
| **7** | **R009's "Foundation global" identity column is VOCABULARY, not wiring** -- the island pre-seeds derived names non-`!default` before the `@import`s, so Foundation's derivation cascade never fires and `$foundation-palette`, `$primary-color`, `$global-radius`, `$global-font-size`, `$global-margin` and `$global-text-direction` are **all inert as inputs**. | **Settings, sharply.** **A settings milestone that routes controls through `$foundation-palette` / `$global-radius` without restoring the derivation cascade would ship a silent no-op.** This is the same fact as the "most consequential item" in section 8. Constraint 7 also carries the **value-vs-shape rule** (trigger 6); that rule's canonical statement is in R009's control-table note. |

*(Constraints 3 and 6 are M002-internal: the ordered leading configuration slot in the
entry string, and the README silent-ignore limitation. They cost a later milestone
nothing, but note that constraint 3 exists specifically so a settings clause can be
prepended -- **Sass configuration must precede every `@use` of any module that loads the
configured module, so an appended clause can never work.**)*

**Also inherited from M002, uncorrected and relevant here:** the **latent island
under-import defect**. The repo's three-`@import` island (`util/util`, `global`,
`components/button`) is **under-imported for EMISSION**: `menu` and its relatives need
sassy-lists' `sl-remove()` via `-zf-each-breakpoint-in()`, and `dropdown-menu` /
`tooltip` need `typography/typography`. Cost to fix: **+8 ms of floor, once.** It fails
only when a *second* component's rules are actually **emitted**, so **no gate that
compiles Button alone can see it**, and the same three-`@import` shape is
`verify-foundation-parity.mjs`'s fixed reference island -- which is C9's trigger T-b.
Full statement in `../M002/HANDOFF.md` section 10.6.

**Rulings M002 made that a later milestone inherits rather than re-derives:** the
settings API is out of M002's scope with a named owner (D040); cross-component RTL is
out of M002's scope with a named owner and an onboarding obligation (D039 as amended,
D042, D044); performance machinery is out with **thresholds instead of premises**
(D038). **None of these rests on component count.**

---

## 8. The settings milestone's own open shape -- eight items

The scoping verdict (D040) is measured, not a scheduling preference:

- **481 of Foundation's 490 settings are read only by component partials this library
  has not wrapped.** Only **42** are referenced anywhere in the button chain's real
  13-partial closure, and only **6** by `util/` + `_global` alone. An API designed
  against 42 names would be validated against a fraction of its own surface.
- Every viable mechanism requires rewriting `internal/_settings.scss`'s **26 deliberate
  plain assignments** into `!default` or map-driven reads -- a change to the library's
  compile-time contract that touches the island's seeding idiom
  `verify-foundation-parity` gates.
- `@use ... with (...)` is **verified viable and verified LOUD on unknown names**, but
  applies **exactly once per compilation, before any other load**, so a half-shipped
  surface publishes an ordering constraint every later addition inherits.

**What the mechanism buys and costs, resolved ground by ground:**

| Tension | Resolution |
| --- | --- |
| "`@use ... with` forces bare Foundation-shaped globals" | **APPLIES and INVERTS.** A defect for a theme mixin whose point is that no global is named; **the GOAL for a settings module**, because a migrator arrives holding exactly those names. |
| "cannot be invoked twice" | **APPLIES and bites harder**, but is survivable as "configure once, first, from the entry stylesheet" -- it is Foundation's own legacy requirement, now enforced with an **error instead of silence**. It does not touch `theme()`: configured settings plus two scoped `theme()` calls in one compilation is verified to work. |
| "emitted 5490 bytes" | **DOES NOT APPLY.** A settings module emits **0 bytes**. |
| The property nobody costed | Under `@use ... with`, an unknown or misspelled name is a **hard compile error with no validation code at all** -- the exact inverse of today's silent ignore. |

**Two mercies and one extra trap:** `theme()`'s four public arguments are airtight (any
undeclared argument or `with` clause is a hard error); pasting Foundation's settings
**above** the `@use` is a hard Sass error; but **a typo'd key in the one public map
argument silently emits `.button.sucess` plus 932 B of junk CSS.**

**The eight open items** are enumerated in
`.scratch/m002-storybook-theming-addon/research/15-*.md` section 6, each with its
measured starting input. The three that decide the shape:

1. **Bare-name `with` vs a single `$settings` map.**
2. **What happens to a real Foundation name whose component does not exist yet.** This is
   C5's inert tier, and **C5 constrains but does not decide it: whichever tier is picked
   must never yield SILENCE for a live key.** A real Foundation name whose component does
   not exist errors today under both candidate mechanisms; a warn-and-ignore tier is the
   settings milestone's call.
3. **Whether the library restores Foundation's derivation cascade or keeps the flat
   pre-seeded names. THE MOST CONSEQUENTIAL**, because it decides whether a migrator's
   `$foundation-palette` edit does anything at all (constraint 7 above). **Note C2.3
   binds this item directly: the same `foundation-everything()` `!global` overwrite that
   would fake a clean RTL gate would corrupt a cascade-restoring settings surface
   itself.**

---

## 9. Fog check -- nothing silently vanished

All three items charted as fog **GRADUATED**, each into a research document and then into
a contract clause. **No new fog was opened.** Everything either landed in a clause,
carries a threshold trigger, or is explicitly flagged in section 6.3 with the threshold
that would refute it.

| Fog item at charting time | Graduated by | Where it landed |
| --- | --- | --- |
| Whether the class-rename defect is settings-dependent | **[T01] s6** -- YES, but only **downward** and only via `$global-flexbox` (13 -> 6 selectors), never breakpoint-multiplied. Worse than first stated: the rebind removes **BOTH** `.align-left` and `.align-right`. One of three "maskable-only" classes whose **maximum IS the default**. | C2.5 (a validity oracle cannot see it, so a class-name parity check is mandatory) and, via [T03] s6, the finding that these are **documented public API** -- which is why disclosure loses. |
| Whether elimination costs compile time | **[T02] s7** -- it does **NOT**. BASE 1350 ms; the twins are indistinguishable from noise; the generator costs exactly one extra pass. Volume rises +14.1% library-wide, +62% for `button-group`. | The "**volume is deliberately NOT a trigger**" ruling (section 1.5) plus the sizing note for planners. |
| What Foundation's own docs claim about the settings/RTL interaction | **[T03] s6** -- **NOTHING, anywhere.** Upstream has no runtime CSS direction contract at all. | C7 (the disclosure is this library's own, **not a relayed upstream hazard**) and the two contract facts: `.align-left`/`.align-right` are documented public API, and `$global-left`/`$global-right` are labelled "Internal variables". |

**Out-of-scope entries that remain accurate:**

- **Designing or building either milestone.** This hand-off states obligations, triggers
  and one gate's required properties. It does **not** author the twin partial (~337 rows,
  explicitly the milestone's work and the contract's one INFER), does **not** choose the
  settings surface's key-validation tier, and does **not** pick between C7's options
  A/B/C.
- **Re-opening M002's closed decisions**, unless a control activates residue. The
  condition was **tested and NOT triggered**. **Trigger 6 is the standing re-entry
  condition.**
- **Dual-build RTL**, ruled out by a shipped artifact -- and the ruling is now **doubly
  safe**: the direction twins are not a dual build. **Do not resurrect the dual build.**
- **Fixing `verify-foundation-parity.mjs`.** Still out of scope for a wayfinding effort;
  it now has a **named owner and two threshold triggers** instead of being folklore
  (section 5).

---

## 10. Application checklist

State-changes that must end up in GSD, for the **deferred** side. **Route-agnostic.**

1. **Add R027** with the text in `../M002/REGISTER-TEXT.md` section 6 and the **validation
   shape, owner and joint-satisfaction note from section 4 of this file.** Whichever
   application pass runs first should carry both halves; do not land the text without the
   validation shape.
2. **The four decision rows that carry this contract (D041-D044) land with the M002
   register append**, in `../M002/REGISTER-TEXT.md` section 5. Nothing here needs a separate
   register action. **The register is append-only.**
3. **Record the contract (sections 1-3 of this file) as roadmap-level context for BOTH
   milestones**, explicitly including: **the gate is not temporal**; **both obligations
   are discharged by ONE artifact**; **emitted volume is deliberately not a trigger**,
   with its reasoning; and **all eight triggers with their thresholds and version
   numbers.**
4. **Create the two milestones with their must-not-until lists** (section 1.4), and
   record that **neither carries an ordering dependency on the other.**
5. **Record C9's disposition and its two triggers** (section 5) against the
   component-onboarding milestone, including **the interim "do not fix, do not
   propagate" ruling** and the minimal two-line fix.
6. **Record C6 as owed** before the first `:dir()`-emitting component ships, with trigger
   7 as its grep-level condition.
7. **Record C7 as the only expiring clause**, with its version-number check, so it is
   deleted rather than maintained once the pin resolves to no chrome/edge below 120.
8. **Carry section 6 forward** so the DERIVED and INFER items stay visible during slice
   design -- **especially C4's option (b)**, the single load-bearing unproven premise,
   and its measurable refutation threshold (orphan twins > 0).
9. **Carry section 7 as inherited constraints** rather than re-deriving them, and
   section 8's eight open items as the settings milestone's discovery input.
10. **Do NOT carry any sequencing story between the two milestones.** It is superseded
    (`../README.md` section 2.1).
