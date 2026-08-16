// D035 part a/b: the addon's domain vocabulary -- the six curated
// Foundation-global controls (R009) and the sparse canonical-minimal override
// map they read from and write to.
//
// Lives here rather than in theming-panel.tsx because every module in the addon
// needs it, and the panel is the one module that must never be imported outside
// the MANAGER realm. Holding it there put a React file on the import path of a
// Web Worker (theming-worker.ts), created a real cycle with theming-presets.ts,
// and forced `"jsx": "react-jsx"` into tsconfigs that compile no JSX.
//
// Dependency-free and side-effect-free by design, like theming-channel.ts: safe
// to import from the manager, the preview, or the Worker.

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

/** The six control keys in canonical order -- the colours plus `radius`. */
export const NFS_CANONICAL_KEYS: readonly (keyof NfsTheme)[] = [...NFS_COLOR_KEYS, 'radius'];

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

/**
 * Drops any entry that the panel's own validators would have refused.
 *
 * R009 makes the panel the validation boundary, and it is -- for values the
 * panel writes. `?globals=` is a second writer it does not mediate: a
 * hand-edited or stale shared link reaches the compiler directly, and the
 * worker interpolates these values into SCSS source text. Storybook's
 * `parseArgsParam` does validate on the way in, so nothing malformed gets
 * through today, but that is a regex in a dependency rather than a property of
 * this addon -- and the cost of not relying on it is this function.
 *
 * Per-key rather than whole-theme: one bad key from a truncated link should not
 * discard the five good ones.
 */
export interface SanitizedTheme {
  readonly theme: NfsTheme;
  /** Keys that were present but refused, in canonical order. */
  readonly dropped: readonly string[];
}

export function sanitizeTheme(raw: unknown): SanitizedTheme {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return { theme: {}, dropped: [] };
  }

  const candidate = raw as Record<string, unknown>;
  const clean: Record<string, string | number> = {};
  const dropped: string[] = [];

  for (const key of NFS_COLOR_KEYS) {
    const value = candidate[key];

    if (value === undefined) {
      continue;
    }

    const normalized = typeof value === 'string' ? normalizeHexColor(value) : null;

    if (normalized === null) {
      dropped.push(key);
    } else {
      clean[key] = normalized;
    }
  }

  const radius = candidate['radius'];

  if (radius !== undefined) {
    const clamped =
      typeof radius === 'number' || typeof radius === 'string' ? clampRadius(String(radius)) : null;

    if (clamped === null) {
      dropped.push('radius');
    } else {
      clean['radius'] = clamped;
    }
  }

  return { theme: clean as NfsTheme, dropped };
}
