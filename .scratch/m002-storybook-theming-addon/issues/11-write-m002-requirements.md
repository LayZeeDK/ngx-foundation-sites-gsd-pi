# Write M002's locked decisions and sharpened requirements

Type: task
Status: open
Blocked by: 06, 07, 08, 09, 10

## Question

Nothing left to decide -- this is the hand-off. Turn the map's resolved
decisions into the artifacts `/gsd plan M002` consumes.

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
