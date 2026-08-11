// Shared in-memory Sass importer for ticket 05's prototype.
//
// Two namespaces:
//   nfs:/...  -> packages/ngx-foundation-sites/src/scss/...
//   fnd:/...  -> node_modules/foundation-sites/...
//
// The legacy island writes `@import 'foundation-sites/scss/util/util'`, which
// has no URL scheme, so Sass pre-resolves it RELATIVE to the containing
// canonical URL and hands us `nfs:/internal/foundation-sites/scss/util/util`.
// loadPaths is inert in the browser, so the rewrite below is mandatory.

const CANDIDATE_SUFFIXES = ['.scss', '.css', ''];

function dirname(pathname) {
  const i = pathname.lastIndexOf('/');

  return i <= 0 ? '/' : pathname.slice(0, i);
}

function basename(pathname) {
  return pathname.slice(pathname.lastIndexOf('/') + 1);
}

/**
 * Candidate canonical URL strings for a resolved `scheme:/dir/name` path, in
 * the same order Sass's own filesystem importer tries them.
 */
function candidates(scheme, pathname, fromImport) {
  const dir = dirname(pathname);
  const name = basename(pathname);
  const out = [];

  const push = (n) => {
    for (const ext of CANDIDATE_SUFFIXES) {
      if (ext === '' && !n.endsWith('.scss')) {
        continue;
      }

      out.push(`${scheme}:${dir === '/' ? '' : dir}/${n}${ext}`);
    }
  };

  // Import-only files first when the load came from @import.
  if (fromImport) {
    push(`_${name}.import`);
    push(`${name}.import`);
  }

  push(`_${name}`);
  push(name);
  out.push(`${scheme}:${dir === '/' ? '' : dir}/${name}/_index.scss`);
  out.push(`${scheme}:${dir === '/' ? '' : dir}/${name}/index.scss`);

  return out;
}

/**
 * @param {Record<string,string>} sources canonical URL string -> file contents
 */
export function createImporter(sources) {
  const log = { canonicalize: 0, fromImport: 0, load: 0, misses: [] };

  const importer = {
    canonicalize(url, context) {
      log.canonicalize += 1;

      if (context.fromImport) {
        log.fromImport += 1;
      }

      let scheme;
      let pathname;

      if (url.startsWith('nfs:') || url.startsWith('fnd:')) {
        scheme = url.slice(0, 3);
        pathname = url.slice(4);
      } else {
        // Bare / unknown scheme -- should not happen once entry uses nfs:.
        scheme = 'nfs';
        pathname = url.startsWith('/') ? url : `/${url}`;
      }

      if (!pathname.startsWith('/')) {
        pathname = `/${pathname}`;
      }

      // THE REWRITE: bare load-path URLs from the legacy @import island.
      const fsIndex = pathname.indexOf('foundation-sites/scss/');

      if (fsIndex !== -1) {
        scheme = 'fnd';
        pathname = `/${pathname.slice(fsIndex + 'foundation-sites/'.length)}`;
      }

      for (const candidate of candidates(scheme, pathname, context.fromImport)) {
        if (Object.prototype.hasOwnProperty.call(sources, candidate)) {
          return new URL(candidate);
        }
      }

      log.misses.push(url);

      return null;
    },

    load(canonicalUrl) {
      log.load += 1;
      const key = canonicalUrl.toString();
      const contents = sources[key];

      if (contents === undefined) {
        return null;
      }

      return { contents, syntax: key.endsWith('.css') ? 'css' : 'scss' };
    },
  };

  return { importer, log };
}

/** The entry stylesheet the addon would compile. */
export function entryFor({ background, palette, radius }) {
  const parts = [];

  if (background) {
    parts.push(`$background: ${background}`);
  }

  if (palette) {
    parts.push(`$palette: (${palette})`);
  }

  if (radius) {
    parts.push(`$radius: ${radius}`);
  }

  const args = parts.length ? `(\n  ${parts.join(',\n  ')}\n)` : '';

  return `@use 'nfs:/button' as nfs-button;\n@include nfs-button.theme${args};\n`;
}
