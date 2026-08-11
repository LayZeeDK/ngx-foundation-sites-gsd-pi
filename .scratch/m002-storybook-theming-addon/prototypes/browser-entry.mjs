// Bundled into the browser harness by build-bundle.mjs.
// Bare `import * as sass from 'sass'` on a web target must land on the browser
// entry (sass.default.js) with no alias -- that is part of what is under test.

import * as sass from 'sass';

import { createImporter, entryFor } from './importer.mjs';
import sources from 'nfs-sources';

const t0 = performance.now();

globalThis.__nfs = {
  sassLoadedAt: t0,
  sassKeys: Object.keys(sass).sort(),
  sourceCount: Object.keys(sources).length,

  probeNodeApis() {
    const out = {};
    const attempt = (name, fn) => {
      try {
        fn();
        out[name] = 'DID_NOT_THROW';
      } catch (e) {
        out[name] = String(e && e.message ? e.message : e).slice(0, 160);
      }
    };

    attempt('compile', () => sass.compile('x.scss'));
    attempt('compileAsync', () => sass.compileAsync('x.scss'));
    attempt('renderSync', () => sass.renderSync({ file: 'x.scss' }));
    attempt('loadPathsOnly', () =>
      sass.compileString('@use "x";', { loadPaths: ['.'] }),
    );

    return out;
  },

  compile(opts = {}) {
    const { importer, log } = createImporter(sources);
    const start = performance.now();
    const result = sass.compileString(entryFor(opts), {
      importers: [importer],
      quietDeps: true,
      silenceDeprecations: ['import', 'global-builtin', 'if-function'],
      alertColor: false,
    });
    const ms = performance.now() - start;

    return {
      ms,
      css: result.css,
      loadedUrls: result.loadedUrls.map(String),
      canonicalizeCalls: log.canonicalize,
      fromImportCalls: log.fromImport,
      loadCalls: log.load,
      misses: log.misses,
    };
  },

  // Error path -- name-dependent machinery (class identity, span/url plumbing).
  // If minification broke dart2js this is where it shows up as garbage.
  probeError() {
    const { importer } = createImporter(sources);

    try {
      sass.compileString(
        `@use 'nfs:/button' as nfs-button;\n@include nfs-button.theme($background: notacolor);\n`,
        { importers: [importer], quietDeps: true, alertColor: false },
      );

      return { threw: false };
    } catch (e) {
      return {
        threw: true,
        isSassException: e instanceof sass.Exception,
        ctorName: e?.constructor?.name ?? null,
        sassMessage: e.sassMessage ?? null,
        spanUrl: e.span?.url ? String(e.span.url) : null,
        hasAnsi: /\[/.test(String(e.message)),
        messageHead: String(e.message).split('\n')[0],
      };
    }
  },

  // Main-thread responsiveness: rAF gap observed WHILE one sync compile runs.
  measureFrameGap(opts = {}) {
    return new Promise((done) => {
      const gaps = [];
      let last = performance.now();
      let stop = false;

      const tick = () => {
        const now = performance.now();
        gaps.push(now - last);
        last = now;

        if (!stop) {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);

      setTimeout(() => {
        const t = performance.now();
        globalThis.__nfs.compile(opts);
        const blockMs = performance.now() - t;

        setTimeout(() => {
          stop = true;
          done({ blockMs, maxFrameGapMs: Math.max(...gaps), frames: gaps.length });
        }, 250);
      }, 250);
    });
  },

  compileAsyncOnce(opts = {}) {
    const { importer } = createImporter(sources);
    const start = performance.now();

    return sass
      .compileStringAsync(entryFor(opts), {
        importers: [importer],
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'if-function'],
        alertColor: false,
      })
      .then((result) => ({
        ms: performance.now() - start,
        bytes: new TextEncoder().encode(result.css).length,
      }));
  },
};

globalThis.__nfsReady = true;
