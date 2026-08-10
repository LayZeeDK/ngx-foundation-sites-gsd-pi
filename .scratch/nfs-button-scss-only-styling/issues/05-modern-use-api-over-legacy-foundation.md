# Can a `@use`-only public Sass API sit on top of Foundation's legacy `@import` Sass, with no global variables?

Type: research
Status: resolved
Blocked by: —

## Question

The user's constraint: consumers must theme with modern Sass module syntax
(`@use`, never `@import`), and ideally without touching global SCSS variables at
all. Foundation 6.9.0 makes that hard -- verified: it contains zero `@use`
statements, is pure legacy `@import` with every setting a global `!default`, and
computes `$global-left` / `$global-right` at import time
(`scss/_global.scss:127-128`). Today `_foundation-button.scss` quarantines that
by `@import`ing Foundation and being consumed through a non-transitive
`@use ... as *`, and `_settings.scss` exposes ~25 global `!default` variables.

Establish, against the local `foundation/foundation-sites` clone and Dart Sass's
own documentation and source:

1. **Mixing `@import` and `@use` in one compilation.** State the rules
   precisely, in both directions: a file that `@use`s a module which internally
   `@import`s legacy Sass, and legacy Sass `@import`ing a file that `@use`s
   modules. What leaks across each boundary (globals, functions, mixins), and is
   the current `@use './foundation-button' as *` quarantine actually
   non-transitive as D018 claims? Verify with a throwaway compile.
2. **A config surface without globals.** Does `@forward ... with (...)` plus
   `@use ... with (...)` let a consumer configure the library without ever
   naming a bare global variable -- and what is the resulting consumer-facing
   syntax? Contrast with a *mixin-argument* API
   (`@include nfs.button-theme($background: ...)`), which needs no module
   configuration at all and is closer to Material's shape. Which better matches
   "no global SCSS variables"?
3. **`@use ... with (...)` is once-only.** Confirm the constraint that a
   configured module can only be configured at first load, and what happens when
   two consumer files both try. This bears directly on whether module config or
   a theme mixin is the safer public API.
4. **`@import` deprecation.** Status in `sass` 1.102, the removal timeline, and
   what happens to this library when Dart Sass drops `@import` while
   Foundation 6.9.0 still requires it. Is there any upstream Foundation branch or
   successor with module support (check the clone's remote branches), and does
   any maintained fork exist? This is a survival question for the whole
   reuse-Foundation strategy, not a detail.
5. **Duplication.** When Foundation's `util/util` and `global` are `@import`ed
   purely to make the button mixins resolve, what CSS -- if any -- do they emit
   into the compiled output? "Don't duplicate Foundation global or component
   styles" is a hard constraint, so quantify the leakage.

Deliverable: the concrete public Sass API shape for `ngx-foundation-sites` that
is `@use`-only and global-free for consumers, plus what it costs internally.

## Answer

Full findings, with probe sources and observed output:
[research/05-modern-use-api-over-legacy-foundation.md](../research/05-modern-use-api-over-legacy-foundation.md)

**Recommendation: a theme *mixin* API, not `@use ... with (...)` module
configuration.** Module config fails the "no globals" constraint twice over; the
mixin API satisfies it completely and costs nothing.

```scss
// Zero-config default theme
@use 'ngx-foundation-sites/scss/button' as nfs-button;
@include nfs-button.theme;
```

```scss
// Themed -- no global variable named anywhere
@use 'ngx-foundation-sites/scss/button' as nfs-button;
@include nfs-button.theme(
  $background: #2a5db0,
  $palette: (secondary: #767676, success: #3adb76, warning: #ffae00, alert: #cc4b37),
  $radius: 6px
);

// Two themes in one compilation, plus consumer-chosen cascade position --
// both impossible with `@use ... with (...)`
@include nfs-button.theme($selector: '.button--brand', $background: #2a5db0);
@layer nfs-defaults { @include nfs-button.theme; }
```

Per sub-question:

1. **Non-transitivity proven -- and the quarantine is not actually enforced.**
   Positive control resolves `fb.rem-calc(16)`, `fb.$global-left`,
   `fb.$foundation-palette`, `fb.button-base`; one hop further through
   `nfs-button.scss` all four fail with `Undefined mixin/variable/function`
   (exit 65). Only the `@forward`ed `_settings.scss` leaks. Reverse direction: a
   legacy `@import` of a modern file does get that file's own members but not its
   namespaces. **Two defects in shipped code:**
   - `@use ... as *` **silently false-passes** -- `rem-calc(16)` compiles and ships
     verbatim as an unresolved plain-CSS function rather than erroring. The current
     `nfs-button.scss` uses exactly this form.
   - `ng-package.json`'s `"glob": "**/*"` publishes `_foundation-button.scss` (and
     `verify-parity.mjs`), so any consumer can `@use
     'ngx-foundation-sites/scss/foundation-button'` and obtain Foundation's entire
     global namespace. **D018's isolation is advisory, not enforced.**
2. **`@forward ... with (... !default)` works, but module config is the wrong
   API.** It fails "no globals" twice: the consumer must type bare
   `$primary-color`, and configuration is inseparable from emission -- reading a
   single token emitted **5490 bytes / 34 unwanted `.button` rules**. The mixin API
   costs **0 bytes** and reaches even `button-base` (zero-arg, globals-only) via a
   `!global` rebind inside the `@import` island: `.button` got `radius 0 / padding
   0.85em 1em` while `.brand-button` got `6px / 1.2em 2em` in the same compile,
   with restore proven by reversing the order.
3. **`@use ... with` once-only is stricter than documented intuition.** Two files
   configuring with **byte-identical** values still hard-error. Unconfigured-first
   also errors; configured-first works. So it is order-dependent and
   uncontrollable by the library. The mixin equivalent (two files, two themes) is
   exit 0. Decisive.
4. **`@import` deprecated in Dart Sass 1.80.0 (2024-10-17); removal in 3.0.0, no
   sooner than two years later -- earliest 2026-10-17.** 2.0.0 is unreleased and
   no 3.0.0 milestone exists, so the real date is later, but the floor is close.
   Foundation is **dead upstream**: `origin/develop` HEAD *is* the v6.9.0 merge
   (2024-09-27), no v7/next/module branch, newest tag v6.9.0, no maintained fork
   on npm. And **`sass-migrator module --migrate-deps` exits 0 but produces a tree
   that does not compile** -- `Module loop`, root-caused to `util/_math.scss:86`
   calling `strip-unit()` while `util/_unit.scss:21,42,95` call `divide()`.
   Mitigating: `@angular/build` hard-codes `quietDeps: true`
   (`sass-language.js:125`), so Angular consumers never see the deprecation
   warnings; a raw `sass` CLI consumer sees 15, all silenced by `--quiet-deps`.
5. **Leakage is 49 bytes, 0.88% -- constraint satisfied, no action needed.**
   `util/util`, `global` and `components/button` each emit **0 bytes** standalone
   (`_global.scss` has one mixin and zero top-level rules). Shipped
   `nfs-button.css` is 5567 bytes / 34 rules, every one `.button`-scoped. The only
   global-layer artefact is `[data-whatinput=mouse] .button { outline: 0; }` from
   `disable-mouse-outline` via `button-base`. Two `@import` islands stay
   independent at zero measurable cost (7.298s vs 7.297s over 5 runs), so the
   per-component pattern generalises.

Correction to this ticket's premise: Foundation 6.9.0 has **five** `@use "sass:*"`
built-in loads, not zero -- no first-party `@use`, but this incidentally proves
`@use` of built-ins inside an `@import`ed file is legal.

Carried forward:

- No dated plan for Dart Sass 3.0.0. Now a named risk in ticket 06 and in the
  map's fog.
- Whether the `math` <-> `unit` cycle is the *only* migration blocker -- the
  compile aborted at the first. A ~30-minute spike would settle it.
- Island scaling beyond N=2 (flat at N=2, unmeasured at N=18).
- The two shipped defects in sub-question 1 -- handed to ticket 08.
