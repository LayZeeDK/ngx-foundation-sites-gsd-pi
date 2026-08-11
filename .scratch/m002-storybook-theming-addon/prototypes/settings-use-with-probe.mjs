// Ticket 15 probe C -- test each of the three measured grounds on which
// `@use ... with (...)` was rejected for the theme MIXIN, against a settings
// MODULE instead.
//
// The library's internal/_settings.scss uses plain assignments on purpose, so
// there is nothing to configure today. This probe overrides that ONE file
// IN MEMORY with an `!default` variant -- no repo file is touched -- and then
// measures what the mechanism actually does.
//
// Usage: node settings-use-with-probe.mjs

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
// The ONE in-memory change: every plain assignment in internal/_settings.scss
// gains `!default`, which is the minimum a configurable settings module needs.
// ---------------------------------------------------------------------------
const SETTINGS_KEY = 'nfs:/internal/_settings.scss';
const realSettings = readFileSync(join(nfsRoot, 'internal/_settings.scss'), 'utf8');

// Multi-line declarations ($button-palette, $button-sizes, $button-transition)
// need the `!default` on the terminating line, so operate on `;`-separated
// top-level declarations rather than lines.
function addDefaults(src) {
  return src.replace(
    /^(\$[a-zA-Z0-9_-]+:[\s\S]*?)(;)$/gm,
    (whole, body, semi) => (body.includes('!default') ? whole : `${body} !default${semi}`),
  );
}

const defaultedSettings = addDefaults(realSettings);
const declCount = (realSettings.match(/^\$[a-zA-Z0-9_-]+:/gm) ?? []).length;
const defaultCount = (defaultedSettings.match(/!default/g) ?? []).length;

console.log(
  `=== 0. in-memory !default variant of internal/_settings.scss ===\n` +
    `  declarations: ${declCount}, !default now present: ${defaultCount}\n`,
);

const OVERRIDES = { [SETTINGS_KEY]: defaultedSettings };

function compile(entry, extra = {}) {
  try {
    const out = sass.compileString(entry, {
      ...opts,
      importers: [makeImporter({ ...OVERRIDES, ...extra })],
    });

    return { ok: true, css: out.css, bytes: Buffer.byteLength(out.css) };
  } catch (error) {
    return { ok: false, error: String(error.message).split('\n')[0] };
  }
}

function report(id, question, result, baselineCss) {
  if (!result.ok) {
    console.log(`${id}  ERROR     ${question}\n     ${result.error}\n`);

    return;
  }

  const same = baselineCss !== undefined && result.css === baselineCss;
  console.log(
    `${id}  COMPILED  ${question}\n     css=${result.bytes}B${same ? ' [NO EFFECT -- identical to baseline]' : ''}\n`,
  );
}

// Baseline through the !default variant (must match the real 5839B output).
const base = compile("@use 'nfs:/button' as b;\n@include b.theme;\n");
console.log(`=== 1. baseline through the !default variant: ${base.bytes}B ===\n`);

// ---------------------------------------------------------------------------
// GROUND 1 -- "forces the consumer to type bare Foundation-shaped globals"
// ---------------------------------------------------------------------------
console.log('=== GROUND 1: bare Foundation-shaped global names ===');

report(
  'G1a',
  "configure with Foundation's OWN name: @use ... with ($button-radius: 9px)",
  compile(
    "@use 'nfs:/internal/settings' with ($button-radius: 9px);\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ),
  base.css,
);

report(
  'G1b',
  'configure the palette map wholesale: with ($button-palette: (...))',
  compile(
    "@use 'nfs:/internal/settings' with ($button-palette: (primary: #1779ba, secondary: #767676, success: #238648, warning: #9e6c00, alert: #cb4b37));\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ),
  base.css,
);

// ---------------------------------------------------------------------------
// GROUND 2 -- "cannot be invoked twice in one compilation"
// ---------------------------------------------------------------------------
console.log('=== GROUND 2: invoked twice in one compilation ===');

report(
  'G2a',
  'the SAME module configured twice, byte-identical values',
  compile(
    "@use 'nfs:/internal/settings' with ($button-radius: 9px);\n" +
      "@use 'nfs:/internal/settings' as s2 with ($button-radius: 9px);\n" +
      "@use 'nfs:/button' as b;\n@include b.theme;\n",
  ),
);

report(
  'G2b',
  'configured AFTER the library module already loaded it (wrong order)',
  compile(
    "@use 'nfs:/button' as b;\n" +
      "@use 'nfs:/internal/settings' with ($button-radius: 9px);\n" +
      '@include b.theme;\n',
  ),
);

report(
  'G2c',
  'two consumer partials each configure it (realistic multi-file app)',
  compile("@use 'nfs:/probe-a';\n@use 'nfs:/probe-b';\n", {
    'nfs:/_probe-a.scss':
      "@use 'nfs:/internal/settings' with ($button-radius: 9px);\n@use 'nfs:/button' as b;\n@include b.theme($selector: '.a');\n",
    'nfs:/_probe-b.scss':
      "@use 'nfs:/internal/settings' with ($button-radius: 3px);\n@use 'nfs:/button' as b;\n@include b.theme($selector: '.b');\n",
  }),
);

report(
  'G2d',
  'CONTROL: two theme() mixin calls with different values, one compilation',
  compile(
    "@use 'nfs:/button' as b;\n@include b.theme($radius: 9px);\n@include b.theme($selector: '.button--flat', $radius: 0);\n",
  ),
);

// ---------------------------------------------------------------------------
// GROUND 3 -- "emitted 5490 bytes of unwanted rules just to read one token"
// ---------------------------------------------------------------------------
console.log('=== GROUND 3: bytes emitted on load ===');

report(
  'G3a',
  'load the settings module alone, configured, nothing else',
  compile("@use 'nfs:/internal/settings' with ($button-radius: 9px);\n"),
);

report(
  'G3b',
  'CONTROL: load the public button module alone (no @include)',
  compile("@use 'nfs:/button' as b;\n"),
);

// ---------------------------------------------------------------------------
// THE MIGRATION QUESTION -- what happens on an unknown / misspelled name
// ---------------------------------------------------------------------------
console.log('=== MIGRATION SAFETY: unknown and misspelled configuration keys ===');

report(
  'M1',
  'configure an INVENTED variable: with ($totally-made-up: 1px)',
  compile(
    "@use 'nfs:/internal/settings' with ($totally-made-up: 1px);\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ),
);

report(
  'M2',
  'configure a MISSPELLED real name: with ($button-radiuss: 9px)',
  compile(
    "@use 'nfs:/internal/settings' with ($button-radiuss: 9px);\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ),
);

report(
  'M3',
  "configure a REAL Foundation name this library does not carry: with ($callout-background: red)",
  compile(
    "@use 'nfs:/internal/settings' with ($callout-background: red);\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ),
);

report(
  'M4',
  'configure a name Foundation DERIVES rather than declares: with ($global-radius: 9px)',
  compile(
    "@use 'nfs:/internal/settings' with ($global-radius: 9px);\n@use 'nfs:/button' as b;\n@include b.theme;\n",
  ),
  base.css,
);

report(
  'M5',
  'CONTROL: same $global-radius, but $button-radius left to derive from it',
  compile(
    "@use 'nfs:/internal/settings' with ($global-radius: 9px);\n@use 'nfs:/button' as b;\n@include b.theme;\n",
    {
      [SETTINGS_KEY]: defaultedSettings.replace(
        '$button-radius: $global-radius !default;',
        '$button-radius: $global-radius !default; // unchanged',
      ),
    },
  ),
  base.css,
);
