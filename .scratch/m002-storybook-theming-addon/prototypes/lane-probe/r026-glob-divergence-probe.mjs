// Ticket 10 probe: can a SPEC-lane assertion catch the "green nx test, red
// nx lint" class ticket 09 E.4 found -- a config-dir-relative `ignores` glob
// that works when ESLint's base path is the package root and is INERT when
// Nx chdir's to the workspace root?
//
// Idea under test: run the same code through the live config twice in one
// process, once with a PACKAGE-relative file path and once with a
// WORKSPACE-ROOT-relative one. A `**/`-prefixed glob must be exempt in both;
// a config-dir-relative glob must diverge.
//
// Run from the workspace root: node .scratch/.../r026-glob-divergence-probe.mjs

import { Linter } from 'eslint';

import liveConfig from '../../../../packages/ngx-foundation-sites/eslint.config.mjs';

const INJECTION = "document.createElement('style');\nel.textContent = '.a{b:c}';";

const EXEMPT_PKG_REL = '.storybook/theming/inject-theme-style.ts';
const EXEMPT_ROOT_REL =
  'packages/ngx-foundation-sites/.storybook/theming/inject-theme-style.ts';

const linter = new Linter();

function r026Blocks(config) {
  return config.filter((entry) => entry.rules && 'no-restricted-syntax' in entry.rules);
}

function carve(config, extraIgnore) {
  return r026Blocks(config).map((entry) => {
    const out = {
      files: entry.files,
      rules: {
        'no-restricted-syntax': entry.rules['no-restricted-syntax'],
      },
    };

    if (entry.ignores) {
      out.ignores = entry.ignores.includes('**/*.spec.ts')
        ? [...entry.ignores, extraIgnore]
        : [...entry.ignores];
    }

    return out;
  });
}

function count(configs, filePath) {
  return linter
    .verify(INJECTION, configs, filePath)
    .filter((m) => m.ruleId === 'no-restricted-syntax').length;
}

const variants = [
  ['config-dir-relative', '.storybook/theming/inject-theme-style.ts'],
  ['**/-prefixed      ', '**/.storybook/theming/inject-theme-style.ts'],
];

console.log('cwd =', process.cwd());
console.log('baseline R026 block count =', r026Blocks(liveConfig).length);
console.log('');
console.log('glob spelling         | pkg-relative path | root-relative path');
console.log('----------------------+-------------------+-------------------');

for (const [label, glob] of variants) {
  const configs = carve(liveConfig, glob);
  const pkg = count(configs, EXEMPT_PKG_REL);
  const root = count(configs, EXEMPT_ROOT_REL);

  console.log(
    `${label} | ${String(pkg).padStart(17)} | ${String(root).padStart(17)}`,
  );
}

console.log('');
console.log('(2 = R026 fires, 0 = exempt. A spelling that is 0/2 is the trap.)');

// Static shape check -- the cheap standing assertion this probe is evaluating.
const allIgnores = r026Blocks(liveConfig).flatMap((e) => e.ignores ?? []);

console.log('');
console.log('live ignores globs    :', JSON.stringify(allIgnores));
console.log(
  'all **/-prefixed      :',
  allIgnores.every((g) => g.startsWith('**/')),
);
