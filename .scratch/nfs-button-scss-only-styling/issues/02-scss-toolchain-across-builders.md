# Can every builder in this repo compile the component's `styleUrl` SCSS -- and can that pipeline be post-processed?

Type: research
Status: resolved
Blocked by: —

## Question

Moving NfsButton's default styling to `styleUrl: './nfs-button.scss'` puts the
Sass compile inside each toolchain that builds the component. This repo has
four, and they must agree -- including on resolving `foundation-sites`, which
today is reached by an explicit `--load-path=node_modules` in the
`compile-default-css` Nx target.

Establish concretely:

1. **ng-packagr 22** (`@nx/angular:package`, the publishable build). How does it
   compile component `styleUrl` SCSS, and where does the result end up in the
   FESM output? What Sass load-path configuration does it accept -- confirm the
   exact `ng-package.json` key (`lib.styleIncludePaths` or current equivalent)
   and whether it resolves bare `foundation-sites/...` specifiers or needs an
   explicit `node_modules` path.
2. **Post-processing.** Does ng-packagr run PostCSS over compiled component
   styles, and can a project-local `postcss.config.*` / `.postcssrc.json` hook
   into it? `postcss`, `autoprefixer` and `rtlcss` are already devDependencies.
   If ng-packagr cannot be hooked, is the alternative to precompile SCSS to CSS
   in an Nx target and point `styleUrl` at the generated `.css` -- and does
   ng-packagr accept a generated, gitignored `styleUrl` target?
3. **Storybook 10 + `@storybook/angular`** and **`@nx/angular:unit-test`
   (Vitest)**. Do both compile the same `styleUrl` SCSS, and how is the
   `foundation-sites` load path configured for each? Note that `test-browser`
   runs real Chromium and `test` runs jsdom -- does either skip component style
   compilation or stub it?
4. **`sass` 1.102 and `@import`.** Is `@import` still supported, what is the
   deprecation status and timeline, and what silencing flags exist
   (`--silence-deprecation=import`)? Every builder above must tolerate whatever
   Foundation's legacy `@import` emits, or the build turns noisy or fails.

Report the minimal configuration that makes all four builders compile the same
SCSS the same way, and flag any builder that cannot.

## Answer

Full findings, with commands and observed output:
[research/02-scss-toolchain-across-builders.md](../research/02-scss-toolchain-across-builders.md)

**All four builders can compile the same `styleUrl` SCSS. PostCSS is hookable.
Storybook is the odd one out and needs its own configuration.**

1. **ng-packagr 22.0.2.** Compiles `styleUrl` SCSS through an Angular
   compiler-host `readResource` hook into a per-stylesheet esbuild bundle
   (`cache-compiler-host.js:122-152`), then **inlines it minified into the
   component declaration's `styles: [...]` array in
   `fesm2022/ngx-foundation-sites.mjs`** -- no separate CSS emit, confirming
   ticket 01 independently. Exact `ng-package.json` keys (schema is
   `additionalProperties: false`): `lib.styleIncludePaths`, library-root-relative,
   and `lib.sass.{silence,fatal,future}Deprecations`. **Bare
   `foundation-sites/...` specifiers resolve with zero configuration** -- verified
   green against a pristine `ng-package.json`.
2. **PostCSS is hookable, at the library root only.** `.postcssrc.json` /
   `postcss.config.json` -- JSON only, no `.js` -- searched at `projectBasePath`;
   a workspace-root config is ignored. Verified working in **all four** builders
   with `{"plugins":{"autoprefixer":{},"rtlcss":{}}}`. The precompile fallback also
   works: a **gitignored** generated `.css` used as `styleUrl` was accepted by both
   ng-packagr and Storybook.
3. **Neither Vitest target skips or stubs SCSS.** `@nx/angular:unit-test`
   delegates to `@angular/build`, which performs a full application build; Nx maps
   `@nx/angular:package` -> `@angular/build:ng-packagr`, which reads
   `ng-package.json` and forwards `lib.styleIncludePaths`. **Storybook is a
   different engine** -- webpack plus `@angular-devkit/build-angular`'s
   `sass-loader` -- and is **blind to `ng-package.json`**; it needs
   `stylePreprocessorOptions.includePaths` on its own targets,
   workspace-root-relative. Verified both ways. Carry this jsdom/Chromium
   difference into any assertion: jsdom returns declared values (`0.85em 1em`)
   where Chromium resolves them (`12.24px 14.4px`).
4. **`@import` works in every builder.** `quietDeps` is already on in all three
   Angular builders, so every Foundation-internal warning is silenced; only the
   three `@import` lines in this repo's own `_foundation-button.scss` warn.
   Measured on the CLI: 15 warnings today -> 3 with `--quiet-deps` -> **0** adding
   `--silence-deprecation=import`. The CLI is the **only** consumer that needs
   `--load-path=node_modules`; `pkg:` is unsupported by the CLI.

**Gap worth designing around:** `lib.sass.silenceDeprecations` is **not** forwarded
to `test`/`test-browser`, and Storybook has no `sass` option at all. Route A works
around both -- reach the Foundation-`@import`ing partial through a load path
(`@use 'nfs-button';`) so `quietDeps` covers it, verified as 0 warnings across
build, test and build-storybook simultaneously. Route B (relative import) needs no
load-path configuration but leaves 3 warnings per component stylesheet, scaling to
roughly 57 across 19 components. **Prefer Route A.**

Repo left clean: `git status --porcelain` showed only `?? .scratch/`, and all four
builders were re-verified green on the pristine tree.

Carried forward: `pkg:` under Storybook's webpack importer; the gitignored
generated `.css` under the two Vitest targets specifically; whether repointing
`buildTarget` at an application-shaped target unlocks `silenceDeprecations` for
tests; `SASS_PATH` viability.
