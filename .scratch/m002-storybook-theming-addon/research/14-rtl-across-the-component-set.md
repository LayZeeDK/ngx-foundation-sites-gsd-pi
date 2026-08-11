# RTL/LTR across the whole Foundation component set -- findings

Resolves ticket `.scratch/m002-storybook-theming-addon/issues/14-rtl-across-the-component-set.md`.
Status: **resolved, decisions LOCKED** (AFK -- no human in the loop, per map.md Notes).

**Supersedes ticket 12's C7**, which ruled `$global-text-direction` OUT as "proven
inert twice over". C7's *conclusion for the addon control* survives (decision D3
below, on stronger grounds). C7's ground 1 -- "provably inert, so a direction
control would be a knob wired to nothing" -- is **Button-specific and does not
generalise**, which is exactly the single-component premise ticket 12 existed to
remove.

No repo file was changed. Everything written landed under `.scratch/`. Three new
reproducible probes:

- `prototypes/rtl-residue-probe.mjs` -- measures how much emitted CSS differs
  between `ltr` and `rtl`, with and without the R004 rebind.
- `prototypes/rtl-rebind-validity-probe.mjs` -- classifies every emitted
  declaration the rebind makes logical as valid or invalid CSS.
- `prototypes/rtl-rebind-source-sites.mjs` -- classifies every Foundation SOURCE
  site that interpolates `$global-left`/`$global-right`.
- `prototypes/rtl-rebind-latent-radius-probe.mjs` -- shows the defect count is a
  function of consumer SETTINGS, not of the rebind alone.

## Evidence key

- **[V-EXEC]** -- verified by executing a read-only command here, output quoted.
- **[V-REPO]** -- verified by reading a tracked file in this repo (path + line).
- **[V-SRC]** -- verified by reading shipped `node_modules` source (path + line).
- **[V-GSD]** -- verified by reading a `.gsd/` record (read-only).
- **[V-SPEC]** -- verified against CSS specification behaviour.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

---

## 1. The locked decisions, up front

### D1 -- the library's cross-component RTL strategy

> **D1a. "Extend the logical-properties rebind wherever it reaches" is CLOSED,
> not deferred.** The `$global-left`/`$global-right` -> `inline-start`/`inline-end`
> rebind is **not a general mechanism**. It is *variable substitution*; correct
> logical CSS requires *property-name mapping*. Measured across Foundation's
> whole tree: **50 of ~109 interpolation sites are broken by the rebind, in six
> distinct defect classes, across ~11 components -- and every failure is silent**
> [V-EXEC, section 4]. Button hits **only the two safest classes**, which is
> precisely why R004's verification is sound for Button and generalises to
> nothing.
>
> **D1b. The rebind STAYS exactly where it is, and must not move.** It remains
> inside `internal/_foundation-button.scss`, verified, R004 validated. It must
> **not** be lifted into a shared partial for future islands to `@use` -- that is
> the obvious DRY move and it is the trap (see F6.1).
>
> **D1c. `:dir()` / `[dir]` is RE-OPENED for the residue.** M003's rejection was
> **Button-specific** and **comparative**, not a library-wide prohibition --
> established with evidence in section 5.
>
> **D1d. CSS custom properties for the transform sign are NOT forbidden by D020,
> and are ALSO not a separate option.** A custom property cannot *read* direction;
> something must set it, and the only thing that can is a direction selector
> (`:dir(rtl) { --nfs-dir: -1 }`). So it is a **compression** of D1c -- one
> selector per sheet instead of one per rule -- decided with D1c, never instead of
> it. The D020 question is therefore moot for this decision (section 6).
>
> **D1e. RECOMMENDED default for the milestone that adds component #2: the
> HYBRID** -- logical properties for the classes where they are verified safe,
> plus a small number of `:dir()` override rules for the residue, plus
> `$global-text-direction` honoured as the Sass-time escape hatch for
> single-direction consumers (D2). Grounds in section 7.
>
> **D1f. A dual build (Foundation's own model) is ruled out by a SHIPPED
> ARTIFACT, not by preference.** `nfs-button.stories.ts`'s `Rtl` story renders
> `dir="ltr"` and `dir="rtl"` **side by side in one document** and asserts numeric
> mirroring between them [V-REPO: `nfs-button.stories.ts:181-225`]. No dual build
> can serve that story. Ruling it out costs deleting a passing test, which is a
> real and sufficient bar -- and D021 already retired rtlcss because `styleUrl`
> leaves no library-controlled CSS artifact to post-process [V-GSD].
>
> **D1g. The full per-component design is DEFERRED to the milestone that adds
> component #2**, and it is a *component-onboarding* obligation, not a one-time
> library decision: each new island must carry a per-site classification of its
> own `$global-left`/`$global-right` uses against section 4's table. M002
> forecloses none of this (D4).

### D2 -- `$global-text-direction`'s status in the public contract

> **ACCEPT AND HONOUR, with an explicit inert-today disclosure.**
>
> Rejected, each explicitly:
> - **Reject with an error** -- REJECTED. It breaks the BINDING seamless-migration
>   constraint on a variable sitting at its own default (`ltr`), which is a no-op.
>   Failing a build on `ltr` is indefensible.
> - **Accept silently** -- REJECTED, as the ticket requires. Ruled out by name.
> - **Accept and `@warn`** -- REJECTED, because the setting is not meaningless: it
>   has a real, correct, *composable* effect on the residue (F2 below). Warning on
>   a setting that works trains consumers to ignore warnings.
> - **Accept and honour** -- **TAKEN.**
>
> The load-bearing discovery that decides this: **`$global-text-direction`
> composes CORRECTLY with the rebind rather than conflicting with it** [V-EXEC,
> F2]. The rebind is unconditional and post-`@import`, so the properties it
> reaches are runtime-directional *regardless* of the Sass-time setting. The
> setting therefore reaches **only the residue** -- exactly the constructs logical
> properties cannot express. It is not a legacy wart; it is the correct escape
> hatch for a single-direction consumer, and it is Foundation's own vocabulary for
> it. That is the maximally seamless answer available.
>
> **Documented contract text (the substance M002 owns):**
>
> > `$global-text-direction` is accepted and honoured. It sets the Sass-time
> > direction for the constructs CSS logical properties cannot express --
> > transforms, generated content, and direction-conditional rules. It has **no
> > effect** on the box-model and float properties this library emits logically;
> > those mirror at runtime from the document's `dir` in either setting. Leaving it
> > at `ltr` (the default) yields a sheet that serves mixed-direction documents,
> > with the residue laid out for LTR. Setting it to `rtl` lays the residue out for
> > RTL instead. **As of M002 the shipped surface (Button) contains zero such
> > constructs, so the setting is currently a no-op** -- verified: the public
> > `theme()` chain compiles byte-identically under both values [V-EXEC, F2].
>
> That last sentence is what converts silence into disclosure. The consumer is
> told the setting is currently inert and why, so nothing is being ignored behind
> their back.
>
> **The mechanism belongs to ticket 15**, which owns the settings surface. D2 fixes
> the *status*: the surface must carry `$global-text-direction` as a recognised,
> honoured, documented-narrow setting. It must not drop it, must not `@error` on
> it, and must not accept it into a channel that discards it silently.

### D3 -- direction as a Storybook addon control in M002

> **NOT a control in M002, and never a member of the theme map.** This upholds
> ticket 12's C7 conclusion while replacing its Button-specific ground. Six
> grounds, section 8. The decisive one is a shipped artifact: the existing `Rtl`
> story renders both directions **in one document**; a toolbar or panel control
> sets one direction for the whole preview and therefore **cannot express the
> story that already exists**. The demonstration need is already met, better.
>
> If RTL preview breadth is ever wanted, the shape is a `dir` attribute toggle on
> the preview root -- a Storybook decorator that costs **zero Sass compile** --
> never a Sass variable in the theme map. (Ticket 12's C7 closing line, intact.)

### D4 -- what M002 must not foreclose

Ten items, section 9. The three that would actually cost rework:

> - **Do not lift the `!global` rebind into a shared partial** for future islands
>   to `@use`. It would spread 50 silent invalid-CSS sites across ~11 components.
> - **Do not copy `verify-foundation-parity.mjs`'s `PHYSICAL_TO_LOGICAL_VALUE`
>   table into any new gate.** Its `text-align` entry **blesses an invalid
>   declaration** [V-REPO, section 10]. Harmless today; a landmine the moment it
>   is reused.
> - **Do not narrow or remove the `test-browser` lane.** It is the only place the
>   authoritative CSS-validity oracle exists, and the silent-drop failure mode
>   needs one.

---

## 2. All `$global-text-direction` reads, and whether logical properties reach them

**Count corrected first.** The sweep finds **11 reads across 7 files**, plus 2
declarations [V-EXEC]:

```
scss/_global.scss:108                  $global-text-direction: ltr !default;      <- declaration
scss/settings/_settings.scss:97        $global-text-direction: ltr;               <- consumer settings template
scss/_global.scss:127                  $global-left:  if(... rtl, right, left)    <- READ (the rebind hook)
scss/_global.scss:128                  $global-right: if(... rtl, left, right)    <- READ (the rebind hook)
scss/_global.scss:131                  $-zf-flex-justify                          <- READ
scss/components/_button.scss:84        @if == 'rtl'                               <- READ
scss/components/_breadcrumbs.scss:84   separator character                        <- READ
scss/components/_drilldown.scss:108    transform: translateX(...)                 <- READ
scss/components/_drilldown.scss:112    transform: translateX(...)                 <- READ
scss/components/_dropdown-menu.scss:222 @if == 'rtl'                              <- READ
scss/components/_slider.scss:135       @if == rtl                                 <- READ
scss/forms/_input-group.scss:38        border-radius shorthand                    <- READ
scss/forms/_input-group.scss:44        border-radius shorthand                    <- READ
```

The ticket's **9** is exactly these 11 minus `_global.scss:127,128` -- correct,
because those two *are* the rebind hook (the mechanism, not residue). Both
figures are right; they count different things. **The 9 confirmed, not redone.**

| # | file:line | What it drives | Can logical properties reach it? |
| --- | --- | --- | --- |
| 1 | `_global.scss:131` | `$-zf-flex-justify` map (`'left' -> flex-start\|flex-end`), consumed by `util/_flex.scss:39-40`'s `flex-align` and by `components/_flex.scss:74,81` generating `.align-left` / `.align-right` | **YES, already.** Output values `flex-start`/`flex-end` are writing-mode relative [V-SRC: `util/_flex.scss:1-10`]. The Sass-time flip exists *only* to keep the PHYSICAL class NAME `.align-left` meaning physical left. Dropping it makes `.align-left` mean inline-start -- a change to the **class-name contract**, not an output-correctness problem. Invisible to a declaration-multiset diff (pure selector swap). |
| 2 | `components/_button.scss:84` | `@if == 'rtl'` guarding a `!default` on `$button-margin` | **N/A -- INERT.** The island seeds `$button-margin` non-`!default` *before* the `@import` [V-REPO: `internal/_foundation-button.scss:37`], so the `!default` never fires. Now verified by execution, not only by reading: the public `theme()` chain is **byte-identical** at 5839 bytes under `ltr` and `rtl` [V-EXEC, F2]. |
| 3 | `components/_breadcrumbs.scss:84` | Swaps the separator CHARACTER: `content: "/"` (ltr) vs `content: "\\"` (rtl) [V-SRC: `settings/_settings.scss:291-292`] | **NO.** `content` is not a layout property; no logical form exists. Reachable only by a direction selector overriding `content`, or by Sass-time direction. |
| 4 | `components/_drilldown.scss:108` | `.is-active` submenu slide-in: `transform: translateX(-100%)` ltr / `translateX(100%)` rtl | **NO.** Transforms are physical; there is no logical `translateX`. |
| 5 | `components/_drilldown.scss:112` | `.is-closing` submenu slide-out -- the mirror of #4 | **NO**, same. Note #4/#5 **swap between selectors**, so a declaration-multiset diff sees nothing: the residue is real and a naive diff-based gate is blind to it (section 10). |
| 6 | `components/_dropdown-menu.scss:222` | `.opens-inner > .is-dropdown-submenu`: `right: auto` (rtl) / `left: auto` (ltr) | **YES in principle** -- `inset-inline-start: auto` expresses both. **But NOT reachable by the rebind**: Foundation hard-codes the physical literals inside the `@if`, with no interpolation hook. Needs a source patch or an override rule. |
| 7 | `components/_slider.scss:135` | RTL-only whole rule: `.slider:not(.vertical) { transform: scale(-1, 1) }` | **NO.** Transform. Cheapest possible residue: a whole rule absent in LTR, so **one** `:dir(rtl)` rule expresses it exactly, with no per-declaration override. |
| 8 | `forms/_input-group.scss:38` | `> :first-child` `border-radius` shorthand: left corners rounded (ltr) / right corners (rtl) | **YES** -- `border-start-start-radius` / `border-end-start-radius` longhands. **NOT reachable by the rebind** (physical shorthand, no interpolation hook). |
| 9 | `forms/_input-group.scss:44` | `> :last-child` -- the mirror of #8 | **YES**, same. Also a pure selector swap with #8, so also diff-invisible. |

**Three-way classification, which the ticket's two-way framing does not capture:**

- **Reachable AND reached by the rebind:** 0 of the 9. (The rebind's whole reach is
  the `#{$global-left}`/`#{$global-right}` interpolation sites, which are a
  *different* population -- 29 files, section 3.)
- **Reachable in principle, NOT reached by the rebind** (Foundation hard-codes the
  physical form): #1, #6, #8, #9.
- **Not expressible as a logical property at all:** #3, #4, #5, #7.
- **Inert:** #2.

---

## 3. How far the rebind reaches, and how much residue is left -- measured

`$global-text-direction` is read in 7 files. The **rebind hooks**
(`$global-left`/`$global-right`) are interpolated in **29 files** [V-EXEC]. So the
rebind's reach is an order of magnitude wider than the direct-read residue, which
is why it looked like a general mechanism.

Measured on `foundation-everything()` [V-EXEC, `rtl-residue-probe.mjs`]:

```
=== A. real nfs button chain (public theme() API), consumer sets direction ===
ltr 5839 bytes | rtl 5839 bytes | BYTE-IDENTICAL: true

=== B. foundation-everything(), NO rebind (Foundation as shipped) ===
declarations only in LTR: 69 | only in RTL: 70

=== C. foundation-everything(), WITH R004 rebind ===
declarations only in LTR: 2 | only in RTL: 3
  LTR-only  left: auto;                    <- dropdown-menu:222
  LTR-only  content: "/";                   <- breadcrumbs:84
  RTL-only  right: auto;
  RTL-only  transform: scale(-1, 1);        <- slider:135
  RTL-only  content: "\\";

residue without rebind: 139 differing declarations
residue WITH rebind:    5 differing declarations
rebind closes:          134 of 139 (96%)
```

**Read this carefully -- the 96% is the seductive number and it is misleading in
two directions:**

1. **It undercounts the residue.** The diff is declaration-multiset-based, so the
   drilldown transforms (#4/#5), the input-group radii (#8/#9) and the
   flex-justify values (#1) **cancel out** -- they swap between selectors rather
   than appearing on one side. The true residue is the 8 non-inert rows of
   section 2, not 5. **This is the same blind spot the repo's own parity gate
   has** (section 10).
2. **It says nothing about validity.** Sass does not validate CSS. 96% of the
   physical/logical difference disappeared; whether what replaced it is *legal
   CSS* is a separate question, and the answer is no for a third of it.

---

## 4. VERIFIED: the rebind emits invalid CSS at 50 of ~109 source sites

Independently reproduced, and it turns out to be **worse than reported to me** --
six defect classes, not three, and one of them is not an invalid-CSS problem at
all but a silent public-API rename.

### 4.1 Emitted-CSS view

[V-EXEC, `rtl-rebind-validity-probe.mjs`], `foundation-everything()` at
Foundation's default settings:

```
=== VALID after the rebind ===
  [OK]    x 92  margin-inline-start        [OK]    x  3  border-inline-start
  [OK]    x 21  margin-inline-end          [OK]    x  1  border-inline-start-color
  [OK]    x  5  padding-inline-end         [OK]    x  1  border-inline-end
  [OK]    x  1  padding-inline-start       [OK]    x  3  float

=== INVALID after the rebind (browsers drop these SILENTLY) ===
  x 14  INVALID PROPERTY NAME 'inline-end'    ->  inline-end: 0 | 14px | 15% | 1rem | 5px
  x 18  INVALID PROPERTY NAME 'inline-start'  ->  inline-start: 0 | 0.25rem | 100% | auto | 8% | ...
  x  3  INVALID VALUE for 'text-align'        ->  text-align: inline-start | inline-end
  x  1  INVALID VALUE for 'background-position' -> background-position: inline-end -1rem center

TOTAL INVALID DECLARATIONS: 36
TOTAL VALID DECLARATIONS:   127
```

Silence is guaranteed, not incidental: CSS requires a UA to discard a declaration
with an unknown property or an invalid value and continue parsing [V-SPEC]. There
is no console error, no build error, and no visual difference in LTR for several
of them (`inline-start: 0` and `left: 0` are both no-ops when the element is not
positioned) -- so a casual LTR smoke test passes.

### 4.2 Source-site view -- the number that matters for planning

[V-EXEC, `rtl-rebind-source-sites.mjs`]:

```
SAFE under the rebind:   53 sites
BROKEN under the rebind: 45 sites   (+5 more found in the UNCLASSIFIED bucket, below)
UNCLASSIFIED:            12 sites
```

| Class | Verdict | Sites | Where | Why |
| --- | --- | --- | --- | --- |
| `margin-#{side}` / `padding-#{side}` | **SAFE** | 41, 18 files | everywhere | `margin-inline-start` etc. exist and mean the right thing |
| `border-#{side}` / `-color` / `-width` / `-style` | **SAFE** | 6, 5 files | accordion-menu, button-group, tabs, input-group, typography | `border-inline-start` etc. exist |
| `float:` / `clear: $global-side` | **SAFE** | 6+3, 5 files | grid/*, breadcrumbs:72, button:305, tabs:87 | CSS Logical Properties adds `inline-start`/`inline-end` as *values* of `float`/`clear` [V-SPEC] |
| **bare side as a positioning property** | **BROKEN** | **22, 8 files** | accordion, accordion-menu, drilldown, dropdown-menu, orbit, responsive-embed, switch, grid/position | `#{$global-right}: 5px` -> `inline-end: 5px`. **No bare `inline-end` property exists**; logical positioning is `inset-inline-end` |
| **corner radius** | **BROKEN (LATENT)** | **14, 1 file** | `_button-group.scss:73,74,78,79,172,173,177,178,200,201,202,206,207,208` | `border-top-#{side}-radius` -> `border-top-inline-start-radius`. **No such property**; logical radius is `border-start-start-radius` etc. |
| **`text-align` value** | **BROKEN** | **8, 2 files** | `_menu.scss:118,134,137,142,145,150,170`, `_table.scss:150` | `text-align`'s logical values are `start`/`end`, **not** `inline-start`/`inline-end` |
| **`background-position` value** | **BROKEN** | **1** | `forms/_select.scss:45` | `background-position` accepts no logical keyword at all. *Not in the report I was given* |
| **class-NAME interpolation** | **BROKEN, different failure mode** | **3** | `_menu.scss:490,495`, `_accordion-menu.scss:107` | `&.align-#{$global-left}` -> **`.align-inline-start`**. Emits *valid CSS that matches nothing*: Foundation's public `.align-right` class is silently RENAMED. *Not in the report I was given, and no CSS-validity oracle can catch it* |
| **keyword passed to a switching Sass mixin** | **BROKEN, silent wrong output** | **2** | `_drilldown.scss:50,133` | `css-triangle($size, $color, $global-right)`. The mixin switches on `== down\|up\|right\|left` [V-SRC: `util/_mixins.scss:57-67`]; `inline-end` matches **no** branch, so it emits `border-style: solid; border-width: N` with no `border-*-width: 0` and no `border-color` -- **a solid square instead of an arrow**. *Not in the report I was given* |
| `xy-grid/_position.scss:54`, `grid/_grid.scss:38`, `menu-simple($dir)` | **SAFE** (ruled out) | 3 | -- | all three feed `margin-#{$dir}` or a `float`, i.e. the safe classes [V-SRC] |

**Corrected total: ~50 broken vs ~59 safe.** The rebind is wrong at close to half
its source sites.

### 4.3 Two findings that change the shape of the problem

**F4.3a -- the defect count is a function of CONSUMER SETTINGS, not of the rebind.**
The 14 button-group radius sites sit behind `@if not $buttongroup-radius-on-each`,
whose Foundation default is `true` [V-SRC: `_button-group.scss:27`]. So they emit
**nothing** at default settings and **20 invalid declarations** the moment a
consumer flips one legitimate setting [V-EXEC, `rtl-rebind-latent-radius-probe.mjs`]:

```
=== $buttongroup-radius-on-each: true  (Foundation DEFAULT) ===
INVALID logical-radius declarations: 0
=== $buttongroup-radius-on-each: false (a legitimate consumer setting) ===
INVALID logical-radius declarations: 20
  [BAD] border-top-inline-start-radius: 0;   [BAD] border-top-inline-end-radius: 0;
  [BAD] border-bottom-inline-start-radius: 0; [BAD] border-bottom-inline-end-radius: 0;
```

Consequences: **(i)** a gate that compiles one fixed settings configuration cannot
bound this class of defect; **(ii)** it collides head-on with ticket 15 -- the more
seamless the settings surface, the more latent invalid-CSS sites a consumer can
activate. Ticket 15 must know this.

**F4.3b -- `button-group` is Button's own sibling.** The single worst-affected file
is the component any reasonable roadmap adds second. The rebind's failure is not
in some exotic corner of Foundation; it is one component away.

### 4.4 Why Button is genuinely safe, stated so it cannot be over-generalised

`button-dropdown`'s only directional sites are [V-SRC: `components/_button.scss:300,305,306`]:

```scss
@include css-triangle($size, $color, down);   // LITERAL `down` -- not a global
float: #{$global-right};                      // SAFE class: float accepts logical values
margin-#{$global-left}: $offset;              // SAFE class: margin-inline-start exists
```

Button hits **exactly the two safest classes**, and its triangle passes a literal
rather than a global -- which is why `_drilldown.scss`'s triangle breaks and
Button's does not. R004's proof is sound and its scope is two declarations. The
file's own comment already says so: "These are the only two genuinely directional
declarations the whole sheet contains" [V-REPO: `_foundation-button.scss:63-64`].
**That sentence is the scope of the mechanism, not an aside.**

### 4.5 The user's premise, addressed head-on

**Foundation's Sass is written FOR a dual build, and that is the root cause.**
Foundation flips direction at *Sass* time and ships one sheet per direction, so its
authors were free to interpolate a side keyword into anything -- a property name, a
class name, a mixin argument, a `content` string. A single-sheet runtime mechanism
can only substitute *values*, so it necessarily covers a subset. The 50 broken
sites are not sloppiness in either codebase; they are the measured size of the gap
between the two models. Any strategy claiming to cover "all Foundation components"
from one sheet must state what it does at those 50 sites.

**This does not resurrect the dual build**, for the reason in D1f: a shipped,
passing test asserts mixed-direction behaviour in one document, and D021 already
found `styleUrl` leaves no library-controlled CSS artifact to post-process
[V-GSD]. It does mean the hybrid (D1e) is the *modest* answer, not the ambitious
one.

---

## 5. Was M003's `:dir()`/`[dir]` rejection Button-specific or library-wide?

**VERDICT: Button-specific for `:dir()`. Library-wide for the two mechanisms that
are not `:dir()`.** Evidence, all [V-GSD] from `.gsd/DECISIONS.md` and
`.gsd/REQUIREMENTS.md`, read-only.

**D021's Question field is explicitly Button-scoped:**

> "How to mirror Foundation's **button-dropdown arrow** for RTL in a single
> styleUrl-delivered stylesheet, given D018's dual-file rtlcss mechanism cannot
> survive styleUrl"

It asks about one component's one construct. Nothing in it is a library-wide
prohibition.

**D021's Context contains three separable grounds:**

| Ground | Scope | What it actually rules out |
| --- | --- | --- |
| `postcss-rtlcss`'s `[dir="ltr"]` selector "never matches this repo's dir-less `index.html`" -- and R004's e2e proof was **vacuous**, passing with no RTL mechanism at all | **LIBRARY-WIDE** (a fact about the document, not the component) | rules out **rtlcss's `dirAttribute` output mode**, not `[dir]` as a hand-authored selector |
| "`postcss-logical` is the wrong transform direction" | **LIBRARY-WIDE** | rules out **postcss-logical** |
| "**`:dir()` is a viable runner-up but costs specificity.** Foundation's own interpolation hooks cost neither." | **BUTTON-SPECIFIC in force** | see below |

The third ground is the one at issue, and it is **comparative**. It does not say
`:dir()` is unfit; it says `:dir()` costs specificity *where a free alternative
exists*. For Button the free alternative exists -- both its sites are in the SAFE
classes (4.4). **For the residue and for the 50 broken sites there is no free
alternative**, so the comparison's cheaper arm is absent and the rejection does
not transfer. A rejection premised on "a free option exists here" cannot bind
where no free option exists.

**D028 adds no independent force.** It is a re-scoping decision: it *confirms*
D021's mechanism was already delivered before S03 was planned and re-scopes S03
from "implement RTL" to "prove the existing mechanism holds, then re-anchor R004's
stale text". It carries D021's rejection by reference and performs no evaluation
of `:dir()` [V-GSD: `DECISIONS.md:36`].

**R004's own text is evidence AGAINST a logical-properties-only mandate**, and
this is the strongest single item:

- R004's **Description** is library-wide and names the variable: *"Components
  support RTL/bidirectional layout, **matching Foundation's
  `$global-text-direction` behavior**"* [V-GSD: `REQUIREMENTS.md:64`]. The
  requirement as authored expects `$global-text-direction` to *mean something* --
  which is independent support for D2.
- R004's **Notes** say it "governs future components, not just NfsButton".
- R004's **Validation** says "no `[dir]` selector, no `:dir()` specificity cost" --
  but that sentence sits in the *Validation* field, describing the delivered
  Button mechanism and the evidence for it. It is a **description of what was
  built**, not a constraint on what may be built. The same field also enumerates
  the exact scope: "the only genuinely directional declarations in the sheet".

The map's Ground-truth line "RTL is logical-properties-only (no `[dir]`, no
rtlcss)" is an accurate summary of M003's *delivery*. Read as a library-wide
prohibition it is the single-component premise again -- a description of N=1
hardening into a rule.

**Consequence:** using `:dir()` for the residue in a later milestone requires **no
decision reversal**. It is a new decision in a space D021 left open, and it should
cite D021's ground 3 as inapplicable rather than superseded.

---

## 6. Does a direction sign count as "theming" under D020?

**No -- and the question turns out not to matter. Both halves verified.**

D020's own scope, verbatim [V-GSD: `DECISIONS.md:28`]:

- Question: *"Whether NfsButton's runtime **theming surface** should be CSS custom
  properties (tokens) or SCSS variables"*
- Decision: *"SCSS variable theming only -- **no CSS custom property theming
  surface**"*
- Context: *"There is exactly one theming **mechanism** (Sass variables) with two
  places compilation can happen"*

Every clause is scoped to the **theming surface**. A direction sign
(`--nfs-dir: -1`) is not a theming value by any reading: no consumer sets it, it
encodes no design decision, it is not a token, it has no preset, and it is derived
from the document's `dir` attribute rather than authored. **D020 does not forbid
it.** [Reasoning from D020's text -- V-GSD for the quotes, INFER for the
application.]

**But it is also not a separate option, and this is the finding that closes the
question.** A custom property cannot *read* direction. Something must set it, and
in CSS the only construct that can observe direction is a direction selector:

```css
.nfs-drilldown { --nfs-dir: 1; }
:dir(rtl) .nfs-drilldown { --nfs-dir: -1; }         /* still a direction selector */
.nfs-drilldown .is-active { transform: translateX(calc(-100% * var(--nfs-dir))); }
```

So the custom property does not avoid `:dir()`; it **compresses** it -- one
direction selector for the whole sheet instead of one per affected rule, which
also confines the specificity cost D021 objected to. It is therefore an
implementation detail *of* D1c, weighed with it, never against it. [INFER, but it
follows from CSS having no direction-valued function.]

Two riders worth recording so this is not re-derived:

- The compression is **only** available for the sign-of-a-number residue
  (drilldown's `translateX`, slider's `scale`). It cannot express breadcrumbs'
  `content` swap (a custom property *can* hold a string, but `content: var(--x)`
  needs the string quoted in the custom property, which works -- so this one is
  actually reachable too [INFER, untested]) and it cannot express dropdown-menu's
  `left: auto` / `right: auto` (that needs the property name to change, not the
  value).
- If a direction sign is ever introduced, it must be **named and documented as a
  layout mechanism, not a token**, and must not appear in `_theme.scss`, in the
  addon's control set, or in any preset. Otherwise it reads as a theming custom
  property and re-opens D020 by appearance.

---

## 7. Why the hybrid is the recommended default (D1e)

Not a design of 34 components' RTL -- the criteria and the default, so the
milestone that adds component #2 starts from a position rather than a blank page.

| Option | Verdict | Grounds |
| --- | --- | --- |
| Extend the rebind | **CLOSED** | 50 silent defects in 6 classes across ~11 components, including Button's own sibling; count varies with consumer settings (4.3a) |
| Per-property translation layer (physical -> logical property NAMES) | **CLOSED as a Sass mechanism; not available as a post-process** | The property name is built by interpolation *in Foundation's source* (`#{$global-left}: X`, `border-top-#{side}-radius`), so no variable rebinding can rename it. Renaming needs post-processing the emitted CSS, and D021 already established `styleUrl` leaves no library-controlled CSS artifact [V-GSD]. In the browser it would mean shipping PostCSS on top of the measured 802 KiB gzip `sass` payload |
| `:dir()` overrides for the residue (+ custom-property compression) | **RECOMMENDED** | Correct by construction -- you write the property name yourself, so no silent class exists. Localised: the residue is 8 rows (section 2), not 50. Specificity cost is real but bounded, and D021's comparison that rejected it does not apply (section 5). Preserves the single sheet and mixed-direction documents |
| Sass-time direction for the residue | **KEEP, as the consumer escape hatch -- not as the library mechanism** | Composes correctly with the rebind and costs nothing (D2/F2). As the *library's* mechanism it would mean emitting a directional stylesheet, i.e. a dual build by another name |
| Dual build (rtlcss / two files) | **RULED OUT** | D1f: a shipped passing test asserts mixed-direction behaviour in one document; D021's rtlcss retirement ground still holds |

**The hybrid in one line:** logical properties for the ~59 safe sites (already
done for Button), `:dir()` overrides for the 8 residue rows, and
`$global-text-direction` honoured so a single-direction consumer can skip the
overrides entirely.

**Onboarding obligation this creates (D1g).** Adding component #2 is not "apply
the rebind". It is: classify that component's `$global-left`/`$global-right` sites
against section 4.2's table; use the rebind only for SAFE classes; hand-author
logical equivalents or `:dir()` overrides for BROKEN ones; and prove it with a
validity check (section 10). For `button-group` specifically that is 14 latent
radius sites plus 1 border site -- so the *first* component anyone adds is a
worked example of the hard case, not the easy one.

---

## 8. Why direction is not a Storybook control in M002 (D3)

Six grounds. Ground 1 replaces ticket 12's C7 ground 1, which was Button-specific.

1. **The inertness argument is retired, deliberately.** C7 argued "a knob wired to
   nothing". That is true for Button [V-EXEC, F2 -- byte-identical] and false for
   the library, because the residue is real. **The decision does not need it**, so
   it is dropped rather than repaired. Grounds 2-6 are component-count-independent.
2. **It is mechanically unreachable through the addon's compile entry.**
   `$global-text-direction` must be set *before* the island's `@import`s;
   `theme()` runs after. Reaching it needs either `theme()` API growth (out of
   scope) or the addon seeding a bare Foundation global in its entry string --
   which is exactly the "consumer types bare Foundation-shaped globals" mechanism
   `_button.scss`'s header records as measured-and-rejected [V-REPO], and which
   D4.5 forbids for independent reasons.
3. **It breaks the preset model.** R009's preset selection reduces to six scalars
   over a sparse canonical-minimal map (research/09, /11). A seventh control that
   is an *enum* rather than a colour or a number breaks that reduction, and every
   preset would need a direction value that means nothing.
4. **It costs a compile per toggle** against a measured 280-305 ms warm / 197 ms
   worker baseline (research/05), to change output that -- today -- is
   byte-identical.
5. **DECISIVE: the demonstration need is already met, and met better.** The
   existing `Rtl` story renders `dir="ltr"` and `dir="rtl"` **side by side in one
   document** and asserts numeric mirroring *between* them [V-REPO:
   `nfs-button.stories.ts:181-225`, `apps/nfs-demo/e2e/nfs-button-rtl.spec.ts`]. A
   toolbar global or panel control sets one direction for the whole preview and
   **cannot express that story**. Adding the control would make the weaker
   demonstration the visible one.
6. **The reference's measured cost buys nothing here.** Ticket 01: the reference
   exposed `$global-text-direction` as a live control and had to keep panel state
   and a toolbar global bidirectionally in sync (commits `ca20a7d`, `4d35d17`;
   `ThemePanel.tsx:260-272, 341-356`), and its RTL story assertion needed a 5 s
   `waitFor` [V-PRIOR: research/01 s6]. Two state stores to reconcile, for a
   weaker demonstration than the one already shipped.

**Recorded so it is not re-derived:** if RTL preview breadth is ever wanted, the
shape is a `dir` attribute toggle on the preview root -- a Storybook decorator or
toolbar global that costs **zero Sass compile** and leaves the theme map alone.
That path stays open (D4.1) and is *cheaper* than the addon control, so the
"not a control" decision costs no capability.

---

## 9. What M002 must not foreclose (D4)

| # | Constraint | Cost of getting it wrong |
| --- | --- | --- |
| 1 | **Do not add `$global-text-direction` to the addon's curated control set or to the Storybook globals schema.** Keep the set closed at six (ticket 12 C6) | Storybook globals silently drop undeclared keys (research/02), so adding it later is purely additive. Adding it now creates a URL-state key and a preset column to support forever |
| 2 | **Do not let `theme()`'s signature grow a direction argument.** Direction is layout, not theming | Breaks R009's six-scalar preset equality (ground 3 above) and makes direction look like a theme token, re-opening D020 by appearance |
| 3 | **Keep `THEMEABLE_MODULES` entries as `{url, namespace}` OBJECT literals** (ticket 12 C2) | A future entry needs to carry a per-module direction/args field. Ticket 12 kept the object shape for argument filtering; ticket 14 is a second, independent reason |
| 4 | **The generated sources module must keep the FULL served closure, discovered by compiling** (ticket 12 C3). No "Button only" filter as a size optimisation | A `:dir()`-override strategy or any new island needs `util/` + `global` + that component's partial. The measured floor is 12 of 13 Foundation partials shared (ticket 12 C4), so a filter saves ~1 file and forecloses the strategy |
| 5 | **The addon's compile entry must stay `@use <module>` + `@include <ns>.theme(...)`. It must NOT seed bare Foundation globals** -- `$global-text-direction` least of all | It is the rejected mechanism (ground 2 above), and it is the exact channel that would make direction accidentally reachable and then load-bearing |
| 6 | **Do not lift the `!global` rebind out of `internal/_foundation-button.scss` into a shared partial** for future islands to `@use`. Record section 4.2's classification next to it instead | The highest-cost item here. It is the obvious DRY move and it would spread 50 silent invalid-CSS sites across ~11 components, including 14 latent ones in `button-group` that a default-settings gate cannot see |
| 7 | **Do not copy `verify-foundation-parity.mjs`'s `PHYSICAL_TO_LOGICAL_VALUE` / `DIRECTIONAL_VALUE_PROPERTIES` tables into any new gate**, and treat the existing `text-align` entry as a KNOWN DEFECT to fix before any component with a `text-align` site ships | The table maps `text-align: left -> text-align: inline-start`, i.e. it **blesses an invalid declaration** (section 10). Harmless today because Button emits no `text-align`; a landmine on reuse. **No M002 code change is required** -- this is a "do not propagate" constraint |
| 8 | **`_theme.scss` (ticket 12 C1) must not acquire a direction member.** It holds `$wcag-palette` and future *theme* data | Direction in a theme module makes it a theme token by placement, re-opening D020 and inviting a preset column |
| 9 | **Do not narrow or remove the `test-browser` lane** (real Chromium, required by ticket 10 for `@layer`) | It is the only place the authoritative CSS-validity oracle exists (section 10). The silent-drop failure mode needs one, and this lane makes it free |
| 10 | **Keep the `Rtl` story's side-by-side shape.** The addon must not require a single global `dir` on the preview root | It is the only artifact proving mixed-direction capability, and it is what rules out a dual build (D1f). A preview-wide `dir` global would silently invalidate it |

Items 1-5 and 8-10 cost **nothing today** -- they are placement and shape
constraints on work M002 is doing anyway. Item 6 is a *prohibition on a
refactor*, so it also costs nothing now. Item 7 is documentation of a known
defect. **The full bill for D4 is zero code and one README paragraph** (the D2
disclosure).

---

## 10. The detection story for the silent failure mode

The ticket's coordinator asked whether `verify-foundation-parity.mjs` would catch
an invalid property name. **Answer: partly, and for the worst class it actively
blesses the defect.** All [V-REPO:
`packages/ngx-foundation-sites/scripts/verify-foundation-parity.mjs`].

| Defect class | Would the gate catch it? |
| --- | --- |
| `text-align: inline-start` | **NO -- it BLESSES it.** `DIRECTIONAL_VALUE_PROPERTIES` includes `text-align` (`:67`) and `PHYSICAL_TO_LOGICAL_VALUE` maps `left -> inline-start` (`:64-66`). So the gate normalises Foundation's `text-align: left` **to `text-align: inline-start`** and compares it against our identical invalid value -- and PASSES. The gate's own translation table asserts that the invalid form is the correct logical form |
| bare side as positioning (`inline-end: 5px`) | **YES, as two confusing failures.** `PHYSICAL_TO_LOGICAL_PROPERTY` (`:57-62`) has no `right -> inset-inline-end` entry, so check 1 reports "missing Foundation's `right: 5px`" and check 2 reports "`inline-end: 5px` is hand-rolled" |
| `border-top-inline-start-radius` | **YES in principle, NO in practice.** Same mismatch mechanism -- but only if a `button-group` parity gate existed (`COMPONENT_STYLESHEET` is one hard-coded path, `:32-33`) AND the reference compiled with `$buttongroup-radius-on-each: false`. Neither holds |
| class-name rename (`.align-inline-end`) | **NO, and no validity oracle can.** It is *valid CSS that matches nothing*. The gate compares declarations keyed by selector, so a renamed selector appears as one Foundation-only selector plus one nfs-only selector -- caught here only because check 2 and check 3 both fire on unknown selectors, i.e. by accident |
| `css-triangle` wrong-branch (square instead of arrow) | **YES, by luck** -- the missing `border-color` / `border-*-width: 0` are absent declarations, which is exactly check 1's shape (the `.button.hollow` bug it was built for) |
| Any of it, for a component other than Button | **NO.** The gate is scoped to `nfs-button.scss` against a fixed three-`@import` reference. Ticket 12's C3 already flagged that this three-import shape is not universally sufficient (`dropdown-menu` and `tooltip` fail it without `typography`) |

Also structurally blind, and worth recording next to the above: **section 3's
declaration-multiset diff misses every selector-swap residue** (drilldown's two
transforms, input-group's two radii, flex-justify's two values). Any future
gate built on "diff the LTR and RTL output" inherits that blindness. The residue
must be enumerated per site (section 2), never inferred from a diff.

**The missing gate, named so it can be planned rather than discovered
(recommendation, not an M002 deliverable):** a **CSS validity check using the
browser's own CSSOM as the oracle**, in the `test-browser` lane that ticket 10
already requires for `@layer`. For each emitted declaration, `setProperty` it on a
detached element and assert it stuck; an empty read-back is exactly the silent
drop a browser would perform in production. Properties: it is the *authoritative*
oracle (the same engine that would discard it), needs **zero new dependencies**,
needs no hand-maintained property allowlist to rot, and catches all four
invalid-CSS classes at once. [INFER for the exact mechanics -- not executed here;
the lane's availability is V-PRIOR from research/05 and /10.]

It does **not** catch the class-name rename or the `css-triangle` wrong branch.
Those need a per-component parity gate (checks 1-3 of the existing script,
re-pointed), which is D1g's onboarding obligation.

---

## 11. VERIFIED vs INFERRED

**VERIFIED by execution here [V-EXEC]:**

- The public `theme()` chain compiles **byte-identically** (5839 bytes) under
  `$global-text-direction: ltr` and `rtl`. Button is inert -- now proven by
  compiling, not only by reading. (F2)
- 11 `$global-text-direction` reads across 7 files; the ticket's 9 = those minus
  the two rebind-hook derivations at `_global.scss:127,128`.
- The rebind closes 134 of 139 differing declarations (96%) on
  `foundation-everything()` -- and the 96% **undercounts** the residue, because
  selector-swap residue cancels in a declaration-multiset diff.
- **36 invalid declarations vs 127 valid** in `foundation-everything()`'s emitted
  CSS with the rebind applied, at Foundation's default settings.
- **~50 broken vs ~59 safe SOURCE sites**, in six defect classes. Three of the six
  (`background-position`, class-name interpolation, `css-triangle` wrong branch)
  were not in the report handed to me.
- The `button-group` radius defect is **LATENT**: 0 invalid declarations at
  Foundation's defaults, **20** with `$buttongroup-radius-on-each: false`. The
  defect count is a function of consumer settings.
- 29 Foundation files interpolate the rebind hooks, vs 7 reading the direction
  directly.

**VERIFIED by reading source / records [V-REPO / V-SRC / V-GSD]:**

- `button-dropdown` passes the **literal** `down` to `css-triangle` and uses only
  `float:` and `margin-#{side}` -- the two safest classes. This is why Button is
  correct and `drilldown` is not.
- D021's Question is Button-scoped ("button-dropdown arrow"); its `:dir()`
  rejection is **comparative** ("viable runner-up but costs specificity.
  Foundation's own interpolation hooks cost neither").
- D028 performs **no** independent `:dir()` evaluation -- it is a re-scoping
  decision carrying D021 by reference.
- R004's **Description** names `$global-text-direction` as the behaviour to match,
  and its Notes say it governs future components. The "no `:dir()`" phrase is in
  the **Validation** field, describing what was built.
- D020's every clause is scoped to the **theming surface** / theming mechanism.
- `verify-foundation-parity.mjs:64,67` maps `text-align: left -> inline-start`,
  blessing an invalid declaration.
- `$global-text-direction` appears in the tracked repo **only in a comment**
  (`_foundation-button.scss:59`) -- the library has no direction knob today, so
  there is currently nothing to ignore. The hazard arrives with ticket 15's
  settings surface.
- Browsers discard declarations with unknown properties or invalid values
  silently, and continue parsing [V-SPEC].

**INFERRED, flagged:**

- That a custom property cannot read direction without a direction selector.
  Follows from CSS having no direction-valued function; not executed.
- That `content: var(--x)` could carry the breadcrumbs separator. Untested.
- The CSSOM validity-oracle mechanics (`setProperty` + read-back). Not executed
  here; the `test-browser` lane's availability is V-PRIOR from research/05, /10.
- The hybrid's *relative* cost at full component coverage. The residue is
  enumerated (8 rows) and the broken-site count measured (50), but no `:dir()`
  override set has been written, so its byte cost and specificity impact are
  unmeasured. This is D1g's work, not M002's.
- That `.align-left`'s class-name semantics (`_global.scss:131`) are a *contract*
  question rather than an output-correctness question. Reasoned from the emitted
  values being `flex-start`/`flex-end`; no consumer has been surveyed.

## 12. What this supersedes

| Superseded | Superseded by |
| --- | --- |
| `research/12` C7 ground 1 ("provably inert, so a knob wired to nothing") | **D3 ground 1** -- true for Button, false for the library; the decision is re-grounded, not reversed |
| `research/12` C7 ground 4 ("the correct treatment is the one `_foundation-button.scss` already demonstrates -- a post-import logical-property rebind in that component's island") | **D1a/D1b** -- measured false. The rebind is broken at ~50 of ~109 sites; it is Button's mechanism, not the library's |
| `research/12` C7's "`$global-text-direction` ruled OUT" as recorded in map.md's Decisions list | **D2** -- out as an *addon control* (D3, upheld); **IN** as an accepted, honoured, narrowly-documented *settings* entry |
| map.md "Ground truth from M001 and M003": "RTL is logical-properties-only (no `[dir]`, no rtlcss)" read as a library-wide constraint | **D1c / section 5** -- accurate as a description of M003's delivery; not a prohibition. `:dir()` for the residue needs no decision reversal |
| Ticket 14's own framing that logical-property reachability is a two-way question | **Section 2** -- it is three-way: reachable-and-reached, reachable-but-not-by-the-rebind, and not-expressible |
