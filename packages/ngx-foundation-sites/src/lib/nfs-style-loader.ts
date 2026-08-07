import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface StyleRecord {
  count: number;
  element: HTMLStyleElement;
}

/**
 * Reference-counted `<style>` element loader for component CSS.
 *
 * Injects a component's CSS into `document.head` once, no matter how many
 * instances of that component are alive, and removes it only once the last
 * instance unloads. This keeps unused component CSS from lingering in the
 * DOM. No-op on the server platform -- server-rendered critical CSS is
 * handled separately by `NfsStyleExtractor`.
 */
@Injectable({ providedIn: 'root' })
export class NfsStyleLoader {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly styles = new Map<string, StyleRecord>();

  /**
   * Loads a component's CSS into `document.head`, or increments its
   * reference count if already loaded. No-op on the server.
   *
   * @param id - Stable identifier for the style block (e.g. component selector).
   * @param css - The CSS text to inject.
   */
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

  /**
   * Decrements the reference count for a previously loaded style block,
   * removing it from `document.head` once the count reaches zero. No-op on
   * the server.
   *
   * @param id - The identifier previously passed to {@link load}.
   */
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
