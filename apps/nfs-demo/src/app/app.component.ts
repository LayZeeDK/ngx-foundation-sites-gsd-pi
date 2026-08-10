import { Component, signal } from '@angular/core';
import { NfsButton } from 'ngx-foundation-sites';

@Component({
  selector: 'app-root',
  imports: [NfsButton],
  template: `
    <main>
      <h1>ngx-foundation-sites demo</h1>
      <button nfsButton color="primary" (click)="increment()">Click me</button>
      <p data-testid="click-count">Clicks: {{ clickCount() }}</p>

      <!-- The LTR half of nfs-button-rtl.spec.ts's mirroring gate. The
           dropdown variant is the ONLY one that carries a directional
           declaration: Foundation's button-dropdown emits
           "float: inline-end; margin-inline-start: 1em" on ::after, so a
           plain button cannot gate mirroring at all (ticket 03). -->
      <div data-testid="ltr-container">
        <button nfsButton dropdown data-testid="ltr-dropdown">
          LTR dropdown
        </button>
      </div>

      <div dir="rtl" data-testid="rtl-container">
        <button nfsButton color="primary" data-testid="rtl-button">
          RTL button
        </button>
        <button nfsButton dropdown data-testid="rtl-dropdown">
          RTL dropdown
        </button>
      </div>

      <!-- Scanned by nfs-button-a11y.spec.ts (S13/R003): one instance per
           NfsButton variant, so the axe-core scan covers every combination
           the requirement claims. data-a11y-variant is the stable identity
           the spec's expected-failure set is keyed on -- axe's own generated
           target selectors are positional and would churn whenever this
           markup is reordered.

           The full button palette (success/warning/alert) postdates R003's
           original scan and is covered here for the first time, in both fill
           and hollow form, because a hollow button pairs the palette colour
           against the PAGE background rather than against the button text
           colour -- an entirely different contrast pair (ticket 14). -->
      <div data-testid="a11y-variants">
        <button nfsButton data-a11y-variant="primary">Primary</button>
        <button nfsButton color="secondary" data-a11y-variant="secondary">
          Secondary
        </button>
        <button nfsButton color="success" data-a11y-variant="success">
          Success
        </button>
        <button nfsButton color="warning" data-a11y-variant="warning">
          Warning
        </button>
        <button nfsButton color="alert" data-a11y-variant="alert">Alert</button>
        <button nfsButton hollow data-a11y-variant="hollow-primary">
          Hollow primary
        </button>
        <button
          nfsButton
          hollow
          color="secondary"
          data-a11y-variant="hollow-secondary"
        >
          Hollow secondary
        </button>
        <button
          nfsButton
          hollow
          color="success"
          data-a11y-variant="hollow-success"
        >
          Hollow success
        </button>
        <button
          nfsButton
          hollow
          color="warning"
          data-a11y-variant="hollow-warning"
        >
          Hollow warning
        </button>
        <button nfsButton hollow color="alert" data-a11y-variant="hollow-alert">
          Hollow alert
        </button>
        <button nfsButton size="tiny" data-a11y-variant="tiny">Tiny</button>
        <button nfsButton size="small" data-a11y-variant="small">Small</button>
        <button nfsButton size="large" data-a11y-variant="large">Large</button>
        <button nfsButton disabled data-a11y-variant="disabled-button">
          Disabled button
        </button>
        <a nfsButton href="#" disabled data-a11y-variant="disabled-anchor">
          Disabled anchor
        </a>
      </div>
    </main>
  `,
})
export class AppComponent {
  protected readonly clickCount = signal(0);

  protected increment(): void {
    this.clickCount.update((count) => count + 1);
  }
}
