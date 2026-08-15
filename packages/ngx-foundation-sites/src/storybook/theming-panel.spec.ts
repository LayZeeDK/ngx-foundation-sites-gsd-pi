// R021 lane 1 (`test`, jsdom): validation boundary, preset baseline, preset
// equality and the whole-theme-drop hazard.
//
// Placed under src/storybook/ rather than beside the modules under test in
// `.storybook/` (mirroring src/scripts/generate-theming-sources.spec.ts's own
// precedent): the `test` target's `include` defaults to `**/*.spec.ts` with
// `cwd: sourceRoot` (`src/`), and `.storybook/` is a sibling of `src/`, not a
// descendant -- confirmed via `nx run ngx-foundation-sites:test --listTests`,
// which discovers nothing under `.storybook/`. `tsconfig.spec.json` also
// gained `"jsx": "react-jsx"` (this task) because `theming-worker.ts`'s
// `import type { NfsTheme } from './theming-panel'` resolves into the
// `.tsx` file even for a type-only import, and TS6142s without it.
import { buildArgsParam } from 'storybook/internal/router';

import {
  clampRadius,
  NFS_THEME_DEFAULTS,
  normalizeHexColor,
  withOverride,
  type NfsTheme,
} from '../../.storybook/theming-panel';
import {
  computePresets,
  deriveSelectedPreset,
  NFS_CUSTOM_PRESET_NAME,
  type NfsPreset,
} from '../../.storybook/theming-presets';

describe('normalizeHexColor', () => {
  it('normalizes 6-digit hex to lowercase', () => {
    expect(normalizeHexColor('#1779BA')).toBe('#1779ba');
  });

  it('expands 3-digit hex and lowercases it', () => {
    expect(normalizeHexColor('#ABC')).toBe('#aabbcc');
  });

  it('trims surrounding whitespace before validating', () => {
    expect(normalizeHexColor('  #1779ba  ')).toBe('#1779ba');
  });

  it('rejects 4- and 8-digit hex (no alpha channel support)', () => {
    expect(normalizeHexColor('#1779baff')).toBeNull();
    expect(normalizeHexColor('#abcd')).toBeNull();
  });

  it('rejects non-hex input', () => {
    expect(normalizeHexColor('notacolor')).toBeNull();
    expect(normalizeHexColor('red')).toBeNull();
  });
});

describe('clampRadius', () => {
  it('accepts an in-range integer string and returns a number', () => {
    expect(clampRadius('4')).toBe(4);
  });

  it('accepts the boundary values 0 and 32', () => {
    expect(clampRadius('0')).toBe(0);
    expect(clampRadius('32')).toBe(32);
  });

  it('rejects non-integers, out-of-range values, and blank input', () => {
    expect(clampRadius('0.5')).toBeNull();
    expect(clampRadius('-1')).toBeNull();
    expect(clampRadius('33')).toBeNull();
    expect(clampRadius('')).toBeNull();
    expect(clampRadius('   ')).toBeNull();
    expect(clampRadius('not-a-number')).toBeNull();
  });
});

describe('withOverride -- canonicalisation-deletes-default-key (T4a, load-bearing)', () => {
  it('deletes the key when the written value equals the Foundation default', () => {
    const withPrimarySet = withOverride({}, 'primary', '#ff0000', NFS_THEME_DEFAULTS.primary);
    expect(withPrimarySet).toEqual({ primary: '#ff0000' });

    const backToDefault = withOverride(
      withPrimarySet,
      'primary',
      NFS_THEME_DEFAULTS.primary,
      NFS_THEME_DEFAULTS.primary
    );
    expect(backToDefault).toEqual({});
    expect('primary' in backToDefault).toBe(false);
  });

  it('leaves sibling keys untouched when deleting one key', () => {
    const theme: NfsTheme = { primary: '#ff0000', radius: 8 };
    const result = withOverride(theme, 'primary', NFS_THEME_DEFAULTS.primary, NFS_THEME_DEFAULTS.primary);
    expect(result).toEqual({ radius: 8 });
  });

  it('round-trips: repeated set/unset returns to the original canonical-minimal shape', () => {
    const original: NfsTheme = { secondary: '#000000' };
    const afterDetour = withOverride(
      withOverride(original, 'primary', '#123456', NFS_THEME_DEFAULTS.primary),
      'primary',
      NFS_THEME_DEFAULTS.primary,
      NFS_THEME_DEFAULTS.primary
    );
    expect(afterDetour).toEqual(original);
  });
});

describe('computePresets -- preset baseline probe (T3)', () => {
  let presets: readonly NfsPreset[];

  beforeAll(async () => {
    presets = await computePresets();
  });

  it('returns exactly two presets, keyed by exact name', () => {
    expect(presets.map((preset) => preset.name)).toEqual(['Foundation default', 'WCAG-compliant']);
  });

  it("'Foundation default' is the empty theme", () => {
    expect(presets[0].theme).toEqual({});
  });

  it("'WCAG-compliant' overrides exactly success/warning/alert, by exact key set", () => {
    const compliant = presets[1].theme;
    expect(Object.keys(compliant).sort()).toEqual(['alert', 'success', 'warning']);
  });

  it('T10: the compliant preset is byte-identical to the nfs-demo axe-proven palette', () => {
    // These three literals are the axe fixture's proof
    // (apps/nfs-demo/e2e/nfs-button-a11y.spec.ts's m002-compliant fixture) --
    // duplicated here as hand-written literals, not read from the preset
    // itself, so this assertion can actually fail if the preset regresses.
    expect(presets[1].theme).toEqual({
      success: '#238648',
      warning: '#9e6c00',
      alert: '#cb4b37',
    });
  });
});

describe('deriveSelectedPreset -- preset equality (T4)', () => {
  const presetA: NfsPreset = { name: 'A', theme: { primary: '#111111' } };
  const presetB: NfsPreset = { name: 'B', theme: { secondary: '#222222' } };
  const presets = [presetA, presetB];

  it('T4c: matches true when the live theme equals a preset exactly', () => {
    expect(deriveSelectedPreset(presets, { primary: '#111111' })).toBe('A');
  });

  it('T4c: does not match when exactly one value diverges', () => {
    expect(deriveSelectedPreset(presets, { primary: '#999999' })).toBe(NFS_CUSTOM_PRESET_NAME);
  });

  it('T4d: first match wins when two presets share a signature', () => {
    const duplicate: NfsPreset = { name: 'A-duplicate', theme: { primary: '#111111' } };
    expect(deriveSelectedPreset([presetA, duplicate], { primary: '#111111' })).toBe('A');
  });

  it("T4d: no match yields the literal 'Custom'", () => {
    expect(deriveSelectedPreset(presets, { primary: '#111111', secondary: '#222222' })).toBe(
      NFS_CUSTOM_PRESET_NAME
    );
    expect(deriveSelectedPreset([], {})).toBe(NFS_CUSTOM_PRESET_NAME);
  });

  it('a non-canonical theme (default-valued key still present) is NOT matched -- proves the theorem depends on withOverride', () => {
    // presets[0] here plays "Foundation default" (empty theme); a live theme
    // that explicitly repeats the default value for a key it should have
    // omitted must NOT be treated as equal to the empty preset.
    const foundationDefault: NfsPreset = { name: 'Foundation default', theme: {} };
    expect(
      deriveSelectedPreset([foundationDefault], { primary: NFS_THEME_DEFAULTS.primary })
    ).toBe(NFS_CUSTOM_PRESET_NAME);
  });
});

describe('buildArgsParam -- the whole-theme-drop hazard (T5)', () => {
  it('a fully valid theme yields a non-empty ?globals= value', () => {
    const param = buildArgsParam({ nfsTheme: {} }, { nfsTheme: { primary: '#ff0000', radius: 4 } });
    expect(param).toBe('nfsTheme.primary:!hex(ff0000);nfsTheme.radius:4');
  });

  it('a deliberately-invalid control (radius carrying a unit string) drops the ENTIRE theme, not just that key', () => {
    const invalidTheme = {
      primary: '#ff0000',
      secondary: '#00ff00',
      success: '#0000ff',
      radius: '0.5rem',
    } as unknown as NfsTheme;

    const param = buildArgsParam({ nfsTheme: {} }, { nfsTheme: invalidTheme });

    expect(param).toBe('');
  });

  it('the default (empty) theme yields an empty ?globals=', () => {
    const param = buildArgsParam({ nfsTheme: {} }, { nfsTheme: {} });
    expect(param).toBe('');
  });
});
