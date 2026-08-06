import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NfsStyleExtractor } from './nfs-style-extractor';

describe('NfsStyleExtractor', () => {
  describe('on server platform', () => {
    let service: NfsStyleExtractor;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      });
      service = TestBed.inject(NfsStyleExtractor);
    });

    afterEach(() => {
      document
        .querySelectorAll('style[data-nfs-critical-css]')
        .forEach((element) => element.remove());
    });

    it('injects an inline style element into document.head', () => {
      service.extractStyles('nfs-button', '.nfs-button { color: red; }');

      const element = document.head.querySelector(
        'style[data-nfs-critical-css="nfs-button"]',
      );
      expect(element).not.toBeNull();
      expect(element?.textContent).toBe('.nfs-button { color: red; }');
    });

    it('does not duplicate the style element when extracted multiple times for the same id', () => {
      service.extractStyles('nfs-button', '.nfs-button { color: red; }');
      service.extractStyles('nfs-button', '.nfs-button { color: red; }');
      service.extractStyles('nfs-button', '.nfs-button { color: red; }');

      const elements = document.head.querySelectorAll(
        'style[data-nfs-critical-css="nfs-button"]',
      );
      expect(elements.length).toBe(1);
    });

    it('tracks independent extraction per style id', () => {
      service.extractStyles('nfs-button', '.nfs-button { color: red; }');
      service.extractStyles('nfs-card', '.nfs-card { color: blue; }');

      expect(
        document.head.querySelector(
          'style[data-nfs-critical-css="nfs-button"]',
        ),
      ).not.toBeNull();
      expect(
        document.head.querySelector(
          'style[data-nfs-critical-css="nfs-card"]',
        ),
      ).not.toBeNull();
    });
  });

  describe('on browser platform', () => {
    let service: NfsStyleExtractor;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
      });
      service = TestBed.inject(NfsStyleExtractor);
    });

    it('does not inject a style element', () => {
      service.extractStyles('nfs-button', '.nfs-button { color: red; }');

      const element = document.head.querySelector(
        'style[data-nfs-critical-css="nfs-button"]',
      );
      expect(element).toBeNull();
    });

    it('is a no-op and does not throw', () => {
      expect(() =>
        service.extractStyles('nfs-button', '.nfs-button { color: red; }'),
      ).not.toThrow();
    });
  });
});
