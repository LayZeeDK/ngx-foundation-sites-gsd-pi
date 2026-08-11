// Ticket 10 probe, round 3. Isolates the two ambiguities left by round 2.
//  Q4c the browser sass build LOADS and compiles a trivial string under jsdom.
//      So what exactly failed in round 1 -- the custom importer, or the chain?
//  Q7c is jsdom's @layer result real support, or does jsdom DROP layered rules
//      entirely (which would look identical in both orders tested so far)?

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { it } from 'vitest';

import { createImporter, entryFor } from '../importer.mjs';

const SOURCES = JSON.parse(
  readFileSync(
    '.scratch/m002-storybook-theming-addon/prototypes/lane-probe/out/sources.json',
    'utf8',
  ),
) as Record<string, string>;

const OPTIONS_BASE = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  alertColor: false,
} as const;

it('Q4c -- browser build: importer alone, then the real chain', async () => {
  const url = pathToFileURL('node_modules/sass/sass.default.js').href;
  const browserSass: any = await import(/* @vite-ignore */ url);

  // Step 1: a trivial @use through the custom importer.
  try {
    const { importer } = createImporter({ 'nfs:/_tiny.scss': '$x: 1px;' });
    const css = browserSass.compileString(
      "@use 'nfs:/tiny' as t;\na { b: t.$x; }\n",
      { ...OPTIONS_BASE, importers: [importer] },
    ).css;

    console.log('[Q4c] step1 importer         : OK ->', JSON.stringify(css));
  } catch (e: any) {
    console.log('[Q4c] step1 importer         : THREW ->', String(e.message).slice(0, 200));
  }

  // Step 2: the real theme() chain from the 16-file map.
  try {
    const { importer } = createImporter(SOURCES);
    const css = browserSass.compileString(entryFor({}), {
      ...OPTIONS_BASE,
      importers: [importer],
    }).css;

    console.log('[Q4c] step2 real chain       : OK ->', Buffer.byteLength(css, 'utf8'), 'bytes');
  } catch (e: any) {
    console.log('[Q4c] step2 real chain       : THREW ->', String(e.message).slice(0, 200));
    console.log(
      '[Q4c] stack head             :',
      String(e.stack).split('\n').slice(0, 5).join(' | ').slice(0, 400),
    );
  }

  // Step 3: the same chain but WITHOUT silenceDeprecations, in case the
  // deprecation-warning path is what needs a browser-only global.
  try {
    const { importer } = createImporter(SOURCES);
    const css = browserSass.compileString(entryFor({}), {
      importers: [importer],
      quietDeps: true,
      alertColor: false,
    }).css;

    console.log('[Q4c] step3 no-silence       : OK ->', Buffer.byteLength(css, 'utf8'), 'bytes');
  } catch (e: any) {
    console.log('[Q4c] step3 no-silence       : THREW ->', String(e.message).slice(0, 200));
  }
});

it('Q7c -- does jsdom parse layered rules at all', () => {
  const layered = document.createElement('style');
  layered.textContent =
    '@layer nfs-defaults { .btn7c { background-color: rgb(1, 1, 1); } }';
  document.head.append(layered);

  const el = document.createElement('button');
  el.className = 'btn7c';
  document.body.append(el);

  const computed = getComputedStyle(el).backgroundColor;

  console.log('[Q7c] computed (layered only):', JSON.stringify(computed));
  console.log(
    '[Q7c] verdict                :',
    computed === 'rgb(1, 1, 1)'
      ? 'jsdom APPLIES layered rules -> its @layer precedence is real'
      : 'jsdom DROPS layered rules -> Q6/Q7b were vacuous',
  );
});
