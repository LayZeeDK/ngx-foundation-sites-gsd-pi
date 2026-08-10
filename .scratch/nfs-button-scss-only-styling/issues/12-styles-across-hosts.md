# Does the style pipeline behave identically across all six host configurations?

Type: research
Status: resolved
Blocked by: —

## Question

Hard user requirement, added mid-effort: the solution must work in **all six** of
these, not just the one the repo currently exercises.

1. An SSR production-like host (`@angular/ssr` + Express -- both are already
   dependencies of the root `package.json`).
2. A static-serve production-like host (production `ng build` output served by a
   plain static file server, CSR only).
3. The esbuild/Vite development server in **CSR** mode.
4. The esbuild/Vite development server in **SSR** mode.
5. **Storybook's dev server** -- component stories and interaction tests
   (`nx run ngx-foundation-sites:storybook`).
6. **Storybook's static build plus test-runner** -- `build-storybook` served by
   `@nx/web:file-server`, exercised by `test-storybook`.

Storybook is not an afterthought here: R006 makes Storybook interaction tests the
project's **primary** verification bar, and `@storybook/angular` compiles and
delivers component styles through its own builder, distinct from both
`@angular/build` and ng-packagr. A styling approach that works in all four app
hosts but breaks stories has failed the requirement that matters most. Note also
that `.storybook/test-runner.ts` has a preVisit hook failing any story whose
render emits a browser console error -- so a style-loading failure surfaces there
as a gate failure rather than a visual glitch.

This matters because Angular does **not** deliver component styles the same way
in development as in production. A production build inlines compiled component
styles into the component definition; the `@angular/build` dev server serves them
through a separate path to support style hot-module replacement. SSR adds a third
mechanism again -- server-emitted `<style ng-app-id="...">` elements that the
client is supposed to adopt rather than duplicate. Any of those seams can break a
`styleUrl`-delivered stylesheet in a way the current test suite would never see,
since `apps/nfs-demo` only ever runs the Vite dev server in CSR mode.

Establish, against Angular v22.0.4 (`node_modules/@angular/build`,
`node_modules/@angular/ssr`, and the local `angular/angular-cli` clone):

1. **The delivery mechanisms.** Precisely how do component styles reach the DOM
   in (a) a production browser build, (b) the `@angular/build` dev server, (c) a
   server render, and (d) Storybook's own builder? Name the code paths. For the
   dev server, cover component style HMR specifically: is the style shipped as a
   JS module, injected as a `<style>`, or both, and does that change the
   element's identity or ordering? For Storybook, first establish **which**
   builder `@storybook/angular` 10.5 actually uses for this repo's config
   (`packages/ngx-foundation-sites/.storybook/main.ts` sets
   `browserTarget: ngx-foundation-sites:build-storybook`) -- do not assume it is
   the same pipeline as `ng build`, and say whether stories get the production
   inlining path, the dev HMR path, or something of Storybook's own.
2. **`@layer` survival.** Does a `@layer nfs-defaults` wrapper authored in the
   component's SCSS survive all three mechanisms byte-intact? Layer ordering is
   load-bearing for R008's cascade fix -- if the dev server injects the layered
   default *after* the app's own unlayered stylesheet in one mode and before it
   in another, theming appears to work in one host and silently break in another.
3. **SSR style adoption.** Does `APP_ID` / `ng-app-id` matching hold in dev-SSR
   mode as well as prod-SSR, so the client adopts rather than duplicates? Is
   there any FOUC or hydration style mismatch in dev-SSR specifically?
4. **Ref-count behaviour per host.** Does the ref-counted add/remove observed in
   ticket 01 hold identically in all six, or does the dev server's HMR wrapper --
   or Storybook's story remounting between play functions -- defeat removal by
   holding its own reference? Storybook mounts and unmounts a component per
   story, which is the most aggressive load/unload cycle in the whole repo and
   therefore the best place for a ref-count leak to show up.
5. **Does a global stylesheet behave more predictably?** Answer this one
   honestly, because it may change the architecture. A consumer-imported global
   or precompiled stylesheet has one delivery mechanism in all six hosts and no
   HMR seam at all. If component-`styleUrl` delivery is materially flakier in
   dev-SSR or in Storybook, that is a real argument for the global-stylesheet
   approach -- which is also the Directive-compatible one (see ticket 07).
   Quantify the risk rather than asserting a preference. Note the counterweight:
   a global stylesheet in Storybook means wiring it into `.storybook/preview.ts`
   by hand, which is consumer-visible configuration the `styleUrl` path does not
   need.

**Empirical proof is required, not optional, for at least items 2, 3 and the
Storybook half of item 1.** Stand up throwaway probes and observe the actual
`<head>` contents and computed styles per host. Storybook is cheap to probe here
because it already runs: `nx run ngx-foundation-sites:storybook` for the dev
server and `nx run ngx-foundation-sites:test-storybook` for the static build, and
the repo already has a `placeholder` component with a real `placeholder.scss` and
its own story you can borrow as a probe surface. Use the session scratchpad or
temporary probes you revert; do not commit scaffolding into `apps/nfs-demo`
(ticket 13 owns that work).

Note for the record: this requirement **supersedes D016**, which formally
re-scoped a real Express/Node SSR host out of M001 and declared the boundary "a
deliberate scope boundary, not a gap". `.gsd/` is read-only, so report the
supersession to the user rather than editing the decisions register.

## Answer

Full findings, with observed `<head>` contents per host:
[research/12-styles-across-hosts.md](../research/12-styles-across-hosts.md)

**All six hosts stood up and observed empirically -- nothing inferred.**

> **Correction from ticket 13.** The SSR reference shape used here relied on a bare
> `provideServerRendering()`, which makes the builder **prerender** `/` and serve a static
> file -- so hosts 1 and 4 below were exercising **SSG, not SSR**. `RenderMode.Server` must
> be set explicitly for a genuine per-request render. The style conclusions in this ticket
> still hold, because they concern `<style ng-app-id>` emission and client adoption, which
> both modes share; but the delivery rows described a prerender path. Ticket 13's host 1 is
> a real per-request render, evidenced by `ngh=` hydration annotations.

| # | Host | Delivery | `@layer` kept | Ref-count removal |
|---|---|---|---|---|
| 1 | SSR prod (`@angular/ssr` + Express) | server `<style ng-app-id="ng">`, adopted | yes | yes |
| 2 | Static-serve prod CSR | inline `<style>` from JS string, no component `.css` emitted | yes (minified) | yes |
| 3 | Dev server CSR | inline `<style>` **by default**; `<link ?ngcomp>` only with `NG_HMR_CSTYLES=1` | yes, both | yes by default; **no** under `NG_HMR_CSTYLES=1` after a style edit |
| 4 | Dev server SSR | server `<style ng-app-id>` / `<link ng-app-id>`, adopted (`ng-style-reused`) | yes, both | as #3 |
| 5 | Storybook dev | Storybook's own builder: webpack5 + build-angular configs, `aot:false`, `optimization:false` | yes (unminified) | yes, across story remounts |
| 6 | Storybook static + test-runner | identical to #5 (`optimization:false` hard-coded) | yes | yes (`test-storybook` 17/17) |

**Risk verdict: `styleUrl` wins, and this ticket's own global-stylesheet premise did
not survive measurement.** Four distinct delivery mechanisms exist, but they produced
one behaviour: `@layer` preserved 8/8 configurations, cascade identical 8/8
(unlayered global wins; a component layer beats an app layer), ref-counting working
8/8 in default configuration.

**The global-stylesheet counterweight is far worse than sub-question 5 assumed.**
`import './x.scss'` in `.storybook/preview.ts` **silently no-ops in Storybook dev**
and **hard-fails `build-storybook`** with `Module parse failed: Unexpected token
(1:0)`. Root-caused to `styles.js:277-291`, where both `oneOf` branches gate on
`?ngGlobalStyle` / `?ngResource` resource queries that a plain import never carries.
The working paths are `preview-head.html` or a `styles` entry on both Storybook
targets. So the Directive-compatible option costs *more* configuration, not less.

Two corrections to established assumptions:

- **The gap handed over from ticket 01 is closed:** external-`<link>` mode **does**
  preserve `@layer` -- the stylesheet was fetched and inspected in both CSR and SSR.
  It is also **not the dev default**: `useComponentStyleHmr` requires
  `NG_HMR_CSTYLES=1` (`environment-options.js:162`).
- Installed versions are **22.0.8 / 22.0.9**, not 22.0.4 -- matching ticket 01's
  correction.

**One real defect found, upstream and dev-only:** with `NG_HMR_CSTYLES=1`, a style
edit permanently orphans the component `<link>` and duplicates it on remount. Traced
to Vite replacing the node (`vite/dist/client/client.mjs:846-856`) while Angular's
`external` map retains the detached one. Opt-in and development-only, so not a
blocker; not filed upstream, which needs user confirmation.

Incidental finding that explains a real puzzle: `.storybook/main.ts` does **not** set
`browserTarget` -- it is on `project.json:83` and `:98`, pointing at
`build-storybook` self-referentially, which is why a `styles` entry never reaches
Storybook.

Carried forward:

- **SSR was never exercised against the Verdaccio-installed package**, so D016's
  actual concern -- the D014/D015 consumption isolation -- is **not** cleared.
  Ticket 13 owns it and must treat it as open.
- Host 6 used Express rather than `@nx/web:file-server`, due to a port collision
  with a sibling agent. Equivalent but not identical to the repo's own target.
- `@storybook/angular` pushes `zone.js` into polyfills although it is not
  installed; builds pass regardless. Untraced, style-unrelated.
