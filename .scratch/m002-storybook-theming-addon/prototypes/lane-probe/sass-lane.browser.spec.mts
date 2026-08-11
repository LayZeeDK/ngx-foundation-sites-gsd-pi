// Ticket 10 probe: what does the `test-browser` lane (real Chromium, Vitest
// browser mode) give us that jsdom does not?
//  B1 which sass build resolves there?
//  B2 does the real theme() chain compile there, and to the same bytes?
//  B3 is Worker available?
//  B4 does @layer precedence resolve the way ticket 09 measured in Chromium?
//  B5 does the injected compiled CSS drive a real computed style?

import { expect, it } from 'vitest';

import sources from './out/sources.json';
import { createImporter, entryFor } from '../importer.mjs';

const OPTIONS_BASE = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  alertColor: false,
} as const;

it('B1 -- which sass build resolves in browser mode', async () => {
  const sass: any = await import('sass');
  let verdict = 'compile() did NOT throw';

  try {
    sass.compile('nope.scss');
  } catch (e: any) {
    verdict = String(e.message).slice(0, 90);
  }

  console.log('[B1] compile() verdict :', verdict);
  console.log(
    '[B1] BUILD             :',
    verdict.includes('only available in Node.js') ? 'BROWSER' : 'NODE',
  );
  console.log('[B1] key count         :', Object.keys(sass).length);
});

it('B2 -- real chain compiles in real Chromium', async () => {
  const sass: any = await import('sass');
  const { importer } = createImporter(sources as Record<string, string>);
  const css = sass.compileString(entryFor({}), {
    ...OPTIONS_BASE,
    importers: [importer],
  }).css;

  const bytes = new TextEncoder().encode(css).length;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(css));
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);

  console.log('[B2] bytes             :', bytes);
  console.log('[B2] sha256[0:16]      :', hex);
  expect(css).toContain('#1779ba');
});

it('B3 -- Worker availability', () => {
  console.log('[B3] typeof Worker     :', typeof Worker);
});

it('B4/B5 -- @layer precedence and computed style in real Chromium', () => {
  const layered = document.createElement('style');
  layered.textContent =
    '@layer nfs-defaults { .btnB4 { background-color: rgb(1, 1, 1); } }';
  const unlayered = document.createElement('style');
  unlayered.textContent = '.btnB4 { background-color: rgb(2, 2, 2); }';
  // layered LAST: still must lose to the unlayered rule.
  document.head.append(unlayered, layered);

  const el = document.createElement('button');
  el.className = 'btnB4';
  document.body.append(el);

  console.log('[B4] computed          :', getComputedStyle(el).backgroundColor);

  const onlyLayered = document.createElement('style');
  onlyLayered.textContent =
    '@layer nfs-defaults { .btnB5 { background-color: rgb(3, 3, 3); } }';
  document.head.append(onlyLayered);

  const el2 = document.createElement('button');
  el2.className = 'btnB5';
  document.body.append(el2);

  console.log('[B5] layered-only      :', getComputedStyle(el2).backgroundColor);
});
