import * as sass from 'sass';
import { THEMEABLE_MODULES } from './theming-sources.generated';
import { createSourcesImporter } from './theming-sources-importer';
import { runPresetProbe } from './theming-probe';
import type { NfsTheme } from './theming-model';
import type { PresetProbeResult } from './theming-presets';

// D035 part d/e: this module (plus theming-probe.ts, which it imports) is the
// addon's ONLY import of `sass`, so webpack's native worker split (`new
// Worker(new URL('./theming-worker.ts', import.meta.url))` in
// theming-inject.ts) is the point at which the ~800 KiB gzip sass payload
// leaves preview boot (D034) -- lazily fetched on the first non-default theme
// OR the first preset-probe request, whichever comes first (MEM101: the probe
// now shares this Worker instead of running on the manager side, so opening
// the panel and changing a colour still pays that payload only once, not
// twice). The Worker has no filesystem, so it resolves against the
// committed, in-memory THEMING_SOURCES map instead of disk, via the shared
// theming-sources-importer.ts.
//
// "Only import of `sass`" now holds workspace-wide, not just on the preview
// side: theming-presets.ts (manager-side) no longer touches `sass` at all.

export interface ThemeCompileRequest {
  readonly seq: number;
  readonly theme: NfsTheme;
}

export interface SassErrorLike {
  readonly sassMessage: string;
  readonly sassStack: string;
  readonly sourceUrl: string | null;
}

export type ThemeCompileResponse =
  | { readonly seq: number; readonly ok: true; readonly css: string }
  | { readonly seq: number; readonly ok: false; readonly error: SassErrorLike };

// MEM101 fix: the preset probe shares this Worker rather than getting its own
// -- a second Worker (or a second main-thread `import('sass')`) would fetch
// the ~800 KiB sass payload a second time. Structurally distinguished from
// `ThemeCompileRequest`/`ThemeCompileResponse` by the `probe: true` tag rather
// than a shared discriminant, so the existing compile wire shape -- asserted
// verbatim across theming-worker.spec.ts, theming-worker.browser.spec.ts, and
// theming-inject.spec.ts -- needed no change.
export interface ThemePresetProbeRequest {
  readonly seq: number;
  readonly probe: true;
}

export type ThemePresetProbeResponse =
  | { readonly seq: number; readonly probe: true; readonly ok: true; readonly result: PresetProbeResult }
  | { readonly seq: number; readonly probe: true; readonly ok: false; readonly error: SassErrorLike };


// D035 part d: no `$selector` is passed -- each module emits under its own
// default selector. Only `secondary`/`success`/`warning`/`alert` go through
// `$palette` (R009: `theme($palette.secondary)` etc.); `primary` maps onto
// `$background`, and unset keys are simply omitted so `theme()`'s own
// `map.merge`/null-check keeps Foundation's defaults for them.
const PALETTE_KEYS = ['secondary', 'success', 'warning', 'alert'] as const;

function paletteArgFor(theme: NfsTheme): string | null {
  const entries = PALETTE_KEYS.filter((key) => theme[key] !== undefined).map(
    (key) => `${key}: ${theme[key]}`
  );

  return entries.length > 0 ? `(${entries.join(', ')})` : null;
}

function themeArgsFor(theme: NfsTheme): string {
  const args: string[] = [];

  if (theme.primary !== undefined) {
    args.push(`$background: ${theme.primary}`);
  }

  const paletteArg = paletteArgFor(theme);
  if (paletteArg !== null) {
    args.push(`$palette: ${paletteArg}`);
  }

  if (theme.radius !== undefined) {
    args.push(`$radius: ${theme.radius}px`);
  }

  return args.length > 0 ? `(${args.join(', ')})` : '';
}

/**
 * D040 constraint 3: the entry string is an ordered array of sections whose
 * FIRST section is reserved for configuration and is empty today -- Sass
 * configuration (`@use ... with (...)`) must precede every `@use` of a
 * module that loads it, so an appended clause could never work. Keeping this
 * as the literal first array entry is what makes a future configuration
 * clause free.
 */
export function buildEntryScss(theme: NfsTheme): string {
  const configSection = '';
  const moduleSections = THEMEABLE_MODULES.map(
    (module) =>
      `@use '${module.url}' as ${module.namespace};\n@include ${module.namespace}.theme${themeArgsFor(theme)};\n`
  );

  return [configSection, ...moduleSections].join('');
}

function serializeError(error: unknown): SassErrorLike {
  if (error instanceof sass.Exception) {
    return {
      sassMessage: error.sassMessage,
      sassStack: error.sassStack,
      sourceUrl: error.span.url ? error.span.url.toString() : null,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return { sassMessage: message, sassStack: '', sourceUrl: null };
}

function compile(theme: NfsTheme): string {
  const result = sass.compileString(buildEntryScss(theme), {
    importers: [createSourcesImporter()],
    quietDeps: true,
    silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  });

  return result.css;
}

// No "webworker" lib: `.storybook/tsconfig.json` is shared with DOM-typed
// manager/preview files, and DOM + webworker libs declare conflicting
// globals. `globalThis` is typed under `dom` too, so it is cast narrowly
// here instead of relying on an ambient `self` redeclaration.
const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ThemeCompileRequest | ThemePresetProbeRequest>) => void) | null;
  postMessage(message: ThemeCompileResponse | ThemePresetProbeResponse): void;
};

workerScope.onmessage = (event) => {
  const request = event.data;

  if ('probe' in request) {
    const { seq } = request;
    try {
      const result = runPresetProbe();
      workerScope.postMessage({ seq, probe: true, ok: true, result });
    } catch (error) {
      workerScope.postMessage({ seq, probe: true, ok: false, error: serializeError(error) });
    }
    return;
  }

  const { seq, theme } = request;

  try {
    const css = compile(theme);
    workerScope.postMessage({ seq, ok: true, css });
  } catch (error) {
    workerScope.postMessage({ seq, ok: false, error: serializeError(error) });
  }
};
