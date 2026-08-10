# How does one `styleUrl` stylesheet mirror Foundation's physical-property mixins for RTL?

Research for [issue 03](../issues/03-rtl-in-one-stylesheet.md). Everything below
that is labelled "observed" was produced by running the tool, not by reasoning.

## Recommendation, up front

**Point Foundation's own `$global-left` / `$global-right` interpolation hooks at
CSS *logical keywords* (`inline-start` / `inline-end`) instead of `left` / `right`,
and emit ONE unlayered stylesheet with no direction selector at all.**

Two variable assignments in `_foundation-button.scss`, zero new selectors, zero
new dependencies, zero second `@include`, and Foundation's real mixins still do
all the work (D017 intact):

```scss
$global-left: inline-start;
$global-right: inline-end;
```

Observed output from `@include button-dropdown` with only that change (probe E):

```css
.button.dropdown::after {
  ...
  float: inline-end;
  margin-inline-start: 1em;
}
```

Runner-up: **the `:dir()` pseudo-class** (mechanism 4). It also works, is also
in-baseline, and needs no PostCSS -- but it costs one class of specificity and
duplicates every mirrored declaration.

**Rejected:** `postcss-rtlcss` (breaks the LTR case in this repo's actual demo
DOM -- observed in a real browser) and `postcss-logical` (it transforms in the
opposite direction; byte-for-byte no-op on this repo's CSS -- observed).

## The measured directional surface (this is the crux)

Before comparing mechanisms: the whole problem is two declarations.

`dist/packages/ngx-foundation-sites/css/nfs-button.css` was confirmed to be a
current, faithful compile of `src/scss/nfs-button.scss` (fresh `sass` run
diffed byte-for-byte against the committed dist: identical). Its complete
inventory of direction-sensitive declarations:

| Declaration | Selector | Actually directional? |
|---|---|---|
| `margin: 0 0 1rem 0` | `.button` | No -- inline sides are both `0` |
| `margin-right: 0; margin-left: 0` | `.button.expanded` | No -- both `0` |
| `text-align: center` | `.button` | No -- `center` is direction-neutral |
| `float: right` | `.button.dropdown::after` | **YES** |
| `margin-left: 1em` | `.button.dropdown::after` | **YES** |

Independently corroborated: `postcss-rtlcss` in `combined` mode found exactly
two rules worth prefixing in the entire 5567-byte sheet, both of them
`.button.dropdown::after` (`rg -c '\[dir=' -> 2`).

So "RTL mirroring for NfsButton" reduces to *the dropdown arrow's float and its
gap from the label*. Every mechanism below is judged on that pair.

### Consequence: the existing Playwright gate does not gate this

`apps/nfs-demo/e2e/nfs-button-rtl.spec.ts` reads
`paddingLeft/Right`, `borderLeftWidth/RightWidth`,
`borderTopLeftRadius/RightRadius` and `textAlign` off a **plain primary button**
(`getByTestId('rtl-button')` -> `<button nfsButton color="primary">`), and
asserts `rtlBox` equals `ltrBox`. Every property it reads is in the
"not actually directional" rows above, and no `.dropdown` instance exists in
`apps/nfs-demo/src/app/app.component.ts`.

Observed: the gate's assertions hold under **all** candidate mechanisms *and*
under a baseline with no RTL mechanism whatsoever. It is a
regression tripwire ("nobody introduced a physical property"), not a mirroring
proof. Whatever is chosen, the gate needs a `.dropdown` instance inside the
`dir="rtl"` container plus `marginLeft`/`marginRight` assertions to have teeth.

**Trap for whoever writes that assertion:** with the recommended mechanism,
`getComputedStyle(el, '::after').float` returns the literal string
`"inline-end"` in BOTH directions (observed) -- the logical keyword is not
resolved to a physical one in the computed value. Assert on
`marginLeft`/`marginRight`, which *do* resolve physically (observed:
`ml 13.3333px / mr 0px` in LTR, `ml 0px / mr 13.3333px` in RTL).

## Mechanism 1 -- re-`@include` Foundation's mixins for a second direction

### How it works

Foundation is legacy `@import`, so `$global-left` / `$global-right` live in one
mutable scope and `button-dropdown` reads them **at `@include` time** through
interpolation (`float: #{$global-right}`, `margin-#{$global-left}`). Reassign
them, `@include` again inside `[dir="rtl"]`, get a mirrored copy.

### Observed: it works, and here is exactly which globals matter

Probe A (`--load-path` at the repo's `node_modules`, foundation-sites 6.9.0,
dart-sass 1.102.0), deliberately using asymmetric `$button-padding:
0.85em 3em 0.85em 1em` and `$button-margin: 0 2rem 1rem 0` so any import-time
baking shows up as a *wrong value* rather than a coincidence:

```css
/* pass 1, LTR */
.button { margin: 0 2rem 1rem 0; padding: 0.85em 3em 0.85em 1em; }
.button.dropdown::after { float: right; margin-left: 3em; }

/* pass 2, after reassigning the globals */
[dir=rtl] .button { margin: 0 0 1rem 2rem; padding: 0.85em 3em 0.85em 1em; }
[dir=rtl] .button.dropdown::after { float: left; margin-right: 3em; }
```

**Required reassignments, empirically separated:**

| Global | Needed for the button mixins? | Evidence |
|---|---|---|
| `$global-left` | **YES** | Probe B: reassigning it alone flips `margin-#{...}` |
| `$global-right` | **YES** | Probe B: reassigning it alone flips `float` |
| `$global-text-direction` | **NO** (cosmetic) | Probe C set it to `rtl` and *nothing* in the button output changed as a result |
| `$button-margin` | **YES, by hand** | see baking table below |
| `$-zf-flex-justify` | Not read by any button mixin, but baked | see baking table below |

**Values baked at import time -- the second pass IS silently wrong without a
hand-fix.** Probe C is the control: it reassigns only the three documented
direction globals and nothing else.

| Value | After `$global-text-direction: rtl` | Correct RTL value | Verdict |
|---|---|---|---|
| `$button-margin` | `0 2rem 1rem 0` (unchanged LTR) | `0 0 1rem 2rem` | **BAKED** |
| `map-get($-zf-flex-justify, left)` | `flex-start` (LTR) | `flex-end` | **BAKED** |
| dropdown `$offset` | `3em` (LTR *right* padding) | `1em` (the RTL end side) | **BAKED, unfixable via globals** |

- `$button-margin`: the ticket's hint is confirmed and then some.
  `_button.scss:84` (`@if $global-text-direction == 'rtl'`) is evaluated **once,
  at import time**, so a later reassignment cannot re-trigger it. Worse, in
  *this repo* line 84 is outright **dead code**: `_foundation-button.scss:32`
  assigns `$button-margin: settings.$button-margin` *before* the `@import`, so
  the `!default` on line 85 can never take. Observed in probe A -- the LTR pass
  emitted `margin: 0 2rem 1rem 0`, exactly the pre-import value, not line 84's
  `0 0 $global-margin $global-margin` form. Any RTL margin flip must be authored
  by hand in NfsButton's own Sass.
- `$-zf-flex-justify` is a non-`!default` derivation in `_global.scss:131`. It
  must be recomputed as `-zf-flex-justify($global-text-direction)` (probe A does
  this and observes `flex-end`). No button mixin reads it, so it is a latent trap
  for whoever adds the 19th component, not a bug today.
- **`button-dropdown`'s `$offset` default cannot be fixed by any global.**
  `_button.scss:297` is `$offset: get-side($button-padding, right)` -- the word
  `right` is *hardcoded*, not `$global-right`. Observed: with asymmetric padding,
  the RTL pass emits `margin-right: 3em` when the end-side padding is `1em`.
  Harmless today (`$button-padding: 0.85em 1em` is symmetric) but it means
  mechanism 1 does not survive a consumer setting asymmetric horizontal padding
  -- and it fails *silently*, in a way no current test would notice.

### Observed: the scoping rules bite

Probe B:

- A **plain assignment inside** the `[dir="rtl"]` block is local and invisible
  to the mixin's global lookup -- the mixin still emitted `float: right;
  margin-left: 1em`. **Silent no-op.**
- `!global` inside the block works, **but leaks**: the very next unprefixed rule
  in the file also emitted `float: left; margin-right: 1em` (probe B3).
  Reassignment must therefore either be last-in-file or explicitly restored.

Probe D confirms the shape this repo actually needs. Because
`_foundation-button.scss` is a `@use`d module and `$global-left`/`$global-right`
are non-`!default` (so *not* configurable via `@use ... with`), the flip cannot
be driven from `nfs-button.scss` by assignment -- it must be driven by a mixin
`_foundation-button.scss` exports that does the `!global` writes. That works
cross-module (observed), including restoring afterwards:

```scss
// in _foundation-button.scss
@mixin nfs-text-direction($direction) { ... $global-right: left !global; ... }
```
```css
/* in nfs-button.scss, after @include nfs-text-direction(rtl) */
[dir=rtl] .button { margin: 0 0 1rem 1rem; }
[dir=rtl] .button.dropdown::after { float: left; margin-right: 1em; }
/* after @include nfs-text-direction(ltr) -- restored */
.after-restore.button.dropdown::after { float: right; margin-left: 1em; }
```

### `@layer` survival

Survives. It is plain nested Sass; the emitted rules are ordinary selectors.
Verified in a browser inside `@layer nfs-defaults`: mirrors correctly.

### Specificity impact on consumer overrides

Raises the mirrored declarations from `(0,2,1)` to `(0,3,1)`. Observed in
Chromium, unlayered defaults (the `styleUrl` shape) plus an unlayered consumer
rule `.button.dropdown::after { float: none; margin-left: 4em; margin-right: 4em }`:

```
M1: rtl ::after -> {"float":"left","ml":"0px","mr":"13.3333px"}   consumer wins: NO
```

The consumer's override is **completely defeated** in RTL. When the output *is*
`@layer`-wrapped (the Option 1 precompiled path) the point is moot -- unlayered
beats layered regardless of specificity, and the consumer wins (observed).

### Consumer re-theming

Partially broken by construction. The RTL `$button-margin` is hand-authored, so
it does not track a consumer's `$button-margin` unless the flip is written as a
generic list transform (swap positions 2 and 4). Hand-rolling that is exactly
what D017 exists to avoid. Separately, note that Foundation's own line-84 flip
is **not a mirror** -- LTR `0 0 1rem 0` (no inline margin) against RTL
`0 0 1rem 1rem` (1rem inline-start) -- so copying Foundation faithfully would
introduce an RTL-only asymmetry that the RTL gate's own stated philosophy
("the computed box model is IDENTICAL between the ltr and rtl instances")
rejects.

### Verdict

Works, and it is the only mechanism that is 100% Foundation-mixin-driven. But it
costs a full second copy of every mirrored declaration, a leak-prone `!global`
mixin across the module boundary, a hand-authored `$button-margin` flip that
breaks consumer re-theming, a `+1` class of specificity that silently defeats
consumer overrides on the unlayered `styleUrl` path, and it still cannot fix the
hardcoded `get-side(..., right)` offset. Overkill for two declarations.
**Not recommended.**

## Mechanism 2 -- `postcss-rtlcss`

### How it works

postcss-rtlcss 6.0.0 wraps rtlcss 4.3.0 and, in `combined` mode (its default and
self-described "recommended, safest" mode), moves every direction-sensitive
declaration out of the base rule into a `[dir="ltr"]`-prefixed and a
`[dir="rtl"]`-prefixed copy. `override` and `diff` are the two alternatives; the
README marks both "not recommended".

### Observed: actual emitted selectors over this repo's real CSS

Run over `dist/packages/ngx-foundation-sites/css/nfs-button.css` exactly as the
`compile-default-css` target leaves it (i.e. already `@layer`-wrapped),
postcss-rtlcss 6.0.0 + postcss 8.5.25:

```css
@layer nfs-defaults {
...
.button.dropdown::after {
  ...
  top: 0.4em;
  display: inline-block;
}

[dir="ltr"] .button.dropdown::after {
  float: right;
  margin-left: 1em;
}

[dir="rtl"] .button.dropdown::after {
  float: left;
  margin-right: 1em;
}
...
}
```

Note it correctly left `text-align: center`, `padding`, `border`,
`border-radius`, `.button { margin: 0 0 1rem 0 }` and `.button.expanded
{ margin-right: 0; margin-left: 0 }` untouched. Its analysis of the sheet is
accurate.

`override` mode (needs an explicit reset, higher net specificity):

```css
.button.dropdown::after { float: right; margin-left: 1em; }
[dir="rtl"] .button.dropdown::after { float: left; margin-left: 0; margin-right: 1em; }
```

`diff` mode emits an unprefixed override-only sheet -- that is the two-file D018
shape this ticket exists to replace, so it is out by premise.

`safeBothPrefix: true` is a trap: it prefixes **every** rule in the sheet with
`[dir]`, e.g.

```css
[dir] .button, [dir] .button.disabled, [dir] .button[disabled], ... { background-color: #1779ba; }
[dir] .button.tiny { ... }
```

That raises the entire stylesheet by one class AND makes all of it conditional
on a `dir` attribute existing. Do not use.

### Observed: `combined` mode BREAKS the LTR case in this repo

`apps/nfs-demo/src/index.html` is `<html lang="en">` with **no `dir`
attribute**, and `app.component.ts` puts `dir="rtl"` on one inner
`<div data-testid="rtl-container">` only. There is no `dir="ltr"` anywhere in
the app. So `[dir="ltr"] .button.dropdown::after` never matches.

Confirmed in headless Chromium (playwright-core 1.62.1) against that exact DOM
shape:

```
M2 postcss-rtlcss combined:
  ltr ::after -> {"float":"none","ml":"0px","mr":"0px"}      <-- LTR styling LOST
  rtl ::after -> {"float":"left","ml":"0px","mr":"13.3333px"}
```

The LTR dropdown arrow loses its float and its gap entirely. Compare the
baseline and the recommendation, same DOM:

```
baseline: ltr {"float":"right","ml":"13.3333px","mr":"0px"}
M3:       ltr {"float":"inline-end","ml":"13.3333px","mr":"0px"}
```

This is fixable -- put `dir="ltr"` on `<html>` -- but it converts a styling
choice into a **DOM contract every consumer of the library must honour**, and
the failure mode is silent. That is disqualifying for a published library
default. (Under `<html dir="rtl">` all mechanisms behave correctly; observed.)

### `@layer` survival

Survives cleanly. Observed: the `@layer nfs-defaults { ... }` at-rule is
preserved and rules inside it are prefixed in place; output was identical
whether the wrapper was present or stripped. But note this only helps the
Option 1 precompiled path -- postcss-rtlcss is a PostCSS pass over *compiled
CSS*, so it does not exist on the `styleUrl` path unless a PostCSS step is
inserted into Angular's library build, which `ng-packagr` does not do for
component stylesheets by default. **UNRESOLVED** (see below).

### Specificity impact

`(0,2,1)` -> `(0,3,1)` for both directions. Observed, unlayered + unlayered
consumer override:

```
M2: rtl ::after -> {"float":"left","ml":"53.3333px","mr":"13.3333px"}   consumer wins: NO
```

Worse than mechanism 1's clean loss: this is a **half-applied** override. The
consumer's `margin-left: 4em` landed (53.3px) because nothing in the `[dir]` rule
sets `margin-left`, while their `margin-right: 4em` and `float: none` were
overridden. The result is a layout the consumer never wrote.

### Consumer re-theming

Fine in principle -- it is a mechanical post-pass, so it re-derives from whatever
the theme compiled to. Irrelevant given the LTR breakage.

### Verdict

Technically the most accurate flipper of the four, and its `combined`-mode
analysis of this sheet is correct. But it makes correct LTR rendering depend on a
`dir="ltr"` attribute the demo app does not have and consumers cannot be relied
on to add, it adds a dependency and a PostCSS stage that does not currently exist
on the `styleUrl` path, and it half-applies consumer overrides. **Rejected.**

## Mechanism 3 -- physical to logical

### First: `postcss-logical` is the wrong tool, and it is actively harmful here

The ticket frames mechanism 3 as "rewriting physical to logical properties
mechanically". `postcss-logical` 9.0.0 does the **opposite** -- it is a
downlevel polyfill that rewrites *logical to physical*, baking one direction at
build time. Its own README opens with `padding-block: 10px 20px` becoming
`padding-top: 10px; padding-bottom: 20px`.

Observed, run over this repo's compiled CSS:

```
identical to input: true
input len 5567 output len 5567
```

A byte-for-byte no-op. Positive control confirming the direction of travel:

```css
/* input */  .button.dropdown::after { float: inline-end; margin-inline-start: 1em; }
/* output */ .button.dropdown::after { float: inline-end; margin-left: 1em; }
```

It destroyed the logical margin (baking it to `left`) and did not touch
`float: inline-end` at all -- postcss-logical 9 has no handling for `float`'s
logical keywords. With `inlineDirection: 'right-to-left'` it emits
`margin-right: 1em` -- i.e. it hardcodes one direction, which is the exact
opposite of `dir`-driven mirroring. **Putting `postcss-logical` in this pipeline
would break RTL, not enable it.**

### What actually delivers mechanism 3: Foundation's own interpolation hooks

Foundation already parameterises the two directional declarations by variable.
Nothing says those variables must hold `left` / `right`. Assign the CSS logical
keywords and Foundation's unmodified mixins emit logical properties.

Observed (probe E), the *entire* change being
`$global-left: inline-start; $global-right: inline-end;` after the `@import`s:

```css
.button {
  margin: 0 0 1rem 0;
  padding: 0.85em 1em;
  text-align: center;
}
.button.expanded { margin-right: 0; margin-left: 0; }
.button.dropdown::after {
  ...
  float: inline-end;
  margin-inline-start: 1em;
}
```

`float: inline-end` and `margin-inline-start` -- from Foundation's real
`button-dropdown`, with no second `@include`, no `[dir]` selector, and no
PostCSS. Foundation's `.arrow-only` branch also substitutes cleanly
(`margin-inline-start: 0`).

### Observed: it mirrors, in a real browser

```
M3 logical values, inside @layer nfs-defaults:
  ltr ::after -> {"float":"inline-end","ml":"13.3333px","mr":"0px"}
  rtl ::after -> {"float":"inline-end","ml":"0px","mr":"13.3333px"}
  -> inline margin mirrors: YES
```

Also correct unlayered, and correct under `<html dir="rtl">` (observed).

### Browser support, resolved concretely against `.browserslistrc`

`.browserslistrc` is the single query `baseline widely available`. `npx
browserslist` in the repo (browserslist 4.28.7) resolves to 125 entries; the
floor per engine is **chrome 121, edge 121, firefox 122, safari 17.2,
ios_saf 17.2, and_chr 150, and_ff 152**.

`float: inline-start` / `inline-end`, per mdn/browser-compat-data
(`css/properties/float.json`, fetched from `main`): chrome 118, edge mirror,
firefox 55, safari 15, safari_ios mirror. **Every target is above the floor** --
the newest requirement, Chrome 118, predates the resolved Chrome 121.

`margin-inline-start` (caniuse `css-logical-props`, checked programmatically
against the resolved list): 0 of 125 targets unsupported or partial.

### Observed: Angular's CSS pipeline does not damage it

Both post-processors present in this repo's `node_modules` leave it intact:

- esbuild 0.28.1, `--minify --target=chrome121,safari17.2,firefox122,edge121`:
  `float:inline-end;margin-inline-start:1em` passes through verbatim (only
  `::after` -> `:after`).
- lightningcss 1.33.0 with `browserslistToTargets` from this repo's
  `.browserslistrc`: `float: inline-end; margin-inline-start: 1em` unchanged, no
  downleveling.

### `@layer` survival

Survives, trivially -- there is no selector to interfere with. Verified in
browser inside `@layer nfs-defaults`.

### Specificity impact on consumer overrides

**Zero.** This is the mechanism's decisive advantage. The declarations stay on
`.button.dropdown::after` at `(0,2,1)`, so a consumer's plain override wins --
and it is the ONLY mechanism of the four where that is true on the unlayered
`styleUrl` path. Observed, unlayered defaults + unlayered consumer rule:

```
M1: rtl {"float":"left","ml":"0px","mr":"13.3333px"}          consumer wins: NO
M2: rtl {"float":"left","ml":"53.3333px","mr":"13.3333px"}    consumer wins: NO  (half-applied)
M3: rtl {"float":"none","ml":"53.3333px","mr":"53.3333px"}    consumer wins: YES
M4: rtl {"float":"left","ml":"53.3333px","mr":"13.3333px"}    consumer wins: NO  (half-applied)
```

### Consumer re-theming

Best of the four. There is no hand-authored RTL branch to drift, no second copy
to keep in sync, and no `$button-margin` flip to maintain -- the browser mirrors
at render time from whatever the theme compiled to. A consumer changing
`$button-padding` or `$button-margin` gets correct mirroring for free, which is
precisely where mechanism 1 fails (baked `$offset`, hand-written margin flip).

### Residual gap, named honestly

`button-base` emits `margin: $button-margin` as a **four-value shorthand**, which
has no logical equivalent reachable through a variable. Today this is harmless:
`$button-margin: 0 0 $global-margin 0` is inline-symmetric (both inline sides
`0`), as is `button-expand`'s hardcoded `margin-right: 0; margin-left: 0`.
Observed as `margin: 0 0 1rem 0` -- nothing to mirror. **But** a consumer setting
an inline-asymmetric `$button-margin` (say `0 2rem 1rem 0`) would not get it
mirrored. Two honest options: accept it and document the constraint (Foundation's
own default is inline-symmetric, and Foundation's line-84 "RTL default" is itself
not a mirror), or add one `margin-inline` declaration in `nfs-button.scss`
alongside the `@include`. The second is a two-line, direction-neutral addition
that does not re-hand-roll any Foundation mixin.

### Verdict

**Recommended.** Two variable assignments; Foundation's real mixins do all the
emitting; one stylesheet; no new selector; no specificity cost; no new
dependency; no DOM contract; no second `@include`; in-baseline across the entire
resolved browserslist; survives esbuild and lightningcss; survives `@layer`; and
it is the only option that leaves consumer overrides working on the unlayered
`styleUrl` path. It is also philosophically the same answer S14 hand-authored,
reached this time *through* Foundation's mixins rather than around them, so D017
holds.

## Mechanism 4 -- the `:dir()` pseudo-class

### How it works

`:dir(ltr)` / `:dir(rtl)` match on an element's resolved directionality rather
than on the presence of a `dir` attribute, so unlike `[dir="ltr"]` they need no
DOM cooperation. Shape:

```css
.button.dropdown:dir(ltr)::after { float: right; margin-left: 1em; }
.button.dropdown:dir(rtl)::after { float: left; margin-right: 1em; }
```

### Observed: it works, including with no `dir` attribute anywhere

```
M4 :dir(), inside @layer nfs-defaults:
  ltr ::after -> {"float":"right","ml":"13.3333px","mr":"0px"}
  rtl ::after -> {"float":"left","ml":"0px","mr":"13.3333px"}
  -> inline margin mirrors: YES

no dir attribute anywhere in the document:
  first button -> {"float":"right","ml":"13.3333px","mr":"0px"}
```

That last line is the property mechanism 2 lacks: `:dir(ltr)` matches by
default, so the LTR case cannot silently disappear. Also correct under
`<html dir="rtl">` (observed).

### Browser support, resolved concretely

caniuse `css-dir-pseudo`, checked programmatically against the resolved
browserslist: **0 of 125 targets unsupported or partial**. First full support is
chrome 120 / edge 120 / firefox 17 / safari 16.4 / ios_saf 16.4, all below this
repo's floor (chrome 121 / safari 17.2). Safari 16.4 shipped March 2023, so
`:dir()` is inside the 30-month "widely available" window that
`.browserslistrc` and R022 pin to. lightningcss 1.33.0 at these targets leaves
`:dir()` intact (observed); esbuild passes it through (observed).

### `@layer` survival

Survives. Verified in browser inside `@layer nfs-defaults`.

### Specificity impact

`(0,2,1)` -> `(0,3,1)`; a pseudo-class counts as one class. Same
**half-applied-override** failure as mechanism 2 (observed above):
`{"float":"left","ml":"53.3333px","mr":"13.3333px"}` -- the consumer's
`margin-left` lands, their `margin-right` and `float` do not.

### Consumer re-theming

Works, but every mirrored declaration must be written twice by hand, so it does
not reuse Foundation's mixins for the RTL half unless combined with mechanism 1's
double-`@include` (at which point it is mechanism 1 with a different prefix and
the same costs).

### Verdict

A clean, dependency-free, in-baseline fallback and the correct choice **if
logical properties ever prove insufficient** -- for example if
`$button-margin` becomes inline-asymmetric and the shorthand really must be
mirrored, since `:dir()` can flip a whole shorthand where a logical property
cannot. But for the two declarations actually at stake it buys nothing over
mechanism 3 while costing a specificity class and a duplicated declaration set.
**Runner-up.**

## Recommendation

**Mechanism 3, via Foundation's own interpolation hooks.** In
`_foundation-button.scss`, after the three `@import`s, add:

```scss
// Foundation reads these at @include time via interpolation, so pointing them
// at CSS logical keywords makes its real button mixins emit
// `float: inline-end` / `margin-inline-start` -- one stylesheet, mirrored by
// `dir` alone, no second @include and no [dir] selector.
$global-left: inline-start;
$global-right: inline-end;
```

Then delete the rtlcss stage from `compile-default-css` (the `.rtl.css` file and
the `rtlcss` dependency both become dead) and extend
`apps/nfs-demo/e2e/nfs-button-rtl.spec.ts` with a `.dropdown` button inside the
`dir="rtl"` container, asserting `marginLeft`/`marginRight` swap (**not**
`float`, which computes to `"inline-end"` in both directions).

Two guard rails to write down with it:

1. These two variables are now *NfsButton-scoped* lies about Foundation's
   contract. Foundation's `get-side()` and `-zf-flex-justify()` expect
   `left`/`right` keywords. No button mixin passes `$global-left`/`$global-right`
   into either (verified: `button-dropdown`'s offset hardcodes `right`), but the
   next component added to this pattern must be re-checked. A comment in
   `_foundation-button.scss` naming that constraint is cheap insurance.
2. If `$button-margin` ever becomes inline-asymmetric, add one `margin-inline`
   declaration in `nfs-button.scss` -- the four-value `margin:` shorthand from
   `button-base` cannot be mirrored through a variable.

**Runner-up: mechanism 4 (`:dir()`).** Same single stylesheet, same
`dir`-driven mirroring, no dependency, fully in-baseline, and it can mirror
shorthands. Take it if the shorthand gap becomes real, accepting one class of
extra specificity and duplicated declarations.

## UNRESOLVED

1. **Whether a PostCSS stage exists at all on the `styleUrl` path.** Both
   PostCSS mechanisms were run here as a standalone Node pass over the
   already-compiled `dist/.../nfs-button.css` (the Option 1 target). I did not
   establish whether `@nx/angular:package` / `ng-packagr` runs a project-level
   PostCSS config over a component's `styleUrl` stylesheet during a library
   build. Note there is an untracked `packages/ngx-foundation-sites/.postcssrc.json`
   in the working tree from a sibling research ticket, which suggests this is
   being investigated in parallel. This does not affect the recommendation
   (mechanism 3 needs no PostCSS) but it is load-bearing for the runner-up
   analysis of mechanism 2. **Settled by:** building the library with a marker
   declaration in a `.postcssrc.json` plugin and checking whether it appears in
   the packaged component styles.
2. **Whether the recommendation holds in WebKit and Gecko, not just Chromium.**
   Every browser observation above is headless Chromium via playwright-core
   1.62.1. `float: inline-end` and `margin-inline-start` are reported as fully
   supported in Firefox 55+ / Safari 15+ by mdn/browser-compat-data, and Safari
   is where logical-property bugs historically live. **Settled by:** running the
   extended RTL spec under Playwright's `webkit` and `firefox` projects.
3. **Whether `disable-mouse-outline` / the wider `_global.scss` import surface
   interacts with any of this.** Out of this ticket's scope, and the map already
   lists both as open.

## Reproduction

Throwaway probes (session scratchpad, not in the repo):

- `<scratchpad>/probes/a-reassign-globals.scss` -- mechanism 1, asymmetric
  padding/margin, prints the post-reassignment variable values.
- `<scratchpad>/probes/b-nested-global.scss` -- local vs `!global` inside the
  `[dir]` block, plus the leak check.
- `<scratchpad>/probes/c-control-baked.scss` -- **control**: reassign only the
  three direction globals, observe what stays LTR.
- `<scratchpad>/probes/_d-foundation-button.scss` + `d-cross-module.scss` --
  cross-module `!global` flip mixin (the shape this repo needs) and restore.
- `<scratchpad>/probes/e-logical-values.scss` -- the recommendation.

Compile with:
`node_modules/.bin/sass --load-path=node_modules --no-source-map --quiet <probe>.scss out.css`

PostCSS / browser / bundler probes: `D:/projects/sandbox/nfs-rtl-probe/`
(`run.mjs`, `logical-control.mjs`, `browser-check2.mjs`, `lightning.mjs`).
Dependencies there are scratchpad-local; the repo's `package.json` was not
modified and no new package was added to it.
