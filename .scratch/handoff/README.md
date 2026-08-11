# Hand-off index: M002 and the deferred milestones

This folder is a **derived synthesis** of two closed wayfinding efforts. It exists
so a planner can pick up either body of work from one place, without reading two
maps and reconciling them.

**Read this file first, then exactly one of:**

| File | For |
| --- | --- |
| `M002/HANDOFF.md` | Planning and executing **M002** (the Storybook theming addon). |
| `M002/REGISTER-TEXT.md` | The M002 text to **write into GSD**: the R009 and R021 replacements, the fourteen decision-register rows, R027, and R004's Notes amendment. |
| `deferred/HANDOFF.md` | Planning the **Foundation settings-migration surface** and the **cross-component RTL / component-onboarding** milestone. |

**M002 is two files only because one file exceeded ~1000 lines.** They share one
section numbering, so every cross-reference resolves in either direction;
`M002/HANDOFF.md` opens with the local index that says which section is where.
Treat them as one hand-off -- the boundary in section 3 below is folder-level.

Nothing of substance appears in both folders. Section 3 below is the manifest that
proves it.

**Route-agnostic.** Everything here states what must END UP in `.gsd/`. It does not
matter whether a later session applies it through the `gsd-workflow` MCP tools or
through `/gsd` slash commands.

**Do not edit `.gsd/` by hand.** Those files are projected from a database.

---

## 1. Provenance

Two efforts, both **CLOSED**, both committed. Their folders are the historical
record and **must not be modified**. This synthesis derives from them; where the
two disagree, section 2 states which version survives.

| Effort | Folder | Produced | Status |
| --- | --- | --- | --- |
| **M002: Storybook theming addon** | `.scratch/m002-storybook-theming-addon/` | `map.md`, `research/01..10` + `research/12..15`, `HANDOFF.md` (1283 lines). 15 tickets: 01-11 resolved the map, 12-15 were correction tickets landing under two standing user instructions. | Closed. Its `HANDOFF.md` is itself a regeneration from the corrected decision set, carrying a 19-row supersession ledger. |
| **Settings seamlessness vs latent RTL defects** | `.scratch/settings-rtl-coupling/` | `map.md`, `research/01..04`, `prototypes/` (14 read-only probes) + `prototypes/out/run-*.txt`, `HANDOFF.md` (883 lines). 5 tickets, all resolved. | Closed. Started as a fresh effort against a coupling M002's hand-off section 8 flagged but neither of its tickets owned. |

**Citation convention used throughout this folder.** `[T01]`-`[T04]` are the
coupling effort's research documents; `[T05]`, `[T13]`, `[T14]`, `[T15]` etc. are
M002's research documents by number. `[VERIFIED]` / `[V-EXEC]` / `[V-BROWSER]` /
`[V-REPO]` / `[V-SRC]` mark claims that were executed or read from shipped source;
`[DERIVED]` marks a claim composed from cited measurements; `[INFERRED]` / `[INFER]`
marks a claim that was reasoned but not executed. **Preserve that distinction during
planning** -- much of both efforts' value is that their claims were executed rather
than argued.

**Two standing user instructions are BINDING on everything here:**

1. `ngx-foundation-sites` must support **ALL** Foundation for Sites components.
   Button is merely the first, not the scope.
2. Migrating SCSS settings from Foundation for Sites must be **as seamless as
   possible**, preferring modern Sass modules (`@use`) over Foundation's legacy
   global-`!default` idiom where possible.

No "one component" premise survives as a live rationale anywhere in this folder.
Where a decision holds only at today's scale, the **threshold that changes it** is
written down instead.

---

## 2. Supersession map

**Rule for readers and for planners: only the corrected version appears in the body
text of either hand-off.** Superseded claims were deleted rather than restated. This
table is the sole record that they existed, so a reader returning to the source
research is not misled by finding them there.

### 2.1 Cross-effort -- the coupling effort correcting M002

| Superseded claim | Where it lives in the record | Corrected position (which survives) |
| --- | --- | --- |
| **M002 hand-off s8 consequence 1: "Sequencing is a real constraint, not a preference."** A settings surface landing before the cross-component RTL strategy silently converts a dormant defect class into a live one. | M002 `HANDOFF.md` s8 | **SUPERSEDED. There is no sequencing constraint; the gate is NOT temporal.** Both milestones may start immediately and run in parallel. What gates is the two-compile admission test on the COMPONENT side, and that test is settings-INDEPENDENT: a component that passes emits zero broken declarations at any settings configuration, so **no settings key is ever withheld on RTL grounds** (C5). The premise was sound on the evidence available then; it was invalidated by [T02] (elimination proved) plus [T03] (envelope completeness), not by re-argument. |
| **M002 hand-off s8 consequence 2: "No fixed-settings gate is sufficient."** Any RTL validity gate must be able to run under consumer-supplied settings. | M002 `HANDOFF.md` s8 | **SUPERSEDED -- premise survives, inference does not.** The premise (defect count depends on consumer settings) is confirmed and sharpened: 15 activating names, 13 measured to move a count, magnitude unbounded by an exact fitted law. The inference is **false**, because the unbounded growth is **pure replication of a fixed 22-site set** -- zero new source sites in any class at either extreme. A fixed-settings gate of exactly **TWO compiles** is sufficient and complete over source sites, and it **never needs to see consumer settings**. Two constraints M002 could not have known do bind it (pin the component set; do not compile through `foundation-everything()`). |
| **M002 hand-off s8 consequence 3:** strengthens the constraint against lifting the rebind into a shared partial. | M002 `HANDOFF.md` s8 | **SURVIVES and sharpens.** No longer a warning about blast radius but a **mechanical consequence** of C3: a shared partial applies the rebind to components whose admission-test result is non-zero, which is the definition of inadmissible. |
| **M002 hand-off s8 consequence 4:** strengthens D040 constraint 5, because "partial configurability would activate latent sites with no key validation". | M002 `HANDOFF.md` s8 | **HALF SUPERSEDED.** The stated reason is **void for admitted components** -- no setting can activate a defect once C2 holds. The constraint survives on its other, stronger ground: `@use ... with (...)` applies once per module per compilation and only before anything else has loaded it (three verified hard errors), so a half-shipped surface publishes an ordering contract every later addition inherits. C5's one prohibition (no published key may be live-and-unsafe; **silence** is the failure mode) replaces the RTL-activation argument. |
| **M002 ticket 14's D1e HYBRID** ("logical properties where verified safe, plus a small set of `:dir()` overrides for the 8 residue rows") recommended as the default for the milestone that adds component #2. | M002 `research/14-*.md`; carried into D039's Choice | **REFUTED AS STATED, on measurement [T02].** The rebind that produces its "logical properties where safe" half is itself the **sole source of all six defect classes**. Corrected position: **direction twins by default; the rebind if and only if the two-compile admission test returns zero for that component; no third mechanism** (C3). Its companion instruction -- that each new island "classify its own sites against the six-class table" -- is likewise superseded by C2, which is mechanical rather than a manual classification. |
| **M002 ticket 14's D1b** (the rebind stays, Button only). | M002 `research/14-*.md`; D039 | **UPHELD, on stronger grounds.** D039's D1b was a judgement about scope; it is now a consequence of C3. Button is not a special case, it is **the case that passes the admission test**. Keep the coupling's mechanical grounds; cite D039 as the decision. |
| **M002 ticket 12 item 7:** `$global-text-direction` "ruled OUT, provably inert twice over". | M002 `research/12-*.md` | **SUPERSEDED by M002 ticket 14 (D037). SPLIT:** OUT as an addon control (upheld, re-grounded on merit), **IN** as an accepted-and-honoured public settings entry. The inertness ground was Button-specific -- the single-component premise reappearing inside the pass meant to remove it. The coupling adds one rider: under the direction twins the setting becomes **genuinely meaningful for the first time** (compile one pass at the chosen direction, skip the twin layer, yield a smaller `:dir()`-free sheet), and it is the only setting with an upstream contract behind it (public and SassDoc'd, where `$global-left`/`$global-right` are labelled "Internal variables"). |
| **M002 ticket 12 C7 ground 4:** "the correct treatment is the post-import logical-property rebind". | M002 `research/12-*.md` | **MEASURED FALSE as a general mechanism** [T14 D1a/D1b], and now doubly so: the rebind emits invalid CSS at ~50 of ~109 source sites, six defect classes, ~11 components, silently. |
| **M002 hand-off s6.5 / D039's `verify-foundation-parity.mjs` note** (a one-line "it blesses an invalid declaration" folklore item). | M002 `HANDOFF.md` s6.5, s9 | **SUPERSEDED by the coupling's s4**, which is strictly better: the fault is characterised in **both** directions (under the rebind it blesses; under the twins Check 4 falsely fails), it has a **named owner** and **two threshold triggers**, and the **minimal two-line fix** is written down. Only that version survives, in `deferred/HANDOFF.md`. |
| **The coupling hand-off's conditional decision numbering** ("apply these four rows at the four next-free numbers AT APPLICATION TIME... D041-D044, or D042-D045 if M002's optional split is taken, or D032-D035 if M002 has not been applied"). | Coupling `HANDOFF.md` s2.1 | **RESOLVED, not carried.** Applied together from one folder the conditionality disappears. See section 4. |

### 2.2 M002-internal -- live entries from its own 19-row ledger

Deduplicated: rows whose only content was a number correction that the corrected
figure already carries are folded in, and rows that merely renumber a proposal are
replaced by section 4.

| Superseded | By | Corrected position |
| --- | --- | --- |
| Ticket 07: `$wcag-palette` lives in `src/scss/_button.scss` | Ticket 12 C1 | Lives in a **new** `src/scss/_theme.scss`, exported `"./scss/theme"`. |
| **Ticket 07's cost argument** for reusing `_button.scss` (a new file "needs" a costly new `exports` key) | Ticket 12 C1 | **DOES NOT SURVIVE.** One `package.json` line; no script, target or `ng-package.json` change. Ticket 07's one self-flagged `[INFER]` is now **VERIFIED TRUE** and graduates out of the unverified list. |
| Ticket 09: the compile call is hard-wired to `nfs-button.theme()` with `$selector: '.button'` | Ticket 12 C2 | A generated `THEMEABLE_MODULES` list, one entry today. The "pass no `$selector`" half is RESTATED, not corrected. |
| Ticket 08: the generator compiles "the chain" (singular) | Ticket 12 C3 | **N entry points, required TODAY** -- not a generalisation. A single-entry closure provably cannot see `_theme.scss`. |
| Ticket 08's closure sizing: 13 Foundation + 3 library partials, 71.9 KiB / 24.3 KiB gzip | Ticket 12 C4 | **16 files / 84.4 KiB / 24.1 KiB gzip**, plus multi-component bounds. Conclusion RESTATED: sources are a **bounded rider** on the `sass` payload, not "noise". |
| Ticket 07/09: the defaults probe reads `$button-palette` / `$button-background` / `$button-radius` | Ticket 12 C5 | Read the **Foundation-global** names instead. Byte-identical today, and it drops a spurious `primary` key. |
| Ticket 09: "at 197 ms a debounce timer is a magic number" | Ticket 13 D1 | Decision unaffected, **rationale replaced**: the coalescer self-tunes because its coalescing interval **is** the machine's compile time. Timer threshold: a measured **1000 ms** apply. |
| Tickets 01/09: "6 controls and one component make the cache key space tiny" | Ticket 13 D2 | Decision unaffected, **rationale replaced**: one compile means one cache key; a cache is unwarranted until a repeat theme crosses the **300 ms** indicator threshold. |
| A prior hand-off's "a pool would convert nothing to nothing" | Ticket 13 D3 | **FALSE as a general claim** -- measured pool gain reaches **4.1x by N=20**. No pool still stands, on three durable grounds. |
| Ticket 01's reading of the reference project's **20.5% pool gain** as a general law | Ticket 13 D3 | **N=2, 2.7:1-imbalance artifact.** Must not survive as a law. |
| Ticket 01: this repo "plausibly lands near the reference's worst case" (1.3-1.6 s) | Ticket 13 | **Wrong by ~7x** -- measured **197 ms**. |
| Ticket 05's "1.7x regime shift" | Ticket 13 s1 | A **declaration-order sampling artefact**, reproduced as a fake finding and discarded. See trap 3 in section 5. |
| `map.md` Ground truth: "RTL is logical-properties-only (no `[dir]`, no rtlcss)" read as a library-wide **prohibition** | Ticket 14 D1c / s5 | Accurate as a description of **what M003 built**; not a prohibition. M003's `:dir()` rejection (D021) is Button-scoped and **comparative**; using `:dir()` later needs **no decision reversal**. |
| `map.md` Out-of-scope: "extending `theme()`'s public Sass API", justified by what the addon's panel needs | Ticket 15 (D040) | Ruling **withdrawn and re-made on correct grounds**: M002 owns NOTHING of the settings API; it belongs to a dedicated later milestone. The narrow claim survives (M002's addon needs no public Sass API extension) but must **never** bound the library's settings surface. |
| A prior hand-off: "no `exports`-map or `verify-exports-map` change" stated flatly | Ticket 12 C1 | **SPLIT.** True of the ADDON's delivery shape (D032); **false of M002 as a whole** (D033 adds one key). |
| A prior hand-off: "no public Sass API growth" stated flatly | Ticket 12 C1 | **QUALIFIED.** No growth of `theme()`'s public signature; **one new public data module** carrying one member. |
| A prior hand-off's R009 open question 1: "that growth is not M002 scope -- **no second component exists**" | Ticket 12 C2/C6/C8 | **ANSWERED, not carried.** The compile call is a list; adding a component is one array entry plus regenerating the sources module. **The phrase "no second component exists" does not survive as a rationale anywhere.** |

**Swept and UNAFFECTED** [VERIFIED, not assumed]: M002 tickets 04, 06 and 10 --
zero single-component-premise hits and zero `'.button'` literals across all three;
no gate or lane assignment hard-codes the button.

### 2.3 Introduced by THIS synthesis

| Change | Why |
| --- | --- |
| **D039's Choice text is AMENDED before landing** -- its D1e hybrid recommendation and its "classify against the six-class table" onboarding instruction are replaced with a pointer to D041's direction-twin mechanism and C2's admission test. | None of D032-D040 has landed. Applying D039 verbatim would append a known-refuted forward recommendation into an append-only register, where it could never be edited again. The amendment is marked in place in `M002/REGISTER-TEXT.md` section 5. **This is a judgement, not a mechanical merge** -- see the closing note of that section. |
| **The conditional decision numbering in both efforts collapses to one flat sequence.** | Section 4. |

---

## 3. Boundary manifest

Every significant item from both efforts, and which folder owns it. An item appears
in **exactly one** column. Where the other folder needs it, it carries a
cross-reference, never a restatement.

| # | Item | Owner |
| --- | --- | --- |
| 1 | Sharpened **R009** text (Description + Validation), with mappable validation | `M002` |
| 2 | The six-control table, its Foundation-global **vocabulary-not-wiring** footnote, and the merged **value-vs-shape** rule + trigger 6 re-entry condition | `M002` |
| 3 | Sharpened **R021** text and the four verification lanes | `M002` |
| 4 | M002's **RTL clean bill of health** (three-way verification; the radius worry's structural refutation) | `M002` |
| 5 | The **D023 closure statement**, clause by clause, incl. the FROZEN `expectedContrastFailures` literals | `M002` |
| 6 | **All decision-register rows that must land**, D032-D045 | `M002` |
| 7 | **D037** (`$global-text-direction` accepted-and-honoured; not a control) and its README disclosure obligation | `M002` |
| 8 | **D038** (no cache, no pool, no debounce, no pre-compiled default theme) and its three named thresholds | `M002` |
| 9 | **D020 costed** (~802 KiB gzip attributed to the decision, not the addon) and the ecosystem/precedent record | `M002` |
| 10 | **R027's requirement TEXT** (lands now, owned by a deferred milestone) | `M002` |
| 11 | **R027's validation SHAPE, owner and the gate that satisfies it** | `deferred` |
| 12 | **R004's Notes-only amendment** (status stays `validated`; do NOT re-open) | `M002` |
| 13 | Requirements **touched but not owned**: R003, R008, R026, R019, R007 | `M002` |
| 14 | **R020's "(both LTR and RTL)" staleness flag** | `M002` |
| 15 | The **port-4400 collision** and its locked resolution | `M002` |
| 16 | The **atomic 3-part demo-app rewire** | `M002` |
| 17 | The **addon-load assertion** (glob + content-match `ADDON_ID`; a green build proves nothing) | `M002` |
| 18 | The **mandatory negative controls** and the anti-vacuity rule | `M002` |
| 19 | The **latent island-preamble under-import defect** (flag only; no M002 code) | `M002` |
| 20 | The four **silently-green failure modes** and their gates | `M002` |
| 21 | **VERIFIED-BY-EXECUTION vs INFERRED** for M002-relevant claims, incl. the four items untestable under the no-code constraint | `M002` |
| 22 | The full **C1-C9 contract** with measured grounds | `deferred` |
| 23 | The **two obligations** and the fact that ONE artifact discharges both | `deferred` |
| 24 | All **eight triggers**, and the deliberate exclusion of **emitted volume** with its reasoning | `deferred` |
| 25 | The **direction-twin mechanism**, in enough detail to build it | `deferred` |
| 26 | The **two-compile admission test** spec and its five mandatory properties | `deferred` |
| 27 | The **six defect classes** | `deferred` |
| 28 | The **rebind's disposition** (stays, Button only, by rule; never lifted; migration discretionary forever) | `deferred` |
| 29 | **C6** -- the browserslist feature gate against RESOLVED targets | `deferred` |
| 30 | **C8** -- the CSSOM tripwire re-purposed, with its mandatory positive control | `deferred` |
| 31 | **C9** -- `verify-foundation-parity.mjs` disposition: both fault directions, owner, two triggers, minimal two-line fix | `deferred` |
| 32 | The **two future milestones**, each with what it must not do until, and the no-ordering-dependency statement | `deferred` |
| 33 | **Per-component settings modules are a thing Sass cannot build** (once-and-first) | `deferred` |
| 34 | The settings milestone's **eight open shape items** | `deferred` |
| 35 | M002's **non-foreclosure constraints that bind the LATER milestones** | `deferred` |
| 36 | The contract's **DERIVED and INFER flags**, especially C4 option (b) | `deferred` |
| 37 | **Provenance** | `README` |
| 38 | The **supersession map** | `README` |
| 39 | The **decision/requirement numbering** resolution | `README` (stated) / `M002` (applied) |
| 40 | The **five reusable measurement traps** | `README` |

**Nothing was dropped.** Items that appeared in both sources are listed once, at the
owner named in section "Deduplication" below.

**Deduplication -- where each doubled item ended up, and why:**

| Doubled item | Kept where | Why |
| --- | --- | --- |
| Rebind / Button-only (M002 D039 + coupling C3 & s1.7) | `deferred` | The coupling's grounds are **mechanical** (Button is the case that passes C2) where D039's were a judgement about scope. D039 is cited as the decision; its row still lands from `M002`. |
| `$global-text-direction` | `M002` (D037 = the decision) with the twins rider cross-referenced from `deferred` C7 | D037 is an M002 decision with an M002 README deliverable. The twins rider is a distinct fact about a later mechanism, not a restatement. |
| `verify-foundation-parity`'s blessed defect | `deferred` s4 | Strictly better: both directions, owner, two triggers, minimal fix. `M002` carries a pointer only. |
| The six defect classes | `deferred` | They are a property of the RTL mechanism, which M002 does not ship. |
| The `foundation-everything()` trap | `README` trap 1 | Reusable by any future probe or gate; also binds C2.3 and the settings surface's own gate. |
| The measurement traps | `README` section 5 | Referenced from both hand-offs. |
| The six-controls clearance | `M002` section 3 | It is M002's clean bill of health. |

---

## 4. Numbering -- resolved to a flat sequence

Both efforts numbered their decision rows **conditionally**, purely because neither
knew the other's application order. Applied together from this folder, that
conditionality disappears.

**Verified against the read-only registers on 2026-08-11:**

- `.gsd/DECISIONS.md`'s highest **landed** row is **D031**. None of M002's proposed
  D032-D040, none of its optional split, and none of the coupling's four rows has
  been applied.
- `.gsd/REQUIREMENTS.md`'s highest **landed** requirement is **R026**. Neither
  effort proposes any new requirement number other than R027, so **R027 is free and
  uncontested**.

**The flat sequence, in application order:**

| Range | Rows | Source |
| --- | --- | --- |
| **D032-D040** | 9 rows: delivery shape; WCAG palette location; Sass-into-the-browser; control surface & state model; verification split; `$global-text-direction`; no cache/pool/pre-compile; cross-component RTL strategy; settings-migration surface & non-foreclosure | M002 effort |
| **D041-D044** | 4 rows: the sensitivity map + M002's clearance + the value-vs-shape rule; direction twins; what "gated" means + the two-compile envelope; the locked gating contract | Coupling effort |
| **D045** | 1 row, **OPTIONAL**: R026's stated boundary, split out of D035 clause (f) | M002 effort, flagged not taken |

> **Assigned range: D032-D044 (thirteen rows), extending to D045 if the optional
> R026-boundary split is taken.** All fourteen row bodies live in
> `M002/REGISTER-TEXT.md` section 5, in this order, ready for a single append pass.

**The register is APPEND-ONLY.** Never edit or remove an existing row. Rows that
have not yet landed are still editable -- which is why D039's amendment (section
2.3) is legitimate and must be made **before** the append, not after.

**Superseded by this resolution:** M002's note that its optional split "is D041,
because D037-D040 are now taken", and the coupling's three-way conditional
assignment. Neither survives; both are replaced by the table above.

**R027**: lands at R027. Its **text** is in `M002/REGISTER-TEXT.md` section 6 (so the
whole "what must end up in GSD" set is appliable from one folder); its **validation
shape, owner and gate** are in `deferred/HANDOFF.md`. The split is stated explicitly
in both places.

---

## 5. The five reusable measurement traps

Both efforts hit these. Each produced a **plausible wrong answer** before it was
caught. Any future probe or gate in this repo can hit them, so they are stated here
once and referenced from both hand-offs rather than being rediscovered.

**1. `foundation-everything()` silently overwrites `$global-flexbox`.** It executes
`$global-flexbox: true !global` when its `$flex` argument is true (the default), so
measured through that entry point `$global-flexbox: false` is **byte-identical** --
which reads as "inert" and is not. Through per-component includes the same setting
activates 4 class-1 defects and masks 7 class-5 defects. **Any gate compiling
`foundation-everything()` reports a false clean on every `$global-flexbox`-gated
site.** This is contract clause C2.3, and **it binds the settings surface's own gate
too, not just the RTL one.**

**2. An empty `CSSRuleList` is TRUTHY, so a CSSOM recursion examines nothing while
printing `[OK]`.** `CSSStyleRule` has a `.cssRules` property (CSS Nesting), so the
natural `if (rule.cssRules) recurse; else collect` walk recurses past every style
rule and collects **nothing** -- reporting `0 rules kept` and four `ALL DROPPED`
lines from a sheet where nothing was examined. **Any CSSOM gate must carry a
positive control asserting a known-VALID declaration survived, and must abort
without one.** Related: Chromium's CSSOM expands `border-width` into four longhands
when enumerated, so a detector written against SOURCE text reports 0 in the CSSOM
view for a reason unrelated to browser behaviour.

**3. Declaration-order timing artefacts -- THREE sightings, independently.**
(a) M002 ticket 05's "1.7x regime shift" was a declaration-order sampling artefact;
ticket 13 reproduced it as a fake finding in its own first pass and discarded it.
(b) An unshuffled run of the twins' cost probe reported a spurious uniform **+2%**;
the shuffled run reported **-1%**. (c) An unshuffled run of the envelope's cost probe
on the whole-library cell alone would have reported **"+10% for the admitting
compile"**; the sign flip at `menu` (-6%) is what exposed it as noise.
**Interleave and shuffle every (condition, target, replicate) triple with a seeded
Fisher-Yates, warm up outside the measurement, report medians, and compare each
cell's own min..max spread against the between-condition difference before believing
any delta.**

**4. Same-variable pairs invalidate an additivity test.** The first pairwise run
reported 19 non-additive pairs of 78; seven were two perturbations of the **same**
variable, where the later declaration simply wins, so the prediction is meaningless.
Corrected figure: 12 non-additive of 71 valid pairs, all involving
`$breakpoint-classes`. **Skip same-variable pairs explicitly and report the skip
count.**

**5. An intra-file guard walk misses guards around the `@include`.** The first gate
walk missed `$accordionmenu-arrows`, whose `@if` sits around the mixin's `@include`
51 lines from the declaration. The transitive-closure probe and an independent
brute-force boolean sweep both catch it, **and they agree -- which is the only
reason the 15-name closure is trustworthy.**

---

## 6. Where the underlying evidence lives

**Read-only. Do not edit either source folder.**

| Path | What |
| --- | --- |
| `.scratch/m002-storybook-theming-addon/map.md` | M002's map: destination, standing constraints, decisions-so-far, fog. |
| `.scratch/m002-storybook-theming-addon/research/01..10` | Prior art; Storybook 10 addon anatomy; Dart Sass in the browser; Playwright against Storybook; compile-the-real-chain measurements; delivery shape; compliant-preset single source; Foundation Sass into the browser; control surface and state model; R021 verification design. |
| `.scratch/m002-storybook-theming-addon/research/12..15` | The four correction tickets: multi-component architecture corrections; scaling/performance re-evaluation; RTL across the component set; the Foundation settings-migration surface. |
| `.scratch/m002-storybook-theming-addon/HANDOFF.md` | The closed M002 hand-off. **Its section 8 is superseded** (section 2.1 above). Sections 5.3, 6.4 and 6.5 remain live inputs and are carried into this folder. |
| `.scratch/settings-rtl-coupling/map.md` | The coupling map. |
| `.scratch/settings-rtl-coupling/research/01-settings-sensitivity-map.md` | Which settings activate residue and by how much; M002's three-way clearance; the growth law; monotonicity and additivity. |
| `.scratch/settings-rtl-coupling/research/02-is-the-residue-eliminable.md` | The direction-twin mechanism class by class; why no substitution or mapping layer works; cost; R008; the `:dir()` residue priced three ways. |
| `.scratch/settings-rtl-coupling/research/03-can-a-consumer-dependent-defect-be-gated.md` | What "gated" means; the two-compile envelope and its cost; the CSSOM oracle measured; Foundation's own documentation. |
| `.scratch/settings-rtl-coupling/research/04-the-gating-contract.md` | **The locked contract** -- nine clauses with grounds, why each rejected shape loses, the obligations, the trigger table, the VERIFIED/INFERRED split. |
| `.scratch/settings-rtl-coupling/prototypes/` | 14 read-only probes, reusable. `rtl-eliminator.mjs` is the mechanism; `gate-site-coverage.mjs` the envelope's completeness; `rtl-baseline-support-probe.mjs` the feature matrix C6 needs; `gate-closure.mjs` the transitive settings closure. |
| `.scratch/settings-rtl-coupling/prototypes/out/run-*.txt` | Captured output for every quantity cited. |
