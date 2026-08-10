# Can every builder in this repo compile the component's `styleUrl` SCSS -- and can that pipeline be post-processed?

Research answer for
`.scratch/nfs-button-scss-only-styling/issues/02-scss-toolchain-across-builders.md`.

**Method.** Every load-bearing claim below is backed either by installed-package
source (`file:line` under `node_modules/`, the authoritative primary source for
the exact versions this repo resolves) or by a command + its observed output run
against this working tree. All repo edits made for the probes were reverted;
`git status` is clean apart from `.scratch/`.

**Headline verdict.** All four builders compile component `styleUrl` SCSS, and
all four resolve bare `foundation-sites/...` specifiers with **zero** load-path
configuration. No builder skips or stubs component style compilation. PostCSS
**can** be hooked, uniformly, via a single `.postcssrc.json` in the library
root. The only genuine divergence is **deprecation-warning silencing**, and it
has a clean workaround (see the load-path route in the final section).

Versions in play (all verified installed):

| Package | Version | Source |
| --- | --- | --- |
| `ng-packagr` | 22.0.2 | `node_modules/ng-packagr/package.json:3` |
| `@angular/build` | 22.0.x | `package.json:27` (`~22.0.4`) |
| `@nx/angular` | 23.1.1 | `package.json:33` |
| `@storybook/angular` | 10.5.x | `package.json:46` |
| `sass` (dart-sass) | 1.102.0 | `node -p "require('sass').info"` -> `dart-sass 1.102.0 (Sass Compiler) [Dart]` |

---

## 1. ng-packagr 22 (`@nx/angular:package`, the publishable build)

### How it compiles component `styleUrl` SCSS

ng-packagr installs an Angular compiler-host `readResource` hook. For any
non-`.html`/`.svg` resource it delegates to the `StylesheetProcessor` and
returns the compiled CSS string in place of the file contents:

- `node_modules/ng-packagr/src/lib/ts/cache-compiler-host.js:122-152` --
  `readResource` -> `stylesheetProcessor.bundleFile(fileName)` -> `return contents`.
  Errors are fatal (`:147-150`); warnings are printed via `esbuild.formatMessages`
  (`:144-146`).
- `resourceNameToFileName` (`:115-121`) resolves `styleUrl` relative to the
  containing `.ts` file and records a dependency edge, so watch-mode
  invalidation works.
- Inline `styles: [...]` go through `transformResource` (`:157-176`) and are only
  preprocessed when `inlineStyleLanguage` is set (default `"css"` --
  `node_modules/ng-packagr/ng-package.schema.json:42-47`). **This asymmetry
  matters:** `styleUrl` SCSS is compiled unconditionally; inline SCSS needs
  `inlineStyleLanguage: "scss"`.

The processor is an esbuild bundle per stylesheet
(`node_modules/ng-packagr/src/lib/styles/component-stylesheets.js:34-43`, one
`BundlerContext` cached per entry), with `minify: true`,
`supported: { nesting: false }`, `conditions: ['style','sass','less','production']`,
`mainFields: ['style','sass']`, `resolveExtensions: []`
(`node_modules/ng-packagr/src/lib/styles/stylesheets/bundle-options.js:36-58`).
The single `.css` output file's text becomes the result
(`component-stylesheets.js:112-147`).

### Where the result ends up in the FESM output

Inlined as a string literal in the component's partial-compilation declaration
(`i0.[theta][theta]ngDeclareComponent`, written here with `[theta]` standing in
for the U+0275 character Angular uses to mark private API) -- specifically its
`styles: [...]` array -- inside `fesm2022/ngx-foundation-sites.mjs`. There is no
separate `.css` emit for component styles.

Observed (probe: `placeholder.scss` set to `@use '../../scss/nfs-button';` plus a
`.zz-probe-marker` rule, then `npx nx build ngx-foundation-sites --skip-nx-cache`
-> exit 0):

```
styles: [".button{display:inline-block;vertical-align:middle;margin:0 0 1rem;border:1px solid transparent;
border-radius:0;transition:background-color .25s ease-out,color .25s ease-out;font-family:inherit;
font-size:.9rem;-webkit-appearance:none;line-height:1;text-align:center;cursor:pointer;padding:.85em 1em}
[data-whatinput=mouse] .button{outline:0}...[.zz-probe-marker{color:red}]\n"] });
```

Facts from that output:

- One `styles` array entry per `styleUrl` entry (a two-element `styleUrls` array
  produced two separate strings -- verified in the generated-CSS probe below).
- **Minified** (`bundle-options.js:39`). Length of the whole button stylesheet
  was 4506 chars.
- Foundation's `disable-mouse-outline` leaked in as `[data-whatinput=mouse] .button{outline:0}`
  (relevant to the map's open a11y question, and it is present in the FESM, not
  just in the CLI-precompiled CSS).
- `_global.scss` did **not** leak: no `box-sizing` reset in the emitted CSS.
- `packages/.../placeholder.scss` itself is **not** copied to `dist` -- only
  `src/scss` ships, via the existing `assets` entry
  (`packages/ngx-foundation-sites/ng-package.json:5-11`).

### Exact `ng-package.json` keys

`node_modules/ng-packagr/ng-package.schema.json` -- top level is
`"additionalProperties": false` (`:108`), so only these exist:

| Key | Line | Notes |
| --- | --- | --- |
| `lib.styleIncludePaths: string[]` | `:69-75` | "Any additional paths that should be used to resolve style imports". **This is the current and only load-path key** -- there is no newer equivalent. |
| `lib.sass.silenceDeprecations: string[]` | `:87-93` | |
| `lib.sass.fatalDeprecations: string[]` | `:80-86` | |
| `lib.sass.futureDeprecations: string[]` | `:94-100` | |
| `inlineStyleLanguage` | `:42-47` | `css` \| `less` \| `sass` \| `scss` |
| `lib.cssUrl` | `:63-68` | `inline` \| `none` |

`lib.styleIncludePaths` entries are resolved **relative to the directory
containing `ng-package.json`** (the library root), not the workspace root:
`node_modules/ng-packagr/src/lib/ng-package/entry-point/entry-point.js:141-144`
(`path.resolve(this.basePath, includePath)`). They are handed to dart-sass as
`loadPaths` (`node_modules/ng-packagr/src/lib/styles/stylesheets/sass-language.js:102`).

### Bare `foundation-sites/...` specifiers: resolved with NO load path

**No explicit `node_modules` path is needed.** ng-packagr registers a Sass
`findFileUrl` importer that delegates to esbuild's resolver, with an extra
package-root fallback for deep imports:
`node_modules/ng-packagr/src/lib/styles/stylesheets/sass-language.js:109-136`
(and `:56-67` for the resolve callback; `:71-82` `parsePackageName`).

Empirically: `packages/ngx-foundation-sites/src/scss/_foundation-button.scss:46-48`
already uses `@import 'foundation-sites/scss/util/util'` / `.../global` /
`.../components/button`. With **`ng-package.json` untouched** (no
`styleIncludePaths`), `npx nx build ngx-foundation-sites --skip-nx-cache` exited
0 and produced the fully-resolved Foundation CSS shown above.

Negative control proving `lib.styleIncludePaths` is nevertheless wired
correctly: a probe partial placed at `zz-loadpath/_zz-probe-loadpath.scss`
(workspace root) and imported as bare `@use 'zz-probe-loadpath';` --

- with `"styleIncludePaths": ["../../zz-loadpath"]` -> build exit 0,
  `.zz-loadpath-marker` present in the FESM.
- with the key removed -> build exit 1,
  `[ERROR] Can't find stylesheet to import.`

`pkg:`-prefixed specifiers also work in ng-packagr (`sass-language.js:61,72`
strip the prefix) but **not** in the dart-sass CLI -- see section 4. Prefer
plain bare specifiers, which work everywhere.

---

## 2. Post-processing (PostCSS)

### Yes -- ng-packagr runs PostCSS, and a project-local config hooks into it

`node_modules/ng-packagr/src/lib/styles/postcss-configuration.js:11`:

```js
const postcssConfigurationFiles = ['postcss.config.json', '.postcssrc.json'];
```

Constraints read straight from that file:

- **JSON only.** `readPostcssConfiguration` does `JSON.parse(readFileSync(...))`
  (`:62-66`). `postcss.config.js` / `.cjs` / `.mjs` / `.ts` are **not** in the
  list and would not be parsed.
- Both the array form (`["autoprefixer", ["rtlcss", {...}]]`) and the object-map
  form (`{"autoprefixer": {}, "rtlcss": {}}`) are accepted and normalised
  (`:78-105`). A plugin whose options value is neither an object nor a string is
  silently skipped (`:100-102`) -- so `{"autoprefixer": true}` would be a
  no-op. Use `{}`.
- Plugins are loaded by bare name from ng-packagr's own resolution context and
  must expose `plugin.postcss === true`:
  `node_modules/ng-packagr/src/lib/styles/stylesheets/stylesheet-plugin-factory.js:143-149`.
  Verified for this repo's devDependencies:
  `node -e "console.log(require('autoprefixer').postcss, require('rtlcss').postcss)"`
  -> `true true`.
- When a postcss configuration is present, PostCSS runs over **every** compiled
  component stylesheet, not just Tailwind-flavoured ones:
  `stylesheet-plugin-factory.js:187` (`options.postcssConfiguration || hasTailwindKeywords(...)`).
- A postcss configuration **disables** Tailwind auto-detection
  (`node_modules/ng-packagr/src/lib/styles/stylesheet-processor.js:31`). Irrelevant
  here (no Tailwind).

### Search scope: library root ONLY for ng-packagr

`node_modules/ng-packagr/src/lib/styles/stylesheet-processor.js:26` passes a
**single** search root:

```js
const searchDirs = generateSearchDirectories([projectBasePath]);
```

and `projectBasePath` is the primary entry point's `basePath` --
`node_modules/ng-packagr/src/lib/ng-package/entry-point/compile-ngc.transform.js:68,77`
-- i.e. `packages/ngx-foundation-sites/`.

Empirical proof of the scope, using `{"plugins": {"autoprefixer": {}, "rtlcss": {}}}`
and watching whether rtlcss flips `margin-left: 1em` (from Foundation's
`button-dropdown`) to `margin-right: 1em`:

| `.postcssrc.json` location | ng-packagr result |
| --- | --- |
| `packages/ngx-foundation-sites/.postcssrc.json` | `margin-right:1em` **true**, `margin-left:1em` false, `float:left` true -> PostCSS ran |
| workspace root `./.postcssrc.json` | `margin-right:1em` **false**, `margin-left:1em` true -> ignored |

The other two toolchains search **both** the project root and the workspace root
(`node_modules/@angular/build/src/builders/application/options.js:129` and
`node_modules/@angular-devkit/build-angular/src/tools/webpack/configs/styles.js:89-90`,
both `generateSearchDirectories([projectRoot, root])`). So the **library root is
the only location that all three honour** -- put it there.

### Verified: the same `.postcssrc.json` is honoured by all four builders

`packages/ngx-foundation-sites/.postcssrc.json` = `{"plugins":{"autoprefixer":{},"rtlcss":{}}}`,
probe SCSS containing `margin-left: 3px; user-select: none;`:

| Builder | Command | rtlcss flipped to `margin-right: 3px` | autoprefixer added `-webkit-user-select` |
| --- | --- | --- | --- |
| ng-packagr | `npx nx build ngx-foundation-sites --skip-nx-cache` | yes | yes |
| Vitest jsdom | `npx nx test ngx-foundation-sites --skip-nx-cache` | yes | yes |
| Vitest Chromium | `npx nx run ngx-foundation-sites:test-browser --skip-nx-cache` | yes | yes |
| Storybook | `npx nx run ngx-foundation-sites:build-storybook --skip-nx-cache` | yes (`margin-right: 3px` in `src-lib-placeholder-placeholder-stories.*.iframe.bundle.js`) | yes (`-webkit-user-select: none;\n          user-select: none;`) |

Note the RTL consequence: a `.postcssrc.json` carrying `rtlcss` flips **every**
component stylesheet in **every** builder unconditionally -- it is a global,
single-direction transform with no LTR/RTL pairing. It is a valid proof that the
hook works; it is **not** a viable RTL mechanism on its own (D018's dual-file
approach has no equivalent here, since `styleUrl` yields exactly one stylesheet
per component). Autoprefixer, by contrast, is safe to enable this way.
Browserslist for the probe came from the repo's root `.browserslistrc`
(`baseline widely available`), which still admits Safari old enough to need the
`-webkit-user-select` prefix.

### Fallback path (not needed, but confirmed to work)

Precompiling SCSS to CSS in an Nx target and pointing `styleUrl`/`styleUrls` at
a **generated, gitignored** `.css` file works. ng-packagr has no git awareness:
`readResource` goes through `compilerHost.fileExists` + the esbuild bundle
(`cache-compiler-host.js:126-135`).

Probe: `zz-generated.css` created inside the component folder and added to
`.git/info/exclude` (so `git check-ignore` reported it ignored), with
`styleUrls: ['./placeholder.scss', './zz-generated.css']`:

- `npx nx build ngx-foundation-sites --skip-nx-cache` -> exit 0. FESM contained
  `..., ".zz-generated-marker{color:teal}\n"] });` as a second array entry.
- `npx nx run ngx-foundation-sites:build-storybook --skip-nx-cache` -> exit 0,
  marker present in the story bundle.

Since PostCSS **can** be hooked directly, this fallback is unnecessary for
post-processing. It remains the only route if a transform is needed that PostCSS
cannot express, or if per-direction (LTR/RTL) stylesheet pairs are wanted.

---

## 3. Storybook 10 + `@storybook/angular`, and `@nx/angular:unit-test` (Vitest)

### `@nx/angular:unit-test` -- both `test` (jsdom) and `test-browser` (Chromium)

It is a thin delegate to `@angular/build`'s unit-test builder:
`node_modules/@nx/angular/dist/src/executors/unit-test/unit-test.impl.js:26-30`
(`executeUnitTestBuilder`). The builder performs a **full `@angular/build`
application build** of the spec entrypoints before running Vitest
(`node_modules/@angular/build/src/builders/unit-test/builder.js:319-331`), so
component styles are compiled by exactly the same esbuild + dart-sass pipeline
ng-packagr uses -- ng-packagr ships its own copy of that code. Observed prefix of
both runs: `Application bundle generation complete. [2.4 seconds]`.

**Neither runner skips or stubs component style compilation.** Probe report from
a spec that renders `Placeholder` and dumps DOM state (`console.log` is swallowed
by the builder's reporter, so the probe asserted against a sentinel to force the
values into the failure diff):

| Field | `nx test` (jsdom) | `nx run test-browser` (Chromium) |
| --- | --- | --- |
| component-injected `<style>` elements | 1 | 2 |
| compiled `.button` rule in DOM | true | true |
| `[data-whatinput=mouse]` present | true | true |
| total injected CSS length | 8326 | 8420 |
| `ComponentDef.styles.length` (the `[theta]cmp` static) | 1 | 1 |
| `ComponentDef.styles[0]` head | `\n.button[_ngcontent-%COMP%] {\n  display: inline-block;\n  vertical-align: middle;\n  margin:` | identical |
| `encapsulation` | `0` (Emulated) | `0` |
| `getComputedStyle('.zz-probe-marker').color` | `rgb(255, 0, 0)` | `rgb(255, 0, 0)` |
| `getComputedStyle('.button').display` | `inline-block` | `inline-block` |
| `getComputedStyle('.button').padding` | **`0.85em 1em`** | **`12.24px 14.4px`** |

Two consequences worth carrying forward:

- The CSS is **expanded, not minified** here (contrast the FESM), and carries
  `[_ngcontent-%COMP%]` because `ViewEncapsulation.Emulated` is still the default
  on `Placeholder`.
- jsdom **does** apply the cascade, but returns *declared* values -- it does not
  resolve `em` to `px`. Chromium does. Any assertion on a Foundation-derived
  length must therefore live in a `*.browser.spec.ts`, or assert the declared
  string. This is a real, load-bearing difference between the two test targets.

**`foundation-sites` load-path config for the unit-test builders: inherited from
`ng-package.json`.** Nx maps its own executors onto the builder names
`@angular/build:unit-test` recognises --
`node_modules/@nx/angular/dist/src/executors/unit-test/unit-test.impl.js:58-71`:

```js
const executorToBuilderMap = new Map([
  ['@nx/angular:application',      '@angular/build:application'],
  ['@nx/angular:ng-packagr-lite',  '@angular/build:ng-packagr'],
  ['@nx/angular:package',          '@angular/build:ng-packagr'],
]);
```

so this project's `build` target (`@nx/angular:package`) is seen as
`@angular/build:ng-packagr`, which routes into `transformNgPackagrOptions`
(`node_modules/@angular/build/src/builders/unit-test/builder.js:277-279`,
implementation `:349-378`). That function reads `ng-package.json` and maps
exactly three things:

```js
const { lib: { styleIncludePaths = [] } = {}, assets = [], inlineStyleLanguage } = ngPackageJson;
const includePaths = styleIncludePaths.map(p => path.resolve(path.dirname(ngPackagePath), p));
return { stylePreprocessorOptions: includePaths.length ? { includePaths } : undefined, assets: ..., inlineStyleLanguage };
```

Verified empirically with the `zz-loadpath` probe:

| `ng-package.json` `lib.styleIncludePaths` | `nx test` | `nx run test-browser` |
| --- | --- | --- |
| `["../../zz-loadpath"]` | compiles (no stylesheet error; CSS length grew 8255 -> 8329) | -- |
| removed | -- | exit 1, `[ERROR] Can't find stylesheet to import.` |

`buildTarget` defaults to `<thisProject>:build:development`
(`node_modules/@angular/build/src/builders/unit-test/schema.json:7-11`,
`options.js:39`), which is why no explicit wiring is needed in `project.json`.

**GAP: `lib.sass` is NOT forwarded.** `transformNgPackagrOptions` returns only
`stylePreprocessorOptions.includePaths`, `assets` and `inlineStyleLanguage` -- it
never reads `lib.sass`. And `@nx/angular:unit-test`'s own schema has no
`stylePreprocessorOptions` key at all (properties are: `buildTarget, tsConfig,
runner, runnerConfig, browsers, browserViewport, headless, isolate, quiet,
include, exclude, filter, watch, debug, ui, coverage, coverageInclude,
coverageExclude, coverageReporters, coverageThresholds, coverageWatermarks,
reporters, outputFile, providersFile, setupFiles, progress, listTests,
dumpVirtualFiles, plugins, indexHtmlTransformer`). Verified empirically: with
`"lib": { "sass": { "silenceDeprecations": ["import"] } }` in `ng-package.json`,
the ng-packagr build went silent while `nx test` still printed all three
`@import` deprecation warnings. There is **no supported way** to pass
`silenceDeprecations` to `test` / `test-browser` short of repointing `buildTarget`
at an `@angular/build:application`-shaped target.

### Storybook 10 + `@storybook/angular` -- a different engine (webpack)

Storybook does **not** use `@angular/build`. Its Angular preset builds a webpack
config from the **legacy** `@angular-devkit/build-angular` browser-builder
pieces: `node_modules/@storybook/angular/dist/_node-chunks/angular-cli-webpack-VNEX2DZH.js:55-62`
(`generateI18nBrowserWebpackConfigFromContext`, `getCommonConfig`,
`getStylesConfig`, `getTypeScriptConfig`) and `:105-131`. SCSS is compiled by
`sass-loader`, confirmed by the observed warning attribution:

```
Module Warning (from ./node_modules/@angular-devkit/build-angular/node_modules/sass-loader/dist/cjs.js):
Deprecation Warning on line 45, column 8 of file:///.../src/scss/_foundation-button.scss:45:8
  packages\ngx-foundation-sites\src\scss\_foundation-button.scss 46:9  @use
  packages\ngx-foundation-sites\src\scss\nfs-button.scss 23:1          @use
  packages\ngx-foundation-sites\src\lib\placeholder\placeholder.scss 2:1  root stylesheet
```

Bare `foundation-sites/...` specifiers resolve here too, via a webpack-backed
Sass importer:
`node_modules/@angular-devkit/build-angular/src/tools/webpack/configs/styles.js:306-327`
(`api: 'modern'`, `webpackImporter: false`, custom
`getSassResolutionImporter` with `conditionNames: ['sass','style']`,
`mainFields: ['sass','style','main','...']`). `npx nx run ngx-foundation-sites:build-storybook --skip-nx-cache`
exited 0 with the compiled Foundation CSS present in
`dist/storybook/ngx-foundation-sites/src-lib-placeholder-placeholder-stories.*.iframe.bundle.js`.

**Load-path lever for Storybook: `stylePreprocessorOptions.includePaths` on the
storybook target itself, resolved against the WORKSPACE root.** Two facts make
this work:

1. `@storybook/angular`'s builder schemas declare it as a first-class option --
   `node_modules/@storybook/angular/build-schema.json` (`additionalProperties: false`;
   properties `browserTarget, tsConfig, outputDir, preserveSymlinks, configDir,
   loglevel, logfile, debugWebpack, enableProdMode, quiet, docs, test, compodoc,
   compodocArgs, webpackStatsJson, statsJson, previewUrl, styles,
   stylePreprocessorOptions, assets, sourceMap, experimentalZoneless`), and the
   same key exists in `start-schema.json` for the dev `storybook` target.
2. `getBuilderOptions` merges the `browserTarget`'s options **and the current
   target's own options** --
   `node_modules/@storybook/angular/dist/server/framework-preset-angular-cli.js:142-156`.
   Because `project.json` points `browserTarget` at `build-storybook` itself
   (`packages/ngx-foundation-sites/project.json:98`), those are the same object;
   either way, keys on the storybook target reach `getStylesConfig`.
   `styles.js:65` then does `stylePreprocessorOptions.includePaths.map(p => path.resolve(root, p))`
   where `root` is the **workspace** root.

Empirically decisive, with the `zz-loadpath` probe:

| Config | `build-storybook` |
| --- | --- |
| `ng-package.json` `lib.styleIncludePaths: ["../../zz-loadpath"]`, nothing in `project.json` | **exit 1** -- `Module build failed (from .../sass-loader/dist/cjs.js): Can't find stylesheet to import.` at `placeholder.scss 3:1` |
| `project.json` `build-storybook.options.stylePreprocessorOptions.includePaths: ["zz-loadpath"]` | exit 0, `.zz-loadpath-marker` in the bundle |

**So Storybook is blind to `ng-package.json`.** Any load path must be declared
twice: once in `ng-package.json` (for build + both test targets) and once per
storybook target in `project.json` (`storybook` and `build-storybook`), with a
different base directory each time (library root vs workspace root).

**GAP: Storybook cannot silence Sass deprecations at all.** Its
`stylePreprocessorOptions` sub-schema is `{"includePaths": [...]}` with
`additionalProperties: false` -- there is no `sass` sub-object. And
`getSassLoaderOptions` (`styles.js:306-327`) never passes `silenceDeprecations`,
`fatalDeprecations` or `futureDeprecations`; the only warning control it wires is
`quietDeps: !verbose` (`:322`).

### `test-storybook`

Not a fifth Sass toolchain. `packages/ngx-foundation-sites/project.json:108-113`
shows it `dependsOn: ["build-storybook"]` and runs `@storybook/test-runner`
against the static output served on port 4400, so it consumes whatever
`build-storybook` compiled.

---

## 4. `sass` 1.102 and `@import`

### Still supported; deprecated but not removed

From the installed compiler's own registry
(`node -e "console.log(JSON.stringify(require('sass').deprecations['import']))"`):

```json
{"id":"import","status":"active","description":"@import rules.",
 "deprecatedIn":{"..._version$_text":"1.80.0"},"obsoleteIn":null}
```

`obsoleteIn: null` -> not yet removed. `status: "active"` -> emits warnings now.

Corroborated by <https://sass-lang.com/documentation/breaking-changes/import/>
(fetched 2026-08-09; that page lists the current release as Dart Sass 1.102.0,
matching this repo):

> `@import` is now deprecated as of Dart Sass 1.80.0.
> ... we don't expect to remove Sass `@import` rules or global built-in functions
> until Dart Sass 3.0.0, which will be released no sooner than two years after
> Dart Sass 1.80.0.

So Foundation for Sites 6.9.0's legacy `@import` Sass has a floor of roughly
**Dart Sass 3.0.0, no earlier than late 2026**, and all four builders compile it
today -- confirmed by every green run recorded above.

Two separate deprecation IDs are involved, per the same page:

> While the deprecations for `@import` and global built-ins are being released
> together ... they are considered separate deprecations for the purpose of the
> API. If you wish to silence both ... you'll need to pass both `import` and
> `global-builtin`.

Foundation triggers both, plus `if-function` -- observed IDs from
`compile-default-css`: `[import]`, `[if-function]`, `[global-builtin]`.

### Why the noise is smaller than it looks: `quietDeps`

Per the docs, "a 'dependency' is any stylesheet that's not just a series of
relative loads from the entrypoint stylesheet. This means anything that comes
from a load path, and most stylesheets loaded through custom importers."

All three Angular builders enable `quietDeps` already:

- ng-packagr: hardcoded `quietDeps: true`
  (`node_modules/ng-packagr/src/lib/styles/stylesheets/sass-language.js:108`).
- `@angular/build` unit-test: same vendored code path.
- Storybook: `quietDeps: !verbose`
  (`.../build-angular/src/tools/webpack/configs/styles.js:322`).

Because Foundation is reached through a package importer, **every warning coming
from inside `node_modules/foundation-sites` is already silenced** in all three.
The only surviving warnings are the three `@import` lines in the repo's *own*
`packages/ngx-foundation-sites/src/scss/_foundation-button.scss:46-48`, which are
a relative load from the entrypoint and therefore not "dependency" code.

### Silencing flags, per toolchain

| Toolchain | Flag / key | Status |
| --- | --- | --- |
| dart-sass CLI (`compile-default-css`) | `--silence-deprecation=<id>`, `--quiet-deps`, `--fatal-deprecation`, `--future-deprecation`, `-q/--quiet`, `--verbose` | available (`npx sass --help` lines 32-41) |
| ng-packagr | `ng-package.json` `lib.sass.silenceDeprecations` | **works** (verified) |
| `@nx/angular:unit-test` (both targets) | -- | **NOT AVAILABLE** (see section 3) |
| Storybook | -- | **NOT AVAILABLE** (see section 3) |

CLI behaviour measured on the real `nfs-button.scss`:

| Flags | `DEPRECATION WARNING` count |
| --- | --- |
| `--load-path=node_modules` (today's target, `project.json:38`) | **15** printed + `WARNING: 101 repetitive deprecation warnings omitted.` |
| `+ --quiet-deps` | **3** (only our own `@import` lines) |
| `+ --quiet-deps --silence-deprecation=import` | **0 bytes of output**, exit 0 |
| `--quiet-deps --silence-deprecation=import` **without** `--load-path` | exit 65, `Error: Can't find stylesheet to import.` |

That last row is the key asymmetry: **the dart-sass CLI is the only consumer in
this repo with no node_modules resolution.** It genuinely needs
`--load-path=node_modules` (or `SASS_PATH`, the only Sass-related env var in the
binary -- `rg -o "SASS_[A-Z_]+" node_modules/sass/sass.dart.js` yields only
`SASS_PATH`). `pkg:` is also unsupported by the CLI, with or without a load
path:

```
$ npx sass --load-path=node_modules ... "@use 'pkg:foundation-sites/scss/util/util' as u;"
Error: Can't find stylesheet to import.   (exit 65)
```

ng-packagr does accept `pkg:` (`sass-language.js:61,72`). **Use plain bare
specifiers** -- the one syntax all four accept.

### Terse mode caveat, which scales with component count

The docs note that terse mode prints each deprecation type only five times, and:

> When running from the JS API, Sass doesn't share any information across
> compilations, so by default it'll print five warnings for *each stylesheet*
> that's compiled.

ng-packagr and `@angular/build` create **one Sass compilation per component
stylesheet** (`component-stylesheets.js:34-43`, one cached `BundlerContext` per
entry). So once the pattern is rolled out to the remaining 18 Foundation
components, the three `@import` warnings repeat **per component** in
`test`, `test-browser` and `build-storybook` -- where they cannot be silenced by
configuration. That is ~57 warnings per run at 19 components. This is the
strongest argument for the load-path route below.

---

## Minimal configuration that makes all four builders agree

Two viable routes. Both make all four builders compile the same SCSS. They differ
only in configuration count vs. console noise.

### Route A (recommended): reach the Foundation-`@import`ing partial through a load path

Component SCSS uses a **bare** specifier for the shared partial. That makes the
partial (and everything it relatively loads, including Foundation) a Sass
"dependency", so the `quietDeps` that all three Angular builders already enable
silences **every** deprecation warning -- with no `silenceDeprecations` key
anywhere, and therefore no gap in `test`/`test-browser`/Storybook.

**1. Component stylesheet** -- `packages/ngx-foundation-sites/src/lib/nfs-button/nfs-button.scss`:

```scss
@use 'nfs-button';
```

(bare, resolved via load path -- **not** `@use '../../scss/nfs-button'`)

**2. `packages/ngx-foundation-sites/ng-package.json`** -- covers `build`,
`test` and `test-browser` (paths relative to the **library root**):

```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/packages/ngx-foundation-sites",
  "deleteDestPath": false,
  "assets": [{ "glob": "**/*", "input": "src/scss", "output": "scss" }],
  "lib": {
    "entryFile": "src/index.ts",
    "styleIncludePaths": ["src/scss"]
  }
}
```

**3. `packages/ngx-foundation-sites/project.json`** -- Storybook only; paths
relative to the **workspace root**; needed on **both** storybook targets:

```json
"storybook": {
  "executor": "@storybook/angular:start-storybook",
  "options": {
    "port": 4400,
    "configDir": "packages/ngx-foundation-sites/.storybook",
    "browserTarget": "ngx-foundation-sites:build-storybook",
    "compodoc": false,
    "stylePreprocessorOptions": {
      "includePaths": ["packages/ngx-foundation-sites/src/scss"]
    }
  }
},
"build-storybook": {
  "executor": "@storybook/angular:build-storybook",
  "outputs": ["{options.outputDir}"],
  "options": {
    "outputDir": "dist/storybook/ngx-foundation-sites",
    "configDir": "packages/ngx-foundation-sites/.storybook",
    "browserTarget": "ngx-foundation-sites:build-storybook",
    "compodoc": false,
    "stylePreprocessorOptions": {
      "includePaths": ["packages/ngx-foundation-sites/src/scss"]
    }
  }
}
```

**4. `compile-default-css`** (only if that target survives -- see the map's open
question). It compiles `src/scss/nfs-button.scss` *as the entrypoint*, so its own
relative loads are never "dependencies"; it needs the explicit ID:

```
npx sass --quiet-deps --silence-deprecation=import --load-path=node_modules --no-source-map \
  packages/ngx-foundation-sites/src/scss/nfs-button.scss \
  dist/packages/ngx-foundation-sites/css/nfs-button.css
```

Measured: 0 bytes of output, exit 0 (vs. 15 warnings + 101 omitted today).

**Verified end-to-end.** With steps 1-3 applied (probe stylesheet
`@use 'nfs-button';`):

```
npx nx build ngx-foundation-sites --skip-nx-cache          -> exit 0, 0 "angular-sass" warnings
npx nx test ngx-foundation-sites --skip-nx-cache           -> exit 0, 0 "angular-sass" warnings
npx nx run ngx-foundation-sites:build-storybook --skip-nx-cache -> exit 0, 0 "Deprecation" lines,
                                                              Foundation CSS present in the bundle
```

### Route B (fewest config keys): relative import, accept the warnings

Component SCSS uses `@use '../../scss/nfs-button';`. Then **no load-path
configuration is needed anywhere** -- verified: `nx build`, `nx test`,
`nx run test-browser` and `nx run build-storybook` all exited 0 with the pristine
`ng-package.json` and `project.json`, because all four resolve bare
`foundation-sites/...` natively. Cost: three `@import` deprecation warnings per
compiled component stylesheet, silenceable only in ng-packagr
(`ng-package.json` `lib.sass.silenceDeprecations: ["import"]`, verified to work),
scaling to ~57 warnings per run once all 19 components adopt the pattern.

### PostCSS (both routes, if wanted)

One file, at the **library root** -- the only path all three engines search.
JSON only; `.js`/`.mjs`/`.ts` configs are not read by ng-packagr.

`packages/ngx-foundation-sites/.postcssrc.json`:

```json
{
  "plugins": {
    "autoprefixer": {}
  }
}
```

Do **not** put `rtlcss` here unless a globally, unconditionally mirrored
stylesheet is actually wanted -- it flips every component stylesheet in every
builder with no LTR counterpart. Also note that adding a postcss configuration
switches off Tailwind auto-detection (irrelevant here).

### Summary of which builder honours which lever

| Lever | ng-packagr `build` | `test` (jsdom) | `test-browser` | `build-storybook` |
| --- | --- | --- | --- | --- |
| Bare `foundation-sites/...`, no config | yes | yes | yes | yes |
| `pkg:` prefix | yes | yes | yes | UNRESOLVED (untested; webpack importer path differs) |
| `ng-package.json` `lib.styleIncludePaths` | yes | yes | yes | **no** |
| `project.json` `stylePreprocessorOptions.includePaths` | n/a | n/a | n/a | yes (workspace-root-relative) |
| `ng-package.json` `lib.sass.silenceDeprecations` | yes | **no** | **no** | **no** |
| `quietDeps` (always on) | yes | yes | yes | yes (`!verbose`) |
| library-root `.postcssrc.json` | yes | yes | yes | yes |
| workspace-root `.postcssrc.json` | **no** | yes | yes | yes |
| gitignored generated `.css` as `styleUrl` | yes | UNRESOLVED (untested) | UNRESOLVED (untested) | yes |
| minified output | yes | no (expanded) | no (expanded) | no (expanded) |

### Builders that cannot be made to agree

None on **compilation**. Two cannot be made to agree on **warning silencing** by
configuration:

- `@nx/angular:unit-test` (`test` and `test-browser`) -- `transformNgPackagrOptions`
  reads only `lib.styleIncludePaths`, `assets`, `inlineStyleLanguage`; the Nx
  executor schema exposes no `stylePreprocessorOptions`.
- `@storybook/angular` -- schema has no `sass` sub-object; `getSassLoaderOptions`
  never passes deprecation options.

Route A works around both by making the warnings `quietDeps`-eligible rather than
by silencing them.

---

## UNRESOLVED

1. **`pkg:` specifiers under Storybook's webpack sass importer.** Confirmed
   working in ng-packagr (`sass-language.js:61,72` strip the prefix) and
   confirmed *not* working in the dart-sass CLI (exit 65, with and without
   `--load-path`). Not tested against `getSassResolutionImporter`. Would be
   settled by a one-line probe stylesheet using `@use 'pkg:foundation-sites/scss/util/util'`
   plus `npx nx run ngx-foundation-sites:build-storybook`. Moot for the
   recommendation, which uses plain bare specifiers everywhere.
2. **Gitignored generated `.css` as `styleUrl` under the two Vitest targets.**
   Proven for ng-packagr and Storybook. Not separately probed for `test` /
   `test-browser`, though they share ng-packagr's resource-loading code and there
   is no git-awareness anywhere in it, so failure would be surprising. Would be
   settled by re-running the `zz-generated.css` probe with `nx test` and
   `nx run test-browser`.
3. **Whether `lib.sass.silenceDeprecations` could reach the unit-test targets by
   repointing `buildTarget` at an `@angular/build:application`-shaped target.**
   The schema path exists (`application/schema.json:174-196` has
   `stylePreprocessorOptions.sass.silenceDeprecations`), but standing up a dummy
   application target for a publishable library was not attempted and is likely
   worse than Route A. Would be settled by adding such a target and setting
   `test.options.buildTarget`.
4. **`SASS_PATH` as an alternative to `--load-path`.** The env var exists in the
   binary (only `SASS_*` string found in `node_modules/sass/sass.dart.js`) but was
   not exercised, and whether the JS-API-driven builders honour it is unknown.
   Not relied upon anywhere above.

## Out of scope for this ticket but surfaced by the probes

- Foundation's `disable-mouse-outline` **does** reach the FESM output as
  `[data-whatinput=mouse] .button{outline:0}` -- feeds the map's open a11y
  question directly.
- `_global.scss` did **not** leak a `box-sizing` reset into the compiled
  component CSS.
- jsdom returns declared CSS values (`0.85em 1em`) where Chromium resolves them
  (`12.24px 14.4px`); any px-level Foundation assertion must live in a
  `*.browser.spec.ts`.
- D018's dual-file rtlcss mechanism has no `styleUrl` equivalent: one component
  stylesheet per component, and a `.postcssrc.json` rtlcss entry mirrors
  everything unconditionally in every builder.
