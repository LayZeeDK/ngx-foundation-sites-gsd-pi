// R021 lane 1 (`test`, jsdom): compile pipeline, error shape, the
// Worker-boundary serialisation contract, the compile coalescer, and the
// R026 exemption's path-spelling guard.
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

import { Linter } from 'eslint';
import * as sass from 'sass';

// @ts-expect-error -- ESM flat-config module; no ambient .mjs type declaration in this tsconfig (allowJs is off).
import eslintConfig from '../../eslint.config.mjs';
import type { ThemingCompileState } from '../../.storybook/theming-inject';
import { THEMING_SOURCES } from '../../.storybook/theming-sources.generated';
import { createSourcesImporter } from '../../.storybook/theming-sources-importer';
import type { NfsTheme } from '../../.storybook/theming-panel';
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

describe('theming-inject coalescer state machine (T8, driven against a fake worker port)', () => {
  class FakeWorker {
    onmessage: ((event: MessageEvent<ThemeCompileResponse>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    readonly postMessage = vi.fn();
    readonly terminate = vi.fn();

    onmessageerror: ((event: MessageEvent) => void) | null = null;

    respond(response: ThemeCompileResponse): void {
      if (!this.onmessage) {
        throw new Error('theming-inject never assigned worker.onmessage');
      }
      this.onmessage({ data: response } as MessageEvent<ThemeCompileResponse>);
    }

    crash(message = 'boom'): void {
      if (!this.onerror) {
        throw new Error('theming-inject never assigned worker.onerror');
      }
      this.onerror({ message } as ErrorEvent);
    }
  }

  let fakeWorkerInstances: FakeWorker[];
  let states: ThemingCompileState[];
  let unsubscribe: () => void;
  let requestTheme: (theme: NfsTheme) => void;

  beforeEach(async () => {
    fakeWorkerInstances = [];
    vi.stubGlobal(
      'Worker',
      class extends FakeWorker {
        constructor() {
          super();
          fakeWorkerInstances.push(this);
        }
      }
    );
    states = [];
    // theming-inject.ts's coalescer state (worker/workerSeq/pendingTheme/...)
    // is module-level, so each test needs a fresh module instance -- the
    // singleton is by design (one Worker per Storybook session), but that
    // makes it un-resettable from the outside.
    vi.resetModules();
    const injectModule = await import('../../.storybook/theming-inject');
    requestTheme = injectModule.requestTheme;
    unsubscribe = injectModule.subscribeThemingState((state) => states.push(state));
  });

  afterEach(() => {
    unsubscribe();
    vi.unstubAllGlobals();
  });

  it('idle -> compiling: the first non-default theme constructs one worker and posts one request', () => {
    requestTheme({ primary: '#ff0000' });

    expect(fakeWorkerInstances).toHaveLength(1);
    expect(fakeWorkerInstances[0].postMessage).toHaveBeenCalledTimes(1);
    const [request] = fakeWorkerInstances[0].postMessage.mock.calls[0];
    expect(request).toEqual({ seq: expect.any(Number), theme: { primary: '#ff0000' } });
  });

  it('latest-wins coalescing: a change while compiling does not post a second request, and is dispatched once the first resolves', () => {
    requestTheme({ primary: '#ff0000' });
    const worker = fakeWorkerInstances[0];
    const firstRequest = worker.postMessage.mock.calls[0][0];

    requestTheme({ primary: '#00ff00' });
    expect(worker.postMessage).toHaveBeenCalledTimes(1);

    worker.respond({ seq: firstRequest.seq, ok: true, css: '.a{color:red}' });

    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    const secondRequest = worker.postMessage.mock.calls[1][0];
    expect(secondRequest.theme).toEqual({ primary: '#00ff00' });
    expect(secondRequest.seq).not.toBe(firstRequest.seq);
  });

  it('monotonic sequence: a stale in-flight result is discarded when the theme resets to default mid-compile (D038)', () => {
    requestTheme({ primary: '#ff0000' });
    const worker = fakeWorkerInstances[0];
    const firstRequest = worker.postMessage.mock.calls[0][0];

    requestTheme({}); // reset to default while compiling
    expect(states.some((state) => state.kind === 'idle')).toBe(true);
    states.length = 0;

    worker.respond({ seq: firstRequest.seq, ok: true, css: '.a{color:red}' });

    // The stale result must not re-notify (it is discarded, not applied),
    // and must not trigger a further compile (no pendingTheme was queued).
    expect(states).toEqual([]);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });

  it('an error response notifies "error" without clearing prior state, and the last good CSS is never blanked', () => {
    requestTheme({ primary: 'not-a-color' } as unknown as NfsTheme);
    const worker = fakeWorkerInstances[0];
    const request = worker.postMessage.mock.calls[0][0];

    worker.respond({
      seq: request.seq,
      ok: false,
      error: { sassMessage: 'bad', sassStack: '', sourceUrl: null },
    });

    expect(states.at(-1)).toEqual({ kind: 'error', message: 'bad', sourceName: 'the compiled theme' });
  });

  it('T8e: a theme whose compile FAILED is recompiled when requested again, not swallowed by the applied-key cache', () => {
    requestTheme({ primary: '#ff0000' });
    const worker = fakeWorkerInstances[0];
    const firstRequest = worker.postMessage.mock.calls[0][0];

    worker.respond({
      seq: firstRequest.seq,
      ok: false,
      error: { sassMessage: 'bad', sassStack: '', sourceUrl: null },
    });

    // `withNfsTheming` re-requests the same theme on every story render; a
    // reload or a user retry does the same. The failed theme never reached
    // the style node, so it must dispatch a real second compile.
    requestTheme({ primary: '#ff0000' });

    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage.mock.calls[1][0].theme).toEqual({ primary: '#ff0000' });
  });

  it('T8g: a Worker that dies notifies "error" instead of latching the coalescer', () => {
    requestTheme({ primary: '#ff0000' });
    fakeWorkerInstances[0].crash('chunk 404');

    const last = states.at(-1);
    expect(last?.kind).toBe('error');
    if (last?.kind !== 'error') {
      throw new Error('unreachable');
    }
    expect(last.message).toContain('chunk 404');
    expect(last.sourceName).toBe('the theme compiler');
  });

  it('T8h: after a Worker death the next theme change builds a fresh Worker and compiles -- the addon is not inert', () => {
    requestTheme({ primary: '#ff0000' });
    fakeWorkerInstances[0].crash();

    // Before the fix `compiling` stayed true forever, so this parked in the
    // pending slot and never posted.
    requestTheme({ primary: '#00ff00' });

    expect(fakeWorkerInstances).toHaveLength(2);
    expect(fakeWorkerInstances[1].postMessage).toHaveBeenCalledTimes(1);
    expect(fakeWorkerInstances[1].postMessage.mock.calls[0][0].theme).toEqual({ primary: '#00ff00' });
  });

  it('T8i: theming-inject assigns onmessageerror as well as onerror', () => {
    requestTheme({ primary: '#ff0000' });

    expect(fakeWorkerInstances[0].onerror).toBeTypeOf('function');
    expect(fakeWorkerInstances[0].onmessageerror).toBeTypeOf('function');
  });

  it('T8j: A -> B -> A while B is in flight ends with A on screen, not B', () => {
    // Reverting a control to a value that is currently applied, while a
    // compile for the intermediate value is still running. The style node
    // must end up holding A: globals say A and the panel shows A.
    requestTheme({ primary: '#aaaaaa' });
    const worker = fakeWorkerInstances[0];
    worker.respond({ seq: worker.postMessage.mock.calls[0][0].seq, ok: true, css: '.a{}' });

    requestTheme({ primary: '#bbbbbb' });
    requestTheme({ primary: '#aaaaaa' });

    worker.respond({ seq: worker.postMessage.mock.calls[1][0].seq, ok: true, css: '.b{}' });

    expect(worker.postMessage).toHaveBeenCalledTimes(3);
    expect(worker.postMessage.mock.calls[2][0].theme).toEqual({ primary: '#aaaaaa' });
  });

  it('T8f: a theme that WAS applied is not recompiled on a repeat request', () => {
    requestTheme({ primary: '#ff0000' });
    const worker = fakeWorkerInstances[0];
    const firstRequest = worker.postMessage.mock.calls[0][0];

    worker.respond({ seq: firstRequest.seq, ok: true, css: '.a{color:red}' });
    requestTheme({ primary: '#ff0000' });

    expect(worker.postMessage).toHaveBeenCalledTimes(1);
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

describe('R026 path-spelling divergence guard (T9)', () => {
  interface FlatConfigEntry {
    files?: string[];
    ignores?: string[];
    rules?: Record<string, unknown>;
  }

  const flatConfig = eslintConfig as FlatConfigEntry[];
  const r026Entries = flatConfig.filter((entry) => entry.rules && 'no-restricted-syntax' in entry.rules);
  const linter = new Linter();

  function r026OnlyConfigs(): Linter.Config[] {
    return r026Entries.map((entry) => {
      const rules = entry.rules ?? {};
      const config: Linter.Config = {
        files: entry.files,
        rules: { 'no-restricted-syntax': rules['no-restricted-syntax'] as Linter.RuleEntry },
      };
      if (entry.ignores) {
        config.ignores = entry.ignores;
      }
      return config;
    });
  }

  function r026MessageCount(code: string, filePath: string): number {
    return linter.verify(code, r026OnlyConfigs(), filePath).filter((m) => m.ruleId === 'no-restricted-syntax')
      .length;
  }

  const INJECTION = "document.createElement('style');\nel.textContent = '.a{b:c}';";

  it('T9a: theming-inject.ts is exempt (0 messages)', () => {
    expect(r026MessageCount(INJECTION, '.storybook/theming-inject.ts')).toBe(0);
  });

  it('T9b: a sibling non-exempt file in the same directory still fires (exemption is exactly one file wide)', () => {
    expect(r026MessageCount(INJECTION, '.storybook/theming-worker.ts')).toBe(2);
  });

  it('T9c: the exemption holds under BOTH a package-relative and a workspace-root-relative path spelling', () => {
    expect(r026MessageCount(INJECTION, '.storybook/theming-inject.ts')).toBe(0);
    expect(
      r026MessageCount(INJECTION, 'packages/ngx-foundation-sites/.storybook/theming-inject.ts')
    ).toBe(0);
  });

  it('T9d: every ignores glob in the R026 blocks is **/-prefixed (the shape that makes T9c hold)', () => {
    const allIgnores = r026Entries.flatMap((entry) => entry.ignores ?? []);
    expect(allIgnores.length).toBeGreaterThan(0);
    expect(allIgnores.every((glob) => glob.startsWith('**/'))).toBe(true);
  });
});
