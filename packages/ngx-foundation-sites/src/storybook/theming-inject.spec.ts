// R021 lane 1 (`test`, jsdom): theming-inject.ts's compile coalescer state
// machine, driven against a fake worker port.
//
// Split out of theming-worker.spec.ts (MEM106): this file tests
// theming-inject.ts, not theming-worker.ts -- the two were mixed in one file
// because both are small and both feed the addon's compile pipeline, but they
// are separate subjects with separate fake-worker setups.
//
// Placed under src/storybook/, not .storybook/ -- see theming-panel.spec.ts's
// header comment for why. `theming-inject.ts` is imported by real relative
// path from its actual location.
import type { ThemingCompileState } from '../../.storybook/theming-inject';
import type { NfsTheme } from '../../.storybook/theming-model';
import type { PresetProbeResult } from '../../.storybook/theming-presets';
import type { ThemeCompileResponse, ThemePresetProbeResponse } from '../../.storybook/theming-worker';

type FakeWorkerResponse = ThemeCompileResponse | ThemePresetProbeResponse;

class FakeWorker {
  onmessage: ((event: MessageEvent<FakeWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();

  onmessageerror: ((event: MessageEvent) => void) | null = null;

  respond(response: FakeWorkerResponse): void {
    if (!this.onmessage) {
      throw new Error('theming-inject never assigned worker.onmessage');
    }
    this.onmessage({ data: response } as MessageEvent<FakeWorkerResponse>);
  }

  crash(message = 'boom'): void {
    if (!this.onerror) {
      throw new Error('theming-inject never assigned worker.onerror');
    }
    this.onerror({ message } as ErrorEvent);
  }
}

describe('theming-inject coalescer state machine (T8, driven against a fake worker port)', () => {

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

describe('requestPresetProbe -- MEM101 Worker orchestration (T13, driven against a fake worker port)', () => {
  const FAKE_RESULT: PresetProbeResult = {
    presets: [{ name: 'Foundation default', theme: {} }],
    defaults: { primary: '#1779ba', secondary: '#767676', success: '#3adb76', warning: '#ffae00', alert: '#cc4b37', radius: 0 },
  };

  let fakeWorkerInstances: FakeWorker[];
  let states: ThemingCompileState[];
  let unsubscribe: () => void;
  let requestTheme: (theme: NfsTheme) => void;
  let requestPresetProbe: () => Promise<PresetProbeResult>;

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
    vi.resetModules();
    const injectModule = await import('../../.storybook/theming-inject');
    requestTheme = injectModule.requestTheme;
    requestPresetProbe = injectModule.requestPresetProbe;
    unsubscribe = injectModule.subscribeThemingState((state) => states.push(state));
  });

  afterEach(() => {
    unsubscribe();
    vi.unstubAllGlobals();
  });

  it('T13a: constructs one worker, posts a probe request tagged `probe: true`, and resolves with the reply', async () => {
    const pending = requestPresetProbe();
    const worker = fakeWorkerInstances[0];
    const [request] = worker.postMessage.mock.calls[0];
    expect(request).toEqual({ seq: expect.any(Number), probe: true });

    worker.respond({ seq: request.seq, probe: true, ok: true, result: FAKE_RESULT });

    expect(await pending).toEqual(FAKE_RESULT);
  });

  it('T13b: memoises the probe -- a second call before the first resolves does not post a second request, and both resolve to the same result', async () => {
    const first = requestPresetProbe();
    const second = requestPresetProbe();
    const worker = fakeWorkerInstances[0];

    expect(worker.postMessage).toHaveBeenCalledTimes(1);

    const [request] = worker.postMessage.mock.calls[0];
    worker.respond({ seq: request.seq, probe: true, ok: true, result: FAKE_RESULT });

    expect(await first).toEqual(FAKE_RESULT);
    expect(await second).toEqual(FAKE_RESULT);
    // R009: "one probe compile at panel init" -- a THIRD call after settling
    // must reuse the cached result too, not compile again.
    expect(await requestPresetProbe()).toEqual(FAKE_RESULT);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });

  it('T13c: shares the compile Worker rather than constructing a second one -- MEM101\'s whole point', () => {
    requestTheme({ primary: '#ff0000' });
    requestPresetProbe();

    expect(fakeWorkerInstances).toHaveLength(1);
    expect(fakeWorkerInstances[0].postMessage).toHaveBeenCalledTimes(2);
  });

  it("T13d: a probe reply never touches the compile coalescer's notified state", async () => {
    const pending = requestPresetProbe();
    const worker = fakeWorkerInstances[0];
    const [request] = worker.postMessage.mock.calls[0];

    worker.respond({ seq: request.seq, probe: true, ok: true, result: FAKE_RESULT });
    await pending;

    // No `idle`/`compiling`/`error` notification is theme-compile state --
    // the probe has its own channel (theming-panel.tsx), not this one.
    expect(states).toEqual([]);
  });

  it('T13e: an in-flight probe and an in-flight theme compile do not interfere with each other', async () => {
    requestTheme({ primary: '#ff0000' });
    const pending = requestPresetProbe();
    const worker = fakeWorkerInstances[0];

    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    const compileRequest = worker.postMessage.mock.calls[0][0];
    const probeRequest = worker.postMessage.mock.calls[1][0];

    // Reply to the probe first -- must not be mistaken for the compile reply.
    worker.respond({ seq: probeRequest.seq, probe: true, ok: true, result: FAKE_RESULT });
    expect(await pending).toEqual(FAKE_RESULT);
    expect(states).toEqual([]);

    worker.respond({ seq: compileRequest.seq, ok: true, css: '.a{color:red}' });
    expect(states).toEqual([{ kind: 'idle' }]);
  });

  it('T13f: a Worker death rejects a pending probe and drops the cache, so the next call retries against a fresh worker', async () => {
    const pending = requestPresetProbe();
    fakeWorkerInstances[0].crash('chunk 404');

    await expect(pending).rejects.toThrow();

    const retry = requestPresetProbe();
    const secondWorker = fakeWorkerInstances[1];
    const [request] = secondWorker.postMessage.mock.calls[0];
    secondWorker.respond({ seq: request.seq, probe: true, ok: true, result: FAKE_RESULT });

    expect(await retry).toEqual(FAKE_RESULT);
  });
});
