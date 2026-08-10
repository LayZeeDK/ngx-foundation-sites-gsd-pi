# ngx-foundation-sites

Angular directive components for [Foundation for Sites](https://get.foundation/sites.html), starting with `NfsButton`. Default styles are compiled from Foundation's own Sass mixins and delivered by Angular's `styleUrl` + `ViewEncapsulation.None` pipeline: no global CSS import to remember, no CSS-in-JS, and SSR-safe with no extra setup.

## Installation

```bash
npm install ngx-foundation-sites
```

Peer dependencies (already present in any Angular 22 app):

```json
{
  "@angular/core": "^22.0.0"
}
```

## Usage

`NfsButton` is a directive-style standalone component applied to a native `<button>` or `<a>` element via the `nfsButton` attribute selector, so your markup keeps its native tag semantics.

```typescript
import { Component } from '@angular/core';
import { NfsButton } from 'ngx-foundation-sites';

@Component({
  selector: 'app-root',
  imports: [NfsButton],
  template: `<button nfsButton (click)="onClick()">Click me</button>`,
})
export class AppComponent {
  onClick(): void {
    // ...
  }
}
```

### Inputs

| Input      | Type                                                                  | Default     | Description                                                                 |
| ---------- | ---------------------------------------------------------------------| ----------- | ---------------------------------------------------------------------------- |
| `color`    | `'primary' \| 'secondary' \| 'success' \| 'warning' \| 'alert'`      | `'primary'` | Button color variant, matching Foundation's full `$button-palette`.          |
| `hollow`   | `boolean`                                                             | `false`     | Renders an outlined ("hollow") variant instead of a filled background.       |
| `size`     | `'tiny' \| 'small' \| 'large' \| undefined`                          | `undefined` | Button size. Leave `undefined` for the default size.                        |
| `expanded` | `boolean`                                                             | `false`     | Renders Foundation's expanded (full-width, `display: block`) button style.   |
| `dropdown` | `boolean`                                                             | `false`     | Renders Foundation's dropdown arrow indicator after the button content.      |
| `disabled` | `boolean`                                                             | `false`     | Disables the button. On `<a>` this is a soft-disable (see below).            |

### Button vs. anchor semantics

`NfsButton` detects its host element and applies the correct disabled semantics for each:

- **`<button nfsButton>`** -- `disabled` sets the native `disabled` attribute. The browser prevents clicks and focus automatically.
- **`<a nfsButton>`** -- anchors have no native `disabled` attribute, so `disabled` instead applies `aria-disabled="true"` and a `.disabled` CSS class, and click-driven navigation is prevented in the click handler. The anchor remains focusable, matching Foundation for Sites' documented "soft-disabled" pattern for links.

```html
<a nfsButton href="/checkout" [disabled]="isProcessing()">Checkout</a>
```

### Examples

```html
<button nfsButton color="secondary">Secondary</button>
<button nfsButton color="success">Success</button>
<button nfsButton color="warning">Warning</button>
<button nfsButton color="alert">Alert</button>
<button nfsButton hollow>Hollow</button>
<button nfsButton size="tiny">Tiny</button>
<button nfsButton size="large" disabled>Large, disabled</button>
<button nfsButton expanded>Expanded</button>
<button nfsButton dropdown>Dropdown</button>
```

## Theming

With no configuration you get Foundation for Sites 6.9.0's own default button theme, compiled from Foundation's real button mixins (`button-base`, `button-fill-style`, `button-hollow`, `button-hollow-style`, `button-disabled`, `button-expand`, `button-dropdown`) across the full `$button-palette`. `NfsButton` delivers it automatically through Angular's `styleUrl` pipeline, wrapped in `@layer nfs-defaults`. Angular's `SharedStylesHost` inserts that stylesheet once per app, ref-counted across instances and removed when the last instance is destroyed.

Theming is Sass-only and happens in your own build. There is no CSS custom property API and no runtime override surface.

### The theme mixin

```scss
// your app's global stylesheet, e.g. src/styles.scss
@use 'ngx-foundation-sites/scss/button' as nfs-button;

@include nfs-button.theme(
  $background: #2a5db0,
  $palette: (
    success: #238648,
  ),
  $radius: 6px
);
```

| Argument      | Default                              | Purpose                                                                                                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$selector`   | `'.button'`                          | Selector the rules are emitted under. Use it for a scoped or additional theme.                                                                                                                                                                                                                                                    |
| `$background` | `#1779ba` (Foundation's primary)     | Fill color of the default (primary) button. Its hover is derived by Foundation's own `scale-color`, so it needs no companion argument.                                                                                                                                                                                             |
| `$palette`    | Foundation's `$button-palette`       | Palette override, **merged** over the defaults and keyed the way Foundation's `$button-palette` is (`secondary`, `success`, `warning`, `alert`). Pass only the keys you want to change; the rest keep Foundation's values. A `primary` key is ignored, since `$background` covers it. Each entry's text color is contrast-picked by Foundation's own `color-pick-contrast`. |
| `$radius`     | `0` (Foundation's `$global-radius`)  | Corner radius.                                                                                                                                                                                                                                                                                                                   |

`$palette` **merges** rather than replaces, so overriding one entry keeps the other three at Foundation's values -- the naive expectation would be replacement, and it is worth stating.

`@use`-ing the module emits nothing at all, so it costs 0 bytes until you `@include theme`. You can include it more than once in a single compilation: pass a different `$selector` for a second, scoped theme.

The mixin's output is deliberately **unlayered**, which is how it beats the library's own `@layer nfs-defaults` default regardless of where your stylesheet lands in the DOM (per the CSS cascade an unlayered rule always beats a layered one, unless you wrap your own output in a named `@layer`). The accepted cost is that a themed app ships the ruleset twice: the layered default from the component, plus your unlayered recompile. That is the price of compile-time theming, not a defect.

Compile it with your app's normal Sass build. No extra `--load-path` is needed, and Foundation's legacy `@import`-only globals stay inside the package's internal partial rather than leaking into your stylesheet.

### Precompiled default CSS

The package also ships the default stylesheet precompiled, at `css/nfs-button.css` -- the same source the component delivers, compiled by plain `sass`, `@layer nfs-defaults` included. An app using `NfsButton` does not need it, since the component brings its own styles; it is there for critical-CSS preloading, static analysis, or styling `.button` markup that is not an `NfsButton` instance. It is unthemed, so use the theme mixin above to change colors, radius or spacing.

The `rtlcss`-mirrored `css/nfs-button.rtl.css` twin is no longer published; the single stylesheet mirrors on its own (see [RTL/Bidirectional support](#rtlbidirectional-support)).

Note that the published `exports` map declares only the package root, so a strictly `exports`-compliant resolver rejects `ngx-foundation-sites/css/nfs-button.css` as a bare specifier. Angular's own Sass resolution does reach the `scss/` subpath, which is what the theme mixin above relies on; for the precompiled CSS, reference the file by path if your bundler enforces `exports`.

### Internals

Anything under `ngx-foundation-sites/scss/internal/` is unsupported: treat it as private and expect it to change or move in any release. `internal/foundation-button` and `internal/settings` do still resolve if you import them -- the boundary is a signal, not an enforced wall, because the SCSS source has to stay fetchable and compilable for the planned in-browser runtime-theming addon. Theme through the mixin's named arguments instead; nothing under `internal/` is part of the public API.

### Migrating from the previously published shape

- **The theming entry point moved and its API changed.** `@use 'ngx-foundation-sites/scss/nfs-button' with ($primary-color: ...)` is gone. Use `@use 'ngx-foundation-sites/scss/button' as nfs-button;` plus `@include nfs-button.theme(...)`. This was forced rather than cosmetic: keeping the old filename made the component's own `nfs-button.scss` resolve a bare `@use 'nfs-button'` to itself, a Sass module loop. Module configuration also could not be used twice in one compilation and emitted unwanted rules just to read a token, which is why the API is a mixin.
- **`NfsStyleLoader`, `NfsStyleExtractor` and the `data-nfs-style-id` attribute no longer exist**, and `NfsButton` no longer implements `OnDestroy`. Angular's own `SharedStylesHost` owns the whole stylesheet lifecycle now, including ref-counted removal on last destroy. There is nothing left to inject or provide.
- **`@angular/common` is no longer a peer dependency.** Only the two deleted services imported it.
- **`css/nfs-button.rtl.css` is no longer published**, along with the `rtlcss` dependency that generated it.

### Deviations from stock Foundation

Three, all deliberate, and all pinned by `packages/ngx-foundation-sites/scripts/verify-foundation-parity.mjs`, which compares NfsButton's compiled declarations against stock Foundation's on every lint run:

1. **The default hover is `-20%`, where stock Foundation's zero-config `.button:hover` is `-15%`.** Foundation 6.9.0 contradicts itself here: `components/_button.scss:36` defaults `$button-background-hover` to `scale-color(..., -15%)`, while `:77` sets `$button-background-hover-lightness: -20%`. `NfsButton` follows Foundation's `auto` path, which is the `-20%` one, and that is what lets a consumer-set `$background` derive its own hover with no second argument.
2. **`tiny`/`small`/`large` vary padding as well as font size.** Foundation's own `$button-sizes` map varies only `font-size`. Pre-existing `NfsButton` behavior.
3. **Disabled buttons also set `pointer-events: none`.** Foundation's `button-disabled` sets only `opacity` and `cursor`; the extra declaration is what makes a soft-disabled `<a>` host genuinely unclickable.

## Server-side rendering (SSR)

SSR-safe out of the box, with no library-specific setup and no services to provide. Angular's own server-side style handling inlines the component's stylesheet into the server-rendered `<head>` as `<style ng-app-id="...">`, and on bootstrap the client adopts that exact node by identity instead of re-injecting it -- so there is no duplicated stylesheet and no flash of unstyled content. `nfs-button.ssr.spec.ts` pins `APP_ID` and asserts that adoption.

## RTL/Bidirectional support

`NfsButton` mirrors correctly under `dir="rtl"`, matching Foundation for Sites' `$global-text-direction` behavior:

- Spacing uses CSS logical properties (`margin-block`/`margin-inline`, `padding-block`/`padding-inline`) instead of physical `top`/`right`/`bottom`/`left` values, so directional spacing (e.g. the default bottom margin) automatically flips to the correct physical side under `dir="rtl"`. Border, border-radius, and the hollow variant's border-width remain uniform (symmetric) shorthand -- they apply identically to all sides/corners and have no directional variant to encode, so there's nothing to flip there. `apps/nfs-demo/e2e/nfs-button-rtl.spec.ts` regression-tests this by asserting identical computed styles between an `ltr` and an `rtl`-ancestor instance.
- The `expanded` and `dropdown` variants also use only logical properties at runtime (`margin-inline: 0` for expanded, `margin-inline-start` for the dropdown arrow's spacing) rather than Foundation's own physical `float`/`margin-left`/`margin-right`, so they mirror correctly under `dir="rtl"` too. `nfs-button.scss`'s separate precompiled pipeline instead ships a dedicated `rtlcss`-mirrored dual-file build (see Option 1 below) for the same variants.
- **Caveat:** if you theme via the [theme mixin](#the-theme-mixin) and introduce your own directional (left/right) values, verify mirroring yourself -- `NfsButton`'s own styles have no directional properties to get wrong, but consumer overrides can.

## Accessibility

`NfsButton` meets WCAG 2.1 AA:

- **Contrast.** The default theme's text/background pairs (primary `#fefefe` on `#1779ba`, secondary `#fefefe` on `#767676`, success `#0a0a0a` on `#3adb76`, warning `#0a0a0a` on `#ffae00`, alert `#fefefe` on `#cc4b37`, and their hollow/hover variants) all meet the 4.5:1 minimum contrast ratio for normal text — the text color for each new palette entry is computed by Foundation's own `color-pick-contrast` mixin, matching upstream Foundation's automatic black/white text selection. Disabled buttons are dimmed via `opacity` and are exempt from this requirement per WCAG (disabled controls aren't required to meet contrast). If you override colors via the [theme mixin](#the-theme-mixin), re-check contrast for your chosen palette with a contrast calculator (e.g. [WebAIM's](https://webaim.org/resources/contrastchecker/)) — the `!default` variables let you pick any values, including ones below AA.
- **ARIA semantics.** `<button nfsButton disabled>` uses the native `disabled` attribute; no ARIA is needed. `<a nfsButton disabled>` cannot be natively disabled, so it sets `aria-disabled="true"` and `tabindex="-1"` instead, while keeping its native `link` role (it still navigates via `href` — it isn't re-cast as a `button`).
- **Automated regression coverage.** `apps/nfs-demo/e2e/nfs-button-a11y.spec.ts` runs an axe-core scan (WCAG 2.1 A/AA rules) against every variant — primary/secondary, hollow, all sizes, disabled button, and disabled anchor — and fails the build on any critical or serious violation.

## Browser support

The workspace's [`.browserslistrc`](../../.browserslistrc) targets `baseline widely available on 2026-05-07` -- browserslist's native query for the [web.dev "widely available" Baseline](https://web.dev/baseline) (browsers released less than 30 months ago across Chrome, Edge, Firefox, and Safari, desktop + iOS), as of that date. It resolves to 136 browser versions, with floors of Chrome/Edge/Firefox 119 and Safari/iOS Safari 17.0.

The date is **pinned rather than rolling** because Angular 22's own [browser support](https://angular.dev/reference/versions#browser-support) definition is itself fixed to 2026-05-07. A bare `baseline widely available` query resolves to *today's* Baseline and therefore drifts away from Angular 22 over time -- and drifts looser, since newer floors drop older browsers (measured: 125 targets rolling versus 136 pinned). `node scripts/verify-browserslist.mjs` (wired into `nx run ngx-foundation-sites:lint`) asserts that exact query and a non-empty resolved browser set on every lint run.

## Running unit tests

Run `nx test ngx-foundation-sites` to execute the unit tests.
