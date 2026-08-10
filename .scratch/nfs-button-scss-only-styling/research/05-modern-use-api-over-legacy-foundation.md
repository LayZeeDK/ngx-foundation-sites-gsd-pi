# Can a `@use`-only public Sass API sit on top of Foundation's legacy `@import` Sass, with no global variables?

Ticket: `issues/05-modern-use-api-over-legacy-foundation.md`
Date: 2026-08-09

## Environment actually used

```
$ npx sass --version
1.102.0 compiled with dart2js 3.12.2

node_modules/foundation-sites -> 6.9.0
```

All probes were written into the session scratchpad, never into the repo. Two
scratchpad load-path roots were used so probe source is byte-identical to what a
real consumer writes:

* `<scratch>/nm/ngx-foundation-sites` -- NTFS junction to
  `packages/ngx-foundation-sites/src`, so `@use 'ngx-foundation-sites/scss/nfs-button'`
  resolves to the live repo source.
* `<scratch>/nm2/nfs-proto` -- a throwaway PROTOTYPE of the proposed API
  (sub-question 2), copying the repo's real `_settings.scss` unmodified.

Standard invocation:

```
npx sass --no-source-map \
  --silence-deprecation=import --silence-deprecation=if-function \
  --silence-deprecation=global-builtin --silence-deprecation=color-functions \
  --load-path=<repo>/node_modules --load-path=<scratch>/nm  <probe>.scss
```

Deprecations were silenced only so the real `Error:` lines were readable; the
un-silenced counts are themselves a finding (see sub-question 4).

**One correction to the ticket's premise up front.** The ticket says Foundation
6.9.0 "contains zero `@use` statements". It contains exactly five, all loads of
BUILT-IN modules -- confirmed identical in the local clone's `origin/develop` and
in the installed tarball:

```
$ git grep -n "@use" origin/develop -- "scss/*.scss"
origin/develop:scss/components/_table.scss:11:@use "sass:color";
origin/develop:scss/settings/_settings.scss:63:@use "sass:color";
origin/develop:scss/util/_color.scss:5:@use "sass:color";
origin/develop:scss/util/_math.scss:5:@use "sass:math";
origin/develop:scss/util/_mixins.scss:9:@use "sass:color";
```

Zero first-party `@use`, which is what the argument actually rests on. But it
does prove `@use 'sass:*'` inside an `@import`-ed legacy file is legal and works
-- relevant to sub-question 1's rules.

---

## 1. Mixing `@import` and `@use` in one compilation

### The rules, from Dart Sass's own documentation

Both directions are documented on
<https://sass-lang.com/documentation/at-rules/import/>.

**Direction A -- `@use` a module that internally `@import`s legacy Sass**
(section "Loading a Module That Contains Imports"), verbatim:

> When you use `@use` (or `@forward`) load a module that uses `@import`, that
> module will contain all the public members defined by the stylesheet you load
> _and_ everything that stylesheet transitively imports. In other words,
> everything that's imported is treated as though it were written in one big
> stylesheet.

So the `@import` island collapses into ONE module. Foundation's globals become
ordinary members of `_foundation-button.scss`. Then the non-transitivity rule
from the same page's "Differences From `@use`" section applies:

> `@use` only makes variables, functions, and mixins available within the scope
> of the current file. It never adds them to the global scope.
> `@use` only ever loads each file once.

**Direction B -- legacy Sass `@import`s a file that `@use`s modules** (section
"Importing a Module-System File"), verbatim:

> When you import a file that contains `@use` rules, the importing file has
> access to all members (even private members) defined directly in that file,
> but _not_ any members from modules that file has loaded. However, if that file
> contains `@forward` rules, the importing file will have access to forwarded
> members.
>
> [Heads up] When a file with `@use` rules is imported, all the CSS transitively
> loaded by those is included in the resulting stylesheet, even if it's already
> been included by another import. If you're not careful, this can result in
> bloated CSS output!

### EMPIRICAL PROOF: the `@use './foundation-button' as *` quarantine IS non-transitive

D018's claim holds. Six probes, one of them a positive control.

Positive control first -- `<scratch>/probes/p1f-control-direct-foundation-button.scss`:

```scss
@use 'ngx-foundation-sites/scss/foundation-button' as fb;

.probe {
  width: fb.rem-calc(16);
  float: fb.$global-left;
  content: inspect(fb.$foundation-palette);
  @include fb.button-base;
}
```

Observed -- `EXIT=0`, and the emitted CSS proves every Foundation member IS a
real module member of the isolation partial:

```css
.probe {
  width: 1rem;
  float: left;
  content: ("primary": #1779ba, "secondary": #767676, "success": #3adb76, "warning": #ffae00, "alert": #cc4b37);
  display: inline-block;
  vertical-align: middle;
  margin: 0 0 1rem 0;
  ...
  padding: 0.85em 1em;
}
[data-whatinput=mouse] .probe {
  outline: 0;
}
```

Now the same four members reached one hop further out, THROUGH `nfs-button.scss`:

| Probe | Source line | Observed |
|---|---|---|
| `p1a` | `@include nfs.button-base;` | `Error: Undefined mixin.` (exit 65) |
| `p1b` | `content: inspect(nfs.$foundation-palette);` | `Error: Undefined variable.` (exit 65) |
| `p1c` | `width: nfs.rem-calc(16);` | `Error: Undefined function.` (exit 65) |
| `p1e` | `float: nfs.$global-left;` | `Error: Undefined variable.` (exit 65) |

Full text of `p1c` (`<scratch>/probes/p1c-transitive-fn.scss`):

```scss
@use 'ngx-foundation-sites/scss/nfs-button' as nfs;

.probe {
  width: nfs.rem-calc(16);
}
```

```
Error: Undefined function.
  |
6 |   width: nfs.rem-calc(16);
  |          ^^^^^^^^^^^^^^^^
  |
  ...\probes\p1c-transitive-fn.scss 6:10  root stylesheet
```

The control succeeding while all four one-hop-further probes fail is the proof
that this is non-transitivity, not "the member does not exist". **What leaks
downstream from `nfs-button.scss` is exactly what it `@forward`s -- `_settings.scss`
-- and nothing else.** Foundation's globals, its unnamespaced functions
(`rem-calc`, `color-pick-contrast`, `get-side`, `scale-color`), its mixins
(`button-base`, `breakpoint`, `disable-mouse-outline`) and `$global-left` /
`$global-right` all stop at the isolation partial.

### [WARN] The `as *` form silently FALSE-PASSES

`<scratch>/probes/p1d-transitive-star.scss`:

```scss
@use 'ngx-foundation-sites/scss/nfs-button' as *;

.probe {
  color: $primary-color;
  width: rem-calc(16);
}
```

`EXIT=0`. But the emitted CSS is:

```css
.probe {
  color: #1779ba;
  width: rem-calc(16);
}
```

`rem-calc(16)` was NOT resolved -- Sass passed an unknown function through as a
plain CSS function call and shipped garbage to the browser. So a consumer using
`as *` gets no compile error for a Foundation function they wrongly believed was
in scope. Only the namespaced form (`nfs.rem-calc`) errors. This is a real trap
for anyone testing the quarantine by hand; test it namespaced.

### [WARN] The quarantine is defeated by the published package layout

`p1f` above is not hypothetical for consumers. `ng-package.json` ships:

```json
"assets": [{ "glob": "**/*", "input": "src/scss", "output": "scss" }]
```

and `dist/packages/ngx-foundation-sites/scss/` therefore contains:

```
_foundation-button.scss   2466
_settings.scss            2121
nfs-button.scss           3819
verify-parity.mjs         5391
```

Sass partials load by name without the leading underscore, so **any consumer can
write `@use 'ngx-foundation-sites/scss/foundation-button'` and obtain Foundation's
entire global namespace** -- exactly what D018 set out to prevent. (`verify-parity.mjs`,
a build-time script, is also being published.) The `**/*` glob needs narrowing.

### EMPIRICAL PROOF: direction B (legacy imports modern)

`<scratch>/probes/p2-legacy-imports-modern/_modern.scss`:

```scss
@use 'sass:math';

$modern-var: 42px;

@mixin modern-mixin { padding: math.div($modern-var, 2); }

@function modern-fn($n) { @return $n * 2; }
```

`p2-entry.scss`:

```scss
@import 'modern';

.probe-legacy-sees-modern-members {
  width: $modern-var;
  height: modern-fn(3px);
  @include modern-mixin;
}
```

Observed (`EXIT=0`):

```css
.probe-legacy-sees-modern-members {
  width: 42px;
  height: 6px;
  padding: 21px;
}
```

The modern file's OWN members leak into the legacy importer's global scope.
The NAMESPACE it established does not -- `p2b-entry-namespace-leak.scss` differs
only in the body:

```scss
@import 'modern';

.probe { width: math.div(10px, 2); }
```

```
Error: There is no module with the namespace "math".
  |
6 |   width: math.div(10px, 2);
  |          ^^^^^^^^^^^^^^^^^
  |
```

Practical consequence for this library: the isolation partial's own `@use 'settings'`
namespace is invisible to Foundation's `@import`-ed files, which is why
`_foundation-button.scss` has to re-assign every Foundation global by hand
(lines 24-44). That hand-copy list is load-bearing and unavoidable in this
direction.

### EMPIRICAL PROOF: two independent `@import` islands coexist

The 18-component scaling question. A second isolation partial
(`<scratch>/nm2/nfs-proto/scss/_foundation-second.scss`) identical to
`_foundation-button.scss` except `$button-radius: 99px;`, then
`<scratch>/probes/p9-two-import-islands.scss`:

```scss
@use 'nfs-proto/scss/foundation-button' as fb1;
@use 'nfs-proto/scss/foundation-second' as fb2;

.island-one { border-radius: fb1.$button-radius; }
.island-two { border-radius: fb2.$button-radius; }
```

Observed (`EXIT=0`):

```css
.island-one { border-radius: 0; }
.island-two { border-radius: 99px; }
```

Each island holds a fully private copy of Foundation's globals. And it is
free: 5 sequential compiles of the 1-island probe took `real 7.298s`, the
2-island probe `real 7.297s` (Dart Sass caches the parsed stylesheets). Since
those imports emit zero CSS (sub-question 5), N islands also cost zero
duplicated CSS. **The one-island-per-component pattern generalises.**

---

## 2. A config surface without globals

### `@forward ... with (...)` works, in both directions

`<scratch>/probes/p6b-forward-with/_intermediate.scss`:

```scss
@forward 'ngx-foundation-sites/scss/settings' with (
  $primary-color: #ff00ff !default
);
```

| Probe | Body | Observed |
|---|---|---|
| `p6b-uses-default` | `@use 'intermediate' as t;` | `.probe { color: #ff00ff; }` |
| `p6b-overrides` | `@use 'intermediate' as t with ($primary-color: #010203);` | `.probe { color: #010203; }` |

So an intermediate can re-default a forwarded variable and still leave it
consumer-configurable. And derived defaults re-derive correctly through the
chain -- `p3c` (below) configures only `$primary-color: #aa0000` and the emitted
`.button` background becomes `#aa0000`, i.e. `$button-background: $primary-color !default`
in `_settings.scss` fired after the consumer's value landed. An explicit
override still wins over the derivation (`p6c-derived-not-reconfigurable.scss`,
configuring both):

```css
.probe { --primary: #111111; --bg: #999999; }
```

### But `@use ... with (...)` fails the "no global SCSS variables" bar on two counts

**(a) The consumer must name a bare, Foundation-shaped global variable.** The
current public API is `apps/nfs-demo/src/styles.scss`:

```scss
@use 'ngx-foundation-sites/scss/nfs-button' with (
  $primary-color: #2a5db0
);
```

`$primary-color` is a module variable, but the consumer types the same bare
Foundation global name. `nfs-button.scss`'s `@forward 'settings';` makes all ~25
of `_settings.scss`'s `!default` variables permanent public API. That is the
opposite of "ideally must not touch global SCSS variables at all".

**(b) Configuration is inseparable from CSS emission.**
`<scratch>/probes/p6a-config-forces-emission.scss`:

```scss
@use 'ngx-foundation-sites/scss/nfs-button' as nfs with (
  $primary-color: #123456
);

.my-thing {
  color: nfs.$primary-color;
}
```

`EXIT=0`, output is **5490 bytes / 34 rules**, of which 33 are `.button*` rules
nobody asked for:

```css
.button {
  display: inline-block;
  vertical-align: middle;
...
.my-thing {
  color: #123456;
}
```

A consumer who only wants to read one token cannot avoid the whole default
`.button` sheet, and cannot choose where it lands in the cascade.

### The mixin-argument API avoids BOTH, and the module-config constraints entirely

PROVEN with a working prototype, not reasoned. The prototype's public file
(`<scratch>/nm2/nfs-proto/scss/_button.scss`) declares one mixin, `@forward`s
nothing, and emits nothing on load. The load-bearing question was whether a
mixin argument can steer Foundation's `button-base`, which takes NO arguments and
reads only globals (`node_modules/foundation-sites/scss/components/_button.scss:97-124`).
It can, via a `!global` rebind INSIDE the `@import` island -- those globals are
members of that module, so the module may rebind them:

```scss
// <scratch>/nm2/nfs-proto/scss/_foundation-button.scss (tail)
@mixin scoped-base-settings($padding: null, $margin: null, $radius: null,
                            $font-family: null, $sizes: null) {
  $orig-padding: $button-padding;
  $orig-radius: $button-radius;
  ...
  @if $padding != null { $button-padding: $padding !global; }
  @if $radius  != null { $button-radius:  $radius  !global; }
  ...
  @content;

  $button-padding: $orig-padding !global;
  $button-radius:  $orig-radius  !global;
  ...
}
```

`<scratch>/probes/p4a-mixin-api-consumer.scss` -- the proposed consumer syntax,
with no global named anywhere and TWO differently-themed instances in one
compilation:

```scss
@use 'nfs-proto/scss/button' as nfs;

@include nfs.button-theme;

@include nfs.button-theme(
  $selector: '.brand-button',
  $background: #2a5db0,
  $radius: 6px,
  $padding: 1.2em 2em
);
```

Observed `EXIT=0`, and the two instances genuinely differ:

```css
.button {                                   .brand-button {
  ...                                         ...
  border-radius: 0;                           border-radius: 6px;
  ...                                         ...
  padding: 0.85em 1em;                        padding: 1.2em 2em;
}                                           }
```

Restore is proven too, not merely unexercised -- `p4c-restore-order.scss` puts
the THEMED include first:

```scss
@include nfs.button-theme($selector: '.first', $radius: 6px, $padding: 3em);
@include nfs.button-theme($selector: '.second');
```

```
.first  -> border-radius: 6px;  padding: 3em;
.second -> border-radius: 0;    padding: 0.85em 1em;
```

No state leaks between includes.

### Verdict on sub-question 2

**The mixin-argument API matches "no global SCSS variables" and `@use ... with (...)`
does not.** Scored against the user's constraint:

| | `@use ... with (...)` | `@include nfs.button-theme(...)` |
|---|---|---|
| Consumer writes `@use`, never `@import` | yes | yes |
| Consumer names a bare global-shaped variable | **yes, required** | no |
| Public API surface | ~25 `!default` globals, permanent | 1 mixin, named arguments |
| Themes per compilation | **exactly 1** (sub-question 3) | unlimited |
| CSS emitted just to read a token | **5490 bytes** | 0 bytes |
| Consumer controls where the CSS lands | no | yes (`@include` site, nestable) |
| Reaches `button-base`'s globals-only knobs | yes (import-time) | yes (`!global` rebind, proven) |

### What the mixin API still cannot reach

* **Disabled opacity.** Foundation's `button-disabled($opacity)` declares the
  parameter but its body reads the global
  (`scss/components/_button.scss:283-288` -- `opacity: $button-opacity-disabled;`).
  Confirmed upstream bug, `<scratch>/probes/p4d-button-disabled-arg.scss`:
  `@include fb.button-disabled(0.9);` emits `opacity: 0.25;`. Route it through
  the `!global` rebind, or write the two declarations by hand.
* **`$global-left` / `$global-right`.** Computed at import time
  (`scss/_global.scss:127-128` in 6.9.0), so still not per-include steerable.
  D018's rtlcss dual-file mechanism is still the right answer for RTL.
* `if()` is deprecated in 1.102 (`if-function`). The prototype uses it for
  null-coalescing; production code should use `@if` blocks.

---

## 3. `@use ... with (...)` is once-only

Confirmed, and it is stricter than "conflicting values".

Two consumer files, `_a.scss` and `_b.scss`, differing only in the value:

```scss
// _a.scss
@use 'ngx-foundation-sites/scss/nfs-button' as nfs with ($primary-color: #aa0000);
.from-a { color: nfs.$primary-color; }
```

| Probe | Entry point | Observed |
|---|---|---|
| `p3a` | `@use 'a'; @use 'b';` (different values) | `EXIT=65`, `Error: This module was already loaded, so it can't be configured using "with".` |
| `p3b` | `@use 'plain'; @use 'a';` (unconfigured load first) | `EXIT=65`, same error |
| `p3c` | `@use 'a'; @use 'plain';` (configured load first) | `EXIT=0` |
| `p3d` | `@use 'a'; @use 'a2';` (**identical** values) | `EXIT=65`, same error |

Full `p3a` diagnostic:

```
Error: This module was already loaded, so it can't be configured using "with".
  +--> ...\_b.scss
2 | + @use 'ngx-foundation-sites/scss/nfs-button' as nfs with (
3 | |   $primary-color: #00aa00
4 | | );
  | '-^ new load
  |
  +--> ...\_a.scss
2 | + @use 'ngx-foundation-sites/scss/nfs-button' as nfs with (
3 | |   $primary-color: #aa0000
4 | | );
  | '-^ original load
  |
```

Three consequences, all load-bearing for the public API choice:

1. **`p3d` is the decisive one.** Two files configuring with byte-identical
   values still hard-error. The rule is about the ACT of configuring a
   second time, not about conflicting values. So there is no "just keep the
   config consistent" workaround for a multi-file consumer.
2. **`p3b` vs `p3c` makes the API order-dependent.** Whoever loads
   `nfs-button` first wins, and if that first load is unconfigured -- e.g. some
   unrelated partial doing `@use 'nfs-button'` to read a token -- every later
   `with (...)` in the app becomes a compile error. The library cannot control
   which of a consumer's files loads first. Confirmed by the docs
   (<https://sass-lang.com/documentation/breaking-changes/import/>):

   > Because `@use`-ing the same module multiple times always uses the same
   > configuration, if you configure it once in the entrypoint and all other
   > uses will see that configuration

   which is fine as advice and brittle as a contract.
3. Sass DOES dedupe the module's CSS -- `p3c` emits `.button {` exactly once
   (`rg -c '^\.button \{' -> 1`) and `.from-plain` correctly reads the
   configured `#aa0000`.

**A theme mixin is the safer public API.** A mixin has no once-only rule
(`p4a`, `p4b`), no load-order sensitivity, and no cross-file coupling --
`p4b-entry.scss` (`@use 'x'; @use 'y';`, two separate files each calling
`button-theme` with different backgrounds) is `EXIT=0`, the exact scenario that
hard-fails at `p3a`.

---

## 4. `@import` deprecation

### The timeline, with actual versions and dates

From <https://sass-lang.com/documentation/breaking-changes/import/>, verbatim:

> `@import` is now deprecated as of Dart Sass 1.80.0.
>
> Sass `@import` rules and global built-in function calls now emit deprecation
> warnings. While Dart Sass 2.0.0 will be released soon with various smaller
> breaking changes, we don't expect to remove Sass `@import` rules or global
> built-in functions until Dart Sass 3.0.0, which will be released no sooner
> than two years after Dart Sass 1.80.0.
>
> Eventually, all `@import` rules will be treated as plain CSS @imports, likely
> after an intermediate period where anything that used to be a Sass `@import`
> throws an error.

Dates pinned against the GitHub releases API and the npm registry:

| Fact | Value | Source |
|---|---|---|
| `@import` deprecated in | Dart Sass **1.80.0** | breaking-changes page |
| 1.80.0 released | **2024-10-17** | `api.github.com/repos/sass/dart-sass/releases/tags/1.80.0` -> `published_at: 2024-10-17T00:25:27Z`; npm `time["1.80.0"] = 2024-10-17T00:18:43.656Z` |
| `@import` removed in | Dart Sass **3.0.0**, "no sooner than two years after 1.80.0" | breaking-changes page |
| => earliest possible removal | **2026-10-17** | 1.80.0 + 2y |
| Dart Sass 2.0.0 | **not released.** No `2.x` tag exists; milestone "2.0.0" is open, 12 open / 12 closed | `/tags?per_page=100` -> no `^2\.`; `/milestones?state=all` |
| Dart Sass 3.0.0 | **no milestone exists yet** | same |
| Latest release | **1.102.0**, 2026-07-25 | `/releases`; npm `dist-tags.latest = 1.102.0` |
| Installed here | 1.102.0 | `npx sass --version` |
| Status in 1.102 | deprecated, warns, still fully functional | probes below |

**The two-year floor lapses in roughly two months** (today 2026-08-09; earliest
3.0.0 is 2026-10-17). No 3.0.0 milestone exists, so removal is unlikely to be
imminent -- but the contractual protection expires now, not later.

Note the separate deprecation IDs, from the same page:

> While the deprecations for `@import` and global built-ins are being released
> together and we expect both features to be removed simultaneously as well (in
> Dart Sass 3.0.0), they are considered separate deprecations for the purpose of
> the API.

### What consumers see today

Compiling the current library from a consumer, with no flags at all
(`p6a-config-forces-emission.scss`):

```
EXIT=0 warn-lines=15
      5 DEPRECATION WARNING [global-builtin]
      5 DEPRECATION WARNING [if-function]
      5 DEPRECATION WARNING [import]
```

(5 each is Dart Sass's terse-mode cap; `--verbose` on the one-island probe
reports 16 `[import]` warnings.) Adding `--quiet-deps` alone silences all of
them -- stderr becomes 0 bytes -- because the library resolves through a load
path and therefore counts as a dependency.

**Angular consumers see nothing, unconditionally.** `@angular/build` hard-codes
it, `node_modules/@angular/build/src/tools/esbuild/stylesheets/sass-language.js:113-125`:

```js
const { silenceDeprecations, futureDeprecations, fatalDeprecations } = options.sass ?? {};
...
    silenceDeprecations,
    fatalDeprecations,
    futureDeprecations,
    quietDeps: true,
```

`quietDeps: true` is not behind any option. This is why `apps/nfs-demo/project.json`
needs no `stylePreprocessorOptions` and sees a clean build. The library's own
`ng-package.json` separately sets `lib.sass.silenceDeprecations: ["import"]` for
its own compile. So the warning noise is a non-issue for the primary consumer
shape (Angular), and a one-flag issue (`--quiet-deps`) for a raw `sass` CLI
consumer.

### Is there an upstream branch, successor, or maintained fork? No.

Local clone `D:\projects\github\foundation\foundation-sites`:

```
$ git branch -a
* develop
  remotes/origin/HEAD -> origin/develop
  remotes/origin/develop
  remotes/origin/master
  remotes/origin/v5
  remotes/origin/feature/... (25 feature branches, all 6.x-era)
  remotes/origin/dependabot/...
$ git log -1 --format="%h %ad %s" --date=short origin/develop
337be7a8d 2024-09-27 Merge tag 'v6.9.0' into develop
$ git branch -a | rg -i "v7|next|module"   # exit 1, no matches
$ git tag | rg -i "^v7"                    # exit 1, no matches
```

`origin/develop` HEAD IS the v6.9.0 merge -- zero development since. Newest tag
is `v6.9.0`. No `v7`, no `next`, no module-system branch. The five `@use "sass:*"`
lines above are the entire extent of module-system adoption, and they came from
PR #12622 "tech/sass-deprecations", i.e. silencing Sass warnings, not migrating.

npm (`registry.npmjs.org/foundation-sites` and `/-/v1/search?text=foundation-sites`):

```
dist-tags: {"latest":"6.9.0", ...}
last 5 published: 6.7.4 2021-11-02 | 6.7.5 2022-07-12 | 6.8.0 2023-08-18 | 6.8.1 2023-08-18 | 6.9.0 2024-09-27
```

Every fork in the registry is stale and 6.x-legacy: `foundation-sites-5` (2016),
`foundation-sites-custom@6.6.5` (2021), `foundation-sites-scss@6.6.4` (2021),
`@andsafe/foundation-sites@6.7.5-custom` (2023, newest), `tbg-foundation-sites`
(2017). **No maintained fork with module support exists.**

### So what happens to this library, and what is the mitigation?

When Dart Sass 3.0.0 lands, `_foundation-button.scss`'s three `@import` lines
stop being Sass imports and `button-base` et al. become undefined. Upstream will
not fix it. Three mitigations, in order of how well they held up under test:

**(a) Pin `sass` below 3.0.0.** Zero work, works today, buys until whenever the
library's consumers need Sass 3. Not a solution for a PUBLISHED library, because
the compile happens in the CONSUMER's toolchain -- the library cannot pin the
consumer's `sass`. This is the real survival risk: an Angular app on Angular N+k
with Sass 3 could not compile `ngx-foundation-sites` at all.

**(b) Vendor Foundation's button subtree and run `sass-migrator`. TESTED, and it
does NOT work out of the box.** I copied `node_modules/foundation-sites/scss`
into the scratchpad and ran the official migrator against an entrypoint
importing exactly the three files this library needs:

```
// <scratch>/migrator-test/entry.scss  (before)
@import 'scss/util/util';
@import 'scss/global';
@import 'scss/components/button';

$ npx --yes --registry=https://registry.npmjs.org sass-migrator@latest \
    module --migrate-deps entry.scss
EXIT=0        (no output; entry.scss rewritten to three @use lines)
```

The migrator reports success and produces plausible output --
`scss/components/_button.scss` gains `@use "../global"; @use "../util/breakpoint"; ...`,
and `_global.scss` keeps `$global-text-direction: ltr !default;` so it becomes
`@use ... with (...)`-configurable. But the result **does not compile**:

```
$ node <repo>/node_modules/sass/sass.js --load-path=<scratch>/migrator-test \
    <scratch>/migrator-test/verify-migrated.scss
Error: Module loop: this module is already being loaded.
  +--> ...\migrator-test\scss\util\_unit.scss
8 | @use 'math' as math2;
  | ^^^^^^^^^^^^^^^^^^^^ new load
  |
  +--> ...\migrator-test\scss\util\_util.scss
5 | @use 'math';
  | ----------- original load
  |
EXIT=65
```

Root cause, in Foundation 6.9.0 itself: `util/_math.scss:86` calls `strip-unit()`
(defined in `_unit.scss`) and `util/_unit.scss:21,42,95` call `divide()`
(defined in `_math.scss`). A mutual dependency, legal under `@import`'s single
global scope, illegal as a module cycle. The migrator cannot break it. Migration
is viable but needs a hand-authored fix to the `math` <-> `unit` cycle first
(extract the shared primitives into a third file). Note the migrator's exit code
is 0 -- do not trust it as a green light.

**(c) Hand-roll the button CSS and drop Foundation's Sass.** Contradicts D017.
Only as a last resort.

Recommended posture: keep (a) for now, and treat (b) as the pre-costed escape
hatch -- the `math`/`unit` cycle is the ONE known blocker and it is small and
now identified. Also note (b) becomes much cheaper under the mixin-argument API,
because a vendored+migrated `components/button` is consumed through exactly one
file (`_foundation-button.scss`) whose only job is to bridge globals -- and that
bridging is precisely what disappears once the subtree is modular.

---

## 5. Duplication: what CSS do `util/util` and `global` actually emit?

**Zero bytes.** Measured, three ways.

`<scratch>/probes/p5a-util-global-only.scss`:

```scss
@import 'foundation-sites/scss/util/util';
@import 'foundation-sites/scss/global';
```

| Probe | `@import`s | Observed |
|---|---|---|
| `p5b-util-only` | `util/util` | `EXIT=0 BYTES=0` |
| `p5a-util-global-only` | `util/util` + `global` | `EXIT=0 BYTES=0` |
| `p5c-plus-button` | `util/util` + `global` + `components/button` | `EXIT=0 BYTES=0` |

All three emitted a completely empty file. Corroborated structurally:

```
$ rg -n "^[.a-zA-Z\[*#].*\{" node_modules/foundation-sites/scss/_global.scss
(exit 1, no matches)
$ rg -n "^@mixin" node_modules/foundation-sites/scss/_global.scss
140:@mixin foundation-global-styles
```

`_global.scss` contains exactly one mixin and no top-level rules. Everything
that would emit CSS is behind `foundation-global-styles`, which this library
never includes. `util/_util.scss` is nothing but 13 `@import`s of
function/mixin definition files. `components/_button.scss` likewise gates all
output behind `@mixin foundation-button`.

### Leakage in the shipped artefact

`dist/packages/ngx-foundation-sites/css/nfs-button.css`, regenerated via
`npx nx run ngx-foundation-sites:compile-default-css` (byte-identical to what was
already on disk, so no source drift):

* **5567 bytes, 153 lines, 34 rules.**
* Every rule is `.button`-scoped. `rg -n "^\s*[^ {}@/].*\{$" | rg -v "\.button"`
  returns **exit 1, no matches** -- no element selectors, no resets, no
  `html`/`body`, no Foundation global styles, no `.grid-*`, no `.row`.
* Exactly one rule is attributable to Foundation's global layer rather than the
  button component:

  ```css
  [data-whatinput=mouse] .button {
    outline: 0;
  }
  ```

  **49 bytes = 0.88% of 5567.** Source: `disable-mouse-outline`
  (`scss/util/_mixins.scss:206-210`), pulled in by `button-base`
  (`scss/components/_button.scss:123`). It is part of Foundation's own
  definition of a button, not a duplicated global stylesheet.

### Verdict on sub-question 5

**The "don't duplicate Foundation global or component styles" constraint is
satisfied, with no action required.** `map.md`'s open item "How much of
Foundation's `_global.scss` and `util/util` leaks into compiled output as a side
effect of `@import`ing them" resolves to: nothing. Those files are pure
definitions. The only global-layer artefact is one 49-byte rule, and it arrives
through `button-base`, which D017 mandates.

Side note for `map.md`'s second open item (`disable-mouse-outline` vs. a11y):
the rule only applies under `[data-whatinput=mouse]`, an attribute set by
Foundation's `what-input` JS. `ngx-foundation-sites` ships no such JS, so in a
consumer that does not load `what-input` the selector never matches and focus
visibility is untouched. Worth a dedicated check rather than inferring it from
here.

---

## Proposed public Sass API

Mixin-first, `@use`-only, zero globals in the consumer's hands. This is the
prototype at `<scratch>/nm2/nfs-proto/scss/`, proven compiling by probes
`p4a`, `p4b`, `p4c`.

(Naming note: the prototype spells the mixin `button-theme` in a module named
`button`, so the probes read `nfs.button-theme`. The API below drops the
stutter -- member `theme` in a module a consumer namespaces as `nfs-button`,
giving `nfs-button.theme`. Same mixin, same proof; only the identifier differs.)

### What a consumer copies

```scss
// styles.scss -- zero-config default theme
@use 'ngx-foundation-sites/scss/button' as nfs-button;

@include nfs-button.theme;
```

```scss
// styles.scss -- themed. No global variable is named anywhere.
@use 'ngx-foundation-sites/scss/button' as nfs-button;

@include nfs-button.theme(
  $background: #2a5db0,
  $background-hover: auto,          // 'auto' = let Foundation derive it
  $color: auto,                     // 'auto' = contrast-pick against $background
  $palette: (
    secondary: #767676,
    success: #3adb76,
    warning: #ffae00,
    alert: #cc4b37,
  ),
  $radius: 6px,
  $padding: 1em 2em,
  $margin: 0 0 1rem 0,
  $sizes: (tiny: 0.6rem, small: 0.75rem, default: 0.9rem, large: 1.25rem),
  $font-family: inherit
);
```

```scss
// Two themes, one compilation -- impossible with `@use ... with (...)`.
@use 'ngx-foundation-sites/scss/button' as nfs-button;

@include nfs-button.theme;
@include nfs-button.theme($selector: '.button--brand', $background: #2a5db0);
```

```scss
// Scoped: the consumer controls where the CSS lands, including inside a @layer
// or a container scope. `@use ... with (...)` cannot do this.
@use 'ngx-foundation-sites/scss/button' as nfs-button;

@layer nfs-defaults {
  @include nfs-button.theme;
}
```

### What it costs internally

1. **`nfs-button.scss` stops `@forward`ing `settings`.** `_settings.scss` becomes
   a private defaults table read only by the theme mixin. This REMOVES the
   `@use ... with (...)` surface -- a breaking change for
   `apps/nfs-demo/src/styles.scss`, which must be rewritten to the `@include`
   form. Both can coexist during a deprecation window by keeping
   `@forward 'settings';`, at the cost of not meeting the "no globals" goal
   until it is dropped.
2. **The isolation partial gains a `scoped-base-settings` mixin** that rebinds
   Foundation's import-time-only globals with `!global` around a `@content`
   block, and restores them after. Proven to work (`p4a`) and to restore
   (`p4c`). This is the only genuinely new mechanism, roughly 35 lines. It is
   confined to the one file that already owns the legacy boundary; nothing about
   it is visible to consumers. Mark it `ponytail:`-style with its ceiling --
   it is deliberate scoped global mutation, and it is only safe because the
   restore is unconditional and the module is single-purpose.
3. **The theme mixin emits nothing on load.** Fixes the `p6a` problem: `@use`
   alone now costs 0 bytes instead of 5490.
4. **Narrow `ng-package.json`'s `assets` glob.** `**/*` currently publishes
   `_foundation-button.scss` (which `p1f` proves hands a consumer Foundation's
   whole global namespace, defeating D018) and `verify-parity.mjs`. Publish only
   `nfs-button.scss` / the new `_button.scss`, or move private partials to a
   sibling directory that is not copied. Without this, the quarantine is
   advisory.
5. **Two knobs need hand-written CSS instead of Foundation's mixin.** Disabled
   opacity (`button-disabled`'s `$opacity` argument is ignored upstream --
   `p4d`), and anything depending on `$global-left`/`$global-right`, which stay
   import-time. RTL therefore still needs D018's rtlcss dual-file build.
6. **Replace `if()` with `@if`** in the mixin's null-coalescing; `if()` is
   deprecated in 1.102 under the `if-function` ID.
7. **`compile-default-css` becomes a one-line entry** (`@include nfs-button.theme;`)
   instead of compiling `nfs-button.scss` directly, since the source file no
   longer emits on load.
8. **Sass version risk is unchanged** by this API choice. It is orthogonal --
   see sub-question 4 mitigation (b), which the mixin API makes cheaper, not
   harder.

### Where this lands relative to Material

This is Material's shape (a theme mixin taking a config), minus Material's
`define-*-theme()` config-map constructors. Adding those later is additive: a
`nfs-button.define-theme(...)` function returning a map, plus
`theme($config)` accepting it. Not worth building until a second component
needs to share a palette.

---

## UNRESOLVED

* **Whether Dart Sass 3.0.0 has a concrete target date.** Established: the
  contractual floor is 2026-10-17 (1.80.0 + 2y), 2.0.0 is unreleased with an
  open 12/24-issue milestone, and no 3.0.0 milestone exists. Not established:
  any dated plan. Would be settled by the sass/dart-sass 3.0.0 milestone
  appearing, or a sass-lang.com blog post announcing it. Worth re-checking
  before committing to mitigation (a) (version pinning) as anything other than
  a stopgap.
* **Whether the `math` <-> `unit` cycle is the ONLY blocker to a migrated
  Foundation button subtree.** Established: it is the first blocker, with exact
  line numbers. Not established: what fails after it is fixed, since the compile
  aborted at the first cycle. Would be settled by extracting the shared
  primitives into a third file and re-running the compile -- roughly a 30-minute
  spike, and worth doing before treating mitigation (b) as costed.
* **Whether `disable-mouse-outline`'s `[data-whatinput=mouse] .button { outline: 0 }`
  is inert in every consumer.** Established: it needs the `what-input` JS to set
  the attribute, and this library ships no JS. Not established: whether any
  consumer path (a Storybook addon, an app that also installs Foundation's JS)
  sets it. Would be settled by the existing axe gate plus one Playwright
  assertion that `[data-whatinput]` is absent on the demo app's `documentElement`.
  This belongs to `map.md`'s own open item, not to this ticket.
* **Compile-time cost of N `@import` islands beyond N=2.** Measured: N=1 and N=2
  are indistinguishable (7.298s vs 7.297s for 5 runs each), and CSS duplication
  is zero at any N. Not measured: whether that stays flat at N=18. Would be
  settled by generating 18 islands and timing; low risk given the N=2 result and
  Dart Sass's stylesheet caching.
