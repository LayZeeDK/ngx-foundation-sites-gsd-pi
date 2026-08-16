import type { Decorator } from '@storybook/angular';
import { getChannel } from 'storybook/preview-api';
import {
  NFS_THEMING_STATE_EVENT,
  NFS_THEMING_STATE_REQUEST_EVENT,
  type ThemingCompileState,
} from './theming-channel';
import type { NfsTheme } from './theming-panel';
import type { ThemeCompileRequest, ThemeCompileResponse } from './theming-worker';

// D035 part d/e: this module runs in the PREVIEW iframe (via the
// `withNfsTheming` decorator wired into preview.ts), never in the manager --
// that is where the story's real DOM lives and where the compiled CSS must
// apply. It lazily constructs a single Web Worker on the first non-default
// theme, coalesces rapid changes into a single-slot latest-wins queue (no
// debounce), and injects into one shared `<style id="nfs-theming">` node.

// Re-exported so existing importers (and the R021 lane-1/lane-2 specs) keep
// resolving the state union from this module after it moved to the shared
// manager<->preview contract.
export type { ThemingCompileState } from './theming-channel';

type ThemingStateListener = (state: ThemingCompileState) => void;

const STYLE_ELEMENT_ID = 'nfs-theming';
const COMPILING_INDICATOR_DELAY_MS = 300;

let styleElement: HTMLStyleElement | null = null;
let styleSeq = 0;

function getOrCreateStyleElement(): HTMLStyleElement {
  if (styleElement && styleElement.isConnected) {
    return styleElement;
  }

  const existing = document.getElementById(STYLE_ELEMENT_ID);
  if (existing instanceof HTMLStyleElement) {
    styleElement = existing;
    return existing;
  }

  const created = document.createElement('style');
  created.id = STYLE_ELEMENT_ID;
  created.setAttribute('data-nfs-seq', '0');
  document.head.appendChild(created);
  styleElement = created;
  return created;
}

function injectCss(css: string): void {
  const element = getOrCreateStyleElement();
  styleSeq += 1;
  element.textContent = css;
  element.setAttribute('data-nfs-seq', String(styleSeq));
}

function clearInjectedCss(): void {
  const element = getOrCreateStyleElement();
  if (element.textContent === '') {
    return;
  }
  styleSeq += 1;
  element.textContent = '';
  element.setAttribute('data-nfs-seq', String(styleSeq));
}

let worker: Worker | null = null;
let workerSeq = 0;
let compiling = false;
let discardCurrentResult = false;
let pendingTheme: NfsTheme | null = null;
let compilingIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
// The last theme `requestTheme` accepted -- set at REQUEST time, which is what
// makes the coalescer's latest-wins property hold. `withNfsTheming` re-requests
// on every story render, so this is the guard that stops a render storm from
// queueing redundant compiles.
//
// It must be set at request time, not on apply: a request that arrives while a
// different theme is mid-compile has to compare against what was last ASKED
// for, otherwise reverting to the currently-applied theme mid-compile compares
// equal, returns early, and the in-flight theme lands on top of it.
//
// The one case where that is wrong is a theme that never made it to the screen,
// so `clearRequestedThemeKeyOn` releases it when a compile fails or the Worker
// dies -- and only when it still names the theme that failed, so a newer
// request already queued behind it is not recompiled.
let lastRequestedThemeKey: string | null = null;
// Bookkeeping only, never a guard: which theme the Worker is currently
// compiling, so a failure knows which key to release.
let inFlightThemeKey: string | null = null;

const listeners = new Set<ThemingStateListener>();

// The panel unmounts on every addon-tab switch and remounts at `idle`, so the
// preview holds the authoritative state and replays it on request.
let currentState: ThemingCompileState = { kind: 'idle' };
let stateReplayRegistered = false;

/**
 * Registers the replay responder once a channel exists. Called from the
 * decorator rather than at module scope because `getChannel()` is null until
 * Storybook has wired the preview up.
 */
function ensureStateReplay(): void {
  if (stateReplayRegistered) {
    return;
  }

  const channel = getChannel();
  if (!channel) {
    return;
  }

  channel.on(NFS_THEMING_STATE_REQUEST_EVENT, () => {
    channel.emit(NFS_THEMING_STATE_EVENT, currentState);
  });
  stateReplayRegistered = true;
}

function notify(state: ThemingCompileState): void {
  currentState = state;
  listeners.forEach((listener) => listener(state));

  // R009: the panel carries `compiling`/`error` in `data-nfs-panel-state` and
  // shows `sassMessage` on error. The panel is manager-side and this module is
  // preview-side, so the channel is the only route. `getChannel()` is null
  // outside a real preview (the jsdom lane drives `requestTheme` directly), so
  // this degrades to a no-op there instead of throwing.
  getChannel()?.emit(NFS_THEMING_STATE_EVENT, state);
}

export function subscribeThemingState(listener: ThemingStateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function themeKey(theme: NfsTheme): string {
  return (Object.keys(theme) as (keyof NfsTheme)[])
    .sort()
    .map((key) => `${key}:${theme[key]}`)
    .join('|');
}

/**
 * Releases the coalescer after the Worker itself dies, rather than after a
 * reply. `compiling` is otherwise cleared only in `handleWorkerMessage`, which
 * a dead Worker never reaches -- so without this every later `requestTheme`
 * parks in the `if (compiling)` queue forever and the addon is silently inert
 * for the rest of the session.
 *
 * The queued theme is dropped rather than retried: if the Worker cannot start
 * at all (a 404'd chunk, a CSP `worker-src` refusal), retrying it here would
 * spin. The next control change constructs a fresh Worker and tries again.
 */
/**
 * Releases `lastRequestedThemeKey` when the theme it names never reached the
 * screen, so an identical re-request retries instead of short-circuiting. Only
 * when it still names `failedKey`: if a newer theme was requested meanwhile it
 * is already queued, and clearing would compile it twice.
 */
function clearRequestedThemeKeyOn(failedKey: string | null): void {
  if (failedKey !== null && lastRequestedThemeKey === failedKey) {
    lastRequestedThemeKey = null;
  }
}

function failWorker(detail: string): void {
  // `onmessageerror` fires on a Worker that is still alive, unlike `onerror`;
  // without this the handle is dropped while the thread keeps running, and the
  // next control change spawns a second one carrying its own sass payload.
  worker?.terminate();
  worker = null;
  clearRequestedThemeKeyOn(inFlightThemeKey);

  if (compilingIndicatorTimer !== null) {
    clearTimeout(compilingIndicatorTimer);
    compilingIndicatorTimer = null;
  }

  compiling = false;
  discardCurrentResult = false;
  inFlightThemeKey = null;
  pendingTheme = null;

  notify({
    kind: 'error',
    message: `${detail} Live theming is unavailable until you change a control to retry, or reload the page.`,
    sourceName: 'the theme compiler',
  });
}

function ensureWorker(): Worker | null {
  if (worker) {
    return worker;
  }

  let created: Worker;
  try {
    created = new Worker(new URL('./theming-worker.ts', import.meta.url), { type: 'module' });
  } catch (error) {
    // `new Worker()` throws synchronously on a SecurityError (a restrictive
    // CSP, a cross-origin script URL). This runs inside the `withNfsTheming`
    // decorator, so an uncaught throw here takes down the whole story render,
    // not just theming -- degrade to "theme unavailable" instead.
    failWorker(
      `The theme compiler could not be created (${error instanceof Error ? error.message : String(error)}).`
    );
    return null;
  }

  created.onmessage = (event: MessageEvent<ThemeCompileResponse>) => {
    handleWorkerMessage(event.data);
  };
  created.onerror = (event: ErrorEvent) => {
    failWorker(`The theme compiler crashed (${event.message || 'no error message'}).`);
  };
  created.onmessageerror = () => {
    failWorker('The theme compiler sent a reply that could not be deserialised.');
  };
  worker = created;
  return created;
}

function friendlySourceName(sourceUrl: string | null): string {
  if (!sourceUrl) {
    return 'the compiled theme';
  }
  const lastSegment = sourceUrl.slice(sourceUrl.lastIndexOf('/') + 1);
  return lastSegment.length > 0 ? lastSegment : sourceUrl;
}

function handleWorkerMessage(response: ThemeCompileResponse): void {
  if (compilingIndicatorTimer !== null) {
    clearTimeout(compilingIndicatorTimer);
    compilingIndicatorTimer = null;
  }
  compiling = false;

  const compiledThemeKey = inFlightThemeKey;
  inFlightThemeKey = null;

  const shouldApply = response.seq === workerSeq && !discardCurrentResult;
  discardCurrentResult = false;

  if (shouldApply) {
    if (response.ok) {
      // D035 part e: the last good CSS is never cleared on error -- achieved
      // here simply by never overwriting the style node on the error branch.
      injectCss(response.css);
      notify({ kind: 'idle' });
    } else {
      clearRequestedThemeKeyOn(compiledThemeKey);
      notify({
        kind: 'error',
        message: response.error.sassMessage,
        sourceName: friendlySourceName(response.error.sourceUrl),
      });
    }
  }

  if (pendingTheme !== null) {
    const nextTheme = pendingTheme;
    pendingTheme = null;
    startCompile(nextTheme);
  }
}

function startCompile(theme: NfsTheme): void {
  // Resolved before any state is mutated: a Worker that cannot be constructed
  // must leave the coalescer exactly as it found it (`failWorker` has already
  // reported and reset).
  const activeWorker = ensureWorker();
  if (activeWorker === null) {
    return;
  }

  compiling = true;
  workerSeq += 1;
  inFlightThemeKey = themeKey(theme);
  const request: ThemeCompileRequest = { seq: workerSeq, theme };

  compilingIndicatorTimer = setTimeout(() => {
    if (compiling) {
      notify({ kind: 'compiling' });
    }
  }, COMPILING_INDICATOR_DELAY_MS);

  activeWorker.postMessage(request);
}

/**
 * Single-slot latest-wins coalescer, no debounce timer (D035 part e).
 * Rapid changes collapse into `pendingTheme`, which is dispatched the moment
 * the in-flight compile resolves; in-flight compiles are superseded, never
 * cancelled/terminated.
 */
export function requestTheme(theme: NfsTheme): void {
  const key = themeKey(theme);

  if (key === lastRequestedThemeKey) {
    return;
  }
  lastRequestedThemeKey = key;

  if (key === '') {
    // D038: the default theme is never compiled -- it is already on screen
    // as the library's static `@layer nfs-defaults` CSS. If a compile for a
    // now-stale non-default theme is still in flight, its result must not
    // land after this reset.
    pendingTheme = null;
    if (compiling) {
      discardCurrentResult = true;
      inFlightThemeKey = null;
    }
    clearInjectedCss();
    notify({ kind: 'idle' });
    return;
  }

  if (compiling) {
    pendingTheme = theme;
    return;
  }

  startCompile(theme);
}

// D032: preview-side entry point, wired into `.storybook/preview.ts`'s
// `decorators` alongside T01's `initialGlobals` -- Storybook's `useGlobals()`
// already syncs the manager-side panel's writes (T01) to this preview
// iframe's `context.globals`, so no custom channel messaging is needed here.
export const withNfsTheming: Decorator = (storyFn, context) => {
  ensureStateReplay();
  const theme = (context.globals as { nfsTheme?: NfsTheme }).nfsTheme ?? {};
  requestTheme(theme);
  return storyFn();
};
