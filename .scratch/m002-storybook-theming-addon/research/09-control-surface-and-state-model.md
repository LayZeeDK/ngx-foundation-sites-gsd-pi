# Control surface, preset semantics, injection and R026 -- findings

Resolves ticket `.scratch/m002-storybook-theming-addon/issues/09-control-surface-and-state-model.md`.
Status: **resolved, decisions LOCKED** (AFK -- no human in the loop, per map.md Notes).

No repo file was changed. Everything written landed in `.scratch/` or the OS
temp dir. Every command was read-only. One reproducible probe was left behind at
`.scratch/m002-storybook-theming-addon/prototypes/worker-spike.mjs`.

## Evidence key

- **[V-EXEC]** -- verified by executing a read-only command here, output quoted.
- **[V-SRC]** -- verified by reading shipped `node_modules` source (path + line).
- **[V-REPO]** -- verified by reading a tracked file in this repo.
- **[V-BROWSER]** -- verified in real Chromium via Playwright, this session.
- **[V-PRIOR]** -- carried from tickets 01-08, cited.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

Ticket 07's research file did not exist when this ticket started
(`research/07-compliant-preset-single-source.md` absent [V-EXEC]) and **landed
while it was running**. It was read before finalising, and section B.4 was
rewritten to adopt its hand-off rather than work around it: the palette's single
source is Sass, read by one custom-Sass-function probe compile in the Worker at
panel init, with **no** TS copy of the six values. Section B.4 records the
alternative that was considered and dropped.

---

## 0. SPIKE FIRST: `new Worker(new URL(...))` under Storybook's Angular webpack

Ticket 08 section 6 routed this as ticket 09's first action and named it "the
single highest-risk unknown left in M002's addon". **It is now closed:
the Worker shape HOLDS.** Two independent proofs, plus a negative control.

### 0.1 Proof by source -- Angular's `worker: false` never reaches the final config

Angular does set the flag [V-SRC:
`@angular-devkit/build-angular/src/tools/webpack/configs/common.js:324-334`]:

```js
module: {
  strictExportPresence: true,
  parser: { javascript: { requireContext: false, url: false, worker: !!webWorkerTsConfig } },
  rules: [ ... ],
}
```

But `@storybook/angular` merges the two configs like this [V-SRC:
`@storybook/angular/dist/_node-chunks/angular-cli-webpack-VNEX2DZH.js:135-137`,
read directly this session]:

```js
rulesExcludingStyles = filterOutStylingRules(baseConfig),
module = {
  ...baseConfig.module,
  rules: [...cliConfig.module.rules, ...rulesExcludingStyles]
}
```

**Only `cliConfig.module.rules` is taken. `cliConfig.module.parser` is
discarded** -- the spread base is `baseConfig.module` (Storybook's), and only
the `rules` key is overridden. And Storybook's own `baseConfig.module` sets no
top-level `parser`: the sole `parser:` occurrence in
`@storybook/builder-webpack5/dist` is a **rule-level** `dataUrlCondition` for
media assets [V-EXEC: `custom-webpack-preset.js:213`], not `module.parser`.

So the merged preview config carries **no `module.parser.javascript.worker`
setting at all**, and webpack 5's default applies. `worker` has no default in
`webpack/lib/config/defaults.js`; the schema documents it as
"Disable or configure parsing of WebWorker syntax like new Worker()"
[V-EXEC: `webpack/schemas/WebpackOptions.json`], i.e. enabled unless disabled.

### 0.2 Proof by execution -- with a negative control

`prototypes/worker-spike.mjs` builds the same entry four ways with the repo's
own `webpack@5.105.2` and greps the emitted chunks for a marker that exists only
inside the worker module [V-EXEC]:

| # | Worker syntax | `module.parser` | Separate worker chunk? | Errors | Warnings |
| --- | --- | --- | --- | --- | --- |
| A | `new Worker(new URL(...))` | **none** (= merged Storybook config) | **YES** | 0 | 0 |
| B | `new Worker(new URL(...))` | `javascript.worker: false` (= Angular's own) | **NO** | 0 | 0 |
| C | `new Worker(new URL(...), {type:'module'})` | **none** | **YES** | 0 | 0 |
| D | `new Worker(new URL(...), {type:'module'})` | `javascript.worker: false` | **NO** | 0 | 0 |

A and C are the configuration that actually ships. Both emit a separate chunk
carrying the worker code, and the marker is **absent from the entry chunk** --
which is exactly ticket 08's lazy-by-construction requirement. Classic and
`{type: 'module'}` behave identically here, so ticket 08's
`{ type: 'module' }` spelling is fine.

B and D are the negative control and they prove the probe is sensitive: with
`worker: false` the worker module is **not bundled anywhere** -- not split, not
inlined into the entry.

**Record the failure mode, because it is the nasty kind:** B and D produced
**zero errors and zero warnings**. Had the flag reached the config, the build
would have stayed green and the Worker would have 404'd at runtime. That is the
same "silently green" hazard class as research/02's four traps, and it is the
reason ticket 08's section-5 negative build assertion is not optional.

### 0.3 What is still INFERRED, and where it is caught

The spike used plain webpack, not `@ngtools/webpack`. Two residual steps:

- **`import.meta.url` surviving Angular's TS transpile.** Well-grounded:
  `packages/ngx-foundation-sites/tsconfig.json` sets `"module": "preserve"` and
  `"target": "es2022"` [V-REPO], and `.storybook/tsconfig.json` extends it
  [V-REPO]. `module: preserve` emits module syntax verbatim, so `import.meta`
  is not downlevelled. [INFER]
- **The worker `.ts` entry passing through `@ngtools/webpack`'s loader chain.**
  It must be inside `.storybook/tsconfig.json`'s `include` or the build hard-fails
  [V-PRIOR: research/02 section 4] -- a loud failure, and the one-line `include`
  cost is already budgeted by tickets 06 and 08.

Both are caught by a gate that already exists in the plan: ticket 08 section 5's
L1 assertion (the sass marker appears in exactly one emitted chunk, and that
chunk is not referenced by `iframe.html`). **No design changes on the fallback
path are needed, and decision D below is written against the Worker world.**

---

## A. Control surface

### A.1 The locked choice

> **A single custom addon PANEL (`types.PANEL`, title "Theming"), no toolbar
> entry.** Seven controls: a preset `<select>`, five colour controls
> (primary / secondary / success / alert / warning), one radius control.
>
> **A colour control is a native `<input type="color">` paired with a text
> field over one value.** The text field holds raw keystrokes in local React
> state and only commits to globals when it parses as `#rgb` or `#rrggbb`,
> normalised to lowercase `#rrggbb`. Invalid input marks the field and writes
> **nothing** to globals.
>
> **The radius wire format is a JavaScript `number` meaning integer CSS
> pixels** (`0`, `4`, `12`). The control is a range slider plus a numeric
> stepper, clamped `0..32`, step 1. The Worker emits `#{radius}px`.
>
> **The globals value is a SPARSE, canonical-minimal override map** whose shape
> is exactly `theme()`'s optional arguments, with
> `initialGlobals.nfsTheme = {}` meaning "Foundation's default theme".

### A.2 Why PANEL only

`@storybook/addon-a11y` registers both a `TOOL` and a `PANEL` from one
`addons.register` call [V-PRIOR: research/02 section 1], and that is the
idiomatic precedent for "toolbar affordance plus richer panel". It does not
transfer. a11y's `TOOL` is a **one-click vision-deficiency selector** -- a
single control worth surfacing without opening the drawer. M002's surface is
seven controls including five colour pickers; every real interaction needs the
drawer anyway. A `TOOL` would add a second React tree, a second `match`
decision and a popover, for zero interactions saved.

`match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId`, copying a11y's
own predicate [V-PRIOR: research/02 section 1]. Consequence, stated rather than
left implicit: **the panel is not available on autodocs pages, but the theme
still applies there.** Globals are owned by the Preview and survive story
navigation [V-PRIOR: research/02 section 2], and decision C's single unlayered
`<style>` in `document.head` is document-wide, so a docs page renders under
whatever theme was last chosen. Retheming requires navigating to a story. For a
dev tool that is an acceptable trade against per-story docs-mode scoping, which
decision C rejects on cost.

The panel must also honour the `storyGlobals` lock: `useGlobals()` returns a
**3-tuple** in the manager, and `storyGlobals[GLOBAL_KEY] !== undefined` means
the current story pinned the theme via `parameters.globals`
[V-PRIOR: research/02 section 2]. Render every control disabled in that state,
as a11y does -- otherwise the controls look editable and silently do nothing.

### A.3 Why `<input type="color">` is the colour control

Ladder rung 4 -- a native platform feature covers it. It costs no dependency, no
custom picker, and it renders the OS colour picker. The decisive property is not
convenience, it is **format safety**: `<input type="color">` can only ever
produce a 7-character lowercase `#rrggbb` string, which is precisely what
Storybook's `HEX_REGEXP` accepts [V-SRC:
`storybook/dist/router/index.js:57`]. Invalid values from the picker are
structurally impossible.

The paired text field exists because pasting a brand hex is the single most
likely real interaction, and a native picker cannot be pasted into. It accepts
only `#rgb` and `#rrggbb`. Four- and eight-digit hex are rejected even though
`HEX_REGEXP` would allow them: `<input type="color">` cannot produce alpha, and
Foundation's `color-pick-contrast` on a translucent colour would silently
undermine D023's contrast obligations. One regex, one normalisation.

### A.4 Why invalid input must never reach globals -- this is not a taste call

Research/02 recorded that `0.5rem` "fails quietly as *my shared link lost the
radius*". **That understates it, and the correction matters.** `buildArgsParam`
validates each **top-level** global, and `validateArgs` recurses into a nested
plain object with `Object.entries(value).every(...)` [V-SRC:
`storybook/dist/router/index.js:57`]. The theme is one top-level key whose value
is the whole object, so **one invalid value drops the ENTIRE theme from the
URL**, not just its own key.

Executed against the real `buildArgsParam` [V-EXEC,
`scratchpad/globals-url-probe.mjs`]:

| Theme object | `?globals=` produced |
| --- | --- |
| `{primary:'#1779ba', radius: 4}` | `nfsTheme.primary:!hex(1779ba);nfsTheme.radius:4` |
| `{primary:'#1779ba', radius: 0}` | `nfsTheme.primary:!hex(1779ba);nfsTheme.radius:0` |
| `{primary:'#1779ba', radius: 0.5}` | `nfsTheme.primary:!hex(1779ba);nfsTheme.radius:0.5` |
| `{primary:'#1779ba', radius:'4px'}` | `nfsTheme.primary:!hex(1779ba);nfsTheme.radius:4px` |
| `{primary:'#1779ba', radius:'0.5rem'}` | **`` -- whole theme dropped** |
| `{primary:'#1779ba', radius:'0.5px'}` | **`` -- whole theme dropped** |
| all 5 colours + `radius:'0.5rem'` | **`` -- all six values lost** |
| all 5 colours + `radius: 0` | all six encoded |

The five valid hex colours are discarded along with the one bad radius. And the
diagnostic is `once.warn('Omitted potentially unsafe URL args.')` -- a `warn`,
which `.storybook/test-runner.ts` does not catch because it throws on
`type() === 'error'` only [V-REPO: `.storybook/test-runner.ts:6-13`].

**Therefore the panel is the validation boundary.** Globals hold only
already-valid values by construction, and the shareable-URL guarantee is total
rather than best-effort.

### A.5 Why radius is a number, not `'4px'`

Both round-trip. The number wins on three counts, all verified:

1. `validateArgs` short-circuits on `typeof value == "number"` and returns true
   **unconditionally** [V-SRC: `router/index.js:57`]. A number can never be the
   value that drops the theme; a string is only ever one typo from it.
2. It round-trips back as a **number**, not a string: `valueDeserializer` ends
   `return NUMBER_REGEXP.test(str) ? Number(str) : str` [V-SRC:
   `_browser-chunks/chunk-SNLGT2ZI.js:3054-3084`]. No parse step, no
   `'4px'`-vs-`4px` ambiguity.
3. A slider over a number is the natural control; a slider over `'4px'` needs
   serialise/parse on both edges.

The cost is that the unit is implicit. That is the right trade for a **curated**
control set: the addon deliberately does not expose arbitrary Sass, and `rem`
radii are not reachable through it. `theme()`'s public `$radius` still accepts
any unit for consumers compiling at build time -- this constrains the addon's
control, not the Sass API.

### A.6 Why the globals value is a sparse override map

This is the design decision that removes the most machinery, so it is worth
being explicit.

`theme()`'s signature is already an override map:
`theme($selector, $background: null, $palette: null, $radius: null)`, and it
resolves every omitted argument to Foundation's default internally
[V-REPO: `src/scss/_button.scss:58-77`]. So a sparse map maps 1:1 onto the
mixin, and the compile path needs **no resolution step at all**.

It also makes the globals lifecycle single-shaped, which the alternative does
not. Verified mechanics:

- `buildArgsParam` encodes only `deepDiff(initialGlobals, globals)`
  [V-SRC: `router/index.js:74`]. With `initialGlobals.nfsTheme = {}` the diff of
  a minimal map **is** that map -- executed: `{nfsTheme:{}}` vs
  `{nfsTheme:{primary:'#ff0000'}}` produced exactly
  `nfsTheme.primary:!hex(ff0000)` [V-EXEC].
- `parseArgsParam` decodes dot notation back into a nested object
  (`nestingSyntax: 'js'`) [V-SRC: `chunk-SNLGT2ZI.js:3054-3084`].
- `GlobalsStore.updateFromPersisted` does
  `this.globals = { ...this.globals, ...allowedUrlGlobals }` -- a **shallow
  top-level merge**, so `nfsTheme` is replaced wholesale
  [V-SRC: `chunk-SNLGT2ZI.js:489-492`].

Compose those three and the post-reload value is **byte-identical to the
in-session value**. The shallow-merge replacement stops being a trap and becomes
the correct semantics, because the object genuinely is the complete override
set.

Contrast the alternative -- storing all six resolved keys, as research/02
suggested. In session, globals hold six keys. On reload, `deepDiff` puts only
the changed keys in the URL, the shallow merge replaces the six-key object with
that sparse remainder, and globals now hold three. **Two different runtime
shapes for the same visual state**, and every reader needs a resolve step to
paper over it. The sparse model has one shape and no resolve step.

Research/02's rule ("send the whole theme object, never a partial patch") is
**preserved, not contradicted**: every `updateGlobals` call still sends the
complete map. The map is just minimal by canonical form rather than padded to
six keys.

Two bonuses that fall out for free:

- The default theme produces an **empty** `?globals=` -- shared links carry only
  real deviations.
- `GlobalsStore.update` restores `initialGlobals[key]` when handed `undefined`
  [V-SRC: `chunk-SNLGT2ZI.js:497-499`], so "reset to Foundation default" is
  `updateGlobals({ nfsTheme: undefined })`. No reset code to write.

**Canonical form, stated as the rule the panel enforces on write:** a key is
present if and only if its value differs from the Foundation default. Setting a
control back to Foundation's value **deletes** the key rather than storing it.
This is what makes decision B's equality check correct without a resolve step
(section B.3).

`initialGlobals` remains mandatory -- an undeclared global key is silently
dropped with a `logger.warn` [V-SRC: `chunk-SNLGT2ZI.js:484-487`]. Declaring
`initialGlobals = { nfsTheme: {} }` in the preview annotation satisfies it.

---

## B. Preset semantics

### B.1 The locked choice

> **The ticket's reading is confirmed: preset selection is DERIVED from live
> state on every render, and nothing stores a "current preset" flag.** There is
> no `preset` key in globals, no mode, no seeded-vs-tweaked bit.
>
> A preset is `selected` iff `equal(canonical(live), canonical(preset))`, where
> `canonical` is the minimal override map over the six curated keys with colours
> lowercased to `#rrggbb` and radius coerced to `Number`. Comparison is a
> six-key scalar deep-equal; there is no deep structure to walk.
>
> **When nothing matches, the selector shows a literal `Custom` option**, which
> is selected and disabled-as-a-target (choosing it is a no-op). Presets are
> ordered and the first match wins.

### B.2 Why derived rather than stored

A stored flag has to be invalidated on every control write, and the moment it is
stale it lies. Worse, it would have to survive the URL round trip -- which means
adding a seventh key to the theme object, which means one more value that can
drop the entire theme (section A.4), to encode something recomputable from the
data already there.

Derivation is also what makes "seeding is not locking" true by construction.
Applying a preset is a single `updateGlobals` with that preset's canonical map;
afterwards the controls are ordinary controls. The selector re-derives on each
render and drops to `Custom` the instant any value diverges. No transition, no
state machine, no invalidation.

Cost: an equality check per render over six scalars. Nothing.

### B.3 The comparison, precisely -- and why canonical form discharges "fully resolved"

The ticket requires equality over a **fully resolved** control set, because the
compliant preset is sparse (success / warning / alert only; primary, secondary
and radius inherit Foundation's defaults). The trap it guards against is real:
a user who leaves `primary` untouched and a user who explicitly types
Foundation's own `#1779ba` into `primary` are in the **same visual state**, and
a naive sparse comparison would call the second one `Custom`.

Canonical form closes that hole at the write boundary instead of the read
boundary. Because the panel deletes any key whose value equals the Foundation
default (section A.6), explicitly typing `#1779ba` into `primary` produces the
**absence** of `primary`, identical to never having touched it. The two states
are the same object.

So:

> **Theorem.** With canonical-minimal maps on both sides, sparse equality is
> resolved equality. `canonical(x) === canonical(y)` iff
> `resolve(x) === resolve(y)`, because `canonical` and `resolve` are inverse
> over the same baseline.

That is why the implementation compares six scalars rather than resolving two
six-key objects. It is the same predicate, computed where it is cheapest, and it
needs the baseline in exactly one place -- the write path -- instead of two.

Normalisation before comparison is mandatory and is not pedantry:
`<input type="color">` yields lowercase, a pasted brand hex is often uppercase,
and `parseArgsParam` returns a *number* for radius while a freshly typed value
may be a string. Verified: `buildArgsParam` preserved `#1779BA` verbatim as
`!hex(1779BA)` [V-EXEC], so uppercase genuinely reaches globals if unnormalised.
Normalise on write, then compare with `===`.

Ticket 07 landed while this ticket was running and its section 4 supplies the
resolved table [V-PRIOR: research/07 section 4, `[V-EXEC]` probe 2]:

| Control | Foundation-default preset | WCAG-compliant preset |
| --- | --- | --- |
| primary (`$background`) | `#1779ba` | `#1779ba` (inherited) |
| secondary | `#767676` | `#767676` (inherited) |
| success | `#3adb76` | **`#238648`** |
| warning | `#ffae00` | **`#9e6c00`** |
| alert | `#cc4b37` | **`#cb4b37`** |
| radius | `0` | `0` (inherited) |

So the compliant preset's canonical map is exactly three keys. Ticket 07 owns
the values and their source; this ticket owns only the comparison.

### B.4 Where the baseline comes from -- reconciled with ticket 07

Ticket 07's hand-off is explicit and this ticket defers to it:

> "**Read both presets from Sass, in one probe compile at panel init.** ... Do
> NOT hard-code any of the six values in TS -- that reintroduces exactly the copy
> this ticket removed" [V-PRIOR: research/07 section 10], citing ticket 01's
> evidence of three mutually inconsistent compliant palettes coexisting in the
> reference at HEAD, one of them a TS constant (`theme-defaults.ts:65-71`).

That is the right call and it is **adopted unchanged**. An earlier draft of this
section proposed baking the six resolved values into a small generated data
module via ticket 08's generator, so the manager could read them synchronously.
That is rejected: even generated-and-gated, it is a second artifact carrying the
same six values, and ticket 01's drift evidence is specifically about a
TS-constant-versus-Sass divergence. The lazier and safer answer is not to create
the second copy at all.

**What this costs, and why it is affordable here.** The probe is a Worker
compile, so the values arrive asynchronously and the manager cannot have them on
first paint. The sparse-map model (A.6) makes that cheap, because it splits
cleanly:

- **The preview/compile path needs no baseline at all.** `theme()` resolves every
  omitted argument internally [V-REPO: `_button.scss:58-77`], so the decorator
  hands the sparse map straight to the Worker. Rendering a themed story never
  waits on the probe.
- **Only the panel needs the baseline** -- to render swatches, to derive
  selection, and to apply the canonical-form delete-on-default rule when writing.

So the gate is on the **panel**, not the preview, and the panel is a drawer the
user has to open. Locked sequence on first panel open: construct the Worker
(which is when the ~825 KiB chunk is fetched anyway, D.2) -> run ticket 07's
single probe compile (~150-215 ms sync, one time [V-PRIOR: research/07
section 10]) -> render the controls. Until it resolves the panel shows its
loading state, which decision D.5's 300 ms indicator already covers.

This is not a wrong state, it is a genuine one: on a cold panel the addon really
does not yet know what Foundation's defaults are. The state that had to be
avoided was showing a *confidently incorrect* preset selection, and a loading
panel does not do that.

Note the probe result is also the only thing the write path needs, and no write
can happen before the controls render -- so there is no ordering hazard.

### B.5 The `Custom` state

A literal `Custom` entry, selected whenever no preset matches. Rejected
alternative: leaving the `<select>` with no selection. A `<select>` with no
selected option renders as the first option in most browsers, which would
actively lie ("Foundation default" while showing a custom theme); and an empty
selection is indistinguishable from "not loaded yet". `Custom` is one string and
it is never ambiguous.

Preset ordering is fixed (Foundation default, WCAG-compliant, then any future
preset) and the first match wins, so the derivation is deterministic even if two
presets ever resolve identically. Worth one line of code and it removes a whole
class of "why does it flicker between two presets" bug.

---

## C. Injection and cascade

### C.1 The locked choice

> **One `<style id="nfs-theming">` node in `document.head`, get-or-create by id,
> updated by assigning `textContent`. One node total -- shared across story mode
> and docs mode, not one per story.**
>
> **The addon compiles with `theme()`'s default `$selector` -- it passes no
> `$selector` argument at all**, so the emitted selector is `.button` and the
> addon rethemes every button in the preview.
>
> **The R008 cascade win is inherited for free.** Verified, not assumed.

### C.2 The cascade claim, verified in a real browser

The ticket asked for verification rather than assumption. Both halves of the
premise are true in this repo:

- The component's defaults are layered:
  `packages/ngx-foundation-sites/src/lib/nfs-button/nfs-button.scss:24` wraps
  `@include nfs-button.theme` in `@layer nfs-defaults` [V-REPO].
- `theme()`'s own output is unlayered: `src/scss/_button.scss`'s mixin emits
  `#{$selector} { ... }` with no `@layer` anywhere in the file, and the header
  comment states the intent explicitly [V-REPO: `_button.scss:26-31`].

`scratchpad/cascade-probe.mjs` then drove real Chromium via Playwright,
injecting a layered rule and an unlayered rule in four orders and reading
`getComputedStyle` [V-BROWSER]:

| Order | winner |
| --- | --- |
| layered first, unlayered second | **UNLAYERED** |
| unlayered **first**, layered second | **UNLAYERED** |
| `@layer nfs-defaults;` declaration, layered, unlayered | **UNLAYERED** |
| unlayered, then `@layer` declaration + layered | **UNLAYERED** |
| *control:* two **unlayered** sheets | last one wins (`rgb(3,3,3)`) |

The control is the load-bearing part: it proves the probe can detect insertion
order at all, so the four `UNLAYERED` results are a real cascade property and
not a broken measurement.

**Consequence: the addon needs no order tricks.** No `!important`, no
re-appending on mutation, no MutationObserver racing Angular's
`SharedStylesHost`, no insertion-position management. Appending once to
`document.head` is sufficient, whenever it happens, however many component
styles Angular adds afterwards. This is the usual reason addons get clever here,
and R008's existing design has already paid for it.

### C.3 The node, and why get-or-create is enough

Research/02 verified this shape end-to-end against the **static**
`build-storybook` output: `getElementById(id) ?? createElement('style')` then
`textContent`, after a full Angular story render, produced
`{exists: true, parent: 'HEAD', count: 1}` [V-PRIOR: research/02 section 3].
`count: 1` is the important number -- no duplicate accumulated across
Storybook's render passes. The Angular renderer owns `#storybook-root` and does
not touch `document.head`.

The node is created **once, lazily, on the first successful compile** -- not at
decorator module scope. A story that never themes gets no node and, more
importantly, never constructs the Worker (decision D.2).

### C.4 One shared node, including docs mode

Research/02 flagged that the v10 docs' own example switches both selector and
style-node id by `context.viewMode`, producing one node per story on a docs page
[V-PRIOR: research/02 section 3]. **Rejected here.**

The reason is cost, and it is now quantified. Per-story docs scoping means
compiling once per story on the page, at ~197 ms each in the Worker
[V-PRIOR: research/05 section 5]. An autodocs page for `NfsButton` renders many
stories, so a single control drag would queue a double-digit number of compiles
to render N visually identical themes. The docs' pattern exists for addons that
apply *different* state per story; a global retheme is by definition the same
state for all of them.

One shared unlayered node gets docs mode right at zero extra cost, because the
`.button` selector matches inside `.docs-story` wrappers just as it does in
story mode.

### C.5 `$selector: '.button'` -- retheming everything, said explicitly

The addon passes **no** `$selector` argument, so it gets the mixin's own default
`'.button'` [V-REPO: `_button.scss:59`]. Three reasons, in order:

1. **It is what the addon is for.** R009's addon exists so a designer can see
   the library retheme. A scoped selector would show a themed preview next to an
   unthemed one, which is a comparison tool, not a theming tool.
2. **Zero divergence from what a consumer writes.** Passing nothing is exactly
   the zero-config consumer invocation `@include nfs-button.theme(...)`, so what
   the addon renders is what a consumer's build produces. A scoped selector
   would make the addon's output a special case that no consumer can reproduce.
3. **Scoping would need story-wrapper machinery.** Every story would have to be
   wrapped in the scope element via a decorator, which is real code that exists
   only to undo reason 1.

Blast radius is bounded in practice: `.button` is Foundation's class and nothing
else in the preview chrome uses it. The manager UI is a separate document
entirely, so the panel cannot restyle itself by accident.

---

## D. Recompile UX

Written against the Worker world, which section 0 verified.

### D.1 The locked choice

> **Worker-backed sync `compileString`, one Worker, constructed lazily on first
> theme change.**
>
> **No debounce timer. A single-slot latest-wins coalescer instead:** if the
> Worker is idle, post immediately; if it is busy, overwrite a one-deep
> `pending` slot. On each result, post `pending` if present.
>
> **In-flight compiles are never cancelled, only superseded.** Results carry a
> monotonic sequence number and stale results are discarded.
>
> **Mid-compile: nothing changes on screen.** The last good CSS stays. A
> "Compiling..." indicator appears in the panel only if the compile exceeds
> 300 ms.
>
> **On Sass error: the last good CSS stays on screen**, and the panel shows
> `sassMessage` plus a friendly source name derived from `span.url`.
>
> **The Worker serialises errors to a plain object before posting.**

### D.2 Worker lifecycle

One Worker, module-level singleton, constructed on the **first theme change**,
not at preview-annotation load. Ticket 08 made this structural: `sass` is
imported from the worker module and nowhere else, so the worker chunk is the
code-split point and constructing the Worker is what fetches the ~825 KiB gzip
[V-PRIOR: research/08 section 5]. Constructing it at module scope would fetch it
on every story load and make the laziness cosmetic.

A pool is not needed. Ticket 01 found the reference project's pool was a
throughput optimisation for a many-component workspace; ticket 05 measured that
one Worker already takes the max main-thread frame gap from 337 ms to 19.1 ms
against a 16.7 ms budget [V-PRIOR: research/05 section 5]. One Worker converts
the jank to nothing; a second converts nothing to nothing.

### D.3 Why latest-wins coalescing beats a debounce timer

Ticket 05's hand-off suggested "trailing debounce at roughly one compile
interval (~250-300 ms), plus drop-stale" and marked it INFERRED. Taking the
measurement seriously, the timer is the part to drop.

A single-slot coalescer is about six lines and has no tunable:

```
onThemeChange(theme):  busy ? (pending = theme) : post(theme)
onWorkerResult(css):   busy = false; if (pending) { post(pending); pending = null }
```

Against a 250-300 ms trailing debounce:

- **It self-tunes.** The coalescing interval becomes the machine's actual
  compile time. Ticket 05 measured a mid-run 1.7x latency step change from V8
  tier-down or DVFS [V-PRIOR: research/05 section 2.2], so any fixed constant is
  wrong half the time by construction. The coalescer absorbs that automatically.
- **It preserves live feedback, which is the product.** A 250 ms trailing
  debounce emits *nothing* during a drag and one compile at the end. Live
  recolouring while dragging is the entire reason this addon exists.
- **It cannot build a backlog.** The queue is one deep by definition.
- **It has no magic number to justify, tune, or explain in a review.**

At ~197 ms per compile a continuous drag settles at roughly 5 updates per
second, each showing the newest value. That is the maximum the compiler
supports, delivered without a timer.

*The lazier alternative, named:* a bare `setTimeout` trailing debounce is fewer
concepts if live feedback during a drag turns out not to matter. It does matter
here, and the coalescer is not bigger.

**On the globals write itself** -- the panel writes on every `input` event, so a
drag pushes `updateGlobals` across the manager/preview channel at pointer rate.
The compile side is already coalesced, so this only costs channel traffic and
manager re-renders. Left un-debounced deliberately: it is the simplest thing
that works, and the upgrade path if ticket 10's Playwright lane shows a hot
channel is a 50 ms trailing debounce on the **write** only, changing nothing
else in this design.

### D.4 Supersede, never cancel -- with the numbers

A Worker running a synchronous dart2js compile cannot be interrupted. The only
cancellation available is `worker.terminate()` plus respawn, which costs a
177 ms bundle re-init and then a 556-587 ms **cold** compile
[V-PRIOR: research/05 sections 2.1, 5]. That is 3-4x the ~197 ms warm compile
you were trying to abandon.

So in-flight compiles always run to completion and are discarded on arrival if
superseded. Each request carries an incrementing sequence number; the preview
ignores any result whose sequence is not the latest. Cheap, and it means a slow
compile can never overwrite a newer one -- the classic async-ordering bug this
design would otherwise be wide open to.

### D.5 Mid-compile UX

**Never blank the preview and never swap in a placeholder.** The previous
theme's CSS stays applied until new CSS replaces it, so the preview always shows
a coherent theme.

The indicator threshold is where the measurements do the deciding:

- Warm compile median is **197 ms** in the Worker [V-PRIOR: research/05
  section 5]. That is above the ~100 ms "instantaneous" threshold but well below
  the ~1 s threshold where a user suspects a stall. During a drag, a spinner
  toggling at 5 Hz is strictly worse than no spinner.
- Cold compile is **556-587 ms** [V-PRIOR: research/05 sections 2.1, 5], plus a
  one-time ~825 KiB gzip chunk fetch on first use [V-PRIOR: research/08
  section 5]. That is long enough that silence reads as broken.

A single `setTimeout(300)` armed at post time and cleared on result covers both:
the first compile of a session shows "Compiling...", every warm compile shows
nothing. The indicator lives in the **panel**, never over the canvas -- the
canvas is what the user is watching.

### D.6 Error UX

Compile options are settled and `alertColor: false` is **mandatory**, not
advisory: without it `e.message` carries ANSI escape codes, which a React panel
renders as literal `[33m` garbage. Verified sufficient -- with it,
`message contains ANSI : false` [V-PRIOR: research/05 section 3, research/03].
Full bag, per ticket 08 section 4.5: `{ importers: [importer], quietDeps: true,
silenceDeprecations: ['import','global-builtin','if-function'],
alertColor: false }`.

The panel renders:

- **`e.sassMessage`** as the primary line -- a clean one-liner, e.g.
  `$color: notacolor is not a color.` [V-PRIOR: research/05 section 3].
- **A friendly source name mapped from `e.span.url`**, which is the importer's
  own canonical URL (`fnd:/scss/components/_button.scss`,
  `nfs:/internal/_settings.scss`) [V-PRIOR: research/05 section 3]. Map the
  `fnd:` prefix to `foundation-sites/scss/...` and `nfs:` to the library's own
  partial; the raw scheme is an internal detail.
- **`e.message`** only behind a details toggle. It is multi-line with a source
  excerpt -- useful when debugging, noise as a headline.

**The last good CSS is never cleared on error.** A transient invalid value must
not blank the preview; the user needs to see what they are correcting against.

### D.7 Two Worker-boundary constraints that are easy to miss

**Errors must be serialised before posting.** A `sass.Exception` cannot cross
`postMessage` intact. Structured clone treats `Error` specially and preserves
only the standard fields; custom properties are dropped. Executed on an
`Error` subclass shaped like `sass.Exception` [V-EXEC]:

```
threw                    : no
instanceof SassException : false
instanceof Error         : true
name                     : "Error"          (custom "sass.Exception" lost)
sassMessage              : undefined        (LOST)
span                     : undefined        (LOST)
own keys                 : []
```

Both fields the panel depends on vanish, **silently, with no throw**. The Worker
must therefore catch and post a plain object --
`{ ok: false, sassMessage, spanUrl, message }` -- and the preview must never
expect an `instanceof sass.Exception` on the far side. Note this does not
contradict research/05's finding that `e instanceof sass.Exception` survives
both minifiers: that was measured **inside** the compiling context, which is
exactly where the check still works.

**The degraded missing-importer diagnostic is a non-issue at runtime.** Inside a
Worker `self.document` is undefined, so Dart Sass's `isBrowser()` is false and a
missing importer yields the generic `Can't find stylesheet to import.` instead
of the friendly `Custom importers are required...` [V-PRIOR: research/05
section 5]. This only fires when the importer is mis-wired, which is an
authoring bug caught at build time, never a state a user can reach. Ordinary
Sass errors keep their full `sassMessage` and `span.url` inside the Worker.

The one thing it does constrain: **ticket 10's importer unit tests should run on
the main thread or in Node**, where the friendly diagnostic survives and a
mis-wiring is legible.

---

## E. The R026 resolution

### E.1 The principle, for the record

> **R026 bans a hand-fed CSS string as the COMPONENT'S STYLING SOURCE.** It
> exists so `NfsButton`'s default styling can only come from `styleUrl`-compiled
> SCSS through Angular's `SharedStylesHost`, and so the deleted
> `NfsStyleLoader` / `NfsStyleExtractor` runtime-injection stack cannot return
> [V-REPO: `eslint.config.mjs:50-53`].
>
> **A dev-only Storybook addon injecting browser-compiled output is outside that
> ban.** It ships in no package, styles no component's defaults, and its CSS is
> produced by the very same `theme()` mixin R026 protects -- compiled by Dart
> Sass, byte-identical to the Node build [V-PRIOR: research/05 section 3], just
> at a different time. The banned thing is a hand-authored CSS string standing
> in for compiled SCSS. This is compiled SCSS.

### E.2 The locked scoping

> **Add exactly one `ignores` entry to the EXISTING non-spec `no-restricted-syntax`
> block in `packages/ngx-foundation-sites/eslint.config.mjs`:**
>
> ```
> ignores: ['**/*.spec.ts', '**/.storybook/theming/inject-theme-style.ts'],
> ```
>
> **The block count stays 2.** `nfs-button.r026-lint.spec.ts:66`'s
> `expect(r026ConfigEntries).toHaveLength(2)` is untouched and needs no edit.
>
> **The leading `**/` is load-bearing.** See E.4 -- without it the carve-out
> silently does not apply under Nx.
>
> **The exempted file does exactly one thing**: get-or-create the style node and
> assign `textContent`. Compilation, worker messaging, state and panel code all
> live in sibling files where R026 stays fully live.

### E.3 Verified against the real config

`scratchpad/r026-probe.mjs` imports the **live**
`packages/ngx-foundation-sites/eslint.config.mjs`, clones it, applies the
carve-out to the block that already carries `ignores: ['**/*.spec.ts']`, and
runs ESLint's `Linter` exactly as the spec's own harness does [V-EXEC]:

```
[OK]   BASELINE block count                           got=2 want=2
[OK]   CARVED   block count                           got=2 want=2
[OK]   baseline: injection in library src             got=2 want=2
[OK]   baseline: injection in exempt path             got=2 want=2
[OK]   baseline: injection in .storybook/preview.ts   got=2 want=2
[OK]   carved:   injection in library src             got=2 want=2
[OK]   carved:   injection in EXEMPT path             got=0 want=0
[OK]   carved:   injection in .storybook/preview.ts   got=2 want=2
[OK]   carved:   injection in .storybook/manager.ts   got=2 want=2
[OK]   carved:   injection in .storybook/theming/panel.ts got=2 want=2
[OK]   carved:   createElement style in library src   got=1 want=1
[OK]   carved:   textContent in library src           got=1 want=1
[OK]   carved:   createElement style in spec          got=1 want=1
[OK]   carved:   innerHTML in spec (exempt)           got=0 want=0

ALL PASS
```

This confirms, against the live config rather than a copy:

- The carve-out is **one file wide**. A sibling in the same addon directory
  (`.storybook/theming/panel.ts`) still gets both errors.
- Every other `.storybook/*.ts` file -- `preview.ts`, `manager.ts`, `main.ts`,
  `test-runner.ts` -- stays fully governed.
- Library source is untouched, both halves still firing.
- The spec-file behaviour (createElement banned, innerHTML exempt) is unchanged.
- Block count stays 2 before and after.

### E.4 The `**/` prefix is not cosmetic -- Nx lints from the workspace root

This is the finding that would have silently broken the carve-out.

`@nx/eslint:lint` calls **`process.chdir(systemRoot)`** -- the workspace root --
then passes the project's config via `overrideConfigFile`, with the comment
"eslint resolves files relative to the current working directory. We want these
paths to always be resolved relative to the workspace root"
[V-SRC: `@nx/eslint/dist/src/executors/lint/lint.impl.js:17-47`].

Flat-config `files`/`ignores` patterns resolve against the **base path, which
follows cwd, not the config file's directory.** Executed with real ESLint
9.39.5 over a fixture carrying both glob spellings, under both cwds [V-EXEC]:

| ignore pattern | cwd = package root | cwd = parent (**what Nx does**) |
| --- | --- | --- |
| `.storybook/theming/variant-a.ts` | **exempt** | **R026 FIRES** -- carve-out inert |
| `**/.storybook/theming/variant-b.ts` | **exempt** | **exempt** |

A config-dir-relative glob would therefore have produced the worst possible
outcome: **a green `nx test` and a red `nx lint`.** The spec's harness passes
package-relative paths to `Linter.verify`, so it would have reported the
exemption working while the real lint run rejected the addon. The `**/` form is
cwd-independent and removes the divergence entirely.

*(Aside: an earlier run of this experiment reported "File ignored because
outside of base path" for every file. That was the 8.3 short path `LARSGY~1`
in the harness, not ESLint semantics -- ESLint canonicalises the base path to
the long form and the short-form arguments then compare as outside it. Re-run
with canonical long paths, the results above are stable.)*

### E.5 How it still fails loudly -- two spec additions, no third block

Neither addition changes the config-block count, so `toHaveLength(2)` stands.
Add to `nfs-button.r026-lint.spec.ts`:

1. **The exemption works**: the canonical injection shape at
   `.storybook/theming/inject-theme-style.ts` produces **0** messages.
2. **The exemption is exactly one file wide**: the same shape at
   `.storybook/theming/panel.ts` -- a sibling in the same directory -- still
   produces **2**.

Test 2 is the one that matters. It is a standing proof that the carve-out cannot
be widened to a directory glob without a test going red, which is precisely the
"escaping a governance rule by relocation" failure ticket 06 rejected. The
existing tests already cover library source and the spec-file exemption, so
these two complete the matrix.

Both are verified to behave as specified by the E.3 probe, which uses the same
`Linter` harness the spec uses.

### E.6 Why `ignores` rather than an inline `eslint-disable`

An inline `// eslint-disable-next-line no-restricted-syntax` at each of the two
violation sites is admissible under the ticket's "or equivalent scoping", and it
is arguably smaller. It loses on one concrete, non-aesthetic ground:
**an inline disable is not assertable.** The spec harness reads the live config
array; it cannot see comments in a source file, so there would be no test
proving the exemption stayed narrow, and E.5's test 2 could not exist. An
`ignores` entry keeps the boundary in the governance file where a reviewer looks
for it, and keeps it under test.

It also matches ticket 06's own conclusion that "an explicit, commented
`ignores` entry is the honest, reviewable form of that answer"
[V-PRIOR: research/06 section 5].

The `ignores` line carries a comment stating E.1's principle, so the boundary is
readable at the point it is drawn.

### E.7 Relocation is not on the table

Recorded because ticket 06 identified it as the strongest-looking wrong answer.
Moving the addon into a separate package would put it outside
`packages/ngx-foundation-sites/eslint.config.mjs`'s scope and make R026 stop
firing with **no record that an exemption was ever decided**
[V-PRIOR: research/06 section 5]. The delivery shape is locked as
`.storybook/`-resident [V-PRIOR: research/06 section 1], and this decision states
the boundary in the config instead of dodging it by geography.

---

## F. What this constrains for ticket 10 (verification)

1. **The Worker spike is closed; the standing gate replaces it.** Ticket 08
   section 5's L1 assertions are now doubly motivated -- they also guard section
   0's merge accident. If `@storybook/angular` ever spreads `cliConfig.module`
   wholesale, the Worker silently stops being bundled with **zero build errors
   and zero warnings** [V-EXEC, spike variants B and D]. Assert the sass marker
   appears in exactly one emitted chunk and that chunk is not referenced by
   `iframe.html`.
2. **Two new R026 spec tests** (E.5), not a third config block. Test 2 --
   a sibling file in the addon directory still firing -- is mandatory; without
   it the carve-out has no width regression guard.
3. **A lint-lane assertion is worth one line**: the L3 negative control should
   include running the real `nx lint ngx-foundation-sites` once with the
   injection code present, to catch the cwd/base-path class of failure (E.4)
   that the spec harness structurally cannot see.
4. **Playwright (L2) assertions this decision makes concrete**: driving a colour
   control mutates `<style id="nfs-theming">`'s `textContent` in the preview
   iframe; selecting the compliant preset then tweaking one control flips the
   selector to `Custom`; setting that control **back** to the preset value flips
   it back to `WCAG-compliant` -- that last one is the derived-selection proof
   and it is the assertion a stored mode flag would fail.
5. **A URL round-trip assertion**: load
   `iframe.html?globals=nfsTheme.primary:!hex(cb4b37)` against
   `static-storybook` and assert the injected CSS carries `#cb4b37` **and** that
   the other five controls read as Foundation defaults. This is the sparse-map
   contract (A.6) under test.
6. **Disable CSS transitions in any themed-colour assertion.** Foundation emits
   `transition: background-color 0.25s ease-out` and `getComputedStyle` samples
   mid-flight [V-PRIOR: research/05 section 4].
7. **Importer unit tests belong on the main thread or in Node**, not in the
   Worker, so the friendly missing-importer diagnostic survives (D.7).
8. **D023's axe obligation interacts with B.4's async probe.** The compliant
   preset's values exist only in Sass and reach the addon through a Worker probe
   at panel init. An axe scan driven through the **addon** must therefore wait
   for the panel to finish initialising before asserting; a scan driven through
   the existing `.theme-compliant` Sass invocation has no such wait. That is a
   concrete argument for keeping the axe proof on the Sass side rather than
   re-pointing it at the addon, but the choice remains ticket 10's.

## G. What this constrains for ticket 11 (requirements)

1. **No public Sass API growth.** Confirmed against the source: the curated set
   maps 1:1 onto `theme()`'s existing `$background` / `$palette` keys / `$radius`
   [V-REPO: `src/scss/_button.scss:58-63`]. R009's text can state this as a
   constraint the addon satisfies, not a change it requires.
2. **The shareable-URL guarantee is total, and it is a requirement.** Because
   the panel is the validation boundary (A.4), every reachable control state is
   URL-encodable. Requirement text should say so, since the failure mode it
   prevents -- one bad value silently dropping the whole theme -- is invisible
   at runtime.
3. **The radius control is integer CSS pixels, 0-32.** A user-visible limit of
   the curated surface, not an implementation detail. `rem` radii remain
   available to consumers compiling at build time.
4. **Preset selection is derived, and that is testable behaviour**, not an
   internal design note. Phrase R009's "reads as selected only when every
   control matches exactly" as the round-trip in F.4.
5. **The panel is story-mode only; the theme is document-wide.** Docs pages
   inherit the current theme and cannot change it (A.2). If that is not
   acceptable, it becomes a new requirement rather than a bug.
6. **R026 gains a stated boundary** (E.1). Worth recording as a decision in
   `.gsd/DECISIONS.md` alongside R026 itself, since it is the first time the
   rule's edge has been drawn.
7. **No TS copy of the palette, anywhere -- and the panel is allowed to load
   asynchronously because of it** (B.4). Requirement text should state the
   first-panel-open sequence (construct Worker -> probe compile -> render
   controls) as intended behaviour, or a reviewer will read the loading state as
   a defect.
8. **Deliberately deferred, unchanged by this ticket**: user-saved presets;
   `localStorage` persistence beyond the URL; per-component control surfaces as
   more `nfs-*` components land. All remain in map.md's "Not yet specified".

---

## H. VERIFIED vs INFERRED

### VERIFIED by execution or direct source reading, this session

- `@storybook/angular`'s config merge is `module = { ...baseConfig.module,
  rules: [...cliConfig.module.rules, ...rulesExcludingStyles] }`, so Angular's
  `module.parser.javascript.worker` is **discarded**
  [`angular-cli-webpack-VNEX2DZH.js:135-137`].
- Angular sets `worker: !!webWorkerTsConfig` alongside `url: false` and
  `requireContext: false` [`common.js:324-334`].
- `@storybook/builder-webpack5` sets no top-level `module.parser`; its only
  `parser:` is a rule-level `dataUrlCondition`.
- With no `module.parser`, webpack 5.105.2 emits a **separate worker chunk** for
  both `new Worker(new URL(...))` and `{type:'module'}`; with
  `parser.javascript.worker: false` it emits **no worker code at all**, with
  **zero errors and zero warnings**.
- `packages/ngx-foundation-sites/tsconfig.json` sets `"module": "preserve"`,
  `"target": "es2022"`; `.storybook/tsconfig.json` extends it and its `include`
  is the non-recursive `"*.ts"`.
- `validateArgs` returns true unconditionally for `typeof value == "number"`;
  strings must match one of `VALIDATION_REGEXP` / `NUMBER_REGEXP` /
  `HEX_REGEXP` / `COLOR_REGEXP` [`router/index.js:57`].
- **One invalid value drops the ENTIRE nested theme object from `?globals=`**,
  not just its own key -- executed against the real `buildArgsParam`: five valid
  hex colours plus `radius: '0.5rem'` produced an empty param.
- `radius` as `4` / `0` / `0.5` and as the string `'4px'` all round-trip;
  `'0.5rem'` and `'0.5px'` do not.
- `buildArgsParam` encodes only `deepDiff(initialGlobals, globals)`; with
  `initialGlobals.nfsTheme = {}` a one-key change produced exactly
  `nfsTheme.primary:!hex(ff0000)`.
- `buildArgsParam` preserves uppercase hex verbatim (`!hex(1779BA)`).
- `parseArgsParam`'s `valueDeserializer` returns `Number(str)` for
  number-shaped strings, and decodes dot notation into nested objects
  (`nestingSyntax: 'js'`) [`chunk-SNLGT2ZI.js:3054-3084`].
- `GlobalsStore.updateFromPersisted` and `.update` both do a **shallow
  top-level** spread; `update` restores `initialGlobals[key]` for an `undefined`
  value [`chunk-SNLGT2ZI.js:484-499`].
- **Unlayered CSS beats `@layer nfs-defaults` in all four insertion orders in
  real Chromium**, with a two-unlayered-sheets control proving the probe detects
  order.
- `nfs-button.scss:24` wraps the defaults in `@layer nfs-defaults`;
  `_button.scss` contains no `@layer` and its header states the unlayered intent
  [`_button.scss:26-31`].
- Foundation defaults for the curated set: `#1779ba` / `#767676` / `#3adb76` /
  `#ffae00` / `#cc4b37`, `$global-radius: 0`
  [`src/scss/internal/_settings.scss:15-21,36`].
- A single `**/`-prefixed `ignores` entry on the existing non-spec R026 block
  exempts exactly one file, keeps the block count at 2, and leaves every sibling
  `.storybook` file and all library source firing -- run against the **live**
  config with the spec's own `Linter` harness.
- `@nx/eslint:lint` calls `process.chdir(systemRoot)` (workspace root)
  [`lint.impl.js:17-47`], and ESLint 9.39.5 resolves flat-config `ignores`
  against cwd -- so a config-dir-relative glob is inert under Nx while a
  `**/`-prefixed one works under both cwds.
- Structured clone of an `Error` subclass **drops** custom fields: a
  `sass.Exception`-shaped object lost `sassMessage`, `span` and its custom
  `name`, silently and without throwing.
- `research/07-compliant-preset-single-source.md` did not exist when this ticket
  started and landed mid-run; it was read before finalising and its section 4
  preset table and section 10 "no TS copy" hand-off are adopted (B.4).

### INFERRED (reasoned, not executed)

- `import.meta.url` survives `@ngtools/webpack` given `module: "preserve"`.
  Strong, but the transpile was not run. Caught by ticket 08's L1 gate.
- A `.ts` worker entry resolves and passes through `@ngtools/webpack`'s loader
  chain once it is inside `.storybook/tsconfig.json`'s `include`. Failure mode is
  a hard build error, not silence [V-PRIOR: research/02 section 4].
- The end-to-end sparse-map URL round trip is verified **by parts** --
  `buildArgsParam` executed, `parseArgsParam` and `updateFromPersisted` read from
  source. `parseArgsParam` is not exported from `storybook/preview-api` so the
  composition was not executed in one go.
- That un-debounced `updateGlobals` on every `input` event is acceptable channel
  traffic. Named with its upgrade path in D.3 rather than pre-optimised.
- That `.button` has no collisions elsewhere in the preview chrome.
- The panel's per-render equality check is negligible cost (six scalars).

### CARRIED from tickets 01-08 without re-verification

Globals as the state mechanism and its three constraints; the manager being
React; `storyGlobals` as the lock affordance; the idempotent get-or-create style
node at `count: 1` against the static build; addon CSS surviving
`build-storybook`; the 197 ms warm / 556-587 ms cold / 19.1 ms frame-gap Worker
figures and the 337 ms main-thread block; async at 6-7x; `alertColor: false`
yielding ANSI-free messages and `sassMessage` / `span.url` being panel-ready; the
degraded in-Worker missing-importer diagnostic; the ~825 KiB gzip worker chunk
and the +70% preview figure; the settled compile-options bag and the byte-proven
importer; ticket 06's `.storybook`-resident delivery shape, its `toHaveLength(2)`
file-shape constraint and its rejection of relocation; ticket 08's generator,
committed data module and `verify-theming-sources` gate, and its amended rule 2
(addon runtime code imports nothing outside `.storybook/`); the Foundation
transition-flake warning for browser colour assertions.
