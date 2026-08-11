# How RTL/LTR works across the whole Foundation component set

Type: research
Status: resolved
Blocked by: --

## Question

**Supersedes ticket 12's item 7**, which ruled `$global-text-direction` OUT as
"proven inert twice over". That finding is correct **for Button** and wrong as a
forward-looking ruling -- it is the single-component premise reappearing inside
the pass meant to remove it.

Decide how `ngx-foundation-sites` supports RTL/LTR across all Foundation
components, and what `$global-text-direction`'s status is in the library's
public contract.

### What is verified today

M003 delivered RTL for Button via **logical properties**:
`internal/_foundation-button.scss` rebinds `$global-left`/`$global-right` to
`inline-start`/`inline-end` unconditionally, *after* the legacy `@import`s, so
Foundation's unmodified `button-dropdown` emits `float: inline-end;
margin-inline-start: 1em`. One stylesheet, direction resolved at runtime from
`dir`. This is strictly better than Foundation's own build-time flip (which
ships either an LTR or an RTL sheet) -- it handles mixed-direction documents and
needs no dual build. Ticket 05 confirmed the `margin-left` -> `margin-right`
flip in real Chromium.

Ticket 12's Button finding is also verified: `components/_button.scss:84` is
`@if $global-text-direction == 'rtl' { $button-margin: ... !default; }`, and the
island already seeds `$button-margin`, so the `!default` never fires.

### Why that does not generalise

`$global-text-direction` is read in **9 places across 7 Foundation files**, and
at least two drive output that logical properties **cannot** express:

```scss
// components/_drilldown.scss:108,112 -- transforms are PHYSICAL.
// There is no logical translateX.
transform: translateX(if($global-text-direction == ltr, -100%, 100%));

// components/_breadcrumbs.scss:84 -- swaps the separator CHARACTER (content),
// not a layout property.
$separator: if($global-text-direction == 'ltr', $..._item, $..._item-rtl);
```

Also: `@if ... == 'rtl'` blocks in `components/_slider.scss:135` and
`components/_dropdown-menu.scss:222`; physical `border-radius` shorthand
mirroring in `forms/_input-group.scss:38,44` (this one IS expressible with
logical radius longhands such as `border-start-start-radius`); and
`_global.scss:131`'s `$-zf-flex-justify`, which maps to `flex-start`/`flex-end`
and is already writing-mode relative.

### Decide

1. **The library's RTL strategy across the component set.** Options to weigh,
   with evidence: extend the logical-properties rebind wherever it reaches;
   `:dir()` or `[dir]` selectors for the constructs it cannot reach (note R004
   and M003's D021/D028 rejected `[dir]`/`:dir()` **for Button** on specificity
   and dual-file grounds -- establish whether that rejection was Button-specific
   or library-wide); CSS custom properties for the transform sign (note **D020
   forbids custom properties as the THEMING surface** -- determine whether a
   direction sign is "theming" or a separate mechanism, and do not assume);
   or accepting a Sass-time direction for the residue.
2. **`$global-text-direction`'s status in the public contract.** A migrating
   consumer's settings file will contain it (Foundation's own
   `settings/_settings.scss:97` sets it). Decide between: accept and honour;
   accept and document as inert for the components where it is; accept and
   `@warn`; or reject with a clear error. **Silently ignoring a setting a
   consumer believes is active is the worst outcome** -- rule that out
   explicitly. This interacts with ticket 15's settings surface.
3. **Whether direction becomes a Storybook addon control.** Ticket 01 found the
   reference exposed it as a live control and had to keep panel state and a
   toolbar global bidirectionally in sync (a real cost). For M002 specifically:
   is it a control, or does the existing Storybook RTL story plus M003's
   logical properties already cover the demonstration need? A reasoned "not a
   control in M002" is fine -- an unconsidered omission is not.
4. **What M002 must not foreclose.** Even if the full RTL strategy belongs to a
   later milestone, say what the addon and `_theme.scss` must avoid doing now so
   that strategy stays open.

## Notes

Do not re-litigate M003's Button RTL mechanism -- it is delivered, verified, and
R004 is validated. This ticket is about the components that do not yet exist and
the contract a migrating consumer meets.

Scope discipline: it is legitimate to conclude that the full cross-component RTL
design belongs to a later milestone. If so, say so plainly and deliver (2) and
(4), which M002 does own. Do not design 34 components' RTL here.

Verify against `node_modules/foundation-sites/scss` with `rg` (it is gitignored
-- `git grep` returns zero there silently).

## Answer

**RESOLVED. Full findings: [`research/14-rtl-across-the-component-set.md`](../research/14-rtl-across-the-component-set.md).**
Four new probes under `prototypes/`: `rtl-residue-probe.mjs`,
`rtl-rebind-validity-probe.mjs`, `rtl-rebind-source-sites.mjs`,
`rtl-rebind-latent-radius-probe.mjs`. No repo file changed.

**The finding that reframes the ticket: the `$global-left`/`$global-right` ->
`inline-start`/`inline-end` rebind is NOT a general mechanism. It emits invalid
CSS at ~50 of ~109 source sites, in SIX defect classes, across ~11 components --
silently** (browsers discard unknown properties and invalid values without
error). Measured: 36 invalid vs 127 valid declarations in
`foundation-everything()`. The rebind is *variable substitution*; correct logical
CSS needs *property-name mapping*. Button hits only the two safest classes
(`float:` value, `margin-#{side}`) and passes a literal `down` to `css-triangle`
-- which is exactly why R004 is sound for Button and generalises to nothing.

Three defect classes beyond those reported: `background-position` (accepts no
logical keyword); **class-NAME interpolation** -- `&.align-#{$global-left}` ->
`.align-inline-start`, silently renaming Foundation's public `.align-right`
class, which is *valid CSS that matches nothing* and no validity oracle can
catch; and `css-triangle($size,$color,$global-right)`, which matches no `@if`
branch and emits a solid square instead of an arrow. Also: the 14 `button-group`
radius sites are **LATENT** -- 0 invalid declarations at Foundation's defaults,
**20** with `$buttongroup-radius-on-each: false`, so the defect count is a
function of CONSUMER SETTINGS and no fixed-settings gate can bound it. Ticket 15
needs this: the more seamless the settings surface, the more latent sites a
consumer can activate.

**D1 -- cross-component RTL strategy.** "Extend the rebind" is **CLOSED on
measurement, not deferred**. The rebind **stays exactly where it is** and must
not be lifted into a shared partial for future islands (the obvious DRY move,
and the trap). `:dir()`/`[dir]` is **RE-OPENED** for the residue (see below).
Custom properties for the transform sign are **not forbidden by D020** (its every
clause is scoped to the *theming surface*; a direction sign is neither authored
nor a token) **and also not a separate option** -- a custom property cannot read
direction, so it still needs `:dir(rtl){--nfs-dir:-1}`; it is a *compression* of
the `:dir()` option, decided with it. Recommended default for the milestone that
adds component #2: the **HYBRID** -- logical properties where verified safe,
`:dir()` overrides for the 8 residue rows, `$global-text-direction` as the
single-direction escape hatch. **Dual build is ruled out by a shipped artifact**:
the `Rtl` story renders `dir="ltr"` and `dir="rtl"` side by side in ONE document
and asserts mirroring between them -- no dual build can serve it. Full
per-component design **deferred**, and it is a *component-onboarding* obligation:
each new island must classify its own sites against the six-class table.

**D2 -- public contract: ACCEPT AND HONOUR, with an explicit inert-today
disclosure.** `@error` rejected (fails the build on a variable at its own default
`ltr`, breaking the BINDING seamless-migration constraint); silent acceptance
**ruled out by name**; `@warn` rejected because the setting is not meaningless.
The deciding discovery: **`$global-text-direction` COMPOSES CORRECTLY with the
rebind rather than conflicting with it.** The rebind is unconditional and
post-`@import`, so the properties it reaches stay runtime-directional in either
setting; the variable therefore reaches **only the residue** -- exactly the
constructs logical properties cannot express. It is the correct escape hatch in
Foundation's own vocabulary, i.e. the maximally seamless answer. The disclosure
that converts silence into transparency: *as of M002 the shipped surface
contains zero such constructs, so it is currently a no-op* -- verified, the
public `theme()` chain compiles **byte-identically** (5839 bytes) under both
values. Mechanism routed to ticket 15; D2 fixes the status (carry it, honour it,
never drop it silently).

**D3 -- not a Storybook control in M002, and never a member of the theme map.**
Upholds ticket 12's C7 conclusion while **retiring its Button-specific ground**
(inertness) rather than repairing it. Surviving grounds: mechanically unreachable
through the addon's entry (the variable must be set before the island's
`@import`s; `theme()` runs after -- reaching it needs the bare-Foundation-globals
mechanism `_button.scss` records as measured-and-rejected); it breaks R009's
six-scalar preset equality; it costs a compile per toggle against a 197-305 ms
baseline; **decisive -- the demonstration need is already met better**, since a
toolbar/panel control sets one direction for the whole preview and cannot express
the existing side-by-side story; and ticket 01's measured sync cost (panel <->
toolbar globals, plus a 5 s `waitFor`) buys nothing. If RTL preview breadth is
ever wanted, the shape is a `dir` toggle on the preview root -- **zero Sass
compile** -- so this decision costs no capability.

**M003's `:dir()` rejection was BUTTON-SPECIFIC, with evidence.** D021's Question
is scoped to "the **button-dropdown arrow**". Its three grounds separate: the
`[dir="ltr"]`-never-matches finding rules out **rtlcss's `dirAttribute` mode**
(library-wide), the wrong-transform-direction finding rules out
**postcss-logical** (library-wide) -- neither rules out `:dir()`. The `:dir()`
ground is purely **comparative**: *"a viable runner-up but costs specificity.
Foundation's own interpolation hooks cost neither."* That comparison's cheaper
arm exists only where the interpolation hooks are in the SAFE classes, i.e. only
for Button. D028 adds nothing -- it is a re-scoping decision carrying D021 by
reference. And **R004's own Description names `$global-text-direction` as the
behaviour to match**; the "no `:dir()`" phrase sits in its *Validation* field,
describing what was built. Using `:dir()` later needs **no decision reversal**.

**Detection story (the coordinator's question).** `verify-foundation-parity.mjs`
would **NOT** catch the worst class -- it **blesses** it: `:64,67` map
`text-align: left -> text-align: inline-start`, so the gate's own translation
table asserts the invalid form is correct. Harmless today (Button emits no
`text-align`), so **no M002 code change** -- but the table must never be copied
into a new gate. Bare-side positioning WOULD fail checks 1+2; nothing catches the
class-name rename. Separately, any gate built on "diff LTR vs RTL output" is
structurally blind to **selector-swap** residue (drilldown's transforms,
input-group's radii, flex-justify) -- which is why the 96%-closed figure
undercounts. The missing gate, named: a **CSS validity check using the browser's
own CSSOM as oracle** in the existing `test-browser` lane -- authoritative (same
engine that would drop it), zero new dependencies, no allowlist to rot.

**D4 -- M002 must not foreclose** (10 items; full bill **zero code + one README
paragraph**). The three that would cost rework: do not lift the `!global` rebind
into a shared partial; do not copy the parity gate's physical-to-logical value
table; do not narrow or remove the `test-browser` lane. Plus: keep the control
set closed at six, no direction argument on `theme()`, keep `THEMEABLE_MODULES`
entries as object literals, keep the full compiled-discovery closure (no
Button-only filter), no bare-global seeding in the addon entry, no direction
member in `_theme.scss`, and keep the `Rtl` story's side-by-side shape.
