// Tests eslint.config.mjs's R026 exemption for theming-inject.ts, not
// theming-worker.ts -- split out of theming-worker.spec.ts (MEM106), which
// had accreted this as a third, unrelated subject. Naming and structure
// follow nfs-button.r026-lint.spec.ts's convention: read the LIVE config
// array and run it through ESLint's programmatic `Linter` API, rather than
// hand-duplicating the selectors.
import { Linter } from 'eslint';
// @ts-expect-error -- ESM flat-config module; no ambient .mjs type declaration in this tsconfig (allowJs is off).
import eslintConfig from '../../eslint.config.mjs';

interface FlatConfigEntry {
  files?: string[];
  ignores?: string[];
  rules?: Record<string, unknown>;
}

const flatConfig = eslintConfig as FlatConfigEntry[];
const r026Entries = flatConfig.filter((entry) => entry.rules && 'no-restricted-syntax' in entry.rules);
const linter = new Linter();

function r026OnlyConfigs(): Linter.Config[] {
  return r026Entries.map((entry) => {
    const rules = entry.rules ?? {};
    const config: Linter.Config = {
      files: entry.files,
      rules: { 'no-restricted-syntax': rules['no-restricted-syntax'] as Linter.RuleEntry },
    };
    if (entry.ignores) {
      config.ignores = entry.ignores;
    }
    return config;
  });
}

function r026MessageCount(code: string, filePath: string): number {
  return linter.verify(code, r026OnlyConfigs(), filePath).filter((m) => m.ruleId === 'no-restricted-syntax')
    .length;
}

const INJECTION = "document.createElement('style');\nel.textContent = '.a{b:c}';";

describe('R026 path-spelling divergence guard (T9)', () => {
  it('T9a: theming-inject.ts is exempt (0 messages)', () => {
    expect(r026MessageCount(INJECTION, '.storybook/theming-inject.ts')).toBe(0);
  });

  it('T9b: a sibling non-exempt file in the same directory still fires (exemption is exactly one file wide)', () => {
    expect(r026MessageCount(INJECTION, '.storybook/theming-worker.ts')).toBe(2);
  });

  it('T9c: the exemption holds under BOTH a package-relative and a workspace-root-relative path spelling', () => {
    expect(r026MessageCount(INJECTION, '.storybook/theming-inject.ts')).toBe(0);
    expect(
      r026MessageCount(INJECTION, 'packages/ngx-foundation-sites/.storybook/theming-inject.ts')
    ).toBe(0);
  });

  it('T9d: every ignores glob in the R026 blocks is **/-prefixed (the shape that makes T9c hold)', () => {
    const allIgnores = r026Entries.flatMap((entry) => entry.ignores ?? []);
    expect(allIgnores.length).toBeGreaterThan(0);
    expect(allIgnores.every((glob) => glob.startsWith('**/'))).toBe(true);
  });
});
