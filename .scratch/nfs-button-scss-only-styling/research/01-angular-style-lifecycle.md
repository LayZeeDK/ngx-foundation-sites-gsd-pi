# What does `styleUrl` + `ViewEncapsulation.None` actually guarantee?

Research findings for
[issues/01-angular-style-lifecycle.md](../issues/01-angular-style-lifecycle.md).

## Source provenance (read this first)

**The ticket says v22.0.4. The repo actually has v22.0.8.** Every `@angular/*`
package in `node_modules` is `22.0.8`
(`node_modules/@angular/core/package.json:3`,
`node_modules/@angular/platform-browser/package.json:3`), and the compiled
`ɵfac`/`ɵprov` metadata in the shipped bundles self-reports `version: "22.0.8"`
(`node_modules/@angular/platform-browser/fesm2022/_dom_renderer-chunk.mjs:275`).
Findings below are for 22.0.8; treat "22.0.4" in R005/R026 notes as a stale
version string, not a different code path.

**The local clone is an exact match for the installed build.**
`D:\projects\github\angular\angular` HEAD is `548ef4786e release: cut the
v22.0.8 release`, `git describe --tags` returns `v22.0.8`, and
`package.json` reads `"version": "22.0.8"`. I diffed the relevant regions by
eye: `packages/platform-browser/src/dom/shared_styles_host.ts` and the
shipped `_dom_renderer-chunk.mjs` are semantically identical statement for
statement (only decorators/DI metadata are lowered). So clone line numbers and
`node_modules` line numbers are interchangeable evidence here.

**Empirical evidence.** Two throwaway experiments were run and then deleted;
their raw observations are quoted inline below and the recipes are in
[Appendix: reproducing the experiments](#appendix-reproducing-the-experiments).

1. A Vitest spec run through the repo's own toolchain
   (`npx nx test ngx-foundation-sites --include="**/zz-probe*.spec.ts"`), which
   is jsdom + the real `@angular/platform-browser` / `@angular/platform-server`
   from `node_modules`. 5 tests, all passing.
2. A scratch Angular application at `D:/projects/sandbox/lazyprobe` (outside
   this repo), built with `@angular/build:application` in full production mode,
   to observe real chunk placement for a lazy route.

---

## 1. Ref-counted load/unload

**Answer: yes, ref-counted, and the `<style>` element is genuinely removed from
the DOM (`element.remove()`), not merely decremented.** Confirmed by reading and
by direct observation.

### The call chain

Per **component instance**, not per component type:

| Step | Site (installed) | Site (clone) |
| --- | --- | --- |
| Component LView creation calls the factory | `@angular/core/fesm2022/_debug_node-chunk.mjs:5225` | `packages/core/src/render3/view/construction.ts:247` |
| `DomRendererFactory2.createRenderer` calls `applyStyles()` on the (cached) renderer | `_dom_renderer-chunk.mjs:403-421`, `:417` | `packages/platform-browser/src/dom/dom_renderer.ts:154-179`, `:174-176` |
| `NoneEncapsulationDomRenderer.applyStyles()` -> `addStyles` | `_dom_renderer-chunk.mjs:763-765` | `dom_renderer.ts:606-608` |
| `SharedStylesHost.addStyles` -> `addUsage` per style string | `_dom_renderer-chunk.mjs:192-197` | `shared_styles_host.ts:139-145` |
| `addUsage` increments, or creates the `<style>` on first use | `_dom_renderer-chunk.mjs:204-217` | `shared_styles_host.ts:159-182` |

The renderer instance itself is cached per `type.id`
(`_dom_renderer-chunk.mjs:422-446` / `dom_renderer.ts:181-245`), but
`applyStyles()` is invoked on **every** `createRenderer` call
(`:417` sits outside `getOrCreateRenderer`), which is what makes the count track
instances rather than types.

Destruction, symmetrically:

| Step | Site (installed) | Site (clone) |
| --- | --- | --- |
| Component view teardown destroys its renderer | `_debug_node-chunk.mjs:4830` | `packages/core/src/render3/node_manipulation.ts:352-354` |
| `NoneEncapsulationDomRenderer.destroy()` -> `removeStyles` | `_dom_renderer-chunk.mjs:766-773` | `dom_renderer.ts:610-617` |
| `removeUsage` decrements; at `<= 0` calls `removeElements` and deletes the map entry | `_dom_renderer-chunk.mjs:218-227` | `shared_styles_host.ts:184-200` |
| `removeElements` calls `element.remove()` | `_dom_renderer-chunk.mjs:143-147` | `shared_styles_host.ts:37-41` |

`ComponentFactory.createComponentRef` is the *host-seeding* half, not the
style-adding half: it calls `sharedStylesHost.addHost(styleHost)`
(`_debug_node-chunk.mjs:9085` / `component_ref.ts:317-322`), where `styleHost`
resolves to `document.head` for a connected element
(`_debug_node-chunk.mjs:9173` / `component_ref.ts:502-514`). This matters
because `SharedStylesHost`'s constructor only seeds `hosts` when *server* styles
were found (`_dom_renderer-chunk.mjs:189-190` /
`shared_styles_host.ts:135-136`) -- in a pure client app `hosts` is empty until
the root component's `createComponentRef` adds `document.head`. The root's own
styles are still applied, because `addHost` runs at `component_ref.ts:322`
before `renderView` at `:396` reaches `createComponentLView`.

### Observed (Vitest probe, jsdom)

Two instances of a `ViewEncapsulation.None` component created via
`createComponent`, then destroyed one at a time:

```
PROBE after 2nd instance: style count = 1
PROBE after destroying 1 of 2: style count = 1
PROBE after destroying last: style count = 0 | still in document? false
```

So: one `<style>` for N instances, survives N-1 destroys, and is detached from
`document.head` on the last one. This is the same contract `NfsStyleLoader`
implements by hand (`packages/ngx-foundation-sites/src/lib/nfs-style-loader.ts`,
whose own `styles` map / `count` / `delete` at lines 44-86 is a
narrower re-implementation of `addUsage`/`removeUsage`).

### Three caveats worth carrying into the plan

1. **`REMOVE_STYLES_ON_COMPONENT_DESTROY` can switch removal off.** Default is
   `true` (`_dom_renderer-chunk.mjs:348-351` /
   `dom_renderer.ts:57`, `:66-71`), and it is public API. If a consumer provides
   `false`, `NoneEncapsulationDomRenderer.destroy()` returns early
   (`_dom_renderer-chunk.mjs:767-769` / `dom_renderer.ts:611-613`) and styles
   stay forever. `NfsStyleLoader` has no such escape hatch, so this is a
   *behavioural difference*, though a benign one (leak, not breakage).
   Corroborated by angular.dev: "A DI token that indicates whether styles of
   destroyed components should be removed from DOM"
   (<https://angular.dev/api/platform-browser/REMOVE_STYLES_ON_COMPONENT_DESTROY>).
2. **Leaving animations suppress removal.** `destroy()` only calls
   `removeStyles` when `allLeavingAnimations.size === 0`
   (`_dom_renderer-chunk.mjs:770-772` / `dom_renderer.ts:614-616`, backed by
   `packages/core/src/animation/longest_animation.ts:161`). If *any* view
   anywhere is mid-`animate.leave`, the destroyed component's styles are not
   removed and the usage count is not decremented -- so the counter can drift
   upward permanently. Again a leak, not a correctness break.
3. **Keyed by CSS text, not by component.** `inline` is a
   `Map<string /* content */, UsageRecord>` (`shared_styles_host.ts:114`). Two
   different components whose compiled CSS is byte-identical share one `<style>`
   and one counter. Harmless here, but it means "one style element per
   component" is not the actual invariant.

**Verdict: R005 / R026's ref-counting claim holds.** Deleting `NfsStyleLoader`
loses nothing except the two edge cases above, both of which are
leak-not-break and both of which are Angular's documented behaviour rather than
a regression introduced by the change.

---

## 2. SSR and hydration

**Answer: yes -- the server tags each `<style>` with `ng-app-id="<APP_ID>"`, and
the client adopts those exact elements instead of creating new ones. This fully
replaces `NfsStyleExtractor`, and it *eliminates* rather than accepts D013's
duplicate-`<style>` cost.**

### Server side

`ServerModule` re-exports `BrowserModule`
(`packages/platform-server/src/server.ts:89-93`), and `bootstrapApplication`
always includes `BROWSER_MODULE_PROVIDERS`
(`packages/platform-browser/src/browser.ts:169`), which provide
`{provide: SHARED_STYLES_HOST, useClass: SharedStylesHost}`
(`browser.ts:276-278`, shipped at `_browser-chunk.mjs:347-349`). So SSR uses the
*same* `SharedStylesHost` class, against Domino's DOM. `platform-server` has no
separate styles host.

The only server-specific branch is in `addElement`: when `ngServerMode` is set,
it stamps `ng-app-id` with the injected `APP_ID`
(`_dom_renderer-chunk.mjs:264-272`, specifically `:268-269` /
`shared_styles_host.ts:239-252`, `:245-248`). `APP_ID` defaults to the string
`'ng'` (`_pending_tasks-chunk.mjs:2730-2733` /
`packages/core/src/application/application_tokens.ts:44-52`).

### Client side

`SharedStylesHost`'s constructor runs `addServerStyles` before anything else
(`_dom_renderer-chunk.mjs:189` / `shared_styles_host.ts:135-136`).
`addServerStyles` (`_dom_renderer-chunk.mjs:153-171` /
`shared_styles_host.ts:65-92`):

- queries `document.head` for
  `style[ng-app-id="<appId>"], link[ng-app-id="<appId>"]`,
- **removes the `ng-app-id` attribute** from each,
- seeds `inline` keyed by `textContent` (or `external` keyed by the href's
  filename) with `usage: 0` and `elements: [thatExactNode]`,
- returns `true`, which makes the constructor add `document.head` to `hosts`.

When the client component then mounts, `addUsage` finds the pre-seeded record and
takes the increment branch -- no new element. Because `usage === 0` identifies a
server-generated record, dev mode also stamps `ng-style-reused` on it purely as a
debugging marker (`_dom_renderer-chunk.mjs:206-210` /
`shared_styles_host.ts:168-173`).

### Observed (Vitest probe: `renderApplication` -> `bootstrapApplication`)

Server output, verbatim from the probe:

```
<!DOCTYPE html><html><head><style ng-app-id="ng">/* angular:styles/component:css;... */
@layer nfs-defaults {
...
}
</style></head><body><!--nghm--><zz-ssr-host ng-version="22.0.8" ngh="0" ...>
```

```
PROBE SSR probe-style count = 1 | ng-app-id = "ng"
PROBE post-hydration probe-style count = 1 | same node adopted? true | ng-app-id now = null | ng-style-reused? true
```

`same node adopted? true` is an object-identity check (`===`) against the node
captured before `bootstrapApplication` -- so this is genuine adoption of the
server's element, not a coincidental match on count.

### The duplicate-`<style>` limitation

D013 (`.gsd/DECISIONS.md:21`) accepted "a harmless duplicate `<style>` tag can
exist briefly post-hydration (extracted critical CSS + NfsStyleLoader's own
browser injection) ... since NfsStyleLoader has no awareness of the extractor's
DOM marker". **That cost disappears entirely under `SharedStylesHost`**, because
the server writer and the client adopter are the same class sharing one keying
scheme (`ng-app-id` + CSS text). Empirically the post-hydration count is 1, not
2.

Duplication is only reachable by breaking the key. I forced that case by
rewriting `ng-app-id` to a foreign value before hydrating:

```
PROBE mismatched-appId probe-style count = 2
```

So the residual risk is narrow and nameable: **the client's `APP_ID` must equal
the server's**. Relevant if a consumer overrides `APP_ID` on only one platform,
or runs two Angular apps on one page with distinct ids
(`application_tokens.ts:21-40` documents exactly that multi-app scenario). Not a
concern for a library that never touches `APP_ID`.

**Verdict: `NfsStyleExtractor` is fully replaced, and D013's accepted cost is
retired rather than inherited.**

---

## 3. Never-ships (tree-shaking, packaging, lazy chunks)

**Answer: yes on all three counts -- unused component CSS is tree-shaken, it
lives as a JS string literal in the component's own module (never a separate
`.css` file), and a lazy chunk carries its components' CSS with it.** All three
observed on real builds, not inferred.

### Where component styles physically live

Compiled component CSS is a **string in the JavaScript**, at
`ComponentDef.styles` -- there is no separate CSS asset for it.

- Partial-compilation contract: `styles?: string[]` described as "CSS from
  inline styles and included styleUrls"
  (`packages/compiler/src/render3/partial/api.ts:173-175`).
- ng-packagr FESM output: styles are inlined into the
  `ɵɵngDeclareComponent(...)` call in the single FESM file. Observable in this
  repo at
  `dist/packages/ngx-foundation-sites/fesm2022/ngx-foundation-sites.mjs:411`
  (`styles: [".button{display:inline-block;...}"]`) and again in the
  `ɵɵngDeclareClassMetadata` decorator echo at `:415`. There is no
  `dist/packages/ngx-foundation-sites/*.css` for component styles -- the only
  CSS files in the package are `css/nfs-button.css` and
  `css/nfs-button.rtl.css`, which the separate `compile-default-css` Nx target
  writes (`packages/ngx-foundation-sites/project.json`, `compile-default-css`).
  *Caveat on this specific citation:* at the time of reading, another agent
  working ticket 02 had `placeholder.scss` temporarily modified
  (`git status` showed it dirty), so the exact CSS text in that FESM is theirs.
  The *structure* -- `styles: [...]` inline in the declaration -- is a property
  of partial compilation, not of their edit.
- Runtime: the Vitest probe dumped the live def and found
  `ComponentDef.styles = ["/* angular:styles/component:css;... */\n@layer
  nfs-defaults {...}"]`, `encapsulation = 2` (`ViewEncapsulation.None`),
  `getExternalStyles = object` (i.e. `null`).

### The `<link>` variant is dev-server-only

There *is* a second delivery mode -- `ɵɵExternalStylesFeature` sets
`getExternalStyles`, which makes `SharedStylesHost` create a `<link>` instead of
a `<style>` (`_debug_node-chunk.mjs:17286` /
`packages/core/src/render3/features/external_styles_feature.ts:11-42`; the doc
comment says it "is typically used for Hot Module Replacement (HMR) of component
stylesheets"). It is gated behind the `externalRuntimeStyles` build option,
which is `aot && externalRuntimeStyles`
(`node_modules/@angular/build/src/builders/application/options.js:319`) and is
set **only** by the dev-server, and only when HMR is live:

```
143: const componentsHmrCanBeUsed = browserOptions.aot && serverOptions.liveReload && serverOptions.hmr;
145: browserOptions.externalRuntimeStyles = componentsHmrCanBeUsed && environment_options_1.useComponentStyleHmr;
```
(`node_modules/@angular/build/src/builders/dev-server/vite/index.js:143`, `:145`)

So shipped library and application builds always take the inline-`<style>`
path. Worth knowing because `ng serve` will show `<link>` elements where
production shows `<style>` -- an easy way to mis-diagnose a cascade bug.

### Tree-shaking: observed

`packages/ngx-foundation-sites/src/index.ts` barrel-exports **both** `NfsButton`
and `Placeholder` (`index.ts:1`, `:4`), and `Placeholder` has
`styleUrl: './placeholder.scss'` (`placeholder.ts:7`). `apps/nfs-demo` imports
only `NfsButton` from `'ngx-foundation-sites'`
(`apps/nfs-demo/src/app/app.component.ts:2`). After
`npx nx build nfs-demo --configuration=production --skip-nx-cache`, searching
the entire output directory:

| Needle | Result |
| --- | --- |
| `zz-probe-marker` (a selector present only in `placeholder.scss` at read time) | exit 1 -- absent |
| `lib-placeholder` (Placeholder's selector) | exit 1 -- absent |
| `nfsButton` (positive control) | found in `browser/main.js` |

Exit 1 is ripgrep's genuine no-match code, and the positive control rules out a
broken invocation. **Unused component CSS provably does not ship**, because the
CSS is a string inside a module the bundler drops wholesale.

### Lazy chunks: observed

The scratch app had one eagerly-imported component and one behind
`loadComponent: () => import('./lazy')`, both `ViewEncapsulation.None` with
distinct marker selectors, built with `optimization: true`:

```
Initial chunk files | chunk-A6FX7Y6R.js  109.82 kB
                    | main.js             92.33 kB
Lazy chunk files    | chunk-7EU2EAOK.js   400 bytes   (name: lazy)
```

| Needle | Found in |
| --- | --- |
| `zzlazymarker` | `browser/chunk-7EU2EAOK.js` (the lazy chunk) only |
| `zzeagermarker` | `browser/main.js` only |
| `find . -name "*.css"` | no matches at all |

The whole lazy chunk is 400 bytes and contains the CSS verbatim:

```js
import{Aa as a,Ba as o,Da as r,ra as n}from"./chunk-A6FX7Y6R.js";var c=(()=>{class e{...
static \u0275cmp=n({type:e,selectors:[["app-lazy"]],...,
styles:[`@layer nfs-defaults{.zzlazymarker{color:#090807}}
`],encapsulation:2})}return e})();export{c as Lazy};
```

**Verdict: R005's "unused component CSS never ships" holds, and lazy-route CSS
travels with its chunk.** The mechanism is simply that component CSS is ordinary
JS module content, so it inherits esbuild's code-splitting and tree-shaking with
no CSS-specific machinery involved.

---

## 4. Verbatim passthrough

**Answer: `@layer nfs-defaults { ... }` survives to the injected `<style>`
intact, and reaches the CSSOM as a real `CSSLayerBlockRule`. But "verbatim" needs
one correction: `SharedStylesHost` is verbatim; the *build* is not.**

### SharedStylesHost does nothing to the text

`createStyleElement` sets `styleElement.textContent = style` and nothing else
(`_dom_renderer-chunk.mjs:148-152` / `shared_styles_host.ts:49-54`). The only
transformations anywhere on this path are:

- `shimStylesContent`, which replaces `%COMP%` -- and for
  `ViewEncapsulation.None` it is **skipped entirely**, because
  `NoneEncapsulationDomRenderer` is constructed with no `compId` and guards
  `this.styles = compId ? shimStylesContent(compId, styles) : styles`
  (`_dom_renderer-chunk.mjs:760` / `dom_renderer.ts:602`; the `None` branch at
  `dom_renderer.ts:228-238` passes no `compId`, unlike `Emulated` at `:634`).
- `addBaseHrefToCssSourceMap`, which is `ngDevMode`-only and only rewrites a
  `sourceMappingURL` comment (`dom_renderer.ts:103-129`, called at `:596-600`).

So no at-rule, no `@layer`, no `@supports`, no `@media` is inspected, let alone
rewritten, by the runtime.

### Observed

Authored (in the probe component's `styles`):

```css
@layer nfs-defaults {
  @supports (color: rgb(1 2 3)) {
    .zz-probe { color: rgb(1, 2, 3); --zz: "a}b"; }
  }
  @media (min-width: 1px) { .zz-probe::after { content: "}"; } }
}
```

Injected `<style>.textContent` in the Vitest (unoptimized) build:

```
/* angular:styles/component:css;0da84f28...;<path to the spec> */
@layer nfs-defaults {
  @supports (color: rgb(1 2 3)) {
    .zz-probe {
      color: rgb(1, 2, 3);
      --zz: "a}b";
    }
  }
  @media (min-width: 1px) {
    .zz-probe::after {
      content: "}";
    }
  }
}
```

and the CSSOM parse:

```
PROBE first parsed rule type = CSSLayerBlockRule | rule count = 1
```

Nesting, both inner at-rules, the custom property, and the deliberately nasty
`"a}b"` / `"}"` brace-in-string payloads all survived. `rule count = 1` with the
single top-level rule being `CSSLayerBlockRule` is the strongest form of the
claim R008 needs: the layer is a real cascade layer, not text that merely
happens to be present.

**The correction.** The injected text is *not* byte-identical to what was
authored. The build's CSS pipeline reformatted it (one declaration per line) and
prepended an `/* angular:styles/component:css;<hash>;<path> */` marker comment.
An initial `expect(textContent).toBe(PROBE_CSS)` assertion failed on exactly
this, which is how it was found. In the optimized production build the reverse
happens -- the marker comment is stripped and the CSS is minified to
`@layer nfs-defaults{.zzlazymarker{color:#090807}}` (note `rgb(9, 8, 7)`
collapsed to `#090807`). So:

- **Structure and semantics: preserved, in both dev and production.**
- **Exact bytes: not preserved.** Any future test asserting on compiled CSS text
  must compare semantically or by substring, never with `toBe` on a
  hand-written string. This is a real trap for a parity test.

### A cascade fact R008 will want

Component `<style>` elements are added with `host.appendChild(element)` where
host is `document.head` (`_dom_renderer-chunk.mjs:271` /
`shared_styles_host.ts:251`). The application's global stylesheet is a `<link>`
already in `index.html`'s head -- confirmed in this repo's own output,
`dist/apps/nfs-demo/browser/index.html:7`. So component styles land **after**
the global sheet in document order and therefore **win** same-specificity ties
against it. That is precisely the cascade inversion `@layer nfs-defaults` fixes
(any unlayered consumer rule beats any layered rule regardless of order), so
R008's dependency is not merely satisfied, it is load-bearing.

---

## 5. Directive gap

**Answer: confirmed. There is no Directive-side stylesheet channel of any kind.
`DirectiveDef` has no `styles`, no `encapsulation`, and no `getExternalStyles`.**

### By type declaration

`packages/core/src/render3/interfaces/definition.ts` declares
`DirectiveDef<T>` at line 114 and `ComponentDef<T> extends DirectiveDef<T>` at
line 297; the next interface (`DirectiveDefFeature`) is at 467. All three
style-related members fall inside the `ComponentDef` span, none in the
`DirectiveDef` span:

- `readonly styles: string[]` -- line 320
- `readonly encapsulation: ViewEncapsulation` -- line 353
- `getExternalStyles: ((encapsulationId?: string) => string[]) | null` -- line 412

`ɵɵExternalStylesFeature` returns a `ComponentDefFeature`, not a
`DirectiveDefFeature`, and assigns `definition.getExternalStyles` on a
`ComponentDef<unknown>`
(`packages/core/src/render3/features/external_styles_feature.ts:9`, `:21-22`,
`:27`) -- so even the HMR/`<link>` channel is component-only at the type level.

### By runtime observation

The probe dumped both real defs from compiled classes:

```
PROBE DirectiveDef keys = contentQueries,controlDef,debugInfo,declaredInputs,
exportAs,factory,features,hostAttrs,hostBindings,hostDirectives,hostVars,
inputConfig,inputs,outputs,providersResolver,resolveHostDirectives,selectors,
setInput,signalFormsInputPresence,signals,standalone,type,viewProvidersResolver,
viewQuery
PROBE DirectiveDef.styles = false | encapsulation present = false | getExternalStyles present = false
```

```
PROBE ComponentDef keys = _,consts,contentQueries,controlDef,data,debugInfo,
declaredInputs,decls,dependencies,directiveDefs,encapsulation,exportAs,factory,
features,getExternalStyles,getStandaloneInjector,hostAttrs,hostBindings,
hostDirectives,hostVars,id,inputConfig,inputs,ngContentSelectors,onPush,outputs,
pipeDefs,providersResolver,resolveHostDirectives,schemas,selectors,setInput,
signalFormsInputPresence,signals,standalone,styles,tView,template,type,vars,
viewProvidersResolver,viewQuery
```

Diffing the two key sets, the members a component has and a directive does not
include exactly `encapsulation`, `styles`, `getExternalStyles`, plus the
template/view machinery (`consts`, `decls`, `template`, `tView`, `vars`,
`ngContentSelectors`, `data`, `dependencies`, `directiveDefs`, `pipeDefs`,
`schemas`, `id`, `onPush`, `getStandaloneInjector`).

### Why this is structural, not an oversight

The lifecycle in Q1 is keyed to the component *view*, not the directive
instance: styles are added by `rendererFactory.createRenderer(native, def)`
inside `createComponentLView` (`construction.ts:247`) and removed by
`lView[RENDERER].destroy()` guarded by
`if (lView[TVIEW].type === TViewType.Component)`
(`node_manipulation.ts:352-354`). A directive has no LView of its own, so there
is no place in the machinery for it to hook. `@Directive`'s decorator metadata
has no `styles`/`styleUrl`/`encapsulation` fields at all, so this fails at
compile time rather than silently.

**Verdict: R025's carve-out is factually correct.** A template-less styled block
must be a Component if it needs the per-instance stylesheet lifecycle; there is
no Directive path to it, and no `ɵɵ*Feature` escape hatch either.

---

## Summary against the claims under test

| Claim | Verdict |
| --- | --- |
| R026/R005: `SharedStylesHost` ref-counts add/remove | **Confirmed**, read + observed. Two caveats: `REMOVE_STYLES_ON_COMPONENT_DESTROY: false` and in-flight leaving animations both suppress removal (leak, not break). |
| R005: SSR/hydration reuse replaces `NfsStyleExtractor` | **Confirmed**, observed by node identity. Better than promised: D013's duplicate-`<style>` cost is eliminated, not inherited. Only failure mode is an `APP_ID` mismatch between platforms. |
| R005: unused component CSS never ships | **Confirmed** on a real production build of `apps/nfs-demo`. Lazy chunks carry their own CSS; no `.css` file is emitted for component styles. |
| R008: `@layer nfs-defaults` survives to the `<style>` | **Confirmed**, and parses as `CSSLayerBlockRule`. **Correction:** structure survives, exact bytes do not -- the build reformats (dev) and minifies (prod). |
| R025: no Directive-side style lifecycle | **Confirmed** by type declaration and by runtime def diff. |

## UNRESOLVED

1. **Whether a `styleUrl`-delivered stylesheet can support D018's dual-file
   rtlcss RTL mechanism.** Out of this ticket's scope, but the finding in Q3 is
   the constraint that decides it: component styles are a JS string in the
   component's module with no separate emitted `.css` file, so there is no
   build-time artifact for `rtlcss` to post-process the way
   `compile-default-css` currently does. What would settle it: ticket 06 (or
   whichever ticket owns RTL) deciding between a logical-properties SCSS rewrite
   and keeping a precompiled sidecar sheet.
2. **Style-element ordering across multiple `ViewEncapsulation.None`
   components.** `<style>` elements are appended in first-instantiation order,
   which is runtime-dependent (lazy routes, `@defer`). Within a single
   `@layer nfs-defaults` this is almost certainly irrelevant, but I did not test
   two mutually-overriding layered component sheets. What would settle it: a
   probe with two `None` components whose rules collide, instantiated in both
   orders.
3. **Whether `ng serve`'s `<link>`-based external-styles mode preserves
   `@layer`.** The gating is established (Q3), but I did not run a dev-server
   build to confirm the `?ngcomp&e=2`-suffixed stylesheet is served with the
   layer intact. Low risk (it is the same compiled CSS served as a file) but
   unverified. What would settle it: `nx serve nfs-demo` with HMR on, then
   inspecting the injected `<link>`'s fetched content.

## Appendix: reproducing the experiments

Both artifacts were deleted after the run. Recipes:

**Vitest probe (Q1, Q2, Q4, Q5).** Write a spec at
`packages/ngx-foundation-sites/src/lib/zz-probe-style-lifecycle.spec.ts`
containing a `ViewEncapsulation.None` component with a `@layer`-wrapped
`styles` entry, plus a bare `@Directive`. Assertions: `createComponent` twice
and count `document.head` `<style>` elements across staged `.destroy()` calls;
`renderApplication` + `bootstrapApplication` with `provideClientHydration` and
compare node identity before/after; read `ɵcmp` / `ɵdir` keys. Run with
`npx nx test ngx-foundation-sites --include="**/zz-probe*.spec.ts"`.
**Note:** the Nx executor swallows `console.log` for passing tests, so write
observations to a file outside the repo (`appendFileSync`) rather than stdout.
`--testPathPattern` is not a valid flag for this executor; `--include` is.

**Scratch app (Q3 lazy chunks).** At `D:/projects/sandbox/lazyprobe`, an
`angular.json` with a single `@angular/build:application` target
(`optimization: true`, `polyfills: []`), a `tsconfig.json` with
`"files": ["src/main.ts"]`, an `index.html`, and three sources: `main.ts`
bootstrapping with `provideRouter([{path:'lazy', loadComponent: () =>
import('./lazy').then(m => m.Lazy)}])`, plus `eager.ts` and `lazy.ts` as
`ViewEncapsulation.None` components with distinct marker selectors. Junction
`node_modules` to this repo's:
`New-Item -ItemType Junction -Path D:/projects/sandbox/lazyprobe/node_modules -Target <repo>/node_modules`.
Then `npx ng build` and grep the output for each marker.
