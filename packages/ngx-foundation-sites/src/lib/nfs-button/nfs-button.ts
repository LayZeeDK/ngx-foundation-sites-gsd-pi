import {
  Component,
  ElementRef,
  OnDestroy,
  booleanAttribute,
  inject,
  input,
} from '@angular/core';
import { NfsStyleExtractor } from '../nfs-style-extractor';
import { NfsStyleLoader } from '../nfs-style-loader';
import { NFS_BUTTON_STYLES } from './nfs-button.styles';

const NFS_BUTTON_STYLE_ID = 'nfs-button';

/**
 * Foundation for Sites button, applied to a native `<button>` or `<a>` element
 * via the `nfsButton` attribute selector.
 *
 * Renders Foundation's `.button` classes and states (color, hollow, size,
 * disabled/soft-disabled) while keeping the host's native button or anchor
 * semantics intact.
 */
@Component({
  selector: 'button[nfsButton], a[nfsButton]',
  imports: [],
  templateUrl: './nfs-button.html',
  host: {
    class: 'button',
    '[class.secondary]': "color() === 'secondary'",
    '[class.success]': "color() === 'success'",
    '[class.warning]': "color() === 'warning'",
    '[class.alert]': "color() === 'alert'",
    '[class.hollow]': 'hollow()',
    '[class.tiny]': "size() === 'tiny'",
    '[class.small]': "size() === 'small'",
    '[class.large]': "size() === 'large'",
    '[class.expanded]': 'expanded()',
    '[class.dropdown]': 'dropdown()',
    '[class.disabled]': 'isAnchor && disabled()',
    '[attr.disabled]': '!isAnchor && disabled() ? "" : null',
    '[attr.aria-disabled]': 'isAnchor && disabled() ? "true" : null',
    '[attr.tabindex]': 'isAnchor && disabled() ? -1 : null',
    '(click)': 'onHostClick($event)',
  },
})
export class NfsButton implements OnDestroy {
  /**
   * Foundation color variant. Defaults to `'primary'`. Matches Foundation's
   * full `$button-palette` (D017): primary, secondary, success, warning,
   * alert.
   */
  readonly color = input<'primary' | 'secondary' | 'success' | 'warning' | 'alert'>('primary');
  /** Renders Foundation's hollow (outlined) button style when `true`. */
  readonly hollow = input(false, { transform: booleanAttribute });
  /** Foundation size variant. Defaults to the standard (unset) size. */
  readonly size = input<'tiny' | 'small' | 'large' | undefined>(undefined);
  /** Renders Foundation's expanded (full-width) button style when `true`. */
  readonly expanded = input(false, { transform: booleanAttribute });
  /** Renders Foundation's dropdown arrow indicator when `true`. */
  readonly dropdown = input(false, { transform: booleanAttribute });
  /**
   * Disables the button. On a native `<button>` host this sets the
   * `disabled` attribute; on an `<a>` host (which cannot be natively
   * disabled) this applies Foundation's soft-disabled styling, sets
   * `aria-disabled="true"`, removes the element from the tab order, and
   * suppresses click activation.
   */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly styleLoader = inject(NfsStyleLoader);
  private readonly styleExtractor = inject(NfsStyleExtractor);

  protected readonly isAnchor = this.elementRef.nativeElement.tagName === 'A';

  constructor() {
    this.styleExtractor.extractStyles(NFS_BUTTON_STYLE_ID, NFS_BUTTON_STYLES);
    this.styleLoader.load(NFS_BUTTON_STYLE_ID, NFS_BUTTON_STYLES);
  }

  /** Unloads this component's styles, decrementing NfsStyleLoader's ref count. */
  ngOnDestroy(): void {
    this.styleLoader.unload(NFS_BUTTON_STYLE_ID);
  }

  /**
   * Focuses the host button or anchor element.
   *
   * @param options - Native `HTMLElement.focus()` options (e.g. `preventScroll`).
   */
  focus(options?: FocusOptions): void {
    this.elementRef.nativeElement.focus(options);
  }

  /**
   * Host `(click)` handler. Prevents activation when a disabled `<a>` host
   * is clicked, since anchors cannot be natively disabled.
   *
   * @param event - The native click event.
   */
  protected onHostClick(event: Event): void {
    if (this.isAnchor && this.disabled()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
