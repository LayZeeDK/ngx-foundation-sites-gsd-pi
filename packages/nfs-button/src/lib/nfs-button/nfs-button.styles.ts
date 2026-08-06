/**
 * Foundation for Sites button styles, hand-matched to upstream defaults
 * ($primary-color #1779ba, $secondary-color #767676, $global-radius 0,
 * $button-opacity-disabled 0.25). Loaded globally via NfsStyleLoader keyed
 * 'nfs-button'; replaced by the real SCSS-compiled output in a later slice.
 */
export const NFS_BUTTON_STYLES = `
.button {
  display: inline-block;
  vertical-align: middle;
  margin: 0 0 1rem 0;
  padding: 0.85em 1em;
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

.button.tiny {
  padding: 0.5em 1em;
  font-size: 0.6rem;
}

.button.small {
  padding: 0.75em 1em;
  font-size: 0.75rem;
}

.button.large {
  padding: 1em 2em;
  font-size: 1.25rem;
}

.button[disabled],
.button.disabled {
  opacity: 0.25;
  cursor: not-allowed;
  pointer-events: none;
}
`;
