# What does `styleUrl` + `ViewEncapsulation.None` actually guarantee?

Type: research
Status: resolved
Blocked by: —

## Question

R026 asserts that Angular's own `styles`/`styleUrl` + `ViewEncapsulation.None`
pipeline (SharedStylesHost) already ref-counts, handles SSR/hydration reuse, and
passes compiled SCSS through verbatim -- which is what makes deleting
`NfsStyleLoader` and `NfsStyleExtractor` safe rather than a regression. R005's
validation note claims the same. Both need to be proved against Angular v22
source, not accepted, because three of this effort's requirements rest on them.

Establish, against the local `angular/angular` clone (and `node_modules` for the
exact installed v22.0.4 build):

1. **Ref-counted load/unload.** Does `SharedStylesHost` add a `<style>` element
   on first instantiation of a `ViewEncapsulation.None` component and *remove it
   from the DOM* when the last instance is destroyed? Name the
   `addUsage`/`removeUsage` call sites and what drives them
   (`NoneEncapsulationDomRenderer.applyStyles()` / `.destroy()`,
   `ComponentFactory.createComponentRef`). Does removal actually happen, or is
   the usage count merely decremented while the element stays? This is exactly
   what R005 promises and what NfsStyleLoader currently does by hand.
2. **SSR and hydration.** How do component styles reach server-rendered HTML
   (`ng-app-id` attribute, `APP_ID`), and on the client does SharedStylesHost
   *adopt* the server-emitted `<style>` elements rather than duplicating them?
   Confirm this replaces NfsStyleExtractor, including the duplicate-`<style>`
   limitation D013 accepted as a known cost.
3. **Never-ships.** When a component is never imported, is its style text
   tree-shaken out of the bundle? Where do component styles physically live in
   the ng-packagr FESM output and in an application bundle -- and does a lazy
   route chunk carry its components' CSS with it? R005's "unused component CSS
   never ships" depends on the answer.
4. **Verbatim passthrough.** Are at-rules preserved untouched -- specifically,
   does a `@layer nfs-defaults { ... }` wrapper authored in the component's SCSS
   survive to the injected `<style>` element intact? R008's cascade fix depends
   on `@layer` surviving.
5. **Directive gap.** Confirm there is no Directive-side equivalent of this
   lifecycle (no `DirectiveDef` style channel), which is the factual basis for
   R025's carve-out.

Prefer reading the shipped `@angular/platform-browser` and `@angular/core`
sources in `node_modules` (that is the code that will actually run) and
cross-check against the clone's source of truth.

## Answer

Full findings, with `file:line` citations and observed output:
[research/01-angular-style-lifecycle.md](../research/01-angular-style-lifecycle.md)

Audited against **v22.0.8**, not the v22.0.4 this ticket assumed -- the `~22.0.4`
range resolved upward, and the `angular/angular` clone sits exactly on tag
`v22.0.8`, so clone and `node_modules` citations are interchangeable.

**All five sub-questions confirmed. R026's premise holds and R025's carve-out is
factually correct.** Every claim below was observed empirically, not only read.

1. **Ref-counted load/unload -- real removal, not a decremented counter.**
   `createComponentLView` -> `createRenderer` -> `applyStyles()` -> `addUsage` per
   instance; teardown via `lView[RENDERER].destroy()` (guarded on
   `TViewType.Component`) -> `removeStyles` -> `removeUsage`, which calls
   `element.remove()` at count `<= 0`. Observed: two instances -> one `<style>`;
   destroy one -> still one; destroy the last -> zero, detached. Two suppression
   caveats, both leaks rather than breakage: `REMOVE_STYLES_ON_COMPONENT_DESTROY:
   false`, and any in-flight `animate.leave` (the `allLeavingAnimations.size === 0`
   guard).
2. **SSR adoption is better than R005 promised.** The server stamps
   `ng-app-id="<APP_ID>"`; the client's `addServerStyles` adopts those exact
   nodes by object identity, strips `ng-app-id`, and seeds `usage: 0`. Observed
   post-hydration count of 1 with `same node adopted? true`. **D013's accepted
   duplicate-`<style>` cost is eliminated, not inherited** -- duplication could
   only be forced by rewriting `ng-app-id` to a foreign value. Sole residual risk
   is a client/server `APP_ID` mismatch.
3. **Never-ships confirmed on real builds -- and this kills D018's RTL
   mechanism.** Component CSS is a JS string at `ComponentDef.styles`, inlined
   into `ɵɵngDeclareComponent` in the ng-packagr FESM. **No `.css` file is emitted
   for component styles anywhere.** Tree-shaking proved: `Placeholder` is
   barrel-exported with a real `styleUrl` but never imported, and both its
   selector and its CSS are absent from `dist/apps/nfs-demo` (positive control
   `nfsButton` present). Lazy chunks carry `styles:[...]` inline. Consequence for
   ticket 03: there is no build-time CSS artifact for `rtlcss` to post-process, so
   the dual-file RTL approach cannot survive a `styleUrl` delivery unless SCSS is
   precompiled to `.css` out-of-band first.
4. **`@layer` survives SharedStylesHost verbatim -- but the build does not.**
   `@layer nfs-defaults` parses as a real `CSSLayerBlockRule`;
   `shimStylesContent` is skipped entirely for `ViewEncapsulation.None`. The
   *build* is the mutator: dev reformats and prepends an
   `/* angular:styles/component:css;<hash>;<path> */` marker, prod strips it and
   minifies (`rgb(9, 8, 7)` -> `#090807`). A `toBe` assertion against hand-written
   CSS text will fail -- a real trap for any parity test (see ticket 09). Bonus
   cascade fact for R008: the component `<style>` is appended to `head` *after*
   the global `styles.css` `<link>`, so it wins same-specificity ties, which is
   precisely why `@layer` is load-bearing rather than cosmetic.
5. **Directive gap is structural.** `styles`, `encapsulation` and
   `getExternalStyles` all sit inside `ComponentDef`, none in `DirectiveDef`;
   `ɵɵExternalStylesFeature` returns a `ComponentDefFeature`. A runtime def-key
   diff confirms a directive has none of the three. The lifecycle is keyed to the
   component LView, which a directive does not have.

Also established, and handed to ticket 12: the `<link>`-based
`ɵɵExternalStylesFeature` path is **dev-server-HMR-only**
(`externalRuntimeStyles` is set only at `dev-server/vite/index.js:145`).

Carried forward:

- Whether `ng serve`'s `<link>` external-styles mode preserves `@layer` -- gating
  located, content not fetched. Now ticket 12's, and sent to that agent.
- Ordering across multiple `ViewEncapsulation.None` components (append order is
  instantiation order, hence lazy/`@defer`-dependent) -- untested with two
  colliding layered sheets. Moved to the map's fog; M001 has one component.
- The RTL consequence in item 3 -- ticket 03 owns it.
