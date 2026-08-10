# Is there a CSS-native way to reproduce Foundation's `color-pick-contrast`?

Type: research
Status: resolved
Blocked by: —

## Question

Ticket 04 concluded that `color-pick-contrast` has no CSS equivalent and must stay
Sass-time in the library build. The user asks whether CSS Houdini or a similar
mechanism can resolve it instead, and has stated a **CSS-native solution is
preferred** -- a JavaScript calculation mapped to a CSS custom property is
acceptable only as a fallback.

**Foundation's algorithm, read from the clone -- more precisely specified than
ticket 04 implied.** `scss/util/_color.scss:77`:

```scss
@function color-pick-contrast($base, $colors: ($white, $black), $tolerance: 0) {
  // takes nth($colors, 1) as $best, replaces it only if
  // ($current-contrast - $contrast > $tolerance)
}
```

- `$colors` defaults to `($white, $black)` -- **white first**, so black wins only
  if it beats white by strictly more than `$tolerance`.
- `$global-color-pick-contrast-tolerance` is **0** (`scss/_global.scss:135`).
- `color-contrast()` (`:54`) is the WCAG ratio, built on `color-luminance()` (`:88`)
  -- full gamma-corrected relative luminance, `0.2126 R + 0.7152 G + 0.0722 B` over
  linearised channels, channels `round()`ed first.
- **The ratio is quantised:** `$ratio: round($ratio * 10) * 0.1`. Comparison happens
  on ratios rounded to one decimal place, and ties go to white. This is what ticket
  04 observed as "decided by a 0.1 margin" -- 0.1 is the quantisation step, not a
  coincidence.

So the target is a **quantised WCAG-luminance comparison with white-wins-ties**, not
a lightness threshold. Establish, in this order of preference:

1. **`contrast-color()` (CSS Color 5) -- SUPPORT SETTLED, do not re-measure.**
   Data from [caniuse `wf-contrast-color`](https://caniuse.com/wf-contrast-color):
   Chrome 147+, Edge 147+, Firefox 146+, Safari 26.0+, iOS Safari 26.0+; global usage
   79.67%. Shipped in *current* browsers, but nowhere near this project's 30-month
   Baseline window. Measured against the pinned 2026-05-07 set: **109 of 136 targets
   fail** (chrome 28, edge 28, firefox 27, safari 13, ios_saf 13) -- only 27 support
   it. Bisected, it does not clear a pinned-style baseline until roughly
   **2029-01-01, about 2.4 years out**. Unusable today, full stop.
   **What is still worth establishing:** which contrast algorithm it implements --
   WCAG 2 ratio, APCA, or other -- because that decides whether it will match
   Foundation's pick when it does arrive, and therefore whether it is a genuine
   upgrade path or a silent behaviour change. Spend effort there and none on support.
2. **Relative-colour clamp tricks.** The known idiom
   `oklch(from var(--c) calc((l - <threshold>) * -infinity) 0 0)` (and the HSL
   variant) forces lightness to 0 or 100, yielding black or white. Relative colours
   are now **approved** for this project (see the map's Notes), so this is live. But
   OKLCH/HSL lightness is not WCAG relative luminance. **Test it against all five
   `$button-palette` members** (primary `#1779ba`, secondary `#767676`, success
   `#3adb76`, warning `#ffae00`, alert `#cc4b37`) and report whether any threshold
   reproduces Foundation's pick for all five. Ticket 04 found `warning` sits at HSL
   L exactly 50.00% with WCAG ratios 10.7 vs 1.8, so a naive 50% threshold picks
   correctly there by luck -- check whether that luck holds across the set and for
   arbitrary consumer colours, and report the failure region.
3. **Houdini.** Confirm rather than assume: the Paint API (`css-paint-api`) paints
   images and cannot yield a value for the `color` property; the Properties and Values
   API (`@property`) types and animates custom properties but cannot branch on
   luminance. Say definitively whether either can do this, and check support against
   the pinned baseline. Also check whether container **style** queries
   (`@container style(...)`) can branch usefully -- they match declared values, not
   computed luminance, so probably not.
4. **JavaScript writing a custom property** -- last resort, and name its costs
   plainly: it runs after SSR, so the first paint carries the wrong text colour on
   exactly the property that governs legibility; it reintroduces JS into styling
   immediately after this effort removed it; and it must run per themed subtree.

**Frame the value question before recommending anything.** Contrast only needs
*runtime* computation for **consumer-supplied** colours -- the default palette is
computed by Foundation's own Sass at library-build time and baked into the `var()`
fallback. And ticket 05's theme-mixin API already gives consumers a zero-JS path:
`@include nfs-button.theme($background: ...)` runs Foundation's real
`color-pick-contrast` in the consumer's own Sass. So state explicitly what a
CSS-native contrast would *buy* over that, and whether it is worth any fidelity loss
against D017's "reuse Foundation's real mixins". If the answer is "nothing today,
but it removes the Sass requirement for token-only theming once `contrast-color()`
reaches Baseline", say that.

If a mechanism is viable but imperfect, prefer the progressive-enhancement shape the
map already describes for hover: emit the Sass-baked value first and the computed
form second, so non-supporting browsers keep the exact Foundation pick.

## Answer

Full findings (1314 lines, sections 3-10 archival):
[research/14-css-native-contrast-pick.md](../research/14-css-native-contrast-pick.md)

**Outcome: no CSS-native mechanism is adopted, and none is needed.** The
compile-time-only theming decision closed the investigation by scope rather than by
dead end; Foundation's Sass `color-pick-contrast` is the permanent answer. The
mechanism findings are retained because they document why every computed route was
rejected and what the future path costs.

### Ground truth -- the live deliverable

Dart Sass 1.102.0 against the clone at `337be7a8` (v6.9.0). Candidates are
Foundation's `$white: #fefefe` and `$black: #0a0a0a`, **not** pure white/black
(`scss/_global.scss:53,49`); tolerance `0` (`:135`).

| member | input | Foundation's pick | vs `#fefefe` | vs `#0a0a0a` |
|---|---|---|---|---|
| primary | `#1779ba` | `#fefefe` | **4.6** | 4.3 |
| secondary | `#767676` | `#fefefe` | **4.5** | 4.4 |
| success | `#3adb76` | `#0a0a0a` | 1.8 | **10.9** |
| warning | `#ffae00` | `#0a0a0a` | 1.8 | **10.7** |
| alert | `#cc4b37` | `#fefefe` | **4.5** | 4.4 |

### Foundation's `color-luminance` is not WCAG relative luminance

Its hand-rolled `pow()` (`scss/util/_math.scss:33-54`) is `nth-root(base^12, 5, 16)`
-- Newton from `x=1`, 17 iterations -- which does not converge for small inputs.
Linearised channel values 11..52 come out up to **6.73x too high** (channel 11:
0.022518 against a true 0.003347). Independently confirmed by
`@material/material-color-utilities`, which flags the same discrepancy.

**Impact is narrower than it sounds:** it changes no pick -- every independent
implementation agrees with Foundation 5/5 -- and it perturbs one reported ratio,
`primary` vs `#0a0a0a` (Foundation says 4.3, true value 4.224). Since `#0a0a0a` is
the *rejected* candidate for `primary`, nothing user-visible depends on it.

**Consequence for the test replacing `verify-parity.mjs`: assert the picked colour,
not the ratio.** Ratios are implementation-specific because of this defect; picks are
stable across implementations.

### Corrected accessibility finding -- verified independently

The agent's report implied `primary` fails AA. **It does not.** Recomputed with a
correct `Math.pow` implementation (`tmp/wcag-check.mjs`), true ratios at each
member's *picked* pairing:

| member | picked pairing | true ratio | AA normal (4.5) |
|---|---|---|---|
| primary | white on `#1779ba` | 4.647 | PASS |
| secondary | white on `#767676` | 4.504 | PASS by 0.004 |
| success | black on `#3adb76` | 10.912 | PASS |
| warning | black on `#ffae00` | 10.659 | PASS |
| **alert** | **white on `#cc4b37`** | **4.498** | **FAIL by 0.002** |

`primary`'s 4.2 was its ratio against the rejected candidate, not its shipped
pairing. The real issue is **`alert`**, and it is not caused by the `pow()` defect --
the pair is simply short of 4.5. Foundation's quantisation to one decimal reports it
as `4.5`, which masks the shortfall.

This is upstream Foundation palette behaviour, not something this library introduced.
But note **R003's axe scan never covered it**: its recorded proof lists
"primary/secondary, hollow, tiny/small/large, disabled button, disabled anchor" --
`alert`, `success` and `warning` postdate that scan (added in S15/D017), so the
variant containing the failure has never been scanned. Handed to ticket 10.

### Mechanism verdicts (archival)

- **`contrast-color()`** -- the spec leaves the algorithm **UA-defined**, explicitly
  advises against the naive WCAG 2.1 ratio while requiring AA-large; all three
  engines use the WCAG 2 ratio anyway (WebKit states it outright). Grammar is
  `contrast-color(<color>)`: **one argument, no candidate list** -- the author-supplied
  list moved to CSS Color 6, marked "Not Ready For Implementation". Ties go to white,
  matching Foundation. **But it compares against pure `#fff`/`#000`, not
  `#fefefe`/`#0a0a0a`**, shifting the decision boundary from 0.186007 to 0.179129, so
  it picks **black** for `secondary` and `alert` -- measured in Chromium 151, Firefox
  151/153, WebKit 26.5. So it is **not** a like-for-like future replacement, and being
  UA-defined it carries no stability guarantee. That answers the question this ticket
  kept open: adopting it later would be a behaviour change, not an upgrade.
- **Relative colour via `srgb-linear`** -- a mechanism this ticket did not list, and
  the only one that nearly works:
  `color(from var(--c) srgb-linear <dot-product clamp> / 1)` performs the WCAG dot
  product directly in CSS. Verified across seven engine versions from Chromium 123 up:
  5/5 on the palette, 0.33% cube-wide divergence (all of it Foundation's `pow()`
  defect), and it emits Foundation's exact `#fefefe`/`#0a0a0a`. Moot under the scope
  decision, but the strongest computed option if that ever reverses.
- **OKLCH clamp** -- works, 5/5 on the palette by luck, 2.68% cube-wide divergence
  (8.2x worse) for no support benefit.
- **HSL clamp** -- **provably infeasible**: requires a threshold both > 50.784 and
  < 50.000. **`alert` is the blocker, not `warning`** -- this corrects ticket 04.
  Separately, the widely published `calc(l - 50%)` form is **invalid CSS in all three
  engines**, because channel keywords substitute as bare `<number>` and mixing with a
  percentage is a type error.
- **Houdini -- refuted by grammar, not by support.** `paint()` produces an `<image>`
  while `color` takes a `<color>`; `@property` cannot reference another custom property
  (`initial-value` must be "computationally independent"). Support is also poor:
  `css-paint-api` fails 71/136 and Firefox has never shipped it (bug 1302328, NEW
  since 2016).
- **Container style queries** -- `<style-range>` exists but its type list excludes
  `<color>`, so a colour range is unconditionally false. Fails 46/136.

### `@material/material-color-utilities`

**It does expose real WCAG 2 primitives** -- the anticipated HCT-only negative does
not hold. `xyzFromArgb()[1]` is relative luminance x100 with the exact WCAG
coefficients (`utils/color_utils.js:25-27`) and the correct sRGB EOTF threshold;
`Contrast.ratioOfYs()` gives the ratio. Composed with Foundation's quantisation it
reproduces the pick 5/5 and the ratios 4/5, flagging `primary` -- a true positive.

**Recommendation: hand-roll ~15 lines instead of adding the dependency.** The
published 0.4.0 root barrel is broken under Node ESM
(`dynamiccolor/color_spec_2025.js:21` has an extension-less import), the export map
exposes only `"."` so the subpath workaround is fragile, and there is no
`color-pick-contrast` equivalent -- the pick/tie/quantise logic is ours either way. It
has already delivered its value here as a one-off cross-check without becoming a
dependency.

### Deferred, needs user go-ahead

Foundation's `pow()` defect is upstream-reportable. `foundation-sites` is unmaintained
and filing in a third-party repository requires explicit user confirmation, so it is
logged and not filed.
