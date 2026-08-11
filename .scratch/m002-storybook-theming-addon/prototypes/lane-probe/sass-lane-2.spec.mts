// Ticket 10 probe, round 2. Sharpens three answers from round 1:
//  Q4b where exactly does the BROWSER sass build die under jsdom?
//  Q7b is jsdom's @layer result real, or is it just IGNORING @layer?
//       (reverse insertion order is the discriminator: real @layer support
//        keeps UNLAYERED winning; ignoring @layer makes LAST win.)
//  Q8  is structuredClone available in the jsdom lane (error-serialisation
//       assertion), and does it drop sassMessage/span?

import { pathToFileURL } from 'node:url';

import { it } from 'vitest';

it('Q4b -- browser sass build under jsdom: import vs call', async () => {
  const url = pathToFileURL('node_modules/sass/sass.default.js').href;
  let stage = 'import';
  let mod: any = null;

  try {
    mod = await import(/* @vite-ignore */ url);
    stage = 'imported OK';
    console.log('[Q4b] typeof compileString   :', typeof mod.compileString);
    stage = 'compileString';
    mod.compileString('a { b: c; }');
    stage = 'compileString OK';
  } catch (e: any) {
    console.log('[Q4b] died at stage          :', stage);
    console.log('[Q4b] message                :', String(e.message).slice(0, 200));
    console.log(
      '[Q4b] stack head             :',
      String(e.stack).split('\n').slice(0, 4).join(' | ').slice(0, 300),
    );

    return;
  }

  console.log('[Q4b] SURVIVED                :', stage);
});

it('Q7b -- reverse order: does jsdom really implement @layer', () => {
  const unlayered = document.createElement('style');
  unlayered.textContent = '.btn7b { background-color: rgb(2, 2, 2); }';
  const layered = document.createElement('style');
  layered.textContent =
    '@layer nfs-defaults { .btn7b { background-color: rgb(1, 1, 1); } }';
  // UNLAYERED first, LAYERED second -- Chromium still says unlayered wins.
  document.head.append(unlayered, layered);

  const el = document.createElement('button');
  el.className = 'btn7b';
  document.body.append(el);

  const computed = getComputedStyle(el).backgroundColor;

  console.log('[Q7b] computed               :', JSON.stringify(computed));
  console.log(
    '[Q7b] verdict                :',
    computed === 'rgb(2, 2, 2)'
      ? 'UNLAYERED wins -- real @layer support'
      : computed === 'rgb(1, 1, 1)'
        ? 'LAYERED wins -- jsdom IGNORES @layer (round 1 was a false positive)'
        : 'NO CASCADE',
  );
});

it('Q8 -- structuredClone of a sass.Exception-shaped error under jsdom', () => {
  console.log('[Q8] typeof structuredClone  :', typeof structuredClone);

  class FakeSassException extends Error {
    sassMessage = '$color: notacolor is not a color.';
    span = { url: 'fnd:/scss/components/_button.scss' };

    constructor() {
      super('long multi-line message');
      this.name = 'sass.Exception';
    }
  }

  try {
    const cloned: any = structuredClone(new FakeSassException());

    console.log('[Q8] name after clone        :', cloned.name);
    console.log('[Q8] sassMessage after clone :', cloned.sassMessage);
    console.log('[Q8] span after clone        :', cloned.span);
    console.log('[Q8] own keys                :', JSON.stringify(Object.keys(cloned)));
  } catch (e: any) {
    console.log('[Q8] THREW                   :', String(e.message).slice(0, 160));
  }
});
