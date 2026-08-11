# Decision: what Vitest proves, what Playwright proves (R021)

Type: research
Status: open
Blocked by: 04, 09

## Question

R021: "M002 theming addon verified via Vitest unit tests **and** Playwright e2e
tests exercising it in Storybook", because "Storybook interaction/play-function
testing doesn't cover the addon's runtime Sass compilation and browser-level
behavior".

Split the verification surface and name the targets.

**Vitest half** -- compilation and logic, no browser UI:

- Compiling a control set to CSS produces the expected declarations.
- Preset seeding produces the expected resolved control set.
- **Preset-equality logic**, which ticket 09 establishes is derived rather than
  stored -- exactly matching values marks a preset selected; one differing value
  does not; a sparse preset resolves against defaults before comparison.
- Invalid input handling (bad hex, out-of-range radius, Sass compile errors).
- **Which of THREE lanes each test belongs to.** Ticket 04 corrected this
  ticket's original "Vitest = no browser" framing: this repo has *two* Vitest
  lanes -- `test` (jsdom) and `test-browser` (real Chromium, already used for
  the hydration specs) -- plus the new Playwright lane. The real axis is "no
  Storybook **manager**", not "no browser". Assign each assertion to the
  cheapest lane that can actually run it, and note that in-browser Sass may not
  run under jsdom at all, which would force compilation tests into
  `test-browser`.

**Playwright half** -- in-Storybook browser behavior, using whichever harness
ticket 04 recommends:

- Changing a control actually changes rendered button styling (assert computed
  styles, not just DOM presence).
- Preset selection seeds every control.
- Controls remain tweakable after seeding, and the preset stops reading as
  selected once one value diverges -- the brief's central behavioral claim.
- The addon works in the **static Storybook build**, not just the dev server.
  Ticket 04 proved its harness against the *dev* server only and explicitly left
  the static build unconfirmed, so require a first run against
  `static-storybook` rather than assuming the same manager bundle behaves
  identically.

Inherit two hazards from ticket 04 rather than rediscovering them: the
**port-4400 collision** between the existing `test-storybook` target and the new
Playwright lane (both start their own `static-storybook`), and the **0.25s
`background-color` transition** on Foundation's `.button`, which makes one-shot
`getComputedStyle` reads return stale values -- assertions need auto-retrying
`toHaveCSS`/`toPass`.

**Reusable harness (ticket 01):** the reference project shipped its addon with
zero tests, so there is nothing to borrow there. But this repo's own
`scripts/verify-foundation-parity.mjs` already runs `sass.compileString`
Node-side -- evaluate it as the base for the compilation half rather than
building a new harness.

**Readiness gating (ticket 01):** every style-dependent assertion must wait on
an explicit readiness signal, not a timeout. Compilation is async from the
test's point of view even when the compile call is sync, and this compounds with
ticket 04's transition-flake hazard. Decide the signal the addon exposes for
tests to await.

**Also decide:**

- **Anti-vacuity.** M003's RTL specs assert both a non-zero value and a
  ltr/rtl difference precisely so a spec cannot pass against an empty
  stylesheet. Apply the same discipline: what makes each assertion fail if the
  addon silently emits nothing?
- **D023's axe obligation.** "The axe suite runs against the compliant theme for
  its zero-violations proof." Once the compliant theme is a *selectable preset*
  rather than a compiled stylesheet, what does that mean concretely -- does the
  existing `@storybook/addon-a11y` scan or the `nfs-demo` axe fixture get
  re-pointed at the addon-applied preset? Decide it here; it is the last
  undischarged piece of D023 after ticket 07 creates the source.
- **Nx target wiring** -- new targets, and what they attach to (`lint`'s
  `dependsOn` already carries `verify-foundation-parity` and
  `verify-exports-map`).

## Notes

Do not design the harness here -- ticket 04 does that. This ticket decides
*what is proven where*, given the harness.
