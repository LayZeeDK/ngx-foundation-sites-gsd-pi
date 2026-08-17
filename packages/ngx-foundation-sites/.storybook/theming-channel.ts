import type { PresetProbeResult } from './theming-presets';

// The manager <-> preview contract for the addon's compile state (R009): the
// panel's `data-nfs-panel-state` carries `compiling` and `error` alongside
// `loading`/`ready`, and on error it shows `sassMessage` plus a friendly
// source name derived from `span.url`.
//
// The compile runs in the PREVIEW iframe (theming-inject.ts) and the panel
// renders in the MANAGER -- separate realms, so Storybook's channel is the
// only bridge. This module exists to carry the event name and payload shape
// across that boundary without either side importing the other: the manager
// must not pull in theming-inject.ts (preview-only, constructs the compile
// Worker), and the preview must not pull in theming-panel.tsx (React plus
// storybook/manager-api). Dependency-free and side-effect-free by design --
// the same split theming-worker.ts/theming-inject.ts already keep for the
// ~800 KiB sass payload (D034).
//
// MEM101 fix: also carries the preset-probe request/result. The probe used
// to run directly on the manager (theming-presets.ts's old `computePresets`),
// which measurably pulled `sass` into the manager bundle. It now runs in the
// preview's compile Worker, requested over this same channel -- the type-only
// import of `PresetProbeResult` below costs nothing at runtime and does not
// pull `sass` into whichever bundle reads this file, since theming-presets.ts
// itself no longer touches `sass`.

export const NFS_THEMING_STATE_EVENT = 'nfs/theming/compile-state';

/**
 * Panel -> preview: "re-send the current compile state".
 *
 * The panel is mounted only while its tab is active (manager.ts), so its React
 * state is destroyed on every switch away. Without a replay the panel would
 * remount at `idle` and silently drop a standing error -- and an error raised
 * while the user was on another tab would never be seen at all, which breaks
 * R009's four-state contract after a single tab switch.
 */
export const NFS_THEMING_STATE_REQUEST_EVENT = 'nfs/theming/compile-state-request';

export type ThemingCompileState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'compiling' }
  | { readonly kind: 'error'; readonly message: string; readonly sourceName: string };

/**
 * Panel -> preview: "run the preset probe and tell me what it found".
 *
 * Fired once per panel mount (R009: "one probe compile at panel init").
 * theming-inject.ts memoises the underlying compile, so a remount after the
 * first one resolves instantly rather than re-running it.
 */
export const NFS_THEMING_PROBE_REQUEST_EVENT = 'nfs/theming/probe-request';

/** Preview -> panel: the probe's result, or why it failed. */
export const NFS_THEMING_PROBE_RESULT_EVENT = 'nfs/theming/probe-result';

export type ThemingProbeResult =
  | { readonly ok: true; readonly result: PresetProbeResult }
  | { readonly ok: false; readonly message: string };
