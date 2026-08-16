import { THEMING_SOURCES } from './theming-sources.generated';
import type * as Sass from 'sass';

// The one Sass importer that resolves `nfs:`/`fnd:` canonical URLs against the
// committed, in-memory THEMING_SOURCES map instead of disk. Shared by both
// runtime callers -- theming-worker.ts (preview, in a Worker) and
// theming-presets.ts (manager, on the main thread).
//
// It was previously copied into each of them. The stated rationale was that
// "each Worker entry resolves THEMING_SOURCES independently rather than
// importing a runtime helper across files", which stopped being true when T02
// moved the preset probe out of a Worker and onto the manager main thread --
// and by then the copies had already diverged: the probe's lacked the
// `foundation-sites/scss/` -> `fnd:` rewrite below. That was latent rather than
// broken only because the probe entry reaches no Foundation-derived variable;
// adding one would have produced "Can't find stylesheet to import" from a
// resolver that looked correct beside a working twin.
//
// NOT shared with scripts/generate-theming-sources.mjs's importer, whose own
// mirroring rationale does still hold: that one runs in Node against real files
// at build time, across the .mjs/.ts boundary.
//
// No static top-level `import ... from 'sass'` -- the Sass namespace is used
// for types only, so this module stays free to import from either realm.

function candidateUrls(scheme: string, pathname: string, fromImport: boolean): string[] {
  const lastSlash = pathname.lastIndexOf('/');
  const dir = lastSlash <= 0 ? '' : pathname.slice(0, lastSlash);
  const name = pathname.slice(lastSlash + 1);
  const out: string[] = [];

  if (fromImport) {
    out.push(`${scheme}:${dir}/_${name}.import.scss`, `${scheme}:${dir}/${name}.import.scss`);
  }

  out.push(
    `${scheme}:${dir}/_${name}.scss`,
    `${scheme}:${dir}/${name}.scss`,
    `${scheme}:${dir}/${name}/_index.scss`,
    `${scheme}:${dir}/${name}/index.scss`
  );

  return out;
}

export function createSourcesImporter(): Sass.Importer<'sync'> {
  return {
    canonicalize(url, context) {
      let scheme: string;
      let pathname: string;

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

      // Foundation's legacy `@import` island resolves relative paths that reach
      // back into the package; re-scheme those onto `fnd:` so they hit the
      // bundled copies rather than falling through to a null resolution.
      const fsIndex = pathname.indexOf('foundation-sites/scss/');
      if (fsIndex !== -1) {
        scheme = 'fnd';
        pathname = `/${pathname.slice(fsIndex + 'foundation-sites/'.length)}`;
      }

      for (const candidate of candidateUrls(scheme, pathname, context.fromImport)) {
        if (Object.prototype.hasOwnProperty.call(THEMING_SOURCES, candidate)) {
          return new URL(candidate);
        }
      }

      return null;
    },

    load(canonicalUrl) {
      const key = canonicalUrl.toString();
      const contents = THEMING_SOURCES[key];

      // `canonicalize` verifies membership on the raw candidate string and
      // returns `new URL(candidate)`; this reads back the URL-normalised form.
      // They agree for every key the generator emits, but a key whose
      // normalisation is not the identity would hand Sass `contents: undefined`
      // and surface as an opaque parse error pointing nowhere near the cause.
      if (contents === undefined) {
        throw new Error(
          `nfs theming: canonicalize() accepted "${key}" but THEMING_SOURCES has no such entry. ` +
            'This is a URL-normalisation mismatch in the addon importer, not a problem with your ' +
            'theme. Regenerate with: nx run ngx-foundation-sites:verify-theming-sources'
        );
      }

      return { contents, syntax: 'scss' };
    },
  };
}
