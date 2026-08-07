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

| Input      | Type                                        | Default     | Description                                                                 |
| ---------- | ------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `color`    | `'primary' \| 'secondary'`                  | `'primary'` | Button color variant.                                                        |
| `hollow`   | `boolean`                                   | `false`     | Renders an outlined ("hollow") variant instead of a filled background.       |
| `size`     | `'tiny' \| 'small' \| 'large' \| undefined` | `undefined` | Button size. Leave `undefined` for the default size.                        |
| `disabled` | `boolean`                                   | `false`     | Disables the button. On `<a>` this is a soft-disable (see below).            |

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
<button nfsButton hollow>Hollow</button>
<button nfsButton size="tiny">Tiny</button>
<button nfsButton size="large" disabled>Large, disabled</button>
```

## Theming

Component styles are hand-matched to Foundation for Sites' default Sass settings (`$primary-color: #1779ba`, `$secondary-color: #767676`, `$global-radius: 0`, `$button-opacity-disabled: 0.25`). `NfsButton` always injects its own default styles at runtime (via `NfsStyleLoader`/`NfsStyleExtractor`) — there is no CSS custom property API for overriding these on the fly. There are two supported ways to theme the button.

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
  $global-radius: 4px,
  $button-padding: 1em 1.5em,
  $button-opacity-disabled: 0.4
);
```

`$primary-color`/`$secondary-color` cover the palette, `$global-radius` covers corner radius, and `$button-padding` covers spacing — all declared `!default` in [`scss/_settings.scss`](src/scss/_settings.scss), so setting them via the `with (...)` configuration (Sass's module-scoped equivalent of a consumer settings file) before the module's own defaults are used is enough to theme the component; no component code changes are needed.

Compile this with your app's normal Sass build — no extra `--load-path` is needed, since `nfs-button.scss` only depends on its own bundled `_settings.scss`, not on `foundation-sites` itself — and include the resulting CSS globally.

Both the runtime-injected default styles and the precompiled CSS are wrapped in `@layer nfs-defaults` (Baseline widely available since March 2022). Per the CSS cascade spec, any unlayered rule always beats a layered rule regardless of specificity or load order, so your themed stylesheet wins automatically as long as it isn't itself wrapped in a named `@layer` that sorts before `nfs-defaults`.

Each component's CSS is injected once per app as a single `<style data-nfs-style-id="...">` element in `<head>` (ref-counted across instances, removed when the last instance is destroyed), so it participates in normal CSS cascade rules — no Shadow DOM or view encapsulation boundary to work around.

## Server-side rendering (SSR)

Styles are SSR-safe out of the box: `NfsStyleExtractor` inlines each component's critical CSS into the server-rendered `<head>` (deduplicated per style id), and `NfsStyleLoader` takes over on the client without re-injecting or flashing unstyled content. No additional setup is required — both services are `providedIn: 'root'` and platform-guarded automatically.

## RTL/Bidirectional support

`NfsButton` mirrors correctly under `dir="rtl"`, matching Foundation for Sites' `$global-text-direction` behavior:

- All of the default theme's layout properties (padding, border, border-radius) use symmetric shorthand rather than physical `left`/`right` values, so the button's box model is naturally direction-agnostic -- there's nothing to flip. `apps/nfs-demo/e2e/nfs-button-rtl.spec.ts` regression-tests this by asserting identical computed styles between an `ltr` and an `rtl`-ancestor instance.
- The [Option 1 precompiled CSS](#option-1-precompiled-css-zero-build-step) also ships a pre-mirrored `nfs-button.rtl.css` (generated via `rtlcss`) for consumers who want an explicit RTL stylesheet rather than relying on inherited `dir="rtl"`.
- **Caveat:** if you theme via [Option 2](#option-2-scss-override-recompile-with-your-own-variables) and introduce your own directional (left/right) values, verify mirroring yourself -- `NfsButton`'s own styles have no directional properties to get wrong, but consumer overrides can.

## Accessibility

`NfsButton` meets WCAG 2.1 AA:

- **Contrast.** The default theme's text/background pairs (primary `#fefefe` on `#1779ba`, secondary `#fefefe` on `#767676`, and their hollow/hover variants) all meet the 4.5:1 minimum contrast ratio for normal text. Disabled buttons are dimmed via `opacity` and are exempt from this requirement per WCAG (disabled controls aren't required to meet contrast). If you override colors via [Option 2 theming](#option-2-scss-override-recompile-with-your-own-variables), re-check contrast for your chosen palette with a contrast calculator (e.g. [WebAIM's](https://webaim.org/resources/contrastchecker/)) — the `!default` variables let you pick any values, including ones below AA.
- **ARIA semantics.** `<button nfsButton disabled>` uses the native `disabled` attribute; no ARIA is needed. `<a nfsButton disabled>` cannot be natively disabled, so it sets `aria-disabled="true"` and `tabindex="-1"` instead, while keeping its native `link` role (it still navigates via `href` — it isn't re-cast as a `button`).
- **Automated regression coverage.** `apps/nfs-demo/e2e/nfs-button-a11y.spec.ts` runs an axe-core scan (WCAG 2.1 A/AA rules) against every variant — primary/secondary, hollow, all sizes, disabled button, and disabled anchor — and fails the build on any critical or serious violation.

## Browser support

The workspace's [`.browserslistrc`](../../.browserslistrc) targets `baseline widely available` — browserslist's native query for the [web.dev "widely available" Baseline](https://web.dev/baseline) (browsers released less than 30 months ago across Chrome, Edge, Firefox, and Safari, desktop + iOS). This is the same definition Angular 22 documents for its own [browser support](https://angular.dev/reference/versions#browser-support), so the config tracks Angular's rolling baseline instead of a hand-copied, driftable static list. `node scripts/verify-browserslist.mjs` (wired into `nx run ngx-foundation-sites:lint`) asserts the config resolves to a non-empty browser set on every lint run.

## Running unit tests

Run `nx test ngx-foundation-sites` to execute the unit tests.
