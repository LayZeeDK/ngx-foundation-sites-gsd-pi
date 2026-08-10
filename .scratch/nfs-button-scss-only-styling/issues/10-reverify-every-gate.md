# Re-verify every requirement gate end to end

Type: task
Status: resolved
Blocked by: 09, 13

## Question

Run the full battery and get it green. The destination is "verified", not
"implemented", and this effort touches the proof of nine validated requirements,
so a partial pass is a failed ticket.

- `npx nx run ngx-foundation-sites:lint` (chains `verify-browserslist`, R022)
- `npx nx test ngx-foundation-sites` (49 unit tests at last count)
- `npx nx run ngx-foundation-sites:test-browser` (real Chromium, R018's
  partial-hydration and event-replay specs)
- `npx nx build ngx-foundation-sites` (ng-packagr, plus whatever
  `compile-default-css` became)
- `npx nx run ngx-foundation-sites:test-storybook` (R006; the `.storybook/test-runner.ts`
  preVisit hook fails any story emitting a browser console error)
- **R006 requires stories to cover RTL, and they currently do not.** Graduated from the
  map's fog: RTL used to be a dual-file build artefact invisible to Storybook, but under
  ticket 03's mechanism it is part of the single component stylesheet, so a story can and
  should exercise it. Add either a global `dir` decorator with an RTL story or a dedicated
  RTL story, and assert mirroring in its play function the same way the Playwright RTL
  spec does -- reading `marginLeft`/`marginRight` on a `.dropdown` instance's `::after`,
  and **not** `float`, which resolves to `inline-end` in both directions. Keep it cheap:
  one story plus one play function, not a parallel test suite.
- `npx nx run ngx-foundation-sites:compodoc` (R007)
- The `apps/nfs-demo` Playwright suite against the **Verdaccio-installed**
  package, not source -- `nfs-button.spec.ts` (R008: the `#2a5db0` theme
  override plus RTL), `nfs-button-a11y.spec.ts` (R003: axe, zero
  critical/serious), `nfs-button-rtl.spec.ts` (R004: computed-style mirroring).
  D014/D015 make this isolation deliberately fragile -- the app's `.npmrc`
  points at `http://localhost:4873` and its tsconfig must not inherit the source
  path mapping -- so confirm it really resolved the built package and did not
  silently fall back to workspace source.
- **The full six-host matrix from ticket 13**, since a style pipeline can pass
  every target above and still break in a mode nothing exercises: SSR
  production-like host, static-serve production-like host, Vite dev server in CSR
  mode, Vite dev server in SSR mode, plus the two Storybook forms already covered
  by `storybook` and `test-storybook`. Run the style/theming/RTL/a11y assertions
  against each and report per host, not just per requirement. A host that is
  merely "expected to work" counts as unverified.

**`@layer nfs-defaults` is retained -- gate withdrawn.** An earlier revision of this
ticket required replaying the R008 cascade reproduction before deleting the layer.
The compile-time-only theming decision removes the reason to delete it, so R008
stands as recorded and there is nothing to replay. What *does* still need proving is
the positive case: that a consumer's compile-time-themed, unlayered recompile beats
the `styleUrl`-delivered layered default. That is already the substance of the
theming e2e assertion below -- keep it, and make sure it runs in a host where the
component `<style>` lands after the global stylesheet, which ticket 01 confirmed is
the normal ordering.

**Close R003's palette coverage gap, and expect a real AA failure.** Ticket 14
established that R003's axe scan never covered the palette variants added in
S15/D017: its recorded proof lists only "primary/secondary, hollow, tiny/small/large,
disabled button, disabled anchor". `success`, `warning` and `alert` have never been
scanned. Add all three to `apps/nfs-demo/e2e/nfs-button-a11y.spec.ts`, in both fill
and hollow forms.

Expect `alert` to fail. Independently verified true WCAG 2 ratios at each member's
Foundation-picked pairing (`tmp/wcag-check.mjs`):

| member | picked pairing | true ratio | AA normal (4.5) |
|---|---|---|---|
| primary | white on `#1779ba` | 4.647 | PASS |
| secondary | white on `#767676` | 4.504 | PASS by 0.004 |
| success | black on `#3adb76` | 10.912 | PASS |
| warning | black on `#ffae00` | 10.659 | PASS |
| **alert** | **white on `#cc4b37`** | **4.498** | **FAIL by 0.002** |

Foundation's quantisation to one decimal reports `alert` as `4.5`, which hides the
shortfall; axe computes precisely and should flag it. This is upstream Foundation
palette behaviour, not a regression introduced here -- so **do not silently "fix" it
by altering Foundation's default palette**, which would violate D017. Note `secondary`
passes by 0.004, so treat any change to the luminance path as capable of flipping it.

**The hollow variants are the bigger problem, and they are worse than `alert`.** A
hollow button uses the palette colour as its **text** colour on the page background,
so the pairing is entirely different from the fill variant. Measured (`tmp/alert-options.mjs`),
palette colour as text on a `#fefefe` page:

| member | hollow rest-state ratio | AA (4.5) | AA-large (3.0) |
|---|---|---|---|
| primary | 4.647 | PASS | PASS |
| secondary | 4.504 | PASS | PASS |
| **success** | **1.799** | **FAIL** | **FAIL** |
| **warning** | **1.842** | **FAIL** | **FAIL** |
| alert | 4.498 | FAIL | PASS |

`hollow success` and `hollow warning` are around 1.8:1 -- effectively illegible, and
failing even the 3.0 large-text floor. No text-colour choice fixes them, because the
failing colour *is* the palette colour: pure `#ffffff` as page background only moves
them to 1.814 / 1.857. Only substantially darkening `$success-color` and
`$warning-color` would help, which is a real change to Foundation's design values.
Foundation's hollow **hover** state uses `scale-color($color, $lightness: -50%)` and is
much darker, so hover is fine -- the rest state is the failure.

**The remediation is settled -- do not re-open it.** User decision: Foundation's
default theme ships **unchanged**, and WCAG-compliant prebuilt theme(s) are deferred to
a later milestone. So do not darken `$alert-color`, do not swap `#fefefe` for
`#ffffff`, and do not touch the palette. The three shortfalls ship knowingly.

Scan fill **and** hollow for all five members so the true surface is visible, then wire
the gate as an **exact expected-failure set**:

- Assert that axe's colour-contrast violations are *exactly* the three known ones --
  `alert` fill, `alert` hollow, `hollow success`, `hollow warning` (four selectors,
  three distinct colour pairs). Pin the expected set explicitly in the spec.
- **Do not disable the colour-contrast rule**, and do not add a blanket suppression.
  Either would hide genuine future regressions and would rot silently. An exact-set
  assertion fails loudly when a new failure appears, when Foundation's values change,
  or when a compliant theme lands -- each of which should force a deliberate update
  rather than passing unnoticed.
- Keep the assertion for everything that *does* pass: `primary` and `secondary` fill,
  `hollow primary`, `hollow secondary`, all sizes, and the disabled states, which is
  what R003's original scan covered.
- Leave a comment in the spec pointing at M002's compliant theme, so the next person
  understands the expected failures are a recorded decision rather than neglect.
- **Parameterise the spec by theme.** M002 ships a WCAG/axe-compliant theme and will
  add a second axe run against it asserting **zero** violations, while this
  default-theme run keeps asserting the exact known-failure set. Structure the spec so
  that is an added fixture, not a rewrite: theme applied as a parameter, expected-failure
  set as data per theme. Doing this now costs almost nothing and saves M002 from
  reworking the gate.

Report to the user afterwards: R003 is recorded as *validated* with wording that says
"not just Foundation's own accessibility baseline", and the default theme does not meet
that for these three variants. `.gsd/` is read-only, so R003's scoping is a report, not
an edit.

**Fix the RTL gate before trusting it.** Ticket 03 established that
`apps/nfs-demo/e2e/nfs-button-rtl.spec.ts` does not currently gate mirroring: it
reads only inline-symmetric properties off a plain button, and `app.component.ts`
contains no `.dropdown` instance at all, so the spec passes under every candidate
mechanism *and* under no mechanism. R004 is presently validated by a test that
cannot fail. Add a `.dropdown` instance to the demo app and assert
`marginLeft`/`marginRight` on `::after`. Do **not** assert `float`: under the
recommended logical-property mechanism `getComputedStyle(el, '::after').float`
returns `"inline-end"` in both directions, so a `float` assertion would either
pass vacuously or fail misleadingly.

**Run RTL under WebKit and Firefox, not just Chromium.** Every browser observation
behind the RTL recommendation is headless Chromium. `float: inline-start/end` and
`:dir()` both resolve as supported across all 125 browserslist targets, but that
is a support-table claim, not an observation. Add `webkit` and `firefox` Playwright
projects for the RTL spec specifically.

The theming e2e is the sharpest gate: `apps/nfs-demo/src/styles.scss` currently
themes via `@use 'ngx-foundation-sites/scss/nfs-button' with ($primary-color: #2a5db0)`.
Ticket 06's architecture may change that consumer-facing syntax, in which case
update the demo app to the new public API and keep the assertion -- the assertion
is the requirement, the syntax is not.

Report per-requirement pass/fail. Any gate that cannot pass is a finding to
surface, not a line to soften.

## Answer

Four commits on `feat/scss-only-button-styling`. **Every requirement gated and green.**

R001, R004, R005, R006, R007, R008, R010, R018, R020, R022, R024, R025 (by its own
stylesheet-lifecycle exception) and R026 all pass. R003 passes *as gated*, with its wording
still unmet by the default theme -- see below.

Totals: `nfs-demo:e2e` **36 passed** (4 hosts x 8, plus 2 WebKit and 2 Firefox), `test`
43/43, `test-browser` 2/2, `test-storybook` **17/17** (was 16), `lint` on both projects,
`build`, `build-storybook`, `compodoc`, and `verify-registry-consumption` across both the
CSR and SSR bundles.

### The expected-failure set was THREE, not four -- my prediction was wrong

Axe matched the encoded set **exactly on all four hosts**, but with three members:

| variant | foreground | background | axe ratio |
|---|---|---|---|
| `alert` (fill) | `#fefefe` | `#cc4b37` | 4.49 |
| `hollow-success` | `#3adb76` | `#ffffff` | 1.81 |
| `hollow-warning` | `#ffae00` | `#ffffff` | 1.85 |

**`hollow-alert` passes**, and the reason matters beyond this ticket: a hollow button pairs
its text against the **page** background, not against any colour the library controls. The
library ships no global styles, so every host renders on the browser's pure-white canvas.
`#cc4b37` on `#ffffff` is 4.537 and passes; on Foundation's `#fefefe` body background it is
4.498 and fails. The earlier prediction of four failures silently assumed that `#fefefe`
body background, which exists only if a consumer imports Foundation's own global styles.

**So hollow-variant contrast is a function of the consumer's page background.** That is a
documentation obligation, not merely a test detail -- handed to ticket 11.

The agent correctly **declined to add `body { background: #fefefe }`** to manufacture the
predicted failure, which would have been fabricating the measurement. The 0.037 boundary is
recorded in the fixture so a future fourth entry reads as a page-background change rather
than a palette change.

The set is keyed on a `data-a11y-variant` attribute, because axe's own `target` selectors
are positional. The contrast rule is **not** disabled and there is no suppression; a
separate test still asserts zero critical/serious violations outside contrast. The spec is
parameterised by theme (`themes[]` with `expectedContrastFailures` as data, `path` as the
seam), so M002 adds a fixture with `[]`.

### R004's gate can now actually fail

Dropdown instance added, margin mirroring asserted, `float` deliberately not asserted.
**Anti-vacuity proven**: forcing the pre-ticket-03 physical `margin-left: 1em` over the
shipped rule makes the RTL arrow report `14.4px / 0px` -- identical to LTR instead of
mirrored -- tripping four of six assertions.

### Cross-engine RTL, and a real WebKit defect in the first draft

Chromium **151.0.7922.34** on all four hosts, plus WebKit **26.5** and Firefox **153.0** on
the production static host. Nothing skipped.

WebKit snaps this margin to 1/64 px, so `margin-inline-start: 1em` serialises as `14.4px` on
one arrow and `14.390625px` on the other, non-deterministically which. Chromium and Firefox
report `14.4px` on both. Assertions now compare parsed numbers with a 0.05 px tolerance.
Also confirmed in **all three** engines: `getComputedStyle(el, '::after').float` is
`inline-end` in both directions -- so ticket 03's ban on asserting `float` holds
cross-engine, not just in Chromium.

### Findings to surface

- **R003 needs scoping.** It is recorded as *validated* on wording that says "not just
  Foundation's own accessibility baseline", from a scan covering none of the failing
  variants. The gate is honest now; the requirement text is not. `.gsd/` is read-only.
- **`hollow-alert` at a `#fefefe` page background is unverified here** -- no host renders
  that background, so the 4.498 shortfall for that pairing is arithmetic, not observation.
- **WebKit/Firefox cover one host, not four** -- deliberate: the engine is orthogonal to
  Angular's delivery mechanism, which the four Chromium projects already cover four times
  over.
- **The Storybook RTL story runs in Chromium only** -- `@storybook/test-runner` has no
  multi-engine mode; cross-engine RTL is the Playwright projects' job.
- `@storybook/addon-a11y` independently flags the same `#cc4b37` shortfall on the `Alert`
  story, as a *warning*, since a11y test mode is not `error`. Deliberately not promoted to a
  second enforcing gate -- the Playwright exact-set assertion already owns those three
  failures, and a second source of truth would double the update cost when M002 lands.
- `local-registry` remains broken as ticket 13 described. Verdaccio was started directly, so
  `ensureRegistryRunning` short-circuited and the user `~/.npmrc` was never modified --
  confirmed byte-identical before and after.
