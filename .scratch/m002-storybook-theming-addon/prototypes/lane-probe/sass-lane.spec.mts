// Ticket 10 probe: what can the `test` (jsdom) lane actually do?
//
// Questions:
//  Q1 which `sass` build does a jsdom-environment spec resolve?
//  Q2 does the real theme() chain compile from the in-memory string map there?
//  Q3 does the ticket-07 custom-`functions` palette capture work there?
//  Q4 does the BROWSER sass build run under jsdom at all?
//  Q5 is `Worker` available under jsdom?
//  Q6 does jsdom resolve a class-selector cascade in getComputedStyle?
//  Q7 does jsdom understand @layer precedence (R008's claim)?

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { expect, it } from 'vitest';

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

function sha(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

it('Q1 -- which sass build resolves under jsdom', async () => {
  const sass: any = await import('sass');
  let compileVerdict = 'compile() did NOT throw';

  try {
    sass.compile('definitely-not-a-real-file.scss');
  } catch (e: any) {
    compileVerdict = String(e.message).slice(0, 90);
  }

  console.log('[Q1] typeof sass.compile      :', typeof sass.compile);
  console.log('[Q1] sass.info                :', String(sass.info).split('\n')[0]);
  console.log('[Q1] compile() verdict        :', compileVerdict);
  console.log(
    '[Q1] BUILD                    :',
    compileVerdict.includes('only available in Node.js') ? 'BROWSER' : 'NODE',
  );
});

it('Q2 -- real chain compiles from the in-memory map under jsdom', async () => {
  const sass: any = await import('sass');
  const { importer, log } = createImporter(SOURCES);
  const css = sass.compileString(entryFor({}), {
    ...OPTIONS_BASE,
    importers: [importer],
  }).css;

  console.log('[Q2] bytes                    :', Buffer.byteLength(css, 'utf8'));
  console.log('[Q2] sha256[0:16]             :', sha(css));
  console.log('[Q2] canonicalize/load/misses :', log.canonicalize, log.load, log.misses?.length ?? 'n/a');
  expect(css).toContain('#1779ba');
});

it('Q3 -- custom functions option captures a SassMap under jsdom', async () => {
  const sass: any = await import('sass');
  const { importer } = createImporter(SOURCES);
  let captured: Record<string, string> | null = null;

  const entry = [
    "@use 'nfs:/internal/settings' as settings;",
    'a { x: capture(settings.$button-palette); }',
  ].join('\n');

  const css = sass.compileString(entry, {
    ...OPTIONS_BASE,
    importers: [importer],
    functions: {
      'capture($value)': (args: any[]) => {
        const map = args[0].assertMap('value');
        const out: Record<string, string> = {};

        map.contents.forEach((v: any, k: any) => {
          out[k.assertString().text] = v.toString();
        });
        captured = out;

        return new sass.SassString('ok', { quotes: false });
      },
    },
  }).css;

  console.log('[Q3] captured                 :', JSON.stringify(captured));
  console.log('[Q3] css                      :', css.replace(/\n/g, ' '));
});

it('Q4 -- does the BROWSER sass build run under jsdom', async () => {
  const url = pathToFileURL('node_modules/sass/sass.default.js').href;
  let verdict = 'loaded';
  let bytes = -1;

  try {
    const browserSass: any = await import(/* @vite-ignore */ url);
    const { importer } = createImporter(SOURCES);
    const css = browserSass.compileString(entryFor({}), {
      ...OPTIONS_BASE,
      importers: [importer],
    }).css;
    bytes = Buffer.byteLength(css, 'utf8');
  } catch (e: any) {
    verdict = 'THREW: ' + String(e.message).slice(0, 160);
  }

  console.log('[Q4] verdict                  :', verdict);
  console.log('[Q4] bytes                    :', bytes);
  console.log('[Q4] document.scripts present :', typeof (globalThis as any).document?.scripts);
});

it('Q5 -- Worker availability under jsdom', () => {
  console.log('[Q5] typeof Worker            :', typeof (globalThis as any).Worker);
  console.log('[Q5] typeof self              :', typeof (globalThis as any).self);
});

it('Q6/Q7 -- jsdom cascade + @layer resolution', () => {
  const layered = document.createElement('style');
  layered.textContent =
    '@layer nfs-defaults { .button { background-color: rgb(1, 1, 1); } }';
  const unlayered = document.createElement('style');
  unlayered.textContent = '.button { background-color: rgb(2, 2, 2); }';
  document.head.append(layered, unlayered);

  const el = document.createElement('button');
  el.className = 'button';
  document.body.append(el);

  const computed = getComputedStyle(el).backgroundColor;

  console.log('[Q6] computed background-color:', JSON.stringify(computed));
  console.log(
    '[Q7] verdict                  :',
    computed === 'rgb(2, 2, 2)'
      ? 'UNLAYERED wins (matches Chromium)'
      : computed === 'rgb(1, 1, 1)'
        ? 'LAYERED wins (WRONG vs Chromium)'
        : 'NO CASCADE AT ALL',
  );
});
