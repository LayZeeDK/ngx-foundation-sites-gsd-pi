import type { Decorator } from '@storybook/angular';
import type { NfsTheme } from './theming-panel';
import type { ThemeCompileRequest, ThemeCompileResponse } from './theming-worker';

// D035 part d/e: this module runs in the PREVIEW iframe (via the
// `withNfsTheming` decorator wired into preview.ts), never in the manager --
// that is where the story's real DOM lives and where the compiled CSS must
// apply. It lazily constructs a single Web Worker on the first non-default
// theme, coalesces rapid changes into a single-slot latest-wins queue (no
// debounce), and injects into one shared `<style id="nfs-theming">` node.

export type ThemingCompileState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'compiling' }
  | { readonly kind: 'error'; readonly message: string; readonly sourceName: string };

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
// Set ONLY once CSS has actually landed in the style node (or been cleared
// back to the default theme). A compile that errors leaves this untouched, so
// re-requesting the same theme -- which `withNfsTheming` does on every story
// render, and which is also how a user retries -- dispatches a fresh compile
// instead of short-circuiting on a theme that was never applied.
let lastAppliedThemeKey: string | null = null;
// The theme `startCompile` last handed to the Worker, promoted to
// `lastAppliedThemeKey` only on a successful, non-discarded response.
let inFlightThemeKey: string | null = null;

const listeners = new Set<ThemingStateListener>();

function notify(state: ThemingCompileState): void {
  listeners.forEach((listener) => listener(state));
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
function failWorker(detail: string): void {
  worker = null;

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
      lastAppliedThemeKey = compiledThemeKey;
      notify({ kind: 'idle' });
    } else {
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

  // Already on screen, already compiling, or already queued -- `withNfsTheming`
  // re-requests on every story render, so this is the hot path. Checking all
  // three states (rather than one "last requested" key) is what lets an errored
  // theme be retried: it reaches none of them.
  if (
    key === lastAppliedThemeKey ||
    key === inFlightThemeKey ||
    (pendingTheme !== null && themeKey(pendingTheme) === key)
  ) {
    return;
  }

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
    lastAppliedThemeKey = key;
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
  const theme = (context.globals as { nfsTheme?: NfsTheme }).nfsTheme ?? {};
  requestTheme(theme);
  return storyFn();
};
