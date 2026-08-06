import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class NfsStyleExtractor {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isServer = isPlatformServer(this.platformId);
  private readonly extractedIds = new Set<string>();

  extractStyles(id: string, css: string): void {
    if (!this.isServer) {
      return;
    }

    if (this.extractedIds.has(id)) {
      return;
    }

    const element = this.document.createElement('style');
    element.textContent = css;
    element.setAttribute('data-nfs-critical-css', id);
    this.document.head.appendChild(element);
    this.extractedIds.add(id);
  }
}
