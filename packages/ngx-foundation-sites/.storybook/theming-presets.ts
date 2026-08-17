import { NFS_CANONICAL_KEYS, type NfsTheme } from './theming-model';

// MEM101 fix: this file is manager-safe and MUST stay free of any `sass`
// reference, static or dynamic -- it is imported by theming-panel.tsx, which
// is part of the manager bundle. It previously ran the preset probe itself
// (a dedicated `sass.compileString` call reading `$wcag-palette` and the six
// Foundation-global names), which MEASURED against the real build output
// pulled dart-sass's ~800 KiB payload into the manager bundle on every
// Storybook boot (3,418,604 bytes raw / 735,249 gzip), regardless of whether
// the Theming tab was ever opened -- esbuild's manager builder has no
// `splitting`, so it flattens even a dynamic `import('sass')` into the single
// addon entry.
//
// The probe itself now lives in theming-probe.ts and runs inside the shared
// compile Worker (theming-worker.ts), requested over the manager<->preview
// channel (theming-channel.ts) by theming-inject.ts's `requestPresetProbe`.
// Sharing the Worker rather than a second, preview-main-thread `import('sass')`
// matters: it means opening the panel and changing a colour still fetches the
// ~800 KiB sass payload exactly once, not twice.
//
// What stays here: the presets/defaults SHAPE and the pure preset-equality
// math, since both the manager (rendering, preset-select derivation) and the
// probe (building the two presets from raw Sass values) need them, and
// neither needs `sass` to do so.

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

function canonicalSignature(theme: NfsTheme): string {
  return NFS_CANONICAL_KEYS.filter((key) => theme[key] !== undefined)
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
