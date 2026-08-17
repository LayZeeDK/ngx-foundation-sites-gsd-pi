import { useChannel, useGlobals } from 'storybook/manager-api';
// The default import is required at runtime, not just for types: Storybook's
// manager builder (esbuild) compiles this file's JSX to `React.createElement`
// calls regardless of tsconfig's `"jsx": "react-jsx"` (that setting only
// governs `tsc`'s own type-checking pass here, not the manager bundle's real
// transform). Without this import the panel throws `ReferenceError: React is
// not defined` the instant it renders.
import React, { useEffect, useRef, useState, type FC } from 'react';
import {
  NFS_THEMING_PROBE_REQUEST_EVENT,
  NFS_THEMING_PROBE_RESULT_EVENT,
  NFS_THEMING_STATE_EVENT,
  NFS_THEMING_STATE_REQUEST_EVENT,
  type ThemingCompileState,
  type ThemingProbeResult,
} from './theming-channel';
import {
  clampRadius,
  NFS_COLOR_KEYS,
  normalizeHexColor,
  withOverride,
  type NfsColorKey,
  type NfsTheme,
} from './theming-model';
import {
  deriveSelectedPreset,
  NFS_CUSTOM_PRESET_NAME,
  NFS_PRESET_SELECT_ID,
  type NfsPreset,
  type NfsThemeDefaults,
} from './theming-presets';

interface NfsGlobals {
  nfsTheme?: NfsTheme;
}

const EMPTY_THEME: NfsTheme = {};

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

  // D035 part c's preset model. Until the probe resolves the panel stays in
  // `loading`, the preset select is disabled, and the six value controls are
  // not rendered -- they have no defaults to show yet. "The panel loads
  // asynchronously on first open, by design" (R009), not a defect to race past
  // with a timeout.
  //
  // The probe runs in the preview's compile Worker (MEM101: moved off the
  // manager to keep `sass` out of the manager bundle), reached over the
  // channel -- see theming-inject.ts's header for why it shares that Worker
  // rather than getting a second one.
  const [probeState, setProbeState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [probeError, setProbeError] = useState<string | null>(null);
  const [presets, setPresets] = useState<readonly NfsPreset[]>([]);

  // R009's `data-nfs-panel-state="loading|ready|compiling|error"` contract and
  // its "the panel shows sassMessage plus a friendly source name" clause. The
  // compile runs in the preview iframe, so the state arrives over Storybook's
  // channel (see theming-channel.ts).
  const [compileState, setCompileState] = useState<ThemingCompileState>({ kind: 'idle' });
  const emitToPreview = useChannel({
    [NFS_THEMING_STATE_EVENT]: (state: ThemingCompileState) => {
      setCompileState(state);
    },
    // MEM101: the probe now runs in the preview's compile Worker rather than
    // directly on the manager, so its result arrives over this channel too --
    // see theming-inject.ts's `requestPresetProbe`/`ensureProbeResponder`.
    [NFS_THEMING_PROBE_RESULT_EVENT]: (probeResult: ThemingProbeResult) => {
      if (probeResult.ok) {
        setPresets(probeResult.result.presets);
        setDefaults(probeResult.result.defaults);
        setProbeState('ready');
        return;
      }

      // Deliberately loud -- see the removed effect's comment (still true):
      // a probe failure predicts that live compiles are broken too, since
      // both resolve the same THEMING_SOURCES map through the same Worker, so
      // this is the earliest warning the addon gets.
      console.error(
        '[nfs-theming] the preset probe failed; presets and the six controls are unavailable.',
        probeResult.message
      );
      setPresets([]);
      setProbeError(probeResult.message);
      setProbeState('failed');
    },
  });

  // manager.ts mounts this panel only while its tab is active, so switching to
  // Controls and back destroys `compileState` and remounts at `idle`. Ask the
  // preview -- which holds the authoritative state -- to replay it, otherwise a
  // standing error silently disappears on a tab switch, and an error raised
  // while the user was on another tab is never shown at all.
  // Guarded rather than relying on `useChannel`'s emitter being referentially
  // stable: exactly one request per mount, which is the semantic wanted, and an
  // unstable emitter would otherwise re-request on every render -- each reply
  // setting state and provoking the next render.
  const replayRequested = useRef(false);
  useEffect(() => {
    if (replayRequested.current) {
      return;
    }

    replayRequested.current = true;
    emitToPreview(NFS_THEMING_STATE_REQUEST_EVENT);
  }, [emitToPreview]);

  // MEM101: requests the probe over the channel instead of calling
  // `computePresets()` in-process. Unlike the state-replay request above,
  // this cannot be a single fire-and-forget emit: on first story load the
  // manager panel and the preview iframe boot independently, and the panel
  // routinely mounts (and fires this request) before the preview has
  // evaluated `withNfsTheming` even once and registered its channel listener
  // -- confirmed empirically, every P1-P8 Playwright case failed stuck in
  // `loading` until this retried. `ensureStateReplay`'s fix for the same race
  // is to broadcast proactively; that has no equivalent here since running
  // the probe IS the cost being deferred, so instead this retries the
  // request on an interval until a reply arrives. Retries are cheap and
  // idempotent -- `requestPresetProbe` on the preview side is memoised, so a
  // duplicate request after the first reply just replies again with the
  // cached result, never recompiles.
  useEffect(() => {
    if (probeState !== 'loading') {
      return;
    }

    emitToPreview(NFS_THEMING_PROBE_REQUEST_EVENT);
    const retryId = setInterval(() => {
      emitToPreview(NFS_THEMING_PROBE_REQUEST_EVENT);
    }, 250);

    return () => {
      clearInterval(retryId);
    };
  }, [emitToPreview, probeState]);

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
  // Reaches the preset select in practice; the six value controls render only
  // once `defaults` is non-null, which happens in the same commit as
  // `probeState = 'ready'`, so it is always false by the time they exist. Kept
  // on them so the gating stays correct if those two ever separate.
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
          : 'compiling';

  // A dead probe is reported ahead of a compile error: without Foundation's
  // defaults the controls cannot render at all, so it is the more fundamental
  // failure and the one worth showing.
  const errorText =
    probeError !== null
      ? `Could not read the theme presets from Sass: ${probeError}`
      : compileState.kind === 'error'
        ? // An empty `sourceName` means the message is already self-contained
          // (a refused `?globals=` value, say) rather than a Sass failure in a
          // named source.
          compileState.sourceName === ''
          ? compileState.message
          : `Could not compile ${compileState.sourceName}: ${compileState.message}`
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
                // The row's visible <label> points at the text field, so this
                // swatch needs its own accessible name (WCAG 1.3.1 / 4.1.2).
                aria-label={`${key} colour picker`}
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
              // The visible <label> points at the range slider above.
              aria-label="radius in pixels"
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
