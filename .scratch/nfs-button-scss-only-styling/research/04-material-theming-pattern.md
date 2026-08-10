# How does Angular Material let consumers theme CSS that Material itself compiled?

Research findings for ticket `issues/04-material-theming-pattern.md`.

## Sources audited

**Primary source 1 -- `angular/components` clone** at
`D:\projects\github\angular\components`.

**PROVENANCE (asked for explicitly; read this before trusting any citation).**
The clone's *working tree* is on branch `18.2.x`
(`cfc8cf7ebd36b0579bea87626ec09646db8b8f83 Tue Nov 19 14:05:41 2024 +0000 release: cut the v18.2.14 release`)
and **I never checked out anything else**. Nothing in the clone was modified,
no branch was switched, no worktree was created, nothing was committed
(`git status --porcelain` empty and `git branch --show-current` = `18.2.x`,
verified at the end of the session).

**Not one claim in this document rests on the 18.2.x tree.** The v22 content was
read out of the object database at the `v22.0.4` **tag, which already exists in
this clone** -- the clone was fetched with full tags (`git tag` lists through
`v22.1.0-next.3`). Access was exclusively via:

- `git show v22.0.4:<path>` for reading files,
- `git grep <pattern> v22.0.4 -- <pathspec>` for searching,
- `git archive v22.0.4 src/material src/cdk | tar -x -C <scratchpad>` for the
  compile.

All three read the tagged commit directly and touch neither the index nor the
working tree. Verification that `v22.0.4` resolves in this clone:

```
git cat-file -t v22.0.4   -> commit
git rev-parse v22.0.4     -> bef34ecbcd3c2f6bc600d5d559a8ca03477bec17
  ("Wed Jul 8 10:30:01 2026 +0200 release: cut the v22.0.4 release")
```

**Proof that the bytes I read are v22 and not 18.2.x** -- the blob hashes differ
on every load-bearing file, so a 18.2.x read could not have produced this
content:

| file | `18.2.x` blob | `v22.0.4` blob |
|---|---|---|
| `src/material/button/button.ts` | `cea77a03e0e8c8cd40ecc0f7156c05f1c4ef3121` | `4363735c48b8421b635a48f0928021ae903b3379` |
| `src/material/button/button.scss` | `7cc65bbcd4d05d1fef78e0fb68bf3d36faeaf9f0` | `e2fe568b74b7b0253907f9ef2d5464783d3c8d76` |
| `src/material/core/tokens/_token-utils.scss` | `6ac1c4e1acdb705358d900fb4d3e98d4f6116c55` | `56be21d0df12362437dc8c61eb0770e0b43d3943` |

Every `file:line` citation below is written as `v22.0.4:<path>:<line>` precisely
so this is auditable -- reproduce any of them with
`git show v22.0.4:<path>`. There is no per-claim split to report, because there
are no 18.2.x-sourced claims.

The v18-vs-v22 concern is exactly right in principle, and it is why the whole
audit was done at the tag. v18.2.x would indeed have been the worst vantage
point: v18 is where `define-light-theme` was renamed, and v18 also **predates
`mat.theme()` entirely** (v19), so the central mechanism could not have been
observed there at all.

**Primary source 1b -- published npm artifacts** (added to close both gaps; see
"Published-artifact verification" below). `@angular/material@22.1.1` and
`@angular/material@22.0.4` tarballs downloaded from `registry.npmjs.org` and
extracted under `D:\projects\sandbox\mat22-verify\` -- outside both repos, per
the preferred scratch location. No branch checkout, no shared-clone mutation.

- Empirical verification: v22 sources were extracted to the session scratchpad
  and compiled with this repo's own `node_modules/.bin/sass`. Compiled CSS
  quoted below is real output, not reconstructed -- and is now additionally
  proven **byte-identical to the published artifact** (see below).

**Primary source 2 -- Material's in-clone docs**: `v22.0.4:guides/theming.md`,
`v22.0.4:guides/theming-your-components.md`, `v22.0.4:guides/material-2.md`,
`v22.0.4:CHANGELOG.md`,
`v22.0.4:src/material/schematics/ng-generate/theme-color/README.md`.

**Primary source 3 -- `foundation/foundation-sites` clone** at
`D:\projects\github\foundation\foundation-sites`, branch `develop`,
`git log -1` = `337be7a8d9d20d28f5d27d2d98131a6d3772506c Fri Sep 27 11:26:03 2024 -0700 Merge tag 'v6.9.0' into develop`.
Used for the derived-value analysis in Q6.

### Published-artifact verification (closes both gaps)

Both verification-completeness gaps from the first pass are now **closed against
the artifact consumers actually receive**, not against a local recompile.

An `npm install` was attempted first and failed with `ECONNREFUSED` --
this project's npm is pointed at its own Verdaccio registry
(`http://localhost:4873`, used by the `apps/nfs-demo` e2e suite) which was not
running. Rather than change npm config, the published tarballs were fetched
straight from `registry.npmjs.org` with `curl` and extracted. Installed
versions confirmed from their own `package.json`: **material 22.1.1, cdk 22.1.1**
(plus material 22.0.4 for an exact-version comparison).

**First, a structural finding that matters for R026.** The published package
ships **no standalone `button.css`**. `node_modules/@angular/material/button/`
contains only the Sass theming partials (`_button-theme.scss`, `_m3-button.scss`,
...). The compiled component CSS is **inlined as a JS string literal** into
`fesm2022/button.mjs`:

```js
styles: [".mat-mdc-button-base {\n  text-decoration: none;\n}\n..."]
```

That is ng-packagr's `styleUrls` -> `styles: [...]` inlining -- precisely the
Angular pipeline R026 blesses, and the same one this library's own ng-packagr
build uses. So Material's authoring format is `styleUrl` referencing a
Sass-compiled `.css` (`button.ts:35`), and its *shipping* format is that CSS
inlined into the bundle. No consumer ever sees a `.scss` for the component's
rules.

**Gap (b) -- byte comparison. CLOSED, exact match.** The inlined CSS string was
extracted from `fesm2022/button.mjs` (walking the JS literal with escape
handling, then `JSON.parse`) and compared to my own plain-`sass` compile of
`v22.0.4:src/material/button/button.scss`:

```
cmp published-22.0.4 published-22.1.1              -> byte-identical (25170 bytes each)
diff --strip-trailing-cr my-sass-compile published-22.0.4  -> exit 0, zero differences
```

So there is **no autoprefixer, no minifier, no post-processing** between
`sass_binary` and the published bundle. The 554-vs-555 line count is a trailing
newline only; `diff` reports no content difference. Every measurement below is
therefore equally true of the local compile and the shipped artifact.

**All Q1.3 measurements re-run on published `@angular/material@22.1.1`:**

| Measurement | Published artifact | Matches local compile? |
|---|---|---|
| `var(` references | 148 | yes |
| lines referencing `--mat-sys` | 79 | yes |
| `color-mix(` occurrences | 14 | yes |
| hex colour literals | **0** (rg exit 1) | yes |
| `rgb()`/`rgba()`/`hsl()`/`hsla()` | **0** (rg exit 1) | yes |
| `@layer` | **0** (rg exit 1) | yes |
| `!important` | **2** | -- see correction |

The load-bearing declaration, quoted from the published bundle
(`published 22.1.1, extracted line 176-179`):

```css
.mat-mdc-unelevated-button:not(:disabled) {
  color: var(--mat-button-filled-label-text-color, var(--mat-sys-on-primary));
  background-color: var(--mat-button-filled-container-color, var(--mat-sys-primary));
}
```

**CORRECTION to the first pass.** I wrote that Material's compiled button CSS
"contains none" of `!important`. That was wrong: there are **2**, both in the
animation-disabling block, published lines 500-505:

```css
.mat-mdc-unelevated-button._mat-animation-noopable, ... {
  transition: none !important;
  animation: none !important;
}
```

Neither is a theming or token declaration. The substantive claim survives and is
restated precisely: **no `!important` appears anywhere in Material's token
mechanism** -- the two that exist are for suppressing animations, an orthogonal
concern. The absolute phrasing was the error, not the argument.

**Gap (a) -- legacy Sass API. CLOSED against the published package.** Compiled
with this repo's `sass` and `--load-path` pointed at the scratch
`node_modules`:

```scss
@use '@angular/material' as mat;
$t: mat.define-light-theme((color: (primary: mat.m2-define-palette(mat.$m2-indigo-palette))));
```

```
Error: Undefined function.
  4 | $t: mat.define-light-theme((
EXIT=65
```

Control, same published package, all in one file -- `mat.m2-define-light-theme`,
`mat.theme`, `mat.button-theme` and `mat.button-overrides` together compile
cleanly (**EXIT=0**), and the output is **315 custom-property declarations and 0
ordinary CSS declarations** (`rg -c '^\s+[a-z][a-z-]*\s*:'` exit 1). The Q2
conclusion reproduces exactly on the published package.

**Bonus -- original UNRESOLVED #1 also closed.** The `@use ... with (...)`
failure is *not* an artifact of my extracted-tree load path. Against the real
published package:

```
Error: This module was already loaded, so it can't be configured using "with".
  ---> node_modules\@angular\material\_index.scss
15| @forward './core/theming/theming' show $theme-ignore-duplication-warnings,
16|   $theme-legacy-inspection-api-compatibility;
EXIT=65
```

The published `_index.scss:15` is the culprit, exactly as predicted. **`@use '@angular/material' with (...)` cannot configure anything at all in v22.**

**Corroboration tier -- not usable.** `https://material.angular.dev/guide/theming`
was fetched via `markdown.new` and returned only the client-rendered SPA shell
(JSON-LD metadata, zero guide prose). The in-clone `guides/theming.md` is the
first-party source that page renders from and is the higher authority per the
ticket, so no website citation is needed. Not marked UNRESOLVED: the in-clone
guide fully answers what the website was wanted for.

---

## 1. The mechanism

**Material ships exactly the architecture R026 describes, and it is not in
tension with consumer re-theming at all.**

### 1.1 Material's component CSS is compiled by Material's own build and reaches the DOM via `styleUrl`

`v22.0.4:src/material/button/button.ts:28-41`:

```ts
@Component({
  selector: `...`,
  templateUrl: 'button.html',
  styleUrls: ['button.css', 'button-high-contrast.css'],
  host: {'class': 'mdc-button'},
  exportAs: 'matButton, matAnchor',
  encapsulation: ViewEncapsulation.None,
})
```

Note `button.css`, not `button.scss`. The `.css` is a build artefact of
Material's own Bazel build -- `v22.0.4:src/material/button/BUILD.bazel:128-140`:

```
sass_binary(
    name = "css",
    src = "button.scss",
    ...
)
```

`encapsulation: ViewEncapsulation.None` (`button.ts:40`) means the stylesheet is
global, exactly as in this repo. `icon-button.ts:20` and the FAB
(`fab.ts:65`, `fab.ts:94`) follow the same shape.

**A Material consumer can never recompile `button.scss`.** Yet a Material
consumer can fully re-theme the button. The two requirements coexist because of
1.2.

### 1.2 Every themeable value in the compiled CSS is a two-level CSS custom property chain

`v22.0.4:src/material/button/button.scss:9` declares the fallback table once,
at Material's build time:

```scss
$fallbacks: m3-button.get-tokens();
```

and every declaration reads through `token-utils.slot()`
(`v22.0.4:src/material/button/button.scss:129-130`):

```scss
  &:not(:disabled) {
    color: token-utils.slot(button-filled-label-text-color, $fallbacks);
    background-color: token-utils.slot(button-filled-container-color, $fallbacks);
  }
```

`slot()` is `v22.0.4:src/material/core/tokens/_token-utils.scss:50-70`:

```scss
@function slot($token, $fallbacks, $fallback: null) {
  // ... flattens $fallbacks into $fallbacks-flattened, errors on unknown token ...
  $sys-fallback: map.get($fallbacks-flattened, $token);
  @if (sass-utils.is-css-var-name($sys-fallback)) {
    $sys-fallback: _create-var($sys-fallback, $fallback);
  }

  @return _create-var(--mat-#{$token}, $sys-fallback);
}
```

with `_create-var` at `_token-utils.scss:7-13` returning `var($name, $fallback)`
and `is-css-var-name` at
`v22.0.4:src/material/core/style/_sass-utils.scss:55-57` returning true for any
string starting `--`.

The reason the fallback is itself a variable name is
`v22.0.4:src/material/core/tokens/m3/_theme.scss:9-35`. `$sys-theme` maps every
system key to the literal *string* `--mat-sys-<key>`:

```scss
// Return a new map where the values are the same as the provided map's
// keys, prefixed with "--mat-sys-". For example:
// (key1: '', key2: '') --> (key1: --mat-sys-key1, key2: --mat-sys-key2)
@function _create-system-app-vars-map($map) {
  $new-map: ();
  @each $key, $value in $map {
    $new-map: map.set($new-map, $key, --mat-sys-#{$key});
  }
  @return $new-map;
}
...
$sys-theme: (_mat-system: $_system);
```

and `m3-button.get-tokens()` defaults to `$theme: m3.$sys-theme`
(`v22.0.4:src/material/button/_m3-button.scss:11`), assigning e.g.
`button-filled-container-color: map.get($system, primary)`
(`_m3-button.scss:52`) -- which resolves to the string `--mat-sys-primary`.

Material's own source comments state the resulting shape verbatim, at
`v22.0.4:src/material/core/theming/_definition.scss:10-12`:

```scss
// Prefix used for component token fallback variables, e.g.
// `color: var(--mat-text-button-label-text-color, var(--mat-sys-primary));`
$system-fallback-prefix: mat-sys;
```

### 1.3 Verified compiled output

`button.scss` was compiled at v22.0.4 with this repo's `sass` (554 lines out).
Real output:

```css
.mat-mdc-unelevated-button:not(:disabled) {
  color: var(--mat-button-filled-label-text-color, var(--mat-sys-on-primary));
  background-color: var(--mat-button-filled-container-color, var(--mat-sys-primary));
}
```

Measured over the whole compiled file:

| Measurement | Result |
|---|---|
| `var(` references | 148 |
| lines referencing `--mat-sys` | 79 |
| hex colour literals (`#[0-9a-fA-F]{3}`) | **0** (rg exit 1) |
| `rgb()` / `rgba()` / `hsl()` / `hsla()` literals | **0** (rg exit 1) |
| `color-mix(` occurrences | 14 |
| `@layer` | **0** (rg exit 1) |

**Material's library-compiled component CSS contains zero baked colour values.**
There is nothing for a consumer to override, because there is nothing concrete
to override -- only variable reads.

### 1.4 Naming convention

Two namespaces, both flat and prefix-based:

- **Component tokens**: `--mat-<component>-<variant>-<property>` -- emitted by
  `_token-utils.scss:69` as `--mat-#{$token}` where `$token` already carries the
  component prefix (`button-filled-container-color` ->
  `--mat-button-filled-container-color`).
- **System tokens**: `--mat-sys-<role>` (`m3/_theme.scss:14`), e.g.
  `--mat-sys-primary`, `--mat-sys-on-surface`, `--mat-sys-label-large-font`,
  `--mat-sys-corner-full`, `--mat-sys-level1`.

No BEM-ish separators, no per-component prefix registry, no nesting. The
component token *is* the system token's consumer, via the `var()` fallback slot.

### 1.5 Where defaults are declared

**In the `var()` fallback position inside Material's own compiled CSS -- nowhere
else.** There is no default theme stylesheet a consumer must import to get a
working button. If the consumer never calls `mat.theme()`, `--mat-sys-primary`
is undefined and the declaration is invalid-at-computed-value-time; that is why
Material *requires* a theme (or a prebuilt theme CSS file, Q3). Non-colour
defaults are baked as real literals in the fallback, e.g.
`height: var(--mat-button-filled-container-height, 40px)` and
`padding: 0 var(--mat-button-filled-horizontal-padding, 24px)` -- so structure
survives without a theme, only colour/typography do not.

---

## 2. Does Sass-variable-time theming still exist at all?

**Sass still runs in the consumer's build. It no longer compiles component
rules. Its only job is to emit CSS custom property values.** That distinction is
the whole answer, and it is decisive against R020 as literally worded.

### 2.1 What was removed

`v22.0.4:CHANGELOG.md` (18.0.0 "satin-sasquatch", Breaking Changes) records the
rename of the entire M2 Sass configuration surface behind an `m2-` prefix:

```
- The following APIs have been renamed. If you update using `ng update`, your app will be fixed automatically.
  * `define-light-theme` to `m2-define-light-theme`
  * `define-dark-theme` to `m2-define-dark-theme`
  * `define-palette` to `m2-define-palette`
  * `get-contrast-color-from-palette` to `m2-get-contrast-color-from-palette`
  * `get-color-from-palette` to `m2-get-color-from-palette`
  ...
  * `$red-palette` to `$m2-red-palette`
  ...
```

Empirically confirmed against v22.0.4: compiling
`$t: mat.define-light-theme(...)` fails with `Error: Undefined function.`
(exit 65). Only `mat.m2-define-light-theme(...)` resolves. The un-prefixed
`define-light-theme` name the ticket refers to is **gone**.

`guides/theming.md` states the cut-off directly:

> This guide describes how to set up theming for your application using Sass
> APIs introduced in Angular Material v19.
>
> If your application depends on a version before v19, or if your application's
> theme is applied using a theme config created with `mat.define-theme`,
> `mat.define-light-theme`, or `mat.define-dark-theme`, then you can refer to the
> theming guides at [v18.material.angular.dev/guides](https://v18.material.angular.dev/guides).

i.e. the theme-config Sass APIs are no longer documented in current docs at all
-- their documentation has been moved off to an archived version site.
`guides/material-2.md` adds: *"This guide refers to Material 2, the previous
version of Material"* and *"The M2 themes are provided for backwards
compatibility and will be removed in a future version"* (the latter in
`guides/theming.md`, Prebuilt Themes).

### 2.2 What per-component Sass theming still exists -- and what it actually emits

Two Sass surfaces survive, both per-component, both exported from
`v22.0.4:src/material/_index.scss:73-74`:

```scss
@forward './button/button-theme' as button-* show button-theme, button-color, button-typography,
  button-density, button-base, button-overrides;
```

**(a) `mat.button-theme($theme)`** -- the legacy theme-config route.
`v22.0.4:src/material/button/_button-theme.scss:12-19` shows every one of them
terminating in `token-utils.values($tokens)`:

```scss
@mixin base($theme) {
  $tokens: map.get(m2-button.get-tokens($theme), base);
  @if inspection.get-theme-version($theme) == 1 {
    $tokens: map.get(m3-button.get-tokens($theme), base);
  }

  @include token-utils.values($tokens);
}
```

and `token-utils.values` (`_token-utils.scss:73-81`) emits **only** custom
property declarations:

```scss
@mixin values($tokens) {
  @include sass-utils.current-selector-or-root() {
    @each $key, $value in $tokens {
      @if $value != null {
        --mat-#{$key}: #{$value};
      }
    }
  }
}
```

Verified empirically. Compiling
`.legacy-scope { @include mat.button-theme(mat.m2-define-light-theme(...)); }`
at v22.0.4 produced 170 lines containing **148 custom-property declarations and
zero ordinary CSS declarations** (`rg -c '^\s+[a-z][a-z-]*\s*:'` exit 1). Sample:

```css
  --mat-button-filled-container-color: white;
  --mat-button-filled-label-text-color: rgba(0, 0, 0, 0.87);
```

and for the palette variants:

```css
.mat-mdc-button.mat-primary, .mat-mdc-unelevated-button.mat-primary, ... {
  --mat-button-filled-container-color: #3f51b5;
  --mat-button-filled-label-text-color: white;
}
```

The consumer's Sass computed `#3f51b5` and `rgba(0, 0, 0, 0.87)` -- but it wrote
them into custom properties. It did not re-emit `background-color`. The compiled
`button.css` still supplies the `background-color: var(...)` rule.

**(b) `mat.button-overrides((...))`** -- the current per-component route,
`_button-theme.scss:86-88`:

```scss
@mixin overrides($tokens: ()) {
    @include token-utils.batch-create-token-values($tokens, _define-overrides());
}
```

Verified: `.brand-button { @include mat.button-overrides((filled-container-color: rebeccapurple, filled-label-text-color: white)); }`
compiles to exactly:

```css
.brand-button {
  --mat-button-filled-container-color: rebeccapurple;
  --mat-button-filled-label-text-color: white;
}
```

`batch-create-token-values` (`_token-utils.scss:86-124`) validates names at
Sass time. Verified: a deliberate typo `filled-container-colour` fails the build
with `Error: Invalid token name 'filled-container-colour'. Valid tokens are: ...`
followed by all 108 valid button token names. This is a real, useful property --
Sass-time spell-checking of a runtime-variable surface.

### 2.3 Verdict on R020

> **Material has abandoned the model R020 describes.** No Angular Material
> component's CSS is ever compiled by the consumer's build. Not on the modern M3
> path, and not on the legacy M2 path either -- both terminate in
> `token-utils.values`, which writes custom properties only. Consumer Sass in
> Material v22 is a *value generator*, never a *rule generator*.

That is decisive evidence for this project, and it dissolves the ticket's stated
"central tension": R020 and R026 are only in conflict if you read R020 as
requiring the consumer's build to compile the *rules*. Material's answer is that
the consumer's build compiles the *values* and the library's build compiles the
rules.

---

## 3. Prebuilt themes

**Yes -- separate, standalone CSS files, and on the M3 path they are nothing but
a `--mat-sys-*` variable dump.**

`guides/theming.md` (Prebuilt Themes) lists eight, four M3 and four M2, and
documents the consumption path as an `angular.json` `styles` entry:

```json
"styles": [
  "@angular/material/prebuilt-themes/azure-blue.css"
]
```

The M3 source is trivially small --
`v22.0.4:src/material/core/theming/prebuilt/azure-blue.scss` in full:

```scss
@use '../../theming/palettes';
@use '../../tokens/system';

html {
  @include system.theme((
    color: (
      theme-type: light,
      primary: palettes.$azure-palette,
      tertiary: palettes.$blue-palette,
    ),
    typography: Roboto,
    density: 0,
  ));
}
```

Compiled (verified): 167 lines, entirely custom properties under `html`:

```css
html {
  --mat-sys-background: #faf9fd;
  --mat-sys-on-primary: #ffffff;
  --mat-sys-primary: #005cbb;
  ...
```

The M2 prebuilts are bigger (`indigo-pink.css` = 2301 lines) because they also
emit per-component and per-palette-variant token blocks and the
`app-background` / `elevation-classes` helpers. But measured: **1517
custom-property declarations**, and the only ordinary declarations in the file
are the helper utilities, which are themselves `var()`-driven:

```css
  background-color: var(--mat-app-background-color, var(--mat-sys-background, transparent));
```

### Relation to the token layer

A prebuilt theme *is* the token layer, serialised. It is interchangeable with a
consumer's own `mat.theme()` call -- same output shape, same variables, same
selector (`html`). The component CSS is identical either way and is shipped
separately, inside the component's own `styleUrls`.

### Comparison to this repo's Option-1 `dist/.../css/nfs-button.css`

These are **not** the same artefact and the analogy is a trap:

| | Material prebuilt `azure-blue.css` | This repo's `dist/.../css/nfs-button.css` |
|---|---|---|
| Contains component rules? | No | Yes (`.button { ... }`) |
| Contains baked colours? | Yes (`--mat-sys-primary: #005cbb`) | Yes (`background-color: #1779ba`) |
| Is it required for the component to render? | No -- structure comes from `button.css` | It *is* the component's styling |
| Can a second one be loaded to re-theme? | Yes, trivially -- it only sets variables | No -- it would duplicate and fight all 100+ rules |

Material's prebuilt theme is the **values half** of a two-artefact split. This
repo's precompiled CSS is a **whole**, self-contained stylesheet. The Material
equivalent of `nfs-button.css` is `button.css` (the `styleUrls` artefact), and
Material has no consumer-facing "precompiled alternative" to it -- because it
never needed one.

---

## 4. Cascade and layers

**Material uses `@layer` nowhere in `src/material`. Zero occurrences.**

```
git grep -c '@layer' v22.0.4 -- 'src/material/**'   ->  exit 1 (no matches)
```

Positive control: the same search over the whole `src` tree returns exit 0 with
three CDK hits, so the search mechanics are sound. The compiled `button.css`
also contains no `@layer` (verified on the real output).

**Confirmed on the published artifact, whole-package sweep.** Because the
recommendation unwinds R008, this claim was re-verified against
`@angular/material@22.1.1` as installed -- every file in the package, including
the Sass partials, the eight prebuilt theme CSS files, and all `fesm2022/*.mjs`
bundles with their inlined component CSS:

```
rg -l '@layer' node_modules/@angular/material   -> exit 1, 0 files
rg -l '@layer' node_modules/@angular/cdk        -> exit 0, 3 files   (positive control)
```

Zero occurrences across the entire shipped Angular Material package; the same
command finds three files in the CDK, so the zero is genuine and not a broken
search. (The first attempt at this check piped `rg` into `head` and read
`$?` -- which reports *head's* exit status, not `rg`'s. Re-run without the pipe;
the corrected result is the one above.)

Angular Material v22 ships a fully re-themeable component library, to the same
"Baseline widely available" browser-support policy this repo targets, and does
not use `@layer` anywhere to achieve it.

The only `@layer` usage in the entire repository is in the CDK, and it is for
z-index/reset containment, not theming:

- `v22.0.4:src/cdk/drag-drop/resets.scss:1` -- `@layer cdk-resets { ... }`,
  wrapping user-agent resets for `.cdk-drag-preview`.
- `v22.0.4:src/cdk/overlay/_index.scss:18` -- a `_conditional-layer($should-wrap)`
  mixin wrapping only `z-index` / `background` / `transition` declarations in
  `@layer cdk-overlay`.

And crucially, that CDK layer is **off for Material's internal build**.
`v22.0.4:src/cdk/overlay/overlay-structure.scss:1-6`:

```scss
@use './index' as overlay;

// We don't emit the layer internally, because all the breaking changes
// have been resolved already and the `@layer` seems to break some targets.
$_is-external-build: true;

@include overlay.private-overlay-structure($_is-external-build);
```

Note "the `@layer` seems to break some targets" -- Material treats `@layer` as
carrying real compatibility risk.

### How Material guarantees a consumer override wins

**It sidesteps the cascade entirely.** There is no specificity contest and no
layer ordering to reason about, because Material's default and the consumer's
override never occupy competing declarations:

- Material's default lives in the **`var()` fallback position** of the
  declaration -- `background-color: var(--mat-button-filled-container-color, var(--mat-sys-primary))`.
- The consumer's value is a **custom property declaration** on some ancestor --
  `.brand-button { --mat-button-filled-container-color: rebeccapurple; }`.

Custom property resolution is by **inheritance**, evaluated per element after the
cascade has already settled. A fallback is consulted only when the property is
genuinely unset on that element's inheritance chain. So:

- The consumer's override wins at any specificity, including a bare class
  (0,1,0) -- verified: the emitted `.brand-button` rule is a single-class
  selector, and it defeats a default that lives inside a `.mat-mdc-unelevated-button:not(:disabled)`
  (0,2,0) declaration.
- Source order is irrelevant. The theme stylesheet may load before or after
  `button.css`.
- **No `!important` is needed anywhere**, and Material's compiled button CSS
  contains none.
- Scoping is free: `mat.theme()` at `html` themes globally,
  `.example-bright-container { @include mat.theme((color: mat.$cyan-palette)); }`
  re-themes a subtree (`guides/theming.md`, Context-specific Themes). This works
  purely through inheritance -- something `@layer` cannot give you.

### Comparison to R008's `@layer nfs-defaults`

This repo currently wraps its defaults in `@layer nfs-defaults`
(`packages/ngx-foundation-sites/src/lib/nfs-button/nfs-button.styles.ts:25`,
and as a post-process step on the Option-1 output per
`packages/ngx-foundation-sites/src/scss/nfs-button.scss:25-31`). The README
explains the intent (`packages/ngx-foundation-sites/README.md:119`):

> Per the CSS cascade spec, any unlayered rule always beats a layered rule
> regardless of specificity or load order, so your themed stylesheet wins
> automatically as long as it isn't itself wrapped in a named `@layer` that
> sorts before `nfs-defaults`.

That reasoning is correct, but note the escape clause it has to carry -- *"as
long as it isn't itself wrapped in a named `@layer`"*. `@layer` is a
**whole-stylesheet-wins** mechanism: it makes the consumer's *entire* themed
stylesheet beat the library's *entire* default stylesheet. It cannot express
"take my primary colour but keep your padding", and it composes badly with a
consumer who has their own layer strategy (Tailwind v4, Open Props, and CSS
Nesting-era design systems all use named layers).

Material's mechanism is **per-value**, needs no layer, and cannot be defeated by
a consumer's own layer ordering. It is strictly the more robust of the two.

---

## 5. The `@use ... with (...)` surface

**Effectively zero. There is no styling knob on `@use '@angular/material' with (...)`
in v22.**

Sweeping the entire theming/token/style surface for configurable variables:

```
git grep -n '!default' v22.0.4 -- 'src/material/core/theming/*.scss' 'src/material/core/tokens/*.scss' 'src/material/core/style/_sass-utils.scss'
```

returns six hits, and only one is public:

- `v22.0.4:src/material/core/theming/_theming.scss:12` --
  `$theme-legacy-inspection-api-compatibility: true !default;` (a legacy-API
  compatibility flag, not a style value).
- `_theming.scss:15` `$_generate-default-density` and `_theming.scss:29-32`
  `$_emitted-color` / `$_emitted-typography` / `$_emitted-density` /
  `$_emitted-base` are underscore-private, and the source says so at
  `_theming.scss:27-28`: *"These variable are not intended to be overridden
  externally. They use `!default` to ..."*.

The one other variable `_index.scss:15` forwards,
`$theme-ignore-duplication-warnings`, is declared at `_theming.scss:9` **without**
`!default` -- so it cannot be configured via `with` even in principle.

Two empirical results confirm this:

1. `@use '.../material' as mat;` (no `with`) compiles cleanly at v22.0.4.
2. `@use '.../material' as mat with ($theme-legacy-inspection-api-compatibility: false);`
   **fails** (exit 65) with *"This module was already loaded, so it can't be
   configured using `with`"* -- because `_index.scss:2` forwards `./core/m2`,
   which transitively loads `./core/theming/theming`, before `_index.scss:15`
   forwards it. So even the single remaining `!default` is unreachable through
   the public entry point. **Reproduced against the published npm package**
   (`node_modules/@angular/material/_index.scss:15`) -- see
   "Published-artifact verification". The earlier caveat about this being a
   load-path artifact is withdrawn; it is real.

### What the consumer configures instead -- all at Sass time, all mixin arguments

`guides/theming.md` documents the complete surface, and it is passed as **map
arguments to mixins**, never as `@use ... with`:

```scss
@use '@angular/material' as mat;

html {
  color-scheme: light dark;
  @include mat.theme((
    color: mat.$violet-palette,     // or a map: (primary:, tertiary:, theme-type:)
    typography: Roboto,             // or a map: (plain-family:, brand-family:, bold-weight:, ...)
    density: 0                      // 0 to -5
  ), $overrides: (
    primary-container: orange,
  ));
}
```

Plus three override mixins:

- `mat.theme-overrides((primary-container: #84ffff))` -- redefine system tokens.
- `mat.<component>-overrides((...))` -- redefine component tokens (Q2b).
- `mat.strong-focus-indicators((border-color: red, border-style: dotted, ...))`.

**Why mixin arguments and not `@use ... with`:** `with` is resolved once per
module load, so it can only ever produce one global configuration. Mixin
arguments can be invoked repeatedly under different selectors -- which is
precisely what `guides/theming.md`'s "Multiple Themes" / "Context-specific
Themes" sections require. The API shape follows from the requirement.

### What is runtime-only

Nothing in the theming API is runtime-only in the sense of "unavailable at Sass
time". Everything is authored in Sass; the *output* is runtime variables. The
inverse is the real constraint: **nothing is Sass-time-only**. Every value
Material lets you set is expressible as a CSS custom property, which is why the
whole API can be a value generator. A consumer with no Sass at all can hand-write
`html { --mat-sys-primary: #005cbb; ... }` and get an equivalent result -- the
`theme-color` schematic will even emit plain CSS instead of Sass on request
(`isScss` option, `theme-color/README.md`).

---

## 6. Where DERIVED values are computed

This is the crux, and Material's answer is **three distinct places, none of them
the consumer's Sass build for colour arithmetic.**

### 6.1 Location A -- offline, in a TypeScript generator, ahead of both builds

Material does **no** perceptual colour arithmetic in Sass. Palettes are
pre-computed tone tables of literal hex values.
`v22.0.4:src/material/core/theming/_palettes.scss:31-45`:

```scss
$red-palette: _patch-error-palette((
  0: #000000,
  10: #410000,
  20: #690100,
  25: #7e0100,
  30: #930100,
  ...
```

Role assignment is a pure map lookup, not arithmetic --
`v22.0.4:src/material/core/tokens/m3/_md-sys-color.scss:4-12`:

```scss
@function md-sys-color-values-dark($palettes: ()) {
  $values: (
    background: map.get($palettes, neutral, 6),
    error: map.get($palettes, error, 80),
    ...
```

Custom palettes are generated by a schematic that runs **outside any stylesheet
build**, using Google's TS colour library --
`v22.0.4:src/material/schematics/ng-generate/theme-color/README.md:1-13`:

> This schematic allows users to create new Material 3 theme palettes based on
> custom colors by using
> [Material Color Utilities](https://github.com/material-foundation/material-color-utilities).
> ...
> The generated [color palettes](https://m3.material.io/styles/color/roles) are
> optimized to have enough contrast to be more accessible.

confirmed by `theme-color/index.ts:20` importing from
`@material/material-color-utilities` and `theme-color/BUILD.bazel:20,70`.

**This is the load-bearing architectural move.** Material moved all hard colour
science *out of Sass and out of CSS* into a code generator whose output is a
table of literals. Neither build ever performs the derivation.

### 6.2 Location B -- runtime, in the browser, via `color-mix()`

The derivations Material *does* keep are all expressible as opacity blends, and
they are done at **runtime**, in the compiled CSS.
`v22.0.4:src/material/core/tokens/_m3-utils.scss:20-35`:

```scss
// Returns the color with an opacity value using color-mix. If the color is a
// variable name, it will wrap it with `var()`.
@function color-with-opacity($color, $opacity) {
  @if (meta.type-of($color) == string and string.index($color, '--') == 1) {
    $color: var($color);
  }
  ...
  @return color-mix(in srgb, #{$color} #{$opacity}, transparent);
}
```

`color-mix` here is a **CSS** function name, emitted as text -- not Sass's
`color.mix`. Verified in the compiled output:

```css
.mat-mdc-unelevated-button.mat-mdc-button-disabled {
  color: var(--mat-button-filled-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-button-filled-disabled-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
```

and for the ripple, composing two runtime variables:

```css
.mat-mdc-unelevated-button .mat-ripple-element {
  background-color: var(--mat-button-filled-ripple-color, color-mix(in srgb, var(--mat-sys-on-primary) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
```

That last one is the key demonstration: a derived value computed from **two
tokens the consumer can change**, entirely at runtime. `--mat-sys-on-primary`
and `--mat-sys-pressed-state-layer-opacity` are both re-themeable, and the ripple
colour re-derives automatically. Nothing was pre-computed.

Material also uses `light-dark()` for the same reason -- one compiled artefact,
two runtime outcomes. Verified from `mat.theme()` output:

```css
html {
  --mat-sys-background: light-dark(#fef8fc, #151316);
  --mat-sys-error: light-dark(#ba1a1a, #ffb4ab);
```

### 6.3 Location C -- consumer Sass time, but only into variable *values* (M2 legacy)

The one place consumer-Sass arithmetic survives is the M2 path, and even there
the result is written to a custom property, never to a CSS property. Sass-time
colour functions remain in only three M2/legacy files across all of
`src/material`:

```
v22.0.4:src/material/core/theming/_theming.scss:171     color.mix($background-color, rgba($color, 1), ...)
v22.0.4:src/material/datepicker/_m2-datepicker.scss:49  color.adjust(#a8dab5, $lightness: -30%)
v22.0.4:src/material/progress-bar/_m2-progress-bar.scss:29  color.adjust($track-color, $alpha: -0.75)
v22.0.4:src/material/datepicker/_datepicker-theme.scss:63   color.adjust($overlap-color, $lightness: -30%)
```

The **M3 path contains none**. And M2's contrast derivation -- the direct analogue
of Foundation's `color-pick-contrast` -- is not computed either; it is a table
lookup into the palette's own `contrast:` sub-map,
`v22.0.4:src/material/core/m2/_theming.scss:24-26`:

```scss
@function get-contrast-color-from-palette($palette, $hue) {
  @return map.get(map.get($palette, contrast), $hue);
}
```

with `guides/material-2.md` documenting that a hand-authored M2 palette **must**
supply that table: *"The map must also define a `contrast` map with contrast
colors for each hue."* Material never computed contrast in Sass, on either path.

### 6.4 What this means for Foundation's derivations (D017)

Foundation does exactly what Material refuses to do. `foundation-sites` `develop`
@ `337be7a8`, `scss/components/_button.scss:189-195`:

```scss
  @if $color == auto {
    $color: color-pick-contrast($background, ($button-color, $button-color-alt));
  }

  @if $background-hover == auto {
    $background-hover: scale-color($background, $lightness: $background-hover-lightness);
  }
```

and `scss/components/_button.scss:231` for hollow:

```scss
  $color-hover: scale-color($color, $lightness: $hover-lightness);
```

Defaults: `$button-color: $white` (`:40`), `$button-color-alt: $black` (`:44`),
`$button-background-hover-lightness: -20%` (`:77`),
`$button-hollow-hover-lightness: -50%` (`:81`).

`color-pick-contrast` is a WCAG contrast-ratio comparison,
`scss/util/_color.scss:77-95`, calling `color-contrast` (`scss/util/_color.scss:54`)
per candidate and keeping the best beyond a tolerance.

Both take a **concrete Sass colour**. Neither can accept
`var(--nfs-button-background)`. This is the real constraint, and it is exactly
why R020 was written the way it was. So: can it be moved?

**I measured this rather than assuming.** Running the real functions against
Foundation 6.9.0's actual `$button-palette` members:

| Palette member | HSL L | Foundation `scale-color(-20%)` | `hsl(from c h s calc(l*0.8))` | `color-mix(in srgb, c 80%, black)` |
|---|---|---|---|---|
| `primary` `#1779ba` | 40.98% | `rgb(7.216%, 37.961%, 58.353%)` | identical | **identical** |
| `secondary` `#767676` | 46.27% | `rgb(37.020%, 37.020%, 37.020%)` | identical | **identical** |
| `warning` `#ffae00` | 50.00% | `rgb(80%, 54.588%, 0%)` | identical | **identical** |
| `success` `#3adb76` | 54.31% | `rgb(13.427%, 73.475%, 35.805%)` | identical | **`rgb(18.196%, 68.706%, 37.020%)` -- diverges ~5pp/channel** |
| `alert` `#cc4b37` | 50.78% | `rgb(64.745%, 22.984%, 16.510%)` | identical | **`rgb(64%, 23.529%, 17.255%)` -- diverges ~0.7pp** |

**Finding: `scale-color($c, $lightness: -k%)` has an exact CSS equivalent in
relative colour syntax -- `hsl(from <c> h s calc(l * (1-k)))` -- and it is exact
for the whole palette.** (Sass's `scale-color` with negative `$lightness` computes
`l_new = l * (1-k)` in HSL; relative colour syntax computes the same expression in
the same space.) The naive `color-mix(in srgb, X 80%, black)` substitution is
only correct for `L <= 50%` -- because uniform sRGB channel scaling preserves HSL
hue and, for `L < 0.5`, saturation too -- and it **visibly diverges on `success`**,
which is 2 of this repo's 5 palette members (`success`, `alert`). Anyone
reaching for `color-mix` here would ship a wrong hover colour on two variants.

**However -- relative colour syntax FAILS this repo's browser-support floor.**
This was checked against the repo's own resolved browserslist rather than
assumed, and the result **reverses** the first pass's recommendation on this
point. `.browserslistrc` is the single query `baseline widely available`,
aligned to Angular 22's documented policy. Resolved minimum per family:

| family | floor |
|---|---|
| chrome / edge | 121 |
| firefox | **122** |
| safari / ios_saf | 17.2 |

125 targets total. Checked with `browserslist` + `caniuse-lite@1.0.30001806`
resolved from this repo's own `node_modules`:

```
=== css-relative-colors -- hsl(from c h s calc(l*0.8)) ===
targets: 125, UNSUPPORTED: 6
firefox 127 -> n
firefox 126 -> n
firefox 125 -> n
firefox 124 -> n
firefox 123 -> n
firefox 122 -> n
```

Relative colour syntax did not ship in Firefox until 128, and Firefox 122-127 are
inside this repo's target set. **6 of 125 targets would get an invalid
declaration**, so `hsl(from var(--nfs-button-background) h s calc(l * 0.8))` is
not available to this project today. It becomes available when the browserslist
floor passes Firefox 128 -- worth re-checking later, since the query is a rolling
30-month window, but it is not usable now.

`color-mix()` is a different matter and *is* usable: this `caniuse-lite` build has
no `css-color-mix` feature entry so the mechanical check was unavailable, but
Angular Material v22 emits `color-mix(in srgb, ...)` 14 times in its published
button CSS (measured above) under the *same* "Baseline widely available" policy
this repo's `.browserslistrc` cites -- first-party evidence that it clears the
floor. `color-mix` is simply the wrong tool for the *lightness* derivation
(it diverges on `success`/`alert`, per the table above), not an unsupported one.

**`color-pick-contrast` has no CSS equivalent, and no simple threshold
reproduces it.** Foundation's real picks, computed by running its own function:

| Palette member | contrast vs `#fefefe` | contrast vs `#0a0a0a` | Foundation picks |
|---|---|---|---|
| `primary` | 4.6 | 4.3 | `#fefefe` |
| `secondary` | 4.5 | 4.4 | `#fefefe` |
| `success` | 1.8 | 10.9 | `#0a0a0a` |
| `warning` | 1.8 | 10.7 | `#0a0a0a` |
| `alert` | 4.5 | 4.4 | `#fefefe` |

A lightness>50% heuristic gets `warning` **wrong** (L is exactly 50.00%, so the
heuristic says white; Foundation picks black by a 10.7-vs-1.8 margin). And
`secondary`/`alert` are decided by a **0.1 margin** (4.5 vs 4.4) against a
default `$global-color-pick-contrast-tolerance` of 0 -- razor-thin and highly
sensitive to the input colour. CSS's `contrast-color()` is not Baseline (Safari
only as of this writing), so there is no runtime substitute.

**Conclusion on derivation placement.** A token design for NfsButton can honour
D017 -- but only by splitting the derivations, exactly the way Material split
its own:

| Foundation derivation | Where it must happen | Why |
|---|---|---|
| `scale-color($c, $lightness: -20%/-50%)` (hover bg, hollow hover) | **Sass time, in the *library's* build**, baked as the `var()` fallback | The exact CSS equivalent (`hsl(from c h s calc(l * 0.8))`) is verified correct across the full palette **but fails 6 of this repo's 125 browserslist targets** (Firefox 122-127). Revisit if/when the floor passes Firefox 128. `color-mix(in srgb, ...)` is supported but numerically wrong here. |
| `color-pick-contrast($bg, (white, black))` (auto text colour) | **Sass time only** -- in the *library's* build, baked as the `var()` fallback | No Baseline CSS equivalent; no correct threshold approximation. Consumers who change the background must also set the text-colour token, or accept the default pairing. |

So with today's browser floor, **both** Foundation derivations land in the same
place: the library's own Sass build, emitted into the `var()` fallback position.
That is a *simpler* outcome than the first pass suggested, and it makes the
recommendation cleaner -- there is exactly one derivation site, and D017's "reuse
Foundation's real mixins" is fully honoured because those mixins run, unmodified,
in the library's build. The cost is that a consumer overriding
`--nfs-button-background` must also override `--nfs-button-background-hover` and
`--nfs-button-color` to keep the triad coherent -- which is exactly the
obligation Material imposes with its paired `<role>` / `on-<role>` tokens.

That second row is the honest cost, and it is precisely the cost Material
accepted: Material does not derive contrast at all -- it demands a paired
`on-<role>` token for every `<role>` token (`--mat-sys-primary` /
`--mat-sys-on-primary`), pushing the contrast decision to the palette generator
(6.1) and documenting the pairing obligation in `guides/theming-your-components.md`:

> Text and icons should use the `on-primary` system color token ensure good
> contrast and accessibility

So the derivation does not disappear; it is **relocated to whoever picks the
palette**, and the library ships a correct default pair.

---

## Recommendation for NfsButton

### Copy: the two-level `var()` fallback token indirection, with the fallback baked at library-Sass time

Adopt Material's exact mechanism, which is the smallest change that satisfies
R020 and R026 simultaneously:

1. **Keep `nfs-button.scss` `@include`-ing Foundation's real mixins (D017
   preserved), and keep compiling it in the library's build.** Feed the mixins
   Sass variables as today -- `settings.$button-background` etc. This is what
   makes `color-pick-contrast` and `scale-color` still run, and it is
   non-negotiable given 6.4.
2. **Do not let the mixin output be the final CSS.** Post-process, or wrap the
   mixin call so each Foundation-computed value lands in a `var()` fallback:

   ```css
   /* what the library's build should emit */
   .button {
     background-color: var(--nfs-button-background, #1779ba);
     color: var(--nfs-button-color, #fefefe);
   }
   .button:hover, .button:focus {
     background-color: var(--nfs-button-background-hover, #127296);
   }
   ```

   The literal is Foundation's real `scale-color` / `color-pick-contrast` output,
   computed by the library's Sass -- exactly as
   `$fallbacks: m3-button.get-tokens()` (`button.scss:9`) bakes Material's
   defaults into its own compiled artefact.
3. **Ship via `styleUrl` with `ViewEncapsulation.None`**, matching
   `button.ts:35,40`. R026 satisfied, and the ticket's "central tension" is gone:
   R020's "variables the consumer sets" become CSS custom properties the
   consumer sets, and R020's "compiled by the consumer's own build" is revealed
   as an over-specification that Material itself abandoned (Q2.3).
4. **Naming: `--nfs-<component>-<variant>-<property>`**, flat, prefix-based,
   mirroring `--mat-<component>-<variant>-<property>`. Optionally add an
   `--nfs-sys-*` system tier if a second component ever needs to share
   `$primary-color`; do not build it for one component.
5. **Offer a Sass-time `nfs-button-overrides((...))` mixin** that emits only
   custom properties, mirroring `_button-theme.scss:86-88`. Cheap, and it buys
   the Sass-time typo validation demonstrated in Q2.2b -- a genuine advantage of
   Material's design that pure CSS variables lack.
6. **Bake the hover derivation at library-Sass time; do NOT use relative colour
   syntax, and do NOT use `color-mix` for it.** Emit
   `background-color: var(--nfs-button-background-hover, #127296)` where the
   literal is Foundation's real `scale-color` output. Relative colour syntax
   would be exact but fails 6 of this repo's 125 browserslist targets
   (Firefox 122-127; see 6.4) -- revisit when the floor passes Firefox 128.
   `color-mix(in srgb, X 80%, black)` is supported but numerically wrong on
   `success` and `alert`. This is a reversal of the first pass, which floated
   relative colour syntax before its support was checked.

### Reject: `@layer nfs-defaults` (R008)

**Confirmed against Angular 22, on the published artifact, because this unwinds
shipped and validated work.** `@layer` appears **zero times anywhere in
`@angular/material@22.1.1`** -- all Sass partials, all eight prebuilt theme CSS
files, and every `fesm2022/*.mjs` bundle with its inlined component CSS
(`rg -l '@layer'` exit 1, 0 files; CDK positive control finds 3). It also appears
zero times in `v22.0.4:src/material/**`. And the CDK comment at
`v22.0.4:src/cdk/overlay/overlay-structure.scss:3-4` records that `@layer` "seems
to break some targets", so Material treats it as carrying compatibility risk.

Angular Material v22 therefore delivers a fully re-themeable component library,
to the same "Baseline widely available" policy this repo's `.browserslistrc`
targets, with no layer anywhere. Once defaults live in the `var()` fallback
position there is
nothing left for a layer to protect -- custom property resolution is by
inheritance and already beats any specificity at any source order, with no
`!important` and no escape clause about the consumer's own layer names. Keeping
`@layer nfs-defaults` alongside token indirection would be redundant, and it
retains a real failure mode the README already has to warn about
(`README.md:119`).

### Reject: treating the Option-1 precompiled `dist/.../css/nfs-button.css` as Material's prebuilt-theme analogue

They are different artefacts (Q3 table). Material's prebuilt theme is the
*values* half and is trivially re-themeable because it only sets variables; this
repo's precompiled CSS is a *whole stylesheet* of rules. Under the recommendation
above, the `styleUrl`-delivered CSS already carries working defaults for every
consumer with zero configuration, which is the entire job Option 1 existed to
do -- so `compile-default-css` becomes dead weight (this is the map's first "Not
yet specified" item; this research resolves it in favour of deletion). If a
Material-shaped prebuilt-theme equivalent is ever wanted, it is a tiny
variables-only stylesheet (like `azure-blue.css`, 167 lines of custom
properties), not a rules stylesheet.

### Also worth copying: the separate accessibility stylesheet

`button.ts:35` lists **two** stylesheets: `['button.css', 'button-high-contrast.css']`.
The second is 13 lines and does one thing --
`v22.0.4:src/material/button/button-high-contrast.scss`:

```scss
@use '@angular/cdk';

.mat-mdc-button:not(.mdc-button--outlined), ... {
  @include cdk.high-contrast {
    outline: solid 1px;
  }
}
```

This is a first-party precedent for R026's accessibility-only CSS exception being
delivered as its own `styleUrls` entry rather than mixed into the themeable
sheet. It bears directly on the map's second "Not yet specified" item
(Foundation's `disable-mouse-outline` suppressing focus visibility): the fix
belongs in a sibling `nfs-button-a11y.scss`, kept out of the token surface so a
consumer's theme cannot accidentally remove it.

---

## CLOSED since the first pass

1. **~~`@use ... with` failure against a real installed `@angular/material`.~~**
   CLOSED. Reproduced verbatim against published `@angular/material@22.1.1`,
   pointing at `node_modules/@angular/material/_index.scss:15`. Not a load-path
   artifact.
2. **~~Whether Material's `sass_binary` output is post-processed before publish.~~**
   CLOSED, and the answer is *no*. `diff --strip-trailing-cr` between my plain-`sass`
   compile of `v22.0.4:src/material/button/button.scss` and the CSS extracted from
   published `@angular/material@22.0.4`'s `fesm2022/button.mjs` returns **exit 0,
   zero differences**. Published 22.0.4 and 22.1.1 are byte-identical to each other
   (25170 bytes). All Q1.3 measurements re-verified on the published artifact. One
   correction surfaced: `!important` count is 2, not 0 (animation-noop only) --
   corrected in place above.
3. **~~Browser-support floor for `hsl(from ...)` relative colour syntax.~~**
   CLOSED, and it **fails**: 6 of 125 browserslist targets (Firefox 122-127) lack
   `css-relative-colors`. Recommendation item 6 reversed accordingly -- hover
   derivation is baked at library-Sass time.

## Still UNRESOLVED

1. **Which `--nfs-*` tokens NfsButton should expose.** Deliberately left open --
   the implementation ticket's job, per the coordinator. Material's answer for its
   own button is 108 tokens (enumerated by the validation error in Q2.2b); the
   right set here is driven by Foundation's `$button-*` settings surface. Not a
   gap in this research.
2. **`color-mix()` support not mechanically verified against browserslist.** This
   repo's `caniuse-lite@1.0.30001806` has no `css-color-mix` feature entry, so the
   scripted check that settled relative colour syntax could not be run for
   `color-mix`. Evidence it clears the floor is first-party but indirect: Angular
   Material v22 emits `color-mix(in srgb, ...)` 14 times in its published button
   CSS under the same "Baseline widely available" policy this repo targets.
   **Immaterial to the recommendation**, which does not use `color-mix` anywhere
   (it is numerically wrong for the lightness derivation regardless). Settled by a
   Baseline/MDN lookup for `color-mix()` against Chrome 121 / Firefox 122 /
   Safari 17.2, or a newer `caniuse-lite`.
3. **Whether removing `@layer nfs-defaults` reintroduces the original R008 bug.**
   I established that Material achieves consumer-override precedence with no layer
   at all, and why custom-property inheritance makes the layer redundant *once
   defaults live in the `var()` fallback position*. I did **not** reproduce the
   specific consumer-app cascade bug R008 was added to fix, so I cannot certify
   that that exact scenario is covered by the token mechanism -- only that the
   general mechanism is strictly stronger than a layer for specificity and
   source-order contests. Settled by replaying the original R008 reproduction
   against a token-based build before deleting the layer. **Recommend treating
   this as the gate on the R008 change** rather than accepting the argument on
   theory alone.
