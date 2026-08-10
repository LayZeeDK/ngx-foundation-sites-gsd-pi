# Is there a CSS-native way to reproduce Foundation's `color-pick-contrast`?

Research findings for ticket `issues/14-css-native-contrast-pick.md`.

> ## STATUS: CLOSED BY A SCOPE DECISION, NOT BY A DEAD END
>
> **A user decision landed mid-investigation: `ngx-foundation-sites` will support
> compile-time SCSS variable theming ONLY -- no runtime CSS variable theming.**
> Contrast is therefore computed by Foundation's own Sass `color-pick-contrast`
> at compile time, permanently.
>
> That eliminates every mechanism this ticket asked about **by constraint**:
> `contrast-color()`, the relative-colour clamp idiom, any other
> computed-at-render-time approach, JavaScript writing a custom property, and
> also the paired `on-<role>` token pattern -- paired tokens are a runtime-token
> pattern, so they do not apply either.
>
> **How to read this document:**
>
> | Section | Status |
> |---|---|
> | 1. Ground truth | **LIVE.** The deliverable. It is the expected-value fixture for the verification test replacing the retired `verify-parity.mjs`. |
> | 2. Foundation's `color-luminance` is not WCAG | **LIVE.** Directly constrains what a verification test may assert. |
> | 3. `contrast-color()` | **ARCHIVAL / ADVISORY.** Kept for the algorithm question only -- documentation of a possible future path, not a decision input. |
> | 4-9. Relative colour, OKLCH, HSL, Houdini, style queries, JS | **ARCHIVAL.** Preserved because they record *why* every computed route was rejected on its own merits, before the scope decision made the question moot. |
> | 10. Prior art | **ARCHIVAL.** Survey stopped on instruction. |
> | 11. Verification tooling (`material-color-utilities`) | **LIVE.** New question created by the decision. |
> | 12. Conclusion | **LIVE.** |
>
> Nothing was added to the mechanism sections after the decision. The browser
> testing and the design-system survey were both stopped on instruction.

## Answer in one paragraph

Under the compile-time-only decision the answer is moot, so the honest summary is
what the investigation established before it stopped. **A CSS-native mechanism
does exist and it was verified working** -- reading WCAG relative luminance out of
relative-colour syntax's `srgb-linear` channel keywords, exact on all five
palette members and 99.67% of the sRGB cube, in seven engine versions from
Chromium 123 up. It is not one of the four mechanisms the ticket listed. Of the
four that *were* listed, all four fail: `contrast-color()` misses 109 of 136
pinned targets **and would change which colour is picked** (measured, not
theorised); Houdini's `paint()` cannot produce a `<color>` at all; container style
queries cannot range over a colour; and JS reintroduces exactly what this effort
removed. Two things survive the decision and are the real value here: the
**ground-truth table** in section 1, and the finding in section 2 that
**Foundation's own `color-luminance` is numerically wrong** -- its hand-rolled
`pow()` does not converge for dark channels -- which means any verification test
must assert Foundation's actual output, not the mathematically correct WCAG
values.

## Method and provenance

- **Ground truth** is Foundation's own Sass, run against the clone at
  `D:\projects\github\foundation\foundation-sites`, `git log -1` =
  `337be7a8d9d20d28f5d27d2d98131a6d3772506c Fri Sep 27 11:26:03 2024 -0700 Merge tag 'v6.9.0' into develop`,
  branch `develop`, `git status --porcelain` empty. Read only -- no branch
  checked out, nothing modified.
- Compiled with **this repo's own `sass` 1.102.0**
  (`node_modules/sass/sass.js`), `--load-path` pointed at the clone's `scss/`.
- **Browser results are real `getComputedStyle` reads**, resolved through a
  canvas `fillStyle` round-trip to normalise `color(srgb-linear ...)` /
  `oklch(...)` computed values to 8-bit sRGB. Engines: Chromium 151.0.7922.34,
  Firefox 153.0, WebKit 26.5, plus **Chromium 123.0.6312.4** from the local
  Playwright build cache (`chromium-1105`).
- **Whole-cube numbers** come from a JS transcription of Foundation's Sass
  arithmetic that was **validated against real Dart Sass on 321 probe colours**
  (the five palette members, 16 greys, 240 random, 60 hand-searched
  boundary colours): picks matched **321/321**, luminance to
  `max |delta| = 5.535e-7`.
- Baseline verdicts use this repo's own `browserslist@4.28.7` +
  `caniuse-lite@1.0.30001806` against the **pinned** query
  `baseline widely available on 2026-05-07` (136 targets), cross-checked
  against `baseline-browser-mapping`.
- Throwaway probes live in the gitignored `tmp/`
  (`ground-truth.scss`, `foundation-math.mjs`, `validate-foundation-math.mjs`,
  `pick-analysis.mjs`, `contrast-baseline-audit.mjs`, `browser-contrast-probe.mjs`,
  `browser-probe2.mjs`, `hsl-form-probe.mjs`, `single-old-chrome.mjs`,
  `contrast-color-cube.mjs`). No tracked file was modified.

---

## 1. Ground truth

Foundation's real functions, evaluated by Dart Sass against the clone
(`tmp/ground-truth.scss`). `$white: #fefefe` (`scss/_global.scss:53`),
`$black: #0a0a0a` (`scss/_global.scss:49`),
`$global-color-pick-contrast-tolerance: 0` (`scss/_global.scss:135`).

| Palette member | Input | Foundation's pick | Ratio vs `#fefefe` | Ratio vs `#0a0a0a` | Margin |
|---|---|---|---|---|---|
| `primary` | `#1779ba` | **`#fefefe`** (white) | **4.6** | 4.3 | 0.3 |
| `secondary` | `#767676` | **`#fefefe`** (white) | **4.5** | 4.4 | 0.1 |
| `success` | `#3adb76` | **`#0a0a0a`** (black) | 1.8 | **10.9** | 9.1 |
| `warning` | `#ffae00` | **`#0a0a0a`** (black) | 1.8 | **10.7** | 8.9 |
| `alert` | `#cc4b37` | **`#fefefe`** (white) | **4.5** | 4.4 | 0.1 |

Supporting metrics for the same five colours, needed to judge the threshold
candidates:

| Member | Foundation `color-luminance` | True WCAG luminance | HSL lightness | OKLCH lightness |
|---|---|---|---|---|
| `primary` | 0.176991123 | 0.174020732 | 40.9804% | 55.6031% |
| `secondary` | 0.181164244 | 0.181164244 | 46.2745% | 56.5836% |
| `success` | 0.528705863 | 0.528705822 | 54.3137% | 78.7466% |
| `warning` | 0.515321038 | 0.515321038 | 50.0000% | 80.8785% |
| `alert` | 0.181453885 | 0.181453588 | 50.7843% | 58.5260% |

Three decision boundaries matter throughout, all expressed as a WCAG relative
luminance of the background:

| Boundary | Value | What it is |
|---|---|---|
| Foundation's effective crossover | **0.186006950770** | where `round(10*Rb) > round(10*Rw)` first holds, against `#fefefe`/`#0a0a0a`, with ties to white |
| unquantised crossover vs `#fefefe`/`#0a0a0a` | 0.184979000438 | `sqrt((Yw+0.05)(Yb+0.05)) - 0.05` |
| unquantised crossover vs pure `#fff`/`#000` | 0.179128784748 | what `contrast-color()` implements |

The 0.001028 gap between the first two is the **quantise-plus-tie band**: the
ticket is right that 0.1 is the quantisation step, and the band it creates is
where white wins on a tie. The 0.006878 gap between the first and third is why
`contrast-color()` cannot match Foundation -- see section 3.

### The algorithm, confirmed against the source

- `color-pick-contrast` (`scss/util/_color.scss:77-94`) seeds `$best` from
  `nth($colors, 1)` (`:79`) and replaces it only if
  `($current-contrast - $contrast > $tolerance)` (`:83`). White first, tolerance
  0, so **black must win strictly**.
- `color-contrast` (`scss/util/_color.scss:54-68`) quantises at `:65`:
  `$ratio: round($ratio * 10) * 0.1`.
- The call site is `scss/components/_button.scss:189-190`:
  ```scss
  @if $color == auto {
    $color: color-pick-contrast($background, ($button-color, $button-color-alt));
  }
  ```
  with `$button-color: $white` (`:40`) and `$button-color-alt: $black` (`:44`).
- This repo already exercises it: `nfs-button.scss` passes `auto` for `$color`
  on `success`/`warning`/`alert`
  (`packages/ngx-foundation-sites/src/scss/nfs-button.scss`, the
  `@each $name, $color in settings.$button-palette` block), while `primary` and
  `secondary` are handed `settings.$button-color` explicitly. `secondary`'s
  hard-coded white happens to equal what `color-pick-contrast` would pick, so
  the current output is correct either way.

---

## 2. Foundation's `color-luminance` is not WCAG relative luminance

**This reframes the whole exactness question and the ticket did not anticipate
it.** Foundation hand-rolls `pow()` (`scss/util/_math.scss:33-54`) as
`nth-root(base^12, 5, 16)`, where `nth-root` (`:56-65`) is Newton's method
started at `x = 1` with only **17 iterations**, and every division goes through
a hand-rolled 12-decimal long-division `divide()` (`:158-199`). For small bases
the iteration has not converged when it stops, so it returns a value pinned near
`0.8^17`:

| Channel value | Foundation's linearised value | True | Foundation / true |
|---|---|---|---|
| 10 | 0.003035270 | 0.003035270 | 1.0000 (linear branch, exact) |
| **11** | **0.022518197** | 0.003346536 | **6.73x** |
| 15 | 0.022519177 | 0.004776953 | 4.71x |
| 23 | 0.022539861 | 0.008568126 | 2.63x |
| 30 | 0.022691483 | 0.012983032 | 1.75x |
| 41 | 0.024805754 | 0.022173885 | 1.12x |
| 55 | 0.038208475 | 0.038204372 | 1.0001 |
| 121, 186, 254 | -- | -- | 1.0000 |

Channel values **11 through 52** are wrong by more than 0.1%; the effective
floor for a linearised channel is about **0.0248**. Channels 0-10 take the
`$rgb < 0.03928` linear branch (`scss/util/_color.scss:40`) and are exact;
channels 53+ converge.

Consequences:

- `primary` `#1779ba` has red = 23, inside the broken range. Foundation reports
  luminance **0.176991123** where the true value is **0.174020732**, and its
  ratio against `#0a0a0a` as **4.3** where the truth is **4.2**. The *pick* is
  unaffected (white either way), so the shipped default is still right.
- Separately, the CSS `srgb-linear` transfer function uses threshold 0.04045
  where Foundation uses 0.03928. For **8-bit** channels the two never disagree
  (10/255 = 0.039216 is below both; 11/255 = 0.043137 is above both), so this is
  a non-issue in practice. Foundation also `round()`s channels first
  (`scss/util/_color.scss:29-31`), so fractional channel inputs diverge -- also
  irrelevant for hex tokens.
- **Therefore no function of true WCAG luminance can agree with Foundation
  everywhere.** The residual 0.328% disagreement in section 4 is entirely this
  bug. Where the CSS mechanism diverges from Foundation, **the CSS mechanism is
  the more correct of the two.** "Bit-exact parity with Foundation" and
  "correct WCAG contrast" are not the same target.

---

## 3. Candidate: `contrast-color()` (CSS Color 5) -- ARCHIVAL / ADVISORY

> Retained for the algorithm question only. Under compile-time-only theming this
> is not a decision input; it documents a possible future path and, more usefully,
> records that the path would **not** be a like-for-like replacement.

**Verdict: firmly unavailable -- 109 of 136 pinned targets fail, about 2.4 years
out -- and, decisively, it will NOT reproduce Foundation's pick when it does
arrive. Adopting it later is a silent behaviour change, measured, not theorised.**

### Support -- settled upstream, not re-derived here

Taken as given from https://caniuse.com/wf-contrast-color:

| Engine | Floor | Pinned floor |
|---|---|---|
| Chrome / Edge | **147+** | 119 |
| Firefox | **146+** | 119 |
| Safari / iOS Safari | **26.0+** | 17.0 |

Global usage 79.67%. Against the pinned `baseline widely available on
2026-05-07` set: **109 of 136 targets fail, only 27 pass** -- chrome 28, edge 28,
firefox 27, safari 13, ios_saf 13. Does not clear a pinned-style baseline until
roughly **2029-01-01, about 2.4 years out**. For scale, the two baseline gaps
this project has approved were about 5 weeks (`:dir()`) and about 15 months
(relative colours), so this is an order of magnitude beyond either.

I reproduced the 109/136 split exactly from those floors against this repo's own
resolved pinned target list, so the figure is consistent with the repo's
browserslist (`browserslist@4.28.7`).

**Why a `caniuse-lite` script can never find it, worth recording for future
lookups:** the caniuse entry is a **web-features** entry, prefixed `wf-`. This
repo's `caniuse-lite@1.0.30001806` ships **zero** `wf-`-prefixed features and
zero features whose name contains `contrast` at all (verified directly). So any
audit script that walks `caniuse-lite.features` will report `[ABSENT]` -- as
`tmp/contrast-baseline-audit.mjs` does -- and that absence means "not in the
packed dataset", never "unsupported". `wf-` features must be looked up on
caniuse.com or via `web-features` / `baseline-browser-mapping`.

Measured directly, corroborating the floors: `CSS.supports('(color: contrast-color(red))')`
is **`false`** in Chromium 123, 134 and 141 (declaration dropped, preceding one
wins) and **`true`** in Chromium 151, Firefox 151, Firefox 153 and WebKit 26.5.

### Algorithm and grammar -- the narrow question, answered

**Short answer: the spec leaves the algorithm UA-defined and explicitly advises
against the naive WCAG 2.1 ratio; all three engines use the WCAG 2 ratio anyway;
there is no candidate list; and it compares against pure `#fff`/`#000` rather
than Foundation's `#fefefe`/`#0a0a0a`, which is what makes it diverge.**

**Grammar -- no candidate list.** From
https://drafts.csswg.org/css-color-5/#contrast-color:

```
contrast-color() = contrast-color( <color> )
```

> "`contrast-color()` resolves to either white or black, whichever produces
> maximum color contrast for text when the input color is used as a solid
> background. If both white and black produce the same contrast, it resolves to
> white."

So it takes **one argument**, has **no `max`, no `to`, no target-contrast
argument, and no author-supplied colour list**. It is not the analogue of
Foundation's `color-pick-contrast($base, $colors)`; it is the analogue of that
function with `$colors` hard-wired to *pure* white and black and no way to
change them. Its tie rule -- ties resolve to white -- is however **identical** to
Foundation's white-first / strictly-greater rule (`scss/util/_color.scss:79,83`).

The author-supplied-list form was moved out to CSS Color 6, which states verbatim
"Not Ready For Implementation"
(https://drafts.csswg.org/css-color-6/#funcdef-contrast-color). The reduction was
a WG resolution -- https://github.com/w3c/csswg-drafts/issues/11534#issuecomment-2625667244
("drop `max`, do white/black by default"), landed by
https://github.com/w3c/csswg-drafts/pull/11654. So the candidate list is not
coming back on any near timeline.

**Algorithm -- UA-defined at this level.** The spec deliberately does not mandate
one, and goes further by advising *against* the obvious choice:

> "The precise color contrast algorithm for determining whether to output a light
> or dark color is UA-defined at this level."

> "UAs are advised to not simply use the WCAG 2.1 section 1.4.3 Contrast
> (Minimum) contrast ratio algorithm to decide between light and dark colors, as
> it has several known issues. However, colors returned by this function should
> still meet the WCAG 2.1 section 1.4.3 Contrast (Minimum) for AA large text, as
> many authors need to meet legal requirements that mandate this."

**Every shipping engine ignores that advice and uses the WCAG 2 ratio.** WebKit
says so in its own words -- https://webkit.org/blog/16929/contrast-color/: "the
current implementation in Safari Technology Preview is using the contrast
algorithm officially defined in WCAG 2 (Web Content Accessibility Guidelines
version 2)", with the worked example "The WCAG 2 algorithm calculates
black-on-#317CFF as having a contrast ratio of 5.45:1, while white-on-#317CFF has
3.84:1. The `contrast-color()` function is simply choosing the option with the
bigger number." Blink's Intent to Ship states it reuses an existing WCAG-based
implementation matching Firefox and Safari.

**The APCA hypothesis is refuted.** WebKit's earlier `color-contrast()` was
WCAG-ratio work throughout (bugs 222530, 224411 "target contrast **ratio**",
226438 "target **luminance** keywords", then removed in 278864), and a WebKit
Bugzilla title search for APCA returns only substring false positives
("apcache", "GestureTapCancel") -- zero APCA implementation bugs. In the WebKit
article APCA appears only as a hypothetical future and as the *reason* the CSSWG
hard-wired black/white: a decision on the WCAG 3 algorithm is still being
debated, so "Keeping it simple makes it possible to swap out the algorithm
later."

**But that swap is exactly the forward risk.** Because the algorithm is
UA-defined, a future engine could legitimately move to APCA without a spec change
and silently alter which colour is chosen. So `contrast-color()` is not just
divergent from Foundation today (see below); it carries no contractual guarantee
of *staying* the same. That is a second, independent reason not to design the
token contract around it.

### Direct answer for the token-name decision

**Adopting `contrast-color()` later WOULD silently change which colour is
chosen.** It is not a drop-in upgrade path for `color-pick-contrast`. Two
independent causes, both measured:

1. **Candidate colours differ.** It compares against pure `#fff` (Y = 1) and
   `#000` (Y = 0); Foundation compares against `#fefefe` (Y = 0.991102) and
   `#0a0a0a` (Y = 0.003035). That moves the decision boundary from **0.186007**
   to **0.179129** -- a band 0.006878 wide in which the two disagree.
2. **The returned colour differs even when the pick agrees.** It emits
   `rgb(255,255,255)` / `rgb(0,0,0)`, never Foundation's `#fefefe` / `#0a0a0a`
   (verified: those are the only two distinct computed-value forms observed in
   Chromium 151, Firefox 151/153 and WebKit 26.5). So a text-equality parity test
   against Foundation's output fails on every variant, and there is no argument
   that will change it.

That is enough to settle the token-naming question now: **do not name or shape
tokens on the assumption that `contrast-color()` will one day reproduce
`color-pick-contrast`.** It will not.

### How far the divergence goes, measured

`contrast-color()` implements exactly `trueLum < 0.179128785 -> white`, confirmed
on **125/125** boundary-straddling colours in Chromium 151, Firefox 153 and
WebKit 26.5 with zero disagreement -- so its rule is now pinned empirically, not
assumed. Everything inside the 0.006878-wide band flips relative to Foundation:

```
secondary #767676  trueLum 0.181164  ->  contrast-color: BLACK   Foundation: WHITE
alert     #cc4b37  trueLum 0.181454  ->  contrast-color: BLACK   Foundation: WHITE
```

**Two of the five palette members disagree**, in every engine that supports the
function -- reproduced independently in Chromium 151, **Firefox 151**,
**Firefox 153** and WebKit 26.5 (`tmp/old-engine-probe.mjs` scores the palette as
`w b! b b b!`, the `!` marking a disagreement with Foundation). Whole-cube
(`tmp/contrast-color-cube.mjs`, 16 777 216 colours):

- disagreements with Foundation: **211 678 (1.2617%)**
- of those, 198 544 are "contrast-color says black, Foundation says white"
- `contrast-color()`'s own shipped ratio is **never** below 4.5:1 on a
  disagreeing colour (0 below 4.5, 0 below 3); worst case 4.58:1 on
  `rgb(207,57,134)` where Foundation ships 4.5:1
- scored on true WCAG against each system's own emitted colours over a step-4
  sample (262 144 colours), `contrast-color()` achieves the **higher** ratio on
  **262 144 / 262 144** -- always. Pure `#fff`/`#000` strictly bracket
  `#fefefe`/`#0a0a0a`, so it cannot lose.

So `contrast-color()` is **strictly more accessible than Foundation and
strictly not Foundation**. When it reaches Baseline in ~2028, adopting it is a
deliberate decision to stop matching `color-pick-contrast`, not a way to match
it. That is a real finding: it changes the shape of the future upgrade from
"finally exact" to "trade exactness for correctness".

Interop is also not finished -- it is an Interop 2026 focus area
(https://github.com/web-platform-tests/interop/blob/main/2026/README.md#css-contrast-color)
and WPT pass rates are 0.857 (Chrome/Edge/Safari), 0.714 (Firefox)
per https://api.webstatus.dev/v1/features/contrast-color.

---

---

> ## SECTIONS 4-10 ARE ARCHIVAL
>
> Everything below, up to section 11, was completed **before** the
> compile-time-only decision and is preserved unchanged. It is not a proposal.
> Its value is as a record of why each computed route fails on its own merits --
> so that if runtime theming is ever revisited, the ground has been surveyed and
> nobody has to re-measure it. No mechanism testing was done after the decision,
> and the design-system prior-art survey in section 10 was stopped on
> instruction.

## 4. Candidate: WCAG luminance via relative colour + `srgb-linear`

**Verdict: this is the closest mechanism that exists, it is exact on the whole
palette, it works in all four engine versions tested, and the ticket did not
list it.**

### The idea

Relative colour syntax can retarget the colour space, and `srgb-linear` is a
predefined space. So `color(from var(--c) srgb-linear ...)` hands the channel
keywords `r`, `g`, `b` as **already gamma-decoded linear-light numbers** -- the
browser performs the `pow(x, 2.4)` that CSS `calc()` cannot. WCAG relative
luminance is then a plain dot product, and the black/white selection is a
`clamp()`:

```css
.button {
  /* S == 1 -> white, S == 0 -> black; T is Foundation's crossover */
  color: color(from var(--nfs-button-background) srgb-linear
    calc(0.003035270 + 0.988066827 * clamp(0, (0.18600675 - (0.2126 * r + 0.7152 * g + 0.0722 * b)) * 1e9, 1))
    calc(0.003035270 + 0.988066827 * clamp(0, (0.18600675 - (0.2126 * r + 0.7152 * g + 0.0722 * b)) * 1e9, 1))
    calc(0.003035270 + 0.988066827 * clamp(0, (0.18600675 - (0.2126 * r + 0.7152 * g + 0.0722 * b)) * 1e9, 1))
    / 1);
}
```

`0.003035270` and `0.991102097` are the `srgb-linear` coordinates of `#0a0a0a`
and `#fefefe`; `0.988066827` is their difference. `0.18600675` is Foundation's
quantised crossover from section 1, chosen deliberately over the unquantised
0.184979 because it is what Foundation actually does.

### Measured behaviour

`tmp/browser-contrast-probe.mjs`, 135 probe colours (5 palette + 90 chosen to
straddle the threshold + 40 random):

| Engine | Palette 5/5 | vs Foundation over 135 | Implements `trueLum < T -> white`? |
|---|---|---|---|
| Chromium 151.0.7922.34 | yes | agree **133**, disagree 2 | **135/135, zero disagreement** |
| Firefox 153.0 | yes | agree **133**, disagree 2 | **135/135, zero disagreement** |
| WebKit 26.5 | yes | agree **133**, disagree 2 | **135/135, zero disagreement** |
| Chromium 141.0.7390.37 | yes | -- | -- |
| Chromium 134.0.6998.35 | yes | -- | -- |
| **Chromium 123.0.6312.4** | **yes** | -- | -- |
| Firefox 151.0 | yes | -- | -- |

Seven engine versions across three engines, spanning Chromium 123 to 151. Every
one accepts the declaration and returns Foundation's pick for all five palette
members (`tmp/old-engine-probe.mjs`, `tmp/single-old-chrome.mjs`).

The computed value reads back as e.g.
`color(srgb-linear 0.991102 0.991102 0.991102)` -> `rgb(254,254,254)` and
`color(srgb-linear 0.00303527 ...)` -> `rgb(10,10,10)`. **It emits Foundation's
exact `#fefefe` / `#0a0a0a`, not pure white/black** -- unlike
`contrast-color()`.

The two disagreements are `#af652a` and `#a8692a`. Both have blue = 42, inside
the 11..52 range where Foundation's `pow()` is broken (section 2). The mechanism
is right; Foundation is wrong.

`infinity` instead of `1e9` behaves identically in all three current engines.
`1e9` is preferable anyway: it has no NaN case, and its transition band is
1.86e-10 wide in luminance, far below the closest any 8-bit colour gets to the
boundary.

### Whole-cube agreement

`tmp/pick-analysis.mjs` over all 16 777 216 sRGB colours, comparing against the
Sass-validated Foundation model:

| Rule | Best threshold | Disagreements | Rate |
|---|---|---|---|
| HSL lightness | 43.3334% | 3 508 288 | 20.9110% |
| OKLCH lightness | 58.3417% | 449 998 | 2.6822% |
| **WCAG luminance (`srgb-linear`)** | **0.18600675** | **55 072** | **0.3283%** |
| `contrast-color()` (pure white/black) | 0.179128785 | 211 678 | 1.2617% |

### The disagreement region, explicitly

For the `srgb-linear` rule at T = 0.18600675:

- **55 072 of 16 777 216 colours (0.3283%)**.
- Direction is almost entirely one-way: **55 067** are "rule says white,
  Foundation says black"; only **5** are the reverse.
- All of them sit in a narrow luminance band, **0.171897 .. 0.186007**.
- Every one of them has at least one channel in **11..52** -- they are exactly
  the colours Foundation's `pow()` gets wrong. Examples: `rgb(0,139,11)`,
  `rgb(188,11,255)`.
- Accessibility impact is negligible and bounded: the worst case is
  `rgb(188,11,255)`, where the rule ships **4.2:1** and Foundation ships
  **4.6:1**. **Zero** disagreements fall below 3:1. For reference, Foundation's
  *own* pick is below 4.5:1 for **72 094** colours (0.43%) with a worst case of
  4.4:1 at `rgb(0,111,252)` -- so the whole disagreement region lies inside the
  band where Foundation itself is already marginal against WCAG AA.

### Support against the pinned baseline

`tmp/contrast-baseline-audit.mjs`, pinned query, 136 targets:

| Feature | No support | Partial | Verdict |
|---|---|---|---|
| `css-relative-colors` | **9/136** (firefox 119-127) | 43 | the only binding constraint |
| `css-color-function` (`color()` + `srgb-linear`) | **0/136** | 0 | clear |
| `css-math-functions` (`clamp()`) | **0/136** | 0 | clear |
| `css-featurequeries` (`@supports`) | **0/136** | 0 | clear |

So the mechanism needs **exactly the feature the map has already approved**, and
nothing else. `color()`, `srgb-linear`, `clamp()` and `@supports` are all
0/136. The 43 "partial" entries are caniuse note #2 (`currentcolor` origin,
Mozilla bug 1893966), which the map already established does not apply when the
origin is a token.

Critically, **Chromium 123 -- inside the 119-130 partial band -- runs the full
mechanism and gets 5/5**, with
`CSS.supports('(color: color(from red srgb-linear clamp(0, 0.5, 1) 0 0))')`
returning `true`. That is direct evidence the "partial" flag does not touch
nested `clamp()` in a relative-colour channel.

### Progressive enhancement works

Verified: `color: #fefefe; color: <mechanism>;` yields the mechanism's value
where supported and the baked value where not. Confirmed by the negative
control in the same run -- the HSL variant (section 6) is dropped and the
sentinel `rgb(1,2,3)` shows through, proving the drop path is real and not an
artefact. Confirmed working on Chromium 123 too. So the Firefox 119-127 gap
costs nothing and **no baseline exception has to be spent**.

### One real gotcha, and one non-issue

1. **Alpha leaks from the origin -- this is the genuine footgun.** Without an
   explicit `/ 1`, the output inherits the background's alpha. Measured with
   `--c: #1779ba80`:
   `color(srgb-linear 0.991102 0.991102 0.991102 / 0.501961)` ->
   `rgba(253,253,253,128)`. A consumer setting a translucent background token
   would get **translucent text** -- on the property that governs legibility.
   Appending `/ 1` fixes it (`alpha-origin-slash1` -> `rgba(254,254,254,255)`).
   Identical in all three engines. Note this is not hypothetical the way the
   `currentcolor` case is: a translucent background token is a perfectly ordinary
   thing for a consumer to set.
2. **Origin-colour robustness is a non-issue.** Per standing instruction, a
   consumer setting a colour token to `currentcolor` or a system-colour keyword
   is out of scope and not designed around. For the record the mechanism handles
   them anyway in every engine tested -- `--c: currentcolor` computed from the
   inherited colour, `--c: ButtonFace` gave `rgb(10,10,10)` -- and it also
   survived `--c: oklch(0.7 0.15 200)` and the out-of-sRGB-gamut
   `--c: color(display-p3 0 1 0)` without error. And the
   progressive-enhancement shape covers the case for free regardless: an invalid
   computed value is dropped and the Sass-baked declaration wins. Nothing here
   needs a guard.

---

## 5. Candidate: OKLCH lightness clamp idiom

**Verdict: works, gets the palette right, but is a coincidence -- 2.68% wrong
cube-wide, and the failures are worse than the exact mechanism's.**

`oklch(from var(--c) calc((l - 0.6) * -infinity) 0 0)` is accepted and gets
**5/5** on the palette in Chromium 151, Firefox 153, WebKit 26.5 and
Chromium 123. The `clamp()` form
`oklch(from var(--c) clamp(0, (0.6 - l) * 1e9, 1) 0 0)` behaves identically.

It works on the palette because OKLCH lightness happens to separate the two
groups cleanly:

```
white picks: primary 55.6031  secondary 56.5836  alert 58.5260
black picks: success 78.7466  warning 80.8785
feasible window: T in (58.5260%, 78.7466%)
```

That window is wide, so any T in roughly 60-78% gets all five. But the
separation is luck, not structure -- OKLCH lightness is perceptual lightness, not
WCAG relative luminance, and it emits pure `#fff`/`#000` rather than
Foundation's `#fefefe`/`#0a0a0a`.

Cube-wide at its own optimum T = 58.3417%: **449 998 / 16 777 216 = 2.6822%**
disagreement -- **8.2x worse than the `srgb-linear` mechanism**. The failures
are also materially worse:

- disagreement band: OKLCH L **54.98% .. 61.22%**
- worst shipped contrast **3.8:1** on `rgb(11,148,66)` where Foundation ships
  5.1:1
- spread across every hue sextant (magenta-red 4686, blue-magenta 3443,
  green-cyan 3218, ... in the step-3 sample), i.e. it is a systematic
  hue-dependent error, not a boundary artefact

At the "round number" T = 65% it degrades badly: **2 527 604 (15.07%)**
disagreement, with 529 colours dropping below 3:1 and a worst case of 2.9:1 on
`rgb(11,171,87)`. **Do not pick a round threshold here.**

Since the exact mechanism needs the *same* `css-relative-colors` feature and no
more, there is no support argument for accepting OKLCH's approximation.

---

## 6. Candidate: HSL lightness clamp idiom

**Verdict: mathematically impossible on this palette, AND the commonly-written
form is invalid CSS in all three engines.**

### It cannot work, provably

`tmp/pick-analysis.mjs`:

```
Foundation picks WHITE for: primary 40.9804, secondary 46.2745, alert 50.7843
Foundation picks BLACK for: warning 50.0000, success 54.3137
needs T > 50.784314 AND T < 50.000000 at once  ->  INFEASIBLE
```

`alert` (`#cc4b37`) sits at HSL L = **50.78%** and Foundation picks **white**,
while `warning` (`#ffae00`) sits at exactly **50.00%** and Foundation picks
**black**. No single threshold can satisfy both. Maximum agreement is **4/5**,
in either of two windows:

- T in (46.2745, 50.0000) -> wrong on `alert`
- T in (50.7843, 54.3137) -> wrong on `warning`

This **corrects ticket 04's framing**. Ticket 04 said a 50% threshold "gets
`warning` wrong ... by luck". In fact a 50% threshold gets `warning` *right*
(see the NaN result below) and gets **`alert`** wrong. The luck was never in
`warning`; the infeasibility is `alert`, whose HSL lightness is above 50% while
its WCAG luminance is below the crossover.

Cube-wide, HSL is hopeless regardless: best T = 43.3334% gives **3 508 288
(20.9110%)** disagreement, **1 095 123** of them below 3:1, worst case
**1.4:1** on `rgb(220,221,0)` where Foundation ships 13.6:1.

### The idiom as usually written is invalid

Measured (`tmp/hsl-form-probe.mjs`), identical in Chromium 151, Firefox 153,
WebKit 26.5:

| Declaration | Result |
|---|---|
| `hsl(from #1779ba h s calc((l - 50%) * -1000))` | **DROPPED** |
| `hsl(from #1779ba h s calc(l + 0%))` | **DROPPED** |
| `hsl(from #1779ba h s calc(l + 0))` | accepted |
| `hsl(from #1779ba h s calc((l - 50) * -infinity))` | accepted |
| `oklch(from #1779ba calc((l - 60%) * -infinity) 0 0)` | **DROPPED** |
| `oklch(from #1779ba calc((l - 0.6) * -infinity) 0 0)` | accepted |

**Root cause: relative-colour channel keywords substitute as a bare
`<number>`, not a `<percentage>`.** So `l - 50%` mixes a number with a
percentage, which is a type error, so the declaration is invalid and dropped.
`l - 50` (HSL, where `l` is 0..100) and `l - 0.6` (OKLCH, where `l` is 0..1)
both work. Every published form of this trick that writes `50%` or `60%` is
therefore dead in all three engines -- worth knowing before copying one.

With the corrected numeric form, the palette behaves exactly as the
infeasibility proof predicts:

```
warning #ffae00  L == 50 exactly -> (l-50)*-infinity == NaN
                 Chromium: color(srgb calc(NaN) ...) renders rgb(0,0,0)   -> BLACK (correct, by accident)
                 Firefox/WebKit: color(srgb 0 0 0)                        -> BLACK (correct, by accident)
alert   #cc4b37  L 50.78 -> -infinity -> lightness clamps to 0            -> BLACK (WRONG, Foundation picks white)
success #3adb76  L 54.31 -> BLACK (correct)
primary/secondary -> WHITE (correct)
```

So the NaN case resolves to **black**, not to the `+infinity` some readings of
CSS Values 4 would suggest. That is a measured result, not a spec inference, and
it is uniform across the three engines even though their serialisations differ
(`calc(NaN)` in Chromium, a resolved `0` in Firefox and WebKit).

---

## 7. Candidate: Houdini

**Verdict: definitively CANNOT, on two independent grounds each, and it fails
the pinned baseline anyway.**

### CSS Painting API -- cannot produce a `<color>`

https://drafts.css-houdini.org/css-paint-api-1/ section 5:

> `paint() = paint( <ident>, <declaration-value>? )`
>
> "The `<paint()>` function is an additional notation to be supported by the
> `<image>` type."

And `color` accepts only `<color>` --
https://drafts.csswg.org/css-color-4/#the-color-property:

> Name: `color`
> Value: `<color>`

`<image>` and `<color>` are disjoint productions, so **`paint()` is invalid in
`color`**. The ticket's assumption is confirmed by grammar.

A paint worklet *can* read a custom property -- registration step 7 filters
`inputProperties` to "supported CSS properties and custom properties", and draw
step 7 populates a **`StylePropertyMapReadOnly`**. But it cannot write anything
back: the read-only interface is the only one supplied, `PaintWorkletGlobalScope`
exposes exactly `registerPaint` and `devicePixelRatio`, and the only output is
pixels. The `color: transparent; background-clip: text; background-image: paint(...)`
workaround never sets `color`, breaks forced-colors mode and selection
rendering, and is Chromium-only. Reject.

### `@property` -- cannot branch

https://drafts.css-houdini.org/css-properties-values-api-1/ gives exactly three
descriptors: `syntax`, `inherits`, `initial-value`. Section 4.1's registration
algorithm is the crisp proof:

> "If parsed initial value is not computationally independent, throw a
> `SyntaxError` and exit this algorithm."

> "A property value is **computationally independent** if it can be converted
> into a computed value using only the value of the property on the element, and
> "global" information that cannot be changed by CSS."

> "Neither is a value with a `var()` function, because it relies on the value of
> a custom property."

`@property` cannot even *reference* another custom property, let alone compute a
luminance from one.

### Other Houdini specs, each ruled out with a citation

- **CSS Typed OM** (https://drafts.css-houdini.org/css-typed-om-1/) -- has a
  writable `StylePropertyMap` via `attributeStyleMap`, so it *can* do it, but it
  is a JavaScript API. That is candidate 9, not a CSS-native route.
- **CSS Layout API** (https://drafts.css-houdini.org/css-layout-api-1/) --
  `layout()` is a `<display-inside>` value. Cannot feed `color`.
- **CSS Animation Worklet**
  (https://drafts.css-houdini.org/css-animation-worklet-1/) -- maps
  `currentTime` to effect progress, and "An animator can only be instantiated by
  construction of a `WorkletAnimation` in the document."
- **CSS Parser API** (https://drafts.css-houdini.org/css-parser-api/) -- parses
  into a JS representation; nothing flows back into the cascade.

### Support, pinned baseline

| Feature | No support / 136 | Notes |
|---|---|---|
| `css-paint-api` | **71/136** | every Firefox and every Safari target |
| `@property` | Firefox floor is 128 | misses the Firefox 119 floor by 9 releases |

Firefox has never shipped the Paint API:
https://bugzilla.mozilla.org/show_bug.cgi?id=1302328 -- "[META] Implement
Houdini CSS Painting API Level 1 spec", filed 2016-09-13, status **NEW**,
priority P3, still open. Safari has it flag-only and has never enabled it by
default (caniuse `n d #1`). `css-properties-values-api` is absent from this
repo's `caniuse-lite`; MDN BCD gives Chrome 85 / Safari 16.4 / **Firefox 128**.

---

## 8. Candidate: container style queries

**Verdict: cannot range over a colour, and fails the pinned baseline badly.**

The ticket guessed `@container style()` matches declared values only. That is
half right -- https://drafts.csswg.org/css-conditional-5/ **does** define
`<style-range>`, so ranges exist. But its evaluation algorithm rules out colours:

> "3. Parse `<style-range-value>` to `<number>`, `<percentage>`, `<length>`,
> `<angle>`, `<time>`, `<frequency>` or `<resolution>`. If this cannot be done,
> evaluate to false."

`<color>` is not in that list, so `style(--nfs-button-background > x)` parses the
colour, fails step 3, and evaluates to **false unconditionally**. And CSS has no
relative-luminance function to wrap the value in, so there is nothing to range
against even in principle.

Enumerating equality queries is 2^24 rules for sRGB alone, before alpha and
before unbounded-precision `oklch()`/`color()`. Rejected.

One genuinely interesting corollary: `<number>` **is** in the step-3 list. If the
consumer supplied `--nfs-button-background-luminance: 0.42` as a number, then
`@container style(--nfs-button-background-luminance > 0.186) { color: #0a0a0a }`
is valid and spec-conformant with no JS. But it moves the luminance computation
onto the consumer, and support kills it anyway:

| Feature | No support / 136 | Partial |
|---|---|---|
| `css-container-queries-style` | **46/136** | 87 |

Firefox did not ship style queries until 151; Safari until 18.0. Every
non-Firefox entry is partial (caniuse note #2: "Partial support refers to only
working with CSS custom property values in the `style()` query"). Dead.

---

## 9. Candidate: JavaScript writing a custom property

Not tested, because it does not need testing and its costs are decisive and
already stated in the ticket. Recording them for completeness:

- It runs after SSR, so the **first paint carries the wrong text colour**, on
  precisely the property that governs legibility. This project runs two
  SSR-shaped hosts (map hosts 1 and 4).
- It reintroduces JavaScript into styling immediately after this effort removed
  `nfs-button.styles.ts`, `NfsStyleLoader` and `NfsStyleExtractor` -- squarely
  against R026's intent.
- It must run per themed subtree and re-run on any token change, which means
  either a `MutationObserver` or a documented imperative API.

It is strictly worse than the section 4 mechanism on every axis: same output,
worse timing, more code, more requirements pressure. Only reach for it if the
recommendation in section 11 were rejected *and* section 4's mechanism were
rejected too.

---

## 10. Prior art -- how do other design systems solve this?

**No established design system computes a foreground colour in CSS in
production. Not one.** Verified against shipped artifacts: Angular Material 22,
Bootstrap 5.3.8 `dist`, USWDS 3.13.0 `dist`, Radix Colors 3.0.0 + Themes 3.3.0,
Open Props 1.7.16, Tailwind v4, Primer. `contrast-color(` appears **zero times**
in all of them, and no relative-colour expression is used for foreground
selection. Corroborated by zero-hit code searches across Shoelace, Carbon,
PatternFly, Semantic UI, and Adobe Spectrum (Spectrum's apparent hits are
`--highcontrast-*-color` substring false positives).

The reason is timing, and it is decisive: `contrast-color()` became Baseline
newly available in **April 2026**, four months ago. There is no prior art for a
computed foreground because it only just became possible.

### Angular Material 22 -- paired tokens, and it says so out loud

Read from the `D:\projects\github\angular\components` clone at tag `v22.0.4`
(`git rev-parse v22.0.4` -> `bef34ecbcd3c2f6bc600d5d559a8ca03477bec17`), via the
object database only.

`on-*` tokens are table lookups, not computation --
`src/material/core/tokens/m3/_md-sys-color.scss:73` (light) and `:15` (dark):

```scss
on-primary: map.get($palettes, primary, 100),
on-primary: map.get($palettes, primary, 20),
```

Material states the position explicitly at
`src/material/core/m2/_palette.scss:5-7`:

> `// Contrast colors are hard-coded because it is too difficult (probably impossible) to`
> `// calculate them. These contrast colors are pulled from the public Material Design spec swatches.`

**No contrast validation anywhere.** A sweep of
`src/material/core/**` and `src/material/schematics/**` for
`contrast|luminance|wcag|apca` returns only the hard-coded M2 `contrast:`
sub-maps, `cdk.high-contrast` / `prefers-contrast` (forced-colors mode), and doc
prose. `@warn` occurs exactly twice in `src/material/`
(`core/m2/_theming.scss:192`, `core/theming/_theming.scss:159`) and both are
legacy-API deprecation notices. `theme-overrides` validates the token **name**
only -- `src/material/core/tokens/_system.scss:190-211` checks
`map.has-key($sys-names, $name)` and nothing about the value.

**A consumer can ship an inaccessible pair silently.** Computed against
Material's own unmodified `_md-sys-color.scss` + `_palettes.scss`: the violet
light theme ships `primary-container: #ecdcff` / `on-primary-container: #5f00c0`
(7.23:1, AA). Override only the background and the foreground does not move:

```
fg #5f00c0 with bg #3b0764  ->  1.61:1  FAIL
fg #5f00c0 with bg #000080  ->  1.71:1  FAIL
```

No warning at Sass time, build time or runtime. And the theming guide's own
example overrides exactly one half of a pair (`guides/theming.md:461-464`).

**`mat.theme()` will not accept a bare colour** --
`_config-validation.scss:109-119` requires a full M3 palette map, and
`_system.scss:91` then calls `map.remove($primary, ...)`, so
`mat.theme((color: (primary: #ff0000)))` is a hard compile error. Arbitrary
brand colours must go through the **offline** `theme-color` schematic
(`guides/theming.md:280-289`), which runs `@material/material-color-utilities`
in Node and bakes literals -- `schematics/ng-generate/theme-color/index.ts:428-430`
emits `--mat-sys-on-primary: light-dark(#ffffff, #5e1133);`. Contrast is
guaranteed **structurally by tone distance, decided offline, then frozen**.

Material's own framing is the paired token: `guides/theming.md:399-401` describes
the colour variables as "ensuring strong contrast ratios between surface and
on-surface elements". And it acknowledges the runtime problem once, at
`_system.scss:380-383` -- "it's unknown whether the icon button sits on a
container with background like 'surface' or 'primary'" -- and solves it with
`inherit`, not computation.

Relevant data point on modern-CSS risk appetite: Material ships `color-mix()`
(`core/tokens/_classes.scss:111,138`) and `light-dark()` (`_system.scss:253`)
with **no fallback at all** -- only two `@supports` exist in all of
`src/material/`, both for `grid-template-rows: 0fr`. So Material treats modern
colour functions as production-safe and *still* does not use one for foreground
selection.

### Bootstrap 5 -- the closest structural match, and the most instructive

Not in the ticket's list but the exact same shape: precompiled CSS,
custom-property theming, and a Sass-time WCAG-2 contrast picker that is the
direct analogue of `color-pick-contrast`.

`scss/_functions.scss:153-171` is `color-contrast()`, with a 256-entry
precomputed luminance table at `:151`, real ratio maths at `:173-178`, a `@warn`
at `:168`, and `$min-contrast-ratio: 4.5 !default` at `scss/_variables.scss:72`.

The decisive part is `scss/mixins/_buttons.scss:10,21-22`:

```scss
@mixin button-variant(
  $background,
  $border,
  $color: color-contrast($background),   // computed, at Sass time, as a DEFAULT PARAM
  ...
) {
  --#{$prefix}btn-color: #{$color};
  --#{$prefix}btn-bg: #{$background};
```

Two independent custom properties. Shipped output
(`bootstrap@5.3.8/dist/css/bootstrap.css:3034-3037`):

```css
.btn-primary {
  --bs-btn-color: #fff;
  --bs-btn-bg: #0d6efd;
```

Across all 280 KB of that shipped CSS, `contrast-color(`, `color-mix(`,
`oklch(`, `light-dark(` and `rgb(from ` all return **zero** hits.

So Bootstrap answers this project's question twice over:

- consumer recompiles Sass -> model (C), `color-contrast()` reruns
- consumer overrides the precompiled custom properties -> **model (B), full stop**

And its own documented recipe sets both halves by hand
(`site/src/scss/_buttons.scss:6-18`), with the docs pushing the burden to the
human explicitly -- `site/src/content/docs/customize/color.mdx:392`: "Be sure to
monitor contrast ratios as you customize colors."

### USWDS -- the one real Sass-time computation, with a paired candidate set

`packages/uswds-core/src/styles/functions/color/get-color-token-from-bg.scss:10-70`
takes a background plus **two** candidate text tokens
(`$our-color-tokens: ($preferred-text-token, $fallback-text-token);` at `:38`)
and returns whichever passes. Component entry point is
`mixins/helpers/set-text-and-bg.scss:6-28`, used by
`packages/usa-button/src/styles/_usa-button.scss:12`.

The maths is a hybrid worth noting: stage 1 is real WCAG relative luminance
(`functions/color/luminance.scss:18-42`, 256-entry table in
`variables/luminance-values.scss`) but only to assign one of 12 discrete grade
bands; stage 2 -- the actual pass/fail -- is integer subtraction
(`magic-number.scss:27`, `is-accessible-magic-number.scss:18-25`,
`wcag-magic-numbers.scss:1-5` with `("AA": 50, "AAA": 70, "AA-large": 40)`). **No
contrast ratio is computed anywhere.**

It **warns and never errors** -- `get-color-token-from-bg.scss:62-67` takes
best-of-two and `@warn`s, gated on `$theme-show-compile-warnings: true !default`
(`settings/_settings-general.scss:41`). Insufficient contrast never fails the
build.

Runtime: **nothing**. Shipped `dist/css/uswds.css` has 0 custom-property
declarations, 0 `color-mix`, 0 `contrast-color`, 0 relative colour syntax. The
one exception is the experimental banner web component
(`packages/usa-banner/src/styles/_usa-banner.component.css:1-13`) and it is
**model (B)**: `--theme-banner-background-color` and
`--theme-banner-text-color` as two independent properties.

### Radix -- designed pairs, and its one computed path uses APCA

Correction to the brief: the contrast step is **not** in `@radix-ui/colors`
(zero hits across its 126 shipped CSS files). `--<scale>-contrast` lives in
`@radix-ui/themes` -- source
`packages/radix-ui-themes/src/styles/tokens/colors/blue.css:6-8`
(`:root { --blue-contrast: white; }`), shipped as literals at
`@radix-ui/themes@3.3.0/tokens.css:3242-3272`.

Proof they are designed and not computed: five dark values are byte-exact
step-12 values of the hue-matched gray scale -- `--amber-contrast` /
`--yellow-contrast` `#21201c` = `sand-12`, `--lime-contrast` `#1d211c` =
`olive-12`, `--mint-contrast` `#1a211e` = `sage-12`, `--sky-contrast` `#1c2024` =
`slate-12`. A human paired each hue with its natural gray. Documented intent at
`data/colors/docs/palette-composition/understanding-the-scale.mdx:215-219`:
"Most step 9 colors are designed for white foreground text. `Sky`, `Mint`,
`Lime`, `Yellow`, and `Amber` are designed for dark foreground text".

Consumption (`@radix-ui/themes@3.3.0/components.css:2065-2068`):

```css
.rt-BaseButton:where(.rt-variant-solid) {
    background-color: var(--accent-9);
    color: var(--accent-contrast);
}
```

Override `--accent-9` alone and the foreground does not move; the docs require
remapping both (`data/themes/docs/theme/color.mdx:375-379`). Arbitrary colours
go through an **offline browser tool**
(`data/colors/docs/overview/custom-palettes.mdx:10,12,28` -- "paste the
generated CSS into your project"), and that generator is the one place Radix
computes a foreground -- using **APCA**, not WCAG 2
(`components/generate-radix-colors.tsx:360-369`, `white.contrastAPCA(background) < 40`).
It ships in neither npm tarball, so no consumer build or runtime can invoke it.

### Open Props, Primer, Tailwind

- **Open Props** -- hand-authored, hand-inverted pairs.
  `src/extra/theme.light.css:9-15` gives `--text-1: var(--gray-12)` /
  `--surface-1: var(--gray-0)`; `src/extra/theme.dark.css:7-13` inverts them by
  hand. Adaptive switching is `@media (prefers-color-scheme: dark)`, not
  `light-dark()`. Zero `color-mix(`, `contrast-color(`, `light-dark(`,
  `oklch(from`, `rgb(from` in either file or in shipped
  `open-props@1.7.16/open-props.min.css`. Notably it *tried* relative colour
  syntax and shipped it **commented out** (`src/props.colors.js:306-329`), and
  even that was palette generation, not foreground selection.
- **GitHub Primer** -- designed pairs plus **the only real build-time contrast
  gate found anywhere**. `DESIGN_TOKENS_GUIDE.md:17,20,26` documents mandatory
  pairings (`--bgColor-*-emphasis` MUST pair with `--fgColor-onEmphasis`);
  `scripts/colorContrast.config.ts:22-23,35,37` encodes required ratios against
  an explicit pair list; `.github/workflows/a11y-contrast.yml:16,37-39,145-150`
  runs `npm run check:contrast` as a CI job that **fails the action** on a
  contrast failure. Nothing is derived -- pairs are authored and then proven.
- **Tailwind v4** -- `bg-*` and `text-*` are fully independent functional
  utilities (`packages/tailwindcss/src/utilities.ts:2899` and `:5275`), with no
  derivation of one from the other. Its default palette is `oklch()` throughout
  (`theme.css`, 286 uses in 510 lines) with **zero** `@supports`. Opacity
  modifiers use `color-mix()` unguarded (`utilities.ts:192`), but relative
  colour syntax **is** guarded (`utilities.ts:6637-6641` wraps
  `oklab(from ...)` in `@supports (color: lab(from red l a b))`). So the
  widest-reach system on the web treats `color-mix()` as safe, still guards
  relative colour syntax, and never computes a foreground.

### Does Foundation's `@warn` survive into a consumer's Angular build?

`color-pick-contrast` emits
`@warn 'Contrast ratio of #{$best} on #{$base} is pretty bad, just #{$contrast}'`
when the chosen contrast is below 3 (`scss/util/_color.scss:89-91`, gated on
`$contrast-warnings: true !default` at `:8`).

**Mechanically YES -- `quietDeps: true` does not suppress it.** Three
independent confirmations:

1. The Dart Sass docs are misleadingly broad. Verbatim from
   https://sass-lang.com/documentation/js-api/interfaces/options/#quietDeps:
   "If this option is set to `true`, Sass won't print warnings that are caused by
   dependencies. ... This is useful for silencing deprecation warnings that you
   can't fix on your own." It says "warnings" and means deprecations.
2. dart-sass 1.102.0 source: `visitWarnRule`
   (`lib/src/visitor/async_evaluate.dart:2756-2766`) calls `_logger.warn(...)`
   **directly** and never consults `_quietDeps`. The gate lives only in the
   `_warn` helper (`:4739-4740`, `if (_quietDeps && _inDependency) return;`),
   which `visitWarnRule` does not call. So dependency *deprecations* are
   silenced but the `@warn` at-rule escapes.
3. Empirically, with Angular's exact option shape (`compileStringAsync` +
   `importers` + `quietDeps: true` + Angular's logger transform), a fake
   dependency's `@warn` survived with a full Sass stack trace while both of its
   deprecation warnings vanished -- proving `_inDependency` was correctly true.

And Angular's chain carries it to the console: `quietDeps: true` is hard-coded
at `packages/angular/build/src/tools/esbuild/stylesheets/sass-language.ts:112`,
but `:147-168` installs a real **capturing** logger (not `Logger.silent`) that
puts non-deprecation warnings into the esbuild `warnings` array, and
`packages/angular/build/src/tools/esbuild/utils.ts:335-357` emits every one via
`logger.warn(...)` unfiltered. (The legacy webpack path,
`packages/angular_devkit/build_angular/src/tools/webpack/configs/styles.ts:356`,
has `quietDeps: !verbose` under the comment "Silences compiler warnings from 3rd
party stylesheets" -- same mistaken belief, same actual behaviour.)

**Practically NO for this library, though**: this library ships precompiled CSS,
so a consumer overriding a custom property never runs Sass at all and there is
no compilation for the `@warn` to occur in. The `@warn` is a live safety net
**only** on the ticket-05 theme-mixin path, where the consumer does compile --
and there it genuinely works, contrary to the `quietDeps` folklore. That is a
real, previously-unrecorded advantage of the theme-mixin API.

---

## 11. Verification tooling: does `@material/material-color-utilities` help?

**LIVE section -- the one question the compile-time-only decision creates.**

Under compile-time-only theming, `@material/material-color-utilities` (MCU) has
no production role. The question is whether it is usable as a **dev-only**
independent implementation of WCAG 2 relative luminance and contrast ratio, to
cross-check that Foundation's Sass picks what we believe it picks.

Answered against the **real published package**: `@material/material-color-utilities@0.4.0`
(latest as of 2026-08-09), tarball fetched from `registry.npmjs.org` and extracted
to `D:\projects\sandbox\mcu-probe\` -- not installed into this repo.

### Yes, it exposes genuine WCAG 2 primitives -- not only HCT/tone machinery

The useful exports are in two submodules, both re-exported from the root barrel:

- `utils/color_utils.js` -- `xyzFromArgb(argb)` returns `[X, Y, Z]`, and **`Y` is
  WCAG relative luminance on a 0..100 scale**. Verified: the transform matrix at
  `package/utils/color_utils.js:25-27` has middle row **`[0.2126, 0.7152, 0.0722]`
  -- the WCAG 2 coefficients exactly** -- and `linearized()`
  (`package/utils/color_utils.js:218-220`) uses threshold **0.040449936**, the real
  sRGB EOTF. Also available: `linearized`, `delinearized`, `lstarFromArgb`,
  `yFromLstar`, `lstarFromY`, `labFromArgb`, `argbFromRgb`.
- `contrast/contrast.js` -- `Contrast.ratioOfYs(y1, y2)` and
  `Contrast.ratioOfTones(toneA, toneB)`, plus `lighter`, `darker`,
  `lighterUnsafe`, `darkerUnsafe`.

Sanity checks, measured: `linearized(255) = 100`, `linearized(0) = 0`,
`Y(#ffffff)/100 = 1`, `Y(#000000)/100 = 0`,
`Contrast.ratioOfYs(100, 0) = 21`. All exact.

**Both paths work and agree.** `Contrast.ratioOfTones(lstarFromArgb(c), ...)` is
*not* a chroma-discarding trap as I first assumed -- `lstarFromArgb` derives L*
from Y, and L* <-> Y is a bijection (`contrast.js:46` round-trips through
`yFromLstar`), so it produces the same ratio as the Y path. Measured on the
palette, the two agree to the printed precision.

### It reproduces Foundation's PICK 5/5, and its RATIOS only 4/5

Composing `xyzFromArgb(...)[1]` -> `Contrast.ratioOfYs` -> Foundation's own
quantisation (`round(r * 10) * 0.1`) and tie rule (white first, black must win
strictly):

| Member | MCU Y | MCU ratios (w/b) | Foundation ratios (w/b) | Pick |
|---|---|---|---|---|
| `primary` | 0.174020732 | 4.6 / **4.2** | 4.6 / **4.3** | both white |
| `secondary` | 0.181164244 | 4.5 / 4.4 | 4.5 / 4.4 | both white |
| `success` | 0.528705822 | 1.8 / 10.9 | 1.8 / 10.9 | both black |
| `warning` | 0.515321038 | 1.8 / 10.7 | 1.8 / 10.7 | both black |
| `alert` | 0.181453588 | 4.5 / 4.4 | 4.5 / 4.4 | both white |

**Pick mismatches: 0/5. Ratio mismatches: 1/5.**

The single ratio disagreement is `primary`, and **MCU is right while Foundation is
wrong** -- it is exactly the `pow()` defect from section 2 (`#1779ba` has red = 23,
inside the broken 11..52 range). This is the actionable finding:

> **A verification test built on MCU must assert the PICK, not the RATIOS.**
> Asserting Foundation's published ratios against an independent correct
> implementation produces a false failure on `primary`. Asserting the pick gives
> 5/5 agreement and still catches any real regression, because the pick is what
> the stylesheet actually emits.

### Two caveats before adopting it

1. **The published 0.4.0 root barrel is broken under Node ESM.** `package/index.js`
   transitively loads `package/dynamiccolor/color_spec_2025.js:21`, which has an
   **extension-less** relative import: `import { ... } from './dynamic_color';`.
   Node ESM requires the `.js`, so `import '@material/material-color-utilities'`
   throws `ERR_MODULE_NOT_FOUND: Cannot find module .../dynamiccolor/dynamic_color`.
   Reproduced twice. Workaround is to import the two submodules directly:
   ```js
   import { xyzFromArgb, argbFromRgb } from '@material/material-color-utilities/utils/color_utils.js';
   import { Contrast } from '@material/material-color-utilities/contrast/contrast.js';
   ```
   but note `package.json` declares a single `"."` export map, so subpath imports
   are **not** exposed to consumers -- they only work against an extracted tarball
   or via a deep `node_modules` path, which is fragile. A bundler that tolerates
   extension-less specifiers (webpack, Vite) would load the barrel fine; plain
   Node would not.
2. **There is no `color-pick-contrast` equivalent.** MCU has no "pick the better of
   these two candidates" function, no quantisation, and no tolerance parameter. The
   white-first / strictly-greater / `round(r*10)*0.1` logic is yours to write
   either way -- about 5 lines.

### Verdict

**Usable, but not worth the dependency.** MCU genuinely provides WCAG 2 luminance
and ratio -- this is not a case of "HCT tone maths only" -- so the negative result
the brief anticipated does not hold. But what it provides is two function calls
behind a broken barrel and an export map that does not expose them, and the pick
logic has to be hand-written regardless.

**Recommendation: hand-roll it, in about 15 lines**, with no dependency and no
export-map or ESM-resolution risk:

```js
// dev-only verification helper
const lin = (c) => {
  const v = c / 255;

  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

const ratio = (c1, c2) => {
  const a = luminance(c1) + 0.05;
  const b = luminance(c2) + 0.05;

  return Math.round((a > b ? a / b : b / a) * 10) * 0.1; // Foundation's quantisation
};

// Foundation's tie rule: white is first, so black must win strictly.
const pick = (bg) => (ratio(bg, BLACK) - ratio(bg, WHITE) > 0 ? BLACK : WHITE);
```

If a genuinely independent second opinion is ever wanted (to catch a transcription
slip in the 15 lines above), MCU is a valid cross-check -- **and it has already
served that purpose here**: it is what confirmed that Foundation's `primary` ratio
of 4.3 is wrong and the true value is 4.2. That is the single most useful thing it
did, and it did not require being a dependency.

---

## 12. Conclusion

**The mechanism question is closed by constraint.** Compile-time-only SCSS
variable theming means Foundation's own `color-pick-contrast` runs in the
library's Sass build and its output is baked into the shipped CSS, permanently.
That is what `nfs-button.scss` already does -- it passes `auto` for `$color` on
`success`/`warning`/`alert`, and Foundation's unmodified
`button-fill-style`/`color-pick-contrast` compute the pick
(`scss/components/_button.scss:189-190`). D017 is honoured with no change and no
new mechanism.

**What survives, and what to do with it:**

1. **Section 1 is a test fixture.** The five picks plus both rounded ratios are
   Foundation's real output, produced by Dart Sass 1.102.0 against the v6.9.0
   clone. Use them as the expected values in the verification test replacing
   `verify-parity.mjs`.
2. **Section 2 constrains that test.** Foundation's `color-luminance` is not WCAG
   relative luminance -- its hand-rolled `pow()` (`scss/util/_math.scss:33-54`)
   returns up to **6.73x** the correct linearised value for channel values
   **11..52**. So:
   - Assert **the picked colour** (`#fefefe` / `#0a0a0a`), which is what the
     stylesheet emits and which every independent implementation agrees with
     (5/5, section 11).
   - Do **not** assert Foundation's ratios against an independently computed WCAG
     ratio -- `primary`'s 4.3 is wrong (truth 4.2) and the test would fail
     correctly but unhelpfully. If ratios are asserted at all, assert them as
     Foundation's literal published output, with a comment pointing at this
     finding.
   - Note for R003: `primary` `4.6`, `secondary` `4.5` and `alert` `4.5` all sit
     **at or barely above the WCAG AA 4.5:1 line**, and `primary`'s apparent
     headroom is an artefact of the `pow()` bug -- its true ratio against
     `#0a0a0a` is 4.2, below AA. Worth knowing before writing any assertion with
     a margin in it.
3. **Section 3 answers the archival question and settles a design point.**
   `contrast-color()` uses the WCAG 2 ratio in all three engines (spec leaves it
   UA-defined; WebKit states WCAG 2 explicitly), takes **no candidate list**, and
   compares against **pure `#fff`/`#000`** rather than Foundation's
   `#fefefe`/`#0a0a0a`. It therefore picks differently on `secondary` and `alert`.
   Even if runtime theming were revisited, it is not a like-for-like replacement
   for `color-pick-contrast`.
4. **Sections 4-10 are the survey record.** Should runtime theming ever be
   reconsidered, the closest mechanism is the `srgb-linear` relative-colour form
   in section 4 -- 0.33% divergence, all of it Foundation's own bug, emitting
   Foundation's exact `#fefefe`/`#0a0a0a`, working from Chromium 123 up -- not
   `contrast-color()` and not the OKLCH or HSL clamp idioms.

**What none of this buys today: nothing, and that is the correct outcome.** The
compile-time path was already exact, already zero-dependency, already
zero-runtime-cost, and already what the repo does. The investigation's return is
not a mechanism -- it is the fixture, the discovery that Foundation's own contrast
arithmetic is unreliable, and a documented, measured reason not to reach for
`contrast-color()` later under the impression that it will restore parity.

---

## UNRESOLVED

**Nothing LIVE is unresolved.** The ground truth (section 1) is Dart Sass output,
the `pow()` finding (section 2) is validated against Dart Sass on 321 colours, the
`contrast-color()` algorithm question (section 3) is answered from the spec and
measured in three engines, and the MCU question (section 11) is answered from the
real published package. The items below are either **moot under the
compile-time-only decision** or **immaterial**, and are listed so a later reader
does not mistake them for gaps in the live conclusions.

### Moot -- closed by the scope decision, not investigated further

1. **The precedence interaction between an author token and a computed
   declaration.** I did not test whether
   `color: var(--nfs-button-color, color(from ... ))` parses and resolves
   correctly, or whether burying a relative-colour function inside a `var()`
   fallback changes its validity handling. **Moot**: it only matters for runtime
   token theming, which is now out of scope. **Would be settled by**: adding that
   declaration to `tmp/browser-probe2.mjs` and re-running, with three cases
   (token unset, token set, function unsupported).
2. **Behaviour on the actual pinned floor versions.** Seven versions were
   observed -- Chromium 123 / 134 / 141 / 151, Firefox 151 / 153, WebKit 26.5 --
   and all seven run the mechanism correctly. But the floors themselves,
   **Chrome/Edge 119-122, Firefox 128-150 and Safari 17.0-17.6**, were not:
   the local Playwright cache has nothing older than Chromium 123, its
   Firefox builds 1440-1511 refuse to drive under Playwright 1.62.1
   (`Protocol error (Browser.setDefaultViewport)` -- a harness incompatibility,
   not a CSS result), and the WebKit builds were not reached. caniuse puts
   `css-color-function` and `css-math-functions` at 0/136, and Chromium 123 --
   inside the 119-130 partial band -- confirms nested `clamp()` in a
   relative-colour channel, so the risk is low. It is still inference at the
   floor, not measurement. **Moot** for the same reason as item 1. **Would be
   settled by**: BrowserStack/Sauce against Chrome 119, Firefox 128 and
   Safari 17.0 with `tmp/single-old-chrome.mjs`'s page; or
   `npx playwright install chromium@119` if such a build is still published.

### Immaterial -- does not affect any live conclusion

3. **My whole-cube model's resolution near the boundary.** The JS transcription
   matches Dart Sass to `5.535e-7` in luminance, but the closest any colour's
   Foundation luminance gets to the crossover is `1.698e-9`. So a small number of
   colours right at the boundary could be misclassified by the model, and the
   55 072 / 211 678 / 449 998 counts carry that uncertainty. It does not affect
   any conclusion (the palette results are from Dart Sass directly, and the
   rates differ by orders of magnitude). **Settled by**: running the ~60
   nearest-boundary colours through Dart Sass, which
   `tmp/validate-foundation-math.mjs` already does for a 0.00002-wide band and
   found 0 pick mismatches.
4. **Whether Gecko's and Blink's `contrast-color()` uses WCAG 2.0 or 2.1
   specifically, from their own source.** Established for WebKit from its own
   words (https://webkit.org/blog/16929/contrast-color/); for Firefox and Chrome
   only indirectly, via the Chrome Intent to Ship asserting Blink "matches
   Firefox and Safari". **Immaterial to every conclusion here** -- WCAG 2.0 and
   2.1 are numerically identical for SC 1.4.3, and my probe measured all three
   engines implementing the *same* pure-white/black boundary at 0.179128785 with
   zero disagreement over 125 colours, which is the behaviour that actually
   matters. The live risk is not which WCAG version they use but that the spec
   leaves the algorithm UA-defined at all (section 3). **Settled by**:
   `searchfox.org/mozilla-central/search?q=contrast-color` and
   `source.chromium.org/search?q=contrast-color%20file:third_party%2Fblink`.
5. **The prior-art survey (section 10) was stopped on instruction and is
   incomplete by design.** Adobe Spectrum was probed but not read: zero
   `contrast-color(` / `color-mix(` confirmed via code search and its 5 apparent
   hits shown to be `--highcontrast-*-color` false positives, but its token JSON
   was not opened to confirm pair-vs-derived. Immaterial -- the survey supported
   the paired-token option, which the scope decision has itself eliminated.
   **Would be settled by**:
   `gh api repos/adobe/spectrum-tokens/contents/packages/tokens/src` and reading
   the `color-*.json` sets.
6. **Whether Foundation's `pow()` defect is worth reporting upstream.** Not
   pursued -- `foundation-sites` is unmaintained (v6.9.0, Sep 2024), and filing in
   a third-party repo requires explicit user confirmation. Noted here so the
   finding is not lost: `scss/util/_math.scss:33-54` returns up to 6.73x the
   correct value for linearised channels 11..52, which makes
   `color-luminance`/`color-contrast` report wrong ratios for any colour with a
   dark channel.
