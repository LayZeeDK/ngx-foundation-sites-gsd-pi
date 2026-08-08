/**
 * Foundation for Sites button styles, hand-matched to upstream defaults
 * ($primary-color #1779ba, $secondary-color #767676, $global-radius 0,
 * $button-opacity-disabled 0.25). Loaded globally via NfsStyleLoader keyed
 * 'nfs-button'; replaced by the real SCSS-compiled output in a later slice.
 *
 * D017 (S15/T03): extended with the full $button-palette (success/warning/
 * alert fill + hollow), hand-matched to the exact values Foundation's own
 * scale-color/color-pick-contrast mixins compute for this palette (verified
 * against dist/packages/ngx-foundation-sites/css/nfs-button.css), plus
 * expanded and dropdown. The expanded/dropdown rules deliberately use only
 * CSS logical properties (margin-inline / margin-inline-start, no float,
 * no physical margin-left/margin-right) instead of Foundation's own
 * physical float + margin-left/margin-right -- this runtime path has no
 * RTL Sass recompile step (unlike nfs-button.scss's rtlcss dual-file
 * build, D018), so logical properties are what make the existing
 * dir="rtl" mirroring approach (S14) work correctly for these new variants
 * too.
 *
 * Wrapped in `@layer nfs-defaults` (Baseline widely available since March
 * 2022 -- Chrome 99, Firefox 97, Safari 15.4) so any unlayered consumer
 * override always wins the cascade regardless of DOM insertion order.
 */
export const NFS_BUTTON_STYLES = `
@layer nfs-defaults {
.button {
  display: inline-block;
  vertical-align: middle;
  margin-block: 0 1rem;
  margin-inline: 0;
  padding-block: 0.85em;
  padding-inline: 1em;
  border: 1px solid transparent;
  border-radius: 0;
  transition:
    background-color 0.25s ease-out,
    color 0.25s ease-out;
  font-size: 0.9rem;
  line-height: 1;
  text-align: center;
  cursor: pointer;
  appearance: none;
  background-color: #1779ba;
  color: #fefefe;
}

.button:hover,
.button:focus {
  background-color: #14679e;
  color: #fefefe;
}

.button.secondary {
  background-color: #767676;
  color: #fefefe;
}

.button.secondary:hover,
.button.secondary:focus {
  background-color: #5e5e5e;
  color: #fefefe;
}

.button.success {
  background-color: #3adb76;
  color: #0a0a0a;
}

.button.success:hover,
.button.success:focus {
  background-color: #22bb5b;
  color: #0a0a0a;
}

.button.warning {
  background-color: #ffae00;
  color: #0a0a0a;
}

.button.warning:hover,
.button.warning:focus {
  background-color: #cc8b00;
  color: #0a0a0a;
}

.button.alert {
  background-color: #cc4b37;
  color: #fefefe;
}

.button.alert:hover,
.button.alert:focus {
  background-color: #a53b2a;
  color: #fefefe;
}

.button.hollow {
  border: 1px solid #1779ba;
  background-color: transparent;
  color: #1779ba;
}

.button.hollow:hover,
.button.hollow:focus {
  border-color: #0c3d5d;
  color: #0c3d5d;
}

.button.hollow.secondary {
  border-color: #767676;
  color: #767676;
}

.button.hollow.secondary:hover,
.button.hollow.secondary:focus {
  border-color: #3a3a3a;
  color: #3a3a3a;
}

.button.hollow.success {
  border: 1px solid #3adb76;
  background-color: transparent;
  color: #3adb76;
}

.button.hollow.success:hover,
.button.hollow.success:focus {
  border-color: #157539;
  color: #157539;
}

.button.hollow.warning {
  border: 1px solid #ffae00;
  background-color: transparent;
  color: #ffae00;
}

.button.hollow.warning:hover,
.button.hollow.warning:focus {
  border-color: #805700;
  color: #805700;
}

.button.hollow.alert {
  border: 1px solid #cc4b37;
  background-color: transparent;
  color: #cc4b37;
}

.button.hollow.alert:hover,
.button.hollow.alert:focus {
  border-color: #67251a;
  color: #67251a;
}

.button.tiny {
  padding-block: 0.5em;
  padding-inline: 1em;
  font-size: 0.6rem;
}

.button.small {
  padding-block: 0.75em;
  padding-inline: 1em;
  font-size: 0.75rem;
}

.button.large {
  padding-block: 1em;
  padding-inline: 2em;
  font-size: 1.25rem;
}

.button.expanded {
  display: block;
  width: 100%;
  margin-inline: 0;
}

.button[disabled],
.button.disabled {
  opacity: 0.25;
  cursor: not-allowed;
  pointer-events: none;
}

.button.dropdown::after {
  display: inline-block;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0.4em;
  border-bottom-width: 0;
  border-color: #fefefe transparent transparent;
  content: "";
  position: relative;
  top: 0.4em;
  margin-inline-start: 1em;
}

.button.dropdown.hollow::after {
  border-top-color: #1779ba;
}

.button.dropdown.hollow.secondary::after {
  border-top-color: #767676;
}

.button.dropdown.hollow.success::after {
  border-top-color: #3adb76;
}

.button.dropdown.hollow.warning::after {
  border-top-color: #ffae00;
}

.button.dropdown.hollow.alert::after {
  border-top-color: #cc4b37;
}
}
`;
