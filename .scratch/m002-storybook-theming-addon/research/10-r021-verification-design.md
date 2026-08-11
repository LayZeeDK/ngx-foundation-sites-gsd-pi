# R021 verification design: what is proven where -- findings

Resolves ticket `.scratch/m002-storybook-theming-addon/issues/10-r021-verification-design.md`.
Status: **resolved, decisions LOCKED** (AFK -- no human in the loop, per map.md Notes).

No repo file was changed. Everything written landed in `.scratch/`. Every command
was read-only. Reproducible probes left behind at
`.scratch/m002-storybook-theming-addon/prototypes/lane-probe/`.

## Evidence key

- **[V-EXEC]** -- verified by executing a read-only command here, output quoted.
- **[V-REPO]** -- verified by reading a tracked file in this repo (path + line).
- **[V-DIST]** -- verified against the committed-build artifact currently at
  `dist/storybook/ngx-foundation-sites/`.
- **[V-PRIOR]** -- carried from tickets 01-09, cited.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

### Reproducing this ticket's probes

The probe specs need the 16-file source closure. Regenerate it first (it was
deleted afterwards so 88 KiB of Foundation Sass does not sit in tracked
`.scratch/`):

```
node .scratch/m002-storybook-theming-addon/prototypes/collect-sources.mjs \
     .scratch/m002-storybook-theming-addon/prototypes/lane-probe/out
npx vitest run --config .scratch/m002-storybook-theming-addon/prototypes/lane-probe/vitest.config.mts --reporter=verbose
npx vitest run --config .scratch/m002-storybook-theming-addon/prototypes/lane-probe/vitest.browser.config.mts --reporter=verbose
node .scratch/m002-storybook-theming-addon/prototypes/lane-probe/r026-glob-divergence-probe.mjs
```

---

## 1. THE LOCKED DESIGN, up front

> **Four lanes, and the axis is capability, not preference.**
>
> 1. **`test` (Vitest, jsdom)** is the DEFAULT lane and it is far more capable
>    than the ticket assumed. It resolves the **Node** sass build, and the real
>    `theme()` chain compiles there from the in-memory string map to the **same
>    5839 bytes / sha256 `49bfb1a2e67bf91a`** as ticket 05's four producers
>    [V-EXEC]. Ticket 07's custom-`functions` palette capture also works there
>    [V-EXEC]. So **all compilation, preset, equality, validation, error-shape
>    and importer assertions live here** -- the ticket's "in-browser Sass may not
>    run under jsdom" worry does not apply, because the jsdom lane never loads
>    the browser entry.
> 2. **`test-browser` (Vitest, real Chromium)** earns exactly four things jsdom
>    cannot do, all verified: it resolves the **browser** sass build (the
>    artifact the Worker actually ships) [V-EXEC], it has a real `Worker`
>    [V-EXEC], and it resolves a real cascade including `@layer`. **jsdom drops
>    `@layer`-wrapped rules entirely** -- a layered-only rule computes to
>    `rgba(0, 0, 0, 0)` [V-EXEC] -- so every R008 cascade assertion in jsdom
>    would be VACUOUSLY green. This is the single most important lane finding.
> 3. **Playwright at `apps/nfs-storybook-e2e/`** proves only what needs the
>    Storybook **manager**: addon load, panel controls, manager-to-preview round
>    trips, preset selection state, URL round trip, and the static build.
> 4. **Build-time gates**: `verify-theming-sources` (ticket 08, on `lint`) and a
>    NEW `verify-theming-bundle` (`dependsOn: build-storybook`), which owns the
>    addon-load build-artifact check and ticket 08 section 5's three
>    lazy-loading assertions.
>
> **D023's axe obligation stays where ticket 07 put it: `apps/nfs-demo`.** The
> Storybook a11y scan is NOT re-pointed. The addon's preset is bound to the
> axe-proven palette by a data-identity unit assertion instead of by a second
> scan. The default theme's three `expectedContrastFailures` literals are
> untouched.
>
> **Port 4400 collision: resolved by refactoring `test-storybook` off
> `concurrently` onto `dependsOn: ["static-storybook"]`,** so both lanes share
> one server on 4400. `static-storybook` is already `continuous: true` [V-EXEC].

### The three corrections this ticket makes to inherited assumptions

1. **jsdom is not the weak lane it was assumed to be for Sass** -- but it is
   *worse than assumed* for CSS. The lane boundary moves in both directions.
2. **`iframe.html` contains ZERO `<script src=...>`** [V-DIST]. It loads the
   preview with `import './chunk.js'` statements inside one
   `<script type="module">`. Ticket 08 section 5's assertion 2 as written
   ("not referenced by any `<script src>` in iframe.html") would be **vacuously
   green forever**. Restated in section 5.2.
3. **The "green `nx test`, red `nx lint`" ESLint-glob divergence is catchable
   in-lane**, with no cwd manipulation and no `nx lint` run: verify the same
   code under a package-relative AND a workspace-root-relative path spelling in
   one process. Executed against the live config: the config-dir-relative glob
   scores **0 / 2**, the `**/`-prefixed one scores **0 / 0** [V-EXEC]. That is a
   new, cheap standing guard against the exact class ticket 09 E.4 discovered.

---

## 2. New evidence produced by this ticket

Six probes, all executed this session.

### 2.1 The jsdom lane (`prototypes/lane-probe/sass-lane*.spec.mts`)

| # | Question | Result |
| --- | --- | --- |
| Q1 | which sass build does a jsdom spec resolve? | **NODE** -- `sass.compile()` threw `no such file or directory`, not the browser build's `only available in Node.js` |
| Q2 | does the real chain compile there? | **YES** -- 5839 bytes, sha256[0:16] `49bfb1a2e67bf91a`, importer log 17 canonicalize / 16 load / 0 misses |
| Q3 | does ticket 07's `functions` capture work there? | **YES** -- `{"primary":"#1779ba","secondary":"#767676","success":"#3adb76","warning":"#ffae00","alert":"#cc4b37"}` |
| Q5 | is `Worker` available? | **NO** -- `typeof Worker === 'undefined'` (`self` is an object) |
| Q7c | does jsdom apply `@layer`-wrapped rules? | **NO** -- a layered-only rule computes `rgba(0, 0, 0, 0)` |
| Q8 | `structuredClone` of a `sass.Exception`-shaped error | available, and **drops everything**: `name` -> `"Error"`, `sassMessage` -> `undefined`, `span` -> `undefined`, own keys `[]` |

Q2's digest is the headline: it makes the jsdom lane a **fifth producer** of the
identical byte stream, alongside ticket 05's browser-Terser, browser-esbuild,
Node-stringmap and Node-filesystem producers.

**Q6/Q7b were a false positive and are recorded so nobody repeats them.** A
first pass injected a layered and an unlayered rule in both orders and jsdom
reported "unlayered wins" in both -- apparently matching Chromium. The Q7c
control (layered rule alone) shows jsdom simply **discards** layered rules, so
"unlayered wins" was true for the wrong reason. **Any jsdom cascade test against
the library's real `@layer nfs-defaults` defaults would pass with the defaults
absent.** That is precisely the M003 anti-vacuity failure mode, found in the
tool rather than in a spec.

### 2.2 The dual-entry sass hazard (`sass-lane-4.spec.mts`)

Importing the **Node** entry and then the **browser** entry in one context
throws [V-EXEC]:

```
TypeError: Cannot read properties of undefined (reading 'pop')
 -> node_modules/sass/sass.default.js:4
    const _cliPkgLibrary = globalThis._cliPkgExports.pop();
```

The first entry consumes `globalThis._cliPkgExports` and deletes it; the second
entry's module init then dereferences `undefined`. Consequence for the design:
**never load both sass entries in one spec file or one lane.** jsdom specs use
the resolved (`node`) entry only; the browser build is exercised in
`test-browser`, where it is what `sass` resolves to anyway.

### 2.3 The `test-browser` lane (`sass-lane.browser.spec.mts`)

Vitest 4.1.10 browser mode, `@vitest/browser-playwright`, headless Chromium:

| # | Question | Result |
| --- | --- | --- |
| B1 | which sass build? | **BROWSER** -- `compile()` threw `The compile() method is only available in Node.js.`; `Object.keys(sass).length === 40`, matching ticket 05's browser probe exactly |
| B2 | real chain? | **YES** -- 5839 bytes, sha256[0:16] `49bfb1a2e67bf91a` -- identical to the jsdom and filesystem producers |
| B3 | `Worker`? | **`function`** |
| B4 | `@layer` precedence, layered inserted LAST | unlayered wins (`rgb(2, 2, 2)`) |
| B5 | layered-only control | `rgb(3, 3, 3)` -- layered rules ARE applied, so B4 is a real result |

B1 is what makes this lane worth its cost: it runs **the same dart2js build the
webpack worker chunk will contain**, so a browser-only regression in Dart Sass
is observable without a Storybook build.

Note the run emitted `dependency optimized: sass` plus Vite's
"unexpectedly reloaded a test" warning. The real `test-browser` lane will want
`optimizeDeps.include: ['sass']` or it pays a reload on first run. [INFER that
this is cosmetic; the assertions passed either way.]

### 2.4 The R026 glob-divergence guard (`r026-glob-divergence-probe.mjs`)

Run from the workspace root against the **live**
`packages/ngx-foundation-sites/eslint.config.mjs`, adding a carve-out in each
spelling and linting the same injection snippet under two path spellings
[V-EXEC]:

```
cwd = D:\projects\github\LayZeeDK\ngx-foundation-sites-gsd-pi
baseline R026 block count = 2

glob spelling         | pkg-relative path | root-relative path
----------------------+-------------------+-------------------
config-dir-relative   |                 0 |                 2
**/-prefixed          |                 0 |                 0

live ignores globs    : ["**/*.spec.ts"]
all **/-prefixed      : true
```

`0` = exempt, `2` = R026 fires. The config-dir-relative spelling is exempt under
the package-relative path and **fires** under the workspace-root-relative one --
the exact green-test / red-lint divergence, reproduced inside a spec-harness
process. See section 4, assertion T9c.

### 2.5 The built Storybook artifact (`dist/storybook/ngx-foundation-sites/`)

All [V-DIST], from the build committed by ticket 05's run:

- Addon bundles land at `sb-addons/<name>-<N>/manager-bundle.js`. Present:
  `a11y-1`, `docs-2`, `storybook-core-server-presets-0`. **`<N>` is
  order-dependent exactly as ticket 06 predicted -- never hard-code it.**
- The literal ADDON_ID string survives minification:
  `rg -o '"storybook/a11y[a-z/-]*"'` on `sb-addons/a11y-1/manager-bundle.js`
  returns exactly `"storybook/a11y"`, 2 occurrences in the file (66,572 bytes).
  **Content-matching on ADDON_ID works.**
- `index.html` (the manager document) references the bundle **twice**, and the
  two forms are not equivalent:
  ```
  <link href="./sb-addons/a11y-1/manager-bundle.js" rel="modulepreload" />
      import './sb-addons/a11y-1/manager-bundle.js';
  ```
  The `import` is the load; the `modulepreload` is only a hint. **Assert the
  `import`.**
- `iframe.html` (16,777 bytes) contains **no `src="..."` at all**
  (`rg -o 'src="[^"]+"'` returned nothing, exit 1). Its three `<script>` tags
  are two inline config blocks and one `type="module"` block whose body is:
  ```
  import './sb-preview/runtime.js';
  import './mocker-runtime-injected.js';
  import './runtime~main.537c8652.iframe.bundle.js';
  import './270.772510a1.iframe.bundle.js';
  import './main.10947fd8.iframe.bundle.js';
  ```
  This is the correction in section 1.

---

## 3. Lane capability boundary, stated once

| Capability | `test` (jsdom) | `test-browser` | Playwright |
| --- | --- | --- | --- |
| Dart Sass compile of the real chain | **YES** (node build) | **YES** (browser build) | via the addon only |
| Which sass build | node entry | **browser entry** | browser entry, bundled |
| Custom `functions` / preset probe | YES | YES | via the addon only |
| Real `Worker` | **NO** | **YES** | YES |
| Real cascade / `@layer` | **NO -- layered rules dropped** | **YES** | YES |
| Computed style | partial, unlayered only | YES | YES |
| Storybook manager, panel, channel, URL | NO | NO | **YES** |
| Storybook preview iframe | NO | NO | **YES** |
| Static `build-storybook` artifact | NO | NO | **YES** (via `static-storybook`) |
| Emitted chunk layout | NO | NO | NO -- gate lane |
| Cost per assertion | lowest | medium (sass bundle per file) | highest |

Placement rule, applied throughout section 4: **the cheapest lane that can fail
for the right reason.** A lane that cannot observe the failure mode is not
cheaper, it is vacuous.

---

## 4. The assertion table

### Lane 1 -- `test` (Vitest, jsdom). Node sass build.

| ID | Assertion | Why this lane |
| --- | --- | --- |
| **T1** | Compiling the committed generated sources map with the addon's real options bag yields CSS whose sha256 equals the filesystem compile's, and whose byte length is 5839 for the default control set. | Ticket 08's fitness claim is a pure input/output property. jsdom resolves the node build and produced the identical digest [V-EXEC Q2]. No browser needed. |
| **T2** | Each of the six controls changes the expected declaration, asserted **differentially**: compile with value A and value B, assert both the expected literal AND `cssA !== cssB`. | Pure compilation. Differential form is the anti-vacuity lever (section 5). |
| **T3** | The preset baseline read (ticket 07's custom Sass `functions` probe) returns Foundation's six defaults and `$wcag-palette`'s three overrides, keyed exactly. | Verified working under jsdom [V-EXEC Q3]. The mechanism is compiler-side, not browser-side. |
| **T4** | Preset-equality: see section 4.1 -- five sub-assertions, all pure functions over six scalars. | Ticket 09 B.3 reduced this to scalars. There is nothing to observe in a DOM. |
| **T5** | Invalid input: the hex parser and the radius clamp reject/normalise; **plus** feeding the panel's write output through the real `buildArgsParam` yields a NON-EMPTY `?globals=`, with a deliberately-invalid control case yielding an empty one. | The whole-theme-drop hazard (ticket 09 A.4) is a property of Storybook's `buildArgsParam`, which is importable in Node. Ticket 09 already executed it from a Node probe. |
| **T6** | Sass error surface: a bad control value yields `sassMessage` and `span.url` with no ANSI in `message`; a mis-wired importer yields the FRIENDLY missing-importer diagnostic. | Ticket 09 D.7 requires importer tests on the main thread or in Node, because inside a Worker `document` is undefined and the diagnostic degrades to the generic message. jsdom is the Node-side lane. |
| **T7** | `structuredClone` of a `sass.Exception`-shaped error loses `sassMessage`/`span`/`name` (control), and `serializeSassError()`'s plain object survives `structuredClone` with both intact (subject). | Verified reproducible under jsdom [V-EXEC Q8]. The Worker itself is not needed to test the serialisation contract, and the control is what makes the subject load-bearing. |
| **T8** | Coalescer: latest-wins, one-deep `pending`, monotonic sequence, stale results discarded. Driven against a fake worker port. | Pure state machine (ticket 09 D.3's six lines). No `Worker` in jsdom [V-EXEC Q5], and a real one would only add scheduling noise. |
| **T9** | R026 config assertions -- four, see section 4.2. Block count stays 2. | The existing `nfs-button.r026-lint.spec.ts` already reads the live config with ESLint's `Linter` in this lane. |
| **T10** | The addon's compliant preset equals `{success:'#238648', warning:'#9e6c00', alert:'#cb4b37'}` -- byte-identical to the three literals the `nfs-demo` axe fixture proves -- and each clears WCAG AA at its Foundation-picked pairing. | Ticket 07 section 10's "one runnable check the collapse needs". It is the binding between the addon preset and the axe proof (section 6). |

**Explicitly NOT in this lane, with the reason:**

- **No cascade or `@layer` assertion.** jsdom discards layered rules [V-EXEC
  Q7c]. A jsdom R008 test passes with the library's defaults absent.
- **No `Worker` construction.** Undefined [V-EXEC Q5].
- **No browser-build sass import.** It is not what `sass` resolves to here, and
  loading it alongside the node entry throws [V-EXEC, section 2.2].

### 4.1 T4 in detail -- what preset equality still needs testing for

Ticket 09's theorem ("with canonical-minimal maps on both sides, sparse equality
IS resolved equality") removes the resolve step. It does **not** remove the
tests -- it MOVES them, because the theorem's truth depends entirely on the
write path maintaining canonical form. So the equality comparison itself is the
one thing barely worth testing, and the canonicaliser is the thing that must be:

| | Assertion | Note |
| --- | --- | --- |
| T4a | `canonical()` **deletes** a key whose value equals the Foundation default -- explicitly typing `#1779ba` into primary yields the ABSENCE of `primary`. | **The load-bearing one.** This single behaviour is what makes the theorem true. If it regresses, the addon shows `Custom` for a state that is visually the Foundation default, and no other assertion notices. |
| T4b | Normalisation on write: `#1779BA` -> `#1779ba`, `#abc` -> `#aabbcc`, `'4'` -> `4`. | Ticket 09 verified `buildArgsParam` preserves uppercase verbatim, so unnormalised uppercase genuinely reaches globals. |
| T4c | `equal(canonical(live), canonical(preset))` is true for the compliant preset's exact 3-key map, and false when exactly one value diverges. | The comparison proper. Trivial once T4a/T4b hold. |
| T4d | Preset ordering: first match wins; no match yields the literal `Custom`. | One line, removes the "flickers between two presets" class. |
| T4e | Round-trip property over a sample of maps: `canonical(resolve(x))` equals `canonical(x)`. | Fails the moment someone reintroduces a padded six-key write, which is the shape ticket 09 A.6 rejected. Cheap standing proof of the theorem's precondition. |

### 4.2 T9 in detail -- the R026 assertions, including the new divergence guard

| | Assertion | Expected |
| --- | --- | --- |
| T9a | The canonical injection shape at `.storybook/theming/inject-theme-style.ts` produces 0 messages. | exemption works |
| T9b | The same shape at the sibling `.storybook/theming/panel.ts` produces 2. | exemption is exactly one file wide (ticket 09 E.5) |
| **T9c** | **T9a run under BOTH path spellings** -- `.storybook/theming/inject-theme-style.ts` and `packages/ngx-foundation-sites/.storybook/theming/inject-theme-style.ts` -- produces 0 under each. | **NEW.** Catches the cwd/base-path divergence in-lane [V-EXEC, section 2.4: the config-dir-relative spelling scores 0/2] |
| **T9d** | Every `ignores` glob in the R026 blocks starts with `**/`. | **NEW.** A static shape assertion, one line, that names the rule instead of only testing its effect |

T9c is the behavioural guard and T9d is the readable one; keep both. Together
they mean the "green `nx test`, red `nx lint`" outcome cannot recur silently.

**Ticket 09 F.3 additionally asked for one real `nx lint ngx-foundation-sites`
run with the injection code present.** Keep it, but demote it: it is the L3
negative-control procedure (NC4), not a per-commit assertion. T9c covers the
class per-commit at zero cost; the real lint run is the once-off proof that T9c
models Nx faithfully.

### Lane 2 -- `test-browser` (Vitest, real Chromium). Browser sass build.

Keep this lane to **one spec file**. Each file pays the sass optimise/bundle
cost; every assertion here has to earn a browser.

| ID | Assertion | Why this lane and not lane 1 |
| --- | --- | --- |
| **B1** | The **browser** sass build compiles the real chain from the committed sources map, and the sha256 equals the Node producers'. | The only lane that runs the dart2js build the Worker chunk ships [V-EXEC B1/B2]. A browser-only Dart Sass regression is invisible everywhere else until `build-storybook` + Playwright. |
| **B2** | R008 cascade: the library's compiled `@layer nfs-defaults` defaults plus the addon's unlayered output, asserted in **both** insertion orders, **plus a layered-only control** proving layered rules apply at all. | jsdom drops layered rules [V-EXEC Q7c]. Real Chromium gives the right answer AND supports the control [V-EXEC B4/B5]. |
| **B3** | `inject-theme-style.ts` idempotency: three calls leave exactly one `#nfs-theming` node in `document.head`, last CSS wins. | Needs a real `document.head` with a real CSSOM. jsdom would pass this one, but it belongs beside B2's cascade assertion in the same file and costs nothing extra there. |
| **B4** | Real `Worker` round trip: a theme in, CSS out; a bad value in, the serialised plain error object out with `sassMessage` intact. | `Worker` exists only here [V-EXEC B3/Q5]. This is the end-to-end complement to T7's contract test. |
| **B5** | Any computed-colour assertion in this lane injects `* , *::before, *::after { transition: none !important }` first. | Foundation's 0.25 s `background-color` transition [V-PRIOR: research/05 section 4]. Not an assertion, a fixture rule -- stated here so it is not forgotten outside Playwright. |

### Lane 3 -- Playwright, `apps/nfs-storybook-e2e/`

Everything here needs the Storybook **manager**, which ticket 04 proved
`@storybook/test-runner` structurally cannot reach. Runs against
`static-storybook`, i.e. the built artifact.

| ID | Assertion | Notes |
| --- | --- | --- |
| **P1** | The addon LOADED: a panel tab named `Theming` exists in `#storybook-panel-root`, **and** zero manager `console.error` during load. | Ticket 06's layer 2. The console-error half is the only thing that catches esbuild's injected try/catch swallowing a crashing manager entry. Mirrors `.storybook/test-runner.ts`'s existing console gate, on the manager side. |
| **P2** | Driving the primary colour control changes the preview button's computed background-colour, asserted with auto-retrying `toHaveCSS`, **and** the pre-change value is asserted to differ from the post-change value in the same test. | Ticket 04 proved the manager-panel-to-canvas loop live in this repo. `toHaveCSS` / `toPass` is mandatory -- a one-shot `getComputedStyle` read the stale value twice in ticket 04's probe. |
| **P3** | Selecting `WCAG-compliant` seeds **all six** controls to their expected values (asserted individually, not "something changed"), and the preview's success / warning / alert buttons compute to `#238648` / `#9e6c00` / `#cb4b37`. | "Preset seeds every control" is the brief's claim; asserting each control by name is what makes it non-vacuous. |
| **P4** | After seeding, changing one control flips the selector to `Custom`; setting that control **back** to the preset value flips it back to `WCAG-compliant`. | Ticket 09 F.4: the set-it-back half is the derived-selection proof, and is the assertion a stored preset flag would fail. Both halves required. |
| **P5** | `iframe.html?globals=nfsTheme.primary:!hex(cb4b37)` yields injected CSS carrying `#cb4b37` while the other five read Foundation defaults; and selecting `Foundation default` produces an **empty** `?globals=`. | Ticket 09 F.5, plus the empty-param half, which is the sparse-map contract's observable consequence (ticket 09 A.6). |
| **P6** | The panel's first open goes `loading` -> `ready`, and no control write is possible while `loading`. | Ticket 09 B.4's async probe is intended behaviour, not a defect. Asserting it stops a future reviewer from "fixing" it and stops a test from racing it. |
| **P7** | Every style assertion waits on the readiness signal (section 4.3), never a timeout. | Ticket 01's readiness-gating requirement. |
| **P8** | An autodocs page renders under the currently selected theme and exposes **no** Theming panel. | Ticket 09 A.2's stated consequence. One cheap assertion pins a decision that otherwise reads as a bug report. Lowest priority of the eight; drop it first if the lane gets slow. |

**Fixture rules for the whole lane**, all inherited and all non-optional:
`addInitScript` seeding `sessionStorage['@storybook/manager/store']` layout;
`addStyleTag` disabling transitions; a pinned desktop viewport
(`devices['Desktop Chrome']`) so the panel does not become
`#storybook-mobile-addon-panel`; deep-link via `?path=` + `&addonPanel=` rather
than sidebar clicking.

### 4.3 The readiness signal the addon must expose

Ticket 01 required an explicit signal. Two test hooks, both cheap, both also
serving as anti-vacuity levers:

1. **`<style id="nfs-theming" data-nfs-seq="N">`** in the preview document.
   `N` is the coalescer's monotonic sequence number (ticket 09 D.4), already
   required by the design -- surfacing it as an attribute costs one line.
   Playwright waits with `expect(styleEl).toHaveAttribute('data-nfs-seq', '3')`,
   which is auto-retrying and deterministic. **A non-incrementing seq is a
   compile that never happened**, so it is also the anti-vacuity check for every
   P2/P3/P5 assertion.
2. **Panel root `data-testid="nfs-theming-panel"` carrying
   `data-nfs-panel-state="loading|ready|compiling|error"`**, plus stable control
   ids (`nfs-preset-select`, `nfs-color-<key>`, `nfs-color-<key>-text`,
   `nfs-radius`). Ticket 04 section 4 already demands explicit hooks because the
   built-in Controls markup drifted between Storybook versions; naming them here
   makes them a requirement on the addon rather than a discovery during test
   writing.

### Lane 4 -- build-time gates

| ID | Gate | Assertion |
| --- | --- | --- |
| **G1** | `verify-theming-sources` (ticket 08, on `lint`'s `dependsOn`) | (A) regenerate the closure in memory and byte-compare against the committed module; (B) the string-map compile's sha256 equals a filesystem compile with `loadPaths: ['packages/ngx-foundation-sites/src/scss','node_modules']`. |
| **G2a** | `verify-theming-bundle` (NEW, `dependsOn: build-storybook`) | Glob `dist/storybook/ngx-foundation-sites/sb-addons/*/manager-bundle.js`; **exactly one** file contains the literal `ADDON_ID`; `index.html` contains an `import './sb-addons/<that dir>/manager-bundle.js';` statement. Never hard-code `<N>` [V-DIST]. |
| **G2b** | same script | The sass marker `The compile() method is only available in Node.js.` appears in **exactly one** emitted `.js` file under `dist/storybook/ngx-foundation-sites/`. |
| **G2c** | same script | That file is **not** among `iframe.html`'s module imports. Parse the `import './...'` specifiers out of the `<script type="module">` block -- **not** `<script src=...>`, of which there are none [V-DIST]. |
| **G2d** | same script | A Foundation source marker (`$button-background-hover-lightness`) appears in that same marker-carrying file, proving the generated sources travelled with the Worker. |
| **G3** | committed negative-control evidence | Section 5.3. |

Why `verify-theming-bundle` is one new script and one new target, not four:
`verify-autodocs-coverage` is the precedent (one script, one `dependsOn:
build-storybook` target, several assertions with per-assertion "likely cause"
messages). Copy that shape, including the `failures[]` + `cause` reporting -- it
is what makes a red gate actionable.

---

## 5. Anti-vacuity: what fails if the addon silently emits nothing

M003's RTL specs assert a non-zero value **and** an ltr/rtl difference so a spec
cannot pass against an empty stylesheet. Applied per class:

### 5.1 Per assertion class

| Class | Silent-nothing failure mode | What catches it |
| --- | --- | --- |
| Compilation (T1, T2, B1) | compile returns `''` or a stub returns fixed CSS | **Differential form**: every assertion compiles twice with different inputs and asserts `cssA !== cssB` in addition to the literal. Plus the sha256 identity in T1/B1, which no stub can fake. |
| Preset baseline (T3, T10) | the `functions` probe never fires, `captured` stays `null` | Assert the captured map's **exact key set**, not just membership; `null`/`{}` fails. T10 additionally pins the three hex literals. |
| Preset equality (T4) | a stub returning always-`Custom`, or always-selected | T4c asserts BOTH polarities in one pair. T4a asserts a deletion, which an identity function fails. |
| Validation (T5) | a parser that accepts everything, or rejects everything | Paired accept/reject cases, and the `buildArgsParam` assertion has both a non-empty and a deliberately-empty case, so "always non-empty" and "always empty" both fail. |
| Error surface (T6, T7) | error path never reached; serialisation silently lossy | T7's **control** (raw `structuredClone` loses the fields) is what makes the subject meaningful. Without the control the subject could pass against an error object that never carried the fields. |
| Cascade (B2) | the layered defaults are not present at all -- exactly what jsdom does | The **layered-only control** ([V-EXEC B5] `rgb(3, 3, 3)`): if layered rules are not applied, the control fails and the whole assertion is disqualified. This control is why B2 is not in lane 1. |
| Injection (B3, P2) | addon injects nothing; there is no `<style id="nfs-theming">` | Assert node existence AND `textContent.length > 0` AND the `data-nfs-seq` increment AND the computed-style change. An addon emitting nothing fails all four. |
| Addon load (P1, G2a) | a green build with an unresolvable or crashing addon | G2a asserts the bundle exists AND is imported by `index.html`; P1 asserts the tab renders AND zero manager `console.error`. Ticket 02 established a green build proves nothing. |
| Lazy loading (G2b/c) | a scan finds nothing because the glob is wrong | **Positive controls before negative assertions**: assert `>= 5` emitted `.js` files and `>= 3` iframe import specifiers were found before asserting the marker's absence from them. Section 5.2. |
| Sources freshness (G1) | the generated map is empty or stale | Byte-comparison against a regeneration, plus the fitness digest. An empty map fails to compile at all. |
| Manager reachability | the whole Playwright lane silently runs against a stale `dist` | The lane's `dependsOn` chain rebuilds; and P2's pre/post differential cannot pass on a build without the addon. |

### 5.2 The vacuity trap in the gate itself, and its fix

A `verify-*.mjs` that asks "is X absent from Y" is the easiest place in this
whole design to write a permanently-green check. Two concrete instances found:

1. **Ticket 08's assertion 2 as written.** "Not referenced by any `<script src>`
   in `iframe.html`" -- and `iframe.html` has **zero** `src="` attributes
   [V-DIST]. The check would pass forever, including with `sass` statically
   imported into the preview. **Fixed** by parsing the `import './...'`
   specifiers from the `<script type="module">` block (G2c), and by asserting
   the parse found at least three specifiers before concluding anything.
2. **A hard-coded `sb-addons/packages-ngx-foundation-sites-storybook-1/`
   path.** `<N>` is order-dependent; a wrong `N` yields "file not found", which
   a sloppy script reports as "addon not present" -- correct-looking, and it
   would also report that after any addon reorder. **Fixed** by globbing
   `sb-addons/*/manager-bundle.js` and content-matching ADDON_ID (verified to
   survive minification [V-DIST]), then asserting **exactly one** match. Zero
   and two are both failures.

General rule for the script: **every absence assertion is preceded by a
presence assertion over the same collection.**

### 5.3 Negative controls (L3), mandatory

The repo's precedent is committed execution evidence
(`.autodocs-coverage-evidence.txt`,
`apps/nfs-demo/.registry-consumption-evidence.txt`) and M001/S11 proved its
console-error check by deliberately breaking it. Same shape here: one committed
`packages/ngx-foundation-sites/.theming-negative-control-evidence.txt` recording
five break-and-observe runs.

| # | Break | Must go red |
| --- | --- | --- |
| NC1 | blank one entry in the generated sources map | `verify-theming-sources` (G1-A) **and** the Playwright compile assertion (P2) |
| NC2 | rename `ADDON_ID` in the manager entry | `verify-theming-bundle` G2a **and** P1 |
| NC3 | add a static `import 'sass'` to `.storybook/preview.ts` | `verify-theming-bundle` G2c (marker now reachable from `iframe.html`) |
| NC4 | change the R026 `ignores` glob to the config-dir-relative spelling | T9c **and** a real `nx lint ngx-foundation-sites` run. Already demonstrated at probe level [V-EXEC, section 2.4] |
| NC5 | comment out the `textContent` assignment in `inject-theme-style.ts` | B3, P2, and the `data-nfs-seq` wait in P7 |

NC4 is the one that would otherwise have no runtime symptom at all, and NC3 is
the one that protects a decision (lazy loading) rather than a behaviour.

---

## 6. Nx target wiring, and the port-4400 collision

### 6.1 New and changed targets

```jsonc
// packages/ngx-foundation-sites/project.json
"lint": {
  "dependsOn": [
    "@ngx-foundation-sites/source:verify-browserslist",
    "verify-foundation-parity",
    "verify-exports-map",
    "verify-theming-sources"          // NEW (ticket 08)
  ]
},
"verify-theming-sources": {           // NEW (ticket 08 section 7)
  "executor": "nx:run-commands",
  "inputs": [
    "{projectRoot}/scripts/generate-theming-sources.mjs",
    "{projectRoot}/src/scss/**/*.scss",
    "{projectRoot}/.storybook/**/*.generated.ts",
    "{workspaceRoot}/package-lock.json"
  ],
  "options": {
    "command": "node packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs --check",
    "cwd": "{workspaceRoot}"
  }
},
"verify-theming-bundle": {            // NEW (this ticket)
  "executor": "nx:run-commands",
  "dependsOn": ["build-storybook"],
  "options": {
    "command": "node packages/ngx-foundation-sites/scripts/verify-theming-bundle.mjs",
    "cwd": "{workspaceRoot}"
  }
},
"test-storybook": {                   // CHANGED -- see 6.2
  "executor": "nx:run-commands",
  "dependsOn": ["verify-autodocs-coverage", "static-storybook"],
  "options": {
    "command": "wait-on tcp:4400 && test-storybook -c packages/ngx-foundation-sites/.storybook --url=http://localhost:4400"
  }
}
```

```jsonc
// apps/nfs-storybook-e2e/project.json (NEW project, ticket 04 section 5.2)
{
  "name": "nfs-storybook-e2e",
  "projectType": "application",
  "targets": {
    "e2e": {
      "executor": "nx:run-commands",
      "outputs": ["{projectRoot}/test-results"],
      "dependsOn": [
        "ngx-foundation-sites:verify-theming-bundle",
        "ngx-foundation-sites:static-storybook"
      ],
      "parallelism": true,
      "options": { "cwd": "apps/nfs-storybook-e2e", "command": "playwright test" }
    }
  }
}
```

`test` and `test-browser` need **no** target changes -- both are glob-driven
(`exclude: ['**/*.browser.spec.ts']` / `include: ['**/*.browser.spec.ts']`), so
new specs are picked up by filename alone [V-REPO: `project.json:53-67`].

Why the bundle gate hangs off the **e2e lane** rather than off `lint`: it
inspects `dist/`, exactly like `verify-autodocs-coverage`, and ticket 08 already
argued that source-level gates belong on `lint` and artifact-level gates do not.
Making it a `dependsOn` of `e2e` means the Playwright lane cannot run against a
build whose addon did not load -- the gate fails first, with a legible message,
instead of the specs failing with a missing panel tab.

### 6.2 The port-4400 collision -- LOCKED: ticket 04's option (a), with `wait-on` kept

`test-storybook` currently starts its **own** `static-storybook` via
`concurrently` on port 4400 [V-REPO: `project.json:163-169`]. The new e2e target
depends on `static-storybook`, also 4400. `nx run-many -t e2e,test-storybook`
would race two servers onto one port.

**Locked:** refactor `test-storybook` to `dependsOn: ["verify-autodocs-coverage",
"static-storybook"]` and drop `concurrently`. Nx then runs **one**
`static-storybook` task and both lanes attach to it.

Grounds:

- `static-storybook` is genuinely `continuous: true` [V-EXEC:
  `nx show project ngx-foundation-sites --json` reports `continuous: true` for
  `static-storybook` and `false` for every other target], so it is a valid
  `dependsOn` for a non-continuous consumer. `apps/nfs-demo:e2e` already depends
  on four continuous serve targets [V-REPO], so the pattern is proven here.
- It removes the `concurrently -k -s first` layer and the second server.
- Both lanes then provably exercise **the same served artifact**.

**`wait-on tcp:4400` is KEPT, deliberately.** Nx's continuous-task ordering
starts the dependent once the task is running, not once the port answers -- which
is exactly why `apps/nfs-demo/playwright-global-setup.ts` polls until `fetch`
succeeds [V-PRIOR: research/04 section 4]. Dropping `wait-on` would trade a port
collision for a start-up race. The new Playwright lane gets the same treatment
via a `globalSetup` copied from nfs-demo's.

Rejected alternative (ticket 04's option b): give the e2e lane its own port via
a `static-storybook` configuration. Lower blast radius, but it leaves
`concurrently` in place, keeps two Storybook servers, and adds a port to
remember. It is the fallback if continuous-task sharing misbehaves in CI.

### 6.3 What is deliberately NOT wired

- **`nfs-demo:verify-registry-consumption` gains no `dependsOn`.** Tickets 07
  and 08 both raise it. It publishes to a local Verdaccio and reinstalls; making
  it a dependency of `lint` or `e2e` would put a registry server in the standard
  battery. It does not need to be wired, because the failure it guards is
  **already loud**: once `apps/nfs-demo/src/styles.scss` reads
  `nfs-button.$wcag-palette`, a stale tarball fails `nfs-demo:build` with an
  undefined-variable error, and `build` feeds every serve target and `e2e`
  [V-PRIOR: research/07 section 7]. The sequencing requirement (source ->
  re-run `verify-registry-consumption` -> re-point `styles.scss`, in one change)
  belongs in ticket 11's requirements, not in a new gate.
- **`verify-autodocs-coverage` is not extended to the addon.** map.md lists the
  docs surface under "Not yet specified"; extending a docs gate to an
  undocumented surface is inventing the requirement.
- **`build-storybook --test` gets no guard.** Ticket 05 built that branch and got
  byte-identical CSS from a genuinely mangled bundle. A comment, nothing more.

---

## 7. How D023 is finally proven

D023 clause 3 -- "the axe suite runs against the compliant theme for its
zero-violations proof" -- is the last undischarged piece. **LOCKED: it stays
in `apps/nfs-demo`, exactly where it already is. Nothing is re-pointed.**

### 7.1 The decision

> **The `m002-compliant` fixture in `apps/nfs-demo/e2e/nfs-button-a11y.spec.ts`
> remains the axe proof, unchanged in shape.** After ticket 07's collapse it
> scans CSS compiled from the shipped `$wcag-palette` constant, delivered
> through a **real published tarball** over the `exports`-gated public subpath,
> in **both CSR and SSR** [V-PRIOR: research/07 sections 7-8].
>
> **`@storybook/addon-a11y` is NOT re-pointed at the addon-applied preset, and
> no axe scan is added to the Storybook lanes.**
>
> **The addon's preset is bound to the axe-proven palette by identity (T10), not
> by a second scan**, and by one rendered-style assertion (P3).
>
> **The default theme's three `expectedContrastFailures` literals stay exactly
> as they are** -- `{alert, #fefefe, #cc4b37}`, `{hollow-success, #3adb76,
> #ffffff}`, `{hollow-warning, #ffae00, #ffffff}` [V-REPO:
> `nfs-button-a11y.spec.ts:67-98`]. They are NOT collapsed into
> `$wcag-palette`, nor into any shared map, nor into an import.

### 7.2 Why the demo app and not Storybook

1. **It is a strictly stronger proof.** The tarball route exercises the public
   `exports` surface a real npm consumer resolves, in two rendering modes. A
   Storybook scan exercises a dev-only bundle in one mode.
2. **A Storybook-side scan would prove less, later.** The addon compiles the
   same `$wcag-palette` from the same `_button.scss` with the same Dart
   Sass -- and the output is now byte-identical across **six** producers
   (browser-Terser, browser-esbuild, Node-stringmap, Node-filesystem, jsdom-node
   [V-EXEC Q2], Chromium-browser-build [V-EXEC B2], all sha256
   `49bfb1a2e67bf91a`). Scanning the addon's output for contrast re-measures
   colours already measured, through a longer and flakier chain.
3. **It would be a genuinely flakier chain.** Ticket 09 F.8: the compliant
   preset's values reach the addon only through an **async Worker probe at panel
   init**, so an addon-driven scan must wait for the panel to become `ready`
   before asserting. The Sass-side scan has no such wait.
4. **`@storybook/addon-a11y` re-pointing is not free either.** Its panel scan is
   manual/on-demand in the manager; making it a gate means driving it from the
   Playwright lane, i.e. adding an axe dependency and a scan to a lane whose
   entire purpose is the manager UI.

### 7.3 What actually closes the loop, then

Three assertions, none of them an axe run:

- **T10 (lane 1)**: the preset the addon seeds IS `{success:'#238648',
  warning:'#9e6c00', alert:'#cb4b37'}` -- read through the addon's own probe
  mechanism, compared against the three literals the axe fixture proves -- plus
  a WCAG AA ratio computation over them. If the addon ever seeds a different
  palette, this fails, and the axe proof it inherits stops applying.
- **P3 (lane 3)**: selecting the preset renders those exact colours in the
  preview. The preset is not merely stored correctly, it reaches pixels.
- **The existing `m002-compliant` fixture**: those colours produce zero axe
  violations, over the published package, CSR and SSR.

Chained: *these three hexes clear axe* (demo) + *the addon seeds exactly these
three hexes* (T10) + *seeding renders them* (P3). D023's "the axe suite runs
against the compliant theme" is discharged for the preset without a second
scanner, and the identity link is a millisecond-scale unit assertion rather than
a browser run.

### 7.4 The hard constraint, restated as a test-design rule

The default theme's `expectedContrastFailures` is an **exact-set** assertion. An
exact-set assertion must name its expectations as literals; sourcing them from
the same map the code under test uses makes it assert its input against itself
[V-PRIOR: research/07 section 2]. So:

- the three failure literals stay hand-written in the spec;
- the `m002-compliant` fixture keeps `expectedContrastFailures: []`;
- ticket 07's comment-only edits (drop the hexes from the *comments* at
  `app.component.ts:105-106` and `nfs-button-a11y.spec.ts:107`, name the
  constant instead) touch prose only, never the fixture data at
  `nfs-button-a11y.spec.ts:67-98`;
- **no new suppression, no `runOnly` narrowing, no rule disable** anywhere in
  M002.

The one drift surface left is the README's hand-typed hexes. Ticket 07 named a
~15-line README-drift check as optional. **Rejected, and named:** it is
documentation drift, not correctness drift; the axe fixture is the real gate and
the README paragraph's value is the measured ratios. Not worth a gate.

---

## 8. What ticket 11 must carry into the requirements

1. **R021 is satisfied by four lanes, not two.** The requirement text should say
   "Vitest (`test` and `test-browser`) and Playwright, plus build-time gates",
   because the gate lane carries assertions no test can make (chunk layout, addon
   load in the built artifact, sources freshness).
2. **The addon must ship explicit test hooks** -- `data-nfs-seq` on the injected
   style node and `data-nfs-panel-state` + control test ids on the panel
   (section 4.3). This is a requirement on the addon, not a test detail: ticket
   04 showed Storybook's own built-in Controls markup drifted between versions,
   so tests must not reverse-engineer emotion-generated markup.
3. **The panel loads asynchronously on first open, by design** (ticket 09 B.4).
   Requirement text must state the `loading -> ready` sequence, or P6 reads as a
   test for a bug.
4. **The compliant preset's axe proof is inherited from `apps/nfs-demo`, via a
   data-identity assertion.** Requirement text should state the chain explicitly
   (section 7.3) so nobody later "improves" it by adding a Storybook axe scan.
5. **The `$wcag-palette` rewire is ONE atomic change with three ordered
   parts** -- add the constant, re-run `nfs-demo:verify-registry-consumption` and
   commit the refreshed evidence, then re-point `styles.scss`. Splitting it
   leaves a broken demo build. There is no gate for this; the sequencing is the
   requirement [V-PRIOR: research/07 section 7].
6. **The default theme's three expected-failure literals are frozen.** State it
   as a constraint, not as an implementation note -- D023 forbids blanket
   suppression, and collapsing the literals is the subtle form of it.
7. **`test-storybook` changes shape** (drops `concurrently`, gains
   `dependsOn: static-storybook`). It is a modification to a working target and
   should be a named task, not a side effect of adding the e2e project.
8. **The negative-control evidence file is a deliverable**, five entries
   (section 5.3), committed. NC4 in particular has no runtime symptom.
9. **One `nx lint ngx-foundation-sites` run with the addon's injection code
   present** is a once-off acceptance step (ticket 09 F.3), distinct from the
   per-commit T9c assertion.
10. **Deliberately deferred, unchanged**: extending `verify-autodocs-coverage` to
    the addon; a README-hex drift check; wiring
    `nfs-demo:verify-registry-consumption` into any `dependsOn`; a
    `build-storybook --test` guard; non-Chromium browsers in the Playwright lane
    (a Storybook addon's behaviour is not a CSS-engine claim, unlike nfs-demo's
    logical-properties matrix).

---

## 9. VERIFIED vs INFERRED

### VERIFIED by execution this session

- A Vitest **jsdom** spec resolves `sass` to the **Node** build
  (`sass.compile()` threw `no such file or directory`, not the browser build's
  Node-only message).
- The real `theme()` chain compiles under jsdom from the 16-file in-memory map:
  **5839 bytes, sha256[0:16] `49bfb1a2e67bf91a`**, importer log 17 canonicalize
  / 16 load / 0 misses -- identical to ticket 05's four producers.
- Ticket 07's custom-`functions` capture returns a real `SassMap` under jsdom:
  `{primary:#1779ba, secondary:#767676, success:#3adb76, warning:#ffae00,
  alert:#cc4b37}`.
- `typeof Worker === 'undefined'` under jsdom; `self` is an object.
- `structuredClone` exists under jsdom and **drops** a `sass.Exception`-shaped
  error's `name`, `sassMessage` and `span` (own keys `[]`).
- **jsdom discards `@layer`-wrapped rules**: a layered-only rule computes
  `rgba(0, 0, 0, 0)`. Two earlier "unlayered wins" results in jsdom were
  therefore vacuous.
- Loading `sass`'s **node** entry and then its **browser** entry in one context
  throws `TypeError: Cannot read properties of undefined (reading 'pop')` at
  `sass/sass.default.js:4` (`globalThis._cliPkgExports.pop()`).
- A Vitest **browser-mode** spec (real headless Chromium, 4.1.10 +
  `@vitest/browser-playwright`) resolves `sass` to the **browser** build
  (`compile()` threw the Node-only message; 40 exported keys), compiles the real
  chain to **5839 bytes / `49bfb1a2e67bf91a`**, has `typeof Worker ===
  'function'`, keeps unlayered CSS winning over `@layer nfs-defaults` with the
  layered sheet inserted LAST, and **does** apply a layered-only rule
  (`rgb(3, 3, 3)`) -- the control jsdom fails.
- Against the live `packages/ngx-foundation-sites/eslint.config.mjs` with the
  R026 carve-out applied: a **config-dir-relative** `ignores` glob is exempt
  under a package-relative path and **fires (2 messages)** under a
  workspace-root-relative one; the **`**/`-prefixed** glob is exempt under both.
  Block count stays 2. The live config's only `ignores` glob is `**/*.spec.ts`,
  already `**/`-prefixed.
- `nx show project ngx-foundation-sites --json`: `static-storybook` is the only
  target with `continuous: true`.
- In `dist/storybook/ngx-foundation-sites/`: addon bundles are at
  `sb-addons/{a11y-1,docs-2,storybook-core-server-presets-0}/manager-bundle.js`;
  the literal `"storybook/a11y"` survives minification inside
  `sb-addons/a11y-1/manager-bundle.js` (66,572 bytes, 2 occurrences);
  `index.html` both `modulepreload`s and `import`s that path; **`iframe.html`
  contains no `src="` attribute at all** and loads the preview via five
  `import './...'` specifiers inside one `<script type="module">`.

### INFERRED (reasoned, not executed)

- That the real `test-browser` lane (`@nx/angular:unit-test`, `browsers:
  ['ChromiumHeadless']`) resolves `sass` the same way the standalone
  browser-mode probe did. Both are Vitest browser mode over Vite's browser
  conditions; the probe used the same Vitest version from this repo's
  `node_modules`, but not the Nx executor's generated config.
- That `optimizeDeps.include: ['sass']` will be wanted in the browser lane. The
  probe's reload warning is the only evidence, and the assertions passed anyway.
- That Nx shares one `static-storybook` task between `test-storybook` and
  `nfs-storybook-e2e:e2e` in a single `run-many`. Grounded in `continuous: true`
  and in `nfs-demo:e2e`'s four continuous dependencies, but the two-dependents
  case was not executed. Fallback named in 6.2.
- That a stale tarball fails `nfs-demo:build` with an undefined-variable error
  (ticket 07's own inference, carried).
- That the addon's emitted bundle directory will be
  `sb-addons/packages-ngx-foundation-sites-storybook-<N>/` (ticket 06's
  prediction). The design never depends on it -- G2a globs and content-matches.
- That the `data-nfs-seq` attribute is a sufficient readiness signal for every
  Playwright style assertion. It is derived from ticket 09's already-required
  sequence number; the addon does not exist yet to observe it.

### CARRIED from tickets 01-09 without re-verification

Ticket 04's whole harness decision (`@storybook/test-runner` cannot reach the
manager; the dedicated `@playwright/test` project; the `focusableUIElements`
selector set; `SbPage` as a pattern; the seven flake sources; `static-storybook`
as the server). Ticket 05's timings, the four-producer sha256, the transition
flake, the Worker frame-gap numbers, the `alertColor: false` error shape.
Ticket 06's delivery shape, `toHaveLength(2)` constraint, and three-layer
addon-load framing. Ticket 07's palette values, the tarball-consumption
mechanism, the `internal/*: null` non-issue, and the D023 clause-by-clause
discharge. Ticket 08's generator, committed data module, `verify-theming-sources`
gate, and the lazy-by-construction worker chunk. Ticket 09's sparse
canonical-minimal globals model, the derived preset selection, the single
unlayered `<style>` node, the coalescer, the R026 carve-out and its `**/` rule,
and the Worker-boundary error-serialisation requirement.
