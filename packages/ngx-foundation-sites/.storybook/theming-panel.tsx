import { useGlobals } from 'storybook/manager-api';
// The default import is required at runtime, not just for types: Storybook's
// manager builder (esbuild) compiles this file's JSX to `React.createElement`
// calls regardless of tsconfig's `"jsx": "react-jsx"` (that setting only
// governs `tsc`'s own type-checking pass here, not the manager bundle's real
// transform). Without this import the panel throws `ReferenceError: React is
// not defined` the instant it renders -- confirmed live: the panel has never
// actually rendered in a real browser before this fix, only compiled and
// unit-tested in isolation.
import React, { useEffect, useRef, useState, type FC } from 'react';
import {
  computePresets,
  deriveSelectedPreset,
  NFS_CUSTOM_PRESET_NAME,
  NFS_PRESET_SELECT_ID,
  type NfsPreset,
} from './theming-presets';

// D035 part a/b: the six curated Foundation-global controls (R009), and the
// sparse canonical-minimal override map they read from / write to. This file
// owns the panel UI and the validation boundary only -- the Worker-backed
// compile pipeline (D035 d/e) and the preset probe (D035 c) land in T02/T03.

export type NfsColorKey = 'primary' | 'secondary' | 'success' | 'warning' | 'alert';

export const NFS_COLOR_KEYS: readonly NfsColorKey[] = [
  'primary',
  'secondary',
  'success',
  'warning',
  'alert',
];

export interface NfsTheme {
  readonly primary?: string;
  readonly secondary?: string;
  readonly success?: string;
  readonly warning?: string;
  readonly alert?: string;
  readonly radius?: number;
}

interface NfsGlobals {
  nfsTheme?: NfsTheme;
}

// Foundation for Sites 6.9.0's own defaults for these six globals -- see
// R009's control table. A control's key is present in the sparse map iff its
// live value differs from these.
export const NFS_THEME_DEFAULTS: Readonly<Record<NfsColorKey, string>> & {
  readonly radius: number;
} = {
  primary: '#1779ba',
  secondary: '#767676',
  success: '#3adb76',
  warning: '#ffae00',
  alert: '#cc4b37',
  radius: 0,
};

const EMPTY_THEME: NfsTheme = {};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHexColor(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    return null;
  }
  const digits = trimmed.slice(1);
  const expanded =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  return `#${expanded.toLowerCase()}`;
}

export function clampRadius(rawValue: string): number | null {
  if (rawValue.trim() === '') {
    return null;
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 32) {
    return null;
  }
  return parsed;
}

/**
 * Exported so a Vitest `test` (jsdom) lane can exercise the
 * canonicalisation-deletes-default-key behaviour directly (R021 lane 1):
 * the whole "sparse equality is resolved equality" property in
 * theming-presets.ts's `deriveSelectedPreset` depends on this function never
 * leaving a key present at its default value.
 */
export function withOverride<K extends keyof NfsTheme>(
  theme: NfsTheme,
  key: K,
  value: NonNullable<NfsTheme[K]>,
  defaultValue: NonNullable<NfsTheme[K]>
): NfsTheme {
  if (value === defaultValue) {
    const next = { ...theme };
    delete next[key];
    return next;
  }
  return { ...theme, [key]: value };
}

type ColorTextState = Record<NfsColorKey, string>;
type ColorErrorState = Partial<Record<NfsColorKey, boolean>>;

function colorTextsFromTheme(theme: NfsTheme): ColorTextState {
  return NFS_COLOR_KEYS.reduce((acc, key) => {
    acc[key] = theme[key] ?? NFS_THEME_DEFAULTS[key];
    return acc;
  }, {} as ColorTextState);
}

export const ThemingPanel: FC = () => {
  const [globals, updateGlobals] = useGlobals() as [
    NfsGlobals,
    (newGlobals: NfsGlobals) => void,
    ...unknown[],
  ];
  const theme = globals.nfsTheme ?? EMPTY_THEME;

  const [colorTexts, setColorTexts] = useState<ColorTextState>(() => colorTextsFromTheme(theme));
  const [colorErrors, setColorErrors] = useState<ColorErrorState>({});
  const [radiusText, setRadiusText] = useState<string>(
    String(theme.radius ?? NFS_THEME_DEFAULTS.radius)
  );
  const [radiusError, setRadiusError] = useState(false);

  // D035 part c's preset model, wired up here. Until the probe resolves the
  // panel stays in `loading` and every control is disabled -- "the panel
  // loads asynchronously on first open, by design" (R009), not a defect to
  // race past with a timeout.
  //
  // Calls `computePresets()` directly rather than `runPresetProbe()`'s
  // self-referencing-Worker wrapper: confirmed live (real Storybook manager,
  // real browser) that `new Worker(new URL('./theming-presets.ts',
  // import.meta.url))` fails silently from the MANAGER bundle -- the manager
  // builder (esbuild) does not split/serve it as its own chunk the way
  // webpack does for theming-worker.ts's identical pattern on the PREVIEW
  // side (D035's verified Worker-in-webpack finding does not transfer to
  // esbuild). `computePresets()` is exported for exactly this reason --
  // its own doc comment says "so a future Vitest test (jsdom) lane can
  // exercise it without a real Worker" -- and its real compile cost is the
  // same ~1.1ms the design already measured, negligible on the main thread.
  const [panelState, setPanelState] = useState<'loading' | 'ready'>('loading');
  const [presets, setPresets] = useState<readonly NfsPreset[]>([]);

  useEffect(() => {
    let cancelled = false;
    computePresets()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setPresets(result);
        setPanelState('ready');
      })
      .catch(() => {
        // The probe failing must not surface as a manager console.error
        // (R021 P1's zero-console-error gate) or leave the panel stuck in
        // `loading` forever -- fall back to an empty preset list, which
        // `deriveSelectedPreset` already resolves to the literal `Custom`.
        if (cancelled) {
          return;
        }
        setPresets([]);
        setPanelState('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPresetName =
    panelState === 'ready' ? deriveSelectedPreset(presets, theme) : NFS_CUSTOM_PRESET_NAME;

  const commitPreset = (presetName: string): void => {
    // "Seeding is not locking" (R009): applying a preset is a single
    // `updateGlobals` write; choosing the literal `Custom` entry is a no-op
    // -- since this <select>'s value is derived from live theme state, not
    // local state, it snaps back to the true derived name on the next
    // render regardless.
    const preset = presets.find((candidate) => candidate.name === presetName);
    if (preset) {
      updateGlobals({ nfsTheme: preset.theme });
    }
  };

  // Reflect theme changes that did not originate from this panel's own
  // commits (e.g. a shared `?globals=` link, or -- once T03 lands -- a
  // preset applied elsewhere). Only the keys that actually changed are
  // re-synced, so an in-progress invalid edit on a sibling control survives.
  const previousThemeRef = useRef(theme);
  useEffect(() => {
    const previousTheme = previousThemeRef.current;
    if (previousTheme === theme) {
      return;
    }
    const changedColorKeys = NFS_COLOR_KEYS.filter(
      (key) => (theme[key] ?? NFS_THEME_DEFAULTS[key]) !== (previousTheme[key] ?? NFS_THEME_DEFAULTS[key])
    );
    if (changedColorKeys.length > 0) {
      setColorTexts((current) => {
        const next = { ...current };
        changedColorKeys.forEach((key) => {
          next[key] = theme[key] ?? NFS_THEME_DEFAULTS[key];
        });
        return next;
      });
      setColorErrors((current) => {
        const next = { ...current };
        changedColorKeys.forEach((key) => {
          delete next[key];
        });
        return next;
      });
    }
    if ((theme.radius ?? NFS_THEME_DEFAULTS.radius) !== (previousTheme.radius ?? NFS_THEME_DEFAULTS.radius)) {
      setRadiusText(String(theme.radius ?? NFS_THEME_DEFAULTS.radius));
      setRadiusError(false);
    }
    previousThemeRef.current = theme;
  }, [theme]);

  const commitColor = (key: NfsColorKey, rawValue: string): void => {
    setColorTexts((current) => ({ ...current, [key]: rawValue }));
    const normalized = normalizeHexColor(rawValue);
    if (normalized === null) {
      setColorErrors((current) => ({ ...current, [key]: true }));
      return;
    }
    setColorErrors((current) => ({ ...current, [key]: false }));
    updateGlobals({ nfsTheme: withOverride(theme, key, normalized, NFS_THEME_DEFAULTS[key]) });
  };

  const commitRadius = (rawValue: string): void => {
    setRadiusText(rawValue);
    const clamped = clampRadius(rawValue);
    if (clamped === null) {
      setRadiusError(true);
      return;
    }
    setRadiusError(false);
    updateGlobals({ nfsTheme: withOverride(theme, 'radius', clamped, NFS_THEME_DEFAULTS.radius) });
  };

  const controlsDisabled = panelState === 'loading';

  return (
    <div data-testid="nfs-theming-panel" data-nfs-panel-state={panelState} style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <label htmlFor={NFS_PRESET_SELECT_ID} style={{ width: 84 }}>
          preset
        </label>
        <select
          id={NFS_PRESET_SELECT_ID}
          value={selectedPresetName}
          disabled={controlsDisabled}
          onChange={(event) => commitPreset(event.target.value)}
        >
          {presets.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
          {selectedPresetName === NFS_CUSTOM_PRESET_NAME && (
            <option value={NFS_CUSTOM_PRESET_NAME}>{NFS_CUSTOM_PRESET_NAME}</option>
          )}
        </select>
      </div>
      {NFS_COLOR_KEYS.map((key) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <label htmlFor={`nfs-color-${key}-text`} style={{ width: 84, textTransform: 'capitalize' }}>
            {key}
          </label>
          <input
            id={`nfs-color-${key}`}
            type="color"
            value={theme[key] ?? NFS_THEME_DEFAULTS[key]}
            disabled={controlsDisabled}
            onChange={(event) => commitColor(key, event.target.value)}
          />
          <input
            id={`nfs-color-${key}-text`}
            type="text"
            value={colorTexts[key]}
            disabled={controlsDisabled}
            onChange={(event) => commitColor(key, event.target.value)}
            aria-invalid={colorErrors[key] === true}
            style={colorErrors[key] ? { borderColor: 'crimson' } : undefined}
          />
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor="nfs-radius" style={{ width: 84 }}>
          radius
        </label>
        <input
          id="nfs-radius"
          type="range"
          min={0}
          max={32}
          step={1}
          value={theme.radius ?? NFS_THEME_DEFAULTS.radius}
          disabled={controlsDisabled}
          onChange={(event) => commitRadius(event.target.value)}
        />
        <input
          id="nfs-radius-stepper"
          type="number"
          min={0}
          max={32}
          step={1}
          value={radiusText}
          disabled={controlsDisabled}
          onChange={(event) => commitRadius(event.target.value)}
          aria-invalid={radiusError}
          style={{ width: 60, ...(radiusError ? { borderColor: 'crimson' } : {}) }}
        />
      </div>
    </div>
  );
};
