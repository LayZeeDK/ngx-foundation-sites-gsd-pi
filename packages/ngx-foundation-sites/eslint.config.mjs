import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/src/**/*.spec.ts',
            // Build-time verification tooling. Never published (ng-package.json
            // ships only src/scss/**/*.scss), so its postcss/sass imports are
            // not part of the package's dependency contract.
            '{projectRoot}/scripts/**/*.mjs',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'nfs',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'lib',
          style: 'kebab-case',
        },
      ],
    },
  },
  // R026: no hand-fed CSS-in-JS. Angular's own styleUrl + SharedStylesHost
  // pipeline is the only sanctioned default-styling source; a runtime
  // style-injection service (like the removed NfsStyleLoader/NfsStyleExtractor)
  // must not be reintroduced.
  //
  // Split into two mutually-exclusive-by-file-scope blocks (rather than one
  // universal block plus one spec-scoped override) because flat config does
  // NOT merge same-named rule arrays across matching config objects -- a
  // later block's 'no-restricted-syntax' value fully replaces an earlier
  // one's for any file both blocks match. Combining both selectors into a
  // single array per scope keeps each file governed by exactly one
  // 'no-restricted-syntax' definition.
  {
    // Non-spec source: both the createElement('style') and
    // innerHTML/textContent halves are banned.
    //
    // Exemption: `.storybook/theming-inject.ts` is the Theming addon's
    // Worker-compiled CSS injection point (D035 part d/e) -- it owns the
    // single shared `<style id="nfs-theming">` node that the addon's
    // Worker-compiled Sass output is written into. This is Storybook
    // tooling, never shipped in the published package, so it is exempt from
    // R026's "no hand-fed CSS-in-JS" default-styling rule the same way the
    // spec-file DOM-fixture case below is.
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/.storybook/theming-inject.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name='createElement'] > Literal[value='style']",
          message:
            'R026: creating a <style> element at runtime is banned (no hand-fed CSS-in-JS). Default styling must come from styleUrl-compiled SCSS via SharedStylesHost.',
        },
        {
          selector:
            'AssignmentExpression[left.type="MemberExpression"][left.property.name=/^(textContent|innerHTML)$/]',
          message:
            'R026: assigning a CSS string to a DOM node is banned (no hand-fed CSS-in-JS). Default styling must come from styleUrl-compiled SCSS via SharedStylesHost.',
        },
      ],
    },
  },
  {
    // Specs: only the createElement('style') half applies. The
    // innerHTML/textContent half is intentionally exempted here -- SSR/
    // hydration test harnesses legitimately transplant whole parsed
    // documents (nfs-button.ssr.spec.ts, .hydration-modes.browser.spec.ts)
    // to simulate browser hydration, which is DOM-fixture setup, not
    // CSS-in-JS.
    files: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name='createElement'] > Literal[value='style']",
          message:
            'R026: creating a <style> element at runtime is banned (no hand-fed CSS-in-JS). Default styling must come from styleUrl-compiled SCSS via SharedStylesHost.',
        },
      ],
    },
  },
  {
    files: ['**/nfs-button/nfs-button.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'nfs',
          style: 'camelCase',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
