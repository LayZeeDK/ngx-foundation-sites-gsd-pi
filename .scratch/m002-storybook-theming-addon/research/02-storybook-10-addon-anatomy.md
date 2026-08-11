# Storybook 10 custom addon anatomy -- findings

Resolves ticket `02-storybook-10-addon-anatomy.md`.

**Versions this was verified against (exact, from this repo's `node_modules`):**

| Package | Version |
| --- | --- |
| `storybook` | 10.5.6 |
| `@storybook/angular` | 10.5.6 |
| `@storybook/builder-webpack5` | 10.5.6 |
| `@storybook/addon-a11y` | 10.5.6 (reference addon, read as source) |
| `@angular-devkit/build-angular` | 22.0.9 |

`d:/projects/github/storybookjs/storybook` is **NOT cloned** (the whole
`storybookjs/` directory is absent). Primary sources were therefore
(a) the shipped `node_modules` bundles, (b) live probes of Storybook's own
resolver, (c) two real end-to-end `nx build-storybook` runs, and
(d) the versioned `/docs/10/` docs.

## Evidence key

- **[V-PROBE]** -- verified by executing Storybook's own code in this repo.
- **[V-BUILD]** -- verified by a real `nx run ngx-foundation-sites:build-storybook`
  in this repo, with markers grepped out of the emitted bundles.
- **[V-RUNTIME]** -- verified in a real browser (Playwright) against the
  **static** `build-storybook` output.
- **[V-SRC]** -- verified by reading the shipped bundle source.
- **[V-DOCS]** -- verified against the versioned v10 docs.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

All probe artifacts were removed and `main.ts` / `tsconfig.json` restored;
`git status` is back to its pre-research state.

---

## 0. THE DECISIVE QUESTION (for ticket 04)

> Can a workspace-local, unpublished addon be wired by relative path in
> `main.ts`'s `addons: []`, or must an addon be a resolvable package?

### Answer: YES -- a relative path works, and it is the officially documented v10 pattern. An addon does NOT have to be a published or even a `package.json`-bearing package.

There are **two** working shapes. Both were built and run in THIS repo.

#### Shape A (RECOMMENDED, and what the v10 docs prescribe): a `.ts` preset file

```ts
// .storybook/main.ts
addons: [
  '@storybook/addon-a11y',
  '@storybook/addon-docs',
  import.meta.resolve('./local-preset.ts'),
],
```

[V-DOCS] This is verbatim the shape in the official
[Addon migration guide for Storybook 10.0 -> "Local addon loading"](https://storybook.js.org/docs/10/addons/addon-migration-guide#local-addon-loading).
That section exists precisely because addons became ESM-only in v10 and the
old `./local-preset.cjs` recipe broke.

[V-BUILD][V-RUNTIME] Verified end-to-end in this repo: a `.storybook/local-preset.ts`
declaring `managerEntries` + `previewAnnotations` that point at
`../storybook-addon-probe/{manager,preview}.ts`. `nx build-storybook`
completed successfully; markers `NFSPROBE2-MANAGER-TS` landed in
`dist/storybook/ngx-foundation-sites/sb-addons/.../manager-bundle.js` and
`NFSPROBE2-PREVIEW-TS` in `main.<hash>.iframe.bundle.js`. Serving that static
output and loading `iframe.html?...&globals=nfsProbeTheme.primary:!hex(cb4b37)`
produced exactly one `<style id="nfs-probe2-style">` in `<head>` with content
`/* NFSPROBE2-PREVIEW-TS #cb4b37 */`.

**Why it resolves** [V-SRC]: `resolveAddonName`
(`node_modules/storybook/dist/_node-chunks/chunk-DXKWFBLE.js:13473`) first tries
`safeResolveModule({ specifier: name, parent: configDir })`. `safeResolveModule`
tries the extension list `["", ".mjs", ".js", ".cjs"]`, and `""` comes first --
so a specifier that **already carries an explicit `.ts` extension** resolves
exactly. The result falls through to `return { type: "presets", name: resolved }`,
and presets are loaded through `importModule`, which registers
`storybook/internal/bin/loader` (Storybook's TypeScript loader) before importing.
Hence a TypeScript preset is loadable even though `.ts` is not in the
extension-guessing list.

[V-PROBE] Resolver results, all from `resolveAddonName(configDir, name, {})`:

| `addons: []` entry | Result |
| --- | --- |
| `import.meta.resolve('./local-preset.ts')` (a `file://` URL) | `{ type: 'presets', name: '<abs>/local-preset.ts' }` |
| `'./local-preset.ts'` (bare relative, explicit ext) | identical -- `import.meta.resolve` is not strictly required |
| `'./local-preset'` (no extension) | **`undefined`** -- silently skipped |
| plain absolute Windows path to the `.ts` | identical (resolves) |

#### Shape B (also works): a relative path to a DIRECTORY

```ts
addons: ['../storybook-addon-probe'],   // dir containing manager.js / preview.js / preset.js
```

[V-SRC] `resolveAddonName` then probes `join(name, 'preset')`,
`join(name, 'manager')` and `join(name, 'preview')` and returns a
`{ type: 'virtual', presets, managerEntries, previewAnnotations }` record --
**structurally identical to what a published package produces**. Storybook does
not distinguish local from published at this layer.

[V-BUILD] Verified: `addons: ['../storybook-addon-probe']` with
`manager.js` + `preview.js` + `preset.js` built successfully and all markers
reached the bundles.

[V-PROBE] Directory-shape resolver results:

| Entry | Result |
| --- | --- |
| `'../addon-js'` (dir with `manager.js`/`preview.js`/`preset.js`) | full `virtual` record -- **WORKS** |
| `'./../addon-js'` | identical -- `./` prefix is harmless |
| absolute path to that dir | identical -- **WORKS** |
| `'../addon-mjs'` (only `manager.mjs`) | `virtual`, managerEntries only -- **WORKS** |
| `'../addon-ts'` (only `manager.ts`/`preview.ts`) | **`undefined`** -- see trap 1 |
| `'../addon-exports'` (dir + `package.json` `exports` map, `.js` files) | **`undefined`** -- see trap 2 |
| `'../addon-js/manager.js'` (path straight at the file) | `{ type: 'presets' }` -- see trap 3 |
| `'../does-not-exist'` | `undefined` |

### Four traps that make a local addon silently do nothing

1. **A directory with only `.ts` entry files does NOT resolve.** [V-PROBE]
   `safeResolveModule` defaults to `extensions = [...jsModuleExtensions]` =
   `['.mjs', '.js', '.cjs']` (`chunk-P34EJWSD.js:751`). `.ts` is absent. So
   `addons: ['../my-addon']` with `my-addon/manager.ts` resolves to `undefined`.
   This is why Shape A names the file with its extension instead.
2. **A local directory's `package.json` `exports` map is IGNORED.** [V-PROBE]
   A relative specifier goes through ESM relative-path resolution, which never
   consults an `exports` map (that only applies to bare package-name
   specifiers). A local addon dir must therefore contain literal
   `manager.js` / `preview.js` / `preset.js` files at its root. Published
   addons get the exports map -- `@storybook/addon-a11y` resolves
   `./manager` -> `dist/manager.js` that way. This is the ONE real behavioural
   difference between local and published addons.
3. **Pointing `addons: []` straight at a manager file misfires silently.**
   [V-PROBE] `'../my-addon/manager.js'` returns `{ type: 'presets' }`, i.e.
   Storybook loads your manager UI file **as a Node-side preset**. No manager
   entry is registered, no error is raised. (The `basename === 'preset'` special
   case at `chunk-DXKWFBLE.js:13475` is the only filename that is meant to be
   targeted directly.)
4. **An unresolvable entry is a `logger.warn`, not an error.** [V-SRC]
   `chunk-DXKWFBLE.js:13515`:
   `Could not resolve addon "${name}", skipping. Is it installed?`
   The build then proceeds green with the addon absent. Any wiring change in
   ticket 04 must be proven by grepping the emitted bundle, not by a green build.

### Bonus: you may not need `addons: []` at all

[V-SRC] `builder-manager-4GMYFI7O.js:1450`:

```js
configDirManagerEntry = resolveModulePath("./manager", {
  from: options.configDir,
  extensions: [".js", ".mjs", ".jsx", ".ts", ".mts", ".tsx"]
});
```

A file at `packages/ngx-foundation-sites/.storybook/manager.ts` is picked up as
a manager entry **automatically, with no `addons: []` wiring**, and `.ts` IS in
this list. Paired with the already-present `.storybook/preview.ts` (which is
already a preview annotation), the absolute minimum viable theming addon in this
repo is **two files and zero config changes**. Ticket 04 should treat
"local-preset.ts + addon dir" vs "just `.storybook/manager.ts` + `preview.ts`"
as a real packaging choice: the former is a portable, extractable addon; the
latter is the smallest thing that works.

---

## 1. Registration surface

### Import specifiers (v10)

[V-SRC] From `node_modules/storybook/package.json`'s `exports` map, the
manager-side public entry points are:

- `storybook/manager-api` -- `addons`, `types`, hooks
- `storybook/theming`, `storybook/theming/create`
- `storybook/internal/components` -- the UI kit
- `storybook/internal/types` -- `Addon_TypesEnum`, `Renderer`, `StoryContext`, ...
- `storybook/internal/core-events`, `storybook/internal/channels`

Preview-side: `storybook/preview-api`, `storybook/internal/types`.

### v6/v7-era APIs that are GONE in v10

[V-SRC] The manager bundle externalizes exactly this list
(`storybook/dist/manager/globals.js`, `globalPackages`):

```
react, react-dom, react-dom/client, @storybook/icons,
storybook/manager-api, storybook/test, storybook/theming,
storybook/theming/create, storybook/internal/channels,
storybook/internal/client-logger, storybook/internal/components,
storybook/internal/core-events, storybook/internal/manager-errors,
storybook/internal/router, storybook/internal/types
```

Note every entry is `storybook/...` -- **no `@storybook/*` API package appears.**

Verified against the npm registry (latest published version of each):

| Legacy package | Latest on npm | Status for v10 |
| --- | --- | --- |
| `@storybook/addons` | 7.6.17 | REMOVED. `addons.register` now comes from `storybook/manager-api`. |
| `@storybook/manager-api` | 8.6.14 | REMOVED as a standalone package -> `storybook/manager-api` |
| `@storybook/preview-api` | 8.6.14 | REMOVED -> `storybook/preview-api` |
| `@storybook/components` | 8.6.14 | REMOVED -> `storybook/internal/components` |
| `@storybook/theming` | 8.6.14 | REMOVED -> `storybook/theming` |
| `@storybook/core-events` | 8.6.14 | REMOVED -> `storybook/internal/core-events` |

None of these are present in this repo's `node_modules`. Importing any of them
in a v10 addon would silently install and bundle a **v8** copy against a v10
runtime. Blog posts from the 6/7 era will all reach for them -- treat any such
import as an immediate red flag.

Also stale: **`register.js` is no longer an addon entry filename.** [V-SRC]
`resolveAddonName` probes only `preset`, `manager` and `preview`. The error
string at `chunk-DXKWFBLE.js:13509` still says "Addon value should end in
/manager or /preview or **/register**" -- that mention of `/register` is dead
text; nothing in the resolver looks for it.

### Placement types

[V-SRC] `Addon_TypesEnum` (`storybook/dist/types/index.d.ts:3899`), with the
shipped doc comments:

| `types.*` | value | placement |
| --- | --- | --- |
| `TOOL` | `tool` | toolbar above the canvas, **left** side |
| `TOOLEXTRA` | `toolextra` | toolbar above the canvas, **right** side |
| `PANEL` | `panel` | the addons side panel (bottom/right drawer) |
| `TAB` | `tab` | a tab in the toolbar. Marked `@unstable`, "might be removed" |
| `PREVIEW` | `preview` | wrapper components around the canvas iframe. `@unstable` |
| `experimental_PAGE` | `page` | a full page instead of the canvas. `@unstable` |
| `experimental_TEST_PROVIDER` | `test-provider` | items in the sidebar Testing Module |

There is **no stable "sidebar" placement** for a control surface. For M002 the
realistic options are `TOOL`/`TOOLEXTRA` (a toolbar popover) and `PANEL` (the
drawer). `@storybook/addon-a11y` registers **both** from one `addons.register`
call [V-SRC, `addon-a11y/dist/manager.js:2186`] -- a `TOOL` for the vision
simulator and a `PANEL` for results. That is the idiomatic precedent for
"a toolbar affordance plus a richer panel", which is roughly M002's shape
(preset picker in the toolbar, full control set in the panel).

Registration API [V-SRC + V-DOCS]:

```ts
addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Theming',
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    paramKey: PARAM_KEY,          // PANEL only: lets stories disable via parameters
    render: ({ active }) => (active ? <Panel /> : null),
  });
});
```

`match` gates visibility by `viewMode` (`story` vs `docs`) and `tabId`
[V-DOCS, writing-addons]. Relevant here: this repo has `@storybook/addon-docs`
and autodocs, so `viewMode === 'docs'` pages exist and a theming panel must
decide whether it applies there (see section 3).

**Manager UI is React**, unavoidably, even in an Angular project. [V-SRC]
`react` and `react-dom` are manager globals, and the manager esbuild pass is
configured `jsxFactory: 'React.createElement'`, `jsxImportSource: 'react'`
(`builder-manager-4GMYFI7O.js:1496-1499`). The panel for M002 will be React
components. React is not a dependency you add -- it is provided as a global.

---

## 2. Manager <-> preview communication

### Verdict: GLOBALS. Not args, not parameters, not a raw channel.

#### Args are wrong -- confirmed, and here is why

Args are **per-story state**. They live in the story's `args`, are reset on
story change, are rendered into the Controls table, and are semantically the
component's inputs. A theme is not an input of `NfsButton`; it is a property of
the whole preview document. Three concrete consequences if you misuse args:

- [V-SRC] The manager API's arg mutator is
  `updateStoryArgs(story, newArgs)` (`manager-api/index.d.ts:773`) -- it is
  **scoped to a story object**. There is no workspace-wide arg.
- Every story in the repo would need the theme args declared in its `argTypes`,
  or they would not exist to update.
- They would pollute the autodocs ArgTypes table, which R007 in this repo
  explicitly cares about (`.storybook/preview.ts` exists solely to make that
  table correct via Compodoc).

#### Parameters are wrong -- they are not runtime-writable

[V-SRC] There is no `updateParameters` anywhere in `manager-api`'s public
surface. Parameters are static metadata declared in story/meta/preview files
and read via `useParameter(key, default)`. They are the correct place for
**static per-story addon configuration** (e.g. "this story opts out of
theming"), which is exactly what `paramKey` on a PANEL is for -- but they
cannot carry live control values.

#### The raw channel is wrong as the source of truth

`addons.getChannel()` / `useChannel` is the transport. It is correct for
**events** (compile-started, compile-failed, a Sass error payload too big or
too structured for a global). It is wrong for the theme state itself, because
a channel message has no persistence: a story navigation, a preview iframe
reload, or a hot update would leave the manager and the preview disagreeing
with no way to re-sync. Globals give you that for free (below).

#### Globals are right -- mechanism, verified

[V-SRC] Globals are held by a single `GlobalsStore`
(`_browser-chunks/chunk-SNLGT2ZI.js:471`) owned by the **Preview**, not by a
story. They survive story navigation, which is exactly the "page-level and
story-independent" requirement the ticket names.

Manager side:

```ts
import { useGlobals } from 'storybook/manager-api';
const [globals, updateGlobals, storyGlobals] = useGlobals();
```

[V-SRC] Note the **3-tuple** in the manager (`addon-a11y/dist/manager.js:2150`
destructures all three). `storyGlobals` holds globals pinned by the current
story via `parameters.globals`; a11y uses `storyGlobals[KEY] !== undefined` to
render its control as **locked**. M002's panel should do the same -- otherwise
a story that pins a theme will show controls that appear editable but do
nothing.

[V-SRC] `storybook/preview-api`'s `useGlobals` returns a **2-tuple**
`[globals, updateGlobals]` (`chunk-SNLGT2ZI.js`). Do not assume symmetry.

`updateGlobals` emits `UPDATE_GLOBALS` on the channel; the preview responds
with `GLOBALS_UPDATED` [V-SRC, `core-events`: `SET_GLOBALS`, `UPDATE_GLOBALS`,
`GLOBALS_UPDATED`]. So globals ARE channel-based underneath -- you get the
transport plus persistence plus URL sync, instead of hand-rolling it.

#### Three hard constraints on globals that M002 must design around

**(a) A global key MUST be declared, or it is silently dropped.** [V-SRC]

```js
// GlobalsStore, chunk-SNLGT2ZI.js:480-487
this.allowedGlobalNames = new Set([...Object.keys(globals), ...Object.keys(globalTypes)]);
...
filterAllowedGlobals(globals) {
  return Object.entries(globals).reduce((acc, [key, value]) =>
    this.allowedGlobalNames.has(key) ? (acc[key] = value)
    : logger.warn(`Attempted to set a global (${key}) that is not defined in initial globals or globalTypes`), acc, {});
}
```

The addon's **preview** annotation must export `initialGlobals` (or
`globalTypes`) containing the theme key. `initialGlobals` is the v8+ name; the
v7-era `globals` export in a preview file is the deprecated spelling.
`@storybook/addon-a11y`'s own `dist/preview.js` exports exactly
`{ afterEach, decorators, initialGlobals, parameters }` [V-SRC] -- that is the
canonical v10 preview-annotation shape.

**(b) Globals merge SHALLOWLY at the top level.** [V-SRC]
`update(newGlobals) { this.globals = { ...this.globals, ...filtered }; }`.
A nested object global (`nfsTheme: { primary, secondary, radius, ... }`) is
**replaced wholesale**, never deep-merged. Every `updateGlobals` call from the
panel must pass the complete resolved theme object. This is actually
convenient for M002's preset-equality requirement ("a preset reads as selected
only when every control matches exactly") -- one object, one comparison -- but
it will bite anyone who writes `updateGlobals({ nfsTheme: { primary: x } })`
expecting the other five keys to survive. They will not.

**(c) URL round-tripping restricts VALUE FORMATS.** [V-SRC]
Globals are serialized into the `?globals=` query param via `buildArgsParam`
(`storybook/dist/router/index.js:74`), gated by `validateArgs`:

```js
VALIDATION_REGEXP = /^[a-zA-Z0-9 _-]*$/
NUMBER_REGEXP     = /^-?[0-9]+(\.[0-9]+)?$/
HEX_REGEXP        = /^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i
COLOR_REGEXP      = /^(rgba?|hsla?)\(...\)$/i
```

- Hex colors are **first-class**: `#1779ba` is encoded as `!hex(1779ba)`.
  [V-RUNTIME] Confirmed working -- loading
  `iframe.html?...&globals=nfsProbeTheme.primary:!hex(cb4b37)` against the
  **static** build drove the decorator and produced
  `/* NFSPROBE2-PREVIEW-TS #cb4b37 */`.
- Nested plain objects ARE supported (validation recurses; encoding uses dot
  notation, `nfsTheme.primary:!hex(...)`).
- **A radius like `0.5rem` will NOT round-trip.** It fails all four regexes
  (the `.` breaks `VALIDATION_REGEXP`, the `rem` breaks `NUMBER_REGEXP`).
  `4px`, `0`, and `4` all pass. On failure Storybook emits
  `once.warn('Omitted potentially unsafe URL args.')` and drops the value
  **from the URL only** -- the in-session global still works, so this fails
  quietly as "my shared link lost the radius" rather than as a broken control.
  Ticket 05/07 should pick a radius representation from the safe set.

Note for this repo: `.storybook/test-runner.ts` throws on console **`error`**
only, so these `warn`s will not fail `test-storybook`. They will also not be
noticed.

---

## 3. Preview-side injection

### The idiomatic pattern: a decorator + `useEffect`, keyed by the global

[V-DOCS] The v10 `writing-addons` guide's own `withGlobals` example does
exactly this, and it is the pattern to copy:

```ts
import { useEffect, useMemo, useGlobals } from 'storybook/preview-api';

export const withGlobals = (StoryFn, context) => {
  const [globals] = useGlobals();
  const css = useMemo(() => buildCss(globals[KEY], selector), [/* deps */]);

  useEffect(() => {
    addStyles(styleId, css);
    return () => clearStyles(styleId);
  }, [css, context.id]);

  return StoryFn();
};
```

`useEffect` / `useMemo` here are **Storybook's** hooks from
`storybook/preview-api`, not React's [V-SRC: both are in the `preview-api`
export list]. They are backed by `HooksContext` and are re-run per story
render, which is what makes them safe inside a decorator in a non-React
renderer like Angular.

### "Owning a style node without fighting Storybook's re-render"

There is nothing to fight. [V-SRC] Storybook's preview does not manage
`document.head`; the Angular renderer replaces the contents of the story root
element (`#storybook-root`), not the head. A `<style>` appended to
`document.head` with a **stable `id`** and updated in place is stable.

[V-RUNTIME] Confirmed empirically in this repo. The probe decorator did
`getElementById(id) ?? createElement('style')` then set `textContent`. After a
full story render against the static build:

```
{ "exists": true, "parent": "HEAD", "text": "/* NFSPROBE2-PREVIEW-TS #cb4b37 */", "count": 1 }
```

`count: 1` is the load-bearing part -- no duplicate node accumulated across
Storybook's render passes. Idempotent get-or-create plus `textContent`
assignment is sufficient; no MutationObserver, no re-append, no teardown
gymnastics.

### The docs-mode caveat, which M002 WILL hit

[V-DOCS] Verbatim from `writing-addons`:

> Since the addon can be active in both the story and documentation modes, the
> DOM node for Storybook's preview `iframe` is different in these two modes. In
> fact, **Storybook renders multiple story previews on one page when in
> documentation mode.** Therefore, we'll need to choose the correct selector for
> the DOM node where the styles will be injected and ensure the CSS is scoped to
> that particular selector.

The docs' own example switches selector by `context.viewMode`:

```ts
const selector = isInDocs
  ? `#anchor--${context.id} .docs-story, #anchor--primary--${context.id} .docs-story`
  : '.sb-show-main';
```

and switches the style node id too (`my-addon-docs-${context.id}` vs
`my-addon`), i.e. **one style node per story in docs mode, one shared node in
story mode**.

This interacts directly with M002's constraints and is worth flagging to
ticket 09 / the map's open questions:

- This repo HAS autodocs (`@storybook/addon-docs`, R007, a
  `verify-autodocs-coverage` gate). Docs pages render many `NfsButton` stories
  at once.
- **R008 says consumer theme output must win the cascade.** The existing
  `nfs-button.theme()` output is deliberately unlayered so it beats the
  component's `@layer nfs-defaults` regardless of insertion order. That
  property carries over to addon-injected CSS for free -- an unlayered rule in
  a head `<style>` beats a layered default no matter where the node sits. So
  the addon does **not** need to fight insertion order, which is the usual
  reason addons get clever here.
- But the theme mixin takes a `$selector` argument. In docs mode the addon
  would need to compile with a per-story selector (or accept that all stories
  on a docs page share one theme). Given M002's purpose is a global retheme,
  **"one shared unscoped node, story mode and docs mode alike"** is defensible
  and much cheaper -- but it is a real decision, not a default. [INFER: this
  is a design recommendation, not a verified constraint.]

---

## 4. Build / packaging shape

### What the manager entry gets

[V-SRC] `builder-manager-4GMYFI7O.js:1444-1515`. Manager entries are bundled by
**esbuild**, entirely separately from the preview:

- `bundle: true`, `format: 'iife'`, `platform: 'browser'`
- `resolveExtensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx']` -- **`.ts` is
  first-class here**
- `tsconfig:` Storybook's own template, `storybook/assets/server/addon.tsconfig.json`,
  whose entire content is `{"compilerOptions":{"jsx":"react","jsxImportSource":"react"}}`.
  **Your project's tsconfig is NOT used for manager code.** No path aliases, no
  `strict`, no project `lib`/`target`.
- `plugins: [globalExternals(globalsModuleInfoMap)]` -- the `storybook/*` and
  `react*` specifiers become globals rather than being bundled.
- Each entry is wrapped in `try { ... } catch(e) { console.error("[Storybook]
  One of your manager-entries failed: " + import.meta.url, e) }`
  (`banner`/`footer`). **A crashing manager entry does not fail the build and
  does not fail the page** -- it logs and the addon is simply absent. Same
  "silently green" hazard as trap 4.

### What the preview annotation gets -- and the one real gotcha

[V-SRC] `@storybook/builder-webpack5/dist/_node-chunks/chunk-JL4NQNOT.js:36-54`:
preview annotations are `require()`d from a generated virtual module
(`storybook-config-entry.js`) that webpack compiles. So they go through the
**Angular** webpack pipeline, and `@storybook/angular` sets
`typescript: { skipCompiler: true }` [V-SRC, `@storybook/angular/dist/preset.js:36`],
handing TypeScript to `@ngtools/webpack`.

[V-BUILD] **This is the one thing that actually broke.** Wiring a preview
annotation at `packages/ngx-foundation-sites/storybook-addon-probe/preview-extra.ts`
failed the build with:

```
Module build failed (from ./node_modules/@ngtools/webpack/src/ivy/index.js):
Error: .\packages\ngx-foundation-sites\storybook-addon-probe\preview-extra.ts
is missing from the TypeScript compilation. Please make sure it is in your
tsconfig via the 'files' or 'include' property.
```

**Which tsconfig?** [V-SRC]
`@storybook/angular/dist/server/framework-preset-angular-cli.js:153`:

```js
builderOptions.tsConfig = options.tsConfig
  ?? up("tsconfig.json", { cwd: options.configDir, last: getProjectRoot() })
  ?? browserTargetOptions.tsConfig;
```

`configDir` is `packages/ngx-foundation-sites/.storybook`, so the walk-up finds
**`packages/ngx-foundation-sites/.storybook/tsconfig.json`** immediately.

[V-BUILD] Adding `"../storybook-addon-probe/**/*.ts"` to that file's `include`
made the build pass. **Ticket 04 must include this tsconfig edit** -- it is not
optional, and its failure mode is a hard build error rather than a silent skip
(which is at least honest).

Note the asymmetry, and it is a genuinely useful one:

| | manager entries | preview annotations |
| --- | --- | --- |
| bundler | esbuild (Storybook's own) | webpack + `@ngtools/webpack` (Angular's) |
| `.ts` support | yes, out of the box | yes, **but only inside `.storybook/tsconfig.json`'s `include`** |
| tsconfig used | `storybook/assets/server/addon.tsconfig.json` | `.storybook/tsconfig.json` |
| failure mode | logged at runtime, build stays green | hard build error |

### Local vs published: the actual differences

Having built both, the differences are narrower than the docs imply:

| | workspace-local | published package |
| --- | --- | --- |
| `resolveAddonName` output | `{type:'virtual'}` or `{type:'presets'}` | **identical shapes** |
| `package.json` needed | **no** | yes |
| `exports` map honoured | **no** (relative resolution ignores it) | yes |
| entry filenames | must be literal files, `.js`/`.mjs`/`.cjs` for dir shape; explicit `.ts` for preset shape | whatever `exports` maps |
| build step needed | **no** -- source is consumed directly | yes (`dist/`, ESM-only in v10) |
| `"type": "module"` | see below | yes |

[V-BUILD] One warning observed when a local addon uses a plain `.js` preset
under this repo's (typeless) `packages/ngx-foundation-sites/package.json`:

```
[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///.../preset.js is
not specified and it doesn't parse as CommonJS. Reparsing as ES module because
module syntax was detected. This incurs a performance overhead.
```

It is only a warning, but it is avoidable: **Shape A's `.ts` preset does not
produce it** (it goes through Storybook's TS loader), and neither would `.mjs`.
Another point in Shape A's favour.

[V-DOCS] Note also that the v10 docs' "Packaging and publishing" section is
**entirely about npm publication** and says nothing about workspace-local
addons -- which is exactly why the migration guide's "Local addon loading"
section is the authoritative reference here. Given **R019 defers publishing**,
M002 should not adopt the addon-kit's `dist/` + `bundler.managerEntries`
packaging at all; consume source directly.

---

## 5. Angular-specific caveats

1. **The preview tsconfig constraint above is the big one**, and it is
   Angular-specific: it comes from `@ngtools/webpack`, not from Storybook.
   A React/Vite Storybook would have no such constraint.
2. **Manager code is React even though the project is Angular.** [V-SRC] Not
   negotiable -- `react`/`react-dom` are manager globals and the esbuild pass is
   JSX-configured for React. The theming panel is a React component tree. It
   cannot reuse any `NfsButton` Angular component.
3. **Preview-side DOM manipulation is unconstrained.** [V-RUNTIME] The Angular
   renderer owns `#storybook-root`; `document.head` is untouched. Verified: the
   injected node survived a full Angular story render, exactly once.
4. **Zone.js is force-added** unless `experimentalZoneless`
   [V-SRC, `angular-cli-webpack-VNEX2DZH.js:130`]. Irrelevant to style
   injection; relevant if the addon ever schedules async work the preview
   observes.
5. **`stylePreprocessorOptions.includePaths`** is already set on both storybook
   targets in `project.json` to `packages/ngx-foundation-sites/src/scss`. That
   is the **webpack/Angular** Sass resolution path -- it does **not** apply to a
   browser-side `sass` compile inside the addon. An in-browser compiler will
   need its own importer/load-path wiring. Feeds ticket 05.
6. **`browserTarget` is self-referential** in this repo
   (`ngx-foundation-sites:build-storybook` points at the storybook target
   itself). It works because `getBuilderOptions` only mines it for
   `tsConfig`/styles, and `tsConfig` is overridden by the `.storybook`
   walk-up anyway. Do not "fix" it while wiring the addon.

---

## 6. TypeScript / bundling without the addon-kit, and Nx

- **Nx changes nothing about addon resolution.** [V-SRC + V-BUILD] The Nx
  executor `@storybook/angular:start-storybook` / `:build-storybook` passes
  `configDir` straight through, and every path in `addons: []` resolves relative
  to that `configDir` -- not to the workspace root, not to Nx's project graph.
  Nx's project graph does not need to know the addon exists.
- **No addon-kit, no tsup, no `bundler` field is needed** for a local addon.
  Manager `.ts` is compiled by Storybook's esbuild; preview `.ts` by Angular's
  webpack. The addon-kit's whole job (build ESM `dist/`, declare
  `managerEntries`/`previewEntries` in `package.json.bundler`) is publication
  machinery, and R019 defers publication.
- **Nx caching hazard.** `build-storybook` declares
  `outputs: ["{options.outputDir}", "{projectRoot}/documentation.json"]` but
  its `inputs` are the project defaults. A new addon directory outside
  `projectRoot`'s tracked inputs could produce stale cache hits. During this
  research `--skip-nx-cache` was used to be certain. [INFER] Ticket 04 should
  confirm the addon source is part of the `build-storybook` input set, or
  additions to the addon will not invalidate the cache.
- **ESLint / R026.** The addon injects compiled CSS through JavaScript. That is
  the tension the map already flags for ticket 09; nothing in Storybook's
  machinery resolves it either way. Note only that the addon's files would need
  to be in (or excluded from) the lint project's scope deliberately.

---

## 7. Minimal complete skeleton for THIS repo

Everything below was **built and run** in this repo (marker names changed to
the real domain). Shape A, because it is the documented v10 pattern, is pure
TypeScript, and avoids the typeless-package warning.

```
packages/ngx-foundation-sites/
  .storybook/
    main.ts                      <- edit (1 line)
    tsconfig.json                <- edit (1 line)  [REQUIRED, see section 4]
    local-preset.ts              <- new
    preview.ts                   (exists; unchanged)
  storybook-addon-theming/
    manager.ts                   <- new (React; the panel/toolbar UI)
    preview.ts                   <- new (initialGlobals + decorator)
```

### `.storybook/main.ts`

```ts
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    // v10 local-addon wiring. The explicit `.ts` extension is load-bearing:
    // resolveAddonName only extension-guesses .mjs/.js/.cjs.
    import.meta.resolve('./local-preset.ts'),
  ],
  framework: { name: '@storybook/angular', options: {} },
};

export default config;
```

Docs: [Local addon loading](https://storybook.js.org/docs/10/addons/addon-migration-guide#local-addon-loading).

### `.storybook/tsconfig.json` (REQUIRED edit)

```jsonc
{
  "include": [
    "../src/**/*.stories.ts",
    // ... existing entries ...
    "*.js",
    "*.ts",
    "../storybook-addon-theming/**/*.ts"   // <- without this, @ngtools/webpack
                                           //    fails the preview build
  ]
}
```

### `.storybook/local-preset.ts`

```ts
import { fileURLToPath } from 'node:url';

export function managerEntries(entry: string[] = []): string[] {
  return [
    ...entry,
    fileURLToPath(import.meta.resolve('../storybook-addon-theming/manager.ts')),
  ];
}

export function previewAnnotations(entry: string[] = []): string[] {
  return [
    ...entry,
    fileURLToPath(import.meta.resolve('../storybook-addon-theming/preview.ts')),
  ];
}
```

`managerEntries` / `previewAnnotations` are preset hooks applied through
`options.presets.apply(...)` [V-SRC: `builder-manager-4GMYFI7O.js:1446`,
`chunk-JL4NQNOT.js:37`]. They receive the accumulated list and return it
extended -- always spread `entry`, never replace it.

### `storybook-addon-theming/manager.ts`

```tsx
import React from 'react';
import { addons, types, useGlobals } from 'storybook/manager-api';

export const ADDON_ID = 'ngx-foundation-sites/theming';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const GLOBAL_KEY = 'nfsTheme';

const Panel = () => {
  const [globals, updateGlobals, storyGlobals] = useGlobals();
  const theme = globals[GLOBAL_KEY];
  // A story that pins the theme via `parameters.globals` locks the controls.
  const isLocked = storyGlobals[GLOBAL_KEY] !== undefined;

  // Globals merge SHALLOWLY: always send the WHOLE theme object.
  const set = (patch) => updateGlobals({ [GLOBAL_KEY]: { ...theme, ...patch } });

  return <div>{/* preset picker + colour/radius controls */}</div>;
};

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Theming',
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    paramKey: 'nfsTheming',
    render: ({ active }) => (active ? <Panel /> : null),
  });
});
```

API refs: [`addons.register` / `addons.add`](https://storybook.js.org/docs/10/addons/addons-api),
[`useGlobals`](https://storybook.js.org/docs/10/addons/addons-api#useglobals).
Precedent for the dual TOOL+PANEL registration:
`node_modules/@storybook/addon-a11y/dist/manager.js:2186`.

### `storybook-addon-theming/preview.ts`

```ts
import type { Renderer, PartialStoryFn, StoryContext } from 'storybook/internal/types';
import { useEffect, useMemo, useGlobals } from 'storybook/preview-api';

const STYLE_ID = 'nfs-theming';
const GLOBAL_KEY = 'nfsTheme';

// REQUIRED: an undeclared global key is dropped with a console warning.
// `initialGlobals` is the v8+ name; a bare `globals` export is the v7 spelling.
export const initialGlobals = {
  [GLOBAL_KEY]: {
    primary: '#1779ba',   // hex round-trips through the URL as !hex(1779ba)
    radius: '0',          // NOT '0.5rem' -- that fails URL validation
  },
};

export const decorators = [
  (storyFn: PartialStoryFn<Renderer>, context: StoryContext<Renderer>) => {
    const [globals] = useGlobals();
    const theme = globals[GLOBAL_KEY];

    const css = useMemo(() => compileTheme(theme), [theme]);   // ticket 05

    useEffect(() => {
      let node = document.getElementById(STYLE_ID);

      if (!node) {
        node = document.createElement('style');
        node.id = STYLE_ID;
        document.head.appendChild(node);
      }

      node.textContent = css;
    }, [css]);

    return storyFn(context);
  },
];
```

API refs: [`useGlobals` / `useEffect` in a decorator](https://storybook.js.org/docs/10/addons/writing-addons)
(the `src/withGlobals.ts` example). Canonical v10 preview-annotation export
shape: `node_modules/@storybook/addon-a11y/dist/preview.js` exports
`{ afterEach, decorators, initialGlobals, parameters }`.

### Even smaller alternative, if a portable addon is not the goal

[V-SRC] Drop `.storybook/manager.ts` and extend the existing
`.storybook/preview.ts`. `manager.ts` in the configDir is auto-discovered with
`.ts` in its extension list, so **`main.ts` and `tsconfig.json` need no edits at
all**. This is 2 files instead of 5 and zero config churn; the cost is that the
addon is not extractable into a package later without the Shape A wiring. Worth
putting to ticket 04 as the explicit lazy option.

---

## 8. Answers to the map's open questions that this ticket happened to settle

- **"Whether addon-injected CSS survives `build-storybook`."** [V-BUILD][V-RUNTIME]
  **Yes.** Manager entries are emitted to
  `dist/storybook/ngx-foundation-sites/sb-addons/.../manager-bundle.js` and
  preview annotations into `main.<hash>.iframe.bundle.js`. The runtime
  verification above ran against a plain static file server on the built
  output, not a dev server. So `test-storybook` (which runs against
  `static-storybook` on port 4400) will see the addon.
- **Globals survive story navigation and are URL-shareable** [V-SRC + V-RUNTIME],
  which partially answers "whether control state survives a story switch":
  across stories, yes, natively. Across a **full reload** it survives only via
  the URL, and only for values that pass `validateArgs`. Persisting to
  `localStorage` would be a separate opt-in.

## 9. Residual uncertainty (explicitly NOT verified)

- Whether the addon panel's React tree can host the in-browser `sass` compiler
  without bloating the manager bundle (manager esbuild has no `sass` global, so
  it would be bundled in full). **Compiling preview-side is the obvious
  alternative and is probably right, but that is ticket 05's call.** [INFER]
- Docs-mode multi-story selector scoping was read from the v10 docs but not
  exercised in this repo. [V-DOCS only]
- Nx input/caching behaviour for a new addon directory. [INFER]
- HMR behaviour of a local addon's `manager.ts` during `nx storybook` (dev
  server) was not tested; only `build-storybook` was.
