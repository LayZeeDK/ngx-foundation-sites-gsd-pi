// D031 gate: the declared `exports` map in the source package.json really
// does survive ng-packagr's build unchanged.
//
// The source package.json's own `//exports` comment documents WHY each key
// exists (the `./scss/internal/*: null` blocker, the `./scss/button` alias,
// the `./scss/*`/`./css/*` identity maps) -- but nothing previously asserted
// that ng-packagr's BUILT package.json actually ships them. S06 research
// confirmed byte-for-byte parity on current main; this script is what keeps
// that true going forward instead of relying on a one-time manual check.
//
// ng-packagr adds exactly two keys of its own on top of whatever is declared
// here: `.` (the package's main entry point, with `types`/`default`) and
// `./package.json` (so `require('pkg/package.json')` keeps working under
// `exports`). Both are additive scaffolding, not part of the Sass/CSS surface
// this gate is protecting, so they are the only keys allowed to exist in the
// dist map without a source counterpart.
import { readFileSync } from 'node:fs';

const SOURCE_PACKAGE_JSON = 'packages/ngx-foundation-sites/package.json';
const DIST_PACKAGE_JSON = 'dist/packages/ngx-foundation-sites/package.json';
const NG_PACKAGR_OWN_KEYS = new Set(['.', './package.json']);

function readExports(path) {
  const pkg = JSON.parse(readFileSync(path, 'utf8'));

  if (!pkg.exports || typeof pkg.exports !== 'object') {
    throw new Error(`${path} has no \`exports\` map`);
  }

  return pkg.exports;
}

const failures = [];

function fail(message) {
  failures.push(message);
}

let sourceExports;
let distExports;

try {
  sourceExports = readExports(SOURCE_PACKAGE_JSON);
} catch (error) {
  console.error(
    `Exports-map check FAILED: could not read ${SOURCE_PACKAGE_JSON}: ${error.message}`,
  );
  process.exit(1);
}

try {
  distExports = readExports(DIST_PACKAGE_JSON);
} catch (error) {
  console.error(
    `Exports-map check FAILED: could not read ${DIST_PACKAGE_JSON}: ${error.message}. ` +
      'Run `nx run ngx-foundation-sites:build` first -- this target depends on `build`.',
  );
  process.exit(1);
}

// Check 1 (forward): every declared source key must survive the build with
// an identical value. This is the check that catches ticket-08-style drift --
// a key silently dropped or its value silently rewritten by a build change.
for (const [key, sourceValue] of Object.entries(sourceExports)) {
  if (!(key in distExports)) {
    fail(
      `\`${key}\` is declared in ${SOURCE_PACKAGE_JSON}'s exports map but missing from ${DIST_PACKAGE_JSON}`,
    );
    continue;
  }

  const distValue = distExports[key];
  const sourceJson = JSON.stringify(sourceValue);
  const distJson = JSON.stringify(distValue);

  if (sourceJson !== distJson) {
    fail(
      `\`${key}\` drifted during build: ${SOURCE_PACKAGE_JSON} declares ${sourceJson}, ` +
        `${DIST_PACKAGE_JSON} ships ${distJson}`,
    );
  }
}

// Check 2 (reverse): the dist map must not contain keys the source map never
// declared, other than ng-packagr's own `.` and `./package.json`. Catches an
// ng-packagr upgrade that starts emitting an extra key, or a source key that
// was renamed without updating this gate's expectations.
for (const key of Object.keys(distExports)) {
  if (key in sourceExports || NG_PACKAGR_OWN_KEYS.has(key)) {
    continue;
  }

  fail(
    `\`${key}\` is present in ${DIST_PACKAGE_JSON}'s exports map but was not declared in ` +
      `${SOURCE_PACKAGE_JSON} and is not one of ng-packagr's own keys (${[...NG_PACKAGR_OWN_KEYS].join(', ')})`,
  );
}

if (failures.length > 0) {
  console.error('Exports-map check FAILED:');

  for (const message of failures) {
    console.error(`  ${message}`);
  }

  process.exit(1);
}

console.log(
  [
    'Exports-map check PASSED.',
    `  ${Object.keys(sourceExports).length} declared key(s) in ${SOURCE_PACKAGE_JSON} all present and unchanged in ${DIST_PACKAGE_JSON}`,
    `  dist exports map's only extra keys are ng-packagr's own: ${[...NG_PACKAGR_OWN_KEYS].join(', ')}`,
  ].join('\n'),
);
