// R021 lane 1 (`test`, jsdom): the preset probe's content -- Foundation's
// six global defaults and the two presets built from them.
//
// Split out of theming-panel.spec.ts's old T3 block (MEM101): the probe used
// to run via theming-presets.ts's `computePresets` (a plain async function,
// no Worker, callable directly from jsdom). It now runs inside
// theming-worker.ts's Worker via theming-probe.ts's `runPresetProbe`, which
// is exactly as callable from jsdom as it ever was -- `runPresetProbe` itself
// touches no DOM or Worker API, only `sass.compileString`, so this lane still
// resolves the Node sass build and needs no browser. The Worker-orchestration
// half (memoisation, sharing the compile Worker, not tripping the compile
// coalescer) moved to theming-inject.spec.ts, driven against the same fake
// worker port T8 already uses.
import { runPresetProbe } from '../../.storybook/theming-probe';
import type { NfsThemeDefaults } from '../../.storybook/theming-presets';

// Foundation for Sites 6.9.0's own values for the six controls (R009's control
// table). These live HERE, in the spec, as hand-written literals -- production
// code reads them from Sass via the probe, which is what R009's "no TypeScript
// copy of any of the six values exists anywhere" requires. Keeping them as the
// assertion TARGET rather than the source is what lets T3d actually fail when
// a foundation-sites bump moves one (the dependency is a `^6.9.0` range).
const FOUNDATION_DEFAULTS: NfsThemeDefaults = {
  primary: '#1779ba',
  secondary: '#767676',
  success: '#3adb76',
  warning: '#ffae00',
  alert: '#cc4b37',
  radius: 0,
};

describe('runPresetProbe -- preset baseline probe (T3)', () => {
  const { presets, defaults } = runPresetProbe();

  it('T3d: returns Foundation\'s six global defaults, read from Sass, by exact key set and value', () => {
    // R021 lane 1's "the preset baseline probe returning Foundation's six
    // global defaults ... by exact key set". This is the standing guard on
    // the drift that used to be undetectable: canonicalisation is defined
    // against these values, so if a foundation-sites bump moves one and the
    // addon does not follow, `withOverride` stops deleting the now-non-default
    // key, every theme carries a spurious override, and `deriveSelectedPreset`
    // reports `Custom` for the Foundation-default theme forever.
    expect(Object.keys(defaults).sort()).toEqual([
      'alert',
      'primary',
      'radius',
      'secondary',
      'success',
      'warning',
    ]);
    expect(defaults).toEqual(FOUNDATION_DEFAULTS);
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
