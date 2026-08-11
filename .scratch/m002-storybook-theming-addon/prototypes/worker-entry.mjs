// Bundled separately as a classic Worker script. Confirms research/03's
// "trap B": a Worker has no `document`, so Dart Sass's isBrowser() is false
// there. Also measures sync-compile-in-a-worker latency.

import * as sass from 'sass';

import { createImporter, entryFor } from './importer.mjs';
import sources from 'nfs-sources';

self.onmessage = (e) => {
  const { opts, runs } = e.data;
  const times = [];
  let bytes = 0;
  let diagnostic = null;

  // Probe the isBrowser() diagnostic difference: with no importers at all,
  // the main thread says "Custom importers are required ...", a Worker falls
  // back to the generic "Can't find stylesheet to import."
  try {
    sass.compileString('@use "x";');
  } catch (err) {
    diagnostic = String(err.message).split('\n')[0];
  }

  for (let i = 0; i < runs; i += 1) {
    const { importer } = createImporter(sources);
    const t = performance.now();
    const r = sass.compileString(entryFor(opts), {
      importers: [importer],
      quietDeps: true,
      silenceDeprecations: ['import', 'global-builtin', 'if-function'],
      alertColor: false,
    });
    times.push(performance.now() - t);
    bytes = r.css.length;
  }

  self.postMessage({
    times,
    bytes,
    diagnostic,
    hasDocument: typeof self.document !== 'undefined',
  });
};
