// Bundle the sass browser build with THE EXACT minimizer configuration
// @storybook/builder-webpack5@10.5.6's preview-preset produces for a
// PRODUCTION build, and (optionally) with the `--test` / esbuildMinify branch,
// so ticket 05 can settle the mangling contradiction by execution rather than
// by reading config.
//
// Usage: node build-bundle.mjs <outDir> [terser|esbuild|none]

import { dirname as pathDirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync, writeFileSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

import webpack from 'webpack';
import TerserWebpackPlugin from 'terser-webpack-plugin';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const outDir = process.argv[2] ?? join(here, 'out');
const mode = process.argv[3] ?? 'terser';

// Verbatim from node_modules/@storybook/builder-webpack5/dist/presets/preview-preset.js
// (the isProd branch of iframe-webpack.config).
const storybookProdMinimizer = [
  new TerserWebpackPlugin({
    parallel: true,
    terserOptions: {
      sourceMap: true,
      mangle: false,
      keep_fnames: true,
    },
  }),
];

// The `build-storybook --test` branch of the SAME ternary. No keepNames.
const storybookTestMinimizer = [
  new TerserWebpackPlugin({
    parallel: true,
    minify: TerserWebpackPlugin.esbuildMinify,
    terserOptions: { sourcemap: true, treeShaking: true },
  }),
];

const minimizer =
  mode === 'esbuild'
    ? storybookTestMinimizer
    : mode === 'none'
      ? []
      : storybookProdMinimizer;

const compiler = webpack({
  mode: mode === 'none' ? 'development' : 'production',
  devtool: false,
  target: 'web',
  entry: join(here, 'browser-entry.mjs'),
  output: {
    path: outDir,
    filename: `sass-bundle.${mode}.js`,
    clean: false,
  },
  resolve: {
    // Storybook's preview preset values.
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json', '.cjs'],
    mainFields: ['browser', 'module', 'main'],
    conditionNames: [
      'storybook',
      'stories',
      'test',
      'webpack',
      'production',
      'browser',
      'import',
      'module',
      'default',
    ],
    modules: ['node_modules'],
    alias: { 'nfs-sources': join(outDir, 'sources.json') },
    fallback: { crypto: false, assert: false },
  },
  optimization: {
    minimize: minimizer.length > 0,
    ...(minimizer.length > 0 ? { minimizer } : {}),
    moduleIds: 'named',
    sideEffects: true,
    usedExports: mode !== 'none',
  },
  performance: { hints: false },
  infrastructureLogging: { level: 'error' },
  stats: 'errors-warnings',
});

compiler.run((err, stats) => {
  if (err) {
    console.error('[ERROR]', err);
    process.exit(1);
  }

  const info = stats.toJson({ errors: true, warnings: false });

  if (stats.hasErrors()) {
    console.error('[ERROR] webpack errors:');

    for (const e of info.errors.slice(0, 5)) {
      console.error(' -', e.message?.slice(0, 500));
    }

    process.exit(1);
  }

  const file = join(outDir, `sass-bundle.${mode}.js`);
  const raw = readFileSync(file);
  const report = {
    mode,
    rawBytes: raw.length,
    gzipBytes: gzipSync(raw).length,
    // Where did `sass` resolve to?
    sassModule: (info.modules ?? [])
      .map((m) => m.name)
      .filter((n) => n && n.includes('sass') && n.includes('.js'))
      .slice(0, 6),
  };
  writeFileSync(
    join(outDir, `bundle-report.${mode}.json`),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));

  compiler.close(() => {});
});
