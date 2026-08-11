# The Foundation settings migration surface, and what M002 must not foreclose

Resolves ticket `.scratch/m002-storybook-theming-addon/issues/15-foundation-settings-migration-surface.md`.
Status: **resolved, verdict LOCKED** (AFK -- no human in the loop, per map.md Notes).

No repo file was changed. Everything written landed under `.scratch/`. Three
reproducible probes were left behind, all read-only against the real tracked
library files and the real `node_modules/foundation-sites`:

- `prototypes/settings-surface-probe.mjs` -- what happens TODAY when a consumer
  tries to bring Foundation settings across (question 4).
- `prototypes/settings-reachability-probe.mjs` -- static partition of all 490
  settings plus dynamic seed-injection into an in-memory copy of the island
  (question 2).
- `prototypes/settings-map-shape-probe.mjs` -- a mechanically rewritten,
  map-configurable settings module, to test the only candidate that hits the
  "set only what you changed" bar while staying loud (questions 1 and 3).

## Evidence key

- **[V-EXEC]** -- verified by executing a probe here, output quoted.
- **[V-REPO]** -- verified by reading a tracked file in this repo (path + line).
- **[V-SRC]** -- verified by reading shipped `node_modules` source (path + line).
- **[V-PRIOR]** -- carried from tickets 01-14's own verification, cited.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

---

## 1. The scoping verdict

**M002 owns NOTHING of the Foundation settings API, and it must not invent one.**
The settings surface belongs to a dedicated later milestone, on three grounds,
each measured rather than asserted. **First**, the surface is unbuildable at
today's component count in a way that is not a scheduling preference but a
structural fact: **481 of Foundation's 490 settings are read only by component
partials that do not exist in this library**, only **42** are referenced anywhere
in the button chain's actual 13-partial closure, and only **6** are consumed by
`util/` + `_global.scss` alone [V-EXEC]. A settings API designed against 42 names
would be validated by exactly one component and would be the same expiring-premise
error the map has now corrected three times, merely inverted. **Second**, every
plausible mechanism requires editing `packages/ngx-foundation-sites/src/scss/internal/_settings.scss`
-- turning its 26 deliberate plain assignments into `!default` or map-driven
reads -- which is a change to the library's own compile-time contract, touches
the island's seeding idiom that `verify-foundation-parity` gates
[V-REPO: `scripts/verify-foundation-parity.mjs:27,43-45`], and is a *library*
milestone's work. M002 ships a Storybook addon and one `$wcag-palette` data
module; it does not touch that file at all. **Third**, and decisively, the tension
the ticket asked to reconcile resolves in favour of a mechanism M002 cannot
deliver a fragment of: `@use ... with (...)` is **verified viable for a settings
module and verified LOUD on unknown names** -- but it can be applied **exactly
once per compilation, before any other load** [V-EXEC], which makes it an
all-or-nothing, order-coupled contract. A half-shipped settings surface is worse
than none, because the once-and-first rule turns every later addition into a
consumer-visible ordering constraint. So the whole of it belongs to one
deliberate milestone.

What M002 *does* own is **seven non-foreclosure constraints** (section 2) plus one
positive obligation it is uniquely placed to discharge: M002 is the milestone that
ships this library's first user-facing theming documentation (R009's README
deliverable), and today's failure mode is a **silent ignore** -- pasting all 490
of Foundation's settings compiles clean, emits **byte-identical** CSS, and warns
nothing [V-EXEC]. That is why this ticket runs now rather than later: the
constraints below cost nothing today and are expensive-to-impossible to retrofit,
and the documentation slot exists only in M002.

---

## 2. What M002 must NOT foreclose

Seven constraints. Each states the mechanism, what breaks if ignored, and the
cost of honouring it now.

### NF1. `_theme.scss` stays a DATA module. It must never gain a `!default` member, and it is NOT the settings entry point.

Ticket 12's C1 creates `src/scss/_theme.scss` holding `$wcag-palette`, exported as
`"./scss/theme"` [V-PRIOR: research/12 C1]. The ticket asks whether it is also the
settings entry point. **It must not be**, and the ground is mechanical, not
aesthetic.

A settings entry point has to be *configurable*, which under `@use` means
`@use '...' with (...)`. That configuration can be applied **once per
compilation, and only before anything else has loaded the module** [V-EXEC,
`settings-use-with-probe.mjs`]:

```
G2a  ERROR  the SAME module configured twice, byte-identical values
     This module was already loaded, so it can't be configured using "with".
G2b  ERROR  configured AFTER the library module already loaded it (wrong order)
     This module was already loaded, so it can't be configured using "with".
G2c  ERROR  two consumer partials each configure it (realistic multi-file app)
     This module was already loaded, so it can't be configured using "with".
```

`_theme.scss` is by design something consumers **read** --
`@use 'ngx-foundation-sites/scss/theme' as nfs-theme; ... $palette: nfs-theme.$wcag-palette`
[V-PRIOR: research/12 C1], and `apps/nfs-demo/src/styles.scss` is rewired to do
exactly that (HANDOFF s5.2). If that same module later becomes the configuration
point, **G2b is the exact failure**: any stylesheet that reads the palette has
already loaded the module, so a `@use ... with` anywhere later in the same
compilation is a hard error. The demo app, and every consumer following the
README, would be locked out of configuring settings by the act of reading the
compliant palette.

**What breaks if ignored:** either a breaking move of the configuration point out
of a published module, or a published API where reading the WCAG palette and
configuring settings are mutually exclusive in one compilation.

**Cost of honouring it now: zero.** `_theme.scss` is not built. Keep it plain
assignments (as C1 already specifies), one member, no `!default`. The future
settings module is a *separate* file (`scss/_settings.scss` -> `"./scss/settings"`
or similar) whose key does not exist yet.

### NF2. The addon's six controls must be documented as an addon surface, never as the library's settings vocabulary.

This is the error class the ticket exists to correct, restated as a forward
constraint. R009's control table and the panel are a **live-tweak subset of
`theme()`'s arguments**. The library's settings vocabulary is Foundation's 490
names. These are different sets with different owners, and the smaller one must
never be cited as evidence about the larger one.

**What breaks if ignored:** the withdrawn Out-of-scope entry comes back a fourth
time -- a future reader sees six controls, concludes the library's Sass API is
"five colours and a radius", and either blocks a legitimate settings surface or
designs one shaped like a Storybook panel.

**Cost: zero.** One sentence in R009 and one in the README section R009 already
ships.

### NF3. The generated entry string must reserve an ordered leading slot for configuration.

Ticket 12's C2 makes the addon's compile call a `THEMEABLE_MODULES.map()`
[V-PRIOR: research/12 C2]:

```js
const entry = [
  ...THEMEABLE_MODULES.map((m) => `@use '${m.url}' as ${m.namespace};`),
  ...THEMEABLE_MODULES.map((m) => `@include ${m.namespace}.theme${args};`),
].join('\n');
```

G2b proves configuration must come **before every `@use` of a module that
transitively loads it**. The library's island `@use`s `internal/settings`
[V-REPO: `internal/_foundation-button.scss:22`], so `@use 'nfs:/button'` loads it
immediately. If a settings module lands and the entry string is built as
"modules first, extras appended", the addon can never configure it.

**What breaks if ignored:** the addon's entry builder needs restructuring at the
exact moment a settings surface ships, in a worker whose diagnostics degrade
(`isBrowser()` is false inside the Worker [V-PRIOR: research/09 D.7]).

**Cost: zero.** Build the entry as an ordered array of sections with the
configuration section FIRST and empty today, rather than as a concatenation
where the config would be appended. Same ~4 lines C2 already specifies.

### NF4. The generator's entry-point arrays stay data, and no gate may freeze a literal closure file count.

Ticket 12's C3 makes closure discovery take N entry points
(`THEMEABLE_MODULES` + `DATA_MODULES`) and proves by negative control that a
single-entry closure cannot see `_theme.scss` [V-PRIOR: research/12 C3, Q1b]. A
settings module is the *same* class of file: nothing `@use`s it until a consumer
does, so it enters the inlined sources only by being listed.

**What breaks if ignored:** the settings module is silently absent from the
committed sources artefact, and the failure surfaces as a runtime
`Can't find stylesheet to import` inside the Worker rather than at build time.
Separately, if `verify-theming-sources` asserts "16 files", adding the module
turns a correct change into a red gate for the wrong reason.

**Cost: zero.** C3 already specifies arrays; this adds only "the gate asserts on
the arrays and the byte-compare, never on a literal file count".

### NF5. M002 must not touch `internal/_settings.scss` -- no `!default`, no split, no new members.

Ticket 12's C5 already flags the global/button-scoped split as deferred
[V-PRIOR: research/12 C5]. This constraint is stronger and about `!default`
specifically. The file's own header records why the assignments are plain: "there
is no `@use ... with (...)` surface left to configure"
[V-REPO: `internal/_settings.scss:1-9`].

The `internal/*: null` exports mapping is **documentation, not enforcement** --
re-verified here from a third angle: a direct `@use` of
`internal/_settings.scss` compiles and reads `$primary-color` fine [V-EXEC, P7a],
consistent with tickets 07 and 12's resolver findings. So the moment any of those
26 names carries `!default`, it is de-facto configurable public API on the Sass
`loadPaths`, `pkg:` and Angular-importer paths, with **no key validation and no
version story**.

**What breaks if ignored:** the loud-failure property measured in section 4
(unknown/misspelled keys are hard errors) is lost forever, because piecemeal
`!default` gives partial configurability that consumers will depend on before the
settings milestone can design the key set.

**Cost: zero** -- it is an instruction not to do something M002 has no reason to
do. The one live coupling to record: the addon's defaults probe reads six names
out of this file [V-PRIOR: research/12 C5]. Record it as a named seam owned by the
settings milestone, and keep the probe's variable list in the generated data
module beside `THEMEABLE_MODULES` rather than inline in the Worker -- same file,
no new concept.

### NF6. M002's README section must document today's silent-ignore behaviour as a known limitation.

The positive obligation. Verified behaviour (section 4): pasting Foundation's
entire `_settings.scss` produces **byte-identical** CSS with no warning, and a
typo'd palette key silently emits a junk rule.

**What breaks if ignored:** a consumer migrating from Foundation for Sites pastes
their settings file, gets a green build and Foundation's default theme, and has no
signal at all. That is the single worst migration outcome, and M002 is the only
milestone in flight that ships theming documentation.

**Cost: two sentences** in a README section R009 already owns -- name the four
public arguments as the entire compile-time surface today, and state explicitly
that Foundation `$variable` declarations in consumer stylesheets have no effect.

### NF7. R009's "Foundation global" identity column is vocabulary, not wiring. Three of the six named globals are provably inert.

Ticket 12's C6 reframes the six controls as `$foundation-palette` keys plus
`$global-radius` [V-PRIOR: research/12 C6]. The *vocabulary* claim is right. The
*mechanism* claim is false today, and the ticket-14 precedent for
`$global-text-direction` generalises further than ticket 12 realised. Seeding each
name into an in-memory copy of the island and diffing the CSS [V-EXEC,
`settings-reachability-probe.mjs`]:

```
$foundation-palette      -> NO EFFECT on emitted CSS
$primary-color           -> NO EFFECT on emitted CSS
$global-radius           -> NO EFFECT on emitted CSS
$global-text-direction   -> NO EFFECT on emitted CSS
$global-font-size        -> NO EFFECT on emitted CSS
$global-margin           -> NO EFFECT on emitted CSS
$button-radius           -> CHANGED css (5841B vs 5839B)
$button-padding          -> CHANGED css (5836B vs 5839B)
$button-font-family      -> CHANGED css (5844B vs 5839B)
$button-transition       -> CHANGED css (5799B vs 5839B)
$callout-background      -> NO EFFECT on emitted CSS
```

Mechanism: the island seeds the *derived* names (`$button-palette`,
`$button-radius`, ...) non-`!default` **before** the `@import`s
[V-REPO: `internal/_foundation-button.scss:30-49`], so Foundation's own derivation
assignments -- `$button-radius: $global-radius !default`, and
`add-foundation-colors`' `!global` transfer of `$foundation-palette` into
`$primary-color`.. [V-SRC: `foundation-sites/scss/util/_color.scss:125-145`,
invoked at `_global.scss:138`] -- never fire. The upstream globals are dead ends.
Ticket 14's `$global-text-direction` case is therefore **one instance of a general
rule**, not a special case: pre-seeding a derived name kills its entire upstream
cascade.

**What breaks if ignored:** a settings milestone implements the obvious mapping
(route the six controls through `$foundation-palette` / `$global-radius`) and
ships a no-op that compiles clean -- the same silent failure this ticket is about,
introduced by the fix for it.

**Cost: one footnote** on R009's table.

---

## 3. The `@use ... with (...)` reconciliation, ground by ground

`_button.scss`'s header records three measured grounds for rejecting
`@use ... with (...)` as the **theme API** [V-REPO: `_button.scss:21-25`]. Each
was re-tested against a settings **module**, using an in-memory `!default` variant
of `internal/_settings.scss` whose unconfigured output is byte-identical to the
real file (5839 B) [V-EXEC, `settings-use-with-probe.mjs`].

### Ground 1 -- "forced the consumer to type bare Foundation-shaped globals": APPLIES, and INVERTS.

Verified that it does force exactly that, and that it works:

```
G1a  COMPILED  @use ... with ($button-radius: 9px)                     css=5841B
G1b  COMPILED  with ($button-palette: (... success: #238648 ...))      css=5805B
```

For a theme *mixin* this was a defect: `theme()`'s whole point is that "no global
SCSS variable is named anywhere" [V-REPO: `_button.scss:7-8`], so a consumer
themes without learning Foundation's internals. For a *settings* module the
polarity flips. The binding constraint is that migrating a Foundation settings
file be **as seamless as possible**, and a migrating consumer arrives holding a
file of bare Foundation-shaped globals. Typing the names they already have is the
seamless outcome; a translated vocabulary would be the migration cost.

**Verdict: this ground does not transfer. It is an argument FOR the mechanism in
the settings role.** The two roles want opposite things, which is precisely why
"prefer `@use`" was never "use `@use ... with`" -- and why both mechanisms should
coexist rather than one replace the other (see the D7 result below).

### Ground 2 -- "could not be invoked twice in one compilation": APPLIES, and bites HARDER than for the mixin.

The ticket's hypothesis was that this objection may be irrelevant to settings,
since a compilation needs only one settings configuration. **The hypothesis is
half right and the surviving half is the mechanism's real cost.** Three verified
failures, quoted in NF1: the same module configured twice (G2a), configured after
the library already loaded it (G2b), and -- the realistic one -- **two consumer
partials each configuring it in a multi-file app (G2c)**. All three are the same
hard error.

So the rule `@use ... with` imposes on a consumer is: **configure exactly once,
from the single entry stylesheet, before anything else loads the library.** That
is stricter than "one configuration per compilation"; it is also an *ordering*
constraint across the consumer's whole stylesheet graph.

Two things keep this survivable. First, it is not a regression relative to
Foundation: the legacy idiom already required `@import 'settings'` before
`@import 'foundation'`, so the constraint is Foundation's own, now enforced with
an error instead of silence. Second, and this is the load-bearing result, the
settings module and the theme mixin **compose**: configured once, `theme()` can
still be invoked twice with different values in the same compilation
[V-EXEC, `settings-map-shape-probe.mjs`]:

```
D7  COMPILED  configured, plus TWO scoped theme() calls in the same compilation
     css=12468B
```

**Verdict: the ground applies to settings and must be designed around, but it does
not invalidate the mechanism -- and it does not touch `theme()`, which keeps the
twice-in-one-compilation property M002's preset model depends on.**

### Ground 3 -- "emitted 5490 bytes of unwanted rules just to read one token": DOES NOT APPLY AT ALL.

```
G3a  COMPILED  load the settings module alone, configured, nothing else   css=0B
G3b  COMPILED  CONTROL: load the public button module alone (no @include) css=0B
```

The 5490-byte cost came from configuring a module that *emits rules on load*. A
settings module is variables only and emits **zero bytes**, exactly like
`_button.scss` does today.

**Verdict: this ground is specific to the rejected shape and transfers not at
all.**

### The property nobody costed: `@use ... with` is LOUD, and today's surface is SILENT.

The strongest argument for the mechanism in the settings role was not in the
rejection at all:

```
M1  ERROR  configure an INVENTED variable: with ($totally-made-up: 1px)
     This variable was not declared with !default in the @used module.
M2  ERROR  configure a MISSPELLED real name: with ($button-radiuss: 9px)
     This variable was not declared with !default in the @used module.
M3  ERROR  a REAL Foundation name this library does not carry ($callout-background)
     This variable was not declared with !default in the @used module.
```

Compare section 4: the same three mistakes made through today's surface produce
byte-identical CSS and no diagnostic. **`@use ... with` converts the worst
migration failure mode into a build error, for free, with no validation code.**

### Bonus: it restores the derivation cascade NF7 shows is dead.

```
M4  COMPILED  with ($global-radius: 9px)                     css=5841B
D2  COMPILED  $settings: (global-radius: 9px)                css=5841B
```

Configuring the upstream global *does* reach the emitted CSS when the derived
name (`$button-radius: $global-radius`) lives in the configured module and is
evaluated after configuration -- the opposite of the inert result NF7 measured for
island pre-seeding. So a settings module is not only the migration surface; it is
the only mechanism verified to make Foundation's own settings vocabulary
mechanically live in this library.

---

## 4. Question 4 -- the probe: what happens TODAY

**The answer is SILENT IGNORE for the entire settings vocabulary, and it is the
worst of the three possible outcomes.** All rows [V-EXEC,
`settings-surface-probe.mjs`], baseline default theme = 5839 B.

| # | What a migrating consumer does | Outcome |
| --- | --- | --- |
| P1 | `theme($button-font-size: 2rem)` | **ERROR** -- `No parameter named $button-font-size.` |
| P2 | `@use '.../button' with ($button-background: #ff0000)` | **ERROR** -- `This variable was not declared with !default in the @used module.` |
| P2b | same, with an invented name | **ERROR** -- same message |
| P3a | declares `$button-background: #ff0000;` after the `@use` | **COMPILES, 5839 B, BYTE-IDENTICAL, no warning** |
| P3b | declares it before the `@use` (the Foundation habit) | **COMPILES, 5839 B, BYTE-IDENTICAL, no warning** |
| P4 | `theme($palette: (sucess: #238648))` -- typo | **COMPILES, 6771 B** -- emits a `.button.sucess` rule set |
| P5a | pastes Foundation's real 490-line `_settings.scss` after the `@use` | **COMPILES, 5839 B, BYTE-IDENTICAL, no warning** |
| P5b | pastes it before the `@use` (verbatim migration) | **ERROR** -- `@use rules must be written before any other rules.` |
| P5c | same paste with `$foundation-palette` primary changed to `#ff0000` | **COMPILES, 5839 B, BYTE-IDENTICAL**; `#ff0000` appears nowhere |
| P6 | `@import 'foundation-sites/scss/settings/settings'` beside the `@use` | **COMPILES, 5839 B, BYTE-IDENTICAL, no warning** |
| P7a | `@use` the private `internal/settings` directly | **COMPILES** -- `internal/*: null` does not stop it |
| P7b | `@use internal/settings with (...)` | **ERROR** -- no `!default` to configure |

Reading it:

1. **The four public arguments are safe.** Every attempt to reach a name that is
   not one of them is a *hard error* (P1, P2, P2b, P7b). Nothing about the current
   public API is loose.
2. **Everything OUTSIDE the public API is silently inert.** P5a and P5c are the
   headline: 490 Foundation settings, one of them deliberately changed, produce
   output **byte-identical to the untouched default theme**, with no warning, no
   deprecation, and a green build. P6 shows the same for the legacy `@import`
   route, and P3a/P3b for hand-declared globals. **This is the silent-ignore
   outcome the ticket names as the worst possible, and it is confirmed as what
   happens today.**
3. **P5b is a small mercy and worth keeping.** Pasting the settings file *above*
   the `@use` -- the literal transcription of Foundation's own idiom -- is a hard
   error from Sass itself. A consumer who follows their old file layout gets a
   diagnostic; a consumer who moves the paste down to make the error go away gets
   silence. That is a trap, not a safety net.
4. **P4 is a second, distinct silent failure inside the public API.** The one map
   argument that IS public has unvalidated keys: a typo emits `.button.sucess`
   alongside the correct `.button.success` (+932 B of junk CSS) rather than
   erroring. Same class as `add-foundation-colors`' undeclared-key tolerance
   [V-SRC: `util/_color.scss:126-145`]. Not M002's to fix -- but it is evidence
   that key validation is a real design obligation for the settings milestone, and
   R009 already specifies `mappable` validation on the addon side
   [V-PRIOR: research/11].
5. **Seeding a misspelled Foundation global inside the island is equally silent**
   [V-EXEC, `settings-reachability-probe.mjs` section 5]: `$buton-radius` and
   `$button-radiuss` both compile with no effect and no warning. So the silence is
   a property of Sass's global-variable model, not of this library's choices --
   which is exactly why an explicit key-validated surface is the only fix.

---

## 5. Questions 1, 2, 3 and 5

### Q1 -- what "seamless" can actually mean, ranked and costed

| Bar | Consumer experience | Verified status | Cost |
| --- | --- | --- | --- |
| **0. today** | four named `theme()` arguments; everything else silently inert | P1-P7 above | -- |
| **1. paste Foundation's `_settings.scss` unchanged** | copy the file in, it works | **VERIFIED UNREACHABLE** under `@use`: above the `@use` it is a hard Sass error (P5b), below it it is inert (P5a/P5c) | Requires the library to re-adopt the legacy global-`!default` `@import` idiom -- contradicts the map's stated `@use` preference and inherits the Dart Sass 3.0.0 `@import` removal clock [V-PRIOR: research/03]. **Not worth aiming at.** |
| **2. pass a settings MAP** | one `@use 'ngx-foundation-sites/scss/settings' with ($settings: (button-radius: 9px))` | **VERIFIED WORKABLE** [V-EXEC, D1/D2/D3/D7], sparse, 0 bytes emitted, coexists with `theme()`, and **loud on unknown keys** via a 19-line preamble (D4/D5) | Consumer must transform `$x: y;` lines into `x: y,` map entries -- mechanical. Plus the once-and-first rule (G2c). |
| **3. set only the names you changed, bare** | `@use '...' with ($button-radius: 9px, $success-color: #238648)` | **VERIFIED WORKABLE** [V-EXEC, G1a/G1b/M4], sparse, 0 bytes, **loud on unknown names for free** (M1/M2/M3 -- no validation code at all) | Every settable name becomes individually published API. Plus the once-and-first rule. |
| **4. codemod** | a script rewrites a Foundation `_settings.scss` into bar 2's map or bar 3's `with` list | not probed [INFER: mechanically straightforward -- Foundation's template is 490 flat `^$name: value;` lines with **zero** `!default` [V-EXEC], so it parses with one regex] | A script plus tests. It is what turns bar 2 or 3 into something close to bar 1. |

**Recommendation for the later milestone: aim at bar 2 or 3, plus bar 4.** Bar 1
is the only bar that reads as "seamless" in the naive sense and it is the one the
`@use` preference structurally forecloses; the honest reading of "as seamless as
possible" is therefore **bar 3 (or 2) with a codemod**, not bar 1.

The bar 2 / bar 3 trade-off, stated for the milestone rather than decided here:
bar 3 gets per-name validation from Sass itself with no code, but publishes N
variable names as individual API; bar 2 keeps the module's members unpublished,
lets the addon build one map from its six controls, and needs ~19 lines to match
bar 3's loudness -- verified to work, including the `@error` path.

One finding that constrains both: **Foundation's own `settings/_settings.scss`
carries `!default` on ZERO of its 490 assignments** [V-EXEC]. It is a template
meant to be copied and `@import`ed ahead of Foundation, relying entirely on the
legacy global idiom. So no `@use`-based mechanism can consume it as-is, by
construction -- which is the deepest reason bar 1 is unreachable.

### Q2 -- how many of the 490 are reachable, and how the surface should grow

Measured [V-EXEC, `settings-reachability-probe.mjs`]:

```
=== 0. Foundation settings template ===
490 assignments, 490 unique names
carrying !default: 0

=== 2. STATIC reachability against the loaded closure ===
13 Foundation partials loaded
settings names REFERENCED somewhere in that closure: 42 / 490
  already seeded by the island (18)
  NOT seeded, Foundation's own !default stands (24)

=== 3. WHOLE-TREE partition of the 490 names ===
  consumed ONLY by util/ + _global.scss (always in any closure): 6
  consumed by at least one component/other partial: 481
  referenced NOWHERE outside the settings template itself: 3
```

- **42 of 490** are referenced anywhere in today's closure. Of those, **18** are
  already seeded non-`!default` by the island (the library has taken control of
  the name), and **24** sit at Foundation's own `!default` -- meaning a settings
  surface could reach them by pre-empting the `!default`, exactly as the island
  already does for the other 18. Note reachability is not the same as
  effectiveness: NF7 shows several referenced names are dead ends.
- **481 of 490** are read only by component partials this library has not
  wrapped. Top consumers: `typography/_base.scss` (50), `forms/_text.scss` (28),
  `typography/_helpers.scss` (26), `components/_button.scss` (26),
  `components/_table.scss` (23). The distribution confirms the settings file is
  **component-partitioned by construction**.
- **6** are util/global-only (`body-safe-padding`, `body-antialiased`,
  `global-button-cursor`, `global-color-pick-contrast-tolerance`,
  `breakpoints-hidpi`, `print-breakpoint`) and **3** are orphans referenced
  nowhere in Foundation's own tree (`callout-link-tint`, `menu-margin`,
  `grid-container-max`).

**How the surface should grow: ONE global entry point whose known-key set grows
per component.** Grounds: (a) the closure is floor-dominated -- 12 of the 13
Foundation partials the button reaches are the shared `util/` + `_global` floor
[V-PRIOR: research/12 C4] -- so per-component *modules* would mostly repeat one
another; (b) decisively, `@use ... with` is once-per-module-per-compilation
(G2a/G2c), so N per-component settings modules means N `with` clauses, each
subject to the once-and-first rule, each order-coupled to the others -- a
combinatorial ordering contract for the consumer; (c) a single entry point is what
a Foundation migrator already has (one file). The *contents* are per-component;
the *door* is one.

### Q3 -- `_theme.scss`: a distinct concern

**Distinct.** See NF1 for the full argument. Summarised: `_theme.scss` is data a
consumer READS; a settings module is configuration a consumer WRITES, exactly
once, before anything else loads. Merging them makes reading the WCAG palette and
configuring settings mutually exclusive in one compilation (G2b). They also have
opposite lifecycles -- `$wcag-palette` is a value the library ships and D023
freezes; settings are values the consumer supplies. Changing ticket 12's file role
is free today, and the correct change is **none**: leave `_theme.scss` exactly as
C1 specifies, and let the settings module be a separate future file with its own
`exports` key.

### Q5 -- the addon's curated control set is UNCHANGED

**No change, and the relationship is one-way.** The six controls stay closed at
five palette colours plus radius, mapping 1:1 onto `theme()`'s existing arguments
[V-PRIOR: map.md "Ground truth"; research/12 C6]. Nothing in this ticket adds,
removes, or re-types a control.

The relationship a future reader must not invert:

> The addon's panel is a **live-tweak subset of `theme()`'s arguments**, chosen
> for what is useful to drag a slider on. The library's settings API is
> **Foundation's 490-name vocabulary**, and it is a compile-time surface. The
> settings surface may one day make the six controls *expressible* as settings.
> The panel must never be cited as evidence about the library's Sass API -- in
> either direction, and least of all as a reason to keep the Sass API small.

That inversion is the error this ticket corrects (NF2), and it is the same error
the map's withdrawn Out-of-scope entry made. The narrow claim from that entry
survives untouched: **M002's addon needs no public Sass API extension.** What does
not survive is using that fact to bound the library's settings surface.

### Relationship to ticket 14

Ticket 14 owns `$global-text-direction`'s status in the public contract. This
ticket does not decide it, and adds one general finding it should consume: the
inertness ticket 12 measured for `$global-text-direction` is **not special to that
variable**. `$foundation-palette`, `$primary-color`, `$global-radius`,
`$global-font-size` and `$global-margin` are all equally inert through the same
mechanism -- the island pre-seeds the derived name non-`!default` before the
`@import`s, so the upstream cascade never fires (NF7). Direction is a worked
example of a general rule, which strengthens ticket 14's framing that ticket 12's
"proven inert" is a statement about today's plumbing rather than a forward-looking
ruling.

---

## 6. The shape of the question a later settings milestone must answer

Not a design, a question list. Each item is a decision this ticket deliberately
did not take, with the measured input it should start from.

1. **Mechanism: bare-name `with` (bar 3), a single `$settings` map (bar 2), or
   both?** Both are verified to work, sparse, zero-emission, and loud on unknown
   keys. Start from the trade-off in Q1, not from scratch.
2. **What is the known-key set, and what happens to a real Foundation name whose
   component does not exist yet?** Today `$callout-background` errors under both
   shapes (M3, D5). Erroring is loud but blocks the migrator who pastes their
   whole settings file ahead of component coverage -- which is the seamlessness
   goal. A warn-and-ignore tier for *known-Foundation-but-uncovered* names, with
   errors reserved for names Foundation itself does not declare, is the obvious
   third option and is not decided here. Foundation's own 490-name list is a
   machine-readable input for that tier [V-EXEC: 490 flat lines, zero `!default`].
3. **Does the library restore Foundation's derivation cascade
   (`$foundation-palette` -> `$primary-color` -> `$button-background`), or keep
   the flat pre-seeded names?** VERIFIED: the island's pre-seeding kills the
   cascade (NF7); a configured settings module restores it (M4, D2). This is the
   single most consequential item, because it decides whether a migrator's
   `$foundation-palette` edit does anything.
4. **Where does the settings module live, what is its `exports` key, and how does
   it relate to `scss/theme`?** Constrained by NF1 (separate) and by ticket 12's
   verified finding that a partial-named public module needs one alias line in
   `exports` and nothing else.
5. **Is a codemod shipped (bar 4), and does it target the Foundation
   `_settings.scss` shape specifically?**
6. **Does the addon become a consumer of the settings surface, or stay on
   `theme()` arguments?** Constrained by NF3's ordering slot; note the map form
   (bar 2) is the one an addon can build programmatically from six controls.
7. **What happens to `internal/_settings.scss`?** Ticket 12's C5 split, plus
   `!default`-or-map, plus whether `verify-foundation-parity`'s fixed
   three-`@import` reference island has to follow
   [V-REPO: `scripts/verify-foundation-parity.mjs:43-45`; and ticket 12 already
   found that island shape insufficient for `dropdown-menu` and `tooltip`].
8. **Does the key set carry a deprecation/versioning story?** Once a name is
   configurable it is API; Foundation 6.9.0 is dead upstream, so the library owns
   the vocabulary's evolution alone.

---

## 7. VERIFIED vs INFERRED

### VERIFIED by execution or direct source reading, this session

- Foundation's `settings/_settings.scss` declares **490** variables on 490 unique
  names and carries **`!default` on none of them**. It is a copy-and-`@import`
  template for the legacy global idiom, not a configurable module.
- Today's public surface is airtight for what it declares and silent for
  everything else: `theme()` with an undeclared argument is a hard error
  (`No parameter named ...`); `@use ... with` on `_button.scss` or on
  `internal/_settings.scss` is a hard error (`This variable was not declared with
  !default in the @used module.`).
- **Pasting Foundation's whole 490-variable `_settings.scss` into a consumer
  stylesheet below the `@use` compiles and emits CSS BYTE-IDENTICAL to the
  untouched default theme (5839 B), with no warning** -- including when one value
  is deliberately changed (`#ff0000` appears nowhere in the output). The legacy
  `@import 'foundation-sites/scss/settings/settings'` route is equally inert, as
  are hand-declared `$button-background` globals before or after the `@use`.
- Pasting the settings file ABOVE the `@use` is a hard Sass error
  (`@use rules must be written before any other rules.`).
- A typo'd key in `theme()`'s `$palette` map silently emits a junk rule set:
  `.button.sucess` alongside `.button.success`, 6771 B vs 5839 B.
- A misspelled Foundation global seeded inside the island (`$buton-radius`,
  `$button-radiuss`) compiles with no effect and no warning.
- `@use` of the `null`-mapped `internal/_settings.scss` resolves and reads
  `$primary-color` -- `internal/*: null` is documentation, not enforcement
  (third independent confirmation).
- The button chain's real closure is **16 files -- 13 Foundation + 3 nfs**,
  CSS 5839 B (exact reconfirmation of ticket 12's baseline).
- **42 of 490** settings names are referenced anywhere in that 13-partial
  closure; **18** of those are already seeded non-`!default` by the island and
  **24** sit at Foundation's own `!default`.
- Whole-tree partition of the 490: **6** consumed only by `util/` + `_global.scss`,
  **481** consumed by at least one component/other partial, **3** referenced
  nowhere outside the settings template (`callout-link-tint`, `menu-margin`,
  `grid-container-max`). Top consumers: `typography/_base.scss` 50,
  `forms/_text.scss` 28, `typography/_helpers.scss` 26, `components/_button.scss`
  26, `components/_table.scss` 23.
- **`$foundation-palette`, `$primary-color`, `$global-radius`,
  `$global-text-direction`, `$global-font-size`, `$global-margin` and
  `$callout-background` are ALL inert** when seeded into the island -- no change
  to emitted CSS -- while `$button-radius`, `$button-padding`,
  `$button-font-family` and `$button-transition` all change it. The mechanism is
  the island's non-`!default` pre-seeding of the derived names, which pre-empts
  Foundation's `$button-radius: $global-radius !default` and
  `add-foundation-colors`' `!global` transfer
  [V-SRC: `util/_color.scss:125-145`, invoked at `_global.scss:138`].
- The same seeds applied AFTER the `@import`s give identical results, because
  Foundation's button mixins read the globals at `@include` time.
- `@use ... with` on a settings module: **works** for bare Foundation names
  (`$button-radius` -> 5841 B, `$button-palette` -> 5805 B); **emits 0 bytes**
  on load; is a **hard error** on an invented name, a misspelled name, or a real
  Foundation name the library does not carry; **cannot be applied twice in one
  compilation** even with byte-identical values, cannot be applied after the
  module has already loaded, and cannot be applied by two consumer partials.
- Configuring the upstream `$global-radius` DOES reach the emitted CSS (5841 B)
  when the derived `$button-radius: $global-radius` lives inside the configured
  module -- the cascade the island's pre-seeding kills.
- A map-shaped settings module is expressible: 26 declarations mechanically
  rewritten to read from a sparse `$settings` map behind a 19-line preamble,
  unconfigured output byte-identical to the real file (5839 B), sparse overrides
  reaching the CSS (`success-color: #238648` emits `#238648` and no longer emits
  `#3adb76`), **unknown keys raising an explicit `@error`**, and the module
  configured once coexisting with **two** `theme()` invocations in the same
  compilation (12468 B).

### INFERRED (reasoned, not executed)

- That a codemod from Foundation's `_settings.scss` to either configuration shape
  is mechanically straightforward. Grounded in the measured file shape (490 flat
  `^$name: value;` lines, zero `!default`), but no codemod was written.
- That bar 3's "publishes N names as individual API" is a meaningful long-run
  cost. A judgement about API evolution, not a measurement.
- That the once-and-first ordering rule is survivable for real consumers because
  Foundation's legacy idiom already required settings-before-foundation. The
  legacy requirement is documented fact; that consumers experience the `@use`
  version as equivalent is a judgement.
- That the 42-name figure is an upper bound on what a settings surface could
  usefully expose today. It is a static reference count; NF7 shows several of the
  42 are dead ends, so the effective number is smaller, and only the 11 names in
  section 4's dynamic table were individually tested.
- That the settings milestone should be a separate milestone rather than a slice
  of a component-expansion milestone. Grounded in the 481/490 reachability figure
  and the once-and-first contract, but it is a sequencing judgement.

### CARRIED from tickets 01-14 without re-verification

Ticket 12's C1 (`_theme.scss` placement, the `"./scss/theme"` exports key and the
resolver matrix), C2/C3 (`THEMEABLE_MODULES`, `DATA_MODULES`, the N-entry
generator and its Q1b negative control), C4's closure sizing, C5's split flag and
corrected probe read targets, and C6's control-table reframing; ticket 09's
panel-only control surface, sparse canonical-minimal globals model and Worker
diagnostics degradation; ticket 10's four lanes and gate design; ticket 07's
`internal/*: null` finding; ticket 03's Dart Sass 3.0.0 `@import` removal clock;
and D020/D023/R008/R009/R019/R026 as recorded in `HANDOFF.md`.
