# Delivery shape: workspace-local addon or publishable package? -- findings

Resolves ticket `.scratch/m002-storybook-theming-addon/issues/06-delivery-shape.md`.
Status: **resolved, decision LOCKED** (AFK -- no human in the loop, per map.md Notes).

## Evidence key

- **[V-REPO]** -- verified by reading a tracked file in THIS repo (path + line cited).
- **[V-EXEC]** -- verified by executing a read-only command in this repo, output quoted.
- **[V-SRC]** -- verified by reading shipped `node_modules` source.
- **[V-PRIOR]** -- carried from ticket 02 / 03 / 04's own verification, cited.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

No code was changed. Only `.scratch/` was written. One throwaway lint probe was
created under `.scratch/` and deleted after use (its source is inlined in
section 5 so the check is reproducible).

---

## 1. THE LOCKED DECISION

> **The M002 theming addon ships as workspace-local Storybook tooling resident
> inside `packages/ngx-foundation-sites/.storybook/`, entry points auto-discovered
> by Storybook (`.storybook/manager.ts` manager-side, the existing
> `.storybook/preview.ts` preview-side) -- ticket option 1. No new package, no
> `addons: []` wiring, no `local-preset.ts`, and no change to
> `packages/ngx-foundation-sites/package.json`, its `exports` map, or the
> `verify-exports-map` gate.**

One honest correction to the ticket's framing of option 1: it is **2 files and
*near*-zero config**, not literally zero. "Zero config" holds only while every
preview-side addon module sits flat in `.storybook/` itself, because
`.storybook/tsconfig.json`'s `include` currently lists `"*.ts"` -- a
**non-recursive** glob [V-REPO: `packages/ngx-foundation-sites/.storybook/tsconfig.json:14`].
The moment a preview-side module lands in a subdirectory (`.storybook/theming/`),
one `include` line must be added or `@ngtools/webpack` hard-fails
[V-PRIOR: research/02 section 4, `[V-BUILD]`]. Budget that one line; do not
plan around a zero that will not survive contact with tickets 07 and 09.

---

## 2. Why option 3 (publishable package) loses

The burden was on whoever argues for a package. Nothing carried it.

### 2.1 Zero functional gain

`resolveAddonName` returns structurally identical records for a local path and a
published package [V-PRIOR: research/02 section 0, `[V-PROBE]` + `[V-SRC]`]. The
single real behavioural difference is that a published package gets its
`exports` map honoured (research/02 trap 2) -- a benefit that only solves a
problem the local shape does not have.

### 2.2 It creates publishable surface that the release pipeline auto-adopts

- Root `package.json` declares `"workspaces": ["packages/*"]`
  [V-REPO: `package.json:7-9`]. That glob is live, not decorative:
  `node_modules/ngx-foundation-sites` is a symlink to
  `packages/ngx-foundation-sites`, and `package-lock.json` carries exactly one
  non-`node_modules` top-level entry, `packages/ngx-foundation-sites`
  [V-EXEC]. A new `packages/<addon>/` with a `package.json` therefore adds a
  `node_modules/<name>` symlink and a lockfile entry -- it mutates the install
  graph.
- `packages/ngx-foundation-sites/package.json` is **not** `private`
  [V-REPO: `packages/ngx-foundation-sites/package.json:1-15`], while
  `apps/nfs-demo/package.json` **is** [V-REPO: `apps/nfs-demo/package.json:4`].
  The repo's own convention is "under `packages/`, non-private = releasable".
- `nx.json`'s `release` block declares no `projects` filter, only
  `version.preVersionCommand: "npx nx run-many -t build"`
  [V-REPO: `nx.json:79-83`]. [INFER] A new non-private package under
  `packages/*` is swept into `nx release`'s default scope; keeping R019 would
  require writing NEW config (`private: true`, and/or a `release.projects`
  filter) whose only job is to neutralise the thing you just created. That is
  negative-value work.

R019 defers *publishing*, not *living in a publishable directory* -- the ticket
is right not to over-read it. But this repo's `packages/*` directory is wired as
a release surface, so "living there" is not inert here.

### 2.3 It introduces a real, silent Nx stale-cache hazard

This resolves research/02's open `[INFER]` about caching, and it cuts against
option 3 specifically.

`build-storybook`'s inputs are `["default", "^production", "{projectRoot}/.storybook/**/*"]`
[V-REPO: `nx.json:45-48`], and `default` is `["{projectRoot}/**/*", "sharedGlobals"]`
[V-REPO: `nx.json:5`]. So:

- Anything under `packages/ngx-foundation-sites/` (options 1 and 2) is **already**
  an input to `build-storybook`. No hazard. The explicit `.storybook/**/*` entry
  is redundant with `default`.
- A separate package at `packages/<addon>/` is **outside** `{projectRoot}` for
  `ngx-foundation-sites`. It would only reach `build-storybook` via `^production`,
  which requires Nx's project graph to see it as a dependency. [INFER] A
  relative-path `addons: []` entry in `main.ts` is not a module import Nx's graph
  resolves into a project edge, so it would not. Result: **editing the addon
  produces a stale `build-storybook` cache hit, silently.** That is the same
  failure class as research/02's trap 4 -- green output, absent change.

### 2.4 Bundle cost and prior-art half-life

The `sass` browser build is ~916 KiB gzip with no tree-shaking
[V-PRIOR: research/03; corroborated research/01 section 4.7 at ~874 KiB gzip for
`sass.dart.js` alone]. In a workspace-local, dev-only addon that lands in the
Storybook preview iframe and nowhere else. A published addon converts it into a
consumer cost. Add T11: six of the eight surveyed theming addons are deprecated,
archived, or stranded on Storybook 6/7, and the one architectural precedent has
been dead since 2021 [V-PRIOR: research/01 sections 4.2, 4.5]. A published
theming addon is a maintenance liability with a short half-life; a
config-directory addon dies quietly with its own Storybook.

### 2.5 The requirement text says so

R009 -- "**Storybook** gets a theming addon" -- reads as this repo's Storybook,
and the brief's audience is people exploring *this* library via *this* Storybook
[V-PRIOR: map.md Destination]. Prior art supplies no counter-example: the
reference project is 100% workspace-local with no publish path
[V-PRIOR: research/01 section 0, delivery-shape row].

---

## 3. Why option 2 (`import.meta.resolve('./local-preset.ts')`) loses

Option 2 is a genuinely good shape and it is the officially documented v10
local-addon pattern [V-PRIOR: research/02 section 0, Shape A, `[V-DOCS]`]. It
loses on this repo's specifics, not on principle.

**What it buys over option 1:** the addon's modules live in their own directory
outside `.storybook/`, and are portable/extractable.

**What it costs:**

1. **Three units of overhead instead of zero-to-one**: a `main.ts` edit, a
   `.storybook/tsconfig.json` `include` edit (mandatory, hard build error
   otherwise [V-PRIOR: research/02 section 4 `[V-BUILD]`]), and a new
   `.storybook/local-preset.ts`.
2. **The repo-specific killer -- it couples the addon to the library's publish
   build.** `nx.json`'s `production` named input is `default` minus four
   exclusions, one of which is `"!{projectRoot}/.storybook/**/*"`
   [V-REPO: `nx.json:6-12`]. `@nx/angular:package` (the library `build`) uses
   `inputs: ["production", "^production"]` [V-REPO: `nx.json:36-40`]. Therefore:
   - An addon at `packages/ngx-foundation-sites/storybook-addon-theming/` falls
     **inside** `production`. Every addon edit invalidates the library `build`,
     which cascades to `verify-exports-map` (`dependsOn: ["build"]`
     [V-REPO: `packages/ngx-foundation-sites/project.json:88-99`]) and then to
     `lint` (`dependsOn: [..., "verify-exports-map"]`
     [V-REPO: `project.json:68-75`]). Editing a Storybook-only panel would
     re-run ng-packagr and the published-exports gate.
   - An addon inside `.storybook/` is **explicitly excluded** from `production`
     and does none of that.
3. Its winning argument -- extractability -- is the extraction R019 defers, and
   section 6 below delivers the same extractability at zero cost.

Option 2 remains the correct shape the day the addon actually leaves this repo.
That day is not in M002.

---

## 4. What option 1 actually is, verified

Two mechanisms carry it, both first-party Storybook behaviour, neither ad hoc.

**Manager side.** [V-SRC, re-verified here against
`node_modules/storybook/dist/_node-chunks/builder-manager-4GMYFI7O.js:1448-1456`]:

```js
configDirManagerEntry = resolveModulePath("./manager", {
  from: options.configDir,
  extensions: [".js", ".mjs", ".jsx", ".ts", ".mts", ".tsx"]
});
...
let entryPoints = configDirManagerEntry ? [...managerEntriesFromPresets, configDirManagerEntry] : managerEntriesFromPresets;
```

`.ts` **and `.tsx`** are both in the list, and the configDir entry is appended to
the same `entryPoints` array as preset-supplied entries, with
`outdir: join(options.outputDir, "sb-addons")`. So an auto-discovered
`.storybook/manager.ts` is a first-class manager entry emitted into the same
`sb-addons/` tree as `@storybook/addon-a11y` -- not a lesser path.

**Preview side.** `.storybook/preview.ts` already exists and is already the
config-dir preview annotation [V-REPO: `packages/ngx-foundation-sites/.storybook/preview.ts`].
Adding `export const initialGlobals` and `export const decorators` alongside its
existing `setCompodocJson(docJson)` call is the whole preview-side wiring.
`initialGlobals` is mandatory or the theme global key is silently dropped
[V-PRIOR: research/02 section 2, constraint (a)].

**tsconfig.** `.storybook/tsconfig.json`'s `include` already contains `"*.ts"`
[V-REPO: `.storybook/tsconfig.json:13-14`], which covers `preview.ts` and
`manager.ts` at the configDir root. Only a *subdirectory* forces an edit.

---

## 5. R026 fires on this addon -- and it is not a reason to pick a package

New evidence, produced by this ticket.

**VERIFIED (a):** `.storybook/*.ts` **is** inside the library project's ESLint
scope. Running ESLint over the project reports 17 linted files including all
three `.storybook` files, currently clean [V-EXEC]:

```
node node_modules/eslint/bin/eslint.js "packages/ngx-foundation-sites" --format json
-> 17 files; .storybook/main.ts, .storybook/preview.ts, .storybook/test-runner.ts all msgs=0
```

**VERIFIED (b):** R026's `no-restricted-syntax` block scopes to `**/*.ts`
excluding `**/*.spec.ts` [V-REPO: `packages/ngx-foundation-sites/eslint.config.mjs:62-84`],
and it **fires on the canonical addon style-injection shape** -- twice. Probe
source (written to `.scratch/`, linted, then deleted):

```ts
export function inject(css: string): void {
  let node = document.getElementById('nfs-theming');

  if (!node) {
    node = document.createElement('style');
    node.id = 'nfs-theming';
    document.head.appendChild(node);
  }

  node.textContent = css;
}
```

```
node node_modules/eslint/bin/eslint.js --config packages/ngx-foundation-sites/eslint.config.mjs <probe>
  8:35  error  R026: creating a <style> element at runtime is banned ...  no-restricted-syntax
 13:3   error  R026: assigning a CSS string to a DOM node is banned ...   no-restricted-syntax
2 problems (2 errors, 0 warnings)
```

That shape is exactly research/02 section 7's verified preview skeleton and
exactly research/01 C6's injection requirement. So **R026 blocks the addon as
currently written, wherever it sits inside the library project -- `.storybook/`
included.**

**This is the single strongest-looking argument for option 3, and it is a bad
one.** Relocating the addon into a separate package would place it outside
`packages/ngx-foundation-sites/eslint.config.mjs`'s scope and make R026 stop
firing -- escaping a governance rule by relocation, with no record that the
exemption was ever decided. The map already assigns ticket 09 the job of stating
where R026's line falls; an explicit, commented `ignores` entry is the honest,
reviewable form of that answer. Delivery shape must not pre-empt it by
geography.

**Hard file-shape constraint this imposes on ticket 09 (verified):**
`packages/ngx-foundation-sites/src/lib/nfs-button/nfs-button.r026-lint.spec.ts:65-67`
asserts `expect(r026ConfigEntries).toHaveLength(2)` -- exactly two flat-config
blocks may define `no-restricted-syntax`. So the exemption must be an `ignores`
addition to the existing non-spec block (count stays 2), or ticket 09 must also
update that assertion. Adding a *third* block silently breaks the `test` target.

---

## 6. The middle option: what "clean enough to extract later" means, in files

**Accepted, and defined -- because it costs zero extra files today.** Rejected
only in its speculative-generality form.

**Accepted, three file-level rules:**

1. **One directory, two canonical entry names.** All addon implementation lives
   in a single directory, and its two entry modules are named `manager.ts` and
   `preview.ts`. Both option 1 and option 2 already demand exactly those names,
   so this is free.
2. **The addon consumes the library only through its public specifier.** No
   relative `../src/**` imports. Sass is reached via the existing published
   subpath `ngx-foundation-sites/scss/button`, TypeScript via the
   `ngx-foundation-sites` path alias already in `tsconfig.base.json`
   [V-REPO: `tsconfig.base.json` `paths`]. Both are already gated -- the Sass
   subpath by `verify-exports-map.mjs`.
3. **Nothing outside that directory imports into it**, except the two
   auto-discovery shims (`.storybook/manager.ts`, `.storybook/preview.ts`),
   which are one-line re-exports (plus preview.ts's existing `setCompodocJson`
   call).

Extraction later is then: move the directory, add a `package.json`, replace the
two shims with one `addons: []` entry. That is option 2's wiring, deferred to
the day it is needed.

**Rejected as speculative-generality overhead, explicitly:** a `package.json`
for the addon, an `exports` map, a `dist/` build step, a `bundler` field, an
addon-kit dependency, an Nx `project.json`, a `tsconfig.base.json` path alias,
or an ESM `local-preset.ts` written "so we can switch later". Every one of those
is publication machinery, and R019 defers publication
[V-PRIOR: research/02 section 4, closing `[V-DOCS]` note].

---

## 7. Downstream consequences: touched vs untouched

### Touched

| Path / target | Change | Gate impact |
| --- | --- | --- |
| `packages/ngx-foundation-sites/.storybook/manager.ts` | NEW -- auto-discovered manager entry (panel + toolbar) | none new |
| `packages/ngx-foundation-sites/.storybook/preview.ts` | EDIT -- add `initialGlobals` + `decorators` exports beside the existing `setCompodocJson` call | none new |
| `packages/ngx-foundation-sites/.storybook/<addon modules>.ts` | NEW -- compile + state modules | none new |
| `packages/ngx-foundation-sites/.storybook/tsconfig.json` | EDIT -- **only if** preview-side modules move into a subdirectory; one `include` line | hard build error if omitted |
| `packages/ngx-foundation-sites/eslint.config.mjs` | EDIT -- R026 `ignores` carve-out; **ticket 09 owns the decision**, this ticket only fixes its file shape (section 5) | `lint`; and `test` via `nfs-button.r026-lint.spec.ts` if a 3rd block is added |
| Targets re-run | `build-storybook` -> `verify-autodocs-coverage` -> `test-storybook`, `static-storybook`; plus `lint` and `test` | existing gates only |

### Untouched -- this is the payoff

- **`packages/ngx-foundation-sites/.storybook/main.ts`** -- no `addons: []` edit.
  The only shape of the three that leaves it alone.
- **`packages/ngx-foundation-sites/package.json`** -- no new key, no `exports`
  entry, no new dependency, no `private` question.
- **`packages/ngx-foundation-sites/scripts/verify-exports-map.mjs` and the
  `verify-exports-map` target** -- untouched, *and* its cache is not invalidated
  by addon edits, because `.storybook/**` is excluded from the `production`
  named input that feeds `@nx/angular:package` (section 3.2).
- **`packages/ngx-foundation-sites/ng-package.json`** -- no new asset glob. The
  addon never ships in `dist/packages/ngx-foundation-sites`.
- **`packages/ngx-foundation-sites/project.json`** -- no new target *forced by
  delivery shape*. (Whether tickets 05/08 need a Sass-bundling target is theirs;
  section 8 does add one verification target for ticket 10.)
- **Root `package.json`** -- no new `packages/*` workspace member, no
  `node_modules/<name>` symlink, no `package-lock.json` entry.
- **`nx.json`** -- no `release.projects` filter, no new `targetDefaults` entry.
- **`tsconfig.base.json`** -- no new path alias.
- **`.storybook/test-runner.ts`** -- unchanged.
- **No D026-style breaking-change record.** Nothing in the published surface
  changes: no `exports` key added, removed or retargeted.
- **No new npm dependency.** `react` stays an undeclared transitive (research/01
  T7) -- a real, named, pre-existing risk that this decision neither creates nor
  resolves.

---

## 8. The load assertion this decision requires

A green build proves nothing: an unresolvable addon is a `logger.warn`
(`Could not resolve addon "${name}", skipping. Is it installed?`
[V-SRC: `chunk-DXKWFBLE.js:13515`, re-verified here]) and a crashing manager
entry is a wrapped `console.error` (`One of your manager-entries failed: `
[V-SRC: `builder-manager-4GMYFI7O.js:1507`, re-verified here]). Three layers,
cheapest first.

### L1 -- build-artifact assertion (no new dependency)

**VERIFIED emitted shape.** `dist/storybook/ngx-foundation-sites/sb-addons/`
today contains exactly one directory per registered manager entry --
`storybook-core-server-presets-0`, `a11y-1`, `docs-2` -- each holding a
`*-bundle.js`, and `index.html` carries a `<script src="sb-addons/<slug>/...-bundle.js">`
per entry [V-EXEC on the existing `dist/`].

**VERIFIED naming rule** [V-SRC: `builder-manager-4GMYFI7O.js:1420-1440`]:

```js
sanitizeBase = (path) => path.replaceAll(".", "").replaceAll("@", "")
  .replaceAll(sep, "-").replaceAll("/", "-").replaceAll(/^(-)+/g, "")
// dir  = sanitizeBase(relative(cwd, dirname(entry))) + "-" + <index>
// file = sanitizeBase(basename(entry, ext)) + "-bundle.js"
```

For an auto-discovered `.storybook/manager.ts` with cwd = workspace root, that
predicts `sb-addons/packages-ngx-foundation-sites-storybook-<N>/manager-bundle.js`.
[INFER on `<N>` only: it is the entry INDEX, and the configDir entry is appended
last, so it shifts if `main.ts`'s `addons: []` gains or loses an entry.]

**So the assertion must be glob + content, never a hard-coded path:**

1. `dist/storybook/ngx-foundation-sites/sb-addons/packages-ngx-foundation-sites-storybook-*/manager-bundle.js`
   exists, and contains the addon's unique `ADDON_ID` marker string.
2. `dist/storybook/ngx-foundation-sites/index.html` references that same file in
   a `<script src=...>`.
3. The preview marker (the `<style>` id, e.g. `nfs-theming`) appears in
   `dist/storybook/ngx-foundation-sites/*.iframe.bundle.js` -- catches "manager
   loaded but the decorator never wired". Preview annotations provably land
   there [V-PRIOR: research/02 section 8, `[V-BUILD]`].

Home: a fourth `packages/ngx-foundation-sites/scripts/verify-*.mjs` with an Nx
target `dependsOn: ["build-storybook"]`, modelled exactly on the existing
`verify-autodocs-coverage` [V-REPO: `project.json:155-162`]. Zero new
dependencies.

### L2 -- runtime assertion (the only one that proves it LOADED)

Ticket 04's `apps/nfs-storybook-e2e/` `@playwright/test` project with
`dependsOn: ngx-foundation-sites:static-storybook`. Three assertions:

1. The "Theming" panel tab is present in the **manager** DOM.
2. Driving a control mutates `<style id="nfs-theming">`'s `textContent` inside
   the preview iframe.
3. **Zero `console.error` on the MANAGER page.** This is the one that catches
   esbuild's `try/catch` wrapper swallowing a crashing manager entry, and it is
   the reason a manager-reaching Playwright lane is not optional.

### L3 -- negative control (mandatory)

Break the wiring on purpose once (rename `.storybook/manager.ts`) and prove L1
and L2 both fail. Without it the assertion is itself untested, and traps 3 and 4
apply to the assertion as readily as to the addon.

### Explicitly NOT sufficient

- A green `nx run ngx-foundation-sites:build-storybook`.
- A green `test-storybook`. Its `preVisit` console hook throws only on
  `type() === 'error'` [V-REPO: `.storybook/test-runner.ts:6-13`], the
  resolution failure is a `warn`, and its `page` is the preview iframe, so it
  cannot see manager-side errors at all [V-PRIOR: research/04].

---

## 9. What this constrains for tickets 07, 09 and 10

### Ticket 07 -- where the compliant palette lives

- **It must NOT live in `.storybook/`.** That directory is excluded from the
  `production` named input [V-REPO: `nx.json:6-12`], so nothing there is visible
  to the library `build`; `ng-package.json`'s only asset glob is
  `{ glob: "**/*.scss", input: "src/scss" }` [V-REPO:
  `packages/ngx-foundation-sites/ng-package.json:5-11`], so nothing there can
  ship; and three of the five files T4 says must be re-pointed
  (`apps/nfs-demo/src/styles.scss`, `apps/nfs-demo/src/app/app.component.ts`,
  `packages/ngx-foundation-sites/README.md`) cannot reach it. Put the single
  source under `packages/ngx-foundation-sites/src/scss/` and let the **addon
  consume the library**, not the reverse. That is also middle-option rule 2.
- **If ticket 07 adds a consumer-reachable subpath it DOES touch the exports
  map** -- the one gate this decision otherwise leaves alone. Note the gate's
  real shape: `verify-exports-map.mjs` diffs the source and dist `exports`
  *maps*, not file existence [V-REPO: `scripts/verify-exports-map.mjs:64-97`].
  A key whose target is outside `src/scss/**/*.scss` would pass the gate and
  still ship a broken subpath. If the palette belongs under
  `src/scss/internal/`, the existing `"./scss/internal/*": null` blocker keeps
  it private by design [V-REPO: `packages/ngx-foundation-sites/package.json:8-14`].

### Ticket 09 -- control surface and state model

- **R026 must be resolved by an explicit exemption, not by relocation**
  (section 5). The exemption must be an `ignores` addition to the existing
  non-spec `no-restricted-syntax` block, or `nfs-button.r026-lint.spec.ts:65-67`
  must be updated in the same change -- a third block silently breaks `test`.
- The panel is React, unavoidably [V-PRIOR: research/02 section 1]. If it uses
  JSX, note `.storybook/manager.tsx` **also** auto-discovers (`.tsx` is in the
  extension list, section 4) -- but `.storybook/tsconfig.json`'s `include` lists
  only `"*.ts"` and the config sets no `jsx` option
  [V-REPO: `.storybook/tsconfig.json`, `packages/ngx-foundation-sites/tsconfig.json`].
  Manager-side *compilation* does not care (Storybook's esbuild supplies its own
  `jsx: react` tsconfig), but ESLint and the project reference do. Plain
  `React.createElement` sidesteps both; JSX costs two more config lines. Ticket
  09's call.
- Globals as the state mechanism, its three constraints (undeclared keys
  dropped, shallow top-level merge, URL round-trip rejects `0.5rem`), and the
  `storyGlobals` lock affordance are all untouched by delivery shape
  [V-PRIOR: research/02 section 2].
- The addon's module count is small because ticket 07's palette is NOT an addon
  file. Keep it that way; the flat-`.storybook/` option stays viable longer.

### Ticket 10 -- R021 verification design

- **Owns the section 8 load assertion.** L1 is a new `verify-*.mjs` + Nx target
  modelled on `verify-autodocs-coverage`; L2 is ticket 04's
  `apps/nfs-storybook-e2e/`; L3 (the negative control) is mandatory, not
  optional.
- The addon adds **no new Nx project**, so no new inferred `e2e` target beyond
  ticket 04's [V-REPO: `nx.json:50-63`, `@nx/playwright/plugin` infers `e2e`
  per project].
- The `sb-addons/` directory index `<N>` is order-dependent (section 8). Any
  assertion must glob, never hard-code it -- otherwise adding an addon to
  `main.ts` later breaks the gate for the wrong reason.
- D023's axe question is **not** changed by this decision. Addon CSS provably
  survives `build-storybook` and is visible to `test-storybook`
  [V-PRIOR: research/02 section 8], so the addon being `.storybook`-resident
  costs nothing there. Choosing between re-pointing `@storybook/addon-a11y`'s
  scan and the `apps/nfs-demo` axe fixture remains ticket 10's, unconstrained.

---

## 10. Verified vs inferred

**VERIFIED** -- every `[V-REPO]`, `[V-EXEC]`, `[V-SRC]` claim above, specifically:
the `.storybook/tsconfig.json` non-recursive `"*.ts"` include; the `nx.json`
`production` exclusion of `.storybook/**` and the resulting build-cache
asymmetry between option 1 and option 2; `build-storybook`'s input set already
covering all of `{projectRoot}`; the live `packages/*` workspace glob (symlink +
lockfile entry); `packages/ngx-foundation-sites/package.json` non-private vs
`apps/nfs-demo/package.json` private; `verify-exports-map.mjs` diffing maps not
files; the `verify-exports-map -> build` and `lint -> verify-exports-map`
dependency chain; `.storybook/*.ts` being inside ESLint's scope (17 files, 3
`.storybook` files, 0 messages today); R026 firing twice on the canonical addon
injection shape; the `toHaveLength(2)` assertion in `nfs-button.r026-lint.spec.ts`;
`configDirManagerEntry`'s extension list including `.ts` and `.tsx` and its
append-last position; `sanitizeBase`/`sanitizeFinal`'s naming rule; the current
`sb-addons/` directory layout and `index.html` script references; the two
Storybook failure strings.

**INFERRED** (reasoned, would need execution to close, and none of it is
load-bearing for the decision):
- That `nx release`'s default scope would sweep in a new non-private
  `packages/*` package (section 2.2). The private/non-private facts and the
  absent `release.projects` filter are verified; the sweep behaviour is not.
- That Nx's project graph would not resolve a relative-path `addons: []` entry
  into a project edge, hence the option-3 stale-cache hazard (section 2.3).
- The exact `<N>` index in the emitted `sb-addons/` directory name, and hence
  the full predicted path (section 8) -- which is precisely why the assertion is
  specified as a glob.
- That `@nx/dependency-checks` will tolerate the addon's `storybook/manager-api`
  and `react` imports. Basis: `.storybook/preview.ts`, `main.ts` and
  `test-runner.ts` already import three root-only devDependencies
  (`@storybook/addon-docs/angular`, `@storybook/angular`,
  `@storybook/test-runner`) and lint is green on main. Same position, same
  outcome expected -- but not executed here.

**CARRIED** from tickets 01-04 without re-verification, cited inline as
`[V-PRIOR]`: `resolveAddonName`'s local-vs-published equivalence and the four
silent-failure traps; the `@ngtools/webpack` preview-tsconfig hard failure; the
manager-side/preview-side bundler asymmetry; globals' three constraints;
addon CSS surviving `build-storybook`; `@storybook/test-runner`'s inability to
reach the manager; the ~916 KiB gzip `sass` cost; the theming-addon graveyard.
