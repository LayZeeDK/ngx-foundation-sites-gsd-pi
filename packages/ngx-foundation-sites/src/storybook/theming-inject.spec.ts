// R021 lane 1 (`test`, jsdom): `requestPresetProbe`'s Worker-orchestration
// half (MEM101) -- sharing the compile Worker, memoising the request, and
// keeping a probe reply from touching the compile coalescer's state --
// driven against a fake worker port.
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
