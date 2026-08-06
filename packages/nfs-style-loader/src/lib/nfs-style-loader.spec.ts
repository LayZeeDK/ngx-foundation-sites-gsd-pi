import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NfsStyleLoader } from './nfs-style-loader';

describe('NfsStyleLoader', () => {
  describe('on browser platform', () => {
    let service: NfsStyleLoader;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
      });
      service = TestBed.inject(NfsStyleLoader);
    });

    afterEach(() => {
      document
        .querySelectorAll('style[data-nfs-style-id]')
        .forEach((element) => element.remove());
    });

    it('injects a style element into document.head on first load', () => {
      service.load('nfs-button', '.nfs-button { color: red; }');

      const element = document.head.querySelector(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(element).not.toBeNull();
      expect(element?.textContent).toBe('.nfs-button { color: red; }');
    });

    it('increments the ref count without duplicating the style element when loaded by multiple instances', () => {
      service.load('nfs-button', '.nfs-button { color: red; }');
      service.load('nfs-button', '.nfs-button { color: red; }');
      service.load('nfs-button', '.nfs-button { color: red; }');

      const elements = document.head.querySelectorAll(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(elements.length).toBe(1);
    });

    it('keeps the style element while the ref count is above zero', () => {
      service.load('nfs-button', '.nfs-button { color: red; }');
      service.load('nfs-button', '.nfs-button { color: red; }');

      service.unload('nfs-button');

      const element = document.head.querySelector(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(element).not.toBeNull();
    });

    it('removes the style element once the ref count reaches zero', () => {
      service.load('nfs-button', '.nfs-button { color: red; }');
      service.load('nfs-button', '.nfs-button { color: red; }');

      service.unload('nfs-button');
      service.unload('nfs-button');

      const element = document.head.querySelector(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(element).toBeNull();
    });

    it('is a no-op when unloading an id that was never loaded', () => {
      expect(() => service.unload('never-loaded')).not.toThrow();
      const element = document.head.querySelector(
        'style[data-nfs-style-id="never-loaded"]',
      );
      expect(element).toBeNull();
    });

    it('tracks independent ref counts per style id', () => {
      service.load('nfs-button', '.nfs-button { color: red; }');
      service.load('nfs-card', '.nfs-card { color: blue; }');

      service.unload('nfs-button');

      expect(
        document.head.querySelector('style[data-nfs-style-id="nfs-button"]'),
      ).toBeNull();
      expect(
        document.head.querySelector('style[data-nfs-style-id="nfs-card"]'),
      ).not.toBeNull();
    });
  });

  describe('on server platform', () => {
    let service: NfsStyleLoader;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      });
      service = TestBed.inject(NfsStyleLoader);
    });

    it('does not inject a style element on load', () => {
      service.load('nfs-button', '.nfs-button { color: red; }');

      const element = document.head.querySelector(
        'style[data-nfs-style-id="nfs-button"]',
      );
      expect(element).toBeNull();
    });

    it('is a no-op on unload', () => {
      service.load('nfs-button', '.nfs-button { color: red; }');

      expect(() => service.unload('nfs-button')).not.toThrow();
    });
  });
});
