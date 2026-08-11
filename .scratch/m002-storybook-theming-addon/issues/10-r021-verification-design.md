# Decision: what Vitest proves, what Playwright proves (R021)

Type: research
Status: resolved
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

  Ticket 07 strengthens the available proof and adds one hard constraint:

  - `apps/nfs-demo` consumes a **real published tarball**, not the workspace
    (D014/D015, gated by `verify-registry-consumption.mjs`). So the existing axe
    fixture already exercises the real `exports`-gated public subpath in both
    CSR and SSR -- a stronger D023 proof than a Storybook-only scan. Weigh
    keeping it there rather than moving it.
  - Re-pointing the demo app's `styles.scss` at `$compliant-palette`
    **hard-fails against a stale tarball**, so it is one atomic 3-part change
    including a `verify-registry-consumption` re-run. Verification must cover
    that, not assume the tarball is fresh.
  - **The default theme's three `expectedContrastFailures` literals must NOT be
    collapsed** into the shared palette map. An exact-set assertion has to name
    what it expects, or it stops failing loudly on a new Foundation value --
    which is precisely what D023's "never a blanket suppression" clause forbids.
- **Nx target wiring** -- new targets, and what they attach to (`lint`'s
  `dependsOn` already carries `verify-foundation-parity` and
  `verify-exports-map`).

**The addon-load assertion (ticket 06).** A green build does not prove the addon
loaded -- an unresolvable addon only warns, and a crashing manager entry is
swallowed by an esbuild-injected try/catch. Ticket 06 identified the precise
target: `sanitizeBase`/`wrapManagerEntries` predicts
`sb-addons/packages-ngx-foundation-sites-storybook-<N>/manager-bundle.js`, where
**`<N>` is an order-dependent index -- so glob and content-match on `ADDON_ID`,
never hard-code the path.** Ticket 06 specifies three layers; adopt or revise
them deliberately:

1. A build-artifact check (new `verify-*.mjs`, `dependsOn: build-storybook`,
   modelled on the existing `verify-autodocs-coverage`).
2. A Playwright manager-page check that includes **zero manager
   `console.error`** -- the only layer that catches esbuild's try/catch
   swallowing a crashing entry.
3. A mandatory negative control, in keeping with this repo's existing practice
   (M001/S11 proved its zero-console-error check by deliberately breaking it).

## Notes

Do not design the harness here -- ticket 04 does that. This ticket decides
*what is proven where*, given the harness.

## Answer

Full reasoning: `../research/10-r021-verification-design.md`.
Probes: `../prototypes/lane-probe/`.

**The lane boundary moved in BOTH directions, and both moves are measured.**
The `test` (jsdom) lane resolves the **Node** sass build and compiles the real
`theme()` chain from the in-memory map to the same **5839 bytes / sha256
`49bfb1a2e67bf91a`** as ticket 05's four producers, with ticket 07's custom
`functions` capture working too -- so the ticket's "in-browser Sass may not run
under jsdom" worry is moot and **all** compilation, preset, equality, validation
and error-shape assertions land in the cheapest lane. But **jsdom DISCARDS
`@layer`-wrapped rules** (a layered-only rule computes `rgba(0,0,0,0)`), so
every R008 cascade assertion there would be vacuously green -- an earlier probe
pass reported "unlayered wins" in jsdom and it was true for the wrong reason.
Cascade goes to `test-browser`, which additionally resolves the **browser** sass
build (the artifact the Worker ships) and has a real `Worker`. Also verified:
loading both sass entries in one context throws at
`sass.default.js:4` -- `globalThis._cliPkgExports.pop()`.

**Playwright owns only the manager**: addon load (panel tab + zero manager
`console.error`), control -> computed style with a pre/post differential, preset
seeds all six controls, tweak-then-restore flipping `Custom` -> `WCAG-compliant`
(the derived-selection proof), and the `?globals=` round trip -- all against
`static-storybook`, so it is the static-build proof.

**Two vacuity traps found in the inherited gate design.** `iframe.html` has
**zero** `<script src=...>` -- it loads via `import './...'` in a
`<script type="module">` -- so ticket 08's assertion 2 as written would pass
forever. And the addon bundle path carries an order-dependent index, so
`verify-theming-bundle` globs `sb-addons/*/manager-bundle.js` and content-matches
`ADDON_ID` (verified to survive minification), asserts exactly one match, and
asserts `index.html` **imports** it (the `modulepreload` link is only a hint).
Rule adopted: every absence assertion is preceded by a presence assertion over
the same collection.

**New standing guard for the ESLint cwd class:** run the exempt file through the
live config under BOTH a package-relative and a workspace-root-relative path in
one process. Executed -- the config-dir-relative glob scores 0/2, the
`**/`-prefixed one 0/0. Plus a one-line static assertion that every `ignores`
glob starts with `**/`. Green-test/red-lint cannot recur silently.

**D023: the axe proof STAYS in `apps/nfs-demo`.** Nothing is re-pointed. The
tarball route already scans the compliant palette through the real
`exports`-gated subpath in CSR and SSR; an addon-driven scan would re-measure
colours already measured, through an async-Worker-probe wait. The preset is
bound to the axe-proven palette by a millisecond unit assertion (the addon seeds
exactly `#238648` / `#9e6c00` / `#cb4b37`) plus one Playwright rendered-colour
assertion. The default theme's three `expectedContrastFailures` literals are
frozen -- an exact-set assertion must name what it expects.

**Port 4400:** refactor `test-storybook` off `concurrently` onto
`dependsOn: ["verify-autodocs-coverage", "static-storybook"]` (verified
`continuous: true`), keeping `wait-on tcp:4400` because Nx's ordering is
start-based, not readiness-based. One server, both lanes, same artifact.
