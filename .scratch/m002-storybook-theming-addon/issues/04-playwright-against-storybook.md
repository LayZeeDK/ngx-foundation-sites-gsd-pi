# Running Playwright against Storybook in this Nx workspace

Type: research
Status: resolved
Blocked by: --

## Question

R021 requires the addon be verified by "Vitest unit tests **and Playwright e2e
tests exercising it in Storybook**". Today this workspace has neither shape:
Playwright runs only in `apps/nfs-demo/e2e` against a Verdaccio-installed
package, and Storybook is tested by `@storybook/test-runner` (which is
Playwright-backed but is a different harness with different affordances).

What is the right way to run `@playwright/test` against this repo's Storybook?

1. **Harness options.** Compare (a) extending `@storybook/test-runner` with
   custom hooks, (b) a dedicated `@playwright/test` project pointed at the
   static Storybook build, (c) a Playwright project against the Storybook dev
   server. Which can drive **manager-side UI** -- clicking addon panel controls
   -- as opposed to only visiting story iframes? This is the decisive question:
   `test-runner` visits stories in the preview iframe, and an addon's controls
   live in the manager.
2. **Existing wiring to reuse.** This repo already has: a `static-storybook`
   target, a `test-storybook` target orchestrating `concurrently` + `wait-on`,
   `@nx/playwright`, and an e2e setup in `apps/nfs-demo`. What does a new
   Storybook-targeted Playwright project reuse, and what must be new? Where
   should it live -- inside `packages/ngx-foundation-sites`, in `apps/`, or a
   new project?
3. **Prior art.** How do other projects e2e-test a custom Storybook addon's
   manager UI? Search GitHub for Playwright specs that drive Storybook's
   manager (addon panels, toolbar items) rather than just story canvases.
4. **Determinism.** Storybook's manager UI is React with async story loading.
   What selectors/waits are stable -- test ids, ARIA roles, Storybook's own
   `#storybook-panel-root`? What are the known flake sources?

Deliver a findings document recommending one harness with the concrete Nx target
wiring it implies, and naming what R021's "Vitest" half should cover by contrast
(pure compilation/logic, no browser).

## Notes

Do not decide the split of *what* is tested here -- that is ticket 10. This
ticket answers *how a Playwright test can reach the addon at all*, which
ticket 10 depends on.

## Answer

Full findings: `../research/04-playwright-against-storybook.md`.

**`@storybook/test-runner` cannot drive manager-side addon panel controls.** A
dedicated `@playwright/test` project pointed at a served Storybook is the only
viable harness. Three verified proofs:

1. `defaultPrepare` in the installed test-runner 0.24.4 does
   `page.goto(new URL("iframe.html", TARGET_URL))` -- the `page` handed to every
   hook *is* the preview document.
2. Live probe of the preview document: 0 `#storybook-panel-root`, 0
   `[role="tab"]`, 1 frame (itself). The manager document has all of them.
3. The `prepare` escape hatch is a dead end -- story tests call `__test(id)`,
   requiring `globalThis.__STORYBOOK_PREVIEW__`, verified `undefined` in the
   manager document. The runner also treats navigation-away as a fault and
   resets the page.

**The recommended harness was proven live in this repo**, not just reasoned
about: against `nx run ngx-foundation-sites:storybook`, an agent clicked the
Accessibility panel tab (addon-a11y registers via
`addons.add(PANEL_ID, {type: types.PANEL})` -- the same mechanism M002's addon
will use), read its tabpanel, then drove a Controls input and observed the
canvas restyle `rgb(18,97,149)` -> `rgb(58,219,118)`. Panel via `page.locator`,
canvas via `page.frameLocator('#storybook-preview-iframe')` -- one page, both
sides.

**Wiring:** new project `apps/nfs-storybook-e2e/` with an `e2e` target
(`nx:run-commands` running `playwright test`), `dependsOn:
["ngx-foundation-sites:static-storybook"]` (verified `continuous: true`), plus a
copy of nfs-demo's polling `globalSetup`. Reuses `static-storybook`,
`@playwright/test`, `@nx/playwright/plugin` -- **zero new dependencies**. New:
the project dir, a ~40-line local `SbPage`, and `data-testid`s in the addon
panel. `apps/nfs-demo/e2e/` is NOT reusable -- its premise is a
Verdaccio-installed package across four hosts, the wrong shape.

**Prior art:** Storybook's own Playwright suite is the corpus --
`code/e2e-sandbox/util.ts` (`SbPage` with `panelContent()`,
`viewAddonPanel()`, `previewIframe()`), plus its `addon-controls`,
`addon-a11y`, `manager` and `open-service-sync` specs. Notable negative: a
GitHub search found **zero** third-party custom-addon repos with
manager-driving Playwright specs. Copy Storybook; there is no addon-author
convention to follow.

**Hazards carried forward:**

- **Port collision.** `test-storybook` starts its own `static-storybook` on
  port 4400 via `concurrently`. The two lanes will collide. Cleanest fix is
  refactoring `test-storybook` onto the same `dependsOn` pattern -- a change to
  existing wiring, so it belongs in ticket 11's hand-off, not silently in the
  new target.
- **Transition flake.** Foundation's `.button` carries a 0.25s
  `background-color` transition; one-shot `getComputedStyle` reads returned
  stale values twice during probing. Assertions must use auto-retrying
  `toHaveCSS`/`toPass`, and specs should adopt Storybook's own mitigations
  (seed `sessionStorage['@storybook/manager/store']`, disable transitions).

**Left unverified, by design:** probes ran against the **dev** server. The
static build ships the same manager bundle, so a first run of the new target
against `static-storybook` is the confirmation step -- ticket 10 should require
it rather than assume it.
