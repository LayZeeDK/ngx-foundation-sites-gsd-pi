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

export const NFS_THEMING_STATE_EVENT = 'nfs/theming/compile-state';

export type ThemingCompileState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'compiling' }
  | { readonly kind: 'error'; readonly message: string; readonly sourceName: string };
