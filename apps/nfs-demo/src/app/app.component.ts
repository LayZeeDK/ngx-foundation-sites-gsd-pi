import { Component, signal } from '@angular/core';
import { NfsButton } from 'ngx-foundation-sites';

@Component({
  selector: 'app-root',
  imports: [NfsButton],
  template: `
    <main>
      <h1>ngx-foundation-sites demo</h1>
      <button libNfsButton color="primary" (click)="increment()">
        Click me
      </button>
      <p data-testid="click-count">Clicks: {{ clickCount() }}</p>
    </main>
  `,
})
export class AppComponent {
  protected readonly clickCount = signal(0);

  protected increment(): void {
    this.clickCount.update((count) => count + 1);
  }
}
