# Write the hand-off for both future milestones

Type: task
Status: resolved
Blocked by: 04

## Question

Nothing left to decide. Turn the locked contract into something a planner can
act on, for **both** future milestones plus any correction the closed M002
hand-off needs.

Produce:

1. **The contract itself**, stated so either milestone's planner can read only
   this and know what they owe the other -- ordering, obligations, triggers.
2. **A decision entry per resolved ticket**, in `.gsd/DECISIONS.md`'s exact
   column shape. Read that file to confirm the next free D-number; M002's
   hand-off proposed through D040 (D041 if its optional R026 split is taken), so
   check what actually landed before numbering. Note which standing HUMAN
   decisions each operates under (D020, D023) rather than re-deciding them.
3. **A requirement-level statement** if the contract needs one -- e.g. an RTL
   correctness requirement that is not currently expressed, given R004 is
   *validated* but scoped to Button's mechanism. Say whether an existing
   requirement's text goes stale the moment component #2 lands, the way R003's
   scoping note did for M002.
4. **The correction to M002's hand-off, if ticket 01 found one.** If any of the
   addon's six controls can activate RTL residue, the closed
   `.scratch/m002-storybook-theming-addon/HANDOFF.md` is wrong and must be
   corrected -- carried as a superseding note in THIS effort's hand-off, since
   that map is closed. Do not silently edit the closed map's research documents;
   they record what was found at the time. If ticket 01 found no implication,
   state the clean bill of health explicitly.
5. **The `verify-foundation-parity.mjs` disposition.** It currently BLESSES the
   worst defect class (lines 64 and 67 map `text-align: left -> inline-start`,
   asserting the invalid form is correct). Harmless today because Button never
   emits it. Assign it an owner and a trigger rather than leaving it as folklore.

**Do NOT write to `.gsd/`** -- read-only, DB-projected. Deliver the text as
`HANDOFF.md` in this effort directory.

**Route-agnostic.** Two routes consume this: the `gsd-workflow` MCP tools, or
`/gsd` slash commands in a later dedicated `gsd` session. State what must end up
in GSD, never which interface applies it.

## Notes

This ticket closes the map. Before finishing, check the map's **Not yet
specified** -- each remaining item must graduate into a ticket, fold into the
hand-off as an explicit open question for the planner, or be ruled out of scope
with a line saying why. Nothing may silently vanish. The three fog items at
charting time were: whether the class-rename defect is settings-dependent
(ticket 01 should answer it), whether elimination costs compile time (ticket 02),
and what Foundation's own docs claim about the settings/RTL interaction (ticket
03).

Carry a VERIFIED-BY-EXECUTION vs INFERRED split. Much of this effort's value, like
the M002 map's, is that its claims were measured rather than argued -- keep that
distinction legible, and carry forward anything that stayed unverified.

## Answer

**Written to `.scratch/settings-rtl-coupling/HANDOFF.md`. The map is CLOSED.** All
five deliverables landed; nothing outside `.scratch/` was created, edited or
deleted, `.gsd/` was read-only, and no file under
`.scratch/m002-storybook-theming-addon/` was touched.

**1. The contract** (HANDOFF s1). Nine clauses C1-C9, two obligations, eight
triggers, restated so either milestone's planner can act on this file alone.
Headline correction carried verbatim: **the gate is NOT temporal** -- neither
milestone waits, because the two-compile admission test is settings-INDEPENDENT even
though the defect count is settings-dependent, so **no settings key is ever withheld
on RTL grounds**. No sequencing story reintroduced; the ordering table is a
"must not, until" table over predicates, not over time. Both obligations are
discharged by ONE artifact (one gate, two owners), which is *why* there is no
ordering to negotiate.

**2. Four decision entries** (HANDOFF s2.1), one per resolved ticket, in
`.gsd/DECISIONS.md`'s exact eight-column shape. **Numbering: D031 is the highest
LANDED row and none of M002's proposed D032-D040 (+optional D041) has been applied
[VERIFIED by reading the file]**, so the rows are stated as "the four next-free
numbers at application time", with the primary assignment **D041-D044**, the
contingency **D042-D045** if M002's optional split is taken, and **D032-D035** if
M002's hand-off has not been applied first. Standing HUMAN decisions are named with
how each binds rather than re-decided: **D020** (no custom-property theming surface
-- the twins add none), **D022** (the pin is the entire source of C7's cost and the
contract does NOT propose changing it), **D023** (untouched), **D025** (nothing goes
upstream, including Foundation's documentation gap).

**3. Requirement-level statement** (HANDOFF s2.2). **YES -- an existing
requirement's text goes stale the moment component #2 lands, exactly as R003's
Notes did for M002: it is R004's Validation field**, and three phrases are named
(the "no `:dir()`" half, "the only genuinely directional declarations in the sheet",
and the Button-scoped mechanism sentence). Two parts: **(a)** a Notes-only amendment
to R004 with `validated` status kept and no re-opening, drafted verbatim; **(b)**
**one new requirement R027** (highest landed is R026, and M002's hand-off proposes
no requirement numbers, so R027 is free and uncontested) carrying cross-component
RTL correctness plus the public-class-name parity clause that ticket 03 showed is a
documented-API break -- because a `validated` R004 cannot carry a not-yet-built CI
gate as its validation. R020's "(both LTR and RTL)" precompiled-CSS parenthetical is
flagged as already stale, explicitly NOT a deliverable.

**4. M002's correction** (HANDOFF s3). The **clean bill of health is stated
positively and first** (three independent verifications; the radius worry fails for
a structural reason -- the class is gated by a boolean, not a radius), so a closed
milestone is not left under suspicion. Then a **superseding note on M002 HANDOFF
section 8**, which was written before elimination was proven: its **headline is true
only of the rebind mechanism**, its **consequence 1 (sequencing is a real
constraint) is SUPERSEDED**, its **consequence 2 (no fixed-settings gate is
sufficient) is SUPERSEDED -- premise survives, inference fails** because the
unbounded growth is pure replication of a fixed 22-site set, its **consequence 3
(the shared-partial prohibition) SURVIVES and sharpens into a mechanical statement**,
and its **consequence 4 (D040 constraint 5) is HALF superseded** -- the
RTL-activation reason is void, the once-and-first ordering reason survives. M002's
files are not edited.

**5. `verify-foundation-parity.mjs` disposition** (HANDOFF s4). Characterised in
both directions by reading the file, which sharpened C9: under the **rebind**, lines
63-67 + 283-284 bless `text-align: inline-start` as the logical form of
`text-align: left` (the mapping is valid for `float`/`clear` and wrong **only** for
`text-align`); under the **twins**, **Check 4 (lines 416-435) rejects the whole
construction**, not just its `text-align`, because it fails any physical directional
property or value on the raw component sheet -- so the fault is **mechanism-coupled
at the CHECK level, not merely at the table level**. **Owner: the milestone that
admits component #2** (the fault is a property of the mechanism a component chooses,
and the gate's reference island is Button-only). **Two threshold triggers:** T-a =
directional `text-align` count > 0 (contract trigger 8); T-b = the reference island
covers more than one component. Interim disposition: do not fix, do not propagate,
and the minimal two-line fix is written down so the owner does not re-derive it.

**Also required, all carried.** **C4 is flagged as the contract's single load-bearing
INFER** (a hand-authored Sass twin partial tracking consumer settings; ~337 rows
never written), covered by **trigger 3 with a measurable threshold -- orphan twins >
0 -- rather than a rationale**, with the stated fallback needing no new decision.
**Every trigger is a threshold or a version number**; **C7 is the only expiring
clause** (delete when the pin resolves to no chrome/edge below 120 -- `:dir()`
shipped in 120, the pin floors at 119, the rolling query already gives 121, all
re-confirmed [V-REPO]); **volume is preserved as deliberately NOT a trigger**, with
ticket 04's reasoning intact (any budget chosen now would itself be the expiring
premise). The **VERIFIED-BY-EXECUTION / V-REPO / DERIVED / INFERRED split** is
section 5, and the **five reusable measurement traps** are section 5.5 --
`foundation-everything()` overwriting `$global-flexbox` with `!global`, the truthy
empty `CSSRuleList` producing a false `[OK]` from an unexamined sheet, the
declaration-order timing artefact (**three sightings now**, twice in this effort),
same-variable pairs invalidating additivity, and intra-file guard walks missing
guards around the `@include`.

**Fog check** (HANDOFF s6). **"Not yet specified" CONFIRMED EMPTY** -- all three
items graduated, each traced to the research document that closed it AND the clause
it landed in; tickets 04 and 05 opened no new fog. **"Out of scope" re-checked
line by line and still accurate on all four entries**, with the parity-gate entry
upgraded from folklore to a named owner plus two threshold triggers, and the
M002-re-opening condition explicitly tested and NOT triggered.
