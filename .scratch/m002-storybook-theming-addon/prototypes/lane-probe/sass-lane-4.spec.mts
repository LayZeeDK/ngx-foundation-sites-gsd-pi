// Ticket 10 probe, round 4. Round 1's Q4 said the browser sass build THREW
// under jsdom; round 3 (a file that never imports the node build) says it
// compiles the real chain fine. Hypothesis: loading BOTH dart2js entries
// (sass.node.mjs and sass.default.js) in one context breaks the second one.

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

it('Q9 -- node build FIRST, then browser build, same context', async () => {
  const nodeSass: any = await import('sass');
  const { importer: i1 } = createImporter(SOURCES);

  console.log(
    '[Q9] node build chain        :',
    Buffer.byteLength(
      nodeSass.compileString(entryFor({}), { ...OPTIONS_BASE, importers: [i1] }).css,
      'utf8',
    ),
    'bytes',
  );

  const url = pathToFileURL('node_modules/sass/sass.default.js').href;
  const browserSass: any = await import(/* @vite-ignore */ url);
  const { importer: i2 } = createImporter(SOURCES);

  try {
    const css = browserSass.compileString(entryFor({}), {
      ...OPTIONS_BASE,
      importers: [i2],
    }).css;

    console.log('[Q9] browser build chain     : OK ->', Buffer.byteLength(css, 'utf8'), 'bytes');
  } catch (e: any) {
    console.log('[Q9] browser build chain     : THREW ->', String(e.message).slice(0, 200));
    console.log('[Q9] CONFIRMED               : dual-entry load breaks the second dart2js runtime');
  }
});
