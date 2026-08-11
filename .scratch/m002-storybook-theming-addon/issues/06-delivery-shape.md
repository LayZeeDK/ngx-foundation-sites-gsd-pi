# Decision: workspace-local addon or publishable package?

Type: research
Status: resolved
Blocked by: 01, 02

## Question

Does the theming addon live as **workspace-local Storybook tooling** (wired by
relative path in `packages/ngx-foundation-sites/.storybook/main.ts`), or as a
**publishable addon package** that downstream consumers could install into their
own Storybook?

This is the most destination-shaping decision on the map: it determines package
layout, whether the exports map and `verify-exports-map.mjs` gate are touched,
whether a D026-style breaking-change record is needed, and how much surface
ticket 11's requirements must describe.

Weigh at minimum:

- **R009's wording** -- "**Storybook** gets a theming addon" reads as *this
  repo's* Storybook, not "consumers get an addon".
- **The brief's audience** -- "developers and designers exploring/theming this
  component library via Storybook".
- **R019** -- publishing `packages/` to npm is deferred, explicitly not in scope
  for M001 or M002. This strongly disfavors new publishable surface, though note
  it defers *publishing*, not *living in a publishable directory*; do not
  over-read it.
- **What ticket 01 found** about how `ngx-foundation-sites-next` delivered its
  addon (as a requirements signal only -- no code-copying, and "next did it that
  way" is not on its own a justification).
- **Ticket 02 answered the forcing question: local wiring WORKS.** A
  workspace-local, unpublished addon can be wired by relative path -- verified
  against `resolveAddonName`, two real `nx build-storybook` runs, and the static
  build output. `resolveAddonName` returns structurally identical records for
  local paths and published packages. So the decision is genuinely open, not
  forced, and the burden falls on whoever argues for a package.

  Three delivery shapes are now on the table, cheapest first:
  1. **`.storybook/manager.ts` auto-discovery** -- 2 files, zero `addons: []`
     wiring, no config edits. The lazy option; evaluate it first and reject it
     only for a stated reason.
  2. **`import.meta.resolve('./local-preset.ts')`** with a preset exporting
     `managerEntries`/`previewAnnotations` -- the officially documented v10
     local-addon shape, portable within the repo.
  3. **Publishable package** -- only if 1 and 2 are shown insufficient.

  Weigh these four silent-failure traps, which favour the documented shapes over
  ad-hoc ones: a directory of only `.ts` entries resolves to `undefined`; a local
  dir's `package.json` `exports` map is ignored (the one real local-vs-published
  difference); pointing `addons: []` at `manager.js` loads it as a Node preset
  with no error; and an unresolvable or crashing addon only warns -- **a green
  build is not proof the addon loaded**, so whichever shape wins needs a
  load-assertion, not a build-passes check.
- **Bundle cost** -- the `sass` browser build is large. Dev-only tooling can
  absorb that; a published addon inherits it as a consumer cost.

A middle option exists and should be evaluated rather than assumed: build it
workspace-local but keep the module boundary clean enough to extract later. Say
explicitly what "clean enough" would mean in file terms, or reject the option as
speculative-generality overhead.

Resolve with a locked decision, the reasoning, and the specific downstream
consequences (which files/targets/gates are touched, which are not).

## Notes

Out of scope regardless of outcome: actually publishing anything (R019). This
decision stops at "does it live in a publishable directory and with what
boundary", never at "ship it".

## Answer

Full reasoning: `../research/06-delivery-shape.md`.

**LOCKED: the addon ships as workspace-local Storybook tooling resident inside
`packages/ngx-foundation-sites/.storybook/`**, entry points auto-discovered
(`.storybook/manager.ts` manager-side, the existing `.storybook/preview.ts`
preview-side) -- option 1. No new package, no `addons: []` wiring, no
`local-preset.ts`, and no change to the library's `package.json`, `exports` map,
or the `verify-exports-map` gate.

Honest correction to this ticket's own framing: it is 2 files and *near*-zero
config, not literally zero. `.storybook/tsconfig.json`'s `include` lists
`"*.ts"`, a **non-recursive** glob, so a preview-side subdirectory costs one
`include` line.

**Why the alternatives lose, on repo-specific evidence:**

- **Local preset in its own directory** loses on a cache-coupling asymmetry
  verified in `nx.json`: the `production` named input is `default` minus
  `"!{projectRoot}/.storybook/**/*"`. An addon directory at
  `packages/ngx-foundation-sites/storybook-addon-theming/` falls *inside*
  `production`, so every addon edit invalidates the library `build` ->
  `verify-exports-map` (dependsOn build) -> `lint`. `.storybook/`-resident code
  is explicitly excluded and triggers none of it.
- **Publishable package** loses four ways: `workspaces: ["packages/*"]` is live
  (verified symlink + lockfile entry); the library package is non-private and
  `nx.json`'s `release` has no `projects` filter, so honouring R019 would mean
  writing config to neutralise what you just created; a separate package sits
  outside `{projectRoot}` so `build-storybook` would go **stale-cache silent**;
  and it converts the ~916 KiB gzip `sass` cost into a consumer cost. Zero
  functional gain -- `resolveAddonName` records are identical either way.

**Middle option: accepted, and defined in file terms** (costs nothing today) --
one directory whose entries are literally named `manager.ts` / `preview.ts`; the
addon reaches the library only via `ngx-foundation-sites` and
`ngx-foundation-sites/scss/button`, never `../src/**`; nothing outside imports
in except the two one-line auto-discovery shims. Extraction later is: move the
directory, add a `package.json`, swap shims for one `addons: []` entry.
**Rejected** as speculative generality: any addon `package.json`, `exports` map,
`dist/` build, `bundler` field, addon-kit scaffold, Nx project or path alias
written "for later".

**Two findings this ticket did not anticipate, both routed onward:**

1. **R026 blocks the addon, verified by execution.** `.storybook/*.ts` IS in the
   library's ESLint scope, and linting research/02's exact preview skeleton
   against `packages/ngx-foundation-sites/eslint.config.mjs` produced **2 R026
   errors** (`createElement('style')` and `node.textContent = css`). Note this
   is the strongest-*looking* argument for a separate package and it is a bad
   one -- relocating would escape the rule silently rather than resolve it.
   Routed to ticket 09.
2. **The load assertion has a precise, verified target.**
   `sanitizeBase`/`wrapManagerEntries` predicts
   `sb-addons/packages-ngx-foundation-sites-storybook-<N>/manager-bundle.js`,
   where `<N>` is an order-dependent index. Routed to ticket 10.
