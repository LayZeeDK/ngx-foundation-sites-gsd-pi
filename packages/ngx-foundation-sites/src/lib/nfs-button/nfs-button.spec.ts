import { Component, PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NfsButton } from './nfs-button';

@Component({
  imports: [NfsButton],
  template: `
    <button
      nfsButton
      [color]="color()"
      [hollow]="hollow()"
      [size]="size()"
      [expanded]="expanded()"
      [dropdown]="dropdown()"
      [disabled]="disabled()"
    >
      Button
    </button>
  `,
})
class ButtonHostComponent {
  readonly color = signal<'primary' | 'secondary' | 'success' | 'warning' | 'alert'>('primary');
  readonly hollow = signal(false);
  readonly size = signal<'tiny' | 'small' | 'large' | undefined>(undefined);
  readonly expanded = signal(false);
  readonly dropdown = signal(false);
  readonly disabled = signal(false);
}

@Component({
  imports: [NfsButton],
  template: `
    <a
      nfsButton
      href="#"
      [color]="color()"
      [hollow]="hollow()"
      [size]="size()"
      [expanded]="expanded()"
      [dropdown]="dropdown()"
      [disabled]="disabled()"
    >
      Anchor
    </a>
  `,
})
class AnchorHostComponent {
  readonly color = signal<'primary' | 'secondary' | 'success' | 'warning' | 'alert'>('primary');
  readonly hollow = signal(false);
  readonly size = signal<'tiny' | 'small' | 'large' | undefined>(undefined);
  readonly expanded = signal(false);
  readonly dropdown = signal(false);
  readonly disabled = signal(false);
}

describe('NfsButton', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
  });

  afterEach(() => {
    document
      .querySelectorAll('style[data-nfs-style-id], style[data-nfs-critical-css]')
      .forEach((element) => element.remove());
  });

  it('should create', async () => {
    const fixture = TestBed.createComponent(ButtonHostComponent);
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('button');
    expect(button).toBeTruthy();
  });

  describe('variant classes', () => {
    let fixture: ComponentFixture<ButtonHostComponent>;
    let host: ButtonHostComponent;
    let button: HTMLButtonElement;

    beforeEach(async () => {
      fixture = TestBed.createComponent(ButtonHostComponent);
      host = fixture.componentInstance;
      await fixture.whenStable();
      button = fixture.nativeElement.querySelector('button');
    });

    it('applies the base "button" class by default', () => {
      expect(button.classList.contains('button')).toBe(true);
    });

    it('does not apply the "secondary" class for the default primary color', () => {
      expect(button.classList.contains('secondary')).toBe(false);
    });

    it('applies the "secondary" class when color is secondary', async () => {
      host.color.set('secondary');
      await fixture.whenStable();

      expect(button.classList.contains('secondary')).toBe(true);
    });

    it('applies the "success" class when color is success', async () => {
      host.color.set('success');
      await fixture.whenStable();

      expect(button.classList.contains('success')).toBe(true);
    });

    it('applies the "warning" class when color is warning', async () => {
      host.color.set('warning');
      await fixture.whenStable();

      expect(button.classList.contains('warning')).toBe(true);
    });

    it('applies the "alert" class when color is alert', async () => {
      host.color.set('alert');
      await fixture.whenStable();

      expect(button.classList.contains('alert')).toBe(true);
    });

    it('does not apply a color class other than the one selected', async () => {
      host.color.set('success');
      await fixture.whenStable();

      expect(button.classList.contains('secondary')).toBe(false);
      expect(button.classList.contains('warning')).toBe(false);
      expect(button.classList.contains('alert')).toBe(false);
    });

    it('applies the "hollow" class when hollow is true', async () => {
      host.hollow.set(true);
      await fixture.whenStable();

      expect(button.classList.contains('hollow')).toBe(true);
    });

    it('does not apply a size class when size is undefined', () => {
      expect(button.classList.contains('tiny')).toBe(false);
      expect(button.classList.contains('small')).toBe(false);
      expect(button.classList.contains('large')).toBe(false);
    });

    it('applies the "tiny" class when size is tiny', async () => {
      host.size.set('tiny');
      await fixture.whenStable();

      expect(button.classList.contains('tiny')).toBe(true);
    });

    it('applies the "small" class when size is small', async () => {
      host.size.set('small');
      await fixture.whenStable();

      expect(button.classList.contains('small')).toBe(true);
    });

    it('applies the "large" class when size is large', async () => {
      host.size.set('large');
      await fixture.whenStable();

      expect(button.classList.contains('large')).toBe(true);
    });

    it('does not apply the "expanded" class by default', () => {
      expect(button.classList.contains('expanded')).toBe(false);
    });

    it('applies the "expanded" class when expanded is true', async () => {
      host.expanded.set(true);
      await fixture.whenStable();

      expect(button.classList.contains('expanded')).toBe(true);
    });

    it('does not apply the "dropdown" class by default', () => {
      expect(button.classList.contains('dropdown')).toBe(false);
    });

    it('applies the "dropdown" class when dropdown is true', async () => {
      host.dropdown.set(true);
      await fixture.whenStable();

      expect(button.classList.contains('dropdown')).toBe(true);
    });
  });

  describe('disabled semantics on <button>', () => {
    let fixture: ComponentFixture<ButtonHostComponent>;
    let host: ButtonHostComponent;
    let button: HTMLButtonElement;

    beforeEach(async () => {
      fixture = TestBed.createComponent(ButtonHostComponent);
      host = fixture.componentInstance;
      await fixture.whenStable();
      button = fixture.nativeElement.querySelector('button');
    });

    it('does not set the disabled attribute by default', () => {
      expect(button.hasAttribute('disabled')).toBe(false);
    });

    it('sets the native disabled attribute when disabled is true', async () => {
      host.disabled.set(true);
      await fixture.whenStable();

      expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('does not set aria-disabled on a disabled button (native semantics suffice)', async () => {
      host.disabled.set(true);
      await fixture.whenStable();

      expect(button.hasAttribute('aria-disabled')).toBe(false);
    });

    it('does not apply the "disabled" class on a disabled button', async () => {
      host.disabled.set(true);
      await fixture.whenStable();

      expect(button.classList.contains('disabled')).toBe(false);
    });

    it('does not set tabindex when disabled (native disabled attribute already removes it from the tab order)', async () => {
      host.disabled.set(true);
      await fixture.whenStable();

      expect(button.hasAttribute('tabindex')).toBe(false);
    });
  });

  describe('focus() convenience method', () => {
    it('moves focus to the host button element', async () => {
      const fixture = TestBed.createComponent(ButtonHostComponent);
      await fixture.whenStable();

      const directive = fixture.debugElement.query(
        By.directive(NfsButton),
      ).componentInstance as NfsButton;
      directive.focus();

      const button = fixture.nativeElement.querySelector('button');
      expect(document.activeElement).toBe(button);
    });

    it('moves focus to the host anchor element', async () => {
      const fixture = TestBed.createComponent(AnchorHostComponent);
      await fixture.whenStable();

      const directive = fixture.debugElement.query(
        By.directive(NfsButton),
      ).componentInstance as NfsButton;
      directive.focus();

      const anchor = fixture.nativeElement.querySelector('a');
      expect(document.activeElement).toBe(anchor);
    });
  });

  describe('disabled semantics on <a>', () => {
    let fixture: ComponentFixture<AnchorHostComponent>;
    let host: AnchorHostComponent;
    let anchor: HTMLAnchorElement;

    beforeEach(async () => {
      fixture = TestBed.createComponent(AnchorHostComponent);
      host = fixture.componentInstance;
      await fixture.whenStable();
      anchor = fixture.nativeElement.querySelector('a');
    });

    it('does not set aria-disabled by default', () => {
      expect(anchor.hasAttribute('aria-disabled')).toBe(false);
    });

    it('sets aria-disabled="true" instead of the disabled attribute when disabled is true', async () => {
      host.disabled.set(true);
      await fixture.whenStable();

      expect(anchor.getAttribute('aria-disabled')).toBe('true');
      expect(anchor.hasAttribute('disabled')).toBe(false);
    });

    it('applies the "disabled" class when disabled is true (soft-disabled styling)', async () => {
      host.disabled.set(true);
      await fixture.whenStable();

      expect(anchor.classList.contains('disabled')).toBe(true);
    });

    it('does not set tabindex by default', () => {
      expect(anchor.hasAttribute('tabindex')).toBe(false);
    });

    it('sets tabindex="-1" when disabled, removing it from the tab order', async () => {
      host.disabled.set(true);
      await fixture.whenStable();

      expect(anchor.getAttribute('tabindex')).toBe('-1');
    });

    it('blocks click-driven navigation when disabled', async () => {
      host.disabled.set(true);
      await fixture.whenStable();

      const clickEvent = new MouseEvent('click', { cancelable: true });
      anchor.dispatchEvent(clickEvent);

      expect(clickEvent.defaultPrevented).toBe(true);
    });

    it('allows click-driven navigation when not disabled', () => {
      const clickEvent = new MouseEvent('click', { cancelable: true });
      anchor.dispatchEvent(clickEvent);

      expect(clickEvent.defaultPrevented).toBe(false);
    });
  });

  describe('NfsStyleLoader integration', () => {
    it('loads the "nfs-button" style on construction', async () => {
      const fixture = TestBed.createComponent(ButtonHostComponent);
      await fixture.whenStable();

      const element = document.head.querySelector(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(element).not.toBeNull();
    });

    it('unloads the style on destroy, leaving zero leaked style elements', async () => {
      const fixture = TestBed.createComponent(ButtonHostComponent);
      await fixture.whenStable();

      fixture.destroy();

      const element = document.head.querySelector(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(element).toBeNull();
    });

    it('does not duplicate the style element across multiple instances', async () => {
      const fixtureA = TestBed.createComponent(ButtonHostComponent);
      await fixtureA.whenStable();
      const fixtureB = TestBed.createComponent(ButtonHostComponent);
      await fixtureB.whenStable();

      const elements = document.head.querySelectorAll(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(elements.length).toBe(1);

      fixtureA.destroy();
      fixtureB.destroy();
    });

    it('ref-counts across instances: keeps the style while any instance is alive, removes it once all are destroyed', async () => {
      const fixtureA = TestBed.createComponent(ButtonHostComponent);
      await fixtureA.whenStable();
      const fixtureB = TestBed.createComponent(ButtonHostComponent);
      await fixtureB.whenStable();

      fixtureA.destroy();

      let element = document.head.querySelector(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(element).not.toBeNull();

      fixtureB.destroy();

      element = document.head.querySelector(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(element).toBeNull();
    });
  });

  describe('NfsStyleExtractor integration', () => {
    it('does not inject critical CSS on the browser platform', async () => {
      const fixture = TestBed.createComponent(ButtonHostComponent);
      await fixture.whenStable();

      const element = document.head.querySelector(
        'style[data-nfs-critical-css="nfs-button"]',
      );
      expect(element).toBeNull();
    });

    it('injects critical CSS on the server platform without touching NfsStyleLoader behavior', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      });

      const fixture = TestBed.createComponent(ButtonHostComponent);
      await fixture.whenStable();

      const criticalCssElement = document.head.querySelector(
        'style[data-nfs-critical-css="nfs-button"]',
      );
      expect(criticalCssElement).not.toBeNull();

      const styleLoaderElement = document.head.querySelector(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(styleLoaderElement).toBeNull();
    });
  });
});
