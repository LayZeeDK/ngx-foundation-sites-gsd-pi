import { NFS_COLOR_KEYS, type NfsTheme } from './theming-panel';
import { THEMING_SOURCES } from './theming-sources.generated';
import type * as Sass from 'sass';

// D035 part c: the two-preset model, read from Sass at runtime via a custom
// Sass function registered on a dedicated probe `compileString` call -- never
// a TypeScript copy of the six Foundation-global values or the three WCAG
// overrides. This file has NO static top-level `import ... from 'sass'`: the
// compiler only ever loads behind `computePresets()`'s dynamic `import('sass')`,
// which fires only once code inside the Worker this module spawns actually
// runs. That keeps this module safe to import statically from the manager's
// main bundle (a future panel wiring) without dragging the ~800 KiB gzip sass
// payload into that bundle, mirroring theming-worker.ts/theming-inject.ts's
// split for the compile pipeline (D034) -- folded into one file here because
// T03's scope is this file alone. The Worker is self-referencing
// (`new URL('./theming-presets.ts', import.meta.url)`): webpack's native
// Worker support recognises the `new Worker(new URL(...))` shape regardless
// of whether it names the current file or another, so one file can be both
// the requester (called from the panel) and the worker entry (its own
// `onmessage`, gated on an `importScripts` check since only a real Worker
// global has it).

export interface NfsPreset {
  readonly name: string;
  readonly theme: NfsTheme;
}

export interface PresetProbeResult {
  readonly presets: readonly NfsPreset[];
}

export const NFS_CUSTOM_PRESET_NAME = 'Custom';
export const NFS_PRESET_SELECT_ID = 'nfs-preset-select';

const CANONICAL_KEYS = [...NFS_COLOR_KEYS, 'radius'] as const;

function canonicalSignature(theme: NfsTheme): string {
  return CANONICAL_KEYS.filter((key) => theme[key] !== undefined)
    .map((key) => `${key}:${theme[key]}`)
    .join('|');
}

/**
 * Six-scalar deep-equal against canonical live state, first-match-wins.
 * Because both sides are canonical-minimal sparse maps, string equality of
 * the joined signature IS the deep-equal (D035 part c).
 */
export function deriveSelectedPreset(presets: readonly NfsPreset[], liveTheme: NfsTheme): string {
  const liveSignature = canonicalSignature(liveTheme);
  const match = presets.find((preset) => canonicalSignature(preset.theme) === liveSignature);
  return match ? match.name : NFS_CUSTOM_PRESET_NAME;
}

// ---------------------------------------------------------------------------
// Probe compile: entry SCSS, custom function, importer.
// ---------------------------------------------------------------------------

const PROBE_FUNCTION_NAME = 'nfs-theming-preset-probe';

/**
 * Only `nfs:/theme` (D033's `$wcag-palette`) and `internal/settings` (the six
 * Foundation-global names, not the button-derived ones) are `@use`d -- no
 * `nfs:/button`, no `theme()` call, so the probe never enters the Foundation
 * island (measured 1.1 / 0.7 ms over these 2 data files). The assignment's
 * right-hand side is evaluated for its side effect (the custom function call
 * below); no CSS is expected or read from the compile result.
 */
function buildProbeEntryScss(): string {
  return [
    "@use 'nfs:/theme' as nfs-theme;",
    "@use 'nfs:/internal/settings' as nfs-settings;",
    `$__nfs-preset-probe: ${PROBE_FUNCTION_NAME}(`,
    '  nfs-theme.$wcag-palette,',
    '  nfs-settings.$primary-color,',
    '  nfs-settings.$secondary-color,',
    '  nfs-settings.$success-color,',
    '  nfs-settings.$warning-color,',
    '  nfs-settings.$alert-color,',
    '  nfs-settings.$global-radius',
    ');',
    '',
  ].join('\n');
}

type WcagKey = 'success' | 'warning' | 'alert';
const WCAG_KEYS: readonly WcagKey[] = ['success', 'warning', 'alert'];

interface RawProbeValues {
  readonly defaults: {
    readonly primary: string;
    readonly secondary: string;
    readonly success: string;
    readonly warning: string;
    readonly alert: string;
    readonly radius: number;
  };
  readonly wcagPalette: Readonly<Partial<Record<WcagKey, string>>>;
}

function hexFromColorValue(value: Sass.Value, name: string): string {
  const rgb = value.assertColor(name).toSpace('rgb');
  const toHex = (channel: number) => Math.round(channel).toString(16).padStart(2, '0');
  return `#${toHex(rgb.channel('red'))}${toHex(rgb.channel('green'))}${toHex(rgb.channel('blue'))}`;
}

function createProbeFunctions(
  sassNs: typeof Sass,
  capture: (raw: RawProbeValues) => void
): Record<string, Sass.CustomFunction<'sync'>> {
  const signature = `${PROBE_FUNCTION_NAME}($wcag-palette, $primary, $secondary, $success, $warning, $alert, $radius)`;

  return {
    [signature]: (args) => {
      const wcagMap = args[0].assertMap('wcag-palette');
      const wcagPalette: Partial<Record<WcagKey, string>> = {};
      WCAG_KEYS.forEach((key) => {
        const entry = wcagMap.get(new sassNs.SassString(key));
        if (entry !== undefined) {
          wcagPalette[key] = hexFromColorValue(entry, key);
        }
      });

      capture({
        defaults: {
          primary: hexFromColorValue(args[1], 'primary'),
          secondary: hexFromColorValue(args[2], 'secondary'),
          success: hexFromColorValue(args[3], 'success'),
          warning: hexFromColorValue(args[4], 'warning'),
          alert: hexFromColorValue(args[5], 'alert'),
          radius: Math.round(args[6].assertNumber('radius').value),
        },
        wcagPalette,
      });

      return sassNs.sassNull;
    },
  };
}

/**
 * Mirrors (does not share) theming-worker.ts's `createSourcesImporter` --
 * same rationale as that module's own header comment: each Worker entry
 * resolves `THEMING_SOURCES` independently rather than importing a runtime
 * helper across files, keeping T03 self-contained to this one file.
 */
function candidateUrls(scheme: string, pathname: string, fromImport: boolean): string[] {
  const lastSlash = pathname.lastIndexOf('/');
  const dir = lastSlash <= 0 ? '' : pathname.slice(0, lastSlash);
  const name = pathname.slice(lastSlash + 1);
  const out: string[] = [];

  if (fromImport) {
    out.push(`${scheme}:${dir}/_${name}.import.scss`, `${scheme}:${dir}/${name}.import.scss`);
  }

  out.push(
    `${scheme}:${dir}/_${name}.scss`,
    `${scheme}:${dir}/${name}.scss`,
    `${scheme}:${dir}/${name}/_index.scss`,
    `${scheme}:${dir}/${name}/index.scss`
  );

  return out;
}

function createProbeImporter(): Sass.Importer<'sync'> {
  return {
    canonicalize(url, context) {
      let scheme: string;
      let pathname: string;

      if (url.startsWith('nfs:') || url.startsWith('fnd:')) {
        scheme = url.slice(0, 3);
        pathname = url.slice(4);
      } else {
        scheme = 'nfs';
        pathname = url.startsWith('/') ? url : `/${url}`;
      }

      if (!pathname.startsWith('/')) {
        pathname = `/${pathname}`;
      }

      for (const candidate of candidateUrls(scheme, pathname, context.fromImport)) {
        if (Object.prototype.hasOwnProperty.call(THEMING_SOURCES, candidate)) {
          return new URL(candidate);
        }
      }

      return null;
    },

    load(canonicalUrl) {
      return { contents: THEMING_SOURCES[canonicalUrl.toString()], syntax: 'scss' };
    },
  };
}

function buildPresets(raw: RawProbeValues): readonly NfsPreset[] {
  const wcagTheme = WCAG_KEYS.reduce<NfsTheme>((acc, key) => {
    const value = raw.wcagPalette[key];
    if (value === undefined || value === raw.defaults[key]) {
      return acc;
    }
    return { ...acc, [key]: value };
  }, {});

  return [
    { name: 'Foundation default', theme: {} },
    { name: 'WCAG-compliant', theme: wcagTheme },
  ];
}

/**
 * The pure, directly-callable probe compile -- exported separately from the
 * Worker plumbing below so a future Vitest `test` (jsdom) lane can exercise
 * it without a real Worker (R021 lane 1: "the preset baseline probe
 * returning Foundation's six global defaults and $wcag-palette's three
 * overrides by exact key set").
 */
export async function computePresets(): Promise<readonly NfsPreset[]> {
  const sassNs = await import('sass');
  let captured: RawProbeValues | null = null;

  sassNs.compileString(buildProbeEntryScss(), {
    importers: [createProbeImporter()],
    functions: createProbeFunctions(sassNs, (raw) => {
      captured = raw;
    }),
    quietDeps: true,
    silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  });

  if (captured === null) {
    throw new Error('nfs theming preset probe: the Sass compiler never invoked the probe function');
  }

  return buildPresets(captured);
}

// ---------------------------------------------------------------------------
// Worker plumbing: requester (called from the panel) + worker entry (self).
// ---------------------------------------------------------------------------

interface PresetProbeRequest {
  readonly kind: 'nfs-preset-probe-request';
}

type PresetProbeResponse =
  | { readonly kind: 'nfs-preset-probe-response'; readonly ok: true; readonly presets: readonly NfsPreset[] }
  | { readonly kind: 'nfs-preset-probe-response'; readonly ok: false; readonly error: string };

// No "webworker" lib, same reason as theming-worker.ts: this tsconfig is
// shared with DOM-typed manager/preview files, and DOM + webworker libs
// declare conflicting globals.
const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<PresetProbeRequest>) => void) | null;
  postMessage(message: PresetProbeResponse): void;
  importScripts?: unknown;
};

// Only a real DedicatedWorkerGlobalScope has `importScripts`; on the main
// thread (when this module is imported normally to reach `runPresetProbe`)
// this branch never runs, so registering `onmessage` here never happens
// outside an actual Worker.
if (typeof workerScope.importScripts === 'function') {
  workerScope.onmessage = () => {
    computePresets()
      .then((presets) => {
        workerScope.postMessage({ kind: 'nfs-preset-probe-response', ok: true, presets });
      })
      .catch((error: unknown) => {
        workerScope.postMessage({
          kind: 'nfs-preset-probe-response',
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  };
}

let cachedProbe: Promise<PresetProbeResult> | null = null;

function requestProbe(): Promise<PresetProbeResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const worker = new Worker(new URL('./theming-presets.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (event: MessageEvent<PresetProbeResponse>) => {
      worker.terminate();
      const message = event.data;
      if (message.ok) {
        resolvePromise({ presets: message.presets });
      } else {
        rejectPromise(new Error(message.error));
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      worker.terminate();
      rejectPromise(new Error(event.message || 'nfs theming preset probe worker failed'));
    };

    const request: PresetProbeRequest = { kind: 'nfs-preset-probe-request' };
    worker.postMessage(request);
  });
}

/**
 * One compile at panel init (D035 part c): constructs a dedicated Worker on
 * first call, lazily fetching the same split sass chunk theming-worker.ts's
 * compile pipeline uses, and caches the resulting promise so a panel remount
 * never re-probes.
 */
export function runPresetProbe(): Promise<PresetProbeResult> {
  if (cachedProbe === null) {
    cachedProbe = requestProbe();
  }
  return cachedProbe;
}
