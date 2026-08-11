# Hand-off: the settings-migration surface and cross-component RTL

Closes the wayfinding map `.scratch/settings-rtl-coupling/map.md` (5 tickets, all
resolved). Written for **two future milestones** -- the Foundation
settings-migration surface (M002 ticket 15's named owner) and cross-component RTL
(M002 ticket 14's component-onboarding obligation) -- plus one correction to the
already-closed M002 hand-off.

**Read this file alone and you can plan either milestone.** Depth lives in
`research/01-settings-sensitivity-map.md`, `research/02-is-the-residue-eliminable.md`,
`research/03-can-a-consumer-dependent-defect-be-gated.md` and
`research/04-the-gating-contract.md` (the locked contract). Executable probes are in
`prototypes/`, captured output in `prototypes/out/run-*.txt`. Citations below use
**[T01]**-**[T04]** for this map's tickets and **[T14]**/**[T15]** for the closed
M002 map's research.

**Route-agnostic.** Everything in section 2 states what must END UP in `.gsd/`. It
does not matter whether a later session applies it through the `gsd-workflow` MCP
tools or through `/gsd` slash commands. `.gsd/` was **read-only** for this effort;
nothing under `packages/`, `apps/`, `scripts/`, `.storybook/` or repo config was
created, edited or deleted, and no file under
`.scratch/m002-storybook-theming-addon/` was touched.

---

## 0. One-paragraph summary for a planner who never read the map

The map existed to resolve a coupling stated in M002's hand-off section 8: a more
seamless Foundation settings surface would let consumers activate RTL defects that
are dormant at Foundation's defaults, so the settings milestone's success condition
looked like the RTL milestone's trigger, and no fixed-settings CI gate could bound
the class because the defect count depends on input this repo's CI never sees.
**The coupling is real, was measured in both halves, and then dissolved.** The
defects all originate in ONE mechanism -- R004's `$global-left`/`$global-right`
rebind -- and a different mechanism (**direction twins**: compile Foundation
unmodified twice at Sass time and emit both directions in one sheet under
`:where(:dir(ltr))` / `:where(:dir(rtl))`) eliminates all six defect classes by
construction, verified at 0 invalid declarations across 8 settings configurations
with 0 differing computed values against Foundation's own RTL build in real
Chromium [T02]. Because the unbounded defect magnitude turned out to be **pure
replication of a fixed set of 22 source sites**, a complete per-component admission
test is **two compiles**, not a settings grid [T03]. That test is
settings-**independent** even though the defect count is settings-dependent -- so
**no settings key is ever withheld on RTL grounds, and neither milestone waits for
the other.** M002's addon gets a **clean bill of health**, verified three ways
[T01].

---

## 1. THE CONTRACT

### 1.1 Shape, and the headline correction

> **Shape: ELIMINATION-FIRST, admitted per component by a mechanical test.**
>
> **The gate is NOT temporal.** Neither milestone waits for the other. What gates
> is a two-compile admission test on the **component** side; once it holds over the
> shipped component set, the settings surface is safe for **every** Foundation
> setting at **every** value, by construction.

Do not reintroduce a sequencing story. M002's hand-off section 8 carried one
("sequencing is a real constraint, not a preference") and it was correct on the
evidence available then; it is superseded -- see section 3.

Prevention, not detection, and not disclosure. Detection loses three times and
disclosure loses four times; both refutations are recorded in
`research/04-the-gating-contract.md` section 2 so nobody re-derives them. The short
form: detection is **unnecessary** (there is nothing left to detect), a cartesian
settings gate is the **wrong shape** (two of the activating settings are multipliers
with infinite domains), and disclosure is what the library does **today by
accident** -- [T15] measured a consumer pasting Foundation's entire 490-line
`_settings.scss` compiling clean and emitting byte-identical CSS with no warning.

### 1.2 The nine clauses

Each carries its measured ground and, where it can expire, a threshold or a version
number.

**C1 -- No settings-dependent RTL defect class may exist.** A component's
direction-dependent output is produced by a mechanism proved incapable of
synthesising a property name, value or class name that Foundation did not itself
emit. *Ground:* the direction-twin construction emits 0 invalid declarations across
8 settings configurations against the rebind's 36-56, with exact
declaration-level equivalence to Foundation's own RTL build and 0 differing computed
values in real Chromium in both directions in ONE document [T02 s1/s3.3]. The
guarantee is **structural, not sampled**: no new token is ever synthesised.

**C2 -- The admission test (the single gating artifact).** A component is
**ADMITTED** when it emits zero BROKEN-class declarations and zero renamed
Foundation public class names across the two-compile envelope. Five mandatory
properties, none of them a matter of taste:

1. **Two compiles, not a grid:** Foundation defaults, PLUS
   `$buttongroup-radius-on-each: false` with `$global-flexbox: false`. **Both are
   required and neither suffices.** *Ground:* the envelope is COMPLETE over source
   sites across 24 configurations (8/8, 22/22, 14/14, 1/1, 11/11, 2/2), because
   magnitude growth is pure replication -- all 1187 class-2 declarations at 48
   columns x 12 breakpoints come from the same **22 source sites** as the 98 at
   defaults, zero new sites in any class. Both compiles are needed because
   non-monotonicity holds at SITE level (class 1: 3 and 6 sites, 1 shared; class 5:
   8 and 6, 3 shared) [T03 s5].
2. **The test must pin the COMPONENT SET, not only the settings.** *Ground:* 36
   invalid vs 102 at identical settings, purely from which mixins are included
   [T01 s2.1].
3. **The test must NOT compile through `foundation-everything()`.** *Ground:* it
   executes `$global-flexbox: true !global`, silently overwriting the consumer's
   setting, so every `$global-flexbox`-gated site reports a false clean [T01 s2.1].
   **This constraint binds the settings surface's own gate too, not just the RTL
   one.**
4. **Per-class counts against a stated configuration, never a bare pass/fail.**
   *Ground:* three of the six classes can be masked to ZERO by a legitimate consumer
   setting (`$drilldown-arrows: false` -> c6=0,
   `$select-triangle-color: transparent` -> c4=0, `$breakpoint-classes: (small)` ->
   c2 98->48). **Absence of a class in one configuration is not evidence the class
   is fixed** [T01 s4.1].
5. **A validity oracle alone is insufficient** -- pair it with a class-name parity
   check. *Ground:* class 5 is valid CSS matching nothing and class 6 is a defect of
   **ABSENCE** (the rule and every declaration in it survive intact). A validity
   oracle sees only declarations that are PRESENT and rejected, so it is blind to
   both **by construction, not by bad luck** [T03 s4].

*Cost, so nobody prices it as expensive:* the envelope is 2x one compile -- ~780 ms
for `button-group`, ~310 ms for `menu`, ~2.8 s for the whole library, measured
interleaved and shuffled [T03 s5.1]. The refuted cartesian gate at the same rate is
**over 3 hours and still incomplete**.

**C3 -- Mechanism assignment is a rule, not a per-component judgement.**
**Direction twins by default. The rebind if and only if C2 returns zero for that
component. No third mechanism.** *Ground:* Button's whole direction-dependent
surface is 5 declarations in 4 rules, all in SAFE classes, so the rebind gives 3
valid declarations and ZERO twins where the twins would give 4 rules and 6
declarations plus a `:dir()` dependency [T02 s5.2]. Every other mechanism is closed:
no substitution value works (`start/end` 160 invalid, `inset-inline-*` 131), and a
**Sass mapping layer is impossible, not merely unattractive** -- the property name,
the value and the selector are all assembled by interpolation inside Foundation's
source, and the one hook that exists (post-`@import` mixin redefinition) reaches
exactly one of six classes [T02 s2/s2.1]. A post-process layer is closed by D021
(`styleUrl` leaves no library-controlled CSS artifact). **[T14]'s D1e hybrid is
refuted as stated and must not be resurrected:** the rebind that produces its
"logical properties where safe" is itself the sole source of all six defect classes.

**C4 -- The twin layer's BUILD SHAPE is forced by the settings surface.** Where a
component ships twins AND the settings surface is live, the twin layer must be
**authored in Sass**, mirroring Foundation's own `@if` guards. A twin layer
pre-generated at library build time and shipped as static CSS is **FORBIDDEN**.
*Ground:* Sass cannot rewrite selectors it did not author -- confirmed by the one
case where a hook exists, where `&:dir(rtl)` produced `...::after:dir(rtl)`, which
Chromium drops whole [T02 R2, V-BROWSER s2]. So the twins cannot be generated at
consumer compile time, leaving exactly two shapes: (a) pre-generated CSS, or (b)
hand-authored Sass. Foundation's partials compile INSIDE the consumer's compilation
under this library's island idiom, so base rules track consumer settings while a
pre-generated blob is keyed on the LIBRARY's settings; under a live settings surface
the two desynchronise, and a twin whose selector matches nothing is **invisible**,
which is this defect family's signature. Therefore (a) is incompatible with the
settings surface and (b) is the only shape left.

- **Machine-checkable form:** compile the library at any two settings
  configurations; the twin layer's selectors must be a **subset** of the base
  sheet's selectors. **Orphan twins > 0 is a failure.**
- **The twins MUST be emitted inside the same `@layer` as the rest of the library
  defaults.** Unlayered, they would compete with consumer theme rules on specificity
  and could win, inverting R008 [T02 s8].
- **`:where(:dir(...))`, element-scoped, appended to the last compound before any
  pseudo-element** -- never bare `:dir()`, never descendant-scoped. Bare `:dir()`
  with an appended layer produces **30 wrong computed values**; descendant scoping is
  wrong for a nested opposite-direction island [T02 s3.1, V-BROWSER s3/s4].
  `revert-layer` is a trap and the construction uses none.
- **C4 is the contract's single load-bearing INFER.** See section 5.

**C5 -- The settings surface is UNCONDITIONALLY open, with one prohibition.** No
Foundation setting is withheld on RTL grounds. Once C2 holds over the shipped
component set, every setting is safe at every value. The single prohibition: **no
published key may be live-and-unsafe.** A key may be inert (its component is not
shipped yet) or live-and-safe (its component is admitted); it may never be live and
able to activate a defect. *Ground:* [DERIVED] from the two-compile envelope's site
completeness plus the zero-new-sites result, so a component that emits zero
BROKEN-class declarations across the envelope emits zero for **any** settings
configuration -- **the admission test is settings-INDEPENDENT even though the defect
count is settings-dependent** [T03 s5]. That is what makes the surface safe without
a per-setting allowlist.

- *The inert tier is a real design seam, not a loophole:* a real Foundation name
  whose component does not exist yet errors today under both candidate mechanisms; a
  warn-and-ignore tier for known-Foundation-but-uncovered names is the settings
  milestone's decision. C5 only requires that whichever tier it picks never yields
  **silence** for a live key -- silence is the failure mode [T15 s4].
- *Sharp consequence for the settings milestone's own most consequential item:*
  restoring Foundation's derivation cascade is what makes a migrator's
  `$foundation-palette` edit do anything [T15 Q6 item 3]. C2.3 says the gate must
  not run through `foundation-everything()`; the same `!global` overwrite would
  corrupt a cascade-restoring settings surface itself.

**C6 -- The R022 feature gate (owed, currently absent).** Extend the browserslist
check to assert the CSS features the shipped mechanism uses against the **RESOLVED
targets**, not just the query string. Owed before the first component that emits a
`:dir()` selector ships. *Ground:* `scripts/verify-browserslist.mjs` is 36 lines and
asserts `config.includes('baseline widely available on 2026-05-07')` plus
`browserslist().length !== 0` -- **it checks no feature against any target**
[V-REPO, re-confirmed while writing this hand-off], so nothing in this repo would
notice `:dir()` failing 2 of 136. The feature matrix already exists as
`prototypes/rtl-baseline-support-probe.mjs`: `:dir()` 134/136; `:where()`, `@layer`,
`revert`, `css-logical-props` all 136/136. *Trigger to run it:* the library's built
CSS contains at least one `:dir(` occurrence -- a grep, not a judgement.

**C7 -- The `:dir()` disclosure. THE ONLY CLAUSE THAT CAN EXPIRE.** Disclose the
browser-support gap and which of [T02]'s three ways out is taken.

> **Expiry trigger: the pinned `.browserslistrc` query resolves to a chrome and edge
> floor of 120 or higher.** `:dir()` shipped in chrome/edge **120**. The pin
> `baseline widely available on 2026-05-07` floors at **119**, which is the entire
> cost. The file's own header records the **rolling** query resolving to chrome/edge
> **121** [V-REPO, re-confirmed]. So the drift is in the mechanism's favour and the
> next re-pin closes the clause automatically. **Check:** `browserslist()` returns no
> `chrome` or `edge` version below 120 -> delete C7.

The three priced ways out, so the choice is not re-derived [T02 s6.1]:

| option | exactness vs the dual build | chrome/edge 119 |
| --- | --- | --- |
| **A. Split twins** ([T02]'s recommendation) | **0 differing computed values** | 47 regressions in LTR |
| B. Graceful variant (LTR stays in the base rule, RTL twin only) | 32 differing computed values | **identical to today** |
| C. Bump the floor 119 -> 120 | 0 | the rolling baseline already delivers it |

**This disclosure is NOT a confession about invalid CSS.** It discloses a
browser-support gap in a mechanism this library chose [T03 s3].
`$global-text-direction` is disclosed alongside it and stays **accept-and-honour**
(D037), and under the twins it becomes genuinely meaningful for the first time:
compile one pass at the chosen direction and skip the twin layer, yielding a
smaller, `:dir()`-free sheet [T02 R4]. It is also **the only setting with an
upstream contract behind it** -- public and SassDoc'd, where
`$global-left`/`$global-right` are labelled **"Internal variables"**
(`_global.scss:126`) [T03 s6].

**C8 -- The CSSOM tripwire, re-purposed.** Keep the CSSOM validity check in the
existing `test-browser` lane as a regression tripwire on the GENERATOR's invariant
-- **not** as a settings gate. *Ground:* the guarantee is a property of the
generator, not of the emitted sheet, so a generator bug or a reintroduced rebind
breaks it silently [T03 s4]. The lane already exists (`ChromiumHeadless` over
`**/*.browser.spec.ts`) and the oracle is now measured, not inferred: it drops all
class 1-4 declarations at both the declaration and sheet level, with five valid
controls surviving. Two mandatory properties, each bought with a caught false
all-clear:

- **A positive control asserting a known-VALID declaration survived. The gate must
  abort without one.** `CSSStyleRule` has a `.cssRules` property and an empty
  `CSSRuleList` is **truthy**, so a natural `if (rule.cssRules) recurse` walk
  collects nothing and prints `[OK] ALL DROPPED` from a sheet it never examined.
- **Paired with a class-name parity check** (C2.5), or it certifies half the family.
  Note Chromium's CSSOM expands `border-width` into four longhands when enumerated.

*Do not narrow or remove the `test-browser` lane* [T14 D4.9].

**C9 -- `verify-foundation-parity.mjs` is MECHANISM-COUPLED.** Its translation
tables must not be propagated to any new gate, and its disposition has an owner and
two triggers. **See section 4 -- it is a deliverable of this hand-off, not a
footnote.**

### 1.3 The two obligations -- one testable sentence each, ONE artifact

> **Settings owes RTL:** *a CI gate that compiles the entire shipped component set
> at the two-compile envelope and reports per-class invalid-declaration counts,
> failing on any non-zero count in classes 1-4, on any renamed Foundation public
> class name, and on any orphan twin.*
>
> Testable by staging a regression: reintroduce the rebind for any non-admitted
> component and assert the gate fails; the CSSOM tripwire's positive control must
> also fail-closed when removed (C8).

> **RTL owes settings:** *every component it admits emits zero BROKEN-class
> declarations and zero renamed Foundation public class names across the two-compile
> envelope, so that no settings key ever has to be withheld.*
>
> Testable per component, in ~780 ms for `button-group` [T03 s5.1], against the
> probes already in `prototypes/`.

**They are discharged by the SAME artifact.** One gate, two owners: the settings
milestone builds and runs it; the component milestone satisfies it per component.
**That is why there is no ordering to negotiate.**

### 1.4 What each milestone must not do

Both milestones may start immediately and proceed in parallel. Today Button is the
only component in the shipped set and it **passes** C2 [T02 s5.2], so the settings
surface is already safe for every Foundation setting at every value. That
statement's ground is the test, **not** the component count: it holds for any set
whose members all pass.

| Milestone | Must not, until |
| --- | --- |
| **Settings** | ...ship a live key set before C2 is wired as a CI gate over the shipped component set (C2, C5). ...run any gate of its own through `foundation-everything()` (C2.3). ...publish a key that is live-and-unsafe; inert or live-and-safe only (C5). |
| **Component onboarding** | ...admit a component before C2 returns zero BROKEN-class declarations and zero renamed public class names (C2, C3). ...lift the rebind into a shared partial, ever (section 1.7). ...ship a pre-generated CSS twin blob while the settings surface is live (C4). ...emit a `:dir()` selector before C6 lands. |

**Both are cheap.** Every settings-side item is a property of a gate the settings
milestone needs anyway; every component-side item is a prohibition or a 2x-compile
check.

### 1.5 The triggers -- thresholds and version numbers only, never a judgement

| # | Trigger | Threshold / version | What it flips |
| --- | --- | --- | --- |
| **1** | `:dir()` enters the pinned baseline | pinned `.browserslistrc` resolves to **no chrome or edge below 120** (`:dir()` shipped in 120; the pin floors at 119; the rolling query already resolves to 121) | **Delete C7.** Option A becomes unconditional; the A/B choice disappears. |
| **2** | A component passes the admission test | **zero** BROKEN-class declarations AND zero renamed public class names across the two-compile envelope | That component may use the rebind instead of the twins (C3). Fires routinely; the contract's normal operation, not an exception. |
| **3** | A hand-authored Sass twin partial fails to track consumer settings | **orphan twins > 0** at any two settings configurations (C4) | C4's option (b) is refuted. Then either the settings surface withholds every shape setting in that component's gate closure, or the component is onboarded via the rebind (trigger 2). **This is the contract's one unproven premise -- see section 5.** |
| **4** | Sass gains selector rewriting | a Dart Sass release shipping a construct that transforms selectors generated by an `@include` (today: none) | The twins could be generated at consumer compile time; C4 collapses to a non-question. |
| **5** | Foundation's directional source changes | any `foundation-sites` version other than the pinned one, or any edit to `_global.scss:126-131` | Re-derive the 15-name gate closure and the two-compile envelope; the probes do it mechanically. Foundation is dead upstream at 6.9.0, so this is a dependency bump, not a forecast. |
| **6** | A new addon control is a SHAPE setting | the control's domain is a **boolean, keyword, count or map length** -- not a colour or a length | M002's clean bill of health (section 3) lapses and the addon is back in scope. The test is **"can it change WHICH rules are emitted?"**, never "is it a Foundation global?" |
| **7** | The library emits a `:dir()` selector | the built CSS contains `:dir(` | C6 is due. |
| **8** | Any component emits `text-align` from a directional site | count of directional `text-align` declarations > 0 | C9's disposition is due (section 4), in whichever direction that component's mechanism makes it wrong. |

**Deliberately NOT a trigger: emitted volume.** The twins cost **+14.1%**
library-wide and **+62%** for `button-group`, and compile time is
**indistinguishable from noise** (BASE 1350 ms; delta -4% to +7% with per-cell
spread wider than the between-condition medians; the generator is exactly one extra
pass at 1.9-2.1x) [T02 s7]. **No volume budget is written into this contract,
because any number chosen now would itself be the expiring premise this map exists
to prevent.** Volume is a reported quantity, not a gate. *Sizing note for planners:*
the library-wide average underestimates a small radius-heavy component by 4x.

### 1.6 One thing the settings milestone should not have to rediscover

**Per-component settings modules are a thing Sass cannot build.** `@use ... with
(...)` applies **once per module per compilation, and only before anything else has
loaded it** -- three verified hard errors: the same module configured twice,
configured after the library loaded it, and two consumer partials each configuring
it [T15 NF1/Q2]. N per-component settings modules means N `with` clauses each
subject to the once-and-first rule and each order-coupled to the others: a
combinatorial ordering contract for the consumer. The measured conclusion is **one
door, per-component contents**. Independently, the activating settings are
cross-component (`$global-flexbox` gates menu AND accordion-menu;
`$breakpoint-classes`/`$breakpoints`/`$grid-column-count` gate xy-grid position),
so a per-component settings gate degenerates to a library-wide one for exactly the
settings that matter [T01 s2.2].

### 1.7 The rebind's disposition -- STAYS, Button only, by rule

The rebind stays in `packages/ngx-foundation-sites/src/scss/internal/_foundation-button.scss`.
It is **not** replaced. What changed is the reason: D039's D1b was a judgement about
scope, and it is now a consequence of C3 -- **Button is not a special case, it is
the case that passes the admission test.** Today Button is the only component that
passes; `foundation-table` comes closest with 1 direction-dependent declaration, and
it is a `text-align`, i.e. a BROKEN class [T02 s5.2].

> **The rebind must not be lifted into a shared partial, because "shared" is exactly
> the scope at which its precondition stops holding.**

That is now a mechanical statement, not a warning. A shared partial applies the
rebind to components whose C2 result is non-zero, which is the definition of
inadmissible. Getting it wrong spreads six defect classes across ~11 components
including 14 latent radius sites in `button-group` [T14 D4.6].

**Does Button eventually migrate to the twins? There is no correctness reason, and
there never will be one.** For Button the rebind is strictly smaller (3 valid
declarations vs 4 twin rules and 6 declarations), strictly valid, and strictly
better supported (`css-logical-props` 136/136 vs `:dir()` 134/136). **Migration is
discretionary forever** -- available if the library later wants one uniform
mechanism for its own sake, never owed. If it is ever taken, trigger 1 should have
fired first, and C9 flips direction at the same moment (section 4).

**One rider:** while the rebind remains anywhere, it depends on
`$global-left`/`$global-right`, which Foundation labels **"Internal variables"**.
That is an argument for the twins independent of validity, and it is an argument
about *stability*, not correctness -- Foundation 6.x has been stable here, so treat
it as a preference for the public variable, not a predicted break [T03 INFER].

---

## 2. WHAT MUST END UP IN GSD

### 2.1 Decision-register entries

**Numbering.** `.gsd/DECISIONS.md`'s highest **landed** row is **D031** [VERIFIED
by reading the file while writing this hand-off]. **None of M002's proposed
D032-D040 has been applied yet.** M002's hand-off (section 3) proposes nine rows
D032-D040 plus one optional D041 (its R026-boundary split of D035 clause (f)). So:

> **Apply these four rows at the four next-free numbers AT APPLICATION TIME.**
> Primary assignment, assuming M002's nine land first and its optional split is not
> taken: **D041, D042, D043, D044.** If M002's optional D041 split IS taken, shift
> to **D042-D045**. If M002's hand-off has not been applied when these are written,
> they are **D032-D035** and M002's nine shift up. **The register is append-only --
> never edit or remove an existing row.**

**Columns, in order:** `# | When | Scope | Decision | Choice | Rationale | Revisable? | Made By`.
Rendered below as one bullet per column.

**Standing HUMAN decisions all four operate UNDER and none re-decides:**

- **D020** (SCSS-variable theming only; no CSS custom property theming *surface*).
  The direction twins add no theming surface at all -- they emit only property names
  and values Foundation itself emitted. [T14] established every D020 clause is
  scoped to the theming surface, so a direction *sign* custom property is not
  forbidden; under the twins none is needed, because the twins carry the values
  directly.
- **D022** (browser baseline pinned to Baseline "widely available" on 2026-05-07).
  This is the clause with real bite: the pin is the entire source of C7's cost, and
  C7's expiry trigger is stated as a version number against it. **The contract does
  not propose changing the pin** -- option C in C7's table is listed because the
  rolling query already delivers it, not as a request.
- **D023** (Foundation's default theme ships unchanged; the compliant theme and the
  axe proof are M002's). Untouched -- nothing in this contract alters a palette
  value or moves an axe scan.
- **D025** (no upstream reports filed for third-party defects, ever). Honoured:
  Foundation's total absence of settings/RTL documentation and its "Internal
  variables" labelling are recorded in `research/03-*.md` and go nowhere upstream.

---

#### Row A -- the sensitivity map, M002's clearance, and the shape-vs-value rule (ticket 01)

- **When:** settings-RTL-coupling wayfinding effort (`.scratch/settings-rtl-coupling/`), 2026-08-11
- **Scope:** architecture
- **Decision:** Which Foundation settings can activate the R004 rebind's RTL defect classes, whether M002's six addon controls are among them, and what test governs any control or key added later
- **Choice:** **M002's addon gets a CLEAN BILL OF HEALTH -- none of its six controls activates RTL residue in any of the six defect classes, at any value tested -- and no M002 decision is re-opened.** The forward rule that replaces case-by-case worry: **the test for any new addon control or published settings key is "can it change WHICH rules are emitted?", never "is it a Foundation global?"** *Value* settings (a colour, a length) are structurally safe; *shape* settings (a boolean, a keyword, a count, a map length) are the only ones that can activate residue, because activating residue requires changing which declarations are emitted. Recorded alongside: the activating set is **15 of 498 consumer-settable names (3.0%)**, of which **13** were measured to move a defect count; the class is **bounded in NAMES and UNBOUNDED in MAGNITUDE**, so a cartesian settings gate is the **wrong SHAPE, not merely too large**; and the class is **NOT monotone**. Three constraints bind any future gate: it must pin the **component set** as well as the settings, it must **not** compile through `foundation-everything()`, and it must report **per-class counts against a stated configuration**, never a bare pass/fail.
- **Rationale:** Verified three independent ways [V-EXEC]. (1) The shipped route -- the real public `theme()` chain, which already carries the rebind: `invalid=0`, all six classes zero, for every control and for all six together. (2) The maximal route -- all 41 Foundation component mixins with the rebind and the six controls driven as bare Foundation globals: 13 perturbations, six classes each, **zero change in every cell**. This is the strong form, not [T15] NF7's inertness restated: the controls are **live** at that level (`$global-radius: 6px` = +128 bytes) and still activate nothing. (3) Statically -- the transitive gate closure over all 109 rebind sites contains **none** of the six control names, so the verdict is not a value-sampling artefact. **The radius worry does not land for a structural reason:** the radius-shaped class is gated by a **boolean, not a radius** -- c3 = 0/20 for `$buttongroup-radius-on-each` true/false, **identically** at `$global-radius` 0, 6px and 50%. Unboundedness is exact rather than asserted: a fitted law `c2 = 2*cols*bps + bps + 23` predicted **9/9 held-out** combinations, giving 1187 invalid declarations at 48 columns x 12 breakpoints against 98 at defaults, and both inputs (`$grid-column-count`, `$breakpoints`) have infinite domains. Non-monotonicity is one compile: `$global-flexbox: false` **adds 4 class-1 defects while removing 7 class-5 defects**. Two measurement artefacts were caught that would each have faked a clean result -- `foundation-everything()` executing `$global-flexbox: true !global` (which silently overwrites a consumer's setting, hence the gate constraint), and 7 same-variable pairs corrupting an additivity test. Operates under D020/D022/D023/D025 and re-decides none of them.
- **Revisable?:** true
- **Made By:** agent

#### Row B -- the mechanism: direction twins eliminate all six classes (ticket 02)

- **When:** settings-RTL-coupling wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** Whether the settings-dependent RTL defect class can be **eliminated** (made structurally impossible, so consumer settings are safe by construction) rather than gated, and by which mechanism
- **Choice:** **ELIMINABLE, all six classes -- by the DIRECTION-TWIN construction, not by substitution and not by a mapping layer.** Compile Foundation **unmodified** twice at Sass time (once at `$global-text-direction: ltr`, once at `rtl`), diff the two outputs, and emit ONE sheet in which every direction-dependent declaration appears twice, once under `:where(:dir(ltr))` and once under `:where(:dir(rtl))`, **element-scoped** (appended to the last compound before any pseudo-element) and interleaved at its original position, **inside the same `@layer` as the rest of the library defaults**. Its defining property is the whole point: **every property name, value and class name it emits is one Foundation itself emitted**, so no consumer settings configuration can produce invalid CSS. **This is NOT a dual build** (one sheet, both directions, serving the shipped `Rtl` story). Three sub-choices are load-bearing and each was found by measurement: `:where()` not bare `:dir()`; element-scoped not descendant-scoped; twins not overrides-with-resets (`revert-layer` is a trap). **[T14]'s D1e hybrid is refuted as stated**, a **Sass mapping layer is impossible rather than unattractive**, and the rebind **stays for Button only, now by mechanical rule** (C3) -- with migration to the twins **discretionary forever**, never owed.
- **Rationale:** Verified by execution and confirmed in real Chromium 151. The emitted sheet has **0 invalid declarations** against the rebind's 36 at defaults and 56 with two legitimate settings flipped, with **exact declaration-level equivalence to Foundation's own RTL build (0 mismatches)** and **0 differing computed values in both directions side by side in ONE document**; Chromium drops 86 declarations from Foundation's own sheet, 86 from the eliminator's and 142 from the rebind's -- delta +0 vs +56. Across **8 settings configurations** the eliminator column is 0 throughout while the twin count moves with settings, which is the settings-dependence turned **benign**: more settings-activated directional output means more twins, never an invalid declaration. No substitution value can work, and the reason is structural and quantified -- the same variable is interpolated into five syntactically different positions and three of the six needed values are mutually exclusive with the other three (`start/end` 160 invalid, `inset-inline-*` 131, and the 2-D corner case reachable by none). The one Sass hook that exists (post-`@import` mixin/function redefinition, verified honoured) reaches exactly **one** of six classes, and its natural `&:dir(rtl)` emits `...::after:dir(rtl)`, which **Chromium drops whole** -- so **Sass cannot rewrite selectors it did not author**, the fact that forces C4. Naive placement was measured wrong (bare `:dir()` + appended layer = **30 wrong computed values**; descendant scoping breaks a nested opposite-direction island; `revert-layer` in an unlayered sheet rolls back **past the author origin**, giving 0px where the consumer set 77px). Cost: **compile time unchanged** (BASE 1350 ms, twins indistinguishable from noise, generator exactly one extra pass at 1.9-2.1x), emitted volume **+14.1%** library-wide and **+62%** for `button-group`, and one browser version (`:dir()` 134/136 pinned targets). R008 survives, and for a stronger reason than the measurement: cascade layers sort **above** specificity, and `:where(:dir())` adds no specificity at all. Operates under D019/D020/D021/D022/R004/R008 and reverses none of them; supersedes D039's D1e hybrid *recommendation* only, on measurement.
- **Revisable?:** true
- **Made By:** agent

#### Row C -- what "gated" means, and the two-compile envelope (ticket 03)

- **When:** settings-RTL-coupling wayfinding effort, 2026-08-11
- **Scope:** quality-attribute
- **Decision:** Whether a defect class whose count depends on consumer settings can be gated at all, and which of prevent / detect-in-our-CI / detect-in-theirs / disclose the library owes
- **Choice:** **"Gated" resolves to PREVENT. Detection is UNNECESSARY, not merely infeasible**, because prevention was proved (Row B). **Detect-in-THEIRS is DROPPED** -- never buildable and now pointless; a consumer-run validator dies with it (the published package ships `./scss/*` and `./css/*` and declares **no `bin`**, so it would have been a new artifact class with its own packaging and support burden). **Exactly two things are owed:** (1) a **feature-vs-baseline gate** extending `scripts/verify-browserslist.mjs` to assert CSS features against the RESOLVED targets (C6), and (2) a **disclosure narrowed to `:dir()`'s 2-of-136 gap and `$global-text-direction`'s status** (C7) -- never a confession about invalid CSS. The **CSSOM validity check is KEPT but re-purposed** as a regression tripwire on the generator's invariant, with a **mandatory positive control** and **paired with a class-name parity check** (C8). And the mechanical definition of "the widest settings configuration": **TWO COMPILES** -- Foundation defaults plus `$buttongroup-radius-on-each: false` with `$global-flexbox: false` -- both required, neither sufficient (C2.1).
- **Rationale:** The unbounded magnitude turned out to be **pure REPLICATION of a fixed site set**: all 1187 class-2 declarations at 48 columns x 12 breakpoints come from the same **22 source sites** as the 98 at defaults, with **zero new sites in any of the six classes** at either extreme -- so a complete onboarding test is two compiles, not a grid, and it is **COMPLETE over source sites across 24 configurations** (8/8, 22/22, 14/14, 1/1, 11/11, 2/2). Both compiles are needed because non-monotonicity holds at SITE level (class 1: 3 and 6 sites, 1 shared; class 5: 8 and 6, 3 shared). Measured cost: the admitting compile costs the same as the defaults compile within noise (+10%/+2%/-6% across library/`button-group`/`menu`, every cell's own spread wider than the between-condition difference), so the gate is **2x one compile -- ~2.8 s whole library, ~780 ms `button-group`, ~310 ms `menu`** against the refuted cartesian grid's **3+ hours, still incomplete**. The CSSOM oracle graduated from [INFER] to [V-BROWSER]: it drops all class 1-4 declarations at both the declaration and sheet level with five valid controls surviving, and it is **structurally blind** to class 5 (valid CSS matching nothing) and class 6 (a defect of ABSENCE) -- blind by construction, not by bad luck, hence the parity pairing. `verify-browserslist.mjs` was read and checks **no feature against any target** [V-REPO], so C6 is a real gap rather than a suspicion. **Foundation documents ZERO settings/RTL interaction anywhere** -- `$global-text-direction` appears exactly once in its whole shipped docs tree, `sass.md`/`global.md` have zero mentions of "direction", the settings template a consumer edits carries a bare uncommented line, the shipped `customizer/` has no direction handling, and `dir="rtl"` is documented as a JAVASCRIPT requirement -- so there is no upstream hazard to relay and this library's runtime single-sheet model sits **outside** Foundation's documented model, which the twins reconcile. Two contract facts fall out: **`.align-left`/`.align-right` ARE documented public direction-sensitive API** (`docs/pages/menu.md:49-53`, with `float-classes.md:16`, `tooltip.md:80`, `off-canvas.md:236`, `flex-grid.md:197`), so the rebind's rename **breaks a documented contract** and no validity oracle can see it; and `$global-left`/`$global-right` are labelled **"Internal variables"** (`_global.scss:126`), an argument for the twins independent of validity. Operates under D022/D025/R008/R022 and re-decides none.
- **Revisable?:** true
- **Made By:** agent

#### Row D -- the locked gating contract between the two milestones (ticket 04)

- **When:** settings-RTL-coupling wayfinding effort, 2026-08-11
- **Scope:** architecture
- **Decision:** How the Foundation settings-migration surface and the cross-component RTL strategy gate each other, so neither milestone can be planned in ignorance of the other
- **Choice:** **ELIMINATION-FIRST, admitted per component by a mechanical test -- and the gate is NOT TEMPORAL.** Nine clauses (C1-C9), two obligations and eight triggers, recorded in full in `.scratch/settings-rtl-coupling/HANDOFF.md`. **Neither milestone waits for the other and there is no ordering to negotiate**: what gates is the **two-compile admission test on the COMPONENT side**, and because that envelope is complete over source sites while magnitude growth adds none, a component that passes it is safe at **any** settings configuration -- so **no settings key is ever withheld on RTL grounds** (C5). **Both obligations are discharged by ONE artifact**: a CI gate over the shipped component set at the envelope, which the settings milestone builds and the component milestone satisfies per component. The sharp new clause is **C4: a live settings surface FORCES the twin layer to be hand-authored Sass**, since Sass cannot rewrite selectors it did not author and a pre-generated CSS blob is keyed on the library's settings while base rules track the consumer's -- **orphan twins > 0** is the machine-checkable failure. **Every trigger is a threshold or a version number**; the **only expiring clause is C7's `:dir()` disclosure -- delete it when the pin resolves to no chrome/edge below 120**; and **emitted volume is deliberately NOT a trigger**. **M002 is clean; the rebind stays for Button only and migrates never on correctness grounds.**
- **Rationale:** Every rejected shape loses on measurement, not preference. **Per-component coupling** loses on the SETTINGS axis (`@use ... with (...)` applies once per module per compilation and only before anything else has loaded it -- three verified hard errors -- so N per-component settings modules publish a combinatorial ordering contract; and the activating settings are cross-component, so a per-component gate degenerates into a library-wide one for exactly the settings that matter) while its component half **survives verbatim as C2 + C3**, now mechanical rather than a manual classification against a table. **Detection** loses three times: unnecessary (prevention proved), wrong shape (two multipliers with infinite domains), and incapable of reporting pass/fail (non-monotone, three classes maskable to zero). **Disclosure** loses four times: it is what the library does **today by accident** and [T15] named it the worst migration outcome (490 settings pasted, byte-identical output, no warning, `#ff0000` nowhere); there is **no upstream hazard to relay** (Foundation documents zero settings/RTL interaction); it means **shipping a documented-API break** (`.align-left`/`.align-right`); and Foundation is dead upstream at 6.9.0, so "accept and document" defers to a maintainer who will not fix it. The contract's own load-bearing assumptions are flagged rather than buried: **C5's settings-independence is [DERIVED]** from two [V-EXEC] results (site completeness plus zero-new-sites) and weakens with trigger 5 if the envelope is ever found incomplete for a new Foundation version; **C4's option (b) tracking consumer settings is the single [INFER]**, which is why trigger 3 is a measurable threshold rather than a rationale. Volume is excluded as a trigger on principle: any budget chosen now would itself be the expiring premise this map exists to prevent. Operates under D020/D022/D023/D025 and re-decides none of them; supersedes M002 hand-off section 8's sequencing claim (see section 3 of this hand-off), which no register row carries.
- **Revisable?:** true
- **Made By:** agent

### 2.2 Requirement-level statements

**Answer to the question the ticket asked: YES -- an existing requirement's text goes
stale the moment component #2 lands, exactly the way R003's Notes went stale for
M002.** It is **R004**, and the staleness is in its **Validation** field, not its
Description.

R004's Description ("Components support RTL/bidirectional layout, matching
Foundation's `$global-text-direction` behavior") is mechanism-neutral and stays
correct at any component count. Its **Validation** field is entirely Button's
mechanism, and three phrases in it go stale on component #2:

1. **"no `[dir]` selector, no `:dir()` specificity cost, no postcss-rtlcss, no
   dual-file mechanism"** -- the `[dir]`, rtlcss and dual-file halves stay true
   library-wide forever. The **"no `:dir()`"** half becomes false for any component
   admitted with twins. (The **specificity** half survives on its own terms:
   `:where(:dir())` contributes zero specificity, verified [T02 s8].)
2. **"the only genuinely directional declarations in the sheet"** (the dropdown
   arrow) -- true of Button's sheet, false of the library's the moment a second
   component ships.
3. The whole mechanism sentence describes `internal/_foundation-button.scss`, which
   C3 fixes as **Button-only, by rule**.

**What must end up in GSD, in two parts:**

**(a) A Notes-only amendment to R004. Status stays `validated`. Do NOT re-open it**
(M002's hand-off says the same, for its own reasons). Suggested Notes text to append:

> Scoped 2026-08-11 (settings-RTL-coupling wayfinding effort): R004's Validation
> text describes **Button's** mechanism and is Button-scoped by rule, not by
> accident. The `$global-left`/`$global-right` rebind is admissible for a component
> **if and only if** that component emits zero invalid direction-dependent
> declarations and renames no Foundation public class name across a two-compile
> envelope; Button is the only Foundation component that passes today, and
> `foundation-table` fails on a single `text-align`. The rebind must never be lifted
> into a shared partial. The "no `:dir()`" phrase records what was BUILT for Button,
> not a library-wide prohibition -- a `:where(:dir(ltr))`/`:where(:dir(rtl))`
> direction-twin construction is the default mechanism for every component that does
> not pass, it adds zero specificity, and using it needs no reversal of R004, D021 or
> D028. Cross-component RTL correctness is carried by its own requirement rather
> than by widening R004's proof; R004's substance for Button is unchanged and
> continues to hold.

**(b) ONE new requirement.** A new number is needed rather than a widened R004,
because R004 is `validated` against Button and a validated requirement must not
carry a not-yet-built CI gate as its validation. **Highest landed requirement is
R026, and M002's hand-off proposes no new requirement numbers [VERIFIED by reading
`.gsd/REQUIREMENTS.md` and M002's HANDOFF.md], so R027 is free and uncontested.**

> ### R027 -- Every shipped Foundation component's direction-dependent CSS is valid at any consumer settings configuration, and renames none of Foundation's documented public direction-sensitive class names
>
> - **Class:** quality-attribute
> - **Status:** active
> - **Description:** For every Foundation component the library ships, the emitted
>   CSS contains zero invalid direction-dependent declarations and zero renamed
>   Foundation public direction-sensitive class names, at **any** consumer settings
>   configuration -- so a consumer may set any Foundation setting to any value
>   without silently activating an RTL defect.
> - **Why it matters:** The defect count is a function of **consumer settings**, and
>   every failure mode in this family is **silent** (browsers discard unknown
>   properties and invalid values without error; a renamed class name is valid CSS
>   that matches nothing). Without this requirement the settings-migration surface's
>   success condition -- consumer settings actually taking effect -- is also the
>   trigger for a dormant defect class. It is the requirement that makes the
>   two-compile admission gate plannable, and it is what allows the settings surface
>   to publish every key unconditionally.
> - **Source:** agent (settings-RTL-coupling wayfinding effort,
>   `.scratch/settings-rtl-coupling/`)
> - **Primary owning slice:** the cross-component RTL / component-onboarding
>   milestone / none yet -- **satisfied jointly**: the settings milestone builds and
>   runs the gate, the component milestone satisfies it per component (one artifact,
>   two owners).
> - **Validation:** unmapped. The validation SHAPE is fixed and is not a matter of
>   taste: compile the **entire shipped component set** at the two-compile envelope
>   (Foundation defaults, plus `$buttongroup-radius-on-each: false` with
>   `$global-flexbox: false`), **not** through `foundation-everything()`, and report
>   **per-class** invalid-declaration counts against the stated configuration --
>   failing on any non-zero count in classes 1-4, on any renamed Foundation public
>   class name, and on any orphan twin. A validity oracle alone is insufficient: it
>   is structurally blind to the class-name rename and to the `css-triangle`
>   defect-of-absence, so a class-name parity check is mandatory, and the CSSOM
>   tripwire must carry a positive control or abort.
> - **Notes:** Measured ground, contract clauses and all eight triggers are in
>   `.scratch/settings-rtl-coupling/HANDOFF.md` (the contract) and
>   `research/01`-`04` (the evidence). Button already satisfies R027 under the
>   rebind; `foundation-table` would not.

**One requirement flagged, NOT a deliverable of this hand-off.** R020's Description
says the library "also ships precompiled default CSS (both LTR and RTL)". That
parenthetical is **already stale** -- the rtlcss dual-file build was deleted under
D021/D026 -- and it goes stale a second way under the twins, where ONE sheet serves
both directions. Out of scope here; noted so it is not discovered as a surprise.

---

## 3. THE M002 CORRECTION

### 3.1 M002 is CLEAN -- stated positively so a closed milestone is not left under suspicion

> **M002 is NOT implicated. None of the addon's six live controls
> (`$global-radius` plus the five `$foundation-palette` colours) can activate RTL
> residue in any of the six defect classes, at any value tested. No M002 decision is
> re-opened, and M002's D4 non-foreclosure list stands unchanged with its bill still
> at zero code plus one README paragraph.**

Verified **three independent ways** [T01 s1]: the shipped public `theme()` chain
(invalid=0, all six classes zero, per control and for all six together); the maximal
route (all 41 Foundation component mixins with the rebind, the six controls driven
as bare Foundation globals -- 13 perturbations x six classes, **zero change in every
cell**, with the controls provably **live** at that level: `$global-radius: 6px` =
+128 bytes); and statically (the transitive gate closure over all 109 rebind sites
contains **none** of the six names). Static and dynamic agree, so the verdict is not
a value-sampling artefact.

**The radius worry does not land, for a structural reason rather than luck:** the
radius-shaped class is gated by a **boolean, not a radius** -- c3 = 0/20 for
`$buttongroup-radius-on-each` true/false, identically at `$global-radius` 0, 6px and
50% -- and Button's five direction-dependent declarations are a `float` and two
margins, so its radius sites are not directional at all [T02 s9]. map.md's
Out-of-scope condition ("unless the sensitivity map shows one of the addon's six
controls activates residue") is **not triggered**.

**The one thing to record next to R009's control table:** the six controls are safe
for a **structural** reason, not a numerical one. They are all *value* settings.
Every setting measured to activate residue is a *shape* setting, because activating
residue requires changing which declarations are emitted. **A single boolean control
would put the addon back in scope** -- that is trigger 6, and it is why the forward
test is "can it change WHICH rules are emitted?" and never "is it a Foundation
global?".

### 3.2 Superseding note on M002 HANDOFF.md section 8

`.scratch/m002-storybook-theming-addon/HANDOFF.md` section 8 ("The cross-ticket
coupling neither ticket owns alone") is the passage that first stated this coupling.
**It was written before elimination was proven, and two of its four numbered
consequences are now wrong.** That map is CLOSED and its research documents record
what was found at the time; **this note is the correction, carried here.** Do not
edit M002's files.

**Its headline -- "A more seamless settings surface activates more latent RTL
defects" -- is true only of the REBIND mechanism, and only for a component that has
not passed the admission test.** Under the direction twins, more
settings-activated directional output means **more twins, never an invalid
declaration**, measured across 8 configurations at 0 invalid throughout [T02 s3.3].

| M002 s8 claim | Status | Correction |
| --- | --- | --- |
| **1. "Sequencing is a real constraint, not a preference."** A settings surface landing before the cross-component RTL strategy silently converts a dormant defect class into a live one. | **SUPERSEDED** | **There is no sequencing constraint. The gate is not temporal.** Both milestones may start immediately and run in parallel. What gates is the two-compile admission test on the COMPONENT side, and it is **settings-independent**: a component that passes emits zero broken declarations at any settings configuration, so **no settings key is ever withheld on RTL grounds** (C5). The premise was sound on 2026-08-11's evidence; it was invalidated by [T02] (elimination) plus [T03] (envelope completeness), not by re-argument. |
| **2. "No fixed-settings gate is sufficient. Any RTL validity gate must be able to run under consumer-supplied settings."** | **SUPERSEDED -- the premise survives, the inference does not** | The premise (the defect count depends on consumer settings) is **confirmed and sharpened**: 15 activating names, 13 measured to move a count, magnitude unbounded by an exact fitted law. But the inference is **false**, because the unbounded growth is **pure replication of a fixed 22-site set** -- zero new source sites in any class at either extreme. So a **fixed-settings gate of exactly TWO compiles IS sufficient and complete over source sites** (24 configurations: 8/8, 22/22, 14/14, 1/1, 11/11, 2/2), and the gate **never needs to see consumer settings**. Two constraints M002 could not have known do bind it: it must pin the component set (36 vs 102 invalid at identical settings), and it must not compile through `foundation-everything()` (the `$global-flexbox: true !global` overwrite). |
| **3. "This strengthens D039's constraint against lifting the rebind into a shared partial."** | **SURVIVES, and sharpens** | It is no longer a warning about blast radius but a **mechanical consequence** of C3: a shared partial applies the rebind to components whose admission-test result is non-zero, which is the definition of inadmissible. "Shared" is exactly the scope at which the rebind's precondition stops holding. |
| **4. "It also strengthens D040's constraint 5 (no piecemeal `!default` on `internal/_settings.scss`)."** | **HALF SUPERSEDED** | The stated reason -- "partial configurability would activate latent sites with no key validation" -- is **void for admitted components**, since no setting can activate a defect once C2 holds. The constraint itself **survives on its other, stronger grounds**: `@use ... with (...)` applies once per module per compilation and only before anything else has loaded it (three verified hard errors), so a half-shipped surface publishes an ordering contract every later addition inherits, and C5's one prohibition (**no published key may be live-and-unsafe**; silence is the failure mode) is what replaces the RTL-activation argument. |

**Also worth carrying forward from M002, uncorrected:** section 5.3's latent
under-import defect (the three-`@import` island is under-imported for **emission** --
`menu` needs sassy-lists' `sl-remove()`, `dropdown-menu`/`tooltip` need
`typography/typography`; +8 ms of floor to fix; trigger is the **2nd themeable
module**). It is untouched by this contract and matters here for one reason: the
same three-`@import` shape is `verify-foundation-parity.mjs`'s fixed reference
island, which is section 4's second trigger.

**M002 action: still none in code.** Its ticket-14 hybrid *recommendation* (D1e) is
refuted as stated by [T02], and its ticket-14 D1b (the rebind stays, Button only) is
**upheld on stronger grounds**. Nothing M002 shipped or decided needs to change.

---

## 4. `verify-foundation-parity.mjs` -- DISPOSITION, OWNER, TRIGGERS

`packages/ngx-foundation-sites/scripts/verify-foundation-parity.mjs` is wired as a
`dependsOn` of `ngx-foundation-sites:lint`, so it runs on every lint. **It is
mechanism-coupled and wrong in both directions.** Confirmed by reading the file
while writing this hand-off [V-REPO], which sharpened the fault beyond what C9
recorded:

**Direction 1 -- under the REBIND, it BLESSES the worst defect class.**
`PHYSICAL_TO_LOGICAL_VALUE` (lines 63-66) maps `left -> inline-start` /
`right -> inline-end`, and `DIRECTIONAL_VALUE_PROPERTIES` (line 67) is
`{float, clear, text-align}`. Both sides of the comparison are normalised through
`toLogicalSheet` (lines 283-284), so the gate asserts `text-align: inline-start` is
the correct logical form of `text-align: left`. **It is not** -- `text-align` takes
`start`/`end`, so the blessed form is invalid and browsers drop it. The mapping is
correct for `float` and `clear` (both accept `inline-start`/`inline-end`) and wrong
**only** for `text-align`. Harmless today because Button emits no `text-align`.

**Direction 2 -- under the TWINS, it produces a FALSE FAILURE, and the fault is
bigger than the table.** Check 4 (lines 416-435) runs on the RAW component output
and **fails on any physical directional property or value**: any of
`margin-left`/`margin-right`/`padding-left`/`padding-right` at a non-zero value
(via `PHYSICAL_TO_LOGICAL_PROPERTY`, lines 57-62), or `left`/`right` as the value of
`float`/`clear`/`text-align`. A twin sheet emits exactly Foundation's physical
declarations byte for byte -- **that is the mechanism's entire guarantee** -- so
Check 4 rejects the whole construction, not just its `text-align`. **Check 4 is
mechanism-coupled at the check level, not merely at the table level.**

**Owner: the milestone that admits component #2** (cross-component RTL /
component-onboarding). Not the settings milestone: the fault is a property of the
RTL mechanism a component chooses, and the gate's own reference island
(`FOUNDATION_REFERENCE`, lines 42-50) is the Button-only three-`@import` island.
Not this map: the map ruled the fix out of scope, and that ruling stands (section 6).

**Triggers -- both thresholds, neither a judgement:**

| # | Threshold | Consequence |
| --- | --- | --- |
| **T-a** (= contract trigger 8) | count of directional `text-align` declarations emitted by any shipped component > 0 | The table's wrongness becomes live. Under the rebind it blesses an invalid declaration; under the twins Check 4 falsely fails a byte-exact match. |
| **T-b** | `FOUNDATION_REFERENCE`'s island covers more than one component (component count > 1) | The tables and Check 4 are applied to declarations Button never produced, so they must be corrected **before** that gate extension lands. This is also the moment M002 s5.3's under-import defect bites the same island. |

**Interim disposition: do NOT fix it now, and do NOT propagate it.** Nothing in the
shipped sheet reaches either fault, and a speculative rewrite would be keyed to a
mechanism choice that has not been made for component #2. **C9's prohibition is the
part that binds today: neither table, nor Check 4's shape, may be copied into any
new gate** -- specifically not into the admission gate of section 1.3, which
measures validity with a spec lexer and the browser's CSSOM, never with a
hand-written physical-to-logical table.

**The minimal fix, recorded so the owner does not re-derive it** (two lines, and one
of them serves BOTH mechanisms):

1. **Remove `text-align` from `DIRECTIONAL_VALUE_PROPERTIES` (line 67)**, leaving
   `{float, clear}`. That alone retires direction 1 -- `float`/`clear` are the only
   two properties for which the `left -> inline-start` mapping is valid. If a
   component ever legitimately emits logical `text-align`, give it its own map to
   `start`/`end` rather than reusing the shared one.
2. **Gate Check 4 on the component's declared mechanism.** A rebind component must
   fail on physical directional output (today's behaviour, correct for Button); a
   twin component must **assert the opposite** -- physical output matching Foundation
   byte for byte, with the direction split carried by `:where(:dir())` twins whose
   selectors are a subset of the base sheet's (C4's orphan-twin check).

---

## 5. VERIFIED BY EXECUTION vs INFERRED

Much of this effort's value is that its claims were **measured**, not argued. Keep
the distinction legible; do not let planning promote anything below the second
heading to settled.

### 5.1 VERIFIED by execution / in real Chromium

Every quantity in this hand-off is [V-EXEC] or [V-BROWSER] in `research/01`-`03` (or
in the closed M002 map's `research/14`-`15`), with the probe named and the output
captured in `prototypes/out/run-*.txt`. The load-bearing ones:

- **0 invalid declarations from the direction-twin sheet across 8 settings
  configurations**, against the rebind's 36 (defaults) and 56 (two legitimate
  settings flipped); **exact declaration-level equivalence to Foundation's own RTL
  build**, 0 mismatches every time.
- **0 differing computed values** vs the dual build, in BOTH directions, side by side
  in ONE document, in real Chromium 151. Naive control: 30 wrong values.
- Chromium-dropped declarations: rebind 142, Foundation 86, eliminator 86 -- delta
  **+56 vs +0**.
- **`.x::after:dir(rtl)` is dropped whole; `.x:dir(rtl)::after` is kept.**
  Element-scoped `:dir()` is correct for a nested opposite-direction island;
  descendant-scoped is wrong. `revert-layer` in an unlayered sheet rolls back past
  the author origin (0px where the consumer set 77px).
- **The replication law:** `c2 = 2*cols*bps + bps + 23`, fitted on 12 points,
  **9/9 held-out** predictions exact; 1187 invalid declarations at 48 columns x 12
  breakpoints against 98 at defaults; **zero new source sites** in any class at
  either extreme.
- **Two-compile envelope completeness across 24 configurations:** 8/8, 22/22, 14/14,
  1/1, 11/11, 2/2. Site-level non-monotonicity (class 1: 3 and 6 sites, 1 shared;
  class 5: 8 and 6, 3 shared) is why both compiles are required.
- **Non-monotone in one compile:** `$global-flexbox: false` adds 4 class-1 defects
  and removes 7 class-5 defects. Three classes maskable to zero by legitimate
  settings.
- **15 of 498 consumer-settable names** in the transitive gate closure over 109
  rebind sites; **13** measured to move a defect count; a brute-force flip of all 31
  booleans in Foundation's template found no others.
- **M002's three-way clearance** (shipped route, maximal route, static closure), with
  the controls provably live at raw-Foundation level.
- **Costs:** envelope 2.8 s / 780 ms / 310 ms; BASE compile 1350 ms and 1344 ms on
  two independent code paths (reproducing [T13]'s 1.2-1.4 s ceiling); twins
  indistinguishable from noise; generator exactly 1.9-2.1x; volume +14.1% library-wide
  and +62% for `button-group`.
- **`:dir()` 134/136 pinned targets**; `:where()`, `@layer`, `revert`,
  `css-logical-props` all 136/136. On a simulated `:dir()`-less engine the split
  twins cost 47 regressed computed values in LTR; the graceful variant costs 0, at 32
  values of RTL inexactness.
- **The CSSOM oracle** drops all class 1-4 declarations at both the declaration and
  sheet level with five valid controls surviving, and is structurally blind to
  classes 5 and 6.
- **Foundation's docs:** `$global-text-direction` appears exactly once in the whole
  shipped tree; `sass.md`/`global.md` have zero mentions of "direction"; the
  `customizer/` has no direction handling; `.align-left`/`.align-right` are
  documented public direction-sensitive API; `_global.scss:126` labels
  `$global-left`/`$global-right` "Internal variables".

### 5.2 VERIFIED by reading a tracked file [V-REPO], re-confirmed for this hand-off

- **`.gsd/DECISIONS.md`'s highest landed row is D031**; `.gsd/REQUIREMENTS.md`'s
  highest is **R026**. Neither M002's proposed D032-D040/D041 nor any new
  requirement number has been applied.
- **`.browserslistrc`** pins `baseline widely available on 2026-05-07` and its own
  header records the rolling query resolving to **chrome/edge 121** against the pin's
  **119**. This is C7's version-number trigger, read from the file rather than
  recalled.
- **`scripts/verify-browserslist.mjs` is 36 lines** and asserts only the query string
  and a non-empty resolution -- **no feature-vs-targets check anywhere**. C6 is a real
  gap, not a suspicion.
- **`verify-foundation-parity.mjs`**: lines 57-62 (`PHYSICAL_TO_LOGICAL_PROPERTY`),
  63-66 (`PHYSICAL_TO_LOGICAL_VALUE`), 67 (`DIRECTIONAL_VALUE_PROPERTIES` includes
  `text-align`), 283-284 (both sides normalised), 416-435 (Check 4 fails any physical
  directional output), 42-50 (the Button-only three-`@import` reference island). See
  section 4.

### 5.3 DERIVED -- composed from cited measurements, not itself executed

- **C5's core claim**, that the admission test is settings-**independent** so no key
  need be withheld. Composed from the site-completeness result plus the
  zero-new-sites result; both are [V-EXEC]. **If the envelope is ever found
  incomplete for a new Foundation version, C5 weakens with it** -- that is trigger 5.
- **C4's forcing argument**, that a live settings surface forbids a pre-generated
  twin blob. Composed from "Sass cannot rewrite selectors it did not author"
  ([V-BROWSER]) plus the island idiom compiling Foundation inside the consumer's
  compilation ([V-SRC]). **The desynchronisation itself was not staged.**
- **The refutation of per-component coupling on the settings axis.** Both halves are
  [V-EXEC] (the once-and-first hard errors; the cross-component gate map); the
  degeneration argument is composed.

### 5.4 INFERRED -- the contract's unproven premises, flagged

- **That a hand-authored Sass twin partial actually tracks consumer settings**
  (C4's option (b)). It follows from the partial being Sass, but **no such partial
  was written** -- authoring ~337 twin rows is the milestone's work. **This is the
  single most load-bearing unverified premise in the contract**, which is exactly why
  trigger 3 exists as a **measurable threshold (orphan twins > 0)** rather than as a
  rationale. If it fires, the fallback is stated and needs no new decision: either
  the settings surface withholds every shape setting in that component's gate
  closure, or the component is onboarded via the rebind under trigger 2.
- **That the two-compile envelope stays complete as Foundation's component set
  grows.** Complete over 24 configurations against the CURRENT tree, resting on the
  15-name gate closure, itself INFER-flagged: a guard driven by a value computed at
  runtime from a setting would evade both the static walk and the brute-force sweep.
  None was found; none was proven absent. Trigger 5 covers it.
- **That the CSSOM tripwire fires on a real regression.** No generator regression was
  staged. C8's positive-control requirement is the mitigation, and the settings-owes-RTL
  obligation makes staging one testable.
- **That "value settings are safe, shape settings are not" generalises beyond the 13
  measured.** A mechanism-level claim consistent with every measurement, not tested
  against the ~470 non-boolean settings individually. Trigger 6 is written as the
  mechanism test, not as the measured list.
- **That upstream labelling a variable "internal" implies a stability risk.** The
  label is [V-SRC]; that Foundation would change those two lines is a judgement.
  Treated as a preference for the public variable, never as a predicted break.
- **That `$breakpoints` and `$grid-column-count` are unbounded "in practice".** Their
  domains are unbounded by construction and the law was confirmed to 12 breakpoints
  and 48 columns; how far a real consumer goes is a judgement. The refutation of a
  cartesian gate does not depend on it.

### 5.5 Measurement traps found, carried because they are REUSABLE

Any future probe or gate in this repo can hit these. Each one produced a plausible
wrong answer before it was caught.

1. **`foundation-everything()` silently overwrites `$global-flexbox`.** It executes
   `$global-flexbox: true !global` when its `$flex` argument is true (the default),
   so measured through that entry point `$global-flexbox: false` is
   **byte-identical** -- which reads as "inert" and is not. Through per-component
   includes the same setting activates 4 class-1 defects and masks 7 class-5 defects.
   **Any gate compiling `foundation-everything()` reports a false clean on every
   `$global-flexbox`-gated site.** This is C2.3, and it binds the settings surface's
   own gate too.
2. **An empty `CSSRuleList` is truthy, so a CSSOM recursion examines nothing while
   printing `[OK]`.** `CSSStyleRule` has a `.cssRules` property (CSS Nesting), so the
   natural `if (rule.cssRules) recurse; else collect` walk recurses past every style
   rule and collects **nothing** -- reporting `0 rules kept` and four `ALL DROPPED`
   lines from a sheet where nothing was examined. **Any CSSOM gate must carry a
   positive control asserting a known-VALID declaration survived, and must abort
   without one.** Related: Chromium's CSSOM expands `border-width` into four
   longhands when enumerated, so a detector written against SOURCE text reports 0 in
   the CSSOM view for a reason unrelated to browser behaviour.
3. **Declaration-order timing artefacts -- caught TWICE, independently.** An
   unshuffled run of the twins' cost probe reported a spurious uniform **+2%**; the
   shuffled run reported **-1%**. An unshuffled run of the envelope's cost probe on
   the whole-library cell alone would have reported **"+10% for the admitting
   compile"**; the sign flip at `menu` (-6%) is what exposed it as noise. **Interleave
   and shuffle every (condition, target, replicate) triple with a seeded
   Fisher-Yates, warm up outside the measurement, report medians, and compare each
   cell's own min..max spread against the between-condition difference before
   believing any delta.** This is the same artefact class [T13] caught in the M002
   map -- three sightings now.
4. **Same-variable pairs invalidate an additivity test.** The first pairwise run
   reported 19 non-additive pairs of 78; seven were two perturbations of the **same**
   variable, where the later declaration simply wins, so the prediction is
   meaningless. Corrected figure: 12 non-additive of 71 valid pairs, all involving
   `$breakpoint-classes`. **Skip same-variable pairs explicitly and report the skip
   count.**
5. **An intra-file guard walk misses guards around the `@include`.** The first gate
   walk missed `$accordionmenu-arrows`, whose `@if` sits around the mixin's
   `@include` 51 lines from the declaration. The transitive-closure probe and an
   independent brute-force boolean sweep both catch it, and they agree -- **which is
   the only reason the 15-name closure is trustworthy.**

---

## 6. FOG CHECK

### 6.1 "Not yet specified" -- CONFIRMED EMPTY

All three items charted as fog GRADUATED, each into a research document and then into
a contract clause. Nothing silently vanished; nothing new opened.

| Fog item at charting time | Graduated by | Where it landed |
| --- | --- | --- |
| Whether the class-rename defect is settings-dependent | **[T01] s6** -- YES, but only **downward** and only via `$global-flexbox` (13 -> 6 selectors), never breakpoint-multiplied. Worse than first stated: the rebind removes **BOTH** `.align-left` and `.align-right`. One of three "maskable-only" classes whose maximum IS the default. | C2.5 (a validity oracle cannot see it, so a class-name parity check is mandatory) and, via [T03] s6, the finding that these are **documented public API** -- which is why disclosure loses (contract section 2). |
| Whether elimination costs compile time | **[T02] s7** -- it does **NOT**. BASE 1350 ms (reproducing [T13]'s 1.2-1.4 s ceiling); the twins are indistinguishable from noise; the generator costs exactly one extra pass. Volume rises +14.1% library-wide, +62% for `button-group`. | The "volume is deliberately NOT a trigger" ruling (section 1.5) plus the sizing note for planners. |
| What Foundation's own docs claim about the settings/RTL interaction | **[T03] s6** -- **NOTHING, anywhere.** `$global-text-direction` appears exactly once in the whole shipped docs tree; `sass.md`/`global.md` have zero mentions of "direction"; the settings template carries a bare uncommented line; `customizer/` has no direction handling; `dir="rtl"` is documented as a **JavaScript** requirement, so upstream has no runtime CSS direction contract at all. | C7 (the disclosure is this library's own, not a relayed upstream hazard) and the two contract facts: `.align-left`/`.align-right` are documented public API, and `$global-left`/`$global-right` are labelled "Internal variables". |

**No new fog was opened by tickets 04 or 05.** Everything either landed in a clause,
carries a threshold trigger, or is explicitly flagged as [INFER] in section 5.4 with
the threshold that would refute it.

### 6.2 "Out of scope" -- STILL ACCURATE after the contract landed

| Out-of-scope entry | Still accurate? |
| --- | --- |
| **Designing or building either milestone.** | **YES.** This hand-off states obligations, triggers and one gate's required properties. It designs neither milestone: it does not author the twin partial (~337 rows, explicitly the milestone's work and the contract's one INFER), does not choose the settings surface's key-validation tier (C5 names it as the settings milestone's decision), and does not pick between C7's options A/B/C. |
| **Re-opening M002's closed decisions**, unless a control activates residue. | **YES, and the condition was tested and NOT triggered.** The sensitivity map cleared all six controls three ways (section 3.1). One M002 *recommendation* is refuted on measurement ([T14]'s D1e hybrid) and one is upheld on stronger grounds (D1b), but no M002 decision is re-opened -- and the correction to M002's hand-off section 8 is carried **here**, not by editing the closed map. Trigger 6 is the standing re-entry condition. |
| **Dual-build RTL**, ruled out by a shipped artifact. | **YES, and the ruling is now doubly safe.** The `Rtl` story renders `dir="ltr"` and `dir="rtl"` in ONE document and asserts mirroring between them; no dual build can serve it. The direction twins are **not** a dual build -- they use two Sass passes only as the source of truth for what differs and emit ONE sheet, verified serving a mixed-direction document. Do not resurrect the dual build. |
| **Fixing `verify-foundation-parity.mjs`'s blessed defect class** -- real, known, harmless today, belonging to whichever milestone first emits the affected declarations. | **YES, and it now has a NAMED OWNER and TWO THRESHOLD TRIGGERS instead of being folklore** (section 4). The scope ruling is unchanged: this effort did not fix it, and the fix is still owned by the milestone that admits component #2. What changed is that the fault is fully characterised in both directions and the minimal fix is written down. |

---

## 7. Where the evidence lives

| Path | What |
| --- | --- |
| `.scratch/settings-rtl-coupling/map.md` | The map: destination, standing constraints, decisions-so-far, fog. |
| `.scratch/settings-rtl-coupling/research/01-settings-sensitivity-map.md` | Which settings activate residue, by how much; M002's three-way clearance; the growth law; monotonicity and additivity. |
| `.scratch/settings-rtl-coupling/research/02-is-the-residue-eliminable.md` | The direction-twin mechanism, class by class; why no substitution or mapping layer works; cost; R008; the `:dir()` residue priced three ways. |
| `.scratch/settings-rtl-coupling/research/03-can-a-consumer-dependent-defect-be-gated.md` | What "gated" means; the two-compile envelope and its cost; the CSSOM oracle measured; Foundation's own documentation. |
| `.scratch/settings-rtl-coupling/research/04-the-gating-contract.md` | **The locked contract** -- nine clauses with grounds, why each rejected shape loses, the obligations, the trigger table, the VERIFIED/INFERRED split. |
| `.scratch/settings-rtl-coupling/prototypes/` | 14 read-only probes, reusable. `rtl-eliminator.mjs` is the mechanism; `gate-site-coverage.mjs` the envelope's completeness; `rtl-baseline-support-probe.mjs` the feature matrix C6 needs; `gate-closure.mjs` the transitive settings closure. |
| `.scratch/settings-rtl-coupling/prototypes/out/run-*.txt` | Captured output for every quantity cited here. |
| `.scratch/m002-storybook-theming-addon/HANDOFF.md` | The closed M002 hand-off. **Section 8 is superseded by section 3.2 above; sections 5.3, 6.4 and 6.5 remain live inputs.** Do not edit. |
