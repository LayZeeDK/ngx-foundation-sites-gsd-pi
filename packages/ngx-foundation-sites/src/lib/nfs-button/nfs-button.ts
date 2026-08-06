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

@Component({
  selector: 'button[libNfsButton], a[libNfsButton]',
  imports: [],
  templateUrl: './nfs-button.html',
  host: {
    class: 'button',
    '[class.secondary]': "color() === 'secondary'",
    '[class.hollow]': 'hollow()',
    '[class.tiny]': "size() === 'tiny'",
    '[class.small]': "size() === 'small'",
    '[class.large]': "size() === 'large'",
    '[class.disabled]': 'isAnchor && disabled()',
    '[attr.disabled]': '!isAnchor && disabled() ? "" : null',
    '[attr.aria-disabled]': 'isAnchor && disabled() ? "true" : null',
    '(click)': 'onHostClick($event)',
  },
})
export class NfsButton implements OnDestroy {
  readonly color = input<'primary' | 'secondary'>('primary');
  readonly hollow = input(false, { transform: booleanAttribute });
  readonly size = input<'tiny' | 'small' | 'large' | undefined>(undefined);
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly styleLoader = inject(NfsStyleLoader);
  private readonly styleExtractor = inject(NfsStyleExtractor);

  protected readonly isAnchor = this.elementRef.nativeElement.tagName === 'A';

  constructor() {
    this.styleExtractor.extractStyles(NFS_BUTTON_STYLE_ID, NFS_BUTTON_STYLES);
    this.styleLoader.load(NFS_BUTTON_STYLE_ID, NFS_BUTTON_STYLES);
  }

  ngOnDestroy(): void {
    this.styleLoader.unload(NFS_BUTTON_STYLE_ID);
  }

  protected onHostClick(event: Event): void {
    if (this.isAnchor && this.disabled()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
