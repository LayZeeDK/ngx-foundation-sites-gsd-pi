# How Foundation's Sass reaches the browser -- findings

Resolves ticket `.scratch/m002-storybook-theming-addon/issues/08-foundation-sass-into-the-browser.md`.
Status: **resolved, decision LOCKED** (AFK -- no human in the loop, per map.md Notes).

No repo code was changed. Only `.scratch/` was read from and written to. Every
command run was read-only.

## Evidence key

- **[V-REPO]** -- verified by reading a tracked file in THIS repo (path + line cited).
- **[V-EXEC]** -- verified by executing a read-only command here, output quoted.
- **[V-SRC]** -- verified by reading shipped `node_modules` source (path + line cited).
- **[V-PRIOR]** -- carried from ticket 01-07's own verification, cited.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

---

## 1. THE LOCKED DECISION

> **Build-time inlining (ticket option 1): a generator script at
> `packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs` compiles
> the real `theme()` chain in Node with a disk-backed importer, records exactly
> the canonical URLs it served, and emits a COMMITTED TypeScript data module
> under `packages/ngx-foundation-sites/.storybook/` which the addon's Worker
> feeds to `prototypes/importer.mjs`'s in-memory importer verbatim -- with a
> `verify-theming-sources` Nx gate, wired into `lint`'s `dependsOn` beside
> `verify-foundation-parity` and `verify-exports-map`, that regenerates in
> memory, byte-compares against the committed module, AND re-proves the
> string-map compile is byte-identical to the filesystem compile.**

Two riders, both load-bearing:

- **`sass` is lazy by CONSTRUCTION, not by `await import()`.** It is imported
  from the Worker module and from nowhere else, so webpack emits it in the
  worker chunk and the preview's boot path is unchanged. The invariant to gate
  is negative: no sass marker in any chunk `iframe.html` loads (section 5).
- **Ticket 06's "middle-option rule 2" is not satisfiable as written and is
  amended, not silently broken.** `ngx-foundation-sites/scss/button` is
  **unresolvable from the workspace root** -- VERIFIED below -- so no mechanism
  can honour it. The boundary is restated in section 4.

---

## 2. Why option 4 (bundler raw imports) loses -- VERIFIED, and it is decisive

The map correctly says webpack 5, not Vite, so this option means webpack's
`asset/source` or `raw-loader`. Both are blocked here, for reasons specific to
`@storybook/angular`'s webpack assembly.

### 2.1 `raw-loader` is not installed

[V-EXEC] `ls node_modules/raw-loader` -> `No such file or directory`. It is
absent from root `package.json`'s `devDependencies` [V-REPO: `package.json`].
Adding it is a new npm dependency for a job webpack 5 does natively, so this
reduces to `asset/source`.

### 2.2 Angular's `.scss` rule runs `sass-loader` UNCONDITIONALLY, and no query escapes it

[V-SRC: `node_modules/@angular-devkit/build-angular/src/tools/webpack/configs/styles.js:270-289`],
the rule `getStylesConfig` emits for every style language:

```js
rules: styleLanguages.map(({ extensions, use }) => ({
  test: new RegExp(`\\.(?:${extensions.join('|')})$`, 'i'),
  rules: [
    { oneOf: [
        { use: globalStyleLoaders, resourceQuery: /\?ngGlobalStyle/ },
        { use: componentStyleLoaders, resourceQuery: /\?ngResource/ },
    ]},
    { use },          // <-- resolve-url-loader + sass-loader, NO condition
  ],
}))
```

For `scss`, `use` is `resolve-url-loader` + `sass-loader`
[V-SRC: `styles.js:224-237`]. That second nested rule carries **no `test`, no
`resourceQuery`, no `include`** -- so `sass-loader` runs on every `.scss`
resource the outer `test` matches, whatever query you append. This is the
structural difference from Vite: `?raw` works there because Vite branches on the
query; here the query only selects which `oneOf` branch of the CSS pipeline
applies, and the Sass compile happens outside the `oneOf` entirely.

Two concrete failure modes follow, and the second is the dangerous one:

| Attempt | Outcome |
| --- | --- |
| `import src from 'foundation-sites/scss/util/_util.scss'` with no extra config | `sass-loader` runs; neither `oneOf` branch matches (no `?ngResource` / `?ngGlobalStyle`); the CSS text reaches webpack's **JS** parser -> `Module parse failed`. Loud, but useless. |
| Append a `{ test: /\.scss$/, type: 'asset/source' }` rule in `webpackFinal` | `sass-loader` **still runs first**. The string you get is **compiled CSS, not raw Sass** -- and for a Foundation partial like `util/_math.scss` that is the empty string. The importer then serves `""` and the chain fails at RUNTIME with an undefined-mixin error. **Silently wrong strings.** |

Making it work requires **mutating or filtering Angular's generated `.scss`
rule array inside `webpackFinal`**.

### 2.3 That surgery is exactly the fragility Storybook itself already works around

[V-SRC: `node_modules/@storybook/angular/dist/_node-chunks/angular-cli-webpack-VNEX2DZH.js:49-52,133-137`]:

```js
var isStylingRule = (rule) => { let { test } = rule;
  return !test || !(test instanceof RegExp) ? !1
    : test.test(".css") || test.test(".scss") || test.test(".sass"); },
  filterOutStylingRules = (config) => config.module.rules.filter((rule) => !isStylingRule(rule));
...
rulesExcludingStyles = filterOutStylingRules(baseConfig),
module = { ...baseConfig.module, rules: [...cliConfig.module.rules, ...rulesExcludingStyles] }
```

Storybook already **strips its own base config's styling rules** so Angular's
win, and Angular's are spliced in FIRST. The final rule array is the product of
a collision-avoidance dance between two generated configs. Adding a third
`.scss` handler by identifying and rewriting one of Angular's generated rule
objects is config surgery against a moving target -- it breaks on any
`@angular-devkit/build-angular` or `@storybook/angular` bump, and per 2.2 its
degraded mode is a wrong string, not an error.

### 2.4 It also costs the one file ticket 06 bought

`packages/ngx-foundation-sites/.storybook/main.ts` has **no `webpackFinal`**
today -- only the scaffolded comment pointing at the docs
[V-REPO: `.storybook/main.ts:1-17`]. Option 4 is the only one of the four that
forces a `main.ts` edit, which is precisely the file ticket 06's delivery-shape
decision was engineered to leave alone [V-PRIOR: research/06 section 7].

**Verdict: option 4 is not merely worse here, it is blocked.** The `?raw`
intuition the map warned about does not survive translation to this stack.

---

## 3. Why options 2 and 3 lose

### 3.1 Runtime fetch (option 2) -- rejected on the locked shape and on a policy edge

- **It forfeits the sync compile.** Fetch is async, so the importer is async, so
  the compile is `compileStringAsync`. Measured in real Chromium: **1993.7 ms vs
  ~280 ms** on the main thread, 6-7x [V-PRIOR: research/05 section 2.4]; ~10x in
  Node [V-PRIOR: research/03 section 3]. The Worker+sync shape is LOCKED at
  197 ms median [V-PRIOR: research/05 section 5]. Runtime fetch is incompatible
  with the locked shape.
- **Prefetch-all-then-compile-sync does not rescue it.** To prefetch you must
  know the file list; the file list IS the reachable closure; discovering it
  needs either a generated manifest (option 1 with extra steps and 16 extra
  round trips) or a directory listing, which a static file server does not
  provide.
- **The static build has nothing to fetch FROM.** `dist/storybook/ngx-foundation-sites`
  contains no `node_modules` and no `src/scss`. Serving them means `staticDirs`
  in `main.ts` (the edit 2.4 avoids) pointing at `node_modules/foundation-sites/scss`
  and `packages/ngx-foundation-sites/src/scss`.
- **And that last part crosses a stated line.** `staticDirs` would publish
  `src/scss/internal/*` as **fetchable URLs in the Storybook artifact**. The
  exports map deliberately makes `"./scss/internal/*": null`
  [V-REPO: `packages/ngx-foundation-sites/package.json:9`]; serving those files
  over HTTP from the built Storybook is closer to promoting them than any option
  here. Inlining them into a dev-only bundle is not (section 4.3).

### 3.2 Pre-flattening (option 3) -- strictly dominated by option 1

- **It cannot flatten to CSS**, only to Sass, because `theme()` takes runtime
  arguments. So it keeps the compiler, the Worker and the whole 802 KiB gzip
  bill.
- **The saving is noise.** 16 files / 87.7 KiB raw = **24.3 KiB gzip**
  [V-PRIOR: research/05 section 6]. A perfect flatten removes per-file JSON
  escaping and maybe 4 KiB gzip -- against a worker chunk of ~801 KiB gzip. That
  is **under 0.5%**.
- **It costs everything option 1 costs, plus a novel Sass transform.** You still
  need a generator, a committed artifact and a staleness gate; you additionally
  need a flattener whose correctness is not proven anywhere. Its failure mode is
  **wrong CSS that still compiles**: the chain's behaviour depends on `!global`
  rebinds that execute AFTER the `@import` block in
  `internal/_foundation-button.scss` -- `$global-left`/`$global-right` ->
  `inline-start`/`inline-end` (verified live, both directions
  [V-PRIOR: research/05 section 4]) and `with-radius`'s unconditional restore
  (verified across repeated compiles, ibid.). Exact textual ordering of 13
  partials plus that trailing block is load-bearing.
- **It does not move the `@import` clock.** research/03 section 5 states it
  outright: the flattened output is still legacy-`@import`-era Sass full of
  global built-in calls.
- **It makes the vendor/freeze story worse.** The island's header names
  `internal/_foundation-button.scss` as "the single file to vendor or freeze".
  Option 1's artifact is a keyed map of 16 recognisable files; a flattened blob
  is one opaque string.

**Option 1 has a working, byte-proven reference implementation already**:
`prototypes/collect-sources.mjs` is the generator (~120 lines) and
`prototypes/importer.mjs` is the runtime importer (~100 lines, sync, zero
dependencies), and ticket 05 proved the pair produces CSS with the **same
sha256** as `sass.node.js` with `loadPaths: [node_modules]`, across three inputs
[V-PRIOR: research/05 section 3].

---

## 4. The mechanism, concretely

### 4.1 The generator

`packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs`, modelled
on the three existing `verify-*.mjs` and on `prototypes/collect-sources.mjs`:

1. Compile `@use 'nfs:/button'; @include theme();` in Node with a **disk-backed**
   importer over two roots -- `nfs:` -> `packages/ngx-foundation-sites/src/scss`,
   `fnd:` -> `node_modules/foundation-sites` -- carrying the same
   `foundation-sites/scss/` -> `fnd:/scss/` rewrite as the runtime importer.
2. Record every canonical URL the importer actually SERVED. This is a compile,
   not a glob: the closure is discovered, never enumerated by hand. Measured
   result: 16 files, 87.7 KiB raw, 24.3 KiB gzip [V-PRIOR: research/05 section 6].
3. Emit a TypeScript data module with a generated header naming
   `foundation-sites@<version from its package.json>` and its MIT licence (the
   artifact inlines third-party MIT Sass into this repo), plus the usual
   `GENERATED -- DO NOT EDIT` line. Recording the version in the header is what
   makes a dependency bump visible at the TOP of the diff.

`.ts` over `.json`: no `resolveJsonModule` question, a real
`Readonly<Record<string, string>>` type for the importer, and it lands inside
`.storybook/tsconfig.json`'s existing `include` if it sits flat.

### 4.2 Where the artifact lives

`packages/ngx-foundation-sites/.storybook/` -- beside the addon modules, wherever
ticket 09 puts them. Four constraints force this and nothing else:

| Constraint | Evidence |
| --- | --- |
| MUST be a `build-storybook` input | `default` = `{projectRoot}/**/*`, and `build-storybook` inputs are `["default", "^production", "{projectRoot}/.storybook/**/*"]` [V-REPO: `nx.json:5,45-48`] |
| MUST NOT invalidate the library `build` / `verify-exports-map` / `lint` chain | `production` excludes `!{projectRoot}/.storybook/**/*`; `@nx/angular:package` uses `["production","^production"]` [V-REPO: `nx.json:6-12,36-40`] |
| MUST NOT ship in the published tarball | `ng-package.json`'s only asset glob is `{glob:"**/*.scss", input:"src/scss"}` [V-REPO: `ng-package.json:5-11`] -- a `.ts` under `.storybook/` cannot reach `dist/packages/` |
| MUST be TypeScript-visible | `.storybook/tsconfig.json`'s `include` has `"*.ts"`, **non-recursive** [V-REPO: `.storybook/tsconfig.json:6-15`] |

The last row is ticket 06's already-budgeted one-line cost: a subdirectory needs
one `include` entry or `@ngtools/webpack` hard-fails
[V-PRIOR: research/06 section 1]. No new cost from this ticket.

Note it must NOT go under `src/`: `verify-foundation-parity` and the library
build both see `src/`, and `production` covers it.

### 4.3 The exports-map / `internal/*` boundary is NOT crossed

The generated map contains `nfs:/internal/_foundation-button.scss` and
`nfs:/internal/_settings.scss` -- it must, the chain does not compile without
them [V-PRIOR: research/03 section 2]. This does **not** promote them:

- no `exports` key is added or changed; `verify-exports-map` is untouched
  [V-REPO: `packages/ngx-foundation-sites/package.json:9-14`,
  `project.json:88-99`];
- the artifact never enters `dist/packages/ngx-foundation-sites` (4.2, row 3);
- the map keys are private `nfs:` / `fnd:` URLs consumed by one dev-only Worker,
  not a resolver-visible path;
- and per ticket 07, `"./scss/internal/*": null` never blocked Sass load-path
  reads in the first place -- `package.json:8`'s own comment says the null
  exists so an exports-respecting resolver refuses them "while a plain Sass load
  path still reaches them, **which is what the planned in-browser theming addon
  compiles against**" [V-REPO; V-PRIOR: research/07 section 5].

### 4.4 Ticket 06's rule 2 -- the amendment, stated plainly

**VERIFIED [V-EXEC], independently of ticket 07:**

```
node_modules/ngx-foundation-sites -> /d/.../packages/ngx-foundation-sites
ls node_modules/ngx-foundation-sites/scss -> No such file or directory
ls apps/nfs-demo/node_modules/ngx-foundation-sites/ -> css fesm2022 package.json README.md scss types
```

The root symlink targets the SOURCE tree, which has `src/scss/`, not `scss/`.
`apps/nfs-demo` only resolves `ngx-foundation-sites/scss/button` because it
consumes a real extracted registry tarball (D014/D015).

So **ticket 06's rule 2 -- "the addon consumes the library only through its
public specifier `ngx-foundation-sites/scss/button`" -- is not satisfiable by ANY
mechanism from `.storybook/` today.** It was written against a false premise. It
is amended, not ignored:

> **Amended rule 2.** Addon *runtime* code -- everything that lands in the
> preview, manager or worker bundle -- imports nothing outside its own
> `.storybook/` directory. It reaches the library's Sass only through the
> generated data module. The *generator* is a build script under
> `{projectRoot}/scripts/`, and reads library and Foundation sources by
> workspace-relative disk path.

That is not an exception carved for this addon; it is the repo's existing
build-script idiom, twice over:
`verify-foundation-parity.mjs` compiles with
`LOAD_PATHS = ['packages/ngx-foundation-sites/src/scss', 'node_modules']`
[V-REPO: `scripts/verify-foundation-parity.mjs:34`], and `compile-default-css`
runs `npx sass --load-path=packages/ngx-foundation-sites/src/scss --load-path=node_modules`
[V-REPO: `project.json:30-38`]. ESLint already recognises the category:
`@nx/dependency-checks` ignores `{projectRoot}/scripts/**/*.mjs` with the
recorded reason "Build-time verification tooling. Never published ... so its
postcss/sass imports are not part of the package's dependency contract"
[V-REPO: `eslint.config.mjs:9-25`]. The generator's `import * as sass from 'sass'`
lands in that same exemption with no config change.

**Do not plan on the tarball being fresh.** `verify-registry-consumption` has no
`dependsOn` and nothing depends on it [V-PRIOR: research/07 section 7]. The
generator reads workspace source precisely so it is never a tarball consumer.

### 4.5 The runtime side is already written

`prototypes/importer.mjs` ships as-is into the worker: sync `canonicalize` /
`load`, the `foundation-sites/scss/` -> `fnd:` rewrite, and Sass's own candidate
order including `*.import.scss` (unused here -- Foundation ships none
[V-PRIOR: research/03 section 2] -- but free). Compile options are settled:
`{ importers: [importer], quietDeps: true, silenceDeprecations: ['import','global-builtin','if-function'], alertColor: false }`
[V-PRIOR: research/03 sections 5-6, research/05 section 3].

---

## 5. Is `sass` statically imported or lazily loaded?

**LAZY -- and by construction, not by `await import('sass')`.**

The numbers: the worker bundle is **801.0 KiB gzip / 434.5 KiB brotli**, and this
repo's Storybook preview currently ships **1140.2 KiB gzip** across 14 chunks --
so a static import is **+70% on every story load** [V-PRIOR: research/05
sections 1.2, 6]. Storybook's preview bundle is paid on the FIRST story a
visitor opens, whether or not they ever touch the theming panel. Nothing about
the addon justifies taxing every story.

**The mechanism is a placement rule, not an API call.** The locked shape is one
Worker doing sync compiles [V-PRIOR: research/05 section 5]. Instantiating it as
`new Worker(new URL('./theming-worker', import.meta.url), { type: 'module' })`
makes webpack emit a separate chunk containing sass, the importer and the
generated sources; that chunk is fetched when the Worker is constructed. So:

- **`sass` is imported from the worker module and from nowhere else.** Any
  static `import ... from 'sass'` on a module reachable from `preview.ts`'s
  graph drags the whole 802 KiB into the boot path and silently undoes this.
- **The Worker is constructed on first addon use**, not at preview-annotation
  load. If it is constructed at module scope of a preview annotation, the chunk
  is fetched on every story load and the laziness is cosmetic.
- **Ticket 07's preset probe compile belongs in the Worker too** -- ticket 07
  already says so [V-PRIOR: research/07 section 10]. A probe compile on the main
  thread would import sass into the preview graph and defeat all of the above.
- No `await import('sass')` is needed anywhere. The worker chunk boundary IS the
  split point.

Resulting profile: preview boot unchanged at 1140 KiB gzip; ~825 KiB gzip
(801 sass + 24.3 sources) fetched once, on first theme interaction, then cached.

**The gate is a NEGATIVE assertion** and it belongs in ticket 10's L1
build-artifact check, beside ticket 06's positive ones:

1. A unique sass marker string -- `"The compile() method is only available in Node.js."`
   is ideal: it is a literal inside `sass.dart.js`, survives both minifiers
   [V-PRIOR: research/05 section 1.3], and is unlikely to appear by accident --
   must appear in **exactly one** emitted chunk under
   `dist/storybook/ngx-foundation-sites/`.
2. That chunk must **not** be referenced by any `<script src>` in
   `iframe.html`, nor be reachable from those chunks as an initial chunk.
3. A Foundation source marker (e.g. `$button-background-hover-lightness`) must
   appear in that same chunk -- proving the generated sources travelled with the
   Worker and were not dropped.

Assertion 2 is what makes the +70% figure a permanent property rather than a
one-off measurement.

---

## 6. Does it survive `build-storybook`?

**Design answer: nothing here is dev-only.** The artifact is a plain TypeScript
data module -- a webpack input like any other, with no loader, no plugin, no
config hook, no dev-server middleware and no network. Ticket 02 verified preview
annotations and addon CSS land in the built iframe bundle
[V-PRIOR: research/02 section 8, research/06 section 8]. Ticket 05 verified
dart-sass compiles the chain through Storybook's **verbatim** production
minimizer, and through the `--test` esbuild one, producing byte-identical CSS in
real Chromium [V-PRIOR: research/05 section 1.3].

**The one thing NOT verified, and it is a Worker question, not a sources
question**: whether `new Worker(new URL('./x', import.meta.url))` survives
`@ngtools/webpack` in this exact stack. Angular's own webpack config gates its
worker handling on `webWorkerTsConfig`
[V-SRC: `@angular-devkit/build-angular/src/tools/webpack/configs/common.js:333` --
`worker: !!webWorkerTsConfig`], which `@storybook/angular` never sets. [INFER]
webpack 5's own `parser.javascript.worker` default still handles the syntax and
the Angular flag only governs Angular's TS-config plumbing -- but this is
unverified and it is the single highest-risk unknown left in M002's addon.
**Ticket 09 must spike Worker instantiation FIRST**, before building the panel;
if it fails, the fallbacks are a plain emitted `.js` worker asset or a Blob-URL
worker, neither of which changes this ticket's decision (the sources still
arrive as an inlined data module either way).

**How survival is PROVEN, using lanes that already exist:**

| Layer | Proof | Owner |
| --- | --- | --- |
| L1, build artifact | Section 5's three assertions, in the `verify-*.mjs` + Nx target ticket 06 already specifies, `dependsOn: ["build-storybook"]`, modelled on `verify-autodocs-coverage` [V-REPO: `project.json:155-162`] | ticket 10 |
| L2, runtime | `apps/nfs-storybook-e2e/` Playwright project, `dependsOn: ngx-foundation-sites:static-storybook` -- which serves `dist/storybook/...`, i.e. **the built output, not the dev server** [V-REPO: `project.json:180-196`]. Drive a control, assert the injected `<style>` text changes. That IS the static-build proof. | ticket 04 lane, ticket 10 owns |
| L3, negative control | Break it once on purpose (blank one entry in the generated map) and prove L1 and L2 both go red | ticket 10, mandatory |

`static-storybook` serving the built artifact is why no new lane is needed: the
dev-only failure mode M003's host matrix was designed to catch is already
structurally excluded from L2.

**`build-storybook --test`: no guard.** Ticket 05 built that branch and got
byte-identical CSS from a genuinely mangled bundle [V-PRIOR: research/05 section
1.4]. `test` is unset in `project.json` [V-REPO]. Downgrade to a one-line comment
in the worker module; spend nothing on it.

---

## 7. Staleness detection

`verify-theming-sources`, an `nx:run-commands` target, shape copied from
`verify-foundation-parity` [V-REPO: `project.json:76-87`], added to `lint`'s
`dependsOn` list beside the two gates already there [V-REPO: `project.json:68-75`].
It runs the SAME script in `--check` mode, and asserts two things:

**Assertion A -- freshness.** Regenerate the closure in memory from disk and
byte-compare against the committed module. Fails, with the differing keys named,
when:

- `foundation-sites` changes -- including a silent in-range bump, since
  `package.json` declares `^6.9.0` while the lockfile pins `6.9.0`
  [V-REPO: `package.json`; V-EXEC: `package-lock.json`];
- Foundation's internal `@import` graph changes shape, adding or removing a file
  from the closure -- caught because the closure is DISCOVERED by compiling, not
  enumerated by hand. This is the failure that an explicit file list (and hence
  option 4) cannot catch until runtime;
- any of `src/scss/_button.scss`, `internal/_foundation-button.scss`,
  `internal/_settings.scss` changes -- which includes ticket 07's
  `$compliant-palette` addition;
- someone hand-edits the generated module.

**Assertion B -- fitness.** Compile the string map through the runtime importer
and compare the sha256 to a filesystem compile with
`loadPaths: ['packages/ngx-foundation-sites/src/scss','node_modules']`. This is
ticket 05's four-producer proof [V-PRIOR: research/05 section 3] turned into a
standing gate: it catches "the artifact is fresh but the rewrite no longer
produces the same CSS". Ten lines on top of a script that already has both
compilers loaded.

`inputs` for the target:

```
{projectRoot}/scripts/generate-theming-sources.mjs
{projectRoot}/src/scss/**/*.scss
{projectRoot}/.storybook/**/*.generated.ts
{workspaceRoot}/package-lock.json
```

[INFER, and worth stating] Nx does not hash `node_modules` content, so
`package-lock.json` is the proxy for a Foundation bump. A hand-patched
`node_modules` will not invalidate the CACHE -- but any real CI install runs the
gate against real content, and Assertion A fails there. That residual hole is
identical to the one `verify-foundation-parity` already lives with.

**Wire it to `lint`, not to `build-storybook`.** Reasons, in order:
the two existing source-level gates hang off `lint`
[V-REPO: `project.json:68-75`]; `verify-autodocs-coverage` hangs off
`build-storybook` only because it inspects `dist/` [V-REPO: `project.json:155-162`]
and this gate needs no build; and hanging a Sass compile off `build-storybook`
would tax every Storybook build and dev-server restart for a check whose inputs
change only when Foundation or the nfs partials do. **Do not wire both.**

**Why the artifact is COMMITTED rather than generated into a gitignored path.**
The regenerate-every-build variant makes staleness impossible, but: it needs a
`dependsOn` on `build-storybook` AND on the `storybook` dev-server target (which
has none today [V-REPO: `project.json:100-130`]), a `.gitignore` entry, and it
leaves a fresh clone with a missing module that breaks `lint` and the TS project
reference before the first build. More decisively, it makes a Foundation bump
change the addon's compiled CSS **with zero diff anywhere in the repo**. A
committed artifact puts that change in the pull request, which is the loud
failure the ticket asks for. It also matches the repo's established idiom of
committed generated evidence -- `.autodocs-coverage-evidence.txt` (30 KiB) and
`apps/nfs-demo/.registry-consumption-evidence.txt` are both exactly this
[V-EXEC; V-PRIOR: research/07 section 7].

**Prettier.** `.prettierignore` lists only `/dist`, `/coverage`, `/.nx/cache`,
`/.nx/workspace-data`, `.angular` [V-REPO]. The generator must emit
Prettier-clean output (trivial for a data module: one key-value pair per line,
single quotes per the repo's config) or the file needs a `.prettierignore`
entry. Pick emitting clean output -- it also keeps diffs one-line-per-file.

**R026 does not fire on it.** R026's `no-restricted-syntax` block matches
`document.createElement('style')` and CSS-string-to-DOM assignment
[V-PRIOR: research/06 section 5]; a data module contains neither. R026 remains
purely ticket 09's injection-code question, and its `toHaveLength(2)` file-shape
constraint is untouched here.

---

## 8. The `@import` removal horizon -- stated plainly

**This decision inherits the clock exactly, adds nothing to it, and reduces
nothing. No option on the table reduces it.**

- Dart Sass 3.0.0 removes `@import` **and** global built-in functions together;
  deprecated in 1.80.0 (2024-10-17), removal "no sooner than two years" later ->
  floor **2026-10-17**, realistically later [V-PRIOR: research/03 section 5].
- The chain depends on **both**: `internal/_foundation-button.scss` is a legacy
  `@import` island, and Foundation calls `scale-color`, `color-pick-contrast`,
  `get-side` unnamespaced. One compile emits 16 deprecation warnings across three
  IDs [V-PRIOR: research/03 section 5]. All silenced by the settled options bag.
- **The Node-side build has identical exposure today.** `compile-default-css`
  and `verify-foundation-parity` compile the same island through the same
  compiler [V-REPO: `project.json:30-38`, `scripts/verify-foundation-parity.mjs:42-50`].
  The addon does not create a second clock; it shares the one already running.
- **`sass ^1.102.0` cannot cross to 3.0.0** [V-REPO: `package.json`], so this is
  a maintenance clock, not a surprise-breakage one.
- Pre-flattening does not escape it (section 3.2). Neither does raw importing.
  The only genuine escapes are the two the island's own header already names --
  vendor/freeze Foundation's Sass, or migrate the island off `@import` -- and
  neither is M002 scope.

**The one thing this decision changes, and it is favourable.** The generated
module IS a vendored snapshot of the exact 16-file closure, with the Foundation
version recorded in its header and a gate proving it matches upstream. The day
the freeze is required, the migration is: stop running the generator, delete
`verify-theming-sources` from `lint`'s `dependsOn`, and the artifact becomes the
frozen copy in place. Exposure is unchanged; the **cost of the eventual freeze**
drops to deleting one target. State it that way and no further -- it is not a
mitigation.

---

## 9. Downstream consequences: touched vs untouched

### Touched

| Path / target | Change | Gate impact |
| --- | --- | --- |
| `packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs` | NEW -- generator + `--check` mode. ~150 lines, derived from `prototypes/collect-sources.mjs` | already covered by `@nx/dependency-checks`'s `{projectRoot}/scripts/**/*.mjs` ignore [V-REPO: `eslint.config.mjs:19-24`] |
| `packages/ngx-foundation-sites/.storybook/**/foundation-sources.generated.ts` | NEW -- committed, ~88 KiB, Prettier-clean, generated header naming `foundation-sites@6.9.0` + MIT | in `default`, so a `build-storybook` input; NOT in `production`, so `build` / `verify-exports-map` / `lint` caches are not churned by it |
| `packages/ngx-foundation-sites/project.json` | NEW `verify-theming-sources` target + one entry in `lint`'s `dependsOn` | new gate in the standard battery |
| `packages/ngx-foundation-sites/.storybook/tsconfig.json` | EDIT -- one `include` line, **only if** the addon uses a subdirectory | hard `@ngtools/webpack` build error if omitted [V-PRIOR: research/06 section 1] |
| Ticket 10's `verify-*.mjs` L1 script | Gains section 5's three assertions (one positive, one negative, one sources-present) | ticket 10 owns |

### Untouched -- the payoff

- **`.storybook/main.ts`** -- no `webpackFinal`, no `staticDirs`, no `addons: []`
  entry. The only option of the four that leaves it alone.
- **`packages/ngx-foundation-sites/package.json`** -- no `exports` key, no new
  dependency (`sass` is already a devDependency, the importer has none).
- **`scripts/verify-exports-map.mjs` and its target** -- untouched, and not
  invalidated, because `.storybook/**` is outside `production`.
- **`ng-package.json`** -- no new asset glob; the artifact cannot ship.
- **`nx.json`** -- no new `namedInputs`, no new `targetDefaults`.
- **`root package.json` / `package-lock.json`** -- no `raw-loader`, nothing.
- **`src/scss/internal/*`** -- unchanged, unpromoted, still `null` in `exports`.
- **`eslint.config.mjs`** -- R026 is untouched by this decision; its
  `toHaveLength(2)` shape constraint stays ticket 09's alone.
- **`apps/nfs-demo` and its tarball** -- the generator reads workspace source, so
  it never depends on `verify-registry-consumption` being fresh.

---

## 10. What this constrains for tickets 09 and 10

### Ticket 09 -- control surface, state model, recompile UX

1. **Spike the Worker FIRST.** `new Worker(new URL(..., import.meta.url))` under
   `@ngtools/webpack` is the one unverified load-bearing mechanism (section 6).
   Prove it in both `storybook` and `build-storybook` before any panel work. It
   is not this ticket's decision to change, but it is ticket 09's first risk.
2. **`sass` is imported from the worker module and NOWHERE else.** Including
   ticket 07's preset probe compile. Any main-thread `import ... from 'sass'`
   reachable from `preview.ts` costs +70% on every story load and silently
   breaks section 5's gate.
3. **Construct the Worker on first addon use**, not at preview-annotation module
   scope.
4. **The importer is `prototypes/importer.mjs`, unchanged.** Sync, ~100 lines,
   zero dependencies, byte-proven. Do not rewrite it; port it and add types.
5. **Compile options are settled**: `quietDeps: true`,
   `silenceDeprecations: ['import','global-builtin','if-function']`,
   `alertColor: false` (mandatory -- the panel would otherwise render ANSI
   escapes), `importers: [importer]`. `loadPaths` is inert; do not pass it.
6. **Ticket 06's rule 2 is amended, not satisfied** (section 4.4). The addon
   consumes the library through the generated module. Do not attempt
   `ngx-foundation-sites/scss/button` -- it does not resolve from the workspace.
7. **Sources cost nothing on the interaction budget** -- they are already in the
   worker chunk. The budget stays research/05's: ~197 ms median warm in the
   Worker, ~587 ms cold, plus a one-time ~825 KiB gzip fetch on first use.
   Debounce and drop-stale are unchanged.
8. `internal/*` may be freely served by the importer; ticket 07 verified it is
   not a resolver question at all.

### Ticket 10 -- R021 verification

1. **The L1 script gains three assertions from section 5** on top of ticket 06's:
   the sass marker appears in exactly one emitted chunk; that chunk is NOT
   referenced by `iframe.html`; and a Foundation source marker is present in it.
   Assertion 2 is what keeps the lazy-loading decision from silently regressing.
2. **`static-storybook` IS the static-build proof.** It serves
   `dist/storybook/ngx-foundation-sites` [V-REPO: `project.json:180-196`], so
   ticket 04's Playwright lane already exercises the built artifact. No new lane,
   no dev-server-only blind spot.
3. **L3 negative control for THIS mechanism**: blank one entry in the generated
   map and prove `verify-theming-sources` goes red AND the L2 Playwright run goes
   red. Same mandate as ticket 06's manager-entry negative control.
4. **`verify-theming-sources` joins the battery via `lint`.** If ticket 10 is
   also weighing whether `nfs-demo:verify-registry-consumption` should acquire a
   `dependsOn` (ticket 07 section 10 raises it), note these are independent: the
   addon's sources never come from the tarball.
5. **Disable CSS transitions in any browser assertion on themed colour.**
   Foundation emits `transition: background-color 0.25s ease-out` and
   `getComputedStyle` will sample mid-flight [V-PRIOR: research/05 section 4].

---

## 11. Verified vs inferred

**VERIFIED here, by execution or direct source reading** (each cited inline):

- `raw-loader` is absent from `node_modules` and from root `package.json`.
- Angular's `.scss` webpack rule applies `resolve-url-loader` + `sass-loader`
  through an **unconditional** nested `{ use }`, with the `oneOf` branching only
  on `?ngGlobalStyle` / `?ngResource`
  [`@angular-devkit/build-angular/.../styles.js:224-289`].
- `@storybook/angular` splices Angular's rules FIRST and strips the base
  config's styling rules via `filterOutStylingRules`
  [`angular-cli-webpack-VNEX2DZH.js:49-52,133-137`]; its return spread carries
  `resolveLoader: cliConfig.resolveLoader`.
- `.storybook/main.ts` has no `webpackFinal` and no `staticDirs`.
- `node_modules/ngx-foundation-sites` is a symlink to
  `packages/ngx-foundation-sites`, which has **no top-level `scss/`**;
  `apps/nfs-demo/node_modules/ngx-foundation-sites/` is a real extracted
  directory that does. Hence `ngx-foundation-sites/scss/button` is unresolvable
  from the workspace root.
- `nx.json`'s `production` excludes `{projectRoot}/.storybook/**/*` while
  `default` covers `{projectRoot}/**/*` and `build-storybook`'s inputs are
  `["default","^production","{projectRoot}/.storybook/**/*"]`.
- `ng-package.json`'s sole asset glob is `{glob:"**/*.scss", input:"src/scss"}`.
- `.storybook/tsconfig.json`'s `include` is non-recursive `"*.ts"`.
- `lint` dependsOn `verify-browserslist`, `verify-foundation-parity`,
  `verify-exports-map`; `verify-exports-map` dependsOn `build`;
  `verify-autodocs-coverage` dependsOn `build-storybook`; `static-storybook`
  serves `dist/storybook/ngx-foundation-sites`.
- `eslint.config.mjs` exempts `{projectRoot}/scripts/**/*.mjs` from
  `@nx/dependency-checks`, for exactly the "build-time tooling, never published"
  reason.
- `verify-foundation-parity.mjs` compiles with
  `LOAD_PATHS = ['packages/ngx-foundation-sites/src/scss','node_modules']`;
  `compile-default-css` passes the same two `--load-path`s.
- `package.json` declares `foundation-sites: ^6.9.0`; the lockfile pins `6.9.0`.
  `sass` is pinned at `1.102.0` under `^1.102.0`.
- `.prettierignore` covers only `/dist`, `/coverage`, `/.nx/cache`,
  `/.nx/workspace-data`, `.angular`.
- `@angular-devkit/build-angular`'s common webpack config gates worker handling
  on `worker: !!webWorkerTsConfig` (`common.js:333`), and `@storybook/angular`
  never supplies `webWorkerTsConfig`.

**INFERRED** (reasoned, would need execution to close):

- That `new Worker(new URL(..., import.meta.url))` still works in this stack via
  webpack 5's own default worker parsing despite Angular's `worker: false`.
  **This is the one inference the delivery plan leans on**, and section 6 routes
  it to ticket 09 as a first-action spike. It does not change WHICH mechanism
  delivers the sources -- only how the worker is instantiated.
- That appending a `type: 'asset/source'` rule would yield compiled CSS rather
  than raw Sass. The unconditional `sass-loader` is verified from source; the
  resulting string was not observed, because the surrounding surgery was
  rejected before it was worth building.
- That `package-lock.json` is a sufficient Nx cache proxy for a `node_modules`
  change (same residual hole `verify-foundation-parity` already has).
- The exact emitted worker chunk name and whether it is cleanly separable from
  `iframe.html`'s initial chunks -- which is why section 5's assertion is
  specified as "exactly one chunk contains the marker AND it is not referenced",
  not as a hard-coded filename.

**CARRIED** from tickets 01-07 without re-verification, cited inline as
`[V-PRIOR]`: the 16-file / 87.7 KiB raw / 24.3 KiB gzip closure; the
four-producer sha256 identity including the filesystem `loadPaths` producer; the
801.0 KiB gzip worker bundle against the preview's 1140.2 KiB gzip; the 197 ms
worker median, 587 ms cold, 19.1 ms max frame gap; async at 6-7x; the
`--test`/esbuild branch producing byte-identical CSS; the `!global` rebind
behaviour in both directions; the `@import` / global-builtin 3.0.0 timeline and
the 16 silenced warnings; addon CSS and preview annotations surviving
`build-storybook`; R026's two firings and the `toHaveLength(2)` file-shape
constraint; `internal/*: null` not blocking Sass load-path reads; the custom
`functions` option working on the browser code path; and the
`apps/nfs-demo` tarball-consumption mechanism.
