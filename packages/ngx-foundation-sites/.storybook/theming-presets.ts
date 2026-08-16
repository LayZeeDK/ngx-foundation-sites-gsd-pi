import { NFS_COLOR_KEYS, type NfsTheme } from './theming-panel';
import { THEMING_SOURCES } from './theming-sources.generated';
import type * as Sass from 'sass';

// D035 part c: the two-preset model, read from Sass at runtime via a custom
// Sass function registered on a dedicated probe `compileString` call -- never
// a TypeScript copy of the six Foundation-global values or the three WCAG
// overrides. That property is load-bearing and now covers the defaults too:
// `computePresets` returns them (see NfsThemeDefaults) so the panel has no
// literals of its own.
//
// This file has NO static top-level `import ... from 'sass'`. The compiler
// loads only behind `computePresets()`'s dynamic `import('sass')`, which keeps
// the ~800 KiB gzip payload out of the manager's ENTRY chunk -- that is the
// surviving benefit, and `verify-theming-bundle` is what holds it.
//
// It does, however, load on the manager MAIN THREAD on first panel open. The
// design originally put this probe in a self-referencing Worker
// (`new Worker(new URL('./theming-presets.ts', import.meta.url))`), on the
// strength of D035's verified webpack finding. T02 measured that this does not
// transfer: the manager builder (esbuild) does not split or serve that shape as
// its own chunk, and the Worker failed silently. The panel therefore calls
// `computePresets()` directly, at a measured cost of roughly 1 ms, and the
// Worker requester/entry plumbing has been removed rather than left in place
// as unreachable code. The webpack finding still holds for theming-worker.ts
// on the PREVIEW side, which is a different bundler.

export interface NfsPreset {
  readonly name: string;
  readonly theme: NfsTheme;
}

/**
 * Foundation's own values for the six controls, as read from Sass by the
 * probe. R009: "No TypeScript copy of any of the six values exists anywhere"
 * -- so this shape is populated only from a live compile, never from literals.
 * The panel needs them because canonicalisation is defined against them (a key
 * is present in the sparse map iff it differs from Foundation's default).
 */
export interface NfsThemeDefaults {
  readonly primary: string;
  readonly secondary: string;
  readonly success: string;
  readonly warning: string;
  readonly alert: string;
  readonly radius: number;
}

export interface PresetProbeResult {
  readonly presets: readonly NfsPreset[];
  readonly defaults: NfsThemeDefaults;
}

export const NFS_CUSTOM_PRESET_NAME = 'Custom';
export const NFS_PRESET_SELECT_ID = 'nfs-preset-select';

// Computed inside a function rather than as a module-top-level constant: the
// panel imports this module statically (`computePresets`,
// `deriveSelectedPreset`, `NFS_CUSTOM_PRESET_NAME`, `NFS_PRESET_SELECT_ID`),
// which makes this module part of a real import cycle back to
// theming-panel.tsx. The cycle is a property of that static import, not of
// which particular symbol is used, so removing any one of them does not make
// it safe to inline this back to the top level.
// A top-level `[...NFS_COLOR_KEYS, 'radius']` would read
// NFS_COLOR_KEYS while theming-panel.ts's own module body is still mid-
// evaluation (whichever side of the cycle loads first), which is a TDZ
// ReferenceError under real ESM/webpack semantics -- deferring the read into
// a function body means it only ever runs after both modules have finished
// evaluating.
function canonicalKeys() {
  return [...NFS_COLOR_KEYS, 'radius'] as const;
}

function canonicalSignature(theme: NfsTheme): string {
  return canonicalKeys()
    .filter((key) => theme[key] !== undefined)
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
  readonly defaults: NfsThemeDefaults;
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

async function runProbe(): Promise<PresetProbeResult> {
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

  const raw: RawProbeValues = captured;
  return { presets: buildPresets(raw), defaults: raw.defaults };
}

let cachedProbe: Promise<PresetProbeResult> | null = null;

/**
 * The probe compile, memoised. Called directly by the panel (see the file
 * header on why the Worker route was dropped) and by the Vitest `test` (jsdom)
 * lane, which needs no Worker to exercise it -- R021 lane 1: "the preset
 * baseline probe returning Foundation's six global defaults and
 * $wcag-palette's three overrides by exact key set".
 *
 * The cache is what makes R009's "one probe compile at panel init" true. The
 * panel is mounted only while its tab is active (manager.ts), so it unmounts
 * on every switch to Controls or a11y and remounts on every switch back;
 * without this, each reopen paid a fresh `import('sass')` plus a real compile
 * and flashed `loading` with the controls gone.
 */
export function computePresets(): Promise<PresetProbeResult> {
  cachedProbe ??= runProbe().catch((error: unknown) => {
    // A rejection is deliberately not cached. `import('sass')` can fail
    // transiently (a chunk-load hiccup), and since the panel remounts on every
    // tab switch, the next open is a free retry. A deterministic Sass failure
    // simply fails again and is reported again.
    cachedProbe = null;
    throw error;
  });

  return cachedProbe;
}
