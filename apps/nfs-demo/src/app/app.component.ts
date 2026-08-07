import { Component, signal } from '@angular/core';
import { NfsButton } from 'ngx-foundation-sites';

@Component({
  selector: 'app-root',
  imports: [NfsButton],
  template: `
    <main>
      <h1>ngx-foundation-sites demo</h1>
      <button nfsButton color="primary" (click)="increment()">
        Click me
      </button>
      <p data-testid="click-count">Clicks: {{ clickCount() }}</p>

      <div dir="rtl" data-testid="rtl-container">
        <button nfsButton color="primary" data-testid="rtl-button">
          RTL button
        </button>
      </div>

      <!-- Scanned by nfs-button-a11y.spec.ts (S13/R003): one instance per
           NfsButton variant, so the axe-core scan covers every combination
           called out in the slice plan. -->
      <div data-testid="a11y-variants">
        <button nfsButton>Primary</button>
        <button nfsButton color="secondary">Secondary</button>
        <button nfsButton hollow>Hollow primary</button>
        <button nfsButton hollow color="secondary">Hollow secondary</button>
        <button nfsButton size="tiny">Tiny</button>
        <button nfsButton size="small">Small</button>
        <button nfsButton size="large">Large</button>
        <button nfsButton disabled>Disabled button</button>
        <a nfsButton href="#" disabled>Disabled anchor</a>
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
