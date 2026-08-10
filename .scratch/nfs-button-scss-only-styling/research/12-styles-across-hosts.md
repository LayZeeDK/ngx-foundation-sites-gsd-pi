# Does the style pipeline behave identically across all six host configurations?

Ticket: [12-styles-across-hosts.md](../issues/12-styles-across-hosts.md)
Status: RESOLVED -- all six hosts stood up and observed empirically.

## Versions actually audited

`package.json` pins `~22.0.4`, which resolved UPWARD. The installed tree is:

```
@angular/core              22.0.8
@angular/platform-browser  22.0.8
@angular/platform-server   22.0.8
@angular/build             22.0.9
@angular/ssr               22.0.9
@angular/cli               22.0.9
@ngtools/webpack           22.0.9
@storybook/angular         10.5.6   (depends on @storybook/builder-webpack5 10.5.6 + webpack 5.105.2)
webpack                    5.105.2
sass                       1.102.0
lightningcss               1.33.0
```

Read every claim below as "v22.0.8/22.0.9", not v22.0.4.

## Method

Four app hosts were stood up as a throwaway Angular app at
`D:\projects\sandbox\zz-hostprobe` (files retained; its `node_modules` junction
into the repo has been removed -- recreate with
`New-Item -ItemType Junction -Path D:\projects\sandbox\zz-hostprobe\node_modules -Target <repo>\node_modules`).
Storybook was probed in the real repo with throwaway files that have since been
deleted.

The probe measures three separate things per host, so that "it works" is not
confused with "it works for the right reason":

- `.zz-probe-marker` -- matched ONLY by the component sheet. Proves delivery.
- `.zz-probe-unlayered` -- matched by an UNLAYERED global rule (`rgb(1,1,1)`) and
  by the component's `@layer zz-defaults` rule (`rgb(3,3,3)`). Unlayered must
  win, per CSS cascade-layer spec, regardless of DOM order.
- `.zz-probe-order` -- matched by a global `@layer zz-app` rule (`rgb(2,2,2)`)
  and the component's `@layer zz-defaults` rule (`rgb(4,4,4)`). The winner
  reveals LAYER ORDER, which IS DOM-order dependent.

Ref count was measured by mounting two instances, unmounting both, and
remounting. For Storybook the equivalent is switching stories over the addons
channel (`setCurrentStory`), which remounts without reloading the iframe.

---

## 1. The delivery mechanisms

### (a) Production browser build -- inline `<style>`, appended last

Component CSS is inlined into the component definition as a JS string; **no
`.css` file is emitted for component styles**. Observed in the real bundle:

```
$ rg -o "@layer zz-defaults\{[^\"]*\}" main-*.js
@layer zz-defaults{.zz-probe-marker{color:#050505}.zz-probe-unlayered{color:#030303}.zz-probe-order{color:#040404}}
```

The only emitted CSS file is the global one (`styles-IY5AS4VQ.css`, 112 bytes).
At runtime `SharedStylesHost` creates a `<style>` and appends it to `<head>`
AFTER the global `<link>`, so the component sheet wins same-specificity ties --
which is exactly why `@layer` is load-bearing.

**A production-only seam the ticket did not anticipate: the Beasties critical-CSS
inliner rewrites `index.html`.** In the CSR build (`<app-root>` empty at build
time, nothing prerendered) it inlines an EMPTY layer block and defers the real
stylesheet:

```html
<html lang="en" data-beasties-container>
  <head>
    ...
  <style>@layer zz-app{}</style><link rel="stylesheet" href="styles-IY5AS4VQ.css" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="styles-IY5AS4VQ.css"></noscript></head>
```

That empty `@layer zz-app{}` is not a bug -- it is what keeps layer ORDER
correct despite the global sheet now loading asynchronously. Cited:
`node_modules/@angular/build/src/utils/index-file/inline-critical-css.js:14`
(`require("beasties")`), `:100` (`embedLinkedStylesheet` override), `:117-124`
(the `media="print"` / `onload` handler it generates).

### (b) `@angular/build` dev server -- inline `<style>` by DEFAULT; `<link>` only if opted in

**This is the correction to the biggest assumed risk in the ticket.** The
external-`<link>` component-style path is NOT the dev-server default. It is
gated behind an explicit env var:

`node_modules/@angular/build/src/utils/environment-options.js:162`

```js
exports.useComponentStyleHmr = parseTristate(process.env['NG_HMR_CSTYLES']) === true;
```

`node_modules/@angular/build/src/builders/dev-server/vite/index.js:143-145`

```js
const componentsHmrCanBeUsed = browserOptions.aot && serverOptions.liveReload && serverOptions.hmr;
// Enable to support link-based component style hot reloading (`NG_HMR_CSTYLES=1` can be used to enable)
browserOptions.externalRuntimeStyles = componentsHmrCanBeUsed && environment_options_1.useComponentStyleHmr;
```

`parseTristate(undefined) === true` is false, so with `NG_HMR_CSTYLES` unset the
dev server uses the SAME inline-`<style>` mechanism as production. Observed
default dev-server text (reformatted and marker-prefixed by esbuild, not
minified):

```
/* src/app/probe-styled.scss */
@layer zz-defaults {
  .zz-probe-marker {
    color: rgb(5, 5, 5);
  }
  ...
}
/*# sourceMappingURL=probe-styled.css.map */
```

With `NG_HMR_CSTYLES=1` the delivery changes to an external stylesheet and no
`<style>` exists at all:

```json
{ "tag": "link", "attrs": { "rel": "stylesheet",
  "href": "11384d739c200a8b7360fada4614998080998ee228b9f087ce6a016d64c4632f.css?ngcomp&e=2" } }
```

Element identity and ordering therefore DO change between the two modes
(`<style>` vs `<link>`, and the ref-count map switches from
`SharedStylesHost.inline` keyed by CSS text to `.external` keyed by file name),
but the cascade outcome does not -- see item 2.

### (c) Server render -- `<style ng-app-id>` emitted, then adopted by object identity

Raw production-SSR server response (before any client JS):

```html
<head>
    <meta charset="utf-8">
    <title>zz host probe</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>.zz-probe-unlayered{color:#010101}@layer zz-app{.zz-probe-order{color:#020202}}.zz-global-marker{color:#0a0a0a}
</style><link rel="stylesheet" href="styles-IY5AS4VQ.css" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="styles-IY5AS4VQ.css"></noscript><style ng-app-id="ng">@layer zz-defaults{.zz-probe-marker{color:#050505}.zz-probe-unlayered{color:#030303}.zz-probe-order{color:#040404}}
</style></head>
```

(Note Beasties inlined the FULL global sheet here, not an empty layer block --
because the server-rendered DOM matches the rules, so they count as critical.
Same cascade result either way.)

Adoption, cited from
`node_modules/@angular/platform-browser/fesm2022/_dom_renderer-chunk.mjs`:

- `:142` `const APP_ID_ATTRIBUTE_NAME = 'ng-app-id';`
- `:153-170` `addServerStyles()` -- queries
  `style[ng-app-id="<appId>"],link[ng-app-id="<appId>"]`, calls
  `removeAttribute(APP_ID_ATTRIBUTE_NAME)`, and seeds the usage maps with
  `usage: 0` and the EXISTING element. Adoption is exact-node reuse.
- `:206-210` `ng-style-reused` is set only when `ngDevMode` is truthy AND
  `record.usage === 0`.

That last line explains an observed dev/prod difference that is NOT a defect:
dev-SSR shows `<style ng-style-reused="">`, prod-SSR shows `<style>` with no
attributes. Both adopted; only the dev marker differs.

**Adoption key caveat worth recording.** For inline styles the map key is the
FULL `textContent` (`inline.set(styleElement.textContent, ...)` at `:163`); for
links it is the file name (`href.slice(href.lastIndexOf('/') + 1)` at `:159`).
So server/client duplication is possible in principle if the server-emitted CSS
text and the client's runtime string differ by even one byte. In every host
measured they came from the same build artifact and matched, so no duplication
occurred -- but a divergent server/browser optimization setting would surface
here as a duplicate `<style>`, not as an error.

### (d) Storybook -- its OWN builder: webpack 5, Angular JIT, optimization forced off

`@storybook/angular` 10.5.6 does NOT use `@angular/build`. It builds an Angular
webpack config from `@angular-devkit/build-angular`'s internal config
generators and runs it under `@storybook/builder-webpack5`.

- `node_modules/@storybook/angular/dist/server/framework-preset-angular-cli.js:90-100`
  -- bails to the base config unless `@angular-devkit/build-angular` resolves,
  then imports `getWebpackConfig` from
  `../_node-chunks/angular-cli-webpack-VNEX2DZH.js`.
- `angular-cli-webpack-VNEX2DZH.js:55-62` -- requires
  `@angular-devkit/build-angular/src/tools/webpack/configs`
  (`getCommonConfig`, `getStylesConfig`, `getTypeScriptConfig`).
- `angular-cli-webpack-VNEX2DZH.js:116-122` -- **fixed options, not
  overridable**:

```js
      // Fixed options
      optimization: !1,
      namedChunks: !1,
      progress: !1,
      buildOptimizer: !1,
      aot: !1
```

So stories get **neither** the production inlining path **nor** the dev HMR
path: they get Angular JIT (`aot: false`, styleUrl rewritten to a
`?ngResource` import by `@ngtools/webpack` --
`node_modules/@ngtools/webpack/src/transformers/replace_resources.js:48`,
`NG_COMPONENT_RESOURCE_QUERY = 'ngResource'`) with optimization permanently
off, in BOTH `storybook` and `build-storybook`. Empirical corroboration: the
component style text is pretty-printed and unminified even in the static
production build, unlike `ng build`.

Delivery is still `SharedStylesHost` -> a `<style>` appended last to the preview
iframe's `<head>`. Observed (static build, story loaded):

```
head styles, in order:
 1. <style> @font-face Nunito Sans ...            (Storybook, 904 chars)
 2. <style> .sb-show-preparing-story ...          (Storybook, 9951 chars)
 3. <style> .zz-probe-unlayered {...} @layer zz-app {...}   (preview-head.html, 183 chars)
 4. <style> #storybook-root[hidden] ...           (Storybook, 98 chars)
 5. <style> @layer zz-defaults { ... }            (Angular SharedStylesHost, 174 chars)
```

One notable correction to the ticket text: `.storybook/main.ts` does **not** set
`browserTarget`. It is set on the Nx targets in
`packages/ngx-foundation-sites/project.json:83` and `:98`, both pointing at
`ngx-foundation-sites:build-storybook` -- i.e. self-referential. That matters,
see item 5.

---

## 2. `@layer` survival

`@layer nfs-defaults` survives **all** mechanisms. It is never dropped,
re-wrapped, renamed, or reordered. It is not byte-identical -- the build
reformats the text -- but it parses as a real `CSSLayerBlockRule` with the
expected inner rule count in every host, and the cascade outcome is identical
everywhere.

Text transforms observed:

| Host | Component sheet text |
|---|---|
| prod browser / prod SSR | minified, one line: `@layer zz-defaults{.zz-probe-marker{color:#050505}...}` |
| dev server (both modes) | expanded, prefixed `/* src/app/probe-styled.scss */`, suffixed `/*# sourceMappingURL=... */` |
| Storybook (dev + static) | expanded, no path comment, no sourcemap comment |

Cascade results, **identical in all six hosts plus both HMR variants**:

- `.zz-probe-unlayered` -> `rgb(1, 1, 1)`. The global UNLAYERED rule beats the
  component's layered rule. Order-independent, exactly as the spec requires.
  This is the R008 mechanism working.
- `.zz-probe-order` -> `rgb(4, 4, 4)`. The component's `zz-defaults` layer beats
  the app's `zz-app` layer, because `zz-app` is always encountered first (global
  `<link>`/`<style>` is in the served HTML; the component `<style>` is appended
  at runtime). **This never flipped between hosts** -- including the Beasties
  case, where the empty `@layer zz-app{}` stub keeps the order pinned even
  though the real global sheet loads asynchronously.

The dev server's external-`<link>` mode was the handoff's top unresolved item.
The served stylesheet was fetched directly and the layer is intact:

```
$ curl -s "http://localhost:4506/11384...632f.css?ngcomp&e=2"
/* src/app/probe-styled.scss */
@layer zz-defaults {
  .zz-probe-marker {
    color: rgb(5, 5, 5);
  }
  .zz-probe-unlayered {
    color: rgb(3, 3, 3);
  }
  .zz-probe-order {
    color: rgb(4, 4, 4);
  }
}
/*# sourceMappingURL=11384...632f.css.map */
```

Content-Type `text/css`, 304 bytes, and the browser parsed it as
`CSSLayerBlockRule { name: "zz-defaults", innerRuleCount: 3 }`. **Verified in
both dev-CSR and dev-SSR.** `@layer` is not at risk in any mode.

---

## 3. SSR style adoption

`ng-app-id` matching holds in dev-SSR as well as prod-SSR. `APP_ID` is the
default `'ng'` on both sides in both modes, so adoption never mismatches.

Dev-SSR, raw server response:

```html
<link rel="stylesheet" href="styles.css"><style ng-app-id="ng">/* src/app/probe-styled.scss */
@layer zz-defaults {
  .zz-probe-marker {
    color: rgb(5, 5, 5);
  }
  ...
}
</style>
```

After hydration the same node is present exactly once, with `ng-app-id` stripped
and `ng-style-reused=""` added:

```json
{ "tag": "style", "attrs": { "ng-style-reused": "" }, "textLength": 252 }
```

Head style count after hydration: 1 component `<style>` + 1 global `<link>`. No
duplication in either dev-SSR or prod-SSR.

`NG_HMR_CSTYLES=1` dev-SSR is also correct -- the server emits the `<link>`
form carrying `ng-app-id` and the client adopts that node:

```html
<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="11384...632f.css?ngcomp&amp;e=2" ng-app-id="ng">
```
after hydration:
```json
{ "tag": "link", "attrs": { "rel": "stylesheet", "href": "11384...632f.css?ngcomp&e=2", "ng-style-reused": "" } }
```

**FOUC:** none observed, and none is structurally possible in either SSR mode.
The component styles are in the server's HTML `<head>` before `<body>` -- as an
inline `<style>` by default (zero extra round trips) or as a render-blocking
`<link>` under `NG_HMR_CSTYLES=1`. **Hydration style mismatch: none.** Zero
console errors and zero page errors in dev-SSR and prod-SSR.

---

## 4. Ref-count behaviour per host

Ref counting is `SharedStylesHost.addUsage` / `removeUsage`
(`_dom_renderer-chunk.mjs:202-227`), removal being `element.remove()` once
`record.usage <= 0`:

```js
  removeUsage(value, usages) {
    const record = usages.get(value);
    if (record) {
      record.usage--;
      if (record.usage <= 0) {
        removeElements(record.elements);
        usages.delete(value);
      }
    }
  }
```

Measured `2 instances -> 1 -> 0 -> remount` in the four app hosts, and
`story A -> story B -> story A` in the two Storybook hosts. **All six hosts:
one element for two instances, removed at zero, re-added on remount.** Storybook
does NOT hold a reference and does NOT defeat removal -- the most aggressive
mount/unmount cycle in the repo is clean.

The default dev server's style HMR also does not defeat removal. Editing the
SCSS hot-updated the sheet in place with no full page reload, no orphan, and
removal still worked afterwards:

```json
{ "before":      { "headStyles": 1, "zzDefaultsStyles": 1, "markerColor": "rgb(5, 5, 5)" },
  "afterUpdate": { "headStyles": 1, "zzDefaultsStyles": 1, "markerColor": "rgb(77, 77, 77)" },
  "afterUnmount":{ "headStyles": 0, "zzDefaultsStyles": 0 },
  "fullPageNavigations": { "wasFullReload": false } }
```

### [WARN] One genuine ref-count leak found: `NG_HMR_CSTYLES=1` + a style edit

This is the only place the matrix is NOT uniform. In external-`<link>` mode,
after one style hot update, the component stylesheet is **never removed** and
**duplicates on every remount**:

```json
{ "initial":           { "componentLinks": ["11384...632f.css?ngcomp&e=2"] },
  "afterHmrEdit":      { "componentLinks": ["...632f.css?ngcomp=&t=1786307810888"] },
  "afterUnmount":      { "componentLinks": ["...632f.css?ngcomp=&t=1786307810888"] },
  "afterRemount":      { "componentLinks": ["...632f.css?ngcomp=&t=1786307810888",
                                            "11384...632f.css?ngcomp&e=2"] },
  "afterSecondUnmount":{ "componentLinks": ["...632f.css?ngcomp=&t=1786307810888"] } }
```

Root cause, fully traced. Angular delegates the CSS hot update to Vite's client,
which **replaces the `<link>` node** rather than mutating it:

`node_modules/vite/dist/client/client.mjs:846-856`

```js
					const newLinkTag = el.cloneNode();
					newLinkTag.href = new URL(newPath, el.href).href;
					const removeOldEl = () => {
						el.remove();
						...
					};
					newLinkTag.addEventListener("load", removeOldEl);
					...
					el.after(newLinkTag);
```

Angular's `external` map still holds the ORIGINAL `el`, which Vite has already
detached, and its key is still the original URL. Angular even documents that the
query string is not preserved:

`node_modules/@angular/build/src/builders/dev-server/vite/hmr.js:65-69,82`

```js
                // For component styles, an HMR update must be sent for each one with the corresponding
                // component identifier search parameter (`ngcomp`). The Vite client code will not keep
                // the existing search parameters when it performs an update and each one must be
                // specified explicitly.
...
                            path: `${filePath}?ngcomp` + (typeof id === 'string' ? `=${id}` : ''),
```

So on destroy `removeUsage` removes an already-detached node (a no-op) and
deletes the map entry, orphaning Vite's replacement forever; the next mount
re-adds under the original key, giving two live stylesheets.

Severity: **low and containable.** It is dev-server-only, opt-in behind
`NG_HMR_CSTYLES=1`, requires a style edit in the session, and the visible effect
is a stale stylesheet rather than wrong styles (both copies have identical
cascade behaviour, and `@layer` means they cannot beat consumer overrides). It
never occurs in the default dev server, in either production host, or in
Storybook. It is an upstream Angular/Vite interaction, not something this
library's styling architecture causes or can fix.

---

## Host matrix

| # | Host | Delivery mechanism | `@layer` preserved | Style element identity + ordering | Ref-count remove-on-destroy | Verified empirically |
|---|---|---|---|---|---|---|
| 1 | SSR production-like (`@angular/ssr` + Express) | server-emitted `<style ng-app-id="ng">` (minified, inline), adopted by client | YES -- `CSSLayerBlockRule`, 3 rules | `<style>`(Beasties critical) -> `<link>`(global, `media=print/onload`) -> `<style>`(component, adopted, no attrs after hydration) | YES -- 2 -> 1 -> 0 removed -> remount re-added | YES -- `node dist/.../server/server.mjs`, port 4514 |
| 2 | Static-serve production (CSR only) | inline `<style>` created at runtime from JS string in `ComponentDef.styles`; no component `.css` emitted | YES -- minified, `CSSLayerBlockRule`, 3 rules | `<style>@layer zz-app{}`(Beasties stub) -> `<link>`(global, deferred) -> `<style>`(component, appended last) | YES -- 2 -> 1 -> 0 removed -> remount re-added | YES -- express static over `ng build --configuration=production`, port 4501 |
| 3 | esbuild/Vite dev server, CSR | inline `<style>`, expanded + `/* path */` marker + sourcemap comment (DEFAULT). `<link ...?ngcomp>` only with `NG_HMR_CSTYLES=1` | YES in both modes (external CSS fetched and inspected) | `<link>`(global `styles.css`) -> `<style>` or `<link>`(component, last) | YES default, incl. after style HMR with no full reload. **NO in `NG_HMR_CSTYLES=1` after a style edit (leak + duplicates)** | YES -- ports 4502 (default) and 4506 (`NG_HMR_CSTYLES=1`) |
| 4 | esbuild/Vite dev server, SSR | server-emitted `<style ng-app-id="ng">` (expanded); `<link ... ng-app-id="ng">` with `NG_HMR_CSTYLES=1`. Client adopts, adds `ng-style-reused` | YES in both modes | `<link>`(global) -> adopted `<style>`/`<link>`(component) -- exactly one, no duplicate | YES default. Same `NG_HMR_CSTYLES=1` caveat as host 3 | YES -- ports 4503 (default) and 4507 (`NG_HMR_CSTYLES=1`) |
| 5 | Storybook dev server | Storybook's OWN builder: webpack 5 + `@angular-devkit/build-angular` config generators, `aot:false` (JIT), `optimization:false`. `SharedStylesHost` -> `<style>` | YES -- expanded, unminified, `CSSLayerBlockRule`, 3 rules | 3 Storybook `<style>` + global `<style>`(preview-head) -> component `<style>` appended LAST | YES -- story A -> story B removes it -> story A re-adds it | YES -- `nx run ngx-foundation-sites:storybook`, port 4488 |
| 6 | Storybook static build + test-runner | identical to host 5 (`optimization:false` is hard-coded, so the static build is NOT a production pipeline) | YES -- byte-identical to host 5 | identical to host 5 | YES -- identical to host 5 | YES -- `build-storybook` + express on 4477, plus `test-storybook --url` (17/17 passed, 0 console errors) |

Cascade outcomes were bit-for-bit identical in every row:
`.zz-probe-marker` -> `rgb(5,5,5)`, `.zz-probe-unlayered` -> `rgb(1,1,1)`,
`.zz-probe-order` -> `rgb(4,4,4)`.

`test-storybook` gate output (the primary verification bar, R006):

```
 PASS   browser: chromium  packages/ngx-foundation-sites/src/lib/zz-host-probe/zz-host-probe.stories.ts
 PASS   browser: chromium  packages/ngx-foundation-sites/src/lib/placeholder/placeholder.stories.ts
 PASS   browser: chromium  packages/ngx-foundation-sites/src/lib/nfs-button/nfs-button.stories.ts
Test Suites: 3 passed, 3 total
Tests:       17 passed, 17 total
```

The `preVisit` console-error hook did not fire for the `styleUrl` +
`@layer` + `ViewEncapsulation.None` probe story. (An unrelated pre-existing a11y
addon message is emitted for `NfsButton > Alert`; it is informational and the
suite still passes. Not caused by this ticket's work.)

---

## 5. Risk verdict -- `styleUrl` vs a global stylesheet

**`styleUrl` is the lower-risk option. The premise behind the global-stylesheet
argument did not survive measurement.**

The ticket's reasoning was: `styleUrl` has three-to-four delivery mechanisms and
therefore three-to-four chances to break, whereas a global stylesheet has one.
Mechanism count is right -- there are four distinct code paths (prod inline, dev
inline, dev external `<link>`, Storybook JIT/webpack) plus SSR adoption on top of
two of them. But **observable behaviour did not vary across them**: `@layer` was
preserved in 100% of hosts, the cascade result was identical in 100% of hosts,
and ref-counted removal worked in 100% of hosts in their default configuration.
Six hosts, eight configurations, one behaviour.

Quantified risk for `styleUrl`:

- `@layer` survival: **0 failures / 8 configurations.** The specific fear -- the
  dev server injecting the layered default in a different position than
  production -- does not happen. Layer order was pinned identically everywhere,
  including the Beasties async-global case, which actively protects it.
- SSR adoption: **0 duplications / 4 SSR configurations.** Adoption is exact-node
  reuse keyed on CSS text (inline) or file name (link); server and client read
  the same artifact.
- Ref count: **1 defect / 8 configurations**, and that one is dev-only, opt-in
  behind an env var, needs a style edit to trigger, and is an upstream
  Angular/Vite bug that a global stylesheet would sidestep only because a global
  stylesheet has no ref count to break in the first place.
- Storybook: **0 defects.** This was flagged as the likeliest failure site and it
  was the cleanest. `test-storybook` passes with zero console errors.

Against that, the counterweight the ticket flagged is **materially worse than it
assumed.** The ticket says a global stylesheet in Storybook "means wiring it into
`.storybook/preview.ts` by hand". Measured: **that does not work at all.**

`import './zz-probe-global.scss';` in `preview.ts`:

- Storybook **dev server**: silently no-ops. The story renders, no build error
  is surfaced, and the stylesheet simply never reaches the DOM. The probe
  measured `global-marker` as the UA default `rgb(0, 0, 0)` and zero `zz-app`
  style elements. A consumer would conclude their theme override "doesn't work"
  with no diagnostic.
- Storybook **static build**: hard failure.

```
Module parse failed: Unexpected token (1:0)
File was processed with these loaders:
 * ./node_modules/resolve-url-loader/index.js
 * ./node_modules/@angular-devkit/build-angular/node_modules/sass-loader/dist/cjs.js
You may need an additional loader to handle the result of these loaders.
> .zz-probe-unlayered {
|   color: rgb(1, 1, 1);
| }

packages/ngx-foundation-sites/.storybook/preview.ts:2:8 - error TS2882: Cannot
find module or type declarations for side-effect import of './zz-probe-global.scss'.

Failed to build the preview
SB_BUILDER-WEBPACK5_0003 (WebpackCompilationError)
```

Root cause, cited. Angular's webpack styles config routes stylesheets by
resourceQuery only --
`node_modules/@angular-devkit/build-angular/src/tools/webpack/configs/styles.js:277-291`:

```js
                        oneOf: [
                            // Global styles are only defined global styles
                            {
                                use: globalStyleLoaders,
                                resourceQuery: /\?ngGlobalStyle/,
                            },
                            // Component styles are all styles except defined global styles
                            {
                                use: componentStyleLoaders,
                                resourceQuery: /\?ngResource/,
                            },
                        ],
```

`?ngGlobalStyle` is appended only by
`tools/webpack/plugins/styles-webpack-plugin.js:51`, which is fed exclusively
from the builder's `styles` option; `?ngResource` only by
`@ngtools/webpack`'s `replace_resources` transformer for component `styleUrl`.
A plain ESM import from `preview.ts` carries neither query, so both `oneOf`
branches miss, only sass-loader runs, and webpack tries to parse CSS as
JavaScript.

There IS a working path, but it is not the one the ticket named. Two options:

1. Add `"styles": ["<path>.css"]` to the `storybook` **and** `build-storybook`
   target options in `project.json`. Because `browserTarget` is self-referential
   (`ngx-foundation-sites:build-storybook`, `project.json:83` and `:98`),
   `getBuilderOptions` deep-merges the storybook target's own options, so a
   `styles` array there does reach Angular's real global pipeline
   (`angular-cli-webpack-VNEX2DZH.js:114`). Two targets to keep in sync,
   consumer-visible.
2. `.storybook/preview-head.html` with a `<style>` or `<link>`. This is what I
   used to get a real global sheet into hosts 5 and 6, and it works identically
   in dev and static. It bypasses Angular's pipeline entirely.

So the honest comparison is:

| | `styleUrl` | Global / precompiled stylesheet |
|---|---|---|
| Delivery mechanisms | 4 (+ SSR adoption) | 1 per host, but **not the same one** in Storybook as in the app hosts |
| Behaviour variance measured | none, except one opt-in dev-only ref-count leak | untested in app hosts; the obvious Storybook wiring silently no-ops in dev and hard-fails the static build |
| Consumer configuration required | none | Storybook wiring by hand, via a mechanism that is not `preview.ts` |
| Failure mode when misconfigured | n/a | silent in dev, build break in CI |
| Ref-count lifecycle (R005) | present and working in all 6 | none -- a global sheet cannot satisfy R005 |

**Verdict: the six-host requirement does not argue for the global-stylesheet
architecture. It mildly argues against it.** `styleUrl` behaved uniformly across
every host that matters, including the two Storybook hosts that R006 makes
primary; the global-stylesheet path is the one with a measured dev/prod
divergence and a silent-failure mode. And R005's ref-counted lazy load/unload is
only expressible on the `styleUrl` side at all.

Two caveats to carry forward rather than treat as settled:

- Ticket 07 (Directive compatibility) is a genuinely separate axis. This ticket
  says only that host coverage is not a reason to prefer the global stylesheet;
  if Directive-hood is required for a reason unrelated to hosts, that argument
  stands on its own footing.
- Nothing here evaluates the *content* question (whether `@include`-ing
  Foundation's mixins into a component sheet duplicates Foundation globals).
  Delivery is uniform; payload size and duplication are ticket 02's and the
  map's open questions.

---

## Recommendations

1. **Adopt `styleUrl` + `@layer nfs-defaults` + `ViewEncapsulation.None`.** It
   is uniform across all six hosts and is the only option that can satisfy R005.
2. **Do not document `preview.ts` SCSS imports** as the way to load a global
   stylesheet in Storybook, in the README or anywhere else. It no-ops in dev and
   breaks `build-storybook`. If a global CSS entry is ever needed for Storybook
   (e.g. M002's theming addon), use `preview-head.html` or the `styles` option on
   both storybook targets.
3. **Do not set `NG_HMR_CSTYLES=1`** in any script, docs, or CI config, and note
   the stale-stylesheet symptom if a consumer reports it. Default dev-server
   behaviour is clean.
4. **Ticket 13 (host scaffolding) can reuse** `D:\projects\sandbox\zz-hostprobe`
   as a working reference for the SSR host: `provideServerRendering()` with no
   features, `bootstrapApplication(App, config, context)` taking
   `BootstrapContext` (omitting it fails route extraction with NG0401
   `PLATFORM_NOT_FOUND`), and `new AngularNodeAppEngine({ allowedHosts: ['localhost'] })`
   (omitted, Angular 22's SSRF guard rejects `localhost:<port>` with HTTP 400).
   Give the SSR configuration its own `outputPath` or it will clobber the CSR
   build output.
5. **Report to the user that D016 is superseded** -- a real Express/Node SSR host
   was stood up and behaves identically to the other five, so the scope boundary
   it drew is no longer load-bearing. D016's stated risk (SSR wiring reopening
   the D014/D015 registry-only consumption isolation) was NOT exercised here,
   because the probe app imports a local component rather than the published
   package. That risk remains open for ticket 13.

---

## UNRESOLVED

1. **SSR against the Verdaccio-installed package.** Every SSR observation used a
   local component in a scratch app, not `ngx-foundation-sites` consumed from
   the registry. So this ticket does NOT clear D016's actual stated concern that
   SSR wiring reopens the D014/D015 consumption isolation. What would settle it:
   ticket 13's real SSR host in `apps/nfs-demo`, importing the package from
   Verdaccio, re-run with the same probe.
2. **Whether the `NG_HMR_CSTYLES=1` leak is already filed upstream.** Root-caused
   locally (Vite replaces the `<link>` node; Angular's `external` map keeps the
   detached one) but not checked against angular/angular-cli issues. Filing
   requires user confirmation per the outward-facing-action rule. What would
   settle it: a search of angular/angular-cli issues for
   `externalRuntimeStyles` / `NG_HMR_CSTYLES` + a minimal repro.
3. **Nx `@nx/web:file-server` was not the static server used for host 6.** I used
   an express static server on a private port because another agent's server was
   already bound to 4402 (two listeners observed on that port, one serving
   `dist/storybook/nfs-button`). `file-server` differs only in transport, not in
   what the browser parses, so the risk of this mattering is very low -- but it
   was not literally exercised. What would settle it:
   `nx run ngx-foundation-sites:test-storybook` end to end on a quiet machine.
4. **`@storybook/angular` pushes `zone.js` into the polyfills entry** unless
   `experimentalZoneless` is set (`angular-cli-webpack-VNEX2DZH.js:130`), and
   `zone.js` is NOT installed in this workspace (`require.resolve` fails).
   Storybook nevertheless builds and all 17 tests pass, so something absorbs it,
   but I did not trace what. Unrelated to styles; flagged only so a future
   Storybook upgrade failure is not mistaken for a styling regression.

## Cleanup performed

- Deleted `packages/ngx-foundation-sites/src/lib/zz-host-probe/` (component,
  SCSS, stories).
- Deleted `packages/ngx-foundation-sites/.storybook/preview-head.html` and
  `.storybook/zz-probe-global.scss`.
- Restored `packages/ngx-foundation-sites/.storybook/preview.ts` to its tracked
  empty state via `git checkout --`.
- Rebuilt `dist/storybook/ngx-foundation-sites` so the shared build contains no
  probe story.
- Removed the `node_modules` junction from `D:\projects\sandbox\zz-hostprobe`
  (junction only -- repo `node_modules` verified intact) and deleted that app's
  `dist/` and `.angular/`.
- Stopped every probe server started for this ticket.

`git status` is clean apart from `.scratch/`.
