// Pass 1: compile the real chain in Node with a DISK-BACKED importer that
// records every canonical URL it served, then emit exactly that closure as a
// JSON string map for the browser bundle.
//
// Usage: node collect-sources.mjs <outDir>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

import { entryFor } from './importer.mjs';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const NFS_ROOT = join(repoRoot, 'packages/ngx-foundation-sites/src/scss');
const FND_ROOT = join(repoRoot, 'node_modules/foundation-sites');

const outDir = process.argv[2] ?? join(here, 'out');
mkdirSync(outDir, { recursive: true });

const served = new Map();

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

const diskImporter = {
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
      const disk = diskPathFor(candidate);

      if (disk && existsSync(disk)) {
        return new URL(candidate);
      }
    }

    return null;
  },

  load(canonicalUrl) {
    const key = canonicalUrl.toString();
    const disk = diskPathFor(key);
    const contents = readFileSync(disk, 'utf8');
    served.set(key, contents);

    return { contents, syntax: 'scss' };
  },
};

const result = sass.compileString(entryFor({}), {
  importers: [diskImporter],
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'if-function'],
});

const sources = Object.fromEntries([...served.entries()].sort());
writeFileSync(join(outDir, 'sources.json'), JSON.stringify(sources, null, 0));

let rawBytes = 0;

for (const contents of Object.values(sources)) {
  rawBytes += Buffer.byteLength(contents, 'utf8');
}

console.log(`[OK] served ${served.size} files, ${rawBytes} bytes raw`);
console.log(`[OK] default-theme CSS: ${Buffer.byteLength(result.css, 'utf8')} bytes`);

for (const key of Object.keys(sources)) {
  console.log('  ' + key);
}
