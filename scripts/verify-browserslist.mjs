// Proves R022: the workspace browserslist config stays aligned to Angular 22's
// documented "widely available Baseline" browser-support definition
// (https://angular.dev/reference/versions#browser-support) rather than
// drifting into a hand-copied, stale static browser list.
//
// The query is date-PINNED on purpose. Angular 22's definition is fixed to
// Baseline "widely available" as of 2026-05-07, so the bare rolling form
// (`baseline widely available`) drifts away from it -- and drifts looser -- as
// Baseline advances. Asserting the pinned string is what stops that drift.
import { readFileSync } from 'node:fs';
import browserslist from 'browserslist';

const CONFIG_PATH = new URL('../.browserslistrc', import.meta.url);
const REQUIRED_QUERY = 'baseline widely available on 2026-05-07';

const config = readFileSync(CONFIG_PATH, 'utf8');

if (!config.includes(REQUIRED_QUERY)) {
  console.error(
    `Browserslist parity check FAILED: .browserslistrc must contain the query "${REQUIRED_QUERY}" (Angular's own Baseline definition), found:\n${config}`,
  );
  process.exit(1);
}

const resolved = browserslist();

if (resolved.length === 0) {
  console.error(
    'Browserslist parity check FAILED: config resolved to zero browsers.',
  );
  process.exit(1);
}

console.log(
  `Browserslist parity check PASSED: "${REQUIRED_QUERY}" resolved to ${resolved.length} browser versions.`,
);
