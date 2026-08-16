import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `test-browser` (real Chromium, Vitest browser mode) needs the sass
// package's BROWSER (dart2js) entry -- the one the addon's webpack Worker
// chunk actually ships (D035 part d/e, R021 lane 2). `sass`'s package.json
// `exports` map is a conditional `{ node: {...}, default: {...} }`; empirically
// verified that this project's generated Vitest project config resolves the
// bare `sass` specifier to the `node` conditional export at dev-server serve
// time regardless of the `browser` test config (Angular's own esbuild stage
// marks all node_modules packages external -- see
// external-packages-plugin.js -- so this resolution happens entirely in
// Vite's dev server, not esbuild). The `node` build's CJS entry requires
// Node's `util` module for a custom-inspect hook; Vite externalizes that
// Node builtin for the browser with an empty stub, and the sass package
// crashes dereferencing `util.inspect.custom` on it. Aliasing straight to the
// browser entry file sidesteps the conditional-exports resolution entirely.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^sass$/,
        replacement: fileURLToPath(new URL('../../node_modules/sass/sass.default.js', import.meta.url)),
      },
    ],
  },
  // research/10-r021-verification-design.md section 2.3 flagged Vite's
  // "unexpectedly reloaded a test" warning on sass's first optimization pass
  // (a dependency-optimizer cold-start race against the real Worker's first
  // `new Worker(new URL('./theming-worker.ts', ...))` construction) --
  // pre-including it here avoids paying that reload/race on a cold run.
  optimizeDeps: {
    include: ['sass'],
  },
});
