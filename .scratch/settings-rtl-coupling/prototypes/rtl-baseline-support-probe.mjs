// Ticket 02 -- does the eliminator's CSS surface clear the repo's PINNED
// browserslist baseline (R022, `.browserslistrc`)?
//
// The mechanism uses exactly three features beyond what Foundation already
// emits: `:dir()`, `:where()`, and (only in the NAIVE construction that this
// ticket rejects) `revert-layer`. Same method the repo's own R022 note uses:
// resolve the pinned query with browserslist, then read caniuse-lite.
//
// Read-only. Usage: node rtl-baseline-support-probe.mjs

import browserslist from 'browserslist';
import unpack from 'caniuse-lite/dist/unpacker/feature.js';

import { repoRoot } from './rtl-eliminator.mjs';

const FEATURES = [
  ['css-dir-pseudo', ':dir()  -- the direction selector the twins use'],
  ['css-matches-pseudo', ':where()/:is() -- zero-specificity wrapper'],
  ['css-cascade-layers', '@layer -- R008 unlayered-beats-layered split'],
  ['css-revert-value', 'revert / revert-layer -- ONLY the naive construction'],
  ['css-logical-props', 'logical properties -- the R004 rebind (for comparison)'],
];

const targets = browserslist(null, { path: repoRoot });

console.log(`pinned browserslist query resolves to ${targets.length} targets\n`);
console.log('feature                supported / total   verdict');

for (const [id, why] of FEATURES) {
  let data;

  try {
    data = unpack((await import(`caniuse-lite/data/features/${id}.js`)).default ?? (await import(`caniuse-lite/data/features/${id}.js`)));
  } catch (error) {
    console.log(`${id.padEnd(22)} [SKIP] ${String(error.message).split('\n')[0]}`);

    continue;
  }

  let ok = 0;
  const failures = [];

  for (const target of targets) {
    const [name, version] = target.split(' ');
    const stat = data.stats[name]?.[version];

    // caniuse flags: "y" full, "a" partial, "n" no, "x" prefixed, "#n" note.
    if (stat && /^(y|a)/.test(stat)) {
      ok += 1;
    } else {
      failures.push(`${target}=${stat ?? 'unknown'}`);
    }
  }

  console.log(
    `${id.padEnd(22)} ${String(ok).padStart(9)} / ${String(targets.length).padEnd(5)}  ` +
      `${ok === targets.length ? '[OK] all targets' : `[WARN] fails ${targets.length - ok}: ${failures.slice(0, 6).join(', ')}`}   ${why}`,
  );
}
