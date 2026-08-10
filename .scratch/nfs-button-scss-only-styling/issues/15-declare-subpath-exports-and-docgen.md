# Make the documented public API actually addressable, and autodocs actually document

Type: task
Status: resolved
Blocked by: 11

## Question

Ticket 11 found two defects that documentation cannot fix, both of which undercut a
requirement this map claims to satisfy. Neither is a regression introduced by this effort --
both are pre-existing -- but both are now *documented* behaviour, so leaving them makes the
README wrong rather than merely incomplete.

### 1. The published `exports` map blocks every documented subpath (R020)

ng-packagr generates only `"."` and `"./package.json"` in the published `exports` map.
Verified with `require.resolve` against the Verdaccio-installed copy in
`apps/nfs-demo/node_modules`: `ngx-foundation-sites/scss/button`,
`ngx-foundation-sites/css/nfs-button.css` and `.../scss/internal/foundation-button` all fail
with `ERR_PACKAGE_PATH_NOT_EXPORTED`, while the package root resolves.

**Theming works today only because Angular's Sass importer resolves through node_modules load
paths rather than through `exports`.** That is why the demo app and its four-host e2e suite
are green -- the documented API is addressable by accident of one tool's resolution strategy,
not by declaration. Any consumer tooling that honours `exports` (and bundlers increasingly
do) would reject the exact `@use` line the README now instructs them to write.

Fix: declare the subpaths in `ng-package.json`. Two constraints on how:

- Declare `./css/*` and `./scss/*`.
- **Do not declare `./scss/internal/*`.** Ticket 08 recorded `internal/` as a signalling
  boundary that cannot be enforced, because M002 must fetch and compile the source. Leaving it
  undeclared is the closest thing to enforcement available: it stays reachable through a Sass
  load path, exactly as M002 needs, while an `exports`-respecting resolver refuses it. That
  turns a comment in the README into a real boundary for every consumer who is not compiling
  Sass. Say so in the README rather than silently improving it.

Verify the fix the same way it was found -- `require.resolve` against a freshly published and
installed copy, not against workspace source -- and confirm the four-host e2e stays green.

### 2. Autodocs documents nothing about the inputs (R007)

The Storybook autodocs ArgTypes table shows `color` as `string` and every other input as `-`:
no descriptions, no types, no defaults. Cause: both Storybook targets in `project.json` set
`compodoc: false`, so no docgen JSON exists for the Angular renderer to read. The
component-level description survives only because `nfs-button.stories.ts` hard-codes
`parameters.docs.description.component`.

So **every input JSDoc is invisible in autodocs**, which makes R007's recorded proof --
"Storybook autodocs (tags: ['autodocs'] in nfs-button.stories.ts) renders the same JSDoc via
@storybook/addon-docs" -- partly false. R007 is a *validated* requirement, and this map's
destination requires it to still hold.

Fix: enable the docgen path (`compodoc: true` on both Storybook targets, or generate a
`documentation.json` as a target dependency). Then **verify by rendering**, as ticket 11 did:
serve the static build, open `/?path=/docs/nfsbutton--docs`, and confirm the ArgTypes table
shows each input's description, type and default, with zero console errors. A green build is
not evidence here -- the table was empty on a green build.

Watch the interaction with `test-storybook`: `.storybook/test-runner.ts` fails any story
emitting a browser console error, so a docgen misconfiguration that logs a warning could turn
a documentation improvement into a red gate. Run `test-storybook` as part of verification.

If enabling docgen measurably slows `build-storybook`, say by how much rather than reverting
silently -- the trade is the user's to know about, not to discover.

## Answer

Three commits on `feat/scss-only-button-styling`. **Both defects fixed; the full battery
passes** -- lint, `test` 43/43, `test-browser` 2/2, `build`, `build-storybook`,
`test-storybook` 17/17, `compodoc`, `nfs-demo:e2e` **36 passed** across four hosts plus
WebKit and Firefox, and `verify-registry-consumption` for both bundles.

### Fix 1 -- the declaration could not go where the ticket assumed

`ng-package.json` has **no** `exports` property in its schema. ng-packagr's
`generatePackageExports` **seeds its generated map from the source `package.json`'s own
`exports`**, then appends `./package.json` and `.`. So the declaration belongs in
`packages/ngx-foundation-sites/package.json`. Published map:

```json
{ "./scss/internal/*": null, "./scss/button": "./scss/_button.scss",
  "./scss/*": "./scss/*", "./css/*": "./css/*", "./package.json": {...}, ".": {...} }
```

Two details that make it work: exports patterns match across `/`, so `./scss/*` alone would
have exported the internals -- `"./scss/internal/*": null` is declared explicitly and wins
because resolution picks the longest `patternBase`. And the exact `./scss/button` key exists
because Node performs no Sass partial/extension completion, so the documented `@use`
specifier has to be mapped straight at `_button.scss`.

Verified against the Verdaccio-installed copy with `require.resolve` **and** webpack's
`enhanced-resolve` as a second witness. All three documented subpaths went from
`ERR_PACKAGE_PATH_NOT_EXPORTED` to resolving; all three `internal/` paths are **still
refused**, with enhanced-resolve reporting `"./scss/internal/..." is not exported under the
conditions ["sass","style","default"]`. Sass load-path reachability of
`internal/foundation-button` still compiles, so M002 is unaffected.

**New finding that changed the README wording:** Dart Sass 1.102.0's own
`NodePackageImporter` (`pkg:` URLs) **ignores `exports` for subpaths entirely** -- proven in a
controlled sandbox, where pointing `./scss/*` at a nonexistent directory still resolved the
real file and a `null` on `./scss/internal/*` did not refuse it. So the `internal/` boundary
is now **genuinely enforced for Node and exports-reading bundlers, and still only a signal for
any Sass resolver**. Both README claims were rewritten to say precisely that, and the old
"reference the file by path if your bundler enforces `exports`" workaround is gone.

### Fix 2 -- `compodoc: true` alone would have looked like a fix and produced nothing

Three things had to line up:

- `compodoc: true` on both Storybook targets.
- **`compodocArgs` pinning the tsconfig.** The builder defaults to
  `.storybook/tsconfig.json`, whose `include` covers only `*.stories.ts` -- measured to
  produce a `documentation.json` with `components: []`. The table would have stayed empty with
  docgen nominally enabled. Pinned to `tsconfig.lib.json`, plus `--disablePrivate
  --disableProtected` (without them the table advertised the `protected` `isAnchor` with
  description "unknown").
- **`.storybook/preview.ts` was empty and had to call `setCompodocJson`.** Storybook 10's
  Angular renderer reads `globalThis.__STORYBOOK_COMPODOC_JSON__` and nothing populates it.

Rendered verification (static build, Playwright/Chromium, `/?path=/docs/nfsbutton--docs`): all
six inputs now show description, type and default -- `color` as its full union with default
`primary`, the booleans with `false`, `size` blank because its default genuinely is
`undefined`. Full JSDoc prose renders in every description cell, `focus()` is documented, 16
stories render, **zero console errors and zero warnings**.

Build cost, 3 runs each with cache skipped: median **15.5s -> 18.1s**, so **+2.6s / about
+17%**. Docgen alone measures 1.91s; the rest is `npm exec` overhead plus a 20 KB JSON
entering the webpack graph. Not reverted.

### Carried forward to ticket 16

- **No durable gate keeps the ArgTypes table populated.** `test-storybook` fails only on
  console errors, and this defect produced none -- it was invisible on a green build and would
  be again. That is the same failure mode this effort has now found five times.
- **`parameters.docs.description.component` in `nfs-button.stories.ts` is now redundant and
  has already drifted** -- the hard-coded copy lists `expanded, dropdown` where the class
  JSDoc does not.
