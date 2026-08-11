// Ticket 12, correction 1: VERIFY the one inference ticket 07's cost argument
// leans on -- "a new scss/_theme.scss would REQUIRE a new `exports` alias key,
// because the identity map './scss/*': './scss/*' does not resolve the
// partial-name form scss/theme -> scss/_theme.scss".
//
// Four resolvers are probed, because the answer differs per resolver and only
// one of them is the one that actually matters for this repo:
//
//   R1  Node's own package-exports resolver (createRequire.resolve).
//   R2  Dart Sass loadPaths -- what verify-foundation-parity.mjs and
//       compile-default-css use.
//   R3  Dart Sass NodePackageImporter (the `pkg:` scheme).
//   R4  Angular's OWN sass importer shape, replicated verbatim from
//       node_modules/@angular/build/src/tools/esbuild/stylesheets/sass-language.js
//       -- an exports-honouring resolve FIRST, then a "package deep imports"
//       fallback that joins the package ROOT with the path segments directly.
//       R4 is what apps/nfs-demo actually compiles through
//       (`@angular/build:application`).
//
// Two fixtures:
//   F1  a synthetic package carrying this repo's exact exports-map SHAPE plus a
//       partial-named file that has no alias key.
//   F2  the REAL extracted tarball at apps/nfs-demo/node_modules/ngx-foundation-sites,
//       probed at `scss/internal/settings` -- a subpath the exports map maps to
//       `null`, i.e. the strongest possible "not exported" case.
//
// Read-only w.r.t. the repo. F1 is built in the OS temp dir, never in the repo.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as sass from 'sass';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const OPTS = {
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
  alertColor: false,
};

function label(ok) {
  return ok ? '[OK]     RESOLVED' : '[FAIL]   REFUSED ';
}

// ---------------------------------------------------------------------------
// F1: synthetic package with this repo's exports-map SHAPE.
// ---------------------------------------------------------------------------

const root = join(tmpdir(), 'nfs-exports-probe');
rmSync(root, { recursive: true, force: true });
const pkg = join(root, 'node_modules', 'fakepkg');
mkdirSync(join(pkg, 'scss', 'internal'), { recursive: true });

writeFileSync(
  join(pkg, 'package.json'),
  JSON.stringify(
    {
      name: 'fakepkg',
      version: '0.0.1',
      exports: {
        './scss/internal/*': null,
        './scss/button': './scss/_button.scss',
        './scss/*': './scss/*',
        // ng-packagr ALWAYS generates this key. Its presence is what makes
        // Angular's "package deep imports" fallback able to find the package
        // root, and therefore what makes the fallback bypass exports at all.
        './package.json': { default: './package.json' },
      },
    },
    null,
    2,
  ),
);
writeFileSync(join(pkg, 'scss', '_button.scss'), '$marker: button;\n');
// The candidate new module -- partial-named, NO alias key of its own.
writeFileSync(join(pkg, 'scss', '_theme.scss'), '$marker: theme;\n');
writeFileSync(join(pkg, 'scss', 'internal', '_settings.scss'), '$marker: settings;\n');
writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'probe-root' }, null, 2));
writeFileSync(join(root, 'entry.cjs'), '\n');

console.log('=== F1: synthetic package, this repo\'s exports-map shape ===');
console.log(
  "exports: { './scss/internal/*': null, './scss/button': './scss/_button.scss', './scss/*': './scss/*' }",
);
console.log('files:   scss/_button.scss, scss/_theme.scss, scss/internal/_settings.scss\n');

// --- R1: Node's own exports-honouring resolver ---------------------------
const req = createRequire(join(root, 'entry.cjs'));

for (const spec of [
  'fakepkg/scss/button',
  'fakepkg/scss/theme',
  'fakepkg/scss/_theme.scss',
  'fakepkg/scss/internal/settings',
  'fakepkg/scss/internal/_settings.scss',
]) {
  try {
    const p = req.resolve(spec);
    console.log(`R1 node exports  ${label(true)}  ${spec.padEnd(38)} -> ${p.slice(pkg.length + 1)}`);
  } catch (e) {
    console.log(`R1 node exports  ${label(false)}  ${spec.padEnd(38)} -> ${e.code ?? e.message}`);
  }
}

// --- R2: Dart Sass loadPaths --------------------------------------------
console.log('');

for (const spec of [
  'fakepkg/scss/button',
  'fakepkg/scss/theme',
  'fakepkg/scss/internal/settings',
]) {
  try {
    const r = sass.compileString(`@use '${spec}' as m;\na { x: m.$marker; }\n`, {
      ...OPTS,
      loadPaths: [join(root, 'node_modules')],
    });
    console.log(`R2 sass loadPath ${label(true)}  ${spec.padEnd(38)} -> ${r.css.replace(/\s+/g, ' ')}`);
  } catch (e) {
    console.log(`R2 sass loadPath ${label(false)}  ${spec.padEnd(38)} -> ${e.message.split('\n')[0]}`);
  }
}

// --- R3: Dart Sass NodePackageImporter -----------------------------------
console.log('');
const npi = new sass.NodePackageImporter(root);

for (const spec of [
  'pkg:fakepkg/scss/button',
  'pkg:fakepkg/scss/theme',
  'pkg:fakepkg/scss/internal/settings',
]) {
  try {
    const r = sass.compileString(`@use '${spec}' as m;\na { x: m.$marker; }\n`, {
      ...OPTS,
      importers: [npi],
      url: pathToFileURL(join(root, 'probe.scss')),
    });
    console.log(`R3 pkg: importer ${label(true)}  ${spec.padEnd(38)} -> ${r.css.replace(/\s+/g, ' ')}`);
  } catch (e) {
    console.log(`R3 pkg: importer ${label(false)}  ${spec.padEnd(38)} -> ${e.message.split('\n')[0]}`);
  }
}

// --- R4: Angular's own importer shape ------------------------------------
//
// Replicated from @angular/build's sass-language.js:126-152:
//   1. resolveUrl(url)                      <- exports-honouring
//   2. on miss: resolve `<pkgName>/package.json`, then join(packageRoot, ...segments)
//      -- which NEVER consults the exports map for the subpath.
function angularFindFileUrl(nodeModulesRoot) {
  const r = createRequire(join(nodeModulesRoot, 'entry.cjs'));

  return {
    findFileUrl(url) {
      // Step 1 -- exports-honouring resolve of the full specifier.
      try {
        return pathToFileURL(r.resolve(url));
      } catch {
        /* fall through, exactly as Angular does */
      }

      // Step 2 -- "Check for package deep imports".
      const parts = url.split('/');
      const packageName = url.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
      const pathSegments = url.slice(packageName.length + 1).split('/');
      let packageRoot;

      try {
        packageRoot = pathDirname(r.resolve(`${packageName}/package.json`));
      } catch {
        return null;
      }

      return pathToFileURL(join(packageRoot, ...pathSegments));
    },
  };
}

console.log('');
const f1Angular = angularFindFileUrl(root);

for (const spec of [
  'fakepkg/scss/button',
  'fakepkg/scss/theme',
  'fakepkg/scss/internal/settings',
]) {
  try {
    const r = sass.compileString(`@use '${spec}' as m;\na { x: m.$marker; }\n`, {
      ...OPTS,
      importers: [f1Angular],
      url: pathToFileURL(join(root, 'probe.scss')),
    });
    console.log(`R4 angular shape ${label(true)}  ${spec.padEnd(38)} -> ${r.css.replace(/\s+/g, ' ')}`);
  } catch (e) {
    console.log(`R4 angular shape ${label(false)}  ${spec.padEnd(38)} -> ${e.message.split('\n')[0]}`);
  }
}

// ---------------------------------------------------------------------------
// F2: the REAL extracted tarball apps/nfs-demo consumes.
// ---------------------------------------------------------------------------

console.log('\n=== F2: the REAL tarball at apps/nfs-demo/node_modules/ngx-foundation-sites ===');
const demoRoot = join(repoRoot, 'apps/nfs-demo');
const demoPkg = join(demoRoot, 'node_modules/ngx-foundation-sites');
console.log(`present: ${existsSync(demoPkg)}`);

const demoReq = createRequire(join(demoRoot, 'entry.cjs'));

for (const spec of [
  'ngx-foundation-sites/scss/button',
  'ngx-foundation-sites/scss/internal/settings',
  'ngx-foundation-sites/scss/internal/_settings.scss',
]) {
  try {
    const p = demoReq.resolve(spec);
    console.log(`R1 node exports  ${label(true)}  ${spec.padEnd(46)} -> ${p.slice(demoPkg.length + 1)}`);
  } catch (e) {
    console.log(`R1 node exports  ${label(false)}  ${spec.padEnd(46)} -> ${e.code ?? e.message}`);
  }
}

console.log('');
const f2Angular = angularFindFileUrl(demoRoot);

for (const spec of [
  'ngx-foundation-sites/scss/button',
  'ngx-foundation-sites/scss/internal/settings',
]) {
  try {
    const r = sass.compileString(`@use '${spec}' as m;\na { x: 1; }\n`, {
      ...OPTS,
      importers: [f2Angular],
      url: pathToFileURL(join(demoRoot, 'probe.scss')),
    });
    console.log(
      `R4 angular shape ${label(true)}  ${spec.padEnd(46)} -> compiled ${Buffer.byteLength(r.css)} bytes`,
    );
  } catch (e) {
    console.log(`R4 angular shape ${label(false)}  ${spec.padEnd(46)} -> ${e.message.split('\n')[0]}`);
  }
}

rmSync(root, { recursive: true, force: true });
console.log('\n(temp fixture removed)');
