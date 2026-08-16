// R021 lane 2 (`test-browser`, real Chromium): the things jsdom cannot
// prove -- browser sass build resolution, the real BROWSER build's compile
// and error-serialization pipeline, the R008 cascade in both insertion
// orders plus a layered-only control, and injection idempotency. See
// research/10-r021-verification-design.md section 4 ("Lane 2") for the
// locked B1-B5 assertion table this file implements.
//
// Placed under src/storybook/, not .storybook/ -- same discovery-glob
// constraint T01 found for the `test` target: `nx run
// ngx-foundation-sites:test-browser --listTests` only walks `src/` (verified
// before writing this file; only the pre-existing
// nfs-button.hydration-modes.browser.spec.ts was discovered). Mirrors T01's
// placement and its `theming-panel.spec.ts` / `theming-worker.spec.ts`
// precedent.
//
// Deviation from the plan's literal "real Worker" framing, verified against
// the real `nx run ngx-foundation-sites:test-browser` pipeline before
// writing these assertions: constructing `new Worker(new URL('./theming-
// worker.ts', import.meta.url), { type: 'module' })` from a spec in THIS
// project's generated Vitest-browser harness hangs indefinitely whenever the
// worker module imports `sass` -- confirmed NOT a resolution or cold-start
// issue (a trivial worker with no imports round-trips fine; a bare `import
// 'sass')` on the main thread, exercised below, resolves and runs
// correctly; raising the test timeout to 60s did not help). This is an
// infra-level gap in the current Angular/Vite/Vitest worker-bundling
// pipeline for this library's unit-test target, not something a test can
// route around. Root-caused one adjacent piece of it: the bare `sass`
// import ALSO failed on the main thread until `vitest.browser.config.ts`
// (this task) added a `resolve.alias` pointing straight at the package's
// browser entry file, because this harness's Vite dev server was resolving
// the bare `sass` specifier to its `node` conditional export (which requires
// Node's `util` module; Vite's browser-external stub for it lacks
// `.inspect`, crashing `sass.dart.js`'s custom-inspect setup on import) --
// that fix does not reach the separate worker-bundling resolution path.
//
// So: every assertion below that needs the addon's real compiled CSS drives
// `.storybook/theming-worker.ts`'s REAL exported compile pipeline via a
// direct import (identical technique to T01's jsdom spec: stub
// `globalThis.postMessage`, import the module -- which unconditionally sets
// `globalThis.onmessage` -- and invoke the real handler), which in THIS file
// runs under real Chromium and therefore still exercises the real BROWSER
// (dart2js) sass build (proven by B1), not a re-implementation. Only
// `theming-inject.ts`'s OWN internal `new Worker(...)` construction (B3)
// needed a substitute: `globalThis.Worker` is stubbed with a class whose
// `postMessage` drives the same real compile pipeline and replies
// asynchronously, so `theming-inject.ts`'s real `injectCss`/idempotency
// logic runs unmodified against real DOM/CSSOM with real compiled CSS --
// only the cross-thread transport is faked, not the addon logic or the
// compile result.
import type { NfsTheme } from '../../.storybook/theming-panel';
import type { ThemeCompileRequest, ThemeCompileResponse } from '../../.storybook/theming-worker';
import type { ThemingCompileState } from '../../.storybook/theming-inject';

// B5 fixture rule: disable transitions before any computed-colour read.
// Foundation's button rules carry a 0.25s background-color transition
// (research/05 section 4), so a read taken mid-transition would be flaky.
// R026 bans `document.createElement('style')` even in specs (only the
// innerHTML/textContent DOM-fixture half is exempted here); insertAdjacentHTML
// is the sanctioned fixture-injection route the exemption's comment points at.
document.head.insertAdjacentHTML('beforeend', '<style>*, *::before, *::after { transition: none !important }</style>');

const postMessageCalls: ThemeCompileResponse[] = [];

async function compileReal(seq: number, theme: NfsTheme): Promise<ThemeCompileResponse> {
  (globalThis as unknown as { postMessage: (message: ThemeCompileResponse) => void }).postMessage = (message) =>
    postMessageCalls.push(message);
  if (!(globalThis as unknown as { onmessage?: unknown }).onmessage) {
    // Side effect: sets globalThis.onmessage to the real handler.
    await import('../../.storybook/theming-worker');
  }
  postMessageCalls.length = 0;
  const onmessage = (globalThis as unknown as { onmessage: ((event: MessageEvent<ThemeCompileRequest>) => void) | null }).onmessage;
  if (!onmessage) {
    throw new Error('theming-worker did not register globalThis.onmessage');
  }
  onmessage({ data: { seq, theme } } as MessageEvent<ThemeCompileRequest>);
  return postMessageCalls[0];
}

async function sha256Prefix16(value: string): Promise<string> {
  const digestBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digestBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

describe('sass -- browser build resolution (B1)', () => {
  it('resolves the browser (dart2js) sass build, not the Node build: compile() throws the Node-only message', async () => {
    // Node build's compile() throws a filesystem error ("no such file or
    // directory", per research/10 Q1); the browser build's compile() throws
    // this specific "Node.js only" message instead -- the differential is
    // what proves which build this lane resolved. This is a plain `import
    // 'sass'`, exercised the same way the addon's own `.storybook/*.ts`
    // modules resolve it -- not a probe-only importer.
    const sass = await import('sass');
    expect(() => sass.compile('nope.scss')).toThrow('only available in Node.js.');
  });
});

describe('theming-worker -- real browser-build compile pipeline (B4)', () => {
  it('a real theme in yields the fitness-digest CSS out: 5839 bytes, sha256[0:16] 49bfb1a2e67bf91a', async () => {
    const response = await compileReal(1, {});
    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error('unreachable');
    }

    const bytes = new TextEncoder().encode(response.css).length;
    const digest = await sha256Prefix16(response.css);

    expect(bytes).toBe(5839);
    expect(digest).toBe('49bfb1a2e67bf91a');
  });

  it('a bad value in yields the serialized plain error object out, with sassMessage/sourceUrl intact', async () => {
    const response = await compileReal(2, { primary: 'not-a-color' } as unknown as NfsTheme);
    expect(response.ok).toBe(false);
    if (response.ok) {
      throw new Error('unreachable');
    }

    expect(response.error.sassMessage).toBe('$color: not-a-color is not a color.');
    expect(response.error.sourceUrl).toBe('fnd:/scss/components/_button.scss');
  });
});

describe("R008 cascade: layered library defaults vs. the addon's unlayered themed output (B2)", () => {
  // THEMEABLE_MODULES compiles exactly `nfs:/button` (verified against
  // theming-sources.generated.ts), so compiling the default (empty) theme's
  // output IS the same `@include nfs-button.theme;` bytes nfs-button.scss
  // wraps in `@layer nfs-defaults` -- wrapping it here faithfully reproduces
  // the real shipped default, sourced through the addon's own compile path
  // rather than a re-implementation (research/10 already proved this digest
  // is identical across every producer, including this one).
  let defaultCss: string;
  let themedCss: string;
  const createdNodes: ChildNode[] = [];

  beforeAll(async () => {
    const defaultResponse = await compileReal(1, {});
    const themedResponse = await compileReal(2, { primary: '#ff0000' });
    if (!defaultResponse.ok || !themedResponse.ok) {
      throw new Error('setup compile failed');
    }
    defaultCss = defaultResponse.css;
    themedCss = themedResponse.css;
  });

  afterEach(() => {
    createdNodes.splice(0).forEach((node) => node.remove());
  });

  function appendStyle(cssText: string): void {
    // R026 bans `document.createElement('style')` even in specs;
    // insertAdjacentHTML is the sanctioned fixture-injection route.
    document.head.insertAdjacentHTML('beforeend', `<style>${cssText}</style>`);
    createdNodes.push(document.head.lastElementChild as HTMLStyleElement);
  }

  function appendLayeredDefaults(): void {
    appendStyle(`@layer nfs-defaults {\n${defaultCss}\n}`);
  }

  function appendUnlayeredThemed(): void {
    appendStyle(themedCss);
  }

  function appendButtonElement(): HTMLButtonElement {
    const el = document.createElement('button');
    el.className = 'button';
    document.body.appendChild(el);
    createdNodes.push(el);
    return el;
  }

  it('layered-only control: the layered defaults DO apply (proves this lane keeps @layer, unlike jsdom which drops it)', () => {
    appendLayeredDefaults();
    const el = appendButtonElement();

    expect(getComputedStyle(el).backgroundColor).toBe('rgb(23, 121, 186)'); // #1779ba
  });

  it('layered defaults inserted FIRST, then the unlayered themed rule: the unlayered rule still wins', () => {
    appendLayeredDefaults();
    appendUnlayeredThemed();
    const el = appendButtonElement();

    expect(getComputedStyle(el).backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('unlayered themed rule inserted FIRST, then the layered defaults: the unlayered rule still wins (order-independent)', () => {
    appendUnlayeredThemed();
    appendLayeredDefaults();
    const el = appendButtonElement();

    expect(getComputedStyle(el).backgroundColor).toBe('rgb(255, 0, 0)');
  });
});

describe('theming-inject -- injection idempotency (B3)', () => {
  class RealCompileFakeWorker {
    onmessage: ((event: MessageEvent<ThemeCompileResponse>) => void) | null = null;
    postMessage(request: ThemeCompileRequest): void {
      compileReal(request.seq, request.theme).then((response) => {
        this.onmessage?.({ data: response } as MessageEvent<ThemeCompileResponse>);
      });
    }
    terminate(): void {
      // no-op: nothing to tear down for the fake transport.
    }
  }

  afterEach(() => {
    document.getElementById('nfs-theming')?.remove();
    vi.unstubAllGlobals();
  });

  it('three sequential real-compile round trips leave exactly one #nfs-theming node, with the last CSS applied', async () => {
    vi.stubGlobal('Worker', RealCompileFakeWorker);
    // theming-inject.ts's coalescer state (worker/workerSeq/pendingTheme) is
    // a module-level singleton (T01's coalescer test hit the same thing) --
    // reset so this test gets a fresh instance bound to the stubbed Worker.
    vi.resetModules();
    const { requestTheme, subscribeThemingState } = await import('../../.storybook/theming-inject');

    function applyAndWaitForIdle(theme: NfsTheme): Promise<void> {
      return new Promise((resolve) => {
        const unsubscribe = subscribeThemingState((state: ThemingCompileState) => {
          if (state.kind === 'idle') {
            unsubscribe();
            resolve();
          }
        });
        requestTheme(theme);
      });
    }

    await applyAndWaitForIdle({ primary: '#111111' });
    await applyAndWaitForIdle({ primary: '#222222' });
    await applyAndWaitForIdle({ primary: '#333333' });

    const styleNodes = document.head.querySelectorAll('#nfs-theming');
    expect(styleNodes).toHaveLength(1);
    expect(styleNodes[0].textContent).toContain('#333333');
    expect(styleNodes[0].textContent).not.toContain('#111111');
    expect(styleNodes[0].textContent).not.toContain('#222222');
  });
});
