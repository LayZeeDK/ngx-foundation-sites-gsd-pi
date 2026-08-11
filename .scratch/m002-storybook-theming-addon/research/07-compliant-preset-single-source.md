# Compliant preset: single source of truth -- findings

Resolves ticket `.scratch/m002-storybook-theming-addon/issues/07-compliant-preset-single-source.md`.
Status: **resolved, decision LOCKED** (AFK -- no human in the loop, per map.md Notes).

No repo code was changed. Only `.scratch/` was written. Two throwaway Node probes
were created under `.scratch/`, executed, and deleted; their output is quoted
inline so every measurement is reproducible.

## Evidence key

- **[V-REPO]** -- verified by reading a tracked file in THIS repo (path + line cited).
- **[V-EXEC]** -- verified by executing a read-only command here, output quoted.
- **[V-EVID]** -- verified from a committed execution-evidence artifact in this repo.
- **[V-PRIOR]** -- carried from ticket 01 / 03 / 06's own verification, cited.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

---

## 1. THE LOCKED DECISION

> **The WCAG-compliant palette becomes `$wcag-palette`, a plain public Sass
> map declared in the EXISTING public entry point
> `packages/ngx-foundation-sites/src/scss/_button.scss` -- already exported as
> `ngx-foundation-sites/scss/button` -- and everything reads it from there: the
> demo app via `@include nfs-button.theme($palette: nfs-button.$wcag-palette)`,
> and the Storybook addon by capturing it (together with Foundation's own
> defaults from `internal/_settings.scss`) through a custom Sass function
> registered on the `compileString` call the addon already makes. No new Sass
> file, no new `exports` key, no `verify-exports-map` change, no `ng-package.json`
> change, no new Nx target, and no generated JSON/TS artifact.**

That is ticket option 1 in substance, with the location question settled one rung
lazier than the ticket assumed: **the single source is a new MEMBER of an
existing public module, not a new `scss/_presets.scss` module.** Section 6 shows
why the extra file is the expensive form of the same idea.

Two riders, both load-bearing:

- **No `compliant-theme()` convenience mixin.** `@include nfs-button.theme($palette: nfs-button.$wcag-palette)`
  is already one line and already composes with `$selector`, `$background` and
  `$radius`. A wrapper mixin is a second thing to keep in sync with the first.
- **The demo app IS rewired, and that is M002 scope** -- but it carries a
  mandatory `nx run nfs-demo:verify-registry-consumption` re-run, because
  `apps/nfs-demo` consumes a real published tarball, not the workspace source
  (section 7). This is the single most consequential thing this ticket found and
  it is not mentioned anywhere in the map.

---

## 2. The enumeration: five tracked files, six sites

`git grep -n -i -e "238648" -e "9e6c00" -e "cb4b37"` over tracked files, with
`.scratch/` excluded [V-EXEC]. Ticket 01's count of five FILES is exact; the
count of SITES is six, because README carries two.

| # | Site | Kind | What it restates |
| --- | --- | --- | --- |
| 1 | `apps/nfs-demo/src/styles.scss:27-34` | **EXECUTABLE** | The full map, inside the `.theme-compliant` `theme()` invocation. The only instance that compiles to CSS. |
| 2 | `packages/ngx-foundation-sites/README.md:171` | prose | All three hexes, twice in one paragraph -- once as ratio claims, once as a verbatim `@include` snippet. |
| 3 | `packages/ngx-foundation-sites/README.md:90` | prose | `success: #238648` alone, in the "The theme mixin" code sample. |
| 4 | `apps/nfs-demo/src/app/app.component.ts:105-106` | comment | All three hexes, in the block comment above `data-testid="a11y-variants-compliant"`. |
| 5 | `apps/nfs-demo/e2e/nfs-button-a11y.spec.ts:107` | comment | All three hexes, in the `m002-compliant` fixture's explanatory comment. |
| 6 | `packages/ngx-foundation-sites/src/scss/_button.scss:13` | doc comment | `success: #238648` alone, as the illustrative `$palette` argument in the public API header. |

Files 2+3 are one file, so: **five files, six sites, one of them executable.**

Note what this shape means. Five of the six are prose or comments; exactly ONE
compiles. So the repo does not yet have "the compliant theme" as an artifact at
all -- it has one app-local invocation plus five descriptions of it. That is
precisely the founding-brief correction map.md records, and it is why D023 is
undischarged [V-PRIOR: map.md "Correction to the founding brief"].

### The adjacent set this ticket deliberately does NOT collapse

Foundation's DEFAULT palette is restated the same way, and it is a different
problem with a different (already-correct) answer:

- `packages/ngx-foundation-sites/src/scss/internal/_settings.scss:17-21` -- the
  real definitions [V-REPO].
- `apps/nfs-demo/e2e/nfs-button-a11y.spec.ts:68-93` -- `#cc4b37`, `#3adb76`,
  `#ffae00` as `expectedContrastFailures` data [V-REPO].
- `packages/ngx-foundation-sites/README.md:99,163-165,175` -- the contrast table
  and the hollow-background discussion [V-REPO].

The a11y spec's copies are **assertion fixtures**, not configuration: D023
requires an "exact expected-failure assertion, never a blanket suppression", and
an exact assertion has to name the values it expects. Collapsing them into an
import would make the gate assert its input against itself. Leave them. The
README table is documentation of measured ratios, same reasoning. Flag for
ticket 10 only: those literals must still be re-read if Foundation is ever
upgraded, which is what `verify-foundation-parity.mjs` already covers at the
declaration level [V-REPO: `packages/ngx-foundation-sites/scripts/verify-foundation-parity.mjs`].

---

## 3. Mechanism Q1: how the addon (TS/JS) reads a canonical value that lives in Sass

**Decision: a custom Sass function registered on the compile the addon is
already performing. Verified working on the BROWSER code paths.**

### Why this is the lazy answer, not a clever one

The addon is not a build step that happens to touch Sass. It is *a Sass
compiler*: ticket 03 proved the real `theme()` chain compiles to 5842 bytes from
a pure in-memory string map, on the browser entry point, with no filesystem
[V-PRIOR: research/03 section 0]. The compiler, the source strings (including
`nfs:/internal/_settings.scss`), and the importer are all already present for
the addon's primary job. Reading a value out of that same compiler is a two-line
options-bag addition, not an integration.

### Verified [V-EXEC]

Probe 1 -- Node side, against an in-memory-patched copy of the real
`_button.scss` (the repo file untouched):

```
--- PROBE 1: node-side custom-function extraction ---
css: "a {\n  captured: captured;\n  inspected: (success: #238648, warning: #9e6c00, alert: #cb4b37);\n}"
captured map -> {"success":"#238648","warning":"#9e6c00","alert":"#cb4b37"}
bytes emitted by @use alone: 0
```

Three facts in that output:

1. `functions: { 'capture($name, $value)': fn }` hands the callback a real
   `SassMap`; `.contents.forEach` yields typed keys and values. No string
   parsing.
2. `meta.inspect()` is a working zero-`functions` fallback -- it round-trips the
   map into the CSS as `(success: #238648, warning: #9e6c00, alert: #cb4b37)`.
   Cheaper to reach for, more expensive to trust (you own the parser).
3. **`@use`-ing the patched module still emits 0 bytes.** Adding a public
   variable does not violate `_button.scss`'s documented "emits NOTHING on load"
   contract [V-REPO: `src/scss/_button.scss:25`], which the addon's
   compile-twice-per-keystroke model depends on.

Probe 3 -- the same mechanism on the browser build (`sass/sass.default.js`
loaded under browser globals, `process` removed), with a control proving we are
really on the browser code paths [V-EXEC]:

```
control -- compile() says: The compile() method is only available in Node.js.
browser css: "a {\n  x: ok;\n}"
browser captured map -> {"success":"#238648","warning":"#9e6c00","alert":"#cb4b37"}
```

The `functions` option is not one of the Node-only surfaces. (Note for whoever
re-runs this: the browser entry needs `globalThis.document.scripts = []` or
dart2js dies at `sass.dart.js:133210` before you reach any API; and
`import('sass/sass.default.js')` is itself blocked by `sass`'s own `exports` map
-- import it by file URL. That second point is a neat corroboration of section 5.)

### Why the alternatives lose

- **Generate a JSON artifact at build time.** Costs a new `verify-*`-shaped
  script, a new Nx target, an `outputs`/`inputs` entry, and a cache-invalidation
  question -- and it creates a stale-artifact window that is exactly the failure
  class ticket 06 spent section 2.3 warning about (green output, absent change)
  [V-PRIOR: research/06 section 2.3]. It buys nothing: the addon has a compiler
  at runtime, so it does not need a precomputed answer.
- **Invert the direction (TS canonical, Sass generated).** Then the library's
  own shipped `_button.scss` -- the thing consumers `@use` and the thing
  `verify-foundation-parity` compiles -- becomes a build product of a
  Storybook-adjacent TS file. That inverts the dependency ticket 06 explicitly
  forbade ("let the addon consume the library, not the reverse"
  [V-PRIOR: research/06 section 9]), and it makes an addon file part of the
  published surface.
- **Compile-and-parse the emitted CSS** (read `background-color` off a probe
  rule). Works, but couples the extractor to Foundation's emission shape --
  contrast-picked text colors, `border-radius` omitted when `0`, hover derived
  by `scale-color`. A custom function reads the INPUT map instead of
  reverse-engineering the OUTPUT.
- **`meta.inspect()` + regex.** The honest lazier option; name it and skip it.
  It is one line shorter and hands you a string you must then parse. Take it
  only if ticket 09 finds a reason the `functions` option is unavailable.

---

## 4. Mechanism Q1b: the preset the addon actually seeds

Ticket 09 needs a FULLY RESOLVED control set, not the sparse override map. Both
presets, resolved, measured by probe 2 [V-EXEC]:

```
--- PROBE 2: internal/_settings.scss via load path ---
default palette -> {"primary":"#1779ba","secondary":"#767676","success":"#3adb76","warning":"#ffae00","alert":"#cc4b37"}
default background -> #1779ba
default radius -> 0
```

| Control | Foundation-default preset | WCAG-compliant preset |
| --- | --- | --- |
| primary (`$background`) | `#1779ba` | `#1779ba` (inherited) |
| secondary | `#767676` | `#767676` (inherited) |
| success | `#3adb76` | **`#238648`** |
| warning | `#ffae00` | **`#9e6c00`** |
| alert | `#cc4b37` | **`#cb4b37`** |
| radius | `0` | `0` (inherited) |

So the compliant preset resolves to **three overrides over the same three
defaults**, and preset equality is a six-way comparison against those resolved
values. Confirmed against the live axe fixture: `styles.scss`'s
`.theme-compliant` invocation passes no `$background`, so its primary is
Foundation's `#1779ba` at 4.647:1, and `nfs-button-a11y.spec.ts`'s
`m002-compliant` fixture is green with `expectedContrastFailures: []`
[V-REPO: `apps/nfs-demo/e2e/nfs-button-a11y.spec.ts:113-118`]. The demo's
`$background: #2a5db0` applies only to the UNSCOPED default theme, and loses to
the later, equal-specificity `.theme-compliant` rules on those elements [INFER
on the cascade arithmetic; the green fixture is the verified part].

**Do not change the three compliant values.** They are the only palette in this
repo with a passing axe proof attached.

---

## 5. Mechanism Q2: does `internal/*: null` block reading Foundation's defaults?

**No. Not partially, not with a workaround -- it is a non-issue, and the repo
already recorded that it would be.** Three independent confirmations:

1. **The exports map's own comment says so, in advance.**
   `packages/ngx-foundation-sites/package.json:8` [V-REPO]:

   > "Null makes an exports-respecting resolver refuse them while a plain Sass
   > load path still reaches them, **which is what the planned in-browser
   > theming addon compiles against**."

   The `null` was designed with this addon in mind. Reading `internal/` from the
   addon is not an escape hatch; it is the documented intent.

2. **The README states the measured resolver behaviour.**
   `packages/ngx-foundation-sites/README.md:123` [V-REPO]: exports-reading
   resolvers (Node, `enhanced-resolve`, Vite, esbuild) reject
   `ngx-foundation-sites/scss/internal/*` with `ERR_PACKAGE_PATH_NOT_EXPORTED`,
   while **Sass load-path resolution still reaches it -- including Dart Sass's
   own `pkg:` importer, "measured to ignore `exports` for subpaths entirely
   (1.102.0: even an `exports` entry pointing at a nonexistent target still
   resolves the real file)"**. The same line closes with: "That reachability is
   deliberate and cannot be closed."

3. **Executed here.** Probe 2 above read `settings.$button-palette`,
   `$button-background` and `$button-radius` through
   `loadPaths: ['packages/ngx-foundation-sites/src/scss', ...]` with no error
   [V-EXEC].

And in the browser it is more decisively a non-issue: `loadPaths` is inert
there, the addon serves every byte from its own `Map<string,string>` under its
own URL scheme, and `internal/_settings.scss` is already in that map because
`theme()` cannot compile without it [V-PRIOR: research/03 section 2, 16 loaded
URLs including `nfs:/internal/_settings.scss`]. There is no resolver in that
path to consult an `exports` map.

**Consequence: the defaults are NOT promoted to public API.** No
`$default-palette` / `$default-background` / `$default-radius` re-exports. The
only consumer of the resolved defaults is the addon plus its tests, and both
read Sass through load paths or an in-memory importer, so both bypass `exports`.
Exporting them publicly would be speculative generality bought at the price of
an `exports`-map key.

---

## 6. Mechanism Q3: public API impact -- exactly what changes

**One new public member on an existing public module. The `exports` map, the
`verify-exports-map` gate, and `ng-package.json` are all UNTOUCHED.**

`_button.scss` is exported twice over: explicitly as `"./scss/button": "./scss/_button.scss"`,
and incidentally by the `"./scss/*": "./scss/*"` identity map
[V-REPO: `packages/ngx-foundation-sites/package.json:9-14`]. It is already the
file every consumer `@use`s, already the file the addon compiles, already
shipped by `ng-package.json`'s single `{glob: "**/*.scss", input: "src/scss"}`
asset rule [V-REPO: `ng-package.json:5-11`], and already 5.9 kB in the published
tarball [V-EVID: `apps/nfs-demo/.registry-consumption-evidence.txt`, npm publish
manifest]. Adding `$wcag-palette` to it changes zero configuration.

### Why a separate `scss/_presets.scss` is the expensive form of this

It would need a NEW `exports` alias key. The identity map `"./scss/*": "./scss/*"`
maps `ngx-foundation-sites/scss/presets` to `./scss/presets`, which does not
exist -- Sass's partial convention (`_presets.scss`) is not something the
package-exports resolver applies. The proof is sitting in the map: the explicit
`"./scss/button"` alias exists at all only because the identity entry did not
cover the partial-name form, and the `//exports` comment states that without
these keys "every documented Sass/CSS subpath fails `ERR_PACKAGE_PATH_NOT_EXPORTED`
under any resolver that honours `exports`" [V-REPO: `package.json:8-14`].
[INFER on the resolver's candidate list; VERIFIED that the alias key exists and
that the comment attributes exactly this purpose to it.]

Adding that key costs, concretely:

- an `exports` edit in `packages/ngx-foundation-sites/package.json`, which is a
  declared `input` of the `verify-exports-map` target
  [V-REPO: `project.json:88-99`];
- `verify-exports-map` `dependsOn: ["build"]`, and `lint` `dependsOn: [..., "verify-exports-map"]`
  [V-REPO: `project.json:68-75, 88-99`] -- so the edit re-runs ng-packagr and
  the published-exports gate;
- and it is the ONE gate ticket 06's decision was specifically engineered to
  leave alone [V-PRIOR: research/06 section 7 "Untouched"].

A second file buys separation-of-concerns for a `theme()` that is button-only
today, and whose per-component-vs-global control surface map.md lists under "Not
yet specified". Ship the member; the file can be extracted the day a second
component has a theme mixin, and extracting it is then a mechanical `@forward`.

### The one honest cost of the chosen shape

`_button.scss`'s header calls itself "NfsButton's PUBLIC Sass API" and the file
is currently pure behaviour (one mixin) over private data. It gains one data
member. That reads fine -- `$wcag-palette` is keyed exactly like the
`$palette` argument of the mixin directly below it, so the definition and its
only consumer sit in the same file. Declare it a plain assignment, NOT `!default`,
matching `internal/_settings.scss`'s recorded reasoning: there is no
`@use ... with (...)` configuration surface left in this API
[V-REPO: `internal/_settings.scss:1-9`].

Site 6 of the enumeration (`_button.scss:13`'s `success: #238648` doc-comment
example) then sits three lines above the real definition. It is illustrative, not
a restatement, and at zero drift distance. Leave it.

---

## 7. Mechanism Q4: does the demo app get rewired -- and the tarball trap

**Yes, and it is M002 scope. It is also the riskiest edit in this decision,
because `apps/nfs-demo` does not consume the workspace source.**

This is not in map.md and it changes the sequencing.

**VERIFIED** [V-REPO + V-EVID + V-EXEC]:

- `apps/nfs-demo/package.json` declares `"ngx-foundation-sites": "0.0.1-registryproof.0"`
  and its `"//"` comment states the library "is still installed here as a real
  registry tarball and still gated by `scripts/verify-registry-consumption.mjs`"
  (D014/D015) [V-REPO: `apps/nfs-demo/package.json:4-11`].
- `apps/nfs-demo/node_modules/ngx-foundation-sites/` is a **real extracted
  directory, not a symlink**, containing `scss/`, `css/`, `fesm2022/`, `types/`,
  `package.json`, `README.md` [V-EXEC: `ls -la`].
- The root `node_modules/ngx-foundation-sites` symlink points at
  `packages/ngx-foundation-sites` (the SOURCE), whose top level has **no
  `scss/` directory at all** -- only `src/scss/` [V-EXEC]. So
  `@use 'ngx-foundation-sites/scss/button'` cannot be resolving from the
  workspace; it resolves from the demo's own extracted tarball.
- `apps/nfs-demo/.registry-consumption-evidence.txt` records the whole loop:
  build -> publish to local Verdaccio -> isolated `npm install` in
  `apps/nfs-demo` -> build CSR + SSR -> assert the output has **no reference to
  `packages/ngx-foundation-sites/src`** [V-EVID]. Its publish manifest lists
  `scss/_button.scss`, `scss/internal/_foundation-button.scss`,
  `scss/internal/_settings.scss` -- 9 files, 18.5 kB.
- `verify-registry-consumption` is a standalone Nx target with **no `dependsOn`
  and nothing depending on it** [V-REPO: `apps/nfs-demo/project.json:130-136`].
  It is run by hand; the evidence file is the committed record.

### What that means for this ticket

The installed tarball is a **snapshot**. Adding `$wcag-palette` to source
does not reach the demo app. If `styles.scss` is re-pointed to
`nfs-button.$wcag-palette` without refreshing the tarball, the demo's Sass
compile fails outright with `Undefined variable` -- and it fails in
`nfs-demo:build`, which `serve` / `serve-static` / `serve-ssr` / `serve-ssr-node`
all feed, which `e2e` depends on [V-REPO: `apps/nfs-demo/project.json:118-129`].
The axe suite goes red for a resolution reason, not a contrast one.

**So the rewire is one atomic change with three parts, in this order:**

1. Add `$wcag-palette` to `packages/ngx-foundation-sites/src/scss/_button.scss`.
2. Run `nx run nfs-demo:verify-registry-consumption` (rebuild -> republish ->
   reinstall) and commit the refreshed
   `apps/nfs-demo/.registry-consumption-evidence.txt`. This is already the
   established workflow -- HEAD's `1c1f770` is literally "Captured fresh,
   current-main execution evidence" [V-EXEC: `git log`].
3. Re-point `apps/nfs-demo/src/styles.scss:27-34` to
   `$palette: nfs-button.$wcag-palette`.

Splitting this across commits leaves a broken demo build in between. Deferring
it to a follow-up is worse: the demo's copy is the one the axe fixture actually
scans, so leaving it is leaving the ONE executable restatement uncollapsed --
the entire point of the ticket.

### Bonus: this makes the D023 proof stronger, not weaker

Because the demo consumes a published tarball, the compliant palette gets its
zero-violations axe proof **through the same public `exports`-gated subpath a
real npm consumer would use**, in both a CSR and an SSR build. That is a better
discharge of D023 than a workspace-relative import could ever be.

### README prose (sites 2 and 3)

`README.md:171` is rewritten to name the constant and show
`@include nfs-button.theme($selector: '.theme-compliant', $palette: nfs-button.$wcag-palette)`.
**Keep the three hexes in the surrounding sentence** -- the paragraph's value is
the concrete ratio claims, and a contrast discussion that refuses to name colors
is worse documentation. Same for the `README.md:163-165` default-theme table.
`README.md:90`'s `success: #238648` in the "The theme mixin" sample should
become a neutral illustrative color (it is teaching the `$palette` ARGUMENT, and
using a compliance-loaded value there is what made it look like a restatement in
the first place).

Sites 4 and 5 (`app.component.ts:105-106`, `nfs-button-a11y.spec.ts:107`) are
pure comments: delete the hexes, name `nfs-button.$wcag-palette` instead.
Zero risk, zero mechanism.

**Net after the collapse: one executable definition, one prose reference that
deliberately keeps measured values, and zero comment copies.** From 6 sites to
1 + 1 documented exception.

---

## 8. Mechanism Q5: how D023 is discharged

D023 (human, standing) has three clauses [V-PRIOR: map.md "Standing constraints"].
Plainly, clause by clause:

1. **"Foundation's default theme ships unchanged."** Untouched. `theme()`'s
   zero-argument path still reads `settings.$button-background` and
   `settings.$button-palette`; `$wcag-palette` is inert data that emits
   nothing until a consumer passes it (probe 1: 0 bytes on `@use`).
   `verify-foundation-parity` compares compiled DECLARATIONS and is blind to a
   variable [V-REPO: `verify-foundation-parity.mjs:176-190`], so it stays green
   for the right reason.
2. **"A WCAG/axe-compliant theme SHIPS in M002."** This is the clause M003 left
   open, and this decision is what closes it. Before: the palette existed only
   as an app-local invocation plus five descriptions -- the library shipped
   nothing. After: `$wcag-palette` is a member of the library's public Sass
   API, present in the published tarball's `scss/_button.scss`, reachable by any
   consumer as `@use 'ngx-foundation-sites/scss/button' as nfs-button;` ->
   `nfs-button.$wcag-palette`. **"Ships" becomes literally true**: it is in
   the artifact, not in the demo app.
3. **"The axe suite runs against it, and the default theme keeps an exact
   expected-failure assertion, never a blanket suppression."** Both preserved
   unchanged, and section 2 explains why the default theme's three
   `expectedContrastFailures` literals must NOT be collapsed into an import: an
   exact-set assertion has to name what it expects, or it asserts its input
   against itself. The `m002-compliant` fixture keeps
   `expectedContrastFailures: []` and now scans CSS compiled from the shipped
   constant rather than from a hand-typed app-local copy.

What this ticket does NOT discharge, and hands to ticket 10: D023 says "the axe
suite runs against the compliant theme" -- once that theme is also a *selectable
addon preset*, whether the Storybook-side a11y scan must ALSO cover it is
ticket 10's call [V-PRIOR: map.md "Not yet specified"]. This decision keeps both
routes open by putting the source where both can reach it.

---

## 9. Downstream consequences: touched vs untouched

### Touched

| Path / target | Change | Gate impact |
| --- | --- | --- |
| `packages/ngx-foundation-sites/src/scss/_button.scss` | ADD `$wcag-palette` map (plain assignment, not `!default`) + a doc comment; neutralize the illustrative `#238648` at line 13 or leave it | `verify-foundation-parity` re-runs (declaration-level, unaffected); `build`, `compile-default-css`, `build-storybook`, `test`, `test-browser` all re-run via the `production` input |
| `apps/nfs-demo/src/styles.scss:27-34` | REPLACE the literal map with `nfs-button.$wcag-palette` | `nfs-demo:build` / `build-ssr` / `e2e` -- **and it HARD-FAILS unless the tarball is refreshed first (section 7)** |
| `apps/nfs-demo/.registry-consumption-evidence.txt` | REGENERATE by running `nx run nfs-demo:verify-registry-consumption` | that target only; nothing depends on it |
| `packages/ngx-foundation-sites/README.md:90,171` | Point at the constant; keep the measured hexes in the accessibility prose | none (docs) |
| `apps/nfs-demo/src/app/app.component.ts:105-106` | Comment only -- drop hexes, name the constant | none |
| `apps/nfs-demo/e2e/nfs-button-a11y.spec.ts:107` | Comment only -- drop hexes, name the constant. **Assertion data at `:68-93` unchanged** | none |
| `packages/ngx-foundation-sites/.storybook/<addon modules>.ts` | The addon's compile call gains a `functions` entry and one probe compile at panel init | ticket 09 owns |

### Untouched -- the payoff

- **`packages/ngx-foundation-sites/package.json`'s `exports` map** -- no new key,
  no changed key. The single most valuable thing this shape protects.
- **`packages/ngx-foundation-sites/scripts/verify-exports-map.mjs` and the
  `verify-exports-map` target** -- and therefore the `lint -> verify-exports-map -> build`
  chain does not acquire a new reason to churn [V-REPO: `project.json:68-99`].
- **`packages/ngx-foundation-sites/ng-package.json`** -- the existing
  `src/scss` `**/*.scss` asset glob already ships the file.
- **`packages/ngx-foundation-sites/project.json`** -- no new target. In
  particular NO codegen target and NO `outputs` entry for a generated artifact.
- **`nx.json`** -- no new `namedInputs`, no new `targetDefaults`.
- **`apps/nfs-demo/package.json`** -- the pinned version string does not change;
  `verify-registry-consumption` republishes the same
  `0.0.1-registryproof.0` version and drops the lockfile entry to force a refetch
  [V-EVID].
- **`apps/nfs-demo/e2e/nfs-button-a11y.spec.ts`'s fixture DATA** -- both
  `expectedContrastFailures` arrays are untouched. D023's "never a blanket
  suppression" clause is not even approached.
- **`packages/ngx-foundation-sites/src/scss/internal/*`** -- no change, and no
  promotion to public.
- **`packages/ngx-foundation-sites/eslint.config.mjs`** -- R026 is an addon-code
  question (ticket 09), not a palette question.
- **No new npm dependency, no new file anywhere in `src/`.**

---

## 10. What this constrains for tickets 09 and 10

### Ticket 09 -- control surface and state model

- **The preset table is section 4's, resolved.** Six controls; the compliant
  preset differs from the default in exactly three. Preset equality compares all
  six resolved values, per the ticket's own framing.
- **Read both presets from Sass, in one probe compile at panel init.** Register
  one `functions` entry; capture `nfs-button.$wcag-palette` from the public
  module and `settings.$button-palette` / `$button-background` / `$button-radius`
  from `internal/settings`. Do NOT hard-code any of the six values in TS -- that
  reintroduces exactly the copy this ticket removed, and ticket 01's evidence
  (three mutually inconsistent "compliant" palettes coexisting in the reference
  at HEAD, at `_nfs-settings.scss:24-30`, `theme-defaults.ts:65-71` and
  `theme-cache-db.ts:38` [V-PRIOR: research/01 T4]) is what that costs. The
  reference's drift was TS-constant-vs-Sass drift specifically.
- **Budget the probe compile.** ~150-215 ms sync, cold start ~243 ms
  [V-PRIOR: research/03 section 3]. It happens once. If the addon compiles in a
  Worker (research/03's recommendation), the probe belongs in the Worker too --
  and note Workers have no `document`, so Dart Sass reports `isBrowser() === false`
  there and diagnostics degrade [V-PRIOR: research/03 section 1 Trap B].
- **Middle-option rule 2 has a wrinkle, and it is ticket 08/09's, not this
  ticket's.** Rule 2 says the addon consumes the library only through
  `ngx-foundation-sites/scss/button` [V-PRIOR: research/06 section 6]. But that
  specifier is **unresolvable from the workspace root today**: the symlink points
  at the source tree, which has `src/scss/`, not `scss/` [V-EXEC, section 7].
  The demo app only gets away with it because it resolves from an extracted
  tarball. However the addon gets `.scss` TEXT into its webpack bundle, it will
  not be by resolving that public specifier. Ticket 08 owns the mechanism;
  ticket 09 should not treat rule 2 as already satisfied.
- `$wcag-palette` living in `_button.scss` keeps the addon's own module
  count unchanged, which preserves ticket 06's flat-`.storybook/` viability
  [V-PRIOR: research/06 section 9].

### Ticket 10 -- R021 verification, including D023's axe obligation

- **The sequencing constraint is a gate concern.** Any CI ordering that touches
  `_button.scss` and `apps/nfs-demo/src/styles.scss` must refresh the demo's
  tarball in between (section 7). Consider whether
  `nfs-demo:verify-registry-consumption` should acquire a `dependsOn` or be
  wired into the battery, given it currently has neither and nothing depends on
  it [V-REPO: `apps/nfs-demo/project.json:130-136`]. That is a genuine
  fail-silent surface: a stale tarball means the demo builds against yesterday's
  public API.
- **The cheap, high-value check this decision earns.** A Vitest spec (the
  `test` lane, Node) that compiles `@use '<button>'; ... capture($wcag-palette)`
  via the `verify-foundation-parity.mjs` harness pattern
  [V-REPO: `verify-foundation-parity.mjs:29-34,176-190`] and asserts the three
  entries against WCAG AA ratios. That turns "these values are compliant" from a
  README claim plus a Playwright run into a fast unit assertion, and it is the
  ONE runnable check the collapse needs.
- **Optional, named, not mandated: a README-drift assertion.** After the
  collapse the README is the only place a compliant hex is still typed by hand.
  A ~15-line check (read README, assert every hex in the Accessibility paragraph
  appears in the compiled `$wcag-palette`) would close the last drift
  surface. Cheap, but it is documentation drift, not correctness drift -- the
  axe fixture is the real gate. Ticket 10's call.
- **D023's axe question is unchanged in shape but better anchored.** The existing
  `m002-compliant` fixture now scans CSS compiled from the shipped constant, and
  it does so through a published-tarball consumer in both CSR and SSR
  [V-EVID]. Whether the Storybook-side scan must ALSO cover the preset once it
  is selectable remains ticket 10's open choice; nothing here forecloses either
  option.
- **`@storybook/addon-a11y` re-pointing costs nothing extra**: addon CSS provably
  survives `build-storybook` [V-PRIOR: research/02 section 8].

---

## 11. Verified vs inferred

**VERIFIED** -- every `[V-REPO]`, `[V-EXEC]`, `[V-EVID]` claim above,
specifically: the six-site enumeration and its exact line numbers; the
default-palette adjacent set at `_settings.scss:17-21`,
`nfs-button-a11y.spec.ts:68-93`, `README.md:99,163-165,175`; that a custom Sass
function captures a real `SassMap` on BOTH the Node and the browser code paths,
with `compile()`'s Node-only throw as the browser-mode control; that
`meta.inspect()` is a working fallback; that adding a public variable to
`_button.scss` still emits 0 bytes on `@use`; that Foundation's defaults are
readable from `internal/_settings.scss` through a plain load path despite
`"./scss/internal/*": null`, with the `//exports` comment and `README.md:123`
both recording that as designed and measured; the fully resolved six-value
control set for both presets; that `_button.scss` is exported both explicitly
and by the identity map, is shipped by the single `ng-package.json` asset glob,
and is present in the published tarball; the `lint -> verify-exports-map -> build`
dependency chain; that `apps/nfs-demo` consumes a real extracted registry
tarball rather than the workspace source, that the root symlink's target has no
top-level `scss/` directory, and that `verify-registry-consumption` is an
unwired manual target with a committed evidence file; that the `m002-compliant`
axe fixture is green with `expectedContrastFailures: []`; that the browser sass
entry needs `document.scripts` and cannot be imported by bare subpath.

**INFERRED** (reasoned, would need execution to close):

- That a new `scss/_presets.scss` would REQUIRE a new `exports` alias key --
  i.e. that the `"./scss/*"` identity map does not resolve the partial-name form
  `scss/presets` -> `scss/_presets.scss`. The existence of the explicit
  `"./scss/button"` alias and the `//exports` comment's stated purpose for it are
  verified; the resolver's candidate list is not. **This is the one inference
  the decision leans on.** It is not fatal if wrong: the decision would still
  win on "one fewer file", just by a smaller margin.
- That re-pointing `styles.scss` before refreshing the tarball fails with
  `Undefined variable`. The tarball-snapshot mechanism is verified; the specific
  error text is not executed.
- The cascade arithmetic explaining why `.theme-compliant`'s primary resolves to
  `#1779ba` rather than the demo's `#2a5db0` (equal specificity, later source
  order). The green axe fixture is the verified part.

**CARRIED** from tickets 01 / 03 / 06 without re-verification, cited inline as
`[V-PRIOR]`: the reference project's three mutually inconsistent compliant
palettes; the in-memory 16-URL browser compile of the real `theme()` chain and
the inertness of `loadPaths` in the browser; the ~150-215 ms sync / ~243 ms cold
compile timings and the Worker `isBrowser()` trap; addon CSS surviving
`build-storybook`; ticket 06's "addon consumes the library, not the reverse"
rule and its untouched-gates payoff.
