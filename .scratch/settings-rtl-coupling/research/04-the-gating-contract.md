# The gating contract between the settings surface and cross-component RTL

Resolves ticket `.scratch/settings-rtl-coupling/issues/04-the-gating-contract.md`.
Status: **resolved, contract LOCKED** (AFK -- no human in the loop, per map.md Notes).

Synthesis only. Nothing was measured here; nothing outside `.scratch/` was created,
edited or deleted; no probe was written and no `research/*.md` under
`.scratch/m002-storybook-theming-addon/` was touched.

## Evidence key

- **[T01]**, **[T02]**, **[T03]** -- carried from this map's resolved tickets, with
  the section cited. Every such claim is [V-EXEC] or [V-BROWSER] **there**.
- **[T14]**, **[T15]** -- carried from the closed M002 map's research, cited.
- **[V-REPO]** -- verified here by reading a tracked file (path + line).
- **[DERIVED]** -- a conclusion of THIS ticket, composed from cited measurements.
  Sound only if its named premises hold; it was not itself executed.
- **[INFER]** -- reasoned, with no execution behind it anywhere. Flagged.

---

## 1. THE LOCKED CONTRACT

> **Shape: ELIMINATION-FIRST, admitted per component by a mechanical test.**
> Option 1 of the ticket's four, with one correction the evidence forces: the gate
> is **not temporal**. Neither milestone waits for the other. What gates is a
> two-compile admission test on the **component** side, and once it holds over the
> shipped set the settings surface is safe for **every** Foundation setting at
> **every** value, by construction.

Nine clauses. Each carries its measured ground; the ones that can expire carry a
threshold or a version number.

### C1 -- Shape

**No settings-dependent RTL defect class may exist. Prevention, not detection, not
disclosure.** A component's direction-dependent output is produced by a mechanism
proved incapable of synthesising a property name, value or class name that
Foundation did not itself emit.

*Ground:* [T02 s1/s3.3] the direction-twin construction emits 0 invalid
declarations across 8 settings configurations against the rebind's 36-56, with
exact declaration-level equivalence to Foundation's own RTL build and 0 differing
computed values in real Chromium in both directions in ONE document. **The
guarantee is structural, not sampled:** no new token is ever synthesised.

### C2 -- The admission test (the single gating artifact)

**A component is ADMITTED when it emits zero BROKEN-class declarations and zero
renamed Foundation public class names across the two-compile envelope.** The
envelope, and the test's mandatory properties, are fixed here and are not a matter
of taste:

1. **Two compiles, not a grid:** Foundation defaults, plus
   `$buttongroup-radius-on-each: false` with `$global-flexbox: false`. **Both are
   required and neither suffices.**
   *Ground:* [T03 s5] the envelope is COMPLETE over source sites across 24
   configurations (8/8, 22/22, 14/14, 1/1, 11/11, 2/2), because magnitude growth
   is **pure replication** -- all 1187 class-2 declarations at 48 columns x 12
   breakpoints come from the same **22 source sites** as the 98 at defaults, zero
   new sites in any class. Both compiles are needed because non-monotonicity holds
   at SITE level (class 1: 3 and 6 sites, 1 shared; class 5: 8 and 6, 3 shared).
2. **The test must pin the COMPONENT SET, not only the settings.**
   *Ground:* [T01 s2.1] 36 invalid vs 102 at identical settings, purely from which
   mixins are included.
3. **The test must NOT compile through `foundation-everything()`.**
   *Ground:* [T01 s2.1] it executes `$global-flexbox: true !global`, silently
   overwriting the consumer's setting, so every `$global-flexbox`-gated site
   reports a false clean. This constraint binds the settings surface's own gate
   too, not just the RTL one.
4. **The test must report per-class counts against a stated configuration, never a
   bare pass/fail.**
   *Ground:* [T01 s4.1] three of the six classes can be masked to ZERO by a
   legitimate consumer setting (`$drilldown-arrows: false` -> c6=0,
   `$select-triangle-color: transparent` -> c4=0,
   `$breakpoint-classes: (small)` -> c2 98->48). **Absence of a class in one
   configuration is not evidence the class is fixed.**
5. **A validity oracle alone is insufficient.** Pair it with a class-name parity
   check.
   *Ground:* [T03 s4] class 5 is valid CSS matching nothing and class 6 is a defect
   of **ABSENCE** -- the rule and every declaration in it survive intact. A validity
   oracle sees only declarations that are PRESENT and rejected, so it is blind to
   both **by construction, not by bad luck**.

*Cost, so nobody prices it as expensive:* [T03 s5.1] the envelope is 2x one
compile -- ~780 ms for `button-group`, ~310 ms for `menu`, ~2.8 s for the whole
library, measured interleaved and shuffled. The refuted cartesian gate at the same
rate is **over 3 hours and still incomplete**.

### C3 -- Mechanism assignment (a rule, not a per-component judgement)

**Direction twins by default. The rebind if and only if C2 returns zero for that
component. No third mechanism.**

*Ground:* [T02 s5.2] Button's whole direction-dependent surface is 5 declarations
in 4 rules, all in SAFE classes, so the rebind gives 3 valid declarations and ZERO
twins where the twins would give 4 rules and 6 declarations plus a `:dir()`
dependency. [T02 s2/s2.1] every other mechanism is closed: no substitution value
works (`start/end` 160 invalid, `inset-inline-*` 131), and a **Sass mapping layer
is impossible, not merely unattractive** -- the property name, the value and the
selector are all assembled by interpolation inside Foundation's source, and the one
hook that exists (post-`@import` mixin redefinition) reaches exactly one of six
classes. A post-process layer is closed by D021 (`styleUrl` leaves no
library-controlled CSS artifact) [T02 s5.1].

**T14's D1e hybrid is refuted as stated and must not be resurrected:** the rebind
that produces its "logical properties where safe" is itself the sole source of all
six defect classes [T02 s1].

### C4 -- The twin layer's BUILD SHAPE is forced by the settings surface

**Where a component ships twins AND the settings surface is live, the twin layer
must be authored in Sass, mirroring Foundation's own `@if` guards. A twin layer
pre-generated at library build time and shipped as static CSS is FORBIDDEN.**

*Ground:* [T02 R2] Sass cannot rewrite selectors it did not author -- confirmed by
the one case where a hook exists, where `&:dir(rtl)` produced
`...::after:dir(rtl)`, which **Chromium drops whole** [T02 V-BROWSER s2]. So the
twins cannot be generated at consumer compile time, leaving exactly two shapes:
(a) pre-generated CSS, or (b) hand-authored Sass. **[DERIVED]** Foundation's
partials compile INSIDE the consumer's compilation under this library's island
idiom [T01 s2.1, V-SRC `internal/_foundation-button.scss:53-55`], so base rules
track consumer settings while a pre-generated blob is keyed on the LIBRARY's
settings. Under a live settings surface the two desynchronise -- and a twin whose
selector matches nothing is **invisible**, which is this defect family's signature.
Therefore (a) is incompatible with the settings surface and (b) is the only shape
left.

**Machine-checkable form:** compile the library at any two settings
configurations; the twin layer's selectors must be a **subset** of the base
sheet's selectors. **Orphan twins > 0 is a failure.**

**Two placement constraints that come with it, both measured:**
- **The twins MUST be emitted inside the same `@layer` as the rest of the library
  defaults.** Unlayered, they would compete with consumer theme rules on
  specificity and could win, inverting R008 [T02 s8].
- **`:where(:dir(...))`, element-scoped, appended to the last compound before any
  pseudo-element -- never bare `:dir()`, never descendant-scoped.** Bare `:dir()`
  with an appended layer produces **30 wrong computed values**; descendant scoping
  is wrong for a nested opposite-direction island [T02 s3.1, V-BROWSER s3/s4].
  `revert-layer` is a trap and the construction uses none [T02 s8].

### C5 -- The settings surface is UNCONDITIONALLY open, with one prohibition

**No Foundation setting is withheld on RTL grounds. Once C2 holds over the shipped
component set, every setting is safe at every value.** The single prohibition is:
**no published key may be live-and-unsafe.** A key is permitted to be inert (its
component is not shipped yet) or live-and-safe (its component is admitted); it may
never be live and able to activate a defect.

*Ground:* **[DERIVED]** from three measurements. [T03 s5] the two-compile envelope
is complete over source sites; [T03 s5] magnitude growth adds zero new sites; so a
component that emits zero BROKEN-class declarations across the envelope emits zero
for **any** settings configuration -- the admission test is settings-**independent**
even though the defect count is settings-dependent. This is what makes the surface
safe without a per-setting allowlist.

*The inert tier is a real design seam, not a loophole:* [T15 Q6 item 2] a real
Foundation name whose component does not exist yet errors today under both
candidate mechanisms; a warn-and-ignore tier for known-Foundation-but-uncovered
names is the settings milestone's decision, and C5 only requires that whichever
tier it picks never yields silence for a **live** key -- silence is the failure
mode [T15 s4: 490 settings pasted, byte-identical output, no warning].

*Sharp consequence for the settings milestone's own most consequential item:*
[T15 Q6 item 3] restoring Foundation's derivation cascade is what makes a
migrator's `$foundation-palette` edit do anything. C2.3 says the gate must not run
through `foundation-everything()`; the same overwrite would corrupt a cascade-restoring
settings surface itself.

### C6 -- The R022 feature gate (owed, currently absent)

**Extend the browserslist check to assert the CSS features the shipped mechanism
uses against the RESOLVED targets, not just the query string.** Owed before the
first component that emits a `:dir()` selector ships.

*Ground:* [V-REPO `scripts/verify-browserslist.mjs`, 36 lines] the script asserts
`config.includes('baseline widely available on 2026-05-07')` and
`browserslist().length !== 0`. **It checks no feature against any target**, so
nothing in this repo would notice `:dir()` failing 2 of 136 [T03 s1].
[T02 s6] the feature matrix already exists as
`prototypes/rtl-baseline-support-probe.mjs`: `:dir()` 134/136;
`:where()`, `@layer`, `revert`, `css-logical-props` all 136/136.

*Trigger to run it:* the library's built CSS contains at least one `:dir(`
occurrence. That is a grep, not a judgement.

### C7 -- The `:dir()` disclosure, and its expiry as a VERSION NUMBER

**Disclose the browser-support gap and which of T02's three ways out is taken.
This is the only clause in the contract that can expire.**

> **Expiry trigger: the pinned `.browserslistrc` query resolves to a chrome and
> edge floor of 120 or higher.** `:dir()` shipped in **chrome/edge 120**. The pin
> `baseline widely available on 2026-05-07` floors at **119** [V-REPO
> `.browserslistrc`], which is the entire cost. The file's own header records the
> **rolling** query resolving to **chrome/edge 121** [V-REPO]. So the drift is in
> the mechanism's favour and the next re-pin closes the clause automatically.
> **Check:** `browserslist()` returns no `chrome` or `edge` version below 120 ->
> delete C7.

*The three priced ways out [T02 s6.1], so the choice is not re-derived:*

| option | exactness vs the dual build | chrome/edge 119 |
| --- | --- | --- |
| **A. Split twins** (T02's recommendation) | **0 differing computed values** | 47 regressions in LTR |
| B. Graceful variant (LTR stays in the base rule, RTL twin only) | 32 differing computed values | **identical to today** |
| C. Bump the floor 119 -> 120 | 0 | the rolling baseline already delivers it |

**This disclosure is NOT the ticket's option 4.** It discloses a browser-support
gap in a mechanism this library chose; it is not a confession about invalid CSS
[T03 s3].

`$global-text-direction` is disclosed alongside it and stays **accept-and-honour**
[T14 D2], and under the twins it becomes genuinely meaningful for the first time:
compile one pass at the chosen direction and skip the twin layer, yielding a
smaller, `:dir()`-free sheet [T02 R4]. It is also **the only setting with an
upstream contract behind it** -- public and SassDoc'd, where
`$global-left`/`$global-right` are labelled **"Internal variables"**
[T03 s6, V-SRC `_global.scss:126`].

### C8 -- The CSSOM tripwire, re-purposed

**Keep the CSSOM validity check in the existing `test-browser` lane, as a
regression tripwire on the GENERATOR's invariant -- not as a settings gate.**

*Ground:* [T03 s4] the guarantee is a property of the generator, not of the emitted
sheet, so a generator bug or a reintroduced rebind breaks it silently. The lane
already exists (`ChromiumHeadless` over `**/*.browser.spec.ts`) and the oracle is
now measured, not inferred: it drops all class 1-4 declarations at both the
declaration and sheet level, with five valid controls surviving.

**Two mandatory properties, both bought with a caught false all-clear:**
- **A positive control asserting a known-VALID declaration survived. The gate must
  abort without one.** *Ground:* [T03 s4] `CSSStyleRule` has a `.cssRules` property
  and an empty `CSSRuleList` is **truthy**, so a natural
  `if (rule.cssRules) recurse` walk collects nothing and prints `[OK] ALL DROPPED`
  from a sheet it never examined.
- **Paired with a class-name parity check** (C2.5), or it certifies half the
  family. Also note Chromium's CSSOM expands `border-width` into four longhands
  when enumerated [T03 s4].

*Do not narrow or remove the `test-browser` lane* [T14 D4.9].

### C9 -- `verify-foundation-parity.mjs` is MECHANISM-COUPLED

**Its `PHYSICAL_TO_LOGICAL_VALUE` table must not be propagated to any new gate,
and its disposition belongs to whichever milestone first emits a `text-align` from
a directional site.**

*Ground:* [V-REPO, via T14 s10] lines 64 and 67 map `text-align: left ->
inline-start`, so the gate asserts the **invalid** form is the correct logical
form. Harmless today because Button emits no `text-align`. **And the coupling runs
both ways** [T02 R5]: under the twins the library emits `text-align: left`,
matching Foundation byte for byte, so the same translation would report a **false
FAILURE**. The table is wrong under the rebind and wrong under the twins, in
opposite directions.

---

## 2. Why each rejected shape loses

### Option 2 -- per-component coupling: LOSES as a settings-staging mechanism, SURVIVES as a component rule

Two independent refutations, both measured, and neither is a preference.

1. **The settings door has no per-component granularity to gate.** [T15 NF1/Q2]
   `@use ... with (...)` can be applied **once per module per compilation, and only
   before anything else has loaded it** -- three verified hard errors: the same
   module configured twice, configured after the library loaded it, and two
   consumer partials each configuring it. So N per-component settings modules means
   N `with` clauses each subject to the once-and-first rule, each order-coupled to
   the others: a combinatorial ordering contract for the consumer. The measured
   conclusion is **one door, per-component contents**. A contract that opens
   "a component's settings surface" is describing a thing Sass cannot build.
2. **The activating settings are cross-component, so a per-component gate
   degenerates to a library-wide one for exactly the settings that matter.**
   [T01 s2.2] `$global-flexbox` gates menu **and** accordion-menu;
   `$breakpoint-classes` / `$breakpoints` / `$grid-column-count` gate xy-grid
   position and interact with `$dropdownmenu-arrows`; `$drilldown-arrows`,
   `$accordion-plusminus` and `$accordionmenu-arrows` each gate their own. Staging
   `$global-flexbox` per component means withholding it until BOTH menu and
   accordion-menu are admitted -- which is the library-wide gate wearing a
   per-component label.

**What survives, verbatim:** its component-side half. "A component lands only when
its own RTL is closed" is exactly C2 + C3, i.e. [T02 s5.2] and [T14 D1g] -- and
under C2 it becomes **mechanical** rather than a manual classification against a
table. Option 2's instinct was right about the component axis and wrong about the
settings axis.

### Option 3 -- open settings with detection: LOSES three times

1. **Detection is UNNECESSARY, not merely infeasible** [T03 s1]. T02 proved
   prevention, so there is nothing left to detect. This is the decisive one and it
   subsumes the other two.
2. **A cartesian gate is the WRONG SHAPE, not merely too large** [T01 s3]. 11 of
   the 13 activating settings are booleans and 2 more reduce to two-valued
   predicates, so 2^13 = 8192 cells would cover the *set* -- but the two settings
   that drive the *count* are **multipliers with infinite domains**
   (`$grid-column-count` any integer, `$breakpoints` an arbitrary-length map),
   confirmed by a fitted law
   `c2 = 2*cols*bps + bps + 23` predicting **9/9 held-out** combinations. No finite
   product covers them. At the measured compile rate the 8192-cell grid is over
   3 hours and still incomplete [T03 s5.1].
3. **A gate over that space could never report pass/fail**, only per-class counts
   against a stated configuration, because the class is **non-monotone**
   (`$global-flexbox: false` adds 4 class-1 defects while removing 7 class-5
   defects in one compile) and three classes can be masked to zero by legitimate
   settings [T01 s4.1].

**Detect-in-their-CI is DROPPED** -- never buildable, now pointless [T03 s3]. A
consumer-run validator is dropped with it: the published package ships `./scss/*`
and `./css/*` and declares **no `bin`** [T03 s2], so it would have been a new
artifact class with its own packaging and support burden -- a cost now avoided
rather than paid.

### Option 4 -- open settings with disclosure: LOSES, and must be seen to lose

1. **It is what the library does TODAY by accident, and T15 named it the worst
   migration outcome** [T15 s4]: pasting Foundation's entire 490-line
   `_settings.scss` compiles clean and emits **byte-identical** CSS with no
   warning, including when one value is deliberately changed -- `#ff0000` appears
   nowhere in the output. Choosing option 4 is choosing to keep the status quo and
   write a paragraph about it.
2. **There is no upstream hazard to relay.** [T03 s6] Foundation documents **ZERO**
   settings/RTL interaction anywhere: `$global-text-direction` appears **exactly
   once** in its whole shipped docs tree, `sass.md` and `global.md` have zero
   mentions of "direction", the settings template a consumer edits carries a bare
   uncommented line, and the shipped `customizer/` has no direction handling at
   all. So a disclosure would not be relaying a documented upstream hazard -- it
   would be this library disclosing a defect it authored.
3. **It means shipping a documented-API break.** [T03 s6 item 3]
   `.align-left` / `.align-right` ARE documented public, direction-sensitive API
   (`docs/pages/menu.md:49-53`, with `float-classes.md:16`, `tooltip.md:80`,
   `off-canvas.md:236`, `flex-grid.md:197` carrying the same contract), and the
   rebind removes **both** of them from the emitted sheet [T01 s6]. That upgrades
   class 5 from "silently stops matching" to "breaks a documented upstream public
   API" -- and no validity oracle can see it [T03 s4].
4. **Foundation is dead upstream at 6.9.0** [T15 Q6 item 8], so "accept and
   document" defers to a maintainer who will not fix it.

**What survives is not option 4.** C7 discloses a **browser-support gap**, narrowed
to `:dir()` and `$global-text-direction`, in a mechanism this library chose. That
is a different object from a confession about invalid CSS [T03 s3].

---

## 3. Ordering

> **There is no ordering. The gate is not temporal, and inventing an ordering
> would be the expiring-premise error this map exists to prevent.**

Both milestones may start immediately and proceed in parallel. What gates is C2 --
a predicate over the **shipped component set**, checkable in ~2.8 s for the whole
library. Today Button is the only component in that set and it **passes** [T02
s5.2], so the settings surface is already safe for every Foundation setting at
every value. That statement's ground is the test, **not** the component count: it
holds for any set whose members all pass.

**What each must not do:**

| Milestone | Must not, until |
| --- | --- |
| **Settings** | ...ship a live key set before C2 is wired as a CI gate over the shipped component set (C2, C5). ...run any gate of its own through `foundation-everything()` (C2.3). ...publish a key that is live-and-unsafe; inert or live-and-safe only (C5). |
| **Component onboarding** | ...admit a component before C2 returns zero BROKEN-class declarations and zero renamed public class names (C2, C3). ...lift the rebind into a shared partial, ever (s7). ...ship a pre-generated CSS twin blob while the settings surface is live (C4). ...emit a `:dir()` selector before C6 lands. |

**Both are cheap.** Every settings-side item is a property of a gate the settings
milestone needs anyway; every component-side item is a prohibition or a 2x-compile
check.

---

## 4. The two obligations, one testable sentence each

> **Settings owes RTL:** *a CI gate that compiles the entire shipped component set
> at the two-compile envelope and reports per-class invalid-declaration counts,
> failing on any non-zero count in classes 1-4, on any renamed Foundation public
> class name, and on any orphan twin.*
>
> Testable by staging a regression: reintroduce the rebind for any non-admitted
> component and assert the gate fails; the CSSOM tripwire's positive control must
> also fail-closed when removed (C8).

> **RTL owes settings:** *every component it admits emits zero BROKEN-class
> declarations and zero renamed Foundation public class names across the
> two-compile envelope, so that no settings key ever has to be withheld.*
>
> Testable per component, in ~780 ms for `button-group` [T03 s5.1], against the
> probes already in `prototypes/`.

**They are discharged by the SAME artifact.** One gate, two owners: the settings
milestone builds and runs it; the component milestone satisfies it per component.
That is why there is no ordering to negotiate.

---

## 5. The triggers -- thresholds and version numbers only

| # | Trigger | Threshold / version | What it flips |
| --- | --- | --- | --- |
| **1** | `:dir()` enters the pinned baseline | pinned `.browserslistrc` resolves to **no chrome or edge below 120** (`:dir()` shipped in **120**; the pin floors at **119**; the rolling query already resolves to **121**) [V-REPO, T02 s6] | **Delete C7.** Option A becomes unconditional; the A/B choice disappears. |
| **2** | A component passes the admission test | **zero** BROKEN-class declarations AND zero renamed public class names across the two-compile envelope | That component may use the rebind instead of the twins (C3). Fires routinely; it is the contract's normal operation, not an exception. |
| **3** | A hand-authored Sass twin partial fails to track consumer settings | **orphan twins > 0** at any two settings configurations (C4) | C4's option (b) is refuted. Then either the settings surface withholds every shape setting in that component's gate closure, or the component is onboarded via the rebind (trigger 2). This is the contract's **one unproven premise** -- see s8. |
| **4** | Sass gains selector rewriting | a Dart Sass release shipping a construct that transforms selectors generated by an `@include` (today: none) [T02 R2] | The twins could be generated at consumer compile time; C4 collapses to a non-question. |
| **5** | Foundation's directional source changes | any `foundation-sites` version other than the pinned one, or any edit to `_global.scss:126-131` | Re-derive the 15-name gate closure and the two-compile envelope; the probes do it mechanically [T03 INFER]. Note Foundation is dead upstream at 6.9.0 [T15 Q6 item 8], so this trigger is a dependency bump, not a forecast. |
| **6** | A new addon control is a SHAPE setting | the control's domain is a **boolean, keyword, count or map length** -- not a colour or a length | M002's clean bill of health (s6) lapses and the addon is back in scope. The test is **"can it change WHICH rules are emitted?"**, never "is it a Foundation global?" [T01 s1.4] |
| **7** | The library emits a `:dir()` selector | the built CSS contains `:dir(` | C6 is due. |
| **8** | Any component emits `text-align` from a directional site | count of directional `text-align` declarations > 0 | C9's disposition is due, in whichever direction that component's mechanism makes it wrong. |

**Deliberately NOT a trigger: emitted volume.** [T02 s7] the twins cost **+14.1%**
library-wide and **+62%** for `button-group`, and compile time is
**indistinguishable from noise** (BASE 1350 ms, delta -4% to +7% with per-cell
spread wider than the between-condition medians; the generator is exactly one extra
pass at 1.9-2.1x). No volume budget is written into this contract, because any
number chosen now would be the expiring premise this map exists to prevent. Volume
is a reported quantity, not a gate. **Sizing note for planners:** the library-wide
average underestimates a small radius-heavy component by 4x.

---

## 6. M002's disposition -- CLEAN BILL OF HEALTH

> **M002 is NOT implicated. No M002 decision is re-opened, and the closed
> `.scratch/m002-storybook-theming-addon/HANDOFF.md` needs no correction.** Stated
> here so nobody re-opens it on suspicion.

**Verified three independent ways** [T01 s1]:

1. **The shipped route** -- the real public `theme()` chain, which already carries
   the rebind: `invalid=0`, all six classes zero, for every control and for all six
   together.
2. **The maximal route** -- all 41 Foundation component mixins with the rebind and
   the six controls driven as bare Foundation globals: 13 perturbations, six classes
   each, **zero change in every cell**. This is the **strong** form, not NF7's
   inertness restated: the controls are **live** at that level
   (`$global-radius: 6px` = +128 bytes) and still activate nothing.
3. **Statically** -- the transitive gate closure over all 109 rebind sites contains
   **none** of the six control names. Static and dynamic agree, so the verdict is
   not a value-sampling artefact.

**The radius worry does not land, and the reason is structural:** the radius-shaped
class is gated by a **boolean, not a radius** -- c3 = 0 / 20 for
`$buttongroup-radius-on-each` true/false, **identically** at `$global-radius` 0,
6px and 50% [T01 s1]. `$global-radius` can neither open nor close the gate.
[T02 s9] confirms from the mechanism side: Button's 5 direction-dependent
declarations are a `float` and two margins -- its radius sites are not directional
at all.

**The one thing to record next to R009's control table** [T01 s1.4]: the six
controls are safe for a **structural** reason, not a numerical one. They are all
*value* settings. Every setting measured to activate residue is a *shape* setting,
because activating residue requires changing which declarations are emitted.
Hence trigger 6.

map.md's Out-of-scope condition ("unless the sensitivity map shows one of the
addon's six controls activates residue") is **not triggered**. M002's D4
non-foreclosure list stands unchanged and its bill remains zero code plus one
README paragraph.

---

## 7. The rebind's disposition -- STAYS, Button only, by rule

**T14's D1b survives, on stronger grounds than it was written with.** The rebind
stays in `internal/_foundation-button.scss`. It is **not** replaced.

**What changed is the reason.** D1b was a judgement about scope; it is now a
consequence of C3: Button is not a special case, it is **the case that passes the
admission test**. [T02 s5.2] Today Button is the **only** component that passes --
`foundation-table` comes closest with 1 direction-dependent declaration, and it is
a `text-align`, i.e. a BROKEN class.

**The prohibition on lifting it into a shared partial survives and sharpens:**

> **The rebind must not be lifted into a shared partial, because "shared" is
> exactly the scope at which its precondition stops holding** [T02 s5.2].

That is now a mechanical statement, not a warning. A shared partial applies the
rebind to components whose C2 result is non-zero, which is the definition of
inadmissible. Getting it wrong spreads six defect classes across ~11 components
including 14 latent radius sites in `button-group` [T14 D4.6].

**Does Button eventually migrate to the twins? There is no correctness reason, and
there never will be one.** [T02 s5.2] For Button the rebind is strictly smaller
(3 valid declarations vs 4 twin rules and 6 declarations), strictly valid, and
strictly better supported (`css-logical-props` 136/136 vs `:dir()` 134/136).
Migration is **discretionary forever** -- available if the library later wants one
uniform mechanism for its own sake, never owed. If it is ever taken, C7's trigger 1
should have fired first, and C9 flips direction at the same moment (the twins make
Button emit `text-align`-shaped physical output that the parity gate's table would
falsely fail).

**One rider:** while the rebind remains anywhere, it depends on
`$global-left`/`$global-right`, which Foundation labels **"Internal variables"**
[T03 s6, V-SRC `_global.scss:126`]. That is an argument for the twins independent
of validity, and it is an argument about *stability*, not correctness -- Foundation
6.x has been stable here, so treat it as a preference for the public variable, not
a predicted break [T03 INFER].

---

## 8. Nothing silently vanishes -- accounting for tickets 01-03's hand-offs

| Hand-off | Landed as |
| --- | --- |
| T01/3 -- a gate must pin the component set | **C2.2** |
| T01/3 -- a gate must not compile `foundation-everything()` | **C2.3**, and extended to the settings surface's own gate (C5) |
| T01/3 -- per-class counts, never pass/fail | **C2.4** |
| T01/4 -- M002 clearance + the forward rule | **s6** and **trigger 6** |
| T02 -- the mechanism, `:where()`, element scoping, layer placement | **C3**, **C4** |
| T02 R2 -- the twin layer's build shape is the one surviving coupling | **C4** -- RESOLVED here: the settings surface forces option (b) |
| T02 R4 -- `$global-text-direction` gains a real implementation | **C7** |
| T02 R5 -- the parity gate becomes actively wrong under the twins | **C9** |
| T03/7.1 -- contract shape is "eliminate first" | **C1** |
| T03/7.2 -- the R022 feature gate | **C6** + **trigger 7** |
| T03/7.3 -- the `:dir()` disclosure, trigger as a version number | **C7** + **trigger 1** |
| T03/7.4 -- CSSOM tripwire, positive control, class-name parity | **C8**, **C2.5** |
| T03/7.5 -- mechanical "widest settings configuration" | **C2.1** |
| T15 NF1-NF7, Q6 items 2/3 | **C5** (inert tier, cascade restoration, the one-door finding in s2) |

Ticket 05 owns the map's three fog items (all three GRADUATED in map.md), the
`.gsd/` decision entries, the R004 staleness question, and C9's named owner.

---

## 9. VERIFIED vs INFERRED

### Carried, VERIFIED by execution in the cited ticket

Every quantity in this document -- the 0-invalid-across-8-configurations result,
the exact dual-build equivalence, the 0 computed-style diffs in both directions in
one document, the 36/56 rebind counts, the 22-source-site replication law, the
9/9 held-out prediction, the 24-configuration site completeness (8/8, 22/22, 14/14,
1/1, 11/11, 2/2), the non-monotonicity, the 15-of-498 gate closure, M002's three-way
clearance, the 2.8 s / 780 ms / 310 ms envelope costs, the +14.1% / +62% volume,
the BASE 1350/1344 ms reproductions, `:dir()` at 134/136 -- is [V-EXEC] or
[V-BROWSER] in T01, T02, T03, T14 or T15, cited inline. **Nothing was re-measured
here and nothing needs to be.**

### VERIFIED here by reading [V-REPO]

- `.browserslistrc` pins `baseline widely available on 2026-05-07` and its own
  header records the rolling query resolving to **chrome/edge 121** against the
  pin's **119**. This is C7's version-number trigger, read from the file rather
  than recalled.
- `scripts/verify-browserslist.mjs` is 36 lines and asserts only the query string
  and a non-empty resolution -- **no feature-vs-targets check anywhere**. C6 is a
  real gap, not a suspicion.

### DERIVED here (composed from cited measurements; not itself executed)

- **C5's core claim** -- that the admission test is settings-**independent**, so no
  key need be withheld. Composed from T03's site-completeness result plus T03's
  zero-new-sites result. Sound if both hold; both are [V-EXEC] there. **If the
  envelope is ever found incomplete for a new Foundation version, C5 weakens with
  it** -- which is trigger 5.
- **C4's forcing argument** -- that a live settings surface forbids a pre-generated
  twin blob. Composed from T02 R2 (Sass cannot rewrite selectors it did not author,
  [V-BROWSER]) plus the island idiom compiling Foundation inside the consumer's
  compilation ([V-SRC], T01 s2.1). The desynchronisation itself was **not staged**.
- **The refutation of option 2's settings axis** -- composed from T15's
  once-and-first hard errors plus T01's cross-component gate map. Both halves are
  [V-EXEC]; the degeneration argument is this ticket's.

### INFERRED, flagged -- the contract's unproven premises

- **That a hand-authored Sass twin partial actually tracks consumer settings**
  (C4's option (b)). [T02 INFER] -- it follows from the partial being Sass, but no
  such partial was written; writing 337 twin rows is the milestone's work.
  **This is the single most load-bearing unverified premise in the contract**,
  which is why trigger 3 exists with a measurable threshold (orphan twins > 0)
  rather than a rationale.
- **That the two-compile envelope stays complete as Foundation's component set
  grows.** [T03 INFER] -- complete over 24 configurations against the CURRENT tree,
  resting on T01's 15-name gate closure, itself INFER-flagged there (a guard driven
  by a value computed at runtime from a setting would evade both; none was found,
  none was proven absent). Trigger 5 covers it.
- **That the CSSOM tripwire fires on a real regression.** [T03 INFER] -- no
  generator regression was staged. C8's positive-control requirement is the
  mitigation, and the obligation in s4 makes staging one testable.
- **That "value settings are safe, shape settings are not" generalises beyond the
  13 measured.** [T01 INFER] -- a mechanism-level claim consistent with every
  measurement, not tested against the ~470 non-boolean settings individually.
  Trigger 6 is written as the mechanism test, not as the measured list.
- **That upstream labelling a variable "internal" implies a stability risk.**
  [T03 INFER] -- the label is [V-SRC]; that Foundation would change those two lines
  is a judgement. Treated in s7 as a preference, never as a predicted break.
