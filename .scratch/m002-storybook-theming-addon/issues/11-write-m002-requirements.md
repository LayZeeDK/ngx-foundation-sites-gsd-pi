# Write M002's locked decisions and sharpened requirements

Type: task
Status: resolved
Blocked by: 06, 07, 08, 09, 10

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

Hand-off written to `../HANDOFF.md`. Route-agnostic throughout: it states what
must end up in GSD, never which interface applies it. No repo file outside
`.scratch/` was touched; `.gsd/` was read only.

**All six deliverables produced.**

1. **R009 sharpened.** The curated set is now an exact six-row table (primary /
   secondary / success / alert / warning -> `$background` and `$palette` keys,
   plus radius -> `$radius`), each with its Foundation default and its wire
   format -- no "etc.", and font-size / padding / hover-lightness explicitly
   excluded as API growth. Delivery shape is named (workspace-local,
   `.storybook/`-resident, auto-discovered, no new package or exports-map
   change). The preset model is stated with its derived, never-stored
   "selected only on exact match" semantics, the canonical-minimal sparse map
   that makes sparse equality *equal* resolved equality, the literal `Custom`
   entry, and the by-design `loading -> ready` first panel open. Validation is
   mapped to named P1-P8 / G2a assertions instead of `unmapped`.
2. **R021 sharpened** to ticket 10's FOUR lanes on ticket 04's harness, each
   naming what it proves and why it is the cheapest lane that can fail for the
   right reason: `test` (jsdom, Node sass build, all compilation/preset/
   equality/validation/error-shape), `test-browser` (browser sass build, real
   `Worker`, and the only real cascade -- jsdom **discards** `@layer` rules),
   Playwright at `apps/nfs-storybook-e2e/` (manager only, against
   `static-storybook`, which makes it the static-build proof), and build-time
   gates (`verify-theming-sources`, new `verify-theming-bundle`). Both vacuity
   traps, the anti-vacuity discipline, and the five-entry negative-control
   evidence file are carried as requirement text.
3. **Decision list D032-D036**, one per resolved ticket 06-10, in the register's
   exact eight-column shape (`# | When | Scope | Decision | Choice | Rationale |
   Revisable? | Made By`). D031 is the highest existing row, so D032 is next
   free. Each entry states which standing HUMAN decisions it operates under
   (D020 / D023) and that it re-decides neither. One optional split is flagged
   rather than taken: research/09 G.6 wants R026's newly-drawn boundary as its
   own row; it lives as clause (f) of D035, with the split spelled out if the
   planner prefers it findable.
4. **D023 closure statement**, clause by clause. Clause 1 untouched and green
   *for the right reason* (`verify-foundation-parity` is declaration-level and
   structurally blind to a variable). Clause 2 becomes literally true --
   `$wcag-palette` ships in the tarball's `scss/_button.scss`. Clause 3 is
   discharged **in place**: the axe proof STAYS in `apps/nfs-demo`, nothing is
   re-pointed, and the preset is bound to it by a three-link identity chain
   (fixture -> unit identity assertion -> rendered-colour assertion) rather than
   a second scanner. The default theme's three `expectedContrastFailures`
   literals are stated as **FROZEN**, with the reason (an exact-set assertion
   sourcing its expectations from the map under test asserts its input against
   itself -- the subtle form of the blanket suppression D023 forbids).
5. **Requirements M002 touches but does not own** -- R003 (its scoping note goes
   stale the moment M002 lands), R008, R026, R019, R007 -- flagged in a table,
   not edited. Plus the two items that change EXISTING wiring, each with its own
   section: the **port-4400 collision** (refactor `test-storybook` off
   `concurrently` onto `dependsOn: static-storybook`, keep `wait-on`, named
   fallback if continuous-task sharing misbehaves) and the **atomic 3-part
   demo-app rewire** (add the constant -> re-run
   `verify-registry-consumption` and commit refreshed evidence -> re-point
   `styles.scss`; no gate, the sequencing IS the requirement).
6. **D020 recorded as load-bearing, unusual and costed.** Zero Storybook addons
   compile Sass in the browser; no first-party design system ships a compiler
   (all chose the CSS-custom-property mechanism D020 forbids); the one
   architectural precedent is dead since 2021 and its author published an
   abandonment report. The section names exactly where the browser compiler
   earns its keep (evaluating Foundation's own `scale-color` /
   `color-pick-contrast` against live input) and the single condition under
   which D020 should be revisited (if the controls ever reduce to literal
   pass-through values). The payload cost is attributed to **D020, not to the
   addon**. Number hygiene applied: **802 KiB gzip / 436 KiB brotli** (ticket
   05, measured) is authoritative; ticket 03's ~916 KiB was a raw-file estimate.

**The fog is closed -- all three items, none silently dropped.**

- **Preset extensibility and persistence** -- SPLIT, and reconciled with ticket
  09 rather than treated as untouched. **Persistence is answered**: the URL is
  the mechanism, the sparse canonical-minimal map makes post-reload state
  byte-identical to in-session state, globals survive story navigation, no
  `localStorage`. The "one invalid value drops the ENTIRE theme" hazard is
  named and mitigated by making the panel the validation boundary, which turns
  the shareable-link guarantee total. **User-saved presets ruled OUT OF SCOPE**
  (new line in map.md).
- **Behavior as more `nfs-*` components land** -- folded into R009. The control
  surface is **global by decision, not by accident** (the addon passes no
  `$selector`), with three grounds recorded. Growth to a second theme mixin is a
  bounded open question explicitly outside M002 scope; per-component control
  surfaces ruled out of scope.
- **Docs surface** -- folded into R009 as one named deliverable (a README
  section covering controls/units, presets, the exact-match rule, URL sharing,
  and the story-mode-only panel limitation). **Extending
  `verify-autodocs-coverage` ruled OUT OF SCOPE** -- that gate proves component
  input tables render JSDoc and the addon has no component; extending a docs
  gate to an undocumented surface invents the requirement.

**VERIFIED-vs-INFERRED carried forward** as its own section, including the four
items untestable under the no-code-changes constraint (sass in the *real*
preview bundle, cold HTTP-cache timing, `build-storybook` with `test: true`,
non-Chromium engines), thirteen `[INFERRED]` items with their catch mechanisms,
and the three **silently-green** failure classes whose gates are therefore not
optional (the Worker not being bundled at all with zero errors and zero
warnings; the R026 carve-out going inert under Nx's cwd; a green build proving
nothing about whether the addon loaded).

The map is closed. Nothing remains before M002 milestone planning.
