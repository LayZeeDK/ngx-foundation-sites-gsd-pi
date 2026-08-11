// Ticket 15 probe D -- is a MAP-shaped settings surface expressible under
// `@use ... with (...)`, and can it reject unknown keys instead of ignoring
// them?
//
// This is the only candidate that reaches "set only the variables you changed"
// while keeping `@use` and while failing LOUDLY on a name the library does not
// carry. Probed by overriding internal/_settings.scss IN MEMORY -- no repo file
// is touched.
//
// Usage: node settings-map-shape-probe.mjs

import { readFileSync, statSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const fndRoot = join(repoRoot, 'node_modules/foundation-sites');
const nfsRoot = join(repoRoot, 'packages/ngx-foundation-sites/src/scss');

const CANDIDATE_SUFFIXES = ['.scss', '.css', ''];

function candidates(pathname, fromImport) {
  const i = pathname.lastIndexOf('/');
  const dir = i <= 0 ? '' : pathname.slice(0, i);
  const name = pathname.slice(i + 1);
  const out = [];

  const push = (n) => {
    for (const ext of CANDIDATE_SUFFIXES) {
      if (ext === '' && !n.endsWith('.scss')) {
        continue;
      }

      out.push(`${dir}/${n}${ext}`);
    }
  };

  if (fromImport) {
    push(`_${name}.import`);
    push(`${name}.import`);
  }

  push(`_${name}`);
  push(name);
  out.push(`${dir}/${name}/_index.scss`);
  out.push(`${dir}/${name}/index.scss`);

  return out;
}

function makeImporter(overrides) {
  return {
    canonicalize(url, context) {
      let scheme;
      let pathname;

      if (url.startsWith('nfs:') || url.startsWith('fnd:')) {
        scheme = url.slice(0, 3);
        pathname = url.slice(4);
      } else {
        scheme = 'nfs';
        pathname = url.startsWith('/') ? url : `/${url}`;
      }

      const fsIndex = pathname.indexOf('foundation-sites/scss/');

      if (fsIndex !== -1) {
        scheme = 'fnd';
        pathname = `/${pathname.slice(fsIndex + 'foundation-sites/'.length)}`;
      }

      const root = scheme === 'nfs' ? nfsRoot : fndRoot;

      for (const candidate of candidates(pathname, context.fromImport)) {
        const key = `${scheme}:${candidate}`;

        if (Object.prototype.hasOwnProperty.call(overrides, key)) {
          return new URL(key);
        }

        try {
          if (statSync(join(root, candidate)).isFile()) {
            return new URL(key);
          }
        } catch {
          // next candidate
        }
      }

      return null;
    },

    load(canonicalUrl) {
      const key = canonicalUrl.toString();

      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        return { contents: overrides[key], syntax: 'scss' };
      }

      const scheme = key.slice(0, 3);
      const root = scheme === 'nfs' ? nfsRoot : fndRoot;

      return {
        contents: readFileSync(join(root, key.slice(4)), 'utf8'),
        syntax: key.endsWith('.css') ? 'css' : 'scss',
      };
    },
  };
}

const opts = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  alertColor: false,
};

// ---------------------------------------------------------------------------
// Build the map-shaped variant of internal/_settings.scss, mechanically.
// Every `$name: <value>;` becomes `$name: -s(name, <value>);`.
// ---------------------------------------------------------------------------
const SETTINGS_KEY = 'nfs:/internal/_settings.scss';
const realSettings = readFileSync(join(nfsRoot, 'internal/_settings.scss'), 'utf8');
const declNames = [];

const rewritten = realSettings.replace(
  /^\$([a-zA-Z0-9_-]+):([\s\S]*?);$/gm,
  (whole, name, value) => {
    declNames.push(name);

    // The value is parenthesised so comma-separated lists (e.g.
    // $button-transition) stay ONE argument rather than becoming three.
    return `$${name}: -s(${name}, (${value.trim()}));`;
  },
);

const PREAMBLE = `@use 'sass:list';
@use 'sass:map';

// The ONE configurable member: a sparse map of overrides.
$settings: () !default;

$-known: (${declNames.join(', ')});

// LOUD on an unknown key -- the opposite of today's silent ignore.
@each $-key, $-value in $settings {
  @if not list.index($-known, $-key) {
    @error 'ngx-foundation-sites: unknown setting #{$-key}.';
  }
}

@function -s($name, $fallback) {
  @return if(map.has-key($settings, $name), map.get($settings, $name), $fallback);
}
`;

const mapSettings = `${PREAMBLE}\n${rewritten}`;
const OVERRIDES = { [SETTINGS_KEY]: mapSettings };

console.log(
  `=== 0. mechanically rewritten settings module ===\n` +
    `  ${declNames.length} declarations rewritten to read from $settings\n` +
    `  preamble is ${PREAMBLE.split('\n').length} lines of Sass\n`,
);

function compile(entry) {
  try {
    const out = sass.compileString(entry, {
      ...opts,
      importers: [makeImporter(OVERRIDES)],
    });

    return { ok: true, css: out.css, bytes: Buffer.byteLength(out.css) };
  } catch (error) {
    return { ok: false, error: String(error.message).split('\n')[0] };
  }
}

const base = compile("@use 'nfs:/button' as b;\n@include b.theme;\n");
console.log(
  `=== 1. unconfigured baseline: ${base.ok ? `${base.bytes}B` : `ERROR ${base.error}`} ===\n`,
);

const CASES = [
  [
    'D1',
    'sparse override of ONE name',
    "@use 'nfs:/internal/settings' with ($settings: (button-radius: 9px));\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ],
  [
    'D2',
    'sparse override of a DERIVED-FROM name ($global-radius)',
    "@use 'nfs:/internal/settings' with ($settings: (global-radius: 9px));\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ],
  [
    'D3',
    'sparse override of the palette source ($success-color)',
    "@use 'nfs:/internal/settings' with ($settings: (success-color: #238648));\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ],
  [
    'D4',
    'UNKNOWN key -- must be a hard error, not a silent ignore',
    "@use 'nfs:/internal/settings' with ($settings: (buton-radius: 9px));\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ],
  [
    'D5',
    "a REAL Foundation name this library does not carry ($callout-background)",
    "@use 'nfs:/internal/settings' with ($settings: (callout-background: red));\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ],
  [
    'D6',
    'the module loaded twice with the same config (multi-file consumer)',
    "@use 'nfs:/internal/settings' with ($settings: (button-radius: 9px));\n@use 'nfs:/internal/settings' as s2 with ($settings: (button-radius: 9px));\n",
  ],
  [
    'D7',
    'configured, plus TWO scoped theme() calls in the same compilation',
    "@use 'nfs:/internal/settings' with ($settings: (success-color: #238648));\n@use 'nfs:/button' as b;\n@include b.theme;\n@include b.theme($selector: '.button--brand', $background: #2a5db0);\n",
  ],
];

for (const [id, question, entry] of CASES) {
  const r = compile(entry);

  if (!r.ok) {
    console.log(`${id}  ERROR     ${question}\n     ${r.error}\n`);
    continue;
  }

  const same = r.css === base.css;
  console.log(
    `${id}  COMPILED  ${question}\n     css=${r.bytes}B${same ? ' [NO EFFECT -- identical to unconfigured]' : ''}\n`,
  );
}

// Does D3's colour actually land in the output?
const d3 = compile(
  "@use 'nfs:/internal/settings' with ($settings: (success-color: #238648));\n@use 'nfs:/button' as b;\n@include b.theme;\n",
);
console.log('--- targeted checks ---');
console.log(`D3 emitted #238648: ${d3.ok && d3.css.includes('#238648')}`);
console.log(
  `D3 still emits Foundation's default success #3adb76: ${d3.ok && d3.css.includes('#3adb76')}`,
);
