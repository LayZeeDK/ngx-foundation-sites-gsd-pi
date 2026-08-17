import * as sass from 'sass';
import { createSourcesImporter } from './theming-sources-importer';
import type { NfsPreset, NfsThemeDefaults, PresetProbeResult } from './theming-presets';

// MEM101 fix: the preset probe's Sass-touching half, moved out of
// theming-presets.ts (now manager-safe) so it runs only where `sass` is
// already paid for -- inside theming-worker.ts's Worker, which
// theming-inject.ts constructs lazily on the preview side. Synchronous, not
// `async import('sass')`: unlike the old manager-side call site, this module
// is only ever imported by theming-worker.ts, which already imports `sass`
// statically at the top of its own module -- there is nothing left to defer.
//
// Only `nfs:/theme` (D033's `$wcag-palette`) and `internal/settings` (the six
// Foundation-global names, not the button-derived ones) are `@use`d -- no
// `nfs:/button`, no `theme()` call, so the probe never enters the Foundation
// island (measured 1.1 / 0.7 ms over these 2 data files). The assignment's
// right-hand side is evaluated for its side effect (the custom function call
// below); no CSS is expected or read from the compile result.

const PROBE_FUNCTION_NAME = 'nfs-theming-preset-probe';

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

function hexFromColorValue(value: sass.Value, name: string): string {
  const rgb = value.assertColor(name).toSpace('rgb');
  const toHex = (channel: number) => Math.round(channel).toString(16).padStart(2, '0');
  return `#${toHex(rgb.channel('red'))}${toHex(rgb.channel('green'))}${toHex(rgb.channel('blue'))}`;
}

function createProbeFunctions(
  capture: (raw: RawProbeValues) => void
): Record<string, sass.CustomFunction<'sync'>> {
  const signature = `${PROBE_FUNCTION_NAME}($wcag-palette, $primary, $secondary, $success, $warning, $alert, $radius)`;

  return {
    [signature]: (args) => {
      const wcagMap = args[0].assertMap('wcag-palette');
      const wcagPalette: Partial<Record<WcagKey, string>> = {};
      WCAG_KEYS.forEach((key) => {
        const entry = wcagMap.get(new sass.SassString(key));
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

      return sass.sassNull;
    },
  };
}

function buildPresets(raw: RawProbeValues): readonly NfsPreset[] {
  const wcagTheme = WCAG_KEYS.reduce<Record<string, string>>((acc, key) => {
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
 * Runs the probe compile and returns the finished `PresetProbeResult`.
 * Synchronous end to end -- `sass.compileString` is sync, and this module's
 * only caller (theming-worker.ts) already has `sass` loaded. Caching ("one
 * probe compile at panel init", R009) is the caller's job: theming-inject.ts
 * memoises the request the same way theming-presets.ts's old `computePresets`
 * did, so a panel remount reuses the one compile rather than re-running this.
 */
export function runPresetProbe(): PresetProbeResult {
  let captured: RawProbeValues | null = null;

  sass.compileString(buildProbeEntryScss(), {
    importers: [createSourcesImporter()],
    functions: createProbeFunctions((raw) => {
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
