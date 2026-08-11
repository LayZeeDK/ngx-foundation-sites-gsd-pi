# M002: Storybook theming addon

Label: `wayfinder:map`

## Destination

Every architecture decision M002 needs is **locked with evidence**, and M002's
requirements (R009, R021) are sharpened from one-line wishes into text a GSD
planning pass can decompose into slices. The map ends where `/gsd plan M002`
picks up.

The thing being decided: a **Storybook addon that compiles Foundation's Sass in
the browser** (via the `sass` package's browser build, supported since Dart Sass
1.63) and exposes live controls for a curated variable set -- palette colors
(primary / secondary / success / alert / warning) and radius -- so a designer or
developer can retheme without a rebuild.

Done looks like: a preset selector (Foundation default, WCAG-compliant) seeds
the curated controls; controls stay tweakable after seeding; a preset reads as
"selected" only when every control's live value matches that preset exactly.
Verified per R021 with Vitest (compilation / logic) and Playwright (in-Storybook
browser behavior).

**Execution is OUT of scope.** This map produces locked decisions and
requirement text, not built code. GSD owns M002's execution -- it is a `queued`
milestone with 0 slices, and decomposing it is `/gsd plan M002`'s job.

## Notes

**Domain.** Angular 22 publishable library in an Nx monorepo (ng-packagr,
`@nx/angular:package`), skinning Foundation for Sites 6.9.0 via its real Sass
mixins. Storybook 10.5 (`@storybook/angular`) is the primary component
dev/test surface, built with **webpack 5** (`@storybook/builder-webpack5`) --
*not* Vite; ticket 03 corrected this premise, and it invalidates any
Vite-specific technique (`?raw`, `import.meta.glob`). `sass ^1.102.0`,
`@playwright/test ^1.37`, `vitest ^4.0.8`, `@storybook/test-runner ^0.24.4` are
already dependencies.

**Verification lanes.** There are **three**, not two (ticket 04's correction):
`test` (Vitest, jsdom), `test-browser` (Vitest, real Chromium -- already used
for hydration specs), and a new Playwright lane for anything touching
Storybook's manager UI. The axis that matters is "can it reach the Storybook
**manager**", not "is there a browser".

**No human in the loop.** By explicit user instruction, no ticket may ask the
user to decide. There are therefore no `grilling` tickets. Every ticket is
`research` (including synthesis/decision tickets, resolved AFK), `prototype`
(agent-driven -- the agent builds the artifact and resolves the ticket by
measuring or inspecting it, rather than a human reacting to it), or `task`.

**Decision-locking authorities.** A decision ticket may close on evidence from
any of these alone:

- `.gsd/` artifacts -- `REQUIREMENTS.md`, `DECISIONS.md`, `PROJECT.md`,
  `ROADMAP.md`, `STATE.md`, and `.gsd/phases/`. **Read-only**: these are
  projected from a database. Never write or edit them; use the `gsd-workflow`
  MCP to read canonical state.
- Local clones under `d:/projects/github/<owner>/<repo>` -- notably
  `LayZeeDK/ngx-foundation-sites-next` (the addon R009 names as its reference,
  confirmed present), `foundation/foundation-sites`, `angular/angular`,
  `storybookjs/storybook` if cloned.

**`ngx-foundation-sites-next` shapes REQUIREMENTS ONLY -- no code-copying.**
Standing user instruction, and it binds every ticket that touches the reference.
Read it to answer *what the addon must do and which decisions it had to make* --
which variables were worth exposing, how presets behaved, what went wrong. Do
**not** lift its implementation, file layout, component code, or config into
this repo, and do not let "that is how next did it" stand as an architecture
justification on its own. Findings from it are stated as capability and
constraint, never as a diff to apply.
- Web / GitHub prior art. Explicitly in scope by user instruction: search for
  existing Sass-in-browser Storybook theming addons rather than assuming this
  is unprecedented.

**Fetch fallback chain** for any ticket fetching URLs (try each until one
works): 1. `markdown.new` -- POST JSON `{"url": "<target_url>", "method":
"auto", "retain_images": true}` to `https://markdown.new/`. 2. WebFetch.
3. `node D:\projects\github\LayZeeDK\lz-cybernetics-ai-plugins\tools\url-to-markdown\url-to-markdown.mjs <url> --output <path>`.
4. `playwright-cli`. 5. For known-blocked domains (npmjs.com, code.claude.com,
Cloudflare sites) skip straight to the working tool. Never declare a URL failed
after one method.

**Search tooling.** Never use the Grep tool or `grep`. Use `git grep` for
tracked files, `rg` for anything gitignored (`node_modules/`, `dist/`,
`.nx/`, `.angular/`). Pipe filters are `| rg`, never `| grep`.

### Ground truth from M001 and M003

M002 builds on **M003's** architecture, not M001's. M001's summary is
historically accurate but architecturally superseded -- do not treat its
`key_files` as current.

- **M001 (complete, 15 slices)** delivered the Nx workspace and `NfsButton`,
  styled through a CSS-in-JS runtime loader: `nfs-button.styles.ts`,
  `NfsStyleLoader` (ref-counted), `NfsStyleExtractor` (SSR critical CSS).
  **All of that is deleted.**
- **M003 (complete, 6 slices)** replaced it with a compiled SCSS pipeline:
  Angular's native `styleUrl` + `ViewEncapsulation.None` + `SharedStylesHost`.
  ESLint rule **R026** bans reintroducing CSS-in-JS, with an executable test
  proving the rule fires. RTL is logical-properties-only (no `[dir]`, no
  rtlcss). `verify-exports-map.mjs` is a build-wired Nx gate.

**The public theming API M002 must drive** is
`packages/ngx-foundation-sites/src/scss/_button.scss`, exported as
`ngx-foundation-sites/scss/button`. It is a **theme mixin, not module
configuration**:

```scss
@include nfs-button.theme(
  $selector: '.button',   // scoped/additional theme
  $background: null,      // primary fill; hover derived by Foundation's scale-color
  $palette: null,         // MERGED over defaults; secondary/success/warning/alert
  $radius: null
);
```

The file emits nothing on load, and can be invoked twice in one compilation --
both properties M002's preset/live-tweak model depends on. Its output is
**unlayered on purpose**, so it beats the component's own
`@layer nfs-defaults` default regardless of DOM insertion order (R008).

**The curated control set maps 1:1 onto this existing API** -- primary =
`$background`, the other four = `$palette` keys, plus `$radius`. Confirmed: no
public Sass API extension is needed to build the addon as described.

### Standing constraints M002 inherits

- **D020** (human, standing): SCSS variable theming **only**. No CSS custom
  property theming surface. Exactly one theming mechanism -- Sass variables --
  with two places compilation can happen: the consumer's build, or the browser.
  M002 *is* that second place. The constraint forbids the mechanism, not the
  runtime-theming capability.
- **D023** (human, standing): Foundation's default theme ships unchanged. A
  WCAG/axe-compliant theme **ships in M002**, and the axe suite runs against it
  for its zero-violations proof. The default theme keeps an exact
  expected-failure assertion for its three known shortfalls (alert fill 4.498,
  hollow success 1.799, hollow warning 1.842) -- never a blanket suppression.
- **R008**: consumer-authored theme output must win the cascade over library
  defaults.
- **R019**: publishing `packages/` to npm is deferred -- explicitly not in
  scope for M001 or M002.
- **R026**: no CSS-in-JS. Note the tension worth naming: the addon injects
  browser-compiled CSS through JavaScript. R026 bans a *hand-fed CSS string
  shipped as the component's styling source*; it does not obviously ban a
  dev-only Storybook addon injecting compiled output. Ticket 09 must state
  where that line falls rather than assume it.

### Correction to the founding brief

The brief assumed M002's WCAG preset could be "sourced verbatim from M003's
already-proven compliant theme, no duplicated values." **There is no such
artifact to source from.** M003's compliant theme exists only as a hand-written
invocation in the demo app plus prose in README's Accessibility section:

```scss
// apps/nfs-demo/src/styles.scss:27
@include nfs-button.theme(
  $selector: '.theme-compliant',
  $palette: (success: #238648, warning: #9e6c00, alert: #cb4b37)
);
```

The library ships nothing. So D023's "a compliant theme ships in M002" is
**not** discharged, and M002 must *create* the single source rather than
reference one. That is ticket 07. The duplication is worse than first recorded:
ticket 01 counted the palette restated across **five tracked files**, and found
the reference project carrying *three mutually inconsistent* compliant palettes
at HEAD -- the exact drift ticket 07 exists to prevent.

Note the preset shape this implies: the compliant preset overrides only
success / warning / alert, and inherits Foundation's defaults for primary,
secondary and radius. So "WCAG preset" = "Foundation default preset + 3
overrides" -- expressible in the curated control set, but it means preset
equality checks compare a full resolved control set, not a sparse override map.

## Decisions so far

<!-- one line per closed ticket -->

- [Prior art: how next themed, and what the ecosystem already built](issues/01-prior-art-next-and-ecosystem.md)
  -- **prior art is thin, and that is the answer**: zero Storybook addons
  compile Sass in the browser, and no first-party design system (Carbon,
  Spectrum, Fluent, Polaris, SLDS) ships a compiler -- all chose the CSS
  custom-property mechanism D020 forbids. The one architectural precedent
  (`storybook-addon-customize-antd-theme`, browser-compiled Less) has been
  stranded since 2021, and Ant Design Pro published why it regretted the
  approach. The reference's worker pool, style-suppression stack and Sass regex
  rewriting are all inapplicable here.
- [Storybook 10 custom addon anatomy](issues/02-storybook-10-addon-anatomy.md)
  -- a workspace-local unpublished addon **can** be wired by relative path
  (verified three ways), so ticket 06's decision is open rather than forced;
  `.storybook/manager.ts` auto-discovery makes the floor 2 files and zero
  config. **Globals** is the confirmed state mechanism, with three constraints
  (undeclared keys silently dropped, shallow merges, URL round-trip rejects
  `0.5rem`). A green build is NOT proof the addon loaded.
- [Dart Sass in the browser: what is actually supported](issues/03-dart-sass-in-the-browser.md)
  -- **feasible, proven by execution**: the real `theme()` chain compiled to 5842
  bytes from a pure in-memory string map on the browser code paths. The importer
  API treats `@import` and `@use` identically (14/17 calls `fromImport: true`,
  all resolved). Costs: ~916 KiB gzip `sass` bundle, 150-215 ms blocking per
  compile, and the Dart Sass 3.0.0 `@import` removal clock is inherited.
- [Running Playwright against Storybook in this Nx workspace](issues/04-playwright-against-storybook.md)
  -- `@storybook/test-runner` **cannot** reach manager-side addon panels (its
  `page` is the preview iframe, proven three ways); R021's Playwright half needs
  a dedicated `@playwright/test` project at `apps/nfs-storybook-e2e/` with
  `dependsOn: ngx-foundation-sites:static-storybook`, zero new dependencies,
  harness proven live in this repo against the real addon-a11y panel.

## Not yet specified

- **Recompile trigger and loading/error UX.** Debounce policy, whether
  compilation is sync or worker-backed, what the panel shows mid-compile or on
  a Sass error. Cannot be phrased sharply until ticket 05 measures real compile
  latency.
- **Preset extensibility and persistence.** Whether users can save their own
  presets, and whether control state survives a Storybook reload or story
  switch.
- **Behavior as more `nfs-*` components land.** `theme()` is button-only today.
  Whether the addon's control surface is per-component or global, and what the
  addon does with a component that has no theme mixin yet.
- **D023's axe obligation under a preset model.** Half of this cleared: ticket
  02 verified addon CSS **does** survive `build-storybook`, so `test-storybook`
  will see it. What remains foggy is what "the axe suite runs against the
  compliant theme" means once the compliant theme is a *selectable preset*
  rather than a compiled stylesheet -- possibly re-pointing the existing
  `@storybook/addon-a11y` scan or the `nfs-demo` axe fixture. Ticket 10 owns
  deciding it once ticket 07 has created the source.
- **Docs surface.** README and Storybook docs coverage for the addon, and
  whether `verify-autodocs-coverage` should extend to it.

## Out of scope

- **Publishing the addon (or anything else) to npm** -- R019 defers publishing
  for M001 and M002. Delivery-shape decisions stop at "does it live in a
  publishable directory", never at "ship it".
- **Extending `theme()`'s public Sass API** beyond `$selector` / `$background` /
  `$palette` / `$radius`. The curated control set maps 1:1 onto what exists;
  font-size, padding and hover-lightness controls would need API growth and are
  ruled out of this effort.
- **CSS custom property theming** -- forbidden by D020.
- **Building M002.** GSD owns execution. This map hands off to
  `/gsd plan M002`.
