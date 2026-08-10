# NfsButton vs Angular Material MatButton/MatAnchor — R010 parity review

Compares `NfsButton` (`nfs-button.ts`) against Angular Material's `MatButton`/`MatAnchor`
(`MatButtonBase`), verified 2026-08-07 against the `angular/components` `main` branch source
(`src/material/button/button.ts`, `src/material/button/button-base.ts`) — not from memory.

## Host bindings / disabled semantics

| Surface | MatButtonBase (verified) | NfsButton (before) | NfsButton (after) | Verdict |
|---|---|---|---|---|
| `disabled` attr on native `<button>` | Set when `disabled && !disabledInteractive` | Set when `disabled` | unchanged | Match (no `disabledInteractive`, see below) |
| `aria-disabled` on native `<button>` | `null` unless `disabledInteractive` | `null` always | unchanged | Match |
| `aria-disabled` on `<a>` | `disabled \|\| null` | `disabled ? "true" : null` | unchanged | Match |
| `tabindex` on `<a>` when disabled | `-1` (removes from tab order) unless `disabledInteractive` | not set — anchor stayed focusable | `-1` | **Gap, fixed (T01)** |
| `tabindex` on native `<button>` when disabled | unaffected (native `disabled` already excludes it) | unaffected | unaffected | Match |
| Click-blocking on disabled `<a>` | `preventDefault` + `stopImmediatePropagation`, listener attached outside NgZone via `Renderer2` | `preventDefault` + `stopImmediatePropagation`, in-zone `(click)` binding | unchanged | Match on behavior; zone-scheduling difference is an internal perf detail, not a public a11y/RTL/API surface — out of scope for R010 |

**Gap found and fixed:** disabled anchors were keyboard-focusable (Foundation's `.disabled` class
is CSS-only). MatAnchor removes them from the tab sequence. Added
`[attr.tabindex]: isAnchor && disabled() ? -1 : null`, covered by new spec tests and the
`DisabledAnchor` story's play function.

## Convenience methods

| Surface | MatButtonBase | NfsButton (after) | Verdict |
|---|---|---|---|
| `focus(origin?, options?)` | Delegates to CDK `FocusMonitor.focusVia`, tracking focus origin (mouse/keyboard/program) to drive Material's own focus-visible styling | `focus(options?: FocusOptions)` delegates directly to `nativeElement.focus(options)` | **Gap, fixed (T02) — lean variant** |

Deliberately did not pull in `FocusMonitor`/`@angular/cdk/a11y`: origin-tracking exists to power
Material's Material-Design-specific focus-visible styling, not a general accessibility
requirement — `:focus-visible` already gives Foundation-styled buttons origin-aware focus rings
natively. Adding a new runtime dependency (`@angular/cdk`) for one convenience method would be
disproportionate. If a future component genuinely needs origin-aware focus, revisit adding CDK
then.

## Deliberately excluded (Material-specific, no Foundation equivalent, not a11y/RTL)

- **`disableRipple` / ripple effect** — Material Design's ripple is a decorative interaction
  affordance with no accessibility, RTL, or Foundation-parity bearing. Out of scope.
- **`color` (`ThemePalette`) / `appearance` (`text`/`filled`/`elevated`/`outlined`/`tonal`)** —
  Material's own theming/appearance model, superseded here by Foundation's
  `color`/`hollow`/`size` inputs (already implemented, S03).
- **`disabledInteractive`** — a genuine convenience input (keeps a disabled button focusable/
  hoverable, e.g. for tooltip explanations) with no Foundation equivalent. Not bundled into this
  slice: it changes the semantics of three host bindings (`disabled` attr, `aria-disabled`,
  `tabindex`) simultaneously and is additive, optional behavior rather than a correctness gap.
  Flagged as a candidate follow-up, not blocking R010.

## RTL

**Re-audited 2026-08-10.** The original finding rested on evidence that no longer exists: it
checked `nfs-button.styles.ts` (the S03 runtime template literal) and cited the rtlcss-compiled
`nfs-button.rtl.css` twin (S04) as what delivered RTL parity. All three of those -- the CSS-in-JS
source, the mirrored twin, and `rtlcss` itself -- are deleted. There is now one stylesheet,
`nfs-button.scss`, delivered through Angular's `styleUrl` pipeline. The conclusion survives; its
reasoning had to be redone.

Re-checked against the one surviving source of truth (`nfs-button.scss` -> `scss/_button.scss` ->
Foundation's own mixins) and its compiled output. Exactly one directional pair remains, both
declarations on `.button.dropdown::after`: `float: inline-end` and `margin-inline-start: 1em`.
They are logical rather than physical because the package rebinds Foundation's
`$global-left`/`$global-right` to `inline-start`/`inline-end` after Foundation's `@import`s, so
Foundation's unmodified `button-dropdown` emits logical properties instead of `float: right` and
`margin-left`. Everything else is symmetric shorthand (`margin: 0 0 1rem 0`,
`padding: 0.85em 1em`, uniform border and border-radius, and `.button.expanded`'s
`margin-left: 0; margin-right: 0`) or block-axis, with no side to flip. Confirmed
`MatButton`/`MatAnchor` still carry zero `Directionality`/`@angular/cdk/bidi` usage -- Material
doesn't need directional logic for a plain button either.

**Verdict: still no gap, on new evidence.** Mirroring is now a property of the single stylesheet
rather than of a mirrored build artifact, and it is gated rather than assumed:
`apps/nfs-demo/e2e/nfs-button-rtl.spec.ts` under Chromium, WebKit and Firefox, plus the
`RTL (dir="rtl") mirroring` Storybook story. Both assert the computed `margin-left`/`margin-right`
on the dropdown arrow and deliberately never `float`, which computes to `inline-end` in both
directions in all three engines. No code or SCSS change needed for this component.

## Expanded / dropdown (D017, S15)

`expanded` (full-width `display: block` button) and `dropdown` (trailing arrow indicator) are
Foundation-specific variants added in S15 with no `MatButtonBase` equivalent to compare against —
Material's own layout model uses CSS Grid/Flexbox container patterns for full-width buttons and a
separate `MatMenuTrigger` directive (not a button-level style) for a dropdown affordance, rather
than a same-component boolean input. Both are additive Foundation parity surface, not gaps against
Material, so no "before"/"after" row applies to them in the table above.

## Summary

- 2 genuine gaps found and fixed: `tabindex="-1"` on disabled anchors (a11y), `focus()` method
  (convenience).
- 1 gap deliberately deferred: `disabledInteractive` (optional, non-blocking, flagged for later).
- 2 surfaces deliberately excluded: ripple, color/appearance (Material-specific, not Foundation
  parity concerns).
- RTL: re-audited under the single-stylesheet pipeline (2026-08-10), still no gap -- the one
  directional pair, on `.button.dropdown::after`, is emitted as logical properties by Foundation's
  own mixin, and Material itself doesn't add RTL-specific button logic.
- `expanded`/`dropdown` (S15/D017): Foundation-specific variants with no Material analogue to
  compare against; not a parity gap.
