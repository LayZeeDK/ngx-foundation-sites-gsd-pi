# How does Angular Material let consumers theme CSS that Material itself compiled?

Type: research
Status: resolved
Blocked by: —

## Question

This is the effort's central tension. R020 requires component styles "compiled
by the consumer's own Angular build against variables the consumer sets in their
own settings file before importing library defaults". But R026 requires the
default styling to arrive via `styleUrl` -- which is compiled by the *library's*
build, at which point the consumer's Sass variables no longer exist. Angular
Material solved exactly this problem, and it is the reference API this project
already defers to (R010, D007, and the existing
`nfs-button.parity-review.md`).

Against the local `angular/components` clone, establish:

1. **The mechanism.** How does a consumer theme a Material component whose CSS
   was compiled by Material's build? Cover `mat.theme()`, the system/design-token
   layer, and how component SCSS references tokens (CSS custom properties with
   fallbacks, token name shape, where defaults are declared).
2. **Does Sass-variable-time theming still exist at all?** Material once had
   `define-light-theme`-style Sass configuration. Is per-component Sass-variable
   theming still supported, deprecated, or removed -- and what replaced it? If
   Material abandoned the model R020 describes, that is decisive evidence.
3. **Prebuilt themes.** Are they separate CSS files a consumer imports, and how
   do they relate to the token layer? Compare to this repo's Option-1
   precompiled `dist/.../css/nfs-button.css`.
4. **Cascade and layers.** Does Material wrap anything in `@layer`, and how does
   it guarantee a consumer override beats its defaults? Compare to R008's
   `@layer nfs-defaults` fix.
5. **The `@use ... with (...)` surface.** What can a consumer still configure at
   Sass time via `@use '@angular/material' as mat with (...)`, and what only via
   runtime tokens?

Deliverable: the concrete pattern to copy or reject for NfsButton, stated as a
recommendation. Note whether a token-indirection design can still satisfy D017's
"reuse Foundation's real mixins" -- Foundation computes derived values with
`scale-color` and `color-pick-contrast` at Sass time, which CSS custom
properties cannot reproduce, so say where the computation has to happen.

## Answer

Full findings, with `file:line` citations and compiled output:
[research/04-material-theming-pattern.md](../research/04-material-theming-pattern.md)

**Recommendation: copy Material's two-level `var()` fallback token indirection.
Reject `@layer nfs-defaults`. Reject the Option-1 precompiled-CSS analogy.**

**The decisive finding: Material already ships R026 and R020 together.**
`src/material/button/button.ts:35` is `styleUrls: ['button.css',
'button-high-contrast.css']` with `encapsulation: ViewEncapsulation.None`, and
`BUILD.bazel:128-140` compiles `button.scss` in Material's **own** Bazel build via
`sass_binary`. Consumers can never recompile it -- and still fully re-theme it. So
the capability R020 protects (theme without touching component code) is
compatible with R026's `styleUrl` delivery. Note the precise limit of that claim:
R020's *literal* wording ("compiled by the consumer's own Angular build") is still
not satisfied, because the consumer's Sass compiles token *values*, never rules.
The tension is in R020's wording, not in the capability.

Per sub-question:

1. **Mechanism.** `button.scss:9` bakes `$fallbacks: m3-button.get-tokens()` at
   library-build time; every declaration routes through `token-utils.slot()`
   (`_token-utils.scss:50-70`), emitting
   `var(--mat-<component-token>, var(--mat-sys-<role>))`. Measured on real
   compiled output: **148 `var()` references, zero hex, zero rgb/hsl, zero
   `@layer`.**
2. **Sass-variable theming is abandoned.** `mat.define-light-theme` is gone
   (reproduces as `Error: Undefined function`), renamed `m2-define-light-theme` in
   v18. Both surviving surfaces (`mat.button-theme`, `mat.button-overrides`)
   terminate in `token-utils.values`, which emits **only** custom properties.
   Measured: a legacy M2 per-component theme emits 148 custom-property
   declarations and **zero ordinary CSS declarations**. Consumer Sass is a *value*
   generator, never a *rule* generator.
3. **Prebuilt themes are the values half, not the rules half.** M3
   `azure-blue.css` is 167 lines of pure `--mat-sys-*`. It is **not** analogous to
   this repo's `dist/.../css/nfs-button.css`, which is a whole rules stylesheet.
   Material's analogue of that file is `button.css`, which consumers never import
   directly.
4. **`@layer` appears zero times in `src/material`.** Only CDK uses it, and
   disables it internally with the comment "`@layer` seems to break some targets".
   Overrides win by **custom-property inheritance**, which resolves on the element
   independently of the component rule's own specificity -- so a consumer
   declaration wins at any source order with no `!important` and no cascade layer.
   That is strictly more robust than R008's `@layer nfs-defaults` fix.
5. **`@use ... with` has effectively no styling surface.** One public `!default`
   remains and it is a legacy-API flag. Everything else is mixin map arguments --
   necessarily, since `with` resolves once and cannot support per-subtree
   `mat.theme()`.

**Where derivation happens (the crux), measured against Foundation's own
palette:**

- `scale-color($c, $lightness: -20%)` has an **exact** CSS equivalent in
  `hsl(from c h s calc(l * 0.8))` across all five `$button-palette` members --
  but **it is not usable at this project's baseline** -- for a narrower reason than
  a raw failure count suggests. Full flag audit against the pinned 2026-05-07 set:

  | agent | full (`y`) | partial (`a #2`) | none (`n`) |
  |---|---|---|---|
  | chrome / edge | 131-150 | **119-130** | -- |
  | firefox | 133-152 | 128-132 | **119-127** |
  | safari / ios_saf | 18.0-26.4 | **17.0-17.6** | -- |
  | and_chr / and_ff | 150 / 152 | -- | -- |

  caniuse note `#2` is shared by every partial entry, and it is
  [Mozilla bug 1893966](https://bugzilla.mozilla.org/show_bug.cgi?id=1893966)
  (RESOLVED FIXED, P2/S3): relative colour syntax does not accept the
  **`currentcolor`** keyword as the origin colour. **That limitation does not touch
  this use case at all** -- the origin would be a token, `hsl(from
  var(--nfs-button-background) h s calc(l * 0.8))`, never `currentcolor`. So all
  ~43 partial targets behave as full support here.

  The blocker is the other column: **Firefox 119-127 have no relative-colour
  support whatsoever** (`n`, not `a`), and that is 9 of 136 targets. Sized the same
  way `:dir()` was sized -- and because partials are acceptable for us, the bar
  drops from Firefox 133 to Firefox 128, pulling the clear date in from
  ~2027-04-01 to **~2027-01-15**. Still roughly **17 months** out, versus five
  weeks for `:dir()`, so it is not in the category the user approved.

  Consequence: the recommendation is unchanged and still reinforced. Even with
  relative colours available, `color-pick-contrast` has no CSS equivalent at any
  threshold, so contrast must be computed in the library's Sass build regardless;
  relative colours would only replace **hover** derivation. Recorded as a future
  upgrade path rather than a present option -- see the map's fog.
- `color-mix(in srgb, X 80%, black)` is correct only for L <= 50% and **visibly
  diverges on `success` (~5pp/channel) and `alert`** -- so it is not a substitute.
- `color-pick-contrast` has **no** CSS equivalent, and no fixed threshold works:
  Foundation picks black for `warning` at L exactly 50.00%, while `secondary` and
  `alert` are decided by a 0.1 margin.

Therefore contrast must stay Sass-time in the **library's** build, baked as the
`var()` fallback -- exactly Material's choice. **D017 survives**: Foundation's real
mixins still compute the defaults, they just land in fallback position.

Bonus precedent for the map's `disable-mouse-outline` fog item:
`button-high-contrast.scss` is a 13-line separate `styleUrls` entry -- first-party
support for shipping R026's accessibility-only CSS as its own sheet.

**Provenance: cleared. No claim rests on the 18.2.x branch.** `v22.0.4` is a tag
already present in the shared clone, read exclusively through
`git show v22.0.4:<path>`, `git grep <pat> v22.0.4 --` and
`git archive v22.0.4 | tar -x` -- all object-database reads that touch neither
index nor working tree. Verified afterwards: branch still `18.2.x`,
`git status --porcelain` empty, single worktree. Blob hashes prove the bytes are
v22 on every load-bearing file (`button.ts` `cea77a03` -> `4363735c`,
`button.scss` `7cc65bbc` -> `e2fe568b`, `_token-utils.scss` `6ac1c4e1` ->
`56be21d0`). The concern was well-founded rather than merely cautious: v18 does not
only rename `define-light-theme`, it **predates `mat.theme()` entirely**, so the
central mechanism would have been unobservable at 18.2.x.

**Confirmed on the published npm artifact, not just source.** Tarballs pulled
from `registry.npmjs.org` (22.1.1, plus 22.0.4 for an exact-version match; a plain
`npm i` failed because this project's npm points at its own Verdaccio, which was
not running).

- The published package ships **no standalone `button.css`** -- ng-packagr inlines
  it as `styles: ["..."]` in `fesm2022/button.mjs`. **Material's authoring format
  is `styleUrl`; its shipping format is inlined CSS.** That is an independent
  confirmation of tickets 01 and 02, from a different library's build.
- `cmp` of published 22.0.4 against 22.1.1: byte-identical, 25170 B.
  `diff --strip-trailing-cr` of a local plain-`sass` compile against the published
  string: **exit 0, zero differences.** No autoprefixer, no minifier.
- All measurements reproduce on the shipped artifact: 148 `var()`, 79 `--mat-sys`
  lines, 14 `color-mix`, 0 hex, 0 rgb/hsl, **0 `@layer`**.
- Legacy API closed against the installed package: `mat.define-light-theme(...)`
  gives `Error: Undefined function` (exit 65), while `m2-define-light-theme`,
  `mat.theme`, `mat.button-theme` and `mat.button-overrides` all compile clean,
  emitting **315 custom-property declarations and 0 ordinary CSS declarations**.
  Separately, `@use '@angular/material' with (...)` fails against the real package
  at `node_modules/@angular/material/_index.scss:15` -- not a load-path artifact.

**Correction the agent volunteered:** its original "zero `!important`" was wrong.
There are **2**, both `transition/animation: none !important` inside the
`_mat-animation-noopable` block. Neither is a token declaration, so the
inheritance argument stands, but the absolute phrasing did not.

**R008 gate -- do not unwind the layer on this argument alone.** A whole-package
sweep of installed `@angular/material@22.1.1` (Sass partials, 8 prebuilt themes,
all fesm bundles) found `@layer` in **0 files**, with a CDK positive control
finding 3. But the original R008 consumer-app cascade bug was never reproduced
against a token-based build. Before deleting `@layer nfs-defaults`, replay that
reproduction and confirm token inheritance actually fixes it. Folded into
tickets 06 and 10.
