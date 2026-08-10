import { Linter } from 'eslint';
// @ts-expect-error -- ESM flat-config module; no ambient .mjs type declaration in this tsconfig (allowJs is off).
import eslintConfig from '../../../eslint.config.mjs';

/**
 * Proves R026 (no hand-fed CSS-in-JS) actually fires, not just "is written
 * down". eslint.config.mjs (commit 049949e) added two `no-restricted-syntax`
 * blocks banning `document.createElement('style')` and CSS-string
 * assignment to `.innerHTML`/`.textContent`, but had zero test coverage
 * exercising them against a real violation -- a typo'd AST selector or a
 * future flat-config refactor could silently disable either block with no
 * signal.
 *
 * This reads the LIVE config array (not a hand-duplicated copy of the
 * selectors) so an edit to eslint.config.mjs that breaks the rule breaks
 * this test too. It uses ESLint's programmatic `Linter` API to actually run
 * the extracted rule configs against representative source snippets.
 */

interface FlatConfigEntry {
  files?: string[];
  ignores?: string[];
  rules?: Record<string, unknown>;
}

const flatConfig = eslintConfig as FlatConfigEntry[];

const r026ConfigEntries = flatConfig.filter(
  (entry) => entry.rules && 'no-restricted-syntax' in entry.rules,
);

const linter = new Linter();

/**
 * Rebuilds each matched config entry keeping only its `files`/`ignores`
 * glob scoping plus the `no-restricted-syntax` rule value taken verbatim
 * from the live config -- the sibling `@angular-eslint/*` rules in the same
 * block are dropped because their plugins aren't registered on this bare
 * `Linter`, and registering them would test the plugins, not R026.
 */
function r026OnlyConfigs(): Linter.Config[] {
  return r026ConfigEntries.map((entry) => {
    const rules = entry.rules ?? {};
    const config: Linter.Config = {
      files: entry.files,
      rules: {
        'no-restricted-syntax': rules['no-restricted-syntax'] as Linter.RuleEntry,
      },
    };
    if (entry.ignores) {
      config.ignores = entry.ignores;
    }
    return config;
  });
}

function r026Messages(code: string, filePath: string): string[] {
  const messages = linter.verify(code, r026OnlyConfigs(), filePath);
  return messages
    .filter((message) => message.ruleId === 'no-restricted-syntax')
    .map((message) => message.message);
}

describe('R026 no-restricted-syntax enforcement (eslint.config.mjs)', () => {
  it('the live config still defines exactly the two documented R026 blocks', () => {
    expect(r026ConfigEntries).toHaveLength(2);
  });

  it('fires on document.createElement("style") in non-spec source', () => {
    const messages = r026Messages(
      "document.createElement('style');",
      'src/lib/nfs-button/nfs-button.ts',
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('R026');
  });

  it('fires on a CSS string assigned to .innerHTML in non-spec source', () => {
    const messages = r026Messages(
      "element.innerHTML = '.foo { color: red; }';",
      'src/lib/nfs-button/nfs-button.ts',
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('R026');
  });

  it('fires on a CSS string assigned to .textContent in non-spec source', () => {
    const messages = r026Messages(
      "element.textContent = '.foo { color: red; }';",
      'src/lib/nfs-button/nfs-button.ts',
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('R026');
  });

  it('does not fire on unrelated createElement calls or attribute writes', () => {
    const messages = r026Messages(
      "document.createElement('div'); element.setAttribute('class', 'foo');",
      'src/lib/nfs-button/nfs-button.ts',
    );

    expect(messages).toHaveLength(0);
  });

  it('exempts the documented DOM-fixture innerHTML/textContent assignment in *.spec.ts', () => {
    // Mirrors the real pattern in nfs-button.ssr.spec.ts and
    // nfs-button.hydration-modes.browser.spec.ts.
    const messages = r026Messages(
      'document.head.innerHTML = parsedDocument.head.innerHTML;',
      'src/lib/nfs-button/nfs-button.ssr.spec.ts',
    );

    expect(messages).toHaveLength(0);
  });

  it('still fires on document.createElement("style") even inside a *.spec.ts file', () => {
    // The createElement('style') block carries no spec-file `ignores`, so
    // the exemption must not accidentally widen to cover it too.
    const messages = r026Messages(
      "document.createElement('style');",
      'src/lib/nfs-button/nfs-button.ssr.spec.ts',
    );

    expect(messages).toHaveLength(1);
  });
});
