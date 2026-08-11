# Settings seamlessness vs latent RTL defects

Label: `wayfinder:map`

## Destination

A **locked contract for how the settings-migration surface and cross-component
RTL gate each other**, so neither milestone can be planned in ignorance of the
other. Concretely: decide whether the settings-dependent RTL defect class is
**eliminated** (made structurally impossible, so settings are safe by
construction) or **detected** (gated, so defects are caught), and what that
implies for the ordering of the two future milestones.

The map ends when a planner can pick up either milestone knowing exactly what it
owes the other. It does not design either milestone.

## Notes

**Why this is a fresh effort, not a resumption.** The `.scratch/m002-storybook-theming-addon`
map closed with 15 resolved tickets, and it ruled BOTH halves of this coupling
out of scope: ticket 15 put the settings API in "a dedicated later milestone",
and ticket 14 deferred cross-component RTL as "a component-onboarding
obligation". Out-of-scope work never graduates within a map, so the coupling
returns as its own effort. Read that map's `HANDOFF.md` section 8 for how the
coupling was first stated, and `research/14-*.md` and `research/15-*.md` for the
evidence.

**The coupling, precisely** (both halves measured, see the M002 map):

- Ticket 14 measured `button-group`'s 14 RTL radius sites as **LATENT**: **0**
  invalid declarations at Foundation's defaults, **20** with
  `$buttongroup-radius-on-each: false`. So the RTL defect count is a function of
  **consumer settings**, not of this library's source.
- Ticket 15 wants a settings surface seamless enough that a consumer CAN set
  exactly such a value.
- Therefore **the settings milestone's success condition is the RTL milestone's
  trigger**, and -- the sharp part -- **no fixed-settings gate can bound the
  class**, because the defect count depends on input this repo's CI never sees.

**The hypothesis this map must test, not assume.** A defect class that depends on
consumer input may be *undetectable in principle* from inside this repo. If so,
detection is the wrong strategy and **elimination** is the right one -- fix the
mechanism so no setting can produce invalid CSS, making settings safe by
construction. That is a hypothesis with a plausible mechanism (ticket 14 re-opened
`:dir()` and found custom properties compress rather than replace it, recommending
a hybrid), but eliminability was never proven. Prove or refute it.

**Does this pull M002 back in? Answer it early, do not assume not.** The M002
addon exposes six live controls. Ticket 15's constraint 7 verified five of them
inert when seeded into the island, and ticket 14 found Button hits only the two
safe defect classes -- so the current reading is that M002 is unaffected. But
`$global-radius` is one of the addon's six controls, and `button-group`'s latent
class is radius-shaped. **If any of the six controls can activate RTL residue in
a component that later lands, M002's addon is implicated after all**, and this
map must say so loudly rather than leaving a closed milestone quietly wrong.

**No human in the loop.** Standing instruction carried from this session's
earlier effort: no ticket may ask the user to decide. Every ticket is `research`
(including synthesis/decision tickets, resolved AFK), `prototype` (agent-driven
-- the agent builds the artifact and resolves the ticket by measuring it), or
`task`.

**Plan, do not do. `.scratch/` only.** No file under `packages/`, `apps/`,
`scripts/`, `.storybook/`, or any repo config may be created, edited or deleted.
`.gsd/` is **read-only** -- projected from a database; read it via the
`gsd-workflow` MCP or by reading the files, never write. Prototypes and probes
live in `.scratch/settings-rtl-coupling/prototypes/`.

**Reusable probes already exist** in `.scratch/m002-storybook-theming-addon/prototypes/`
and should be reused rather than rebuilt: `rtl-rebind-validity-probe.mjs`,
`rtl-rebind-latent-radius-probe.mjs`, `rtl-rebind-source-sites.mjs`,
`rtl-residue-probe.mjs`, `settings-reachability-probe.mjs`,
`settings-surface-probe.mjs`, `settings-use-with-probe.mjs`,
`scaling-curve.mjs`.

**Standing constraints inherited** (all verified in the M002 map):

- **D020** (human, standing): SCSS variable theming only; no CSS custom property
  theming *surface*. Ticket 14 established every D020 clause is scoped to the
  theming surface, so a direction *sign* custom property is NOT forbidden -- but
  it also cannot read direction alone, so it compresses `:dir()` rather than
  replacing it.
- **R004** (validated): RTL via logical properties, no `[dir]`, no rtlcss, no
  dual file. Ticket 14 established M003's `:dir()` rejection (D021/D028) was
  **Button-specific**, not library-wide, so re-opening `:dir()` needs no
  decision reversal.
- **R008**: consumer-authored theme output wins the cascade over library
  defaults, via the unlayered-beats-`@layer nfs-defaults` split. Verified in real
  Chromium across all four insertion orders.
- **Dual build is ruled out by a shipped artifact** -- the `Rtl` story renders
  `dir="ltr"` and `dir="rtl"` side by side in ONE document and asserts mirroring
  between them. No dual build can serve that page. Do not resurrect it.
- **`$global-text-direction` is accept-and-honour** -- it composes correctly with
  the rebind, reaching only the residue, and is the escape hatch in Foundation's
  own vocabulary.
- **`verify-foundation-parity.mjs` currently BLESSES the worst defect class** --
  lines 64 and 67 map `text-align: left -> inline-start`, asserting the invalid
  form is correct. Harmless today because Button never hits it. Never propagate
  that table.

**Search tooling.** NEVER use the Grep tool or `grep` (both denied). `git grep
-n` for tracked files; `rg` for gitignored paths -- `node_modules/foundation-sites/scss`
is gitignored and `git grep` returns ZERO there **silently**. Pipe filters are
`| rg`, never `| grep`. A zero-hit `rg` is not proof of absence: check the exit
code (2 = the command failed), `rg` is line-oriented, and patterns are regex
unless `-F`. Sass variables start with `$` -- escape it or use `-F`.

**Output hygiene.** ASCII only -- no emojis, em/en dashes, curly quotes, or
ellipsis characters. Use `--`, `...`, `[OK]`, `[WARN]`.

## Decisions so far

<!-- one line per closed ticket -->

- [Write the hand-off for both future milestones](issues/05-write-the-handoff.md)
  -- **MAP CLOSED. `HANDOFF.md` written, self-contained for either milestone's
  planner.** Five deliverables: the contract restated with the **not-temporal** gate
  intact; **four decision rows** in `.gsd/DECISIONS.md`'s exact column shape, numbered
  as "the next four free at application time" -- **D041-D044** primary, D042-D045 if
  M002's optional split lands, D032-D035 if M002's nine have not been applied
  (**D031 is the highest LANDED row; none of M002's D032-D040 is in the file yet**),
  each naming the standing HUMAN decisions it operates under (D020, **D022** -- the
  pin is the whole source of C7's cost -- D023, **D025**) without re-deciding them;
  a **requirement-level answer that is YES** -- **R004's VALIDATION text goes stale
  the moment component #2 lands**, exactly as R003's Notes did for M002, so R004 gets
  a **Notes-only** amendment (status stays `validated`, not re-opened) and the
  cross-component obligation plus the public-class-name parity clause go to a **NEW
  R027** (R026 is the highest landed and M002 proposes no requirement numbers);
  **M002's clean bill of health stated positively and first**, then a **superseding
  note on M002 HANDOFF section 8** -- its headline is true only of the REBIND, its
  sequencing consequence is **SUPERSEDED**, its "no fixed-settings gate is
  sufficient" consequence is **SUPERSEDED with the premise surviving and the
  inference failing**, its shared-partial consequence **SURVIVES and sharpens**, and
  its D040-constraint-5 consequence is **HALF superseded**; and a **parity-gate
  disposition with a named owner and two threshold triggers**, sharpened by reading
  the file -- **Check 4 (lines 416-435) rejects the entire twin construction, so the
  fault is mechanism-coupled at the CHECK level, not just the `text-align` table**,
  with a minimal two-line fix recorded. C4 carried as the **single load-bearing
  INFER** under trigger 3's orphan-twins-> 0 threshold; volume preserved as
  deliberately NOT a trigger; five reusable **measurement traps** carried (the
  declaration-order artefact now has three sightings). **Fog CLOSED: "Not yet
  specified" confirmed empty, "Out of scope" re-checked and still accurate on all
  four entries.**
- [The gating contract between the settings surface and cross-component RTL](issues/04-the-gating-contract.md)
  -- **CONTRACT LOCKED: ELIMINATION-FIRST, admitted per component by a mechanical
  test -- and the gate is NOT temporal.** Neither milestone waits for the other;
  what gates is the **two-compile admission test** on the COMPONENT side (defaults +
  `$buttongroup-radius-on-each: false` with `$global-flexbox: false`), and because
  that envelope is complete over source sites and magnitude growth adds none, a
  component that passes it is safe at **any** settings configuration -- so **no
  settings key is ever withheld on RTL grounds**. Nine clauses; the sharp new one is
  **C4: the settings surface FORCES the twin layer to be hand-authored Sass**, since
  Sass cannot rewrite selectors it did not author and a pre-generated CSS blob is
  keyed on the library's settings while base rules track the consumer's -- orphan
  twins > 0 is the check. **Both obligations are discharged by ONE artifact**, a CI
  gate over the shipped component set at the envelope. **Per-component coupling
  loses on the SETTINGS axis** (`@use ... with` is once-per-module-per-compilation,
  so the door has no per-component granularity; and the activating settings are
  cross-component) while its component half survives verbatim; **detection** loses
  three times; **disclosure** loses because it is today's accidental behaviour, there
  is no upstream hazard to relay, and it means shipping a documented-API break. All
  eight triggers are thresholds or version numbers -- **the only expiring clause is
  the `:dir()` disclosure: delete it when the pin resolves to no chrome/edge below
  120.** Volume is deliberately NOT a trigger. **M002 clean, rebind stays for Button
  only and migrates never on correctness grounds.**
- [Can a consumer-settings-dependent defect be gated at all?](issues/03-can-a-consumer-dependent-defect-be-gated.md)
  -- **no gate is needed: detection is UNNECESSARY, not merely infeasible**,
  because ticket 02 proved prevention. "Gated" resolves to **prevent**;
  detect-in-their-CI is dropped; disclosure narrows to `:dir()` and
  `$global-text-direction`. **The unbounded magnitude turns out to be pure
  replication** -- all 1187 class-2 declarations at 48 columns x 12 breakpoints
  come from the same **22 source sites** as the 98 at defaults, zero new sites in
  any class, so a complete onboarding test is **two compiles**, not a grid. The
  CSSOM check survives re-purposed as a regression tripwire (classes 1-4 verified
  dropped in real Chromium; classes 5-6 survive intact, class 6 being a defect of
  *absence* no oracle can see). `verify-browserslist.mjs` checks **no feature**
  against resolved targets, so nothing today would notice the `:dir()` gap.
  **Foundation documents no settings/RTL interaction anywhere** -- and
  `.align-left`/`.align-right` are documented public API, so the rebind's rename
  broke a documented contract, while `$global-left`/`$global-right` are labelled
  "Internal variables", an argument for the twins independent of validity.
- [Can the residue be eliminated, making settings safe by construction?](issues/02-is-the-residue-eliminable.md)
  -- **YES, all six classes, verified by execution and confirmed in real
  Chromium.** The mechanism is neither the rebind nor a mapping layer but a
  **direction-twin** construction: compile Foundation *unmodified* twice at Sass
  time (`ltr` and `rtl`), diff, and emit ONE sheet where each
  direction-dependent declaration appears twice under `:where(:dir(ltr))` /
  `:where(:dir(rtl))`, element-scoped and interleaved in place. Its defining
  property dissolves this map's whole problem: **every name it emits is one
  Foundation itself emitted, so no consumer setting can produce invalid CSS by
  construction** -- 0 invalid across 8 settings configs against the rebind's
  36-56, with exact declaration-level equivalence to Foundation's RTL build and
  **0 differing computed values in Chromium in both directions in one document**.
  Ticket 14's hybrid is **refuted as stated**: the rebind that produces its
  "logical properties where safe" is itself the sole source of all six classes.
  A Sass mapping layer is **impossible**, not merely unattractive -- Sass cannot
  rewrite selectors it did not author. Residue-of-the-residue: `:dir()` fails 2
  of the 136 pinned R022 browser targets, priced three ways. The rebind stays,
  **Button only**, now by mechanical rule rather than judgement.
- [Which settings activate RTL residue, and by how much?](issues/01-settings-sensitivity-map.md)
  -- **M002 gets a CLEAN BILL OF HEALTH**, verified three ways: none of the
  addon's six controls activates residue in any defect class. The radius worry
  does not land because the radius-shaped class is gated by a **boolean, not a
  radius** (0/20 for `$buttongroup-radius-on-each`, identically at radius `0`,
  `6px`, `50%`), and `$global-radius` is live at raw-Foundation level yet
  activates nothing. **Bounded in NAMES (15 of 498 settings) but UNBOUNDED in
  MAGNITUDE** -- two are multipliers, with a fitted formula confirmed on 9/9
  held-out combinations giving 1187 invalid declarations at 48 columns x 12
  breakpoints against 98 at defaults, so **a cartesian gate is the wrong SHAPE,
  not merely too large**. **NOT monotone**: `$global-flexbox: false` adds 4
  class-1 defects while removing 7 class-5 defects in one compile. Caught two
  measurement artifacts that would each have faked a clean result -- notably
  `foundation-everything()` executing `$global-flexbox: true !global`, which
  silently overwrites a consumer's setting.

## Not yet specified

**EMPTY -- confirmed by ticket 05.** All three charting-time fog items graduated;
tickets 04 and 05 opened none. Each item's landing clause is traced in
`HANDOFF.md` section 6.1. Everything still unproven is flagged as [INFER] in
`HANDOFF.md` section 5.4 with the threshold that would refute it -- notably C4's
option (b), covered by trigger 3.

<!-- GRADUATED by ticket 01: the class-rename defect IS settings-dependent, but
     only downward and only via `$global-flexbox` (13 -> 6 selectors), never
     breakpoint-multiplied. Worse than first stated: the rebind removes BOTH of
     Foundation's public `.align-left` and `.align-right`, not just one. It is
     one of three "maskable-only" classes whose maximum IS the default, which is
     the one shape a fixed-settings gate can bound. Carried into ticket 03. -->
<!-- GRADUATED by ticket 02: elimination does NOT cost compile time. BASE 1350 ms
     (reproducing ticket 13's 1.2-1.4 s ceiling); the twins are indistinguishable
     from noise, and the generator costs exactly one extra pass. Emitted VOLUME
     rises +14.1% library-wide and +62% for `button-group`. Note an unshuffled
     run of the same code reported a spurious uniform +2% -- the same
     declaration-order artifact ticket 13 caught. -->
<!-- GRADUATED by ticket 03: Foundation documents NO settings/RTL interaction
     anywhere. `$global-text-direction` appears exactly once in the whole shipped
     docs tree; `sass.md`/`global.md` have zero mentions of "direction"; the
     settings template carries a bare uncommented line; `customizer/` has no
     direction handling; and `dir="rtl"` is documented as a JAVASCRIPT
     requirement, so upstream has no runtime CSS direction contract at all. Two
     contract facts came out of it, both carried to ticket 04. -->

## Out of scope

- **Designing or building either milestone.** This map decides how they gate each
  other. The settings API belongs to its dedicated milestone (M002 ticket 15);
  cross-component RTL to the component-onboarding obligation (M002 ticket 14).
- **Re-opening M002's closed decisions** -- unless the sensitivity map shows one
  of the addon's six controls activates residue, which is a finding this map must
  surface, not a licence to redesign the addon here.
- **Dual-build RTL.** Ruled out by a shipped artifact (see Notes).
- **Fixing `verify-foundation-parity.mjs`'s blessed defect class.** Real, known,
  harmless today, and it belongs to whichever milestone first emits the affected
  declarations.
