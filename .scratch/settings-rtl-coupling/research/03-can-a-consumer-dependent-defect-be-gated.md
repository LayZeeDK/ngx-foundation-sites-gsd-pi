# Can a consumer-settings-dependent defect be gated at all?

Resolves ticket `.scratch/settings-rtl-coupling/issues/03-can-a-consumer-dependent-defect-be-gated.md`.
Status: **resolved** (AFK -- no human in the loop, per map.md Notes).

Nothing outside `.scratch/` was created, edited or deleted. No `research/*.md` under
`.scratch/m002-storybook-theming-addon/` was touched. Three new read-only probes in
`.scratch/settings-rtl-coupling/prototypes/`:

| file | what it does |
| --- | --- |
| `gate-site-coverage.mjs` | source-map attribution of every defect to its Foundation `file:line`, across 24 settings configurations |
| `cssom-oracle-probe.mjs` | the CSSOM validity oracle in real Chromium, sheet-level and declaration-level, with a positive control |
| `cssom-shorthand-check.mjs` | isolates one false-all-clear artefact the main probe hit |
| `gate-cost.mjs` | the two-compile envelope's cost, 3 targets x 2 conditions x 7 replicates, interleaved and shuffled |

**Evidence key.** **[V-EXEC]** executed here, output quoted. **[V-BROWSER]** executed
in real Chromium via the repo's own Playwright. **[V-SRC]** read from shipped
`node_modules`. **[V-REPO]** read from a tracked file. **[V-PRIOR]** carried from
ticket 01 or 02, cited. **[INFER]** reasoned, flagged.

---

## 1. The verdict, up front

> **No gate is needed for the six defect classes, because ticket 02 eliminated
> them. Detection is not merely infeasible -- it is UNNECESSARY.** The
> direction-twin construction synthesises no new property name, value or class
> name, so no consumer settings configuration can produce invalid CSS by
> construction [V-PRIOR: ticket 02, 0 invalid declarations across 8 configurations,
> exact dual-build equivalence every time].
>
> **Exactly one risk survives, and it is not a settings risk at all.** `:dir()`
> fails **2 of the 136** targets the pinned R022 `.browserslistrc` resolves to
> (chrome/edge 119) [V-PRIOR: ticket 02 s6]. That is a **browser-support**
> question, bounded by a version number rather than by consumer input.
>
> **Two things are owed, and only two:**
>
> 1. **A feature-vs-baseline gate.** Verified here: `scripts/verify-browserslist.mjs`
>    asserts the query STRING and a non-empty resolution, and checks **no CSS
>    feature against the resolved targets** [V-REPO, 36 lines]. So nothing in this
>    repo would notice `:dir()` failing 2 of 136. This is the one place a real gate
>    is still warranted, and it is an extension of an existing gate rather than a
>    new class of artifact.
> 2. **A disclosure**, narrowed: it is now about `:dir()` support and
>    `$global-text-direction`, never about invalid CSS.
>
> **Everything else is closed.** A cartesian-product gate is the wrong shape
> (ticket 01), a consumer-run validator is unnecessary (nothing left to validate),
> and the CSSOM check survives only as a cheap **regression tripwire** on the
> generator's invariant -- valuable, but for a different reason than ticket 14 gave
> it (s4).

---

## 2. Option by option, with the finding that decides each

| Option | Verdict | Decided by |
| --- | --- | --- |
| 1. Cartesian-product gate over a bounded set | **WRONG SHAPE, not merely too large** | Ticket 01: the two multipliers have infinite domains, so no finite product covers them. Not costed further, per instruction. |
| 2. A validator the consumer runs | **UNNECESSARY, so never priced** | Ticket 02: invalid CSS is impossible by construction, so there is nothing for a consumer-side validator to find. Recorded for the record: the published package ships `./scss/*` and `./css/*` with **no `bin`** [V-REPO, `packages/ngx-foundation-sites/package.json`], so it would have been a new artifact class with its own packaging and support burden -- a cost now avoided rather than paid. |
| 3. CSSOM validity in `test-browser` | **KEEP, re-purposed as a regression tripwire** | Graduated from [INFER] to [V-BROWSER] here (s4). Does NOT generalise to arbitrary consumer settings -- and no longer needs to. |
| 4. Documented limitation plus runtime warning | **REPLACED by prevention, except for `:dir()` support** | Ticket 02 answers "prevent". The residual disclosure is the browser-support one. |

**Why detection would have been unattractive even as a fallback**, stated once so
nobody reopens it: ticket 01 measured the magnitude as unbounded (1187 invalid
declarations at 48 columns x 12 breakpoints against 98 at defaults, from an exact
fitted law confirmed on 9/9 held-out points) and **non-monotone** (`$global-flexbox:
false` adds 4 class-1 defects while removing 7 class-5 defects in one compile). A
gate over that space could never report a pass/fail, only per-class counts against
a stated configuration. Elimination removes the need to try.

---

## 3. What "gated" means here -- DECIDED

Four different products. The migration-seamlessness constraint demands the first,
and it is now delivered.

| Meaning | Status |
| --- | --- |
| **Prevent** (defects structurally impossible) | **DELIVERED for all six classes** by the direction-twin construction. This is what seamlessness demands: a consumer must be able to set any legitimate Foundation setting without activating a silent defect. |
| **Detect in OUR CI** | **Narrowed to two cheap checks**: the feature-vs-baseline gate (s1 item 1) and the CSSOM regression tripwire (s4). Neither bounds a settings space; both guard an invariant. |
| **Detect in THEIRS** | **DROPPED.** It was never buildable and is now pointless. |
| **Disclose** | **STILL OWED, and narrowed** to `:dir()`'s 2-of-136 gap and `$global-text-direction`'s status. It is no longer a confession about invalid CSS -- which is what ticket 15 named the worst outcome for migration. |

**The obligation for the R022 residue is a GATE plus a DISCLOSURE, not nothing.**
The gate because it is machine-checkable and currently unchecked (s1 item 1); the
disclosure because ticket 02's three ways out are a real choice a consumer's own
support floor bears on. Ticket 02 priced them: split twins (exact, 47 LTR
regressions on chrome/edge 119), the graceful variant (0 regressions, 32 values of
RTL inexactness), or a one-version floor bump the ROLLING baseline already delivers
(chrome/edge 121 vs the pin's 119) [V-PRIOR]. **The drift is in the mechanism's
favour, so the cheapest honest position is: gate the feature set, disclose the gap,
and let the pin's next revision close it.**

---

## 4. Does the CSSOM check retain value? YES -- and for a different reason

**The guarantee is a property of the GENERATOR, not of the emitted sheet.** A
generator bug, or a reintroduced rebind, breaks it silently -- and silence is this
whole defect family's signature. So the tripwire is worth keeping, at zero new
dependencies, in the `test-browser` lane that already runs real Chromium
[V-REPO: `project.json`'s `test-browser` target, `ChromiumHeadless`,
`**/*.browser.spec.ts`].

**The oracle works. Graduated from ticket 14's [INFER] to measured** [V-BROWSER]:

```
  [DROPPED ]  text-align: inline-start                      c1
  [DROPPED ]  inline-end: 5px                               c2
  [DROPPED ]  border-top-inline-start-radius: 0             c3
  [DROPPED ]  background-position: inline-end -1rem center  c4
  [SURVIVED]  margin-inline-start / float: inline-start / border-start-start-radius
              / inset-inline-end / text-align: start        (5 valid controls)

  sheet-level (CSSStyleSheet.replaceSync + walk cssRules), rebind sheet:
    c1  3 -> 0 survived   c2  98 -> 0 survived   c3  20 -> 0 survived   c4  1 -> 0 survived
```

Both mechanics agree: declaration-level `setProperty` read-back and sheet-level
`replaceSync` both drop exactly classes 1-4.

**Its blind spot is structural, and it is wider than ticket 14 said.** Class 5 is
valid CSS matching nothing -- measured surviving: **8 `.*-inline-start/-end` class
selectors** at defaults, 6 with the admitting settings [V-BROWSER]. Class 6 is a
defect of **ABSENCE** (no `border-color`, no zeroed side); the rule and every
declaration in it survive intact [V-BROWSER, `cssom-shorthand-check.mjs`]. **A
validity oracle can only see declarations that are PRESENT and rejected, so it is
blind to class 6 by construction, not by bad luck.** Pair the tripwire with a
class-name parity check or it certifies half the family.

> **[WARN] TWO FALSE ALL-CLEARS CAUGHT, recorded so they are not repeated.** Both
> produced "0 survived", which reads as "the browser dropped every defect".
> **(a)** `CSSStyleRule` has a `.cssRules` property (CSS Nesting) and an empty
> `CSSRuleList` is **truthy**, so the natural `if (rule.cssRules) recurse; else
> collect` walk recurses past every style rule and collects nothing -- the first run
> reported `0 rules kept` and four `[OK] ALL DROPPED` lines from a sheet where
> nothing had been examined. **Any CSSOM gate must carry a positive control
> asserting a known-VALID declaration survived.** The probe now aborts without one.
> **(b)** Chromium's CSSOM **expands `border-width` into four longhands** when
> enumerated, so a class-6 detector written against the SOURCE text reports 0 in the
> CSSOM view for a detector reason unrelated to browser behaviour.

---

## 5. The conditional the ticket asked for -- resolved, not conditional

The ticket asked whether PARTIAL elimination would flip an infeasible gate into a
cheap one, on the reasoning that the "maskable-only" trio (classes 4, 5, 6) is the
shape a fixed-settings gate can bound. **Elimination turned out to be TOTAL, so the
partition never has to be used defensively.** It survives as one useful thing:

**A measured law that makes ticket 02's onboarding test mechanical.** Ticket 02's
s5.2 rule says use the rebind for a component **iff** 100% of its sites are in the
SAFE classes, "proved by compiling that component ... at the widest settings
configuration". That phrase needed a definition, and this is it [V-EXEC,
`gate-site-coverage.mjs`]:

```
Q1. Does MAGNITUDE growth introduce NEW SOURCE SITES?
  c2_bareSidePositioning   defaults 98 decls / 22 sites  ->  48x12  1187 decls / 22 sites   NEW SITES: none
  c1, c3, c4, c5, c6       identical site sets at both extremes                             NEW SITES: none

Q2. Is a TWO-compile gate complete over source sites? (oracle = 24 configurations,
    including both multipliers at the extremes, all masks, and the kitchen sink)
  c1  8/8   c2  22/22   c3  14/14   c4  1/1   c5  11/11   c6  2/2      [OK] COMPLETE
```

> **The unbounded magnitude is pure REPLICATION of a fixed site set.** All 1187
> declarations at 48 columns x 12 breakpoints come from the same 22 source sites as
> the 98 at defaults. So "the widest settings configuration" is not a product over
> 15 settings -- it is **two compiles**: Foundation defaults, plus
> `$buttongroup-radius-on-each: false` with `$global-flexbox: false`. Both are
> required and neither suffices, because non-monotonicity shows up at SITE level
> too: for class 1, defaults reach 3 sites and the admitting compile reaches 6, with
> only 1 shared; for class 5, 8 and 6 with 3 shared [V-EXEC, Q4].

The site inventory reproduces ticket 14's independent source-site classification
exactly -- 22 bare-side sites, 14 button-group radius sites, 1 `_select.scss:45`,
8 `text-align` sites, 2 drilldown triangles -- which calibrates this probe against
the prior measurement rather than replacing it.

### 5.1 What the envelope COSTS -- measured, because it is not ticket 02's quantity

Ticket 02 measured the MECHANISM (BASE / REBIND / TWINS / GENERATOR), all at
Foundation's **default** settings. The envelope's second compile runs at the
**admitting** settings, and `$global-flexbox: false` sends Foundation down
different branches -- so "2x a single compile" was an assumption, not a
measurement. Measured, 3 targets x 2 conditions x 7 replicates, all 42 runs
interleaved and shuffled [V-EXEC, `gate-cost.mjs`]:

```
                 A defaults      B admitting     B - A            GATE TOTAL
  whole library  1344 ms         1475 ms         +131 ms (10%)     2819 ms
  button-group    387 ms          395 ms           +8 ms  (2%)      782 ms
  menu            160 ms          151 ms           -9 ms (-6%)      312 ms
```

> **The admitting compile costs the same as the defaults compile, within noise.**
> The difference straddles zero (+10%, +2%, -6%) and every cell's own spread is
> wider than the between-condition difference (whole library A: 1303..1501, a
> 198 ms spread against a 131 ms difference). **So the gate is 2x one compile:
> ~780 ms for `button-group`, ~310 ms for `menu`, ~2.8 s for the whole library.**

Two things worth recording:

- **Had this been run unshuffled on the whole-library cell alone, "+10% for the
  admitting compile" is exactly the finding it would have produced** -- the same
  artefact class ticket 02 caught as a spurious uniform +2%. The sign flip at
  `menu` is what exposes it as noise.
- **A defaults = 1344 ms independently reproduces ticket 02's 1350 ms and ticket
  13's 1.2-1.4 s ceiling**, on a third code path. The compile-cost fog item stays
  graduated where ticket 02 left it; nothing here moves it.

For contrast, the refuted option 1 at this measured rate: 8192 cells x 1344 ms is
**over 3 hours**, and still incomplete over the two infinite-domain multipliers.

---

## 6. What Foundation's own documentation says -- the map's fog item, GRADUATED

> **Foundation documents RTL as a BUILD-TIME choice and documents ZERO interaction
> between any other setting and RTL. `$global-text-direction` appears exactly ONCE
> in its entire shipped documentation tree.** [V-EXEC, `rg` over
> `node_modules/foundation-sites/docs/`, exit 0 with matches; V-SRC `docs/pages/rtl.md`]

`docs/pages/rtl.md` is 45 lines and says three things: add `dir="rtl"` to `<html>`
"to get the Javascript components working"; if you use the CSS build, "create a
custom download that includes RTL CSS instead of LTR"; if you use Sass, set
`$global-text-direction: rtl`, which "will convert the framework's components to RTL
format."

**The three other places a migrating consumer would look, all checked:**

| Where | What it documents about settings/RTL |
| --- | --- |
| `settings/_settings.scss:97` -- the file a consumer actually EDITS | `$global-text-direction: ltr;` as a **bare line with no comment**, in a flat list between `$global-menu-nested-margin` and `$global-flexbox` [V-SRC] |
| `_global.scss:106-108` -- the SassDoc source of truth | Three facts, and that is the entire upstream description: *"Sets the text direction of the CSS. Can be either `ltr` or `rtl`. @type Keyword"* [V-SRC] |
| `docs/pages/sass.md`, `docs/pages/global.md` | **Zero** occurrences of "direction" in either [V-EXEC, `rg -c` returned no count lines] |
| `customizer/` as shipped | **No direction handling at all** -- `rg -i 'direction\|rtl'` over the whole directory returns only unrelated `exportList` lines [V-EXEC, exit 0]. `rtl.md`'s "select Right-to-left under the Text Direction section of the customizer" refers to the hosted web customizer, not to anything in the package |

**And the sharpest single line upstream, which changes how the two mechanisms
compare** [V-SRC, `_global.scss:126-131`]:

```scss
// Internal variables used for text direction
$global-left: if($global-text-direction == rtl, right, left);
$global-right: if($global-text-direction == rtl, left, right);
```

> **Foundation explicitly labels the rebind's hooks INTERNAL.** The R004 rebind
> works by overwriting `$global-left` / `$global-right` -- variables upstream
> declares internal and does not document as a public surface. The direction-twin
> construction depends only on `$global-text-direction`, which is public,
> SassDoc'd, and documented. **That is an independent argument for the twins that
> has nothing to do with validity:** the rebind builds on an undocumented internal
> upstream has no obligation to keep stable, and the twins do not.

Four consequences for the migration contract:

1. **There is no upstream settings/RTL contract to be seamless WITH.** Not one
   setting is documented as interacting with direction. So this map's coupling is
   not a documented upstream hazard a consumer could have read about -- which is
   precisely why disclosure (s3) is owed rather than optional.
2. **`dir` is documented as a JavaScript concern; CSS direction is Sass-time.**
   Foundation's documented model has no runtime-direction contract for CSS at all.
   This library's single-sheet runtime approach is therefore **outside** Foundation's
   documented model, and the direction-twin construction is the thing that
   reconciles them -- it uses Foundation's own two Sass passes as the source of
   truth and serves both directions at runtime.
3. **`.align-left` / `.align-right` ARE documented public, direction-sensitive
   API.** `docs/pages/menu.md:49-53`: "each item in the menu aligns to the left.
   They can also be aligned to the right with the `.align-right` class ... In a
   right-to-left environment, items align to the right by default, and the class
   `.align-left` can be used to reverse direction." Also `flex-grid.md:197`
   ("`.align-[dir]`"), and `float-classes.md:16`, `tooltip.md:80`,
   `off-canvas.md:236` all documenting that "left always means left" in RTL.
   **This upgrades class 5 from "silently stops matching" to "breaks a DOCUMENTED
   upstream public API".** Ticket 02 eliminates it, and this is the measure of what
   the rebind would have cost.
4. **The one setting that IS documented is the one the mechanism keeps.**
   `$global-text-direction` is public and SassDoc'd; the rebind hooks are labelled
   internal. So the twins are the mechanism that stays inside upstream's documented
   surface, and ticket 14's D2 ("accept and honour") is the only clause here with an
   upstream contract behind it.

Suggested replacement for the map's fog entry:

> **RESOLVED (ticket 03).** Foundation documents RTL in one 45-line page
> (`docs/pages/rtl.md`) as a BUILD-TIME choice -- a separate CSS download, or
> `$global-text-direction: rtl` -- and that variable appears **exactly once** in its
> whole shipped docs tree. **No settings/RTL interaction is documented anywhere**:
> not in `sass.md` or `global.md` (zero mentions of "direction"), not in the
> settings template a consumer edits (a bare uncommented line), and the shipped
> `customizer/` has no direction handling at all. Upstream's entire description of
> the variable is one SassDoc line. `dir="rtl"` is documented as a JAVASCRIPT
> requirement, so upstream has **no runtime CSS direction contract** -- this
> library's single-sheet approach is outside the documented model, which the
> direction twins reconcile by using Foundation's own two passes as the source of
> truth. Two contract facts fall out: `.align-left`/`.align-right` ARE documented
> direction-sensitive public API (`menu.md:49-53`), so the rebind's rename broke a
> documented contract rather than an inferred one; and `$global-left`/`$global-right`
> are labelled **"Internal variables"** (`_global.scss:126`), so the rebind builds on
> an undocumented internal while the twins depend only on the public variable.

---

## 7. What this hands ticket 04

1. **The contract shape is "eliminate first", not "open settings with detection".**
   Options 3 and 4 of ticket 04's list are refuted by ticket 02; option 1 is
   available.
2. **One gate to specify, and it is not an RTL gate**: extend the R022 check to
   assert the CSS features the mechanism uses against the RESOLVED targets, not just
   the query string. Currently unchecked [V-REPO].
3. **One disclosure to specify**: `:dir()`'s 2-of-136 gap plus which of ticket 02's
   three ways out is taken. This is the only clause that can expire, so write the
   trigger as a version number (chrome/edge 120) rather than a rationale.
4. **One tripwire to keep**: the CSSOM validity check in `test-browser`, with a
   mandatory positive control, paired with a class-name parity check because it is
   structurally blind to classes 5 and 6.
5. **A mechanical definition of "the widest settings configuration"** for ticket
   02's per-component onboarding test: two compiles, complete over sites (s5).

---

## 8. VERIFIED vs INFERRED

**VERIFIED by execution here [V-EXEC]:**

- Magnitude growth introduces **zero** new broken source sites in any of the six
  classes: 98 -> 1187 class-2 declarations from the same 22 sites at 48 columns x 12
  breakpoints. The unbounded law is pure replication.
- A **two-compile** envelope (defaults + `$buttongroup-radius-on-each: false` with
  `$global-flexbox: false`) covers **every** broken source site reached by 24
  settings configurations: 8/8, 22/22, 14/14, 1/1, 11/11, 2/2.
- Both compiles are required; non-monotonicity holds at site level (class 1: 3 and 6
  sites, 1 shared; class 5: 8 and 6 sites, 3 shared).
- The site inventory reproduces ticket 14's independent source-site classification
  (22 / 14 / 1 / 8 / 2 sites, same files and lines).
- Foundation's shipped docs tree mentions `$global-text-direction` exactly once
  (`docs/pages/rtl.md:41`) and documents no settings/RTL interaction. `sass.md` and
  `global.md` contain zero occurrences of "direction"; the shipped `customizer/` has
  no direction handling.
- **The envelope's ADMITTING compile costs the same as the defaults compile, within
  noise**: +10% / +2% / -6% across whole library / `button-group` / `menu`, with
  every cell's own spread wider than the between-condition difference. Gate totals
  2819 / 782 / 312 ms. 42 runs, interleaved and shuffled, 7 replicates per cell.
- The whole-library defaults compile at **1344 ms** independently reproduces ticket
  02's 1350 ms and ticket 13's 1.2-1.4 s ceiling on a third code path.

**VERIFIED in real Chromium [V-BROWSER]:**

- The CSSOM oracle drops **all** class 1-4 declarations, at both the declaration
  level (`setProperty` read-back) and the sheet level (`replaceSync` + `cssRules`),
  with five valid controls surviving. Ticket 14's [INFER] is graduated.
- Class 5 selectors survive (8 at defaults, 6 with the admitting settings) and the
  degenerate class-6 rule survives with every declaration intact -- the oracle is
  structurally blind to both.
- `CSSStyleRule.cssRules` exists and an empty `CSSRuleList` is truthy, so a naive
  recursion collects nothing and reports a **false all-clear**.
- Chromium's CSSOM expands `border-width` to four longhands when enumerated.

**VERIFIED by reading [V-REPO / V-SRC]:**

- `scripts/verify-browserslist.mjs` (36 lines) asserts only the pinned query string
  and a non-empty resolution -- **no feature-vs-targets check**.
- `.browserslistrc` pins `baseline widely available on 2026-05-07` and its own header
  records the rolling query resolving to chrome/edge 121 against the pin's 119.
- `project.json`'s `test-browser` target runs `ChromiumHeadless` over
  `**/*.browser.spec.ts` -- the lane the tripwire needs already exists.
- The published package exports `./scss/*` and `./css/*` and declares no `bin`.
- `docs/pages/menu.md:49-53` documents `.align-right` / `.align-left` as public,
  direction-sensitive classes; `float-classes.md:16`, `tooltip.md:80`,
  `off-canvas.md:236`, `flex-grid.md:197` carry the same contract.
- `_global.scss:106-108` is upstream's entire description of
  `$global-text-direction` (one SassDoc line, `@type Keyword`);
  `settings/_settings.scss:97` carries it as a bare uncommented line.
- `_global.scss:126` labels `$global-left` / `$global-right` **"Internal variables
  used for text direction"** -- the rebind overwrites undocumented internals, the
  twins do not.

**INFERRED, flagged:**

- That the two-compile envelope stays complete as Foundation's component set grows.
  It is complete over 24 configurations against the CURRENT tree and rests on ticket
  01's 15-name gate closure, itself [INFER]-flagged there. A new Foundation version
  adding a gated directional site would need the envelope re-derived -- which the
  probe does mechanically.
- That extending `verify-browserslist.mjs` is the right home for the feature check
  rather than a new script. A placement judgement; the check itself is measured and
  ticket 02's `rtl-baseline-support-probe.mjs` already implements it.
- That the CSSOM tripwire's value survives elimination. Reasoned from the guarantee
  being a generator property rather than a sheet property; no generator regression
  was staged to prove the tripwire fires.
- That upstream labelling a variable "internal" implies a stability risk. The label
  is [V-SRC]; that Foundation would actually change those two lines is a judgement.
  Foundation 6.x has been stable here, so treat it as an argument for preferring the
  public variable, not as a predicted break.
