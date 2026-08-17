// R021 lane 1 (`test`, jsdom): compile pipeline, error shape, the
// Worker-boundary serialisation contract, and the shared sources importer.
//
// Split from a single file (MEM106): theming-inject.ts's coalescer state
// machine now lives in theming-inject.spec.ts, and the R026 path-spelling
// divergence guard (an eslint.config.mjs test, not a theming-worker test) now
// lives in theming-inject.r026-lint.spec.ts, matching the
// nfs-button.r026-lint.spec.ts naming convention.
//
// Placed under src/storybook/, not .storybook/ -- see theming-panel.spec.ts's
// header comment for why. `theming-worker.ts`/`theming-inject.ts` are
// imported by real relative path from their actual location.
//
// `theming-worker.ts` has no exported `compile`/`serializeError` -- both are
// reached the same way production reaches them: importing the module sets
// `globalThis.onmessage` unconditionally -- there is no environment guard on
// that registration -- so a spec can stub `globalThis.postMessage`, import
// the module, and drive the real handler directly. Verified empirically
// against the real `nx test ngx-foundation-sites` pipeline (not just a bare
// Vitest run) before writing these assertions: the jsdom lane resolves the
// Node `sass` build here (matching research/10's Q2/Q1), producing the exact
// 5839-byte / sha256 `49bfb1a2e67bf91a` digest asserted in T1 below.
import { createHash } from 'node:crypto';

import * as sass from 'sass';

import { THEMING_SOURCES } from '../../.storybook/theming-sources.generated';
import { createSourcesImporter } from '../../.storybook/theming-sources-importer';
import type { NfsTheme } from '../../.storybook/theming-model';
import type { ThemeCompileResponse } from '../../.storybook/theming-worker';

interface WorkerScope {
  onmessage: ((event: MessageEvent<{ seq: number; theme: NfsTheme }>) => void) | null;
}

const postMessageCalls: ThemeCompileResponse[] = [];

beforeAll(async () => {
  (globalThis as unknown as { postMessage: (message: ThemeCompileResponse) => void }).postMessage =
    (message) => postMessageCalls.push(message);
  // Side effect: sets globalThis.onmessage to the real handler.
  await import('../../.storybook/theming-worker');
});

function compileTheme(seq: number, theme: NfsTheme): ThemeCompileResponse {
  postMessageCalls.length = 0;
  const onmessage = (globalThis as unknown as WorkerScope).onmessage;
  if (!onmessage) {
    throw new Error('theming-worker did not register globalThis.onmessage');
  }
  onmessage({ data: { seq, theme } } as MessageEvent<{ seq: number; theme: NfsTheme }>);
  return postMessageCalls[0];
}

describe('theming-worker compile pipeline -- sources-map fitness digest (T1)', () => {
  it('THEMING_SOURCES contains the data-only nfs:/_theme.scss partial', () => {
    expect(Object.prototype.hasOwnProperty.call(THEMING_SOURCES, 'nfs:/_theme.scss')).toBe(true);
  });

  it('compiling the default theme yields the fitness digest: 5839 bytes, sha256[0:16] 49bfb1a2e67bf91a', () => {
    const response = compileTheme(1, {});
    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error('unreachable');
    }

    const bytes = Buffer.byteLength(response.css, 'utf8');
    const digest = createHash('sha256').update(response.css, 'utf8').digest('hex').slice(0, 16);

    expect(bytes).toBe(5839);
    expect(digest).toBe('49bfb1a2e67bf91a');
  });
});

describe('theming-worker compile pipeline -- differential compilation (T2)', () => {
  const cases: Array<{ key: keyof NfsTheme; a: NfsTheme; b: NfsTheme; expectA: string; expectB: string }> = [
    { key: 'primary', a: { primary: '#ff0000' }, b: { primary: '#00ff00' }, expectA: '#ff0000', expectB: '#00ff00' },
    { key: 'secondary', a: { secondary: '#111111' }, b: { secondary: '#222222' }, expectA: '#111111', expectB: '#222222' },
    { key: 'success', a: { success: '#333333' }, b: { success: '#444444' }, expectA: '#333333', expectB: '#444444' },
    { key: 'warning', a: { warning: '#555555' }, b: { warning: '#666666' }, expectA: '#555555', expectB: '#666666' },
    { key: 'alert', a: { alert: '#777777' }, b: { alert: '#888888' }, expectA: '#777777', expectB: '#888888' },
    { key: 'radius', a: { radius: 2 }, b: { radius: 20 }, expectA: '2px', expectB: '20px' },
  ];

  it.each(cases)('control $key: A and B compile to different, expected CSS', ({ a, b, expectA, expectB }) => {
    const responseA = compileTheme(1, a);
    const responseB = compileTheme(2, b);
    expect(responseA.ok).toBe(true);
    expect(responseB.ok).toBe(true);
    if (!responseA.ok || !responseB.ok) {
      throw new Error('unreachable');
    }

    expect(responseA.css).toContain(expectA);
    expect(responseB.css).toContain(expectB);
    expect(responseA.css).not.toBe(responseB.css);
  });
});

describe('theming-worker compile pipeline -- Sass error shape (T6)', () => {
  it('an invalid control value yields sassMessage and sourceUrl (span.url), no ANSI in either', () => {
    const response = compileTheme(1, { primary: 'not-a-color' } as unknown as NfsTheme);
    expect(response.ok).toBe(false);
    if (response.ok) {
      throw new Error('unreachable');
    }

    expect(response.error.sassMessage).toBe('$color: not-a-color is not a color.');
    expect(response.error.sourceUrl).toBe('fnd:/scss/components/_button.scss');
    // eslint-disable-next-line no-control-regex
    expect(/\x1b\[/.test(response.error.sassMessage)).toBe(false);
    // eslint-disable-next-line no-control-regex
    expect(/\x1b\[/.test(response.error.sassStack)).toBe(false);
  });

  it(
    'a mis-wired importer (no candidate resolves) yields the GENERIC diagnostic in this lane, ' +
      "not the browser main-thread's friendly one -- correcting research/10 T6's assumption",
    () => {
      // research/10-r021-verification-design.md T6 assumed jsdom is "the
      // Node-side lane where the friendly diagnostic survives" (echoing
      // research/09 D.7's Worker-vs-main-thread framing). Verified against
      // the real nx test pipeline before writing this: jsdom resolves the
      // NODE sass build (Q1), and the Node build's missing-importer message
      // is the generic one regardless of `document` -- the friendly
      // "Custom importers are required..." message is specific to the
      // BROWSER (dart2js) build's isBrowser() check, which this lane never
      // loads (loading both entries in one context throws, per research/10
      // section 2.2). So there is nothing left to assert about a "friendly"
      // variant in this lane; this test pins the actual behaviour instead.
      let thrown: unknown;
      try {
        sass.compileString("@use 'totally-bogus-nfs-url';", {
          importers: [
            {
              canonicalize() {
                return null;
              },
              load(): never {
                throw new Error('never called');
              },
            },
          ],
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(sass.Exception);
      expect((thrown as sass.Exception).sassMessage).toBe("Can't find stylesheet to import.");
    }
  );
});

describe('theming-worker compile pipeline -- structuredClone Worker-boundary contract (T7)', () => {
  it('CONTROL: structuredClone of a raw sass.Exception drops sassMessage/span/name', () => {
    let thrown: unknown;
    try {
      sass.compileString(
        [
          "@use 'nfs:/theme' as t;",
          "a { x: t.$primary-color + notacolor; }",
        ].join('\n'),
        {
          importers: [
            {
              canonicalize(url) {
                return Object.prototype.hasOwnProperty.call(THEMING_SOURCES, url)
                  ? new URL(url)
                  : null;
              },
              load(canonicalUrl) {
                return { contents: THEMING_SOURCES[canonicalUrl.toString()], syntax: 'scss' };
              },
            },
          ],
        }
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(sass.Exception);
    const cloned = structuredClone(thrown as Error) as unknown as Record<string, unknown>;
    expect(cloned['name']).toBe('Error');
    expect(cloned['sassMessage']).toBeUndefined();
    expect(Object.keys(cloned)).toEqual([]);
  });

  it("SUBJECT: the worker's serialized SassErrorLike survives structuredClone with sassMessage/sourceUrl intact", () => {
    const response = compileTheme(1, { primary: 'not-a-color' } as unknown as NfsTheme);
    expect(response.ok).toBe(false);
    if (response.ok) {
      throw new Error('unreachable');
    }

    const cloned = structuredClone(response.error);
    expect(cloned.sassMessage).toBe(response.error.sassMessage);
    expect(cloned.sourceUrl).toBe(response.error.sourceUrl);
  });
});

describe('shared sources importer -- the drift guard (T11)', () => {
  // theming-worker.ts and theming-presets.ts each carried their own copy of
  // this resolver, and the copies had already diverged: the probe's lacked the
  // `foundation-sites/scss/` -> `fnd:` rewrite. That was latent rather than
  // broken only because the probe entry happens to reach no Foundation-derived
  // variable. Both now share one importer, and this pins the behaviour that
  // was missing from one of them.
  it('T11a: re-schemes a foundation-sites path onto fnd: and resolves it', () => {
    const importer = createSourcesImporter();
    // Extensionless, as Sass hands it to an importer -- `candidateUrls` is what
    // adds the `_` prefix and `.scss` suffix.
    const resolved = importer.canonicalize('../../node_modules/foundation-sites/scss/util/color', {
      fromImport: true,
      containingUrl: null,
    });

    expect(resolved?.toString()).toBe('fnd:/scss/util/_color.scss');
  });

  it('T11b: still resolves the nfs: scheme, and returns null for an unknown url', () => {
    const importer = createSourcesImporter();

    expect(
      importer
        .canonicalize('nfs:/theme', { fromImport: false, containingUrl: null })
        ?.toString()
    ).toBe('nfs:/_theme.scss');
    expect(
      importer.canonicalize('nfs:/definitely-not-a-module', {
        fromImport: false,
        containingUrl: null,
      })
    ).toBeNull();
  });

  it('T11c: load() throws a named error rather than handing Sass `contents: undefined`', () => {
    const importer = createSourcesImporter();

    expect(() => importer.load(new URL('nfs:/never-generated.scss'))).toThrow(
      /canonicalize\(\) accepted/
    );
  });
});
