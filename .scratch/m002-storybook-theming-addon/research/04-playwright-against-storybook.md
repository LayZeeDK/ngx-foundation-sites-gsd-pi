# Running Playwright against Storybook in this Nx workspace

Ticket: `issues/04-playwright-against-storybook.md`
Status: resolved
Evidence date: 2026-08-11
Evidence mode: local source inspection + live browser probe against this repo's
own Storybook dev server (`nx run ngx-foundation-sites:storybook`, port 4400) +
upstream prior art fetched from `storybookjs/storybook`.

Legend: **[V]** verified in this repo or in installed source this session.
**[I]** inferred -- reasoned from verified facts, not directly observed.

---

## 1. The decisive answer

**`@storybook/test-runner` CANNOT drive manager-side addon panel controls. Not
with hooks, not with a custom `prepare`. A dedicated `@playwright/test` project
pointed at the Storybook URL CAN, and is the only option of the three that can.**

Recommended harness: **option (b/c) -- a dedicated `@playwright/test` project
whose `baseURL` is a served Storybook.** The static build (option b) and the dev
server (option c) are the same harness with a different server; pick the static
build for the default target (see section 5). Option (a) is not merely awkward,
it is architecturally excluded.

### 1.1 Why test-runner is excluded -- three independent proofs

**Proof 1: test-runner navigates to `iframe.html`, never to the manager. [V]**

`node_modules/@storybook/test-runner/dist/index.js`, `defaultPrepare`:

```js
const targetURL = process.env.TARGET_URL;
const iframeURL = new URL("iframe.html", targetURL).toString();
...
await page.goto(iframeURL, { waitUntil: "load" });
```

The Playwright `page` handed to every hook (`preVisit`, `postVisit`,
`preRender`, `postRender`) and to every generated story test IS the preview
document. There is no manager document anywhere in the browser context, so there
is nothing for `page.locator('#storybook-panel-root')` to find and no parent
frame to reach for.

**Proof 2: the preview document is empirically manager-free. [V]**

Live probe against `http://localhost:4400/iframe.html?id=nfsbutton--primary&viewMode=story`:

| Probe | Manager doc (`/?path=/story/...`) | Preview doc (`/iframe.html?...`) |
| --- | --- | --- |
| `#storybook-panel-root` count | 1 | **0** |
| `#storybook-panel-region` count | 1 | (n/a) |
| `#storybook-explorer-tree` count | 1 | **0** |
| `iframe#storybook-preview-iframe` count | 1 | **0** |
| `[role="tab"]` count | 4 (Controls, Actions, Interactions, Accessibility) | **0** |
| `page.frames().length` | 2 | **1** (itself) |
| `typeof globalThis.__STORYBOOK_PREVIEW__` | `undefined` | `object` |
| `typeof globalThis.__STORYBOOK_ADDONS_CHANNEL__` | `object` | (present) |

**Proof 3: overriding `prepare` to navigate to the manager instead breaks the
runner by construction. [V]**

`testRunnerConfig.prepare` does replace `defaultPrepare` outright, so you *can*
`page.goto(managerURL)`. But every generated story test then runs:

```js
result = await page.evaluate(({ id, hasPlayFn }) => __test(id, hasPlayFn), { id: ... });
```

and `dist/setup-page-script.js`'s `__test` immediately calls
`__waitForStorybook()` / reads `globalThis.__STORYBOOK_PREVIEW__.storyStore`.
The last row of the table above is the kill shot: `__STORYBOOK_PREVIEW__` is
`undefined` in the manager document. Every story would fail with the runner's
own "Timed out waiting for Storybook to load after 10 seconds" error.

Corollary, same file: the test wrapper explicitly treats a navigation away from
the preview as a fault -- it catches `Execution context was destroyed`, calls
`jestPlaywright.resetPage()` and re-runs `__sbSetupPage`. So even a *transient*
manager visit inside `postVisit` fights the harness rather than extending it. [V]

**What test-runner keeps.** It remains the right tool for what it already does
here (`.storybook/test-runner.ts`'s console-error gate, play functions, a11y
sweeps) -- everything whose subject lives inside one story's canvas. It is not
being replaced, only complemented.

### 1.2 Why a dedicated `@playwright/test` project works -- live proof

Probe against this repo's Storybook, driving `@storybook/addon-a11y` -- which
registers through `addons.add(PANEL_ID, { type: types.PANEL })` [V], the exact
same manager-entry mechanism M002's custom addon will use, making it a true
stand-in:

```
[A6 addon panel tab names] ["Controls\n7","Actions","Interactions\n5","Accessibility"]
[A8 a11y tab aria-selected] true            <- after page.getByRole('tab', {name:/Accessibility/}).click()
[A9 panel tabpanel text] "Violations 0 Passes 5 Inconclusive 0 No accessibility violations found."
```

And the full manager -> preview loop, which is the shape any theming-addon test
needs (change a manager control, assert rendered CSS in the canvas):

```
[B2 initial background-color] rgb(18, 97, 149)
   ... click #control-color-2 inside #storybook-panel-root's tabpanel ...
[B4 url after control change] http://localhost:4400/?path=/story/nfsbutton--primary&args=color:success
[B5 button class after change] button success
[B6 background-color after change] rgb(58, 219, 118)
```

Both the click target and the assertion target were reached from **one**
Playwright `page`: the panel via `page.locator(...)`, the canvas via
`page.frameLocator('#storybook-preview-iframe')`. [V]

Also verified: CSS injected into the preview document from that same page (the
mechanism a browser-Sass addon uses) is observable by the outer page's
locators. [V]

---

## 2. Prior art

The strongest prior art is Storybook's own Playwright suite -- it is not a
fringe pattern, it is how Storybook tests Storybook.

**`storybookjs/storybook` -> `code/e2e-sandbox/util.ts` (`SbPage` page object).**
This is the reusable artefact. Fetched and read in full this session. Core
manager accessors, verbatim:

```ts
previewIframe() { return this.page.frameLocator('#storybook-preview-iframe'); }
previewRoot()   { return this.previewIframe().locator('#storybook-root:visible, #storybook-docs:visible'); }
panelContent()  { return this.page.locator('#storybook-panel-root').getByRole('tabpanel'); }

async viewAddonPanel(name: string) {
  const tabs = this.page.locator('[role=tablist] div[role=tab]');
  const tab = tabs.locator(`text=/^${name}/`);
  await tab.click();
}
```

Plus `openComponent`, `navigateToStory`, `deepLinkToStory`, `waitUntilLoaded`,
`selectToolbar`, `closeAnyPendingModal`, `expandAllSidebarNodes`, `retryTimes`.

**`code/e2e-sandbox/addon-controls.spec.ts`** -- the canonical "drive a panel
control, assert the canvas" spec. Fills `textarea[name=label]` in the Controls
panel, then asserts `previewRoot().locator('button')` text and
`toHaveCSS('background-color', ...)`; clicks `[aria-label="Reset controls"]`.

**`code/e2e-sandbox/addon-a11y.spec.ts`** -- drives a *panel-registered addon*:
`viewAddonPanel('Accessibility')`, then
`panel.getByRole('button', { name: 'Rerun' })`,
`panel.getByRole('tab', { name: 'Violations' })`, and reads a deep link
containing `&addonPanel=storybook/a11y/panel`. Closest published analogue to
what M002 needs.

**`code/e2e-internal/open-service-sync.spec.ts`** -- an internal addon's own
panel, reached by `page.getByRole('tab', { name: /^Open Service/ })` then
`page.locator('#storybook-panel-root').getByRole('tabpanel')`. Shows the pattern
generalises to a first-party-but-not-core panel.

**`code/e2e-sandbox/manager.spec.ts`** -- pure manager UI: `[aria-label="Settings"]`,
`.sidebar-container`, `[data-item-id="example-button--primary"]`, keyboard
shortcuts (`Alt+s`, `Alt+a`), `#storybook-panel-root` visibility.

**`storybookjs/nextjs-server` -> `scripts/specs/basic.spec.ts`** -- a third-party
repo using the same idiom: `#storybook-panel-root #panel-tab-content` then
`textarea[name=label]`.

**Negative result worth recording:** a GitHub code search for third-party
*custom addon* repos with their own Playwright manager specs
(`viewAddonPanel playwright`) returned **zero** results. [V] Community addons
overwhelmingly test with Vitest/Jest on the panel component plus test-runner on
stories; the Storybook monorepo is effectively the only published corpus of
manager-driving Playwright specs. M002 should copy Storybook's own patterns
rather than look for an addon-author convention that does not exist.

---

## 3. Selectors and determinism

### 3.1 Stable manager selectors, verified against Storybook 10.5

Storybook's own `manager-api/modules/layout.ts` exports these as
`focusableUIElements` -- they are a deliberate, named contract, not incidental
DOM. Confirmed present in `node_modules/storybook/dist/manager/runtime.js` and
observed live: [V]

| Selector | What it is |
| --- | --- |
| `#storybook-panel-root` | addon panel tabs + tabpanel container (`storyPanelRoot`) |
| `#storybook-panel-region` | the panel `<aside>`, `role="region"`, name "Addon panel" |
| `#storybook-explorer-tree` | sidebar `<nav>`, `role="navigation"`, name "Stories" |
| `#storybook-explorer-searchfield` | sidebar search input |
| `#storybook-explorer-menu` | sidebar menu |
| `#storybook-show-addon-panel` | toolbar button that reveals the panel |
| `#storybook-sidebar-region`, `#storybook-show-sidebar` | sidebar region / reveal |
| `iframe#storybook-preview-iframe` | the preview iframe (for `frameLocator`) |
| `[data-item-id="<storyId>"]` | a sidebar node; also `data-selected`, `data-nodetype`, `data-ref-id`, `data-parent-id` |
| `#storybook-mobile-addon-panel` | mobile drawer (different DOM below 600px) |

Inside the preview: `#storybook-root` (story) / `#storybook-docs` (docs), and
the loading sentinels `.sb-preparing-story` / `.sb-preparing-docs`. [V]

**Role-based selectors work.** Panel tabs are real `[role="tab"]` with
`aria-selected` [V], so `page.getByRole('tab', { name: /Accessibility/ })` and
`page.locator('#storybook-panel-root').getByRole('tabpanel')` are both reliable
-- confirmed live in this repo.

**A custom addon's own controls are NOT covered by any of this.** [I, but
near-certain] Everything above is Storybook chrome. The contents of M002's panel
are whatever the addon renders. Note the built-in Controls panel in 10.5 uses
`#control-<argName>` / `name="control-<argName>"` (e.g. `#control-color-2`) [V]
-- and that Storybook's own spec still targets the older `textarea[name=label]`
shape, i.e. **the built-in Controls markup has drifted between versions**. The
addon must therefore ship its own explicit hooks (`data-testid` or accessible
names) rather than let tests reverse-engineer emotion-generated markup. That is
a design constraint on the addon, and belongs in the addon's own ticket.

**Deep-linking is a first-class affordance.** `?path=/story/<id>` selects a
story and `&addonPanel=<panelId>` preselects a panel [V, seen in Storybook's own
a11y deep-link spec]; `&args=color:success` seeds args and round-trips into the
URL on control change [V, observed live: `B4`]. Deep-linking beats sidebar
clicking for setup -- fewer moving parts.

### 3.2 Flake sources

Copy Storybook's own mitigations from `SbPage.waitUntilLoaded()`; they exist
because these flakes are real. [V, read from source]

1. **Layout state leaks between tests.** Storybook persists panel size/position
   in `sessionStorage['@storybook/manager/store']`. Their fix is an
   `addInitScript` seeding a known layout (`showToolbar`, `navSize: 300`,
   `bottomPanelHeight: 300`, `rightPanelWidth: 300`) before every test. Without
   it, a collapsed or resized panel from a previous run hides controls.
2. **CSS transitions.** They inject `*, *::before, *::after { transition: none !important; }`
   via `addStyleTag`. **This matters doubly here:** Foundation's `.button`
   carries `transition: background-color 0.25s ease-out, color 0.25s ease-out`
   (`node_modules/foundation-sites/scss/components/_button.scss:103`, via
   `$button-transition`) [V]. Any assertion on a themed colour is racing a
   250 ms animation.
3. **One-shot `getComputedStyle` reads are unsafe.** Observed directly this
   session: a bare `evaluate(el => getComputedStyle(el).backgroundColor)` read
   the pre-change value twice, while the same read on a settled page returned
   the new value. Use Playwright's auto-retrying `expect(locator).toHaveCSS(...)`,
   or `expect(async () => {...}).toPass()` -- which is exactly what Storybook's
   `addon-controls.spec.ts` does for every colour assertion. [V]
4. **Async story loading.** Wait for `.sb-preparing-story` / `.sb-preparing-docs`
   to be hidden, then for `previewRoot()` to have at least one child.
5. **Modals/popovers steal focus and scroll.** `closeAnyPendingModal()` presses
   Escape twice against `[role="dialog"]`.
6. **Mobile breakpoint.** Below 600 px the panel becomes
   `#storybook-mobile-addon-panel` and the sidebar drawer unmounts after
   navigation -- Storybook wraps its own `data-selected` assertion in a
   try/catch for this. Pin a desktop viewport (`devices['Desktop Chrome']`).
7. **Dev-server invalidation.** Storybook quarantines file-mutating specs into a
   serial project because HMR reloads other tests' pages mid-assertion. A static
   Storybook build has no such hazard -- another reason to prefer it.

---

## 4. What this repo reuses vs what must be new

### Reusable as-is

| Asset | Reuse |
| --- | --- |
| `ngx-foundation-sites:static-storybook` | **Directly.** Nx already reports it as `continuous: true` [V] and it `dependsOn: ["build-storybook"]`. It is a valid `dependsOn` for an e2e target exactly like nfs-demo's `serve*` targets. |
| `ngx-foundation-sites:build-storybook` | Transitively, via `static-storybook`. Cached (`nx.json` `targetDefaults`). |
| `@playwright/test ^1.37`, browsers installed | Already a root devDependency; Playwright 1.62.1 CLI and Chromium present locally [V]. Zero new dependencies. |
| `@nx/playwright/plugin` (`targetName: "e2e"`, in `nx.json`) | **Directly.** It globs `**/playwright.config.{js,ts,cjs,cts,mjs,mts}` and creates a project node at that file's directory with a cached `e2e` target running `playwright test` with `cwd: {projectRoot}` [V]. A new directory containing only a `playwright.config.ts` becomes an Nx project automatically. |
| `apps/nfs-demo/playwright-global-setup.ts` | **As a pattern, near-verbatim.** Its comment documents the exact trap to avoid: Playwright's own `webServer` spawning `nx run ...` nests Nx inside Nx ("Recursive task invocation detected"), and a `webServer` command that is merely a waiter dies with "Process from config.webServer exited early". Its poll-until-`fetch`-succeeds global setup is the proven answer in this workspace. |
| `apps/nfs-demo/playwright.config.ts` | As a shape reference (projects, `devices`, `NFS_DEMO_HOSTS`-style narrowing, `trace: 'on-first-retry'`). |
| `storybookjs/storybook`'s `SbPage` | As a pattern only -- do not vendor it (it imports `storybook/internal/csf` and their sandbox-templates module). Write a small local page object with the four accessors that matter. |

### Must be new

1. A **new Nx project** for the specs (see 5.1) -- a directory, a
   `playwright.config.ts`, a `project.json` (needed only for `dependsOn`), specs,
   and a small `sb-page.ts` helper.
2. A **local `SbPage`-equivalent** (~40 lines): `previewIframe()`,
   `previewRoot()`, `panelContent()`, `viewAddonPanel(name)`, `waitUntilLoaded()`.
3. **`data-testid`s / accessible names in the addon panel itself** -- a
   requirement on the addon, surfaced by this ticket, owned elsewhere.
4. **Port de-confliction with `test-storybook`** (see 5.3).

### Explicitly NOT reusable

`apps/nfs-demo/e2e/` cannot host these specs. Its whole premise is a
**Verdaccio-installed published package** consumed across a four-host matrix
(`apps/nfs-demo/package.json`, `apps/nfs-demo/node_modules`,
`verify-registry-consumption`). A Storybook addon is a **source-tree, dev-only**
surface with no published-package dimension, and its "hosts" are one Storybook,
not four Angular delivery mechanisms. Merging them would either drag the addon
specs through four irrelevant host projects or dilute nfs-demo's stated purpose.
Two projects, two premises.

---

## 5. Recommended wiring

### 5.1 Location -- a new sibling project

```
apps/nfs-storybook-e2e/
  playwright.config.ts
  project.json
  e2e/
    sb-page.ts
    <addon specs>
```

Rejected alternatives:

- **`packages/ngx-foundation-sites/playwright.config.ts`** -- the plugin would
  graft an `e2e` target onto the *publishable library* project [V, that is how
  `createNodesInternal` keys projects by `dirname(configFilePath)`]. It puts
  browser-test config inside a package whose `files`/exports discipline is
  already gated by `verify-exports-map`, and makes `nx run-many -t e2e` on the
  library ambiguous. Avoid.
- **`apps/nfs-demo/e2e/`** -- see section 4, wrong premise.

Naming mirrors Nx's own `<app>-e2e` convention and this repo's existing
`nfs-`-prefixed project names.

### 5.2 Target shape

Mirror `nfs-demo:e2e` exactly, substituting the Storybook server:

```jsonc
// apps/nfs-storybook-e2e/project.json
{
  "name": "nfs-storybook-e2e",
  "projectType": "application",
  "targets": {
    "e2e": {
      "executor": "nx:run-commands",
      "outputs": ["{projectRoot}/test-results"],
      "dependsOn": ["ngx-foundation-sites:static-storybook"],
      "parallelism": true,
      "options": { "cwd": "apps/nfs-storybook-e2e", "command": "playwright test" }
    }
  }
}
```

with `playwright.config.ts` carrying `baseURL: 'http://localhost:4400'`, a
`globalSetup` copied from `apps/nfs-demo/playwright-global-setup.ts`, and
`use: { ...devices['Desktop Chrome'] }`.

Notes:

- Declaring `e2e` explicitly **overrides** the plugin-inferred `e2e` target --
  precisely what `apps/nfs-demo/project.json` already does [V]. Necessary,
  because the inferred target only adds `dependsOn` when the Playwright config
  has a `webServer` entry with `reuseExistingServer` whose command parses as
  `nx run <project>:<target>` [V, `getWebserverCommandTasks` /
  `parseTaskFromCommand`]. That `webServer` route is available [I] but it
  re-opens the nested-Nx hazard the nfs-demo global setup was written to avoid;
  prefer the proven `dependsOn` + polling-globalSetup split.
- One browser engine only. The multi-engine split in `nfs-demo` exists because
  logical-property mirroring is a CSS *engine* claim; a Storybook addon's
  behaviour is not, so Chromium alone is right here.

### 5.3 Server: static build, and the port collision to resolve

Use `static-storybook` (port 4400, `spa: true`, serves
`dist/storybook/ngx-foundation-sites`) rather than the dev server:

- It is already `continuous: true` and cached through `build-storybook` [V].
- No HMR/dev-server invalidation flake (section 3.2 item 7).
- It exercises the artefact `test-storybook` already exercises, so the two lanes
  agree on the thing under test.
- Deep links need no SPA fallback anyway: Storybook routes via the `?path=`
  **query string**, so `/` alone serves the manager [V].

Not verified: the probes ran against the **dev** server. The manager bundle is
the same `storybook/dist/manager/runtime.js` in both, so the selectors carry
over [I, high confidence] -- but a first execution of the chosen specs against
`static-storybook` should be treated as the confirmation step.

**Port collision, flagged.** `test-storybook` starts its *own* copy of
`static-storybook` through `concurrently`, also on 4400 [V,
`project.json:167`]. Two options:

- (a) Refactor `test-storybook` to the same `dependsOn: ["ngx-foundation-sites:static-storybook"]`
  + wait pattern, dropping `concurrently`. Nx then deduplicates one server for
  both lanes. Cleanest, and removes the `concurrently`/`wait-on` layer.
- (b) Give the new target its own port via a `static-storybook` configuration.
  Lower blast radius, one more port to remember.

Either is fine; (a) is the tidier end state. Whichever is chosen, `nx run-many`
across both targets must not race two servers onto 4400.

---

## 6. R021's Vitest half, by contrast

Scoping note: **the actual split of what is tested where is ticket 10's call.**
What follows is only the capability boundary this ticket establishes, so ticket
10 has a floor and a ceiling to work from.

**Playwright's exclusive reach** -- things no Vitest lane can observe:
the manager document existing at all; panel registration and tab presence;
manager-to-preview channel round-trips; the composed cascade of addon-injected
CSS against the library's `@layer nfs-defaults` inside a real Storybook preview;
preset-selection state reflected in the real panel; deep-link/URL state.

**Vitest's exclusive reach** -- things Playwright should not be asked to prove:
Sass compilation input/output (given variables, is the emitted CSS right);
preset-equality logic ("selected only when every control matches exactly" --
pure comparison over a resolved control set); control-value normalisation;
compile-error mapping; the panel component's own rendering given props.

**One correction to the ticket's framing.** The ticket contrasts Playwright with
"Vitest (pure compilation/logic, no browser)". That is not this repo's shape:
`ngx-foundation-sites` has **two** Vitest lanes [V] --

- `test` (`@nx/angular:unit-test`, excludes `**/*.browser.spec.ts`) -- jsdom.
- `test-browser` (`@nx/angular:unit-test`, `browsers: ["ChromiumHeadless"]`,
  includes `**/*.browser.spec.ts`) -- **real Chromium via Vitest browser mode**,
  already used by `nfs-button.hydration-modes.browser.spec.ts` precisely because
  jsdom could not reproduce real event dispatch and dynamic-import timing.

So "no browser" is the wrong axis. The real axis is **"no Storybook manager"**:
`test-browser` can host a real DOM and real CSSOM (so browser-Sass compilation
and cascade behaviour in isolation are legitimately reachable there), but it
cannot host Storybook's manager, its addon channel, or its preview iframe.
Playwright's exclusive claim is *Storybook*, not *browser*. Ticket 10 should
draw its line there, and should consider `test-browser` a third destination
rather than assuming a binary.

---

## 7. Verified / inferred ledger

**Verified this session**

- `defaultPrepare` navigates to `iframe.html`; `__test` requires
  `globalThis.__STORYBOOK_PREVIEW__`; the wrapper treats navigation-away as a
  fault (`@storybook/test-runner` 0.24.4 installed source).
- The preview document contains zero manager elements, zero `[role="tab"]`, one
  frame, and has `__STORYBOOK_PREVIEW__`; the manager document has
  `__STORYBOOK_ADDONS_CHANNEL__` but **not** `__STORYBOOK_PREVIEW__`.
- Playwright clicks a manager addon-panel tab (addon-a11y), reads its tabpanel,
  drives a panel control, and observes the resulting computed style in the
  preview iframe -- all from one `page`.
- `addons.add(PANEL_ID, { type: types.PANEL })` is addon-a11y's registration.
- The `focusableUIElements` selector set exists in Storybook 10.5's manager
  runtime and resolves live.
- Foundation `.button` has a 0.25 s `background-color` transition.
- One-shot `getComputedStyle` reads returned stale values; settled reads did not.
- `static-storybook` is `continuous: true`; `test-storybook` starts a second
  copy on the same port 4400.
- `@nx/playwright/plugin` creates a project at any `playwright.config.*`'s
  directory; `dependsOn` inference requires a `webServer` + `reuseExistingServer`
  + an `nx run`-shaped command.
- The repo already has a real-Chromium Vitest browser lane (`test-browser`).
- GitHub code search finds no third-party custom-addon repo with Playwright
  manager specs.

**Inferred, not observed**

- The static Storybook build's manager exposes the same selectors as the dev
  server's (same bundle) -- confirm on first run of the new target.
- The `webServer` + `reuseExistingServer` route to plugin-inferred `dependsOn`
  would work here; untested, and it re-opens a hazard the repo already routed
  around.
- The addon's own panel controls will need explicit test hooks -- reasoned from
  the observed drift in built-in Controls markup between Storybook versions.
