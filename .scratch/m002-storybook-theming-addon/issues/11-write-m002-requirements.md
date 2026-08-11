# Write M002's locked decisions and sharpened requirements

Type: task
Status: resolved
Blocked by: 06, 07, 08, 09, 10, 12, 13, 14, 15

**REOPENED.** A standing user instruction landed after this ticket resolved:
`ngx-foundation-sites` must support **all** Foundation for Sites components,
Button being merely the first, and **anything in this map optimising for a
single component must be re-evaluated or corrected** (see the multi-component
constraint in `map.md`'s Notes). `HANDOFF.md` as written carries the
single-component premise in several places -- R009's control-set framing, the
`$wcag-palette` home, the compile target, and the fog closure on
multi-component growth.

Tickets 12 (architecture) and 13 (scaling/performance) produce the corrections.
Regenerate the hand-off from the corrected decision set once both resolve --
do not patch `HANDOFF.md` around the edges, and make sure every superseded
decision is carried as superseded rather than silently contradicting the
research documents that recorded it.

## Question

Nothing left to decide -- this is the hand-off. Turn the map's resolved
decisions into the artifacts GSD milestone planning consumes.

**Interface note.** Two routes exist, and the hand-off must not assume either:

- **In THIS session** the `/gsd ...` slash commands are unavailable; GSD is
  reachable only through the **`gsd-workflow` MCP tools** --
  `gsd_plan_milestone` for M002, then `gsd_plan_slice` / `gsd_plan_task`, with
  `gsd_milestone_status` / `gsd_query` for reads.
- **In a later dedicated `gsd` session** the slash commands ARE available, and
  that is a perfectly good way to consume this hand-off.

So write the hand-off as **route-agnostic content** -- requirement text,
decision entries, and closure statements that either interface can apply. Do
not embed "run `/gsd plan M002`" or "call `gsd_plan_milestone`" as the
instruction; state what must end up in GSD, and let the consuming session pick
its route.

Produce:

1. **Sharpened R009.** Today it reads "Storybook gets a theming addon (similar
   to `ngx-foundation-sites-next`) with runtime Sass compilation in the browser
   and controls for live-tweaking Foundation Sass variables (palette, radius,
   etc.)" -- with `Validation: unmapped`. Rewrite it so the curated variable set
   is exact (no "etc."), the delivery shape is named (ticket 06), the preset
   model and its "selected only on exact match" semantics are stated
   (ticket 09), and validation is mappable.
2. **Sharpened R021.** Today "verified via Vitest unit tests and Playwright e2e
   tests exercising it in Storybook", `Validation: unmapped`. Rewrite with the
   split from ticket 10 and the harness from ticket 04, so each half names what
   it proves.
3. **A decision list for `DECISIONS.md`** -- one entry per resolved ticket
   (06-10), in the existing table's shape: context, decision, reasoning, whether
   it reverses an earlier decision, and human-vs-agent source. Note explicitly
   which standing human decisions each one operates under (D020, D023) rather
   than re-deciding them.
4. **The D023 closure statement.** Ticket 07 creates the compliant-theme single
   source and ticket 10 re-points the axe proof. Write the plain statement of
   how D023 -- "a WCAG/axe-compliant theme ships in M002, and the axe suite runs
   against that compliant theme" -- is discharged, since M003 left it open
   despite the founding brief assuming otherwise.
5. **A note on any requirement M002 touches but does not own** -- R003's
   scoping note references "M002's forthcoming WCAG/axe-compliant theme", and
   R008/R026 both constrain the addon. Flag these for the planner rather than
   editing them. Include ticket 04's **port-4400 collision** between
   `test-storybook` and the new Playwright lane, which requires changing
   existing wiring.
6. **State plainly that D020 is load-bearing and unusual.** Ticket 01 found that
   no Storybook addon compiles Sass in the browser, and that every first-party
   design system surveyed (Carbon, Spectrum, Fluent, Polaris, SLDS) converged on
   the CSS-custom-property mechanism D020 forbids. M002 is deliberately doing
   what the ecosystem chose not to do. Record it as a deliberate, costed choice
   so a future reader cannot mistake the unusual path for an accident -- and so
   the cost (a ~916 KiB gzip compiler payload, per ticket 03) is attributed to
   the decision that causes it rather than to the addon's implementation.

**Do not write to `.gsd/` directly.** Those files are projected from a database
and are read-only from here. Deliver the text as a hand-off document in this
effort directory; applying it is `/gsd plan M002`'s job, through the
`gsd-workflow` MCP.

## Notes

This ticket closes the map. When it resolves, the way to the destination is
clear: every decision locked, requirements sharp enough to decompose, and
nothing left before `/gsd plan M002` runs.

Check the fog in `map.md`'s **Not yet specified** before finishing -- anything
still unresolved there either graduates into a ticket, gets folded into the
requirement text as an explicit open question for the planner, or is ruled out
of scope. Do not let it silently vanish.

## Answer

**RESOLVED a second time. `../HANDOFF.md` was REGENERATED from the corrected
decision set (tickets 06-10 plus corrections 12, 13, 14, 15), not patched.** No
repo file outside `.scratch/` was touched; `.gsd/` was read only. Route-agnostic
throughout: it states what must end up in GSD, never which interface applies it.

### The correction pass, and how it is carried

The hand-off now opens with a **supersession ledger (section 0.1)** -- 19 rows,
each naming the superseded claim and what supersedes it, so nothing silently
contradicts the research record. **No single-component premise survives as a live
rationale anywhere**; the hand-off was grepped for its known phrasings and every
remaining occurrence sits inside the ledger, explicitly marked superseded or
false-as-stated.

What changed, ticket by ticket:

- **T12 (architecture).** `$wcag-palette` moves out of `_button.scss` into a NEW
  `src/scss/_theme.scss` exported `"./scss/theme"`. The compile call becomes a
  generated `THEMEABLE_MODULES` list of `{url, namespace}` object literals, one
  entry today. The generator takes **N entry points TODAY** -- not a
  generalisation, because a single-entry closure is provably blind to
  `_theme.scss` (negative control). Closure re-measured (16 files / 84.4 KiB /
  24.1 KiB gzip today; 52 files / 46.2 KiB gzip for all 35 Foundation
  components; floor-dominated at 12 of 13 shared partials). The **"no
  exports-map change" claim is SPLIT** -- true of the addon (D032), false of
  M002 (D033 adds one key) -- and **"no public Sass API growth" is QUALIFIED**
  to "`theme()`'s signature does not grow; one new public data module appears".
  The defaults probe reads the Foundation-**global** names.
- **T13 (scaling).** All four performance decisions survive; **three of four
  rationales do not**. The curve is **ADDITIVE in emitted components, not
  floor-dominated** -- T12's *closure* is floor-dominated but *time* is not.
  Cost tracks **palette colour math**, not component count or CSS volume.
  **Ceiling ~1.2-1.4 s for the entire library**, less than the reference needed
  for TWO components. The reference's 20.5% pool figure is recorded as an **N=2
  artifact**, and **s7's "a pool would convert nothing to nothing" is GONE** as
  a claim -- it survives only as a ledger row marking it false. Debounce, cache
  and pool rationales replaced with measured thresholds; the default theme is
  now explicitly **never compiled**.
- **T14 (RTL).** Supersedes T12 item 7. The rebind is **not a general
  mechanism** (~50 of ~109 sites invalid, six defect classes, silent).
  `$global-text-direction` becomes **ACCEPT AND HONOUR** -- in as a settings
  entry with an inert-today disclosure, out only as an addon control. Dual build
  ruled out by a shipped artifact (the side-by-side `Rtl` story). `:dir()`
  re-opened, needing no decision reversal. `verify-foundation-parity.mjs`'s
  `text-align` mapping **blesses the worst defect class** -- recorded as a known
  defect with no M002 code change and a do-not-propagate constraint.
- **T15 (settings).** M002 owns **NOTHING** of the settings API. Seven
  non-foreclosure constraints, all zero-cost but one (two README sentences).
  `_theme.scss` stays a **DATA** module -- a module consumers READ can never be
  the one they CONFIGURE. Today's **silent ignore** is documented as a named
  known limitation, which is M002's one positive obligation under the
  seamless-migration constraint.

### The six deliverables, all present

1. **R009 sharpened.** Control table is now the three-column form (Foundation
   global / how it reaches Button's mixin today / default / wire format) with
   the NF7 footnote that the global column is **vocabulary, not wiring** (those
   names are provably inert as inputs). Delivery shape names the
   `THEMEABLE_MODULES` list, the N-entry-point generator, the ordered
   config-first entry string, the self-tuning coalescer, and the never-compiled
   default theme. Preset model unchanged in substance, with the probe corrected
   to the global names. `$global-text-direction` is an explicit, reasoned
   exclusion. Validation mapped to P1-P8 / G2a.
2. **R021 sharpened** to four lanes on ticket 04's harness, plus: a new lane-1
   assertion that the generated sources module contains `nfs:/_theme.scss`;
   module-agnostic subject framings; "no literal file count" as a gate rule; the
   do-not-narrow constraint on `test-browser` (it is the only place a CSS
   validity oracle can live); and one conditional island-preamble item that
   cannot fire until component #2.
3. **Decision list D032-D040** in the register's exact eight-column shape.
   **D031 is the highest existing row [verified], so D032 is next free.** D033 /
   D034 / D035 carry rewritten Choice and Rationale text; **D037** ($global-text-
   direction contract), **D038** (no cache / pool / pre-compile), **D039**
   (cross-component RTL strategy) and **D040** (settings scoping + seven
   non-foreclosure constraints) are new. The optional R026-boundary split is
   renumbered to **D041**.
4. **D023 closure statement**, clause by clause, and the discharge is now
   **stronger**: the palette ships as a *theme* artifact rather than as a member
   of one component's module, still reaching its axe proof through the real
   `exports`-gated subpath in CSR and SSR. The three `expectedContrastFailures`
   literals remain **FROZEN**.
5. **Requirements touched but not owned** -- R003, R008, R026, R019, R007 and
   now **R004** -- flagged, not edited. Plus the two changes to EXISTING wiring
   (port-4400 refactor; the atomic 3-part demo rewire, whose part 1 now also
   adds the `exports` key) and a third flagged item: the latent
   **under-imported island** T13 found (needs sassy-lists + typography for
   EMISSION, +8 ms once, invisible until component #2, and inside the Worker
   where the diagnostic degrades).
6. **D020 recorded as load-bearing, unusual and costed**, reinforced from a new
   angle -- T13 showed compile time goes into exactly the palette colour math
   the payload exists to evaluate, which strengthens both the justification and
   the single revisit condition. 802 KiB gzip / 436 KiB brotli remains
   authoritative (ticket 03's ~916 KiB was a raw-file estimate); the emitted
   worker chunk is ~825 KiB gzip today, ~890 KiB at full coverage. D020's scope
   is clarified: it governs the *theming surface*, so a direction-sign custom
   property is not forbidden by it.

### Also carried

- **A dedicated section 8 for the cross-ticket coupling neither T14 nor T15 owns
  alone:** `button-group`'s RTL defects are LATENT and activated by consumer
  settings, and a seamless settings surface is precisely what activates them --
  so the settings milestone's success condition is the RTL milestone's trigger.
  Four consequences, including that no fixed-settings gate can bound the class.
- **VERIFIED vs INFERRED** as its own section, including the four items
  untestable under the no-code-changes constraint, T13's caveat that every
  multi-component performance figure is a **projection** anchored on one measured
  Worker median, and **four** silently-green failure classes (the fourth being
  browser-dropped invalid CSS, not gated in M002 and not required to be).
  Ticket 07's `exports`-partial-name inference graduates OUT as VERIFIED TRUE.

### Fog and scope

**`map.md`'s "Not yet specified" is empty and stays empty** -- re-checked after
the corrections. The four correction tickets opened no new fog: everything they
deferred is deferred to a **named owner** (a later milestone, or a
component-onboarding obligation), which is a scope ruling rather than an
unknown. **"Out of scope" was updated**: the withdrawn `theme()`-API entry is
re-made on T15's grounds, and four new rulings are recorded (cross-component RTL
design, performance machinery, direction as an addon control, and the settings
API itself), each with its owner.

The map is closed. Nothing remains before M002 milestone planning.
