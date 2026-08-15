import { useGlobals } from 'storybook/manager-api';
import { useEffect, useRef, useState, type FC } from 'react';

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

  return (
    <div data-testid="nfs-theming-panel" data-nfs-panel-state="ready" style={{ padding: 12 }}>
      {NFS_COLOR_KEYS.map((key) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <label htmlFor={`nfs-color-${key}-text`} style={{ width: 84, textTransform: 'capitalize' }}>
            {key}
          </label>
          <input
            id={`nfs-color-${key}`}
            type="color"
            value={theme[key] ?? NFS_THEME_DEFAULTS[key]}
            onChange={(event) => commitColor(key, event.target.value)}
          />
          <input
            id={`nfs-color-${key}-text`}
            type="text"
            value={colorTexts[key]}
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
          onChange={(event) => commitRadius(event.target.value)}
        />
        <input
          id="nfs-radius-stepper"
          type="number"
          min={0}
          max={32}
          step={1}
          value={radiusText}
          onChange={(event) => commitRadius(event.target.value)}
          aria-invalid={radiusError}
          style={{ width: 60, ...(radiusError ? { borderColor: 'crimson' } : {}) }}
        />
      </div>
    </div>
  );
};
