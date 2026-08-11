# Storybook 10 custom addon anatomy

Type: research
Status: resolved
Blocked by: --

## Question

What is the current, supported shape of a Storybook 10 addon that needs **both**
a manager-side UI (the theming controls) and a preview-side effect (injecting
compiled CSS into the iframe)?

This repo runs Storybook `^10.5.0` with `@storybook/angular`. Answer against
that version, not against blog posts describing Storybook 6/7 APIs.

1. **Registration surface.** `addons.register` + `addons.add`, panel vs toolbar
   vs sidebar placement, and what `@storybook/manager-api` exposes in v10.
   Which of the v6/v7-era APIs are deprecated or removed in v10?
2. **Manager <-> preview communication.** Globals (`useGlobals`) vs the addon
   channel (`useChannel` / `addons.getChannel()`) vs parameters vs args. Which
   is correct for state that is **page-level and story-independent** -- a theme
   applies to the whole preview, not to one story's props? Note that args are
   almost certainly wrong here; confirm and say why.
3. **Preview-side injection.** How a preview-side decorator or `preview.ts`
   subscriber injects and *replaces* a `<style>` node in the iframe as state
   changes. What is the addon-idiomatic way to own a style node without
   fighting Storybook's own re-render?
4. **Build/packaging shape.** What files a custom addon needs (`manager.ts` /
   `preview.ts` entry points, `main.ts` `addons: []` wiring), and specifically
   the difference between a **workspace-local addon** (a path in `addons: []`)
   and a **published addon package**. Can a local, unpublished addon be wired
   by relative path? This directly feeds ticket 04.
5. **Angular-specific caveats.** Anything about `@storybook/angular`'s builder
   that constrains addon authoring or preview-side DOM manipulation.
6. **TypeScript/bundling.** How addon manager code gets built in a Storybook 10
   project that isn't using the addon-kit scaffold, and whether Nx changes that.

Deliver a findings document with a minimal but complete skeleton of the files a
working addon needs, each API claim linked to Storybook 10 docs or source.

## Notes

Storybook docs are the primary source; prefer the versioned v10 docs over
generic pages. `storybookjs/storybook` may be cloned under
`d:/projects/github/storybookjs/` -- check, and prefer source over docs where
they disagree.

## Answer

Full findings: `../research/02-storybook-10-addon-anatomy.md`.

**The decisive question -- can a workspace-local, unpublished addon be wired by
relative path? YES**, verified three ways: probing Storybook's own
`resolveAddonName`, two real `nx build-storybook` runs, and a Playwright check
against the **static** build output. `resolveAddonName` returns *structurally
identical* records for local paths and published packages -- Storybook does not
distinguish them. This unblocks ticket 06 without forcing a package.

Two working shapes:

- **Shape A (recommended, officially documented):**
  `addons: [import.meta.resolve('./local-preset.ts')]`, where `local-preset.ts`
  exports `managerEntries` / `previewAnnotations`. Verbatim the v10 migration
  guide's "Local addon loading" section, which exists because addons went
  ESM-only in v10.
- **Shape B:** `addons: ['../my-addon']` pointing at a directory containing
  literal `manager.js` / `preview.js` / `preset.js`.
- **Bonus, and the lazy option:** `.storybook/manager.ts` is **auto-discovered
  with no `addons: []` wiring at all**. Minimum viable addon is 2 files and zero
  config edits. Routed to ticket 06 as the cheap alternative to a 5-file
  portable addon.

**Four silent-failure traps** (all belong to ticket 06's decision):

1. A directory of only `.ts` entries resolves to `undefined` --
   `safeResolveModule` guesses only `.mjs`/`.js`/`.cjs`. Shape A dodges it by
   naming the extension.
2. A local dir's `package.json` `exports` map is **ignored** -- relative ESM
   resolution never consults it. This is the one real local-vs-published
   difference.
3. Pointing `addons: []` straight at `manager.js` loads it as a Node-side
   *preset*: no manager entry, no error.
4. An unresolvable addon is only a `logger.warn`, and a crashing manager entry
   is swallowed by an esbuild-injected try/catch. **A green build is not proof
   the addon loaded** -- assert against the bundle.

**Angular-specific gotcha, the one thing that actually broke:** preview-side
`.ts` must appear in `.storybook/tsconfig.json`'s `include`, or
`@ngtools/webpack` hard-fails with "...is missing from the TypeScript
compilation." Manager-side `.ts` has no such constraint (separate esbuild pass,
Storybook's own tsconfig). Plan for the asymmetry.

**Globals is the right state mechanism**, confirmed against source: args are
per-story (`updateStoryArgs` is scoped to a story object) and would pollute the
R007 autodocs table; parameters have no `updateParameters` at all. Three
constraints routed to ticket 09.

**Version trap:** `@storybook/{manager-api,preview-api,components,theming,core-events}`
all stopped at 8.6.14 and do not exist at v10 -- importing one silently pulls a
v8 copy. `register.js` is also dead (the resolver probes only
`preset`/`manager`/`preview`; the error string mentioning `/register` is stale
text). Manager UI is **React**, unavoidably, even in this Angular repo.

**Settles a map fog item:** addon CSS **does** survive `build-storybook`, so
`test-storybook` will see it.
