import { useChannel, useGlobals } from 'storybook/manager-api';
// The default import is required at runtime, not just for types: Storybook's
// manager builder (esbuild) compiles this file's JSX to `React.createElement`
// calls regardless of tsconfig's `"jsx": "react-jsx"` (that setting only
// governs `tsc`'s own type-checking pass here, not the manager bundle's real
// transform). Without this import the panel throws `ReferenceError: React is
// not defined` the instant it renders -- confirmed live: the panel has never
// actually rendered in a real browser before this fix, only compiled and
// unit-tested in isolation.
import React, { useEffect, useRef, useState, type FC } from 'react';
import { NFS_THEMING_STATE_EVENT, type ThemingCompileState } from './theming-channel';
import {
  computePresets,
  deriveSelectedPreset,
  NFS_CUSTOM_PRESET_NAME,
  NFS_PRESET_SELECT_ID,
  type NfsPreset,
  type NfsThemeDefaults,
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

function colorTextsFromTheme(theme: NfsTheme, defaults: NfsThemeDefaults): ColorTextState {
  return NFS_COLOR_KEYS.reduce((acc, key) => {
    acc[key] = theme[key] ?? defaults[key];
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

  // Seeded once the probe resolves -- Foundation's real defaults are not known
  // before then, and R009 forbids a TypeScript copy of them standing in.
  const [colorTexts, setColorTexts] = useState<Partial<ColorTextState>>({});
  const [colorErrors, setColorErrors] = useState<ColorErrorState>({});
  const [radiusText, setRadiusText] = useState<string>('');
  const [radiusError, setRadiusError] = useState(false);
  const [defaults, setDefaults] = useState<NfsThemeDefaults | null>(null);

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
  const [probeState, setProbeState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [probeError, setProbeError] = useState<string | null>(null);
  const [presets, setPresets] = useState<readonly NfsPreset[]>([]);

  // R009's `data-nfs-panel-state="loading|ready|compiling|error"` contract and
  // its "the panel shows sassMessage plus a friendly source name" clause. The
  // compile runs in the preview iframe, so the state arrives over Storybook's
  // channel (see theming-channel.ts).
  const [compileState, setCompileState] = useState<ThemingCompileState>({ kind: 'idle' });
  useChannel({
    [NFS_THEMING_STATE_EVENT]: (state: ThemingCompileState) => {
      setCompileState(state);
    },
  });

  useEffect(() => {
    let cancelled = false;
    computePresets()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setPresets(result.presets);
        setDefaults(result.defaults);
        setProbeState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // Deliberately loud. This catch previously discarded the error object
        // entirely -- it did not even bind it -- so that a probe failure could
        // not trip R021 P1's zero-console-error gate. That inverted the gate:
        // it exists to DETECT breakage, and was instead satisfied by removing
        // the detection. P1 still passes on a healthy build, because a healthy
        // probe does not reach here.
        //
        // Five distinct causes collapse into this branch (a failed
        // `import('sass')`, an unresolvable `nfs:/theme` or
        // `internal/settings`, a renamed `$wcag-palette`, a type change in one
        // of the six globals, and the explicit "never invoked the probe
        // function" throw). All of them also predict that live compiles are
        // broken, since computePresets() and the compile Worker resolve the
        // same THEMING_SOURCES map -- so this is the earliest warning the
        // addon gets, and it used to be thrown away.
        console.error(
          '[nfs-theming] the preset probe failed; presets and the six controls are unavailable.',
          error
        );
        setPresets([]);
        setProbeError(error instanceof Error ? error.message : String(error));
        setProbeState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPresetName =
    probeState === 'ready' ? deriveSelectedPreset(presets, theme) : NFS_CUSTOM_PRESET_NAME;

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

  const previousThemeRef = useRef(theme);

  // Seeds the text mirrors the moment the probe's authoritative defaults
  // arrive. Keyed on `defaults` alone: this runs once, and the sync effect
  // below owns every subsequent theme change.
  useEffect(() => {
    if (defaults === null) {
      return;
    }
    setColorTexts(colorTextsFromTheme(theme, defaults));
    setRadiusText(String(theme.radius ?? defaults.radius));
    previousThemeRef.current = theme;
  }, [defaults]);

  // Reflect theme changes that did not originate from this panel's own
  // commits (e.g. a shared `?globals=` link, or a preset applied elsewhere).
  // Only the keys that actually changed are re-synced, so an in-progress
  // invalid edit on a sibling control survives.
  useEffect(() => {
    const previousTheme = previousThemeRef.current;
    if (defaults === null || previousTheme === theme) {
      return;
    }
    const changedColorKeys = NFS_COLOR_KEYS.filter(
      (key) => (theme[key] ?? defaults[key]) !== (previousTheme[key] ?? defaults[key])
    );
    if (changedColorKeys.length > 0) {
      setColorTexts((current) => {
        const next = { ...current };
        changedColorKeys.forEach((key) => {
          next[key] = theme[key] ?? defaults[key];
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
    if ((theme.radius ?? defaults.radius) !== (previousTheme.radius ?? defaults.radius)) {
      setRadiusText(String(theme.radius ?? defaults.radius));
      setRadiusError(false);
    }
    previousThemeRef.current = theme;
  }, [theme]);

  // Both commit paths are only reachable from controls that render once
  // `defaults` is non-null; the guard is what tells the compiler so.
  const commitColor = (key: NfsColorKey, rawValue: string): void => {
    if (defaults === null) {
      return;
    }
    setColorTexts((current) => ({ ...current, [key]: rawValue }));
    const normalized = normalizeHexColor(rawValue);
    if (normalized === null) {
      setColorErrors((current) => ({ ...current, [key]: true }));
      return;
    }
    setColorErrors((current) => ({ ...current, [key]: false }));
    updateGlobals({ nfsTheme: withOverride(theme, key, normalized, defaults[key]) });
  };

  const commitRadius = (rawValue: string): void => {
    if (defaults === null) {
      return;
    }
    setRadiusText(rawValue);
    const clamped = clampRadius(rawValue);
    if (clamped === null) {
      setRadiusError(true);
      return;
    }
    setRadiusError(false);
    updateGlobals({ nfsTheme: withOverride(theme, 'radius', clamped, defaults.radius) });
  };

  // Only the preset probe gates the controls. A compile that is in flight or
  // that errored must leave them live -- the whole point of the error state is
  // that the user can correct the value that caused it.
  const controlsDisabled = probeState !== 'ready';

  // R009's four-state contract. `compiling` is already 300 ms-gated upstream:
  // theming-inject.ts only emits it for a compile still running past
  // COMPILING_INDICATOR_DELAY_MS, so a fast compile never flickers here.
  const panelState: 'loading' | 'ready' | 'compiling' | 'error' =
    probeState === 'loading'
      ? 'loading'
      : probeState === 'failed' || compileState.kind === 'error'
        ? 'error'
        : compileState.kind === 'idle'
          ? 'ready'
          : compileState.kind;

  // A dead probe is reported ahead of a compile error: without Foundation's
  // defaults the controls cannot render at all, so it is the more fundamental
  // failure and the one worth showing.
  const errorText =
    probeError !== null
      ? `Could not read the theme presets from Sass: ${probeError}`
      : compileState.kind === 'error'
        ? `Could not compile ${compileState.sourceName}: ${compileState.message}`
        : null;

  return (
    <div data-testid="nfs-theming-panel" data-nfs-panel-state={panelState} style={{ padding: 12 }}>
      {errorText !== null && (
        <div
          data-testid="nfs-theming-error"
          role="alert"
          style={{
            marginBottom: 8,
            padding: 8,
            border: '1px solid crimson',
            borderRadius: 3,
            color: 'crimson',
            whiteSpace: 'pre-wrap',
          }}
        >
          {errorText}
        </div>
      )}
      {compileState.kind === 'compiling' && (
        <div data-testid="nfs-theming-compiling" style={{ marginBottom: 8 }}>
          Compiling...
        </div>
      )}
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
      {/* The six controls render only once the probe has supplied Foundation's
          real defaults. There is nothing honest to show a colour input before
          then -- inventing a placeholder here is exactly the TypeScript copy
          R009 rules out -- and the panel is in `loading` for the ~1 ms window. */}
      {defaults !== null && (
        <>
          {NFS_COLOR_KEYS.map((key) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <label htmlFor={`nfs-color-${key}-text`} style={{ width: 84, textTransform: 'capitalize' }}>
                {key}
              </label>
              <input
                id={`nfs-color-${key}`}
                type="color"
                value={theme[key] ?? defaults[key]}
                disabled={controlsDisabled}
                onChange={(event) => commitColor(key, event.target.value)}
              />
              <input
                id={`nfs-color-${key}-text`}
                type="text"
                value={colorTexts[key] ?? ''}
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
              value={theme.radius ?? defaults.radius}
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
        </>
      )}
    </div>
  );
};
