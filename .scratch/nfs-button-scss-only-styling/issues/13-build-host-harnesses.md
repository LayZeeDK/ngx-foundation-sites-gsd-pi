# Stand up every host configuration as a real, runnable verification target

Type: task
Status: resolved
Blocked by: 08, 12

## Question

Ticket 12 establishes how styles behave in each host; this ticket makes each host
a *gate*, not just a research finding.

Two of the six already run and need only to be kept green -- Storybook's dev
server (`nx run ngx-foundation-sites:storybook`) and its static build plus
test-runner (`build-storybook` + `test-storybook`). `apps/nfs-demo` covers exactly
one more: the Vite dev server in CSR mode via `nx serve`, with Playwright pointed
at it. Build the three that are missing:

1. **SSR production-like host** -- `@angular/ssr` + Express (both already root
   dependencies). Production build, real server render, real hydration.
2. **Static-serve production-like host** -- production `ng build` output served
   by a plain static file server. `@nx/web:file-server` is already used by the
   `static-storybook` target and is the obvious reuse.
3. **Dev server in SSR mode** -- the same Vite dev server with SSR enabled.

Constraints that make this harder than it looks:

- **D014 / D015 isolation must survive.** `apps/nfs-demo` deliberately consumes
  the **Verdaccio-published** package, not workspace source: it sits outside the
  root `workspaces` glob, has its own `.npmrc` pointing at
  `http://localhost:4873`, and its tsconfig must not inherit
  `tsconfig.base.json`'s `ngx-foundation-sites` path mapping. Adding SSR
  configuration is exactly the kind of change that silently reintroduces source
  resolution. Verify after wiring that each host still resolves the built
  package -- `apps/nfs-demo/scripts/verify-registry-consumption.mjs` already
  exists for this.
- **This supersedes D016**, which ruled a real Express/Node SSR host out of
  M001. Do not treat D016 as a blocker; do read it first, because its stated
  reasons name real risks (mainly the fragility above). Ticket 12 already proved a
  real Express SSR host runs and behaves identically on styles -- but it ran against
  **workspace source**, never the Verdaccio-installed package, so **D016's actual
  concern is still open and this ticket owns it.** That is the single highest-risk
  item here: it is exactly the combination D014/D015 were written to prevent.
- Ticket 12's incidental finding will bite when wiring Storybook: `.storybook/main.ts`
  does **not** set `browserTarget` -- it sits on `project.json:83` and `:98` pointing
  at `build-storybook` self-referentially, which is why a `styles` entry never reaches
  Storybook. And a plain `import './x.scss'` in `.storybook/preview.ts` silently
  no-ops in dev and hard-fails `build-storybook`; the working paths are
  `preview-head.html` or a `styles` entry on both Storybook targets.
- Prefer reusing the existing Playwright suite against each host over writing
  three copies of the same assertions. The Playwright config supports multiple
  projects/webServers -- parameterise the host, keep one set of assertions.
- Storybook needs no new scaffolding, but if ticket 06's architecture requires
  consumer-visible style wiring (a global stylesheet import rather than
  `styleUrl`), then `.storybook/preview.ts` becomes part of that contract and
  must be wired here too -- and that wiring is itself a documentation obligation
  for ticket 11.

Deliverable: every host runnable as an Nx target or Playwright project, with the
existing style/theming/RTL/a11y assertions running against each.

## Answer

Six commits on `feat/scss-only-button-styling`. **All six hosts pass.**

| # | Host | Invocation | Result |
|---|---|---|---|
| 1 | SSR production (`@angular/ssr` + Express) | `nx run nfs-demo:serve-ssr-node` (4202), e2e project `ssr-node` | 6/6. Real per-request render: HTTP 200, server-rendered `class="button"`, one `<style ng-app-id="ng">` carrying `@layer nfs-defaults`, 12 `ngh=` annotations |
| 2 | Static-serve production (`@nx/web:file-server`) | `nx run nfs-demo:serve-static` (4201), project `static-csr` | 6/6 |
| 3 | Dev server, CSR | `nx run nfs-demo:serve` (4200), project `dev-csr` | 6/6 |
| 4 | Dev server, SSR | `nx run nfs-demo:serve-ssr` (4203), project `dev-ssr` | 6/6 |
| 5 | Storybook dev server | `nx run ngx-foundation-sites:storybook` | PASS; interaction runner against the live dev server 16/16 |
| 6 | Storybook static + test-runner | `nx run ngx-foundation-sites:test-storybook` | 16/16, 2 suites |

`nx run nfs-demo:e2e` is 24 passed (4 hosts x 6 specs), green twice; `NFS_DEMO_HOSTS=ssr-node`
narrows it. All pre-existing gates still exit 0 on the final state: lint (both projects),
`test` 43/43, `test-browser` 2/2, `build`, `build-storybook`.

### D016's real concern is closed with evidence

`nx run nfs-demo:verify-registry-consumption` passes and now covers the **SSR** output as
well as the CSR one. Verdaccio-installed, non-symlinked, and neither `dist/apps/nfs-demo`
nor `dist/apps/nfs-demo-ssr` (browser **and** server bundle) contains a monorepo source
path. No host fell back to source.

**Two latent defects in that gate were found and fixed while wiring it -- it was on the
verge of passing for the wrong reason:**

1. **The install could silently keep the previous build.** The proof version is a fixed
   string, so republishing swaps the tarball behind a version the app lockfile pins by
   integrity hash, and npm satisfied it from cache. Observed directly: after ticket 08's
   SCSS rename, `apps/nfs-demo/node_modules` still held the old `scss/nfs-button.scss`
   layout. Fixed by dropping the lockfile entry before `npm install --prefer-online`.
2. **The anti-vacuity needle matched nothing.** `NfsButton` is mangled by production
   minification, and the `nfs-button` literal left with ticket 09's deletion -- so the
   check was about to become vacuous. Now asserts the `nfsButton` attribute selector.

That is the third vacuous-or-nearly-vacuous gate this effort has found, after R004's RTL
spec and `verify-parity.mjs`.

### One app, not two -- and the reasoning inverted the fog's framing

The map framed this as "SSR adds isolation surface, so maybe a second app". The evidence
went the other way: **SSR did not add isolation surface, it exposed a duplication hazard
that already existed.** `apps/nfs-demo` declared its own `@angular/*`, so its isolated
install held a second physical framework copy. The application builder resolves
`@angular/ssr` from the **workspace root** when injecting server manifests, so the SSR
build mixed two `@angular/core` instances and died in route extraction with
`NG0201 No provider found for InjectionToken PlatformDestroyListeners`. Removing the local
`@angular/*` (plus `legacy-peer-deps=true`, or npm reinstalls `@angular/core` as an
auto-installed peer) fixed it.

D014/D015 concern `ngx-foundation-sites`, which is untouched: still outside the workspaces
glob, still its own `.npmrc`, still no inherited path mapping, still a real extracted
tarball. A second app would have duplicated all three isolation artifacts **and** this
hazard, for nothing; the SSR delta is four small files plus one build target.

### Findings

- **`RenderMode.Server` must be explicit -- and this corrects ticket 12.** With bare
  `provideServerRendering()` the builder prerenders `/` and Express serves the file
  (`prerendered-routes.json` listed `/`, `browser/index.html` shipped pre-rendered). So
  ticket 12's "working reference" SSR shape was verifying **SSG, not SSR**. Its style
  conclusions still hold -- they were about `<style ng-app-id>` emission and adoption,
  which both modes share -- but its host 1 and host 4 rows described a prerender path.
  Host 1 is now a genuine per-request render, evidenced by the `ngh=` annotations.
- **`AngularNodeAppEngine` must be constructed lazily.** The `@schematics/angular` template
  builds it at module scope; it reads the build-injected app-engine manifest in an instance
  field initializer, and the builder's own route extractor imports `server.ts` before that
  manifest is set.
- **Playwright must not own these servers.** `@nx/playwright/plugin` turns
  `nx run <project>:<target>` webServer commands into `dependsOn` tasks; Playwright
  spawning them too nests Nx in Nx and trips `Recursive task invocation detected` on
  `compile-default-css`, with four siblings racing the same build outputs. Nx owns them as
  continuous tasks (needs `parallelism: true` on `e2e`) and a `globalSetup` polls for
  readiness.
- Express 4 vs 5: the schematic's `app.listen(port, (error) => ...)` does not type-check
  against this repo's express 4.
- **Environment hazard, left unfixed and outside this ticket:** the `local-registry` Nx
  target is broken here. `@nx/js:verdaccio` aborts on
  `yarn config set unsafeHttpWhitelist --json '["localhost"]' --home` (yarn 4 rejects it)
  and returns without leaving Verdaccio up -- **after** writing
  `registry=http://localhost:4873/` into the **user** `~/.npmrc`, which it never restores.
  The agent ran Verdaccio directly and restored the user npmrc to
  `https://registry.npmjs.org/`. Consequence:
  `verify-registry-consumption.mjs`'s auto-start path does not work on this machine.
- Storybook needed no changes; `.storybook/preview.ts` and the `browserTarget` entries were
  not touched.
- Pre-existing, left alone: `apps/nfs-demo/src/app/app.component.ts` and
  `scripts/verify-registry-consumption.mjs` fail `prettier --check` at HEAD (Prettier is
  not wired into `lint`), plus two eslint warnings in the demo project.
