# Decision: control surface, preset semantics, and CSS injection

Type: research
Status: resolved
Blocked by: 02, 05

## Question

Define the addon's user-facing model and the state that backs it.

**Controls.** The curated set is primary / secondary / success / alert / warning
plus radius -- confirmed to map 1:1 onto `theme()`'s `$background`, `$palette`
keys, and `$radius`, so no public Sass API growth is needed. Decide:

- **Globals is settled as the mechanism** (ticket 02, verified against source):
  args are per-story and would pollute the R007 autodocs table, and parameters
  have no `updateParameters` at all. Design around three verified constraints:
  1. Keys must be declared in `initialGlobals` or they are **silently dropped**.
  2. Global merges are **shallow** -- send the whole theme object, never a
     partial patch. This interacts directly with the preset-equality model
     below.
  3. URL round-tripping accepts hex colors (`!hex(1779ba)`) but **rejects
     `0.5rem`** -- so the radius control's wire format must come from the safe
     set. Decide that format explicitly; it is a user-visible constraint on
     shareable URLs, not an implementation detail.
- The manager UI is **React**, unavoidably, even in this Angular repo. Note also
  that `@storybook/{manager-api,preview-api,components,theming}` stopped at
  8.6.14 -- importing one silently pulls a v8 copy.
- Whether the panel is a custom addon panel, toolbar items, or both.
- What a color control is concretely (native `<input type="color">`, a text hex
  field, both) and what happens on invalid input.

**Preset semantics.** The brief is specific and this is the subtle part:

- A preset selector seeds the curated controls (Foundation default,
  WCAG-compliant).
- Controls **stay tweakable after seeding** -- seeding is not locking.
- A preset reads as **"selected" only when every control's live value matches
  that preset exactly**. So selection is a *derived* property of live state, not
  a stored mode flag. Confirm that reading and specify the comparison: a fully
  resolved control set (see ticket 07 -- the compliant preset is sparse, only
  three overrides, inheriting Foundation defaults elsewhere).
- Define the state when nothing matches: is there a "Custom" label, or simply no
  preset marked?

**Injection and cascade.** Decide how compiled CSS reaches the preview and wins:

- One owned `<style>` node, replaced on each compile? Where in the document?
- The component's own defaults are in `@layer nfs-defaults`, and `theme()`'s
  output is **unlayered on purpose** so it beats them regardless of DOM order
  (R008). Confirm the addon inherits that property for free rather than needing
  order tricks.
- What `$selector` the addon compiles with -- `.button` (retheming everything)
  or a scoped selector. Retheming everything is probably right for a theming
  addon; say so explicitly rather than leaving it implicit.

**The R026 question -- no longer hypothetical. It FIRES.** Ticket 06 verified by
execution that `.storybook/*.ts` is inside the library's ESLint scope, and that
linting research/02's exact preview skeleton against
`packages/ngx-foundation-sites/eslint.config.mjs` produces **2 R026 errors**:
`createElement('style')` and `node.textContent = css`. Since ticket 06 also
locked the addon as resident in `.storybook/`, this must be resolved here, not
designed around.

Decide the explicit `ignores` (or equivalent scoping) that lets the addon inject
compiled CSS while keeping R026 fully live for library source. Two hard
constraints:

- **Relocating the addon to escape the rule is NOT an acceptable resolution.**
  Ticket 06 flagged this as the strongest-looking argument for a separate
  package and rejected it: moving the files would silence the rule silently
  rather than state where its boundary falls.
- **`nfs-button.r026-lint.spec.ts:65-67` asserts that exactly 2
  `no-restricted-syntax` blocks exist.** Adding a third block silently breaks
  the `test` target. So the scoping must be expressed without changing that
  count, or the spec's expectation must be updated deliberately as part of the
  same decision -- state which, and why it still fails loudly on a real
  violation.

State the principle plainly for the record: R026 bans a hand-fed CSS string as
the *component's styling source*; a dev-only Storybook addon injecting
browser-compiled output is outside that ban. The `ignores` encodes exactly that
line.

**Recompile trigger and loading/error UX** -- graduated from the map's fog now
that ticket 05 has measured it, and therefore part of THIS decision:

- Compilation is **280-305 ms warm, 556 ms cold** on the main thread, which
  blocks it outright (337 ms max rAF gap, ~20 dropped frames). **A single Worker
  removes the block (19.1 ms max gap) and is ~30% FASTER (197 ms median)**, so
  worker-backed sync compilation is effectively free and should be the default;
  a pool is not needed. Async-in-browser is 6-7x slower -- do not use it.
- Given ~200 ms worker-backed, decide the debounce/trailing-edge policy for
  continuous input (a dragged color picker), and whether in-flight compiles are
  cancelled or superseded.
- Decide what the panel shows mid-compile and on a Sass error. Note ticket 03's
  finding that error messages carry ANSI escape codes unless `alertColor: false`,
  and that a Worker degrades the missing-importer diagnostic.

## Notes

Blocked by 05, now resolved: the measurements are in, so prefer the simplest
model they permit rather than speculative machinery.

**Ticket 07 (compliant palette single source) is in flight in parallel.** Treat
the palette's *location and read mechanism* as 07's to decide; this ticket owns
the *comparison semantics*, the control surface, injection, and the R026
resolution. If 07 lands first, read
`../research/07-compliant-preset-single-source.md` before fixing the
preset-equality model.

## Answer

Full reasoning: `../research/09-control-surface-and-state-model.md`.

**SPIKE FIRST (routed from ticket 08) -- CLOSED, the Worker holds.** Ticket 08's
single highest-risk unknown is resolved two ways. *Source:*
`@storybook/angular` merges with
`module = { ...baseConfig.module, rules: [...cliConfig.module.rules, ...] }` --
only Angular's `rules` are taken, so `cliConfig.module.parser` (carrying
`worker: !!webWorkerTsConfig` = false) is **discarded**, and Storybook's base
sets no `module.parser`, so webpack's default applies. *Execution*
(`../prototypes/worker-spike.mjs`, real webpack 5.105.2, 4 variants): a separate
worker chunk **is** emitted and the marker is absent from the entry chunk, for
both classic and `{type:'module'}` workers. Negative control with
`worker: false` emits no worker code at all, with zero errors and zero warnings.
Decision D is written against the Worker world; no fallback needed.

**A. Control surface** -- PANEL only, no toolbar (addon-a11y's TOOL precedent
does not transfer to 7 controls). Colour is a native `<input type="color">` plus
a text field; invalid input never reaches globals. **Radius is a JS `number` of
integer CSS px.** The globals value is a **sparse, canonical-minimal override
map** with `initialGlobals.nfsTheme = {}`, matching `theme()`'s own
optional-argument semantics -- so the compile path needs no resolution step, and
in-session state is byte-identical to post-reload state.

**B. Preset semantics** -- confirmed derived, never stored. Canonical form on
write makes sparse equality *equal* resolved equality (stated as a theorem), so
the check reduces to six scalars. `Custom` is a literal option; first match wins.

**C. Injection** -- one `<style id="nfs-theming">` in `document.head`, shared
across story and docs mode (per-story docs scoping rejected on cost: N x 197 ms).
`$selector` stays the default `.button`, retheming everything.

**D. Recompile UX** -- worker-backed sync compile, lazily constructed. **No
debounce timer; a single-slot latest-wins coalescer** -- it self-tunes to the
machine, preserves live drag feedback, and needs no magic number. Supersede,
never cancel (terminate+respawn costs 3-4x). Progress indicator only past
300 ms. Last good CSS survives errors.

**E. R026** -- one `ignores` entry on the **existing** non-spec block, so the
block count stays 2 and `nfs-button.r026-lint.spec.ts`'s `toHaveLength(2)` is
untouched. Plus two new spec tests, including one proving a *sibling* file still
fires.

**Three findings that change prior assumptions:**

1. **One invalid value drops the ENTIRE theme from the URL**, not just its key
   -- verified against the real `buildArgsParam` (five valid hex colours
   discarded alongside one bad radius). Research/02 understated this as "my link
   lost the radius". It is why the panel must be the validation boundary.
2. **The R026 `ignores` glob must be `**/`-prefixed.** `@nx/eslint:lint` calls
   `process.chdir(systemRoot)`, and ESLint 9.39.5 resolves flat-config `ignores`
   against **cwd, not the config file's directory**. A config-dir-relative glob
   was verified inert under Nx while still passing the spec harness -- i.e.
   green `nx test`, red `nx lint`.
3. **R008's cascade win is verified in real Chromium**, not assumed: unlayered
   beats `@layer nfs-defaults` in all four insertion orders, with a control
   proving the probe detects order. No order tricks needed.

Also verified: structured clone silently drops `sassMessage`/`span` from a
`sass.Exception`, so the Worker must serialise errors to a plain object.

**One reconciliation:** ticket 07 landed mid-run instructing "no TS copy of the
six values". A draft proposal to bake them into a generated module was dropped
in favour of 07's in-Worker probe. The sparse-map model makes this painless --
only the *panel* waits on the probe, never the preview.
