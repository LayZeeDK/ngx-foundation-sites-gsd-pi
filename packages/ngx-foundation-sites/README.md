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

`NfsButton` is a directive-style standalone component applied to a native `<button>` or `<a>` element via the `libNfsButton` attribute selector, so your markup keeps its native tag semantics.

```typescript
import { Component } from '@angular/core';
import { NfsButton } from 'ngx-foundation-sites';

@Component({
  selector: 'app-root',
  imports: [NfsButton],
  template: `<button libNfsButton (click)="onClick()">Click me</button>`,
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

- **`<button libNfsButton>`** — `disabled` sets the native `disabled` attribute. The browser prevents clicks and focus automatically.
- **`<a libNfsButton>`** — anchors have no native `disabled` attribute, so `disabled` instead applies `aria-disabled="true"` and a `.disabled` CSS class, and click-driven navigation is prevented in the click handler. The anchor remains focusable, matching Foundation for Sites' documented "soft-disabled" pattern for links.

```html
<a libNfsButton href="/checkout" [disabled]="isProcessing()">Checkout</a>
```

### Examples

```html
<button libNfsButton color="secondary">Secondary</button>
<button libNfsButton hollow>Hollow</button>
<button libNfsButton size="tiny">Tiny</button>
<button libNfsButton size="large" disabled>Large, disabled</button>
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
  $button-opacity-disabled: 0.4
);
```

Compile this with your app's normal Sass build — no extra `--load-path` is needed, since `nfs-button.scss` only depends on its own bundled `_settings.scss`, not on `foundation-sites` itself — and include the resulting CSS globally.

Both the runtime-injected default styles and the precompiled CSS are wrapped in `@layer nfs-defaults` (Baseline widely available since March 2022). Per the CSS cascade spec, any unlayered rule always beats a layered rule regardless of specificity or load order, so your themed stylesheet wins automatically as long as it isn't itself wrapped in a named `@layer` that sorts before `nfs-defaults`.

Each component's CSS is injected once per app as a single `<style data-nfs-style-id="...">` element in `<head>` (ref-counted across instances, removed when the last instance is destroyed), so it participates in normal CSS cascade rules — no Shadow DOM or view encapsulation boundary to work around.

## Server-side rendering (SSR)

Styles are SSR-safe out of the box: `NfsStyleExtractor` inlines each component's critical CSS into the server-rendered `<head>` (deduplicated per style id), and `NfsStyleLoader` takes over on the client without re-injecting or flashing unstyled content. No additional setup is required — both services are `providedIn: 'root'` and platform-guarded automatically.

## Browser support

The workspace's [`.browserslistrc`](../../.browserslistrc) targets `baseline widely available` — browserslist's native query for the [web.dev "widely available" Baseline](https://web.dev/baseline) (browsers released less than 30 months ago across Chrome, Edge, Firefox, and Safari, desktop + iOS). This is the same definition Angular 22 documents for its own [browser support](https://angular.dev/reference/versions#browser-support), so the config tracks Angular's rolling baseline instead of a hand-copied, driftable static list. `node scripts/verify-browserslist.mjs` (wired into `nx run ngx-foundation-sites:lint`) asserts the config resolves to a non-empty browser set on every lint run.

## Running unit tests

Run `nx test ngx-foundation-sites` to execute the unit tests.
