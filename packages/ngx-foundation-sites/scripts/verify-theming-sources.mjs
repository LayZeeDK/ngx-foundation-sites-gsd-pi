// D034 gate: regenerates the theming-sources closure in memory (via the same
// `generateSources`/`renderModule` the generator itself uses) and
// byte-compares it against the committed `.storybook/theming-sources.
// generated.ts`. Per section 10.3 of the M002 handoff, this must never assert
// a literal closure file count -- adding a themeable or data module is a
// correct change and must stay green on re-generate, not go red for the wrong
// reason. `renderModule` inlines `THEMEABLE_MODULES` via `JSON.stringify`
// (see generate-theming-sources.mjs), so this single byte-compare already
// covers the entry-point arrays, not just the closure contents.
import { readFileSync } from 'node:fs';
import { dirname as pathDirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSources, renderModule } from './generate-theming-sources.mjs';

const here = pathDirname(fileURLToPath(import.meta.url));
const COMMITTED_PATH = join(here, '../.storybook/theming-sources.generated.ts');

const committed = readFileSync(COMMITTED_PATH, 'utf8');
const regenerated = renderModule(generateSources());

if (regenerated !== committed) {
  console.error(
    [
      'Theming sources verification FAILED.',
      `${COMMITTED_PATH} does not byte-match the in-memory regeneration.`,
      'Regenerate and commit the result:',
      '  node packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(
  'Theming sources verification PASSED: committed module byte-matches the in-memory regeneration (entry-point arrays included via the rendered THEMEABLE_MODULES literal).',
);
