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
      // R026: no hand-fed CSS-in-JS. Angular's own styleUrl + SharedStylesHost
      // pipeline is the only sanctioned default-styling source; a runtime
      // style-injection service (like the removed NfsStyleLoader/NfsStyleExtractor)
      // must not be reintroduced.
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
    // Same R026 guard as above, but the innerHTML/textContent half is scoped
    // away from specs: SSR/hydration test harnesses legitimately transplant
    // whole parsed documents (nfs-button.ssr.spec.ts, .hydration-modes.browser.spec.ts)
    // to simulate browser hydration -- that's DOM-fixture setup, not CSS-in-JS.
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
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
