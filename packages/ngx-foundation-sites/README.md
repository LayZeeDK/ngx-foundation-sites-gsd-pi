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

Component styles are hand-matched to Foundation for Sites' default Sass settings (`$primary-color: #1779ba`, `$secondary-color: #767676`, `$global-radius: 0`, `$button-opacity-disabled: 0.25`). There is currently no CSS custom property or Sass token API for overriding these — this is tracked as a follow-up.

In the meantime, override the rendered classes with your own stylesheet at a higher specificity or later source order:

```css
/* app.css — loaded after ngx-foundation-sites' injected styles */
.button {
  --my-brand-color: #2a5db0;
  background-color: var(--my-brand-color);
}

.button:hover,
.button:focus {
  background-color: #1e4482;
}
```

Each component's CSS is injected once per app as a single `<style data-nfs-style-id="...">` element in `<head>` (ref-counted across instances, removed when the last instance is destroyed), so it participates in normal CSS cascade rules — no Shadow DOM or view encapsulation boundary to work around.

## Server-side rendering (SSR)

Styles are SSR-safe out of the box: `NfsStyleExtractor` inlines each component's critical CSS into the server-rendered `<head>` (deduplicated per style id), and `NfsStyleLoader` takes over on the client without re-injecting or flashing unstyled content. No additional setup is required — both services are `providedIn: 'root'` and platform-guarded automatically.

## Running unit tests

Run `nx test ngx-foundation-sites` to execute the unit tests.
