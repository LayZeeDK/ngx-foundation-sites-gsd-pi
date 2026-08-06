import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface StyleRecord {
  count: number;
  element: HTMLStyleElement;
}

@Injectable({ providedIn: 'root' })
export class NfsStyleLoader {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly styles = new Map<string, StyleRecord>();

  load(id: string, css: string): void {
    if (!this.isBrowser) {
      return;
    }

    const existing = this.styles.get(id);
    if (existing) {
      existing.count++;
      return;
    }

    const element = this.document.createElement('style');
    element.textContent = css;
    element.setAttribute('data-nfs-style-id', id);
    this.document.head.appendChild(element);
    this.styles.set(id, { count: 1, element });
  }

  unload(id: string): void {
    if (!this.isBrowser) {
      return;
    }

    const existing = this.styles.get(id);
    if (!existing) {
      return;
    }

    existing.count--;
    if (existing.count <= 0) {
      existing.element.remove();
      this.styles.delete(id);
    }
  }
}
