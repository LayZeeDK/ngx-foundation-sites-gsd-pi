# ngx-foundation-sites

Angular directive components for [Foundation for Sites](https://get.foundation/sites.html), starting with `NfsButton`. Styles are injected at runtime (no global CSS import required) and are SSR-safe: critical CSS is extracted on the server and hydrated client-side without duplication.

## Installation

```bash
npm install ngx-foundation-sites
```

Peer dependencies (already present in any Angular 22 app):

```json
{
  "@angular/common": "^22.0.0",
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

- **`<button nfsButton>`** — `disabled` sets the native `disabled` attribute. The browser prevents clicks and focus automatically.
- **`<a nfsButton>`** — anchors have no native `disabled` attribute, so `disabled` instead applies `aria-disabled="true"` and a `.disabled` CSS class, and click-driven navigation is prevented in the click handler. The anchor remains focusable, matching Foundation for Sites' documented "soft-disabled" pattern for links.

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

Component styles are hand-matched to Foundation for Sites' default Sass settings (`$primary-color: #1779ba`, `$secondary-color: #767676`, `$success-color: #3adb76`, `$warning-color: #ffae00`, `$alert-color: #cc4b37`, `$global-radius: 0`, `$button-opacity-disabled: 0.25`). `NfsButton` always injects its own default styles at runtime (via `NfsStyleLoader`/`NfsStyleExtractor`) — there is no CSS custom property API for overriding these on the fly. There are two supported ways to theme the button.

### Option 1: Precompiled CSS (zero build step)

The package ships ready-to-use CSS that mirrors the same rules `NfsButton` injects at runtime, useful for critical-CSS preloading, static analysis, or apps that don't run a Sass build:

```ts
// angular.json "styles" array, or any global stylesheet
import 'ngx-foundation-sites/css/nfs-button.css';
```

An RTL variant is also published for right-to-left layouts:

```ts
import 'ngx-foundation-sites/css/nfs-button.rtl.css';
```

These files are unthemed — they reflect Foundation's own default variable values. Use Option 2 to change colors, radius, spacing, etc.

### Option 2: SCSS override (recompile with your own variables)

The package also publishes its Sass source (`scss/nfs-button.scss` and `scss/_settings.scss`), where every themeable variable is declared `!default`. Override them by `@use`-ing the package's SCSS with a `with (...)` configuration in your own stylesheet:

```scss
// your app's global stylesheet, e.g. src/styles.scss
@use 'ngx-foundation-sites/scss/nfs-button' with (
  $primary-color: #2a5db0,
  $secondary-color: #4a4a4a,
  $success-color: #2ecc71,
  $warning-color: #f39c12,
  $alert-color: #e74c3c,
  $global-radius: 4px,
  $button-padding: 1em 1.5em,
  $button-opacity-disabled: 0.4
);
```

`$primary-color`/`$secondary-color`/`$success-color`/`$warning-color`/`$alert-color` cover the full `$button-palette` map, `$global-radius` covers corner radius, and `$button-padding` covers spacing — all declared `!default` in [`scss/_settings.scss`](src/scss/_settings.scss), so setting them via the `with (...)` configuration (Sass's module-scoped equivalent of a consumer settings file) before the module's own defaults are used is enough to theme the component; no component code changes are needed.

Compile this with your app's normal Sass build — no extra `--load-path` is needed, since `nfs-button.scss` only depends on its own bundled `_settings.scss`, not on `foundation-sites` itself — and include the resulting CSS globally. `nfs-button.scss` itself `@include`s Foundation for Sites' own button mixins (`button-base`, `button-fill-style`, `button-hollow-style`, `button-disabled`, `button-expand`, `button-dropdown`) via an internal, non-transitive partial — Foundation's legacy `@import`-only Sass globals never leak into your `@use ... with (...)` call.

Both the runtime-injected default styles and the precompiled CSS are wrapped in `@layer nfs-defaults` (Baseline widely available since March 2022). Per the CSS cascade spec, any unlayered rule always beats a layered rule regardless of specificity or load order, so your themed stylesheet wins automatically as long as it isn't itself wrapped in a named `@layer` that sorts before `nfs-defaults`.

Each component's CSS is injected once per app as a single `<style data-nfs-style-id="...">` element in `<head>` (ref-counted across instances, removed when the last instance is destroyed), so it participates in normal CSS cascade rules — no Shadow DOM or view encapsulation boundary to work around.

## Server-side rendering (SSR)

Styles are SSR-safe out of the box: `NfsStyleExtractor` inlines each component's critical CSS into the server-rendered `<head>` (deduplicated per style id), and `NfsStyleLoader` takes over on the client without re-injecting or flashing unstyled content. No additional setup is required — both services are `providedIn: 'root'` and platform-guarded automatically.

## RTL/Bidirectional support

`NfsButton` mirrors correctly under `dir="rtl"`, matching Foundation for Sites' `$global-text-direction` behavior:

- Spacing uses CSS logical properties (`margin-block`/`margin-inline`, `padding-block`/`padding-inline`) instead of physical `top`/`right`/`bottom`/`left` values, so directional spacing (e.g. the default bottom margin) automatically flips to the correct physical side under `dir="rtl"`. Border, border-radius, and the hollow variant's border-width remain uniform (symmetric) shorthand -- they apply identically to all sides/corners and have no directional variant to encode, so there's nothing to flip there. `apps/nfs-demo/e2e/nfs-button-rtl.spec.ts` regression-tests this by asserting identical computed styles between an `ltr` and an `rtl`-ancestor instance.
- The `expanded` and `dropdown` variants also use only logical properties at runtime (`margin-inline: 0` for expanded, `margin-inline-start` for the dropdown arrow's spacing) rather than Foundation's own physical `float`/`margin-left`/`margin-right`, so they mirror correctly under `dir="rtl"` too. `nfs-button.scss`'s separate precompiled pipeline instead ships a dedicated `rtlcss`-mirrored dual-file build (see Option 1 below) for the same variants.
- The [Option 1 precompiled CSS](#option-1-precompiled-css-zero-build-step) also ships a pre-mirrored `nfs-button.rtl.css` (generated via `rtlcss`) for consumers who want an explicit RTL stylesheet rather than relying on inherited `dir="rtl"`.
- **Caveat:** if you theme via [Option 2](#option-2-scss-override-recompile-with-your-own-variables) and introduce your own directional (left/right) values, verify mirroring yourself -- `NfsButton`'s own styles have no directional properties to get wrong, but consumer overrides can.

## Accessibility

`NfsButton` meets WCAG 2.1 AA:

- **Contrast.** The default theme's text/background pairs (primary `#fefefe` on `#1779ba`, secondary `#fefefe` on `#767676`, success `#0a0a0a` on `#3adb76`, warning `#0a0a0a` on `#ffae00`, alert `#fefefe` on `#cc4b37`, and their hollow/hover variants) all meet the 4.5:1 minimum contrast ratio for normal text — the text color for each new palette entry is computed by Foundation's own `color-pick-contrast` mixin, matching upstream Foundation's automatic black/white text selection. Disabled buttons are dimmed via `opacity` and are exempt from this requirement per WCAG (disabled controls aren't required to meet contrast). If you override colors via [Option 2 theming](#option-2-scss-override-recompile-with-your-own-variables), re-check contrast for your chosen palette with a contrast calculator (e.g. [WebAIM's](https://webaim.org/resources/contrastchecker/)) — the `!default` variables let you pick any values, including ones below AA.
- **ARIA semantics.** `<button nfsButton disabled>` uses the native `disabled` attribute; no ARIA is needed. `<a nfsButton disabled>` cannot be natively disabled, so it sets `aria-disabled="true"` and `tabindex="-1"` instead, while keeping its native `link` role (it still navigates via `href` — it isn't re-cast as a `button`).
- **Automated regression coverage.** `apps/nfs-demo/e2e/nfs-button-a11y.spec.ts` runs an axe-core scan (WCAG 2.1 A/AA rules) against every variant — primary/secondary, hollow, all sizes, disabled button, and disabled anchor — and fails the build on any critical or serious violation.

## Browser support

The workspace's [`.browserslistrc`](../../.browserslistrc) targets `baseline widely available` — browserslist's native query for the [web.dev "widely available" Baseline](https://web.dev/baseline) (browsers released less than 30 months ago across Chrome, Edge, Firefox, and Safari, desktop + iOS). This is the same definition Angular 22 documents for its own [browser support](https://angular.dev/reference/versions#browser-support), so the config tracks Angular's rolling baseline instead of a hand-copied, driftable static list. `node scripts/verify-browserslist.mjs` (wired into `nx run ngx-foundation-sites:lint`) asserts the config resolves to a non-empty browser set on every lint run.

## Running unit tests

Run `nx test ngx-foundation-sites` to execute the unit tests.
