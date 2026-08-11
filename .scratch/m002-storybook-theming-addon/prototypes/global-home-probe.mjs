// Ticket 12, corrections 1 / 3 / 5 / 6: prove the corrected placement compiles,
// in memory, without touching a single repo file.
//
// Three questions, each answered by execution:
//
//   Q1 (correction 1+3)  A standalone `src/scss/_theme.scss` holding
//                        $wcag-palette, with `_button.scss` UNCHANGED (no
//                        @forward, no @use of it), is readable by the addon --
//                        provided the compile takes TWO entry points instead of
//                        one. Also: what does the closure cost?
//
//   Q2 (correction 5+6)  The addon's defaults probe can read the FOUNDATION-GLOBAL
//                        names ($primary-color .. $alert-color, $global-radius)
//                        instead of the BUTTON-derived names ($button-palette,
//                        $button-background, $button-radius), byte-identically.
//                        That matters because internal/_settings.scss currently
//                        mixes both sets and the button-derived half is the half
//                        that moves when the file splits per component.
//
//   Q3 (correction 2)    One compile can @use + @include N theme mixins and emit
//                        all their rules, with the shared Foundation @import
//                        island compiled ONCE. Demonstrated with the real button
//                        module plus a synthetic second themeable module, both
//                        served from the in-memory source map.
//
// Read-only: every nfs source is read from disk, patched IN MEMORY, and served
// through the prototypes' own importer shape.

import { existsSync, readFileSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const NFS_ROOT = join(repoRoot, 'packages/ngx-foundation-sites/src/scss');
const FND_ROOT = join(repoRoot, 'node_modules/foundation-sites');

const OPTS = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  alertColor: false,
};

function diskPathFor(canonical) {
  if (canonical.startsWith('nfs:/')) {
    return join(NFS_ROOT, canonical.slice('nfs:/'.length));
  }

  if (canonical.startsWith('fnd:/')) {
    return join(FND_ROOT, canonical.slice('fnd:/'.length));
  }

  return null;
}

function candidates(scheme, pathname, fromImport) {
  const i = pathname.lastIndexOf('/');
  const dir = i <= 0 ? '' : pathname.slice(0, i);
  const name = pathname.slice(i + 1);
  const out = [];

  if (fromImport) {
    out.push(`${scheme}:${dir}/_${name}.import.scss`, `${scheme}:${dir}/${name}.import.scss`);
  }

  out.push(
    `${scheme}:${dir}/_${name}.scss`,
    `${scheme}:${dir}/${name}.scss`,
    `${scheme}:${dir}/${name}/_index.scss`,
    `${scheme}:${dir}/${name}/index.scss`,
  );

  return out;
}

/**
 * Disk-backed importer with an in-memory OVERLAY, so a not-yet-existing file
 * (`nfs:/_theme.scss`) can be served without writing it into packages/.
 */
function makeImporter(overlay, served) {
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

      if (!pathname.startsWith('/')) {
        pathname = `/${pathname}`;
      }

      const fsIndex = pathname.indexOf('foundation-sites/scss/');

      if (fsIndex !== -1) {
        scheme = 'fnd';
        pathname = `/${pathname.slice(fsIndex + 'foundation-sites/'.length)}`;
      }

      for (const candidate of candidates(scheme, pathname, context.fromImport)) {
        if (candidate in overlay) {
          return new URL(candidate);
        }

        const disk = diskPathFor(candidate);

        if (disk && existsSync(disk)) {
          return new URL(candidate);
        }
      }

      return null;
    },

    load(canonicalUrl) {
      const key = canonicalUrl.toString();
      const contents = key in overlay ? overlay[key] : readFileSync(diskPathFor(key), 'utf8');
      served.set(key, contents);

      return { contents, syntax: 'scss' };
    },
  };
}

function kib(n) {
  return (n / 1024).toFixed(1);
}

function closureSize(served) {
  let raw = 0;

  for (const c of served.values()) {
    raw += Buffer.byteLength(c, 'utf8');
  }

  const blob = [...served.keys()].sort().map((k) => `${k}\n${served.get(k)}`).join('\n');

  return { files: served.size, raw, gzip: gzipSync(Buffer.from(blob, 'utf8')).length };
}

// ---------------------------------------------------------------------------
// The candidate new global module. NOT written to disk.
// ---------------------------------------------------------------------------

const THEME_SCSS = `// Foundation-GLOBAL theme data. Public Sass API.
//
//   @use 'ngx-foundation-sites/scss/theme' as nfs-theme;
//   @use 'ngx-foundation-sites/scss/button' as nfs-button;
//   @include nfs-button.theme($palette: nfs-theme.$wcag-palette);
//
// These are $foundation-palette keys -- a THEME concept shared by every
// Foundation component that takes a palette, not a Button property.

$wcag-palette: (
  success: #238648,
  warning: #9e6c00,
  alert: #cb4b37,
);
`;

const overlay = { 'nfs:/_theme.scss': THEME_SCSS };

// ---------------------------------------------------------------------------
// Q0: baseline -- today's single-entry compile, unchanged.
// ---------------------------------------------------------------------------

console.log('=== Q0. BASELINE: today\'s single-entry compile ===');
{
  const served = new Map();
  const r = sass.compileString(
    `@use 'nfs:/button' as nfs-button;\n@include nfs-button.theme();\n`,
    { ...OPTS, importers: [makeImporter({}, served)] },
  );
  const s = closureSize(served);
  console.log(
    `css ${Buffer.byteLength(r.css)} bytes | closure ${s.files} files, ${kib(s.raw)} KiB raw, ${kib(s.gzip)} KiB gzip`,
  );
}

// ---------------------------------------------------------------------------
// Q1: two entry points, _button.scss UNCHANGED, $wcag-palette read from
//     nfs:/theme and passed as an argument.
// ---------------------------------------------------------------------------

console.log('\n=== Q1. TWO entry points: nfs:/theme + nfs:/button, _button.scss UNCHANGED ===');
{
  const served = new Map();
  const captured = {};
  const entry = [
    `@use 'nfs:/theme' as nfs-theme;`,
    `@use 'nfs:/button' as nfs-button;`,
    `@include nfs-button.theme($palette: nfs-theme.$wcag-palette);`,
    `$_: capture('wcag', nfs-theme.$wcag-palette);`,
  ].join('\n');

  const r = sass.compileString(entry, {
    ...OPTS,
    importers: [makeImporter(overlay, served)],
    functions: {
      'capture($name, $value)': (args) => {
        const name = args[0].assertString().text;
        const map = args[1].assertMap();
        const out = {};
        map.contents.forEach((v, k) => {
          out[k.assertString ? k.assertString().text : k.toString()] = v.toString();
        });
        captured[name] = out;

        return sass.sassNull;
      },
    },
  });

  const s = closureSize(served);
  console.log(`captured from nfs:/theme -> ${JSON.stringify(captured.wcag)}`);
  console.log(
    `css ${Buffer.byteLength(r.css)} bytes | closure ${s.files} files, ${kib(s.raw)} KiB raw, ${kib(s.gzip)} KiB gzip`,
  );
  console.log(
    `theme module appears in closure: ${served.has('nfs:/_theme.scss')} (size ${Buffer.byteLength(THEME_SCSS)} bytes)`,
  );
  console.log(
    `emitted CSS carries the compliant hexes: ` +
      `${['#238648', '#9e6c00', '#cb4b37'].every((h) => r.css.includes(h))}`,
  );
}

// ---------------------------------------------------------------------------
// Q1b: the FAILURE the two-entry-point change prevents -- a single-entry
//      generator never discovers nfs:/_theme.scss, so it is absent from the
//      committed sources module and the addon's probe cannot read it.
// ---------------------------------------------------------------------------

console.log('\n=== Q1b. NEGATIVE CONTROL: single-entry closure does NOT contain nfs:/_theme.scss ===');
{
  const served = new Map();
  sass.compileString(`@use 'nfs:/button' as nfs-button;\n@include nfs-button.theme();\n`, {
    ...OPTS,
    importers: [makeImporter(overlay, served)],
  });
  console.log(
    `single-entry closure contains nfs:/_theme.scss: ${served.has('nfs:/_theme.scss')}  <- must be false`,
  );
}

// ---------------------------------------------------------------------------
// Q2: global names vs button-derived names in internal/_settings.scss.
// ---------------------------------------------------------------------------

console.log('\n=== Q2. defaults probe: GLOBAL names vs BUTTON-derived names ===');
{
  const served = new Map();
  const captured = {};
  const entry = [
    `@use 'nfs:/internal/settings' as s;`,
    // button-derived (what ticket 07's probe 2 read)
    `$_a: cap('button.palette', s.$button-palette);`,
    `$_b: cap2('button.background', s.$button-background);`,
    `$_c: cap2('button.radius', s.$button-radius);`,
    // Foundation-global names (the durable set)
    `$_d: cap2('global.primary', s.$primary-color);`,
    `$_e: cap2('global.secondary', s.$secondary-color);`,
    `$_f: cap2('global.success', s.$success-color);`,
    `$_g: cap2('global.warning', s.$warning-color);`,
    `$_h: cap2('global.alert', s.$alert-color);`,
    `$_i: cap2('global.radius', s.$global-radius);`,
  ].join('\n');

  sass.compileString(entry, {
    ...OPTS,
    importers: [makeImporter({}, served)],
    functions: {
      'cap($name, $value)': (args) => {
        const map = args[1].assertMap();
        const out = {};
        map.contents.forEach((v, k) => {
          out[k.assertString ? k.assertString().text : k.toString()] = v.toString();
        });
        captured[args[0].assertString().text] = out;

        return sass.sassNull;
      },
      'cap2($name, $value)': (args) => {
        captured[args[0].assertString().text] = args[1].toString();

        return sass.sassNull;
      },
    },
  });

  const buttonDerived = {
    primary: captured['button.background'],
    secondary: captured['button.palette'].secondary,
    success: captured['button.palette'].success,
    warning: captured['button.palette'].warning,
    alert: captured['button.palette'].alert,
    radius: captured['button.radius'],
  };
  const globalNames = {
    primary: captured['global.primary'],
    secondary: captured['global.secondary'],
    success: captured['global.success'],
    warning: captured['global.warning'],
    alert: captured['global.alert'],
    radius: captured['global.radius'],
  };

  console.log(`button-derived -> ${JSON.stringify(buttonDerived)}`);
  console.log(`global names   -> ${JSON.stringify(globalNames)}`);
  console.log(
    `IDENTICAL: ${JSON.stringify(buttonDerived) === JSON.stringify(globalNames)}  <- the swap is free`,
  );
  console.log(
    `note: button.palette also carries a 'primary' key (${captured['button.palette'].primary}), which theme() skips.`,
  );
}

// ---------------------------------------------------------------------------
// Q3: ONE compile, N themeable modules, shared island compiled once.
// ---------------------------------------------------------------------------

console.log('\n=== Q3. ONE compile, N themeable modules (button + synthetic #2) ===');
{
  // A synthetic second themeable module in the same shape as _button.scss:
  // its own public theme() mixin over the SAME internal/foundation-button
  // island, so the island's 13-file Foundation closure is shared.
  const CALLOUT_SCSS = `@use 'sass:map';
@use 'internal/foundation-button' as fb;
@use 'internal/settings' as settings;

@mixin theme($selector: '.nfs-probe-widget', $background: null, $palette: null, $radius: null) {
  $fill: settings.$button-background;

  @if $background != null {
    $fill: $background;
  }

  #{$selector} {
    background-color: $fill;
  }

  $p: settings.$button-palette;

  @if $palette != null {
    $p: map.merge($p, $palette);
  }

  @each $name, $color in $p {
    @if $name != primary {
      #{$selector}.#{$name} { background-color: $color; }
    }
  }
}
`;
  const served = new Map();
  const modules = [
    { url: 'nfs:/button', ns: 'nfs-button' },
    { url: 'nfs:/probe-widget', ns: 'nfs-probe-widget' },
  ];
  const args = `($palette: (success: #238648, warning: #9e6c00, alert: #cb4b37))`;
  const entry = [
    ...modules.map((m) => `@use '${m.url}' as ${m.ns};`),
    ...modules.map((m) => `@include ${m.ns}.theme${args};`),
  ].join('\n');

  const r = sass.compileString(entry, {
    ...OPTS,
    importers: [makeImporter({ ...overlay, 'nfs:/_probe-widget.scss': CALLOUT_SCSS }, served)],
  });

  const s = closureSize(served);
  console.log(`entry:\n${entry.replace(/^/gm, '  ')}`);
  console.log(`css ${Buffer.byteLength(r.css)} bytes`);
  console.log(
    `closure ${s.files} files, ${kib(s.raw)} KiB raw, ${kib(s.gzip)} KiB gzip ` +
      `(vs 16 / 84.4 / 24.1 at N=1)`,
  );
  const fnd = [...served.keys()].filter((k) => k.startsWith('fnd:'));
  console.log(`Foundation partials served: ${fnd.length}  <- island compiled ONCE, not twice`);
  console.log(
    `both selectors present: .button=${r.css.includes('.button')} ` +
      `.nfs-probe-widget=${r.css.includes('.nfs-probe-widget')}`,
  );
}
