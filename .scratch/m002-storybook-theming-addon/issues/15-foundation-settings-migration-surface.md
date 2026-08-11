# The Foundation settings migration surface, and what M002 must not foreclose

Type: research
Status: resolved
Blocked by: --

## Question

**Binding constraint (map Notes): migrating SCSS settings from Foundation for
Sites to `ngx-foundation-sites` must be as SEAMLESS AS POSSIBLE**, except that
modern Sass modules (`@use`) are preferred over Foundation's legacy
global-`!default` idiom where possible.

Measured gap: Foundation's `settings/_settings.scss` declares **490 variables**.
`internal/_settings.scss` seeds **26**, privately (`internal/*` is `null` in the
exports map), and the entire public surface is `theme()`'s four arguments
(`$selector`, `$background`, `$palette`, `$radius`). A consumer arriving with a
Foundation settings file has nowhere to put it.

This ticket also **corrects the map's Out-of-scope entry** "extending `theme()`'s
public Sass API", which justified a *library* API boundary with *what the addon's
curated control set needs*. That reasoning is invalid -- the same error class as
the single-component premise.

### Scope discipline -- read this before starting

Designing a 490-variable settings API is **not** this map's destination, and
almost certainly belongs to a later milestone. The deliverable here is:

1. **A scoping verdict**: what part of the settings-migration problem, if any,
   M002 owns, and where the rest belongs. Be decisive and give grounds.
2. **What M002 must NOT foreclose** -- the concrete constraint list. This is the
   part M002 genuinely owns and the reason this ticket exists now rather than
   later. If the addon, `_theme.scss`, the `THEMEABLE_MODULES` list, or the
   generated sources artefact would make a seamless settings surface harder to
   add later, say exactly how and what to do instead.

### Reconcile a real tension -- do not assume it away

"Prefer `@use`" is not automatically "use `@use ... with (...)`". That mechanism
was **measured and rejected** for the theme API: it forced consumers to type
bare Foundation-shaped globals, could not be invoked twice in one compilation
even with byte-identical values, and emitted 5490 bytes of unwanted rules just to
read one token. See `packages/ngx-foundation-sites/src/scss/_button.scss`'s
header comment and the M003 decision it cites.

So a settings **module** and a theme **mixin** may legitimately want different
mechanisms. Establish which of that rejection's grounds apply to a *settings*
module -- the "cannot be invoked twice" objection may be irrelevant to settings,
while the "bare Foundation-shaped globals" objection may be exactly what
seamless migration WANTS. Say so either way.

### Questions to answer

1. **What does seamless actually mean here?** Rank the plausible bars: a
   consumer can paste their Foundation `_settings.scss` unchanged; or pass a
   settings map; or set only the variables they changed from Foundation's
   defaults; or run a codemod. Which bar is worth aiming at, and what does each
   cost?
2. **Which of the 490 are reachable at all?** Foundation's settings are
   component-partitioned. Only variables whose components exist can do anything.
   Establish how the surface should grow as components land -- and whether a
   settings mechanism that grows per component is better or worse than one global
   settings entry point.
3. **How does this relate to `_theme.scss`?** Ticket 12 created it for
   `$wcag-palette`. Is it also the settings entry point, or a distinct concern?
   Decide, since ticket 12's file is not built yet and changing its role is free
   now.
4. **What happens today** if a consumer sets an unknown Foundation variable --
   compile error, silent ignore, or something else? Verify by probe. Silent
   ignore is the worst outcome for migration and should be named as such.
5. **Does this change the addon's curated control set?** Probably not -- six
   Foundation-global variables is a deliberate live-tweak surface, not the
   library's settings API. But state the relationship explicitly so a future
   reader does not re-derive the library's API from the addon's panel, which is
   the mistake this ticket corrects.

## Notes

Ticket 14 owns `$global-text-direction` specifically, including its status in the
public contract. Do not duplicate that -- reference it. Direction is a worked
example of the general problem this ticket frames.

Verify against `node_modules/foundation-sites/scss` with `rg` (gitignored --
`git grep` silently returns zero there). Probe rather than reason where a probe
is cheap; this map's standard has been executed evidence.

A legitimate outcome is: "M002 owns nothing here except these N
non-foreclosure constraints; the settings API belongs to a dedicated milestone,
and here is the shape of the question it should answer." That is a strong result,
not a punt -- provided the non-foreclosure list is concrete.

## Answer

**RESOLVED. Full findings: [`research/15-foundation-settings-migration-surface.md`](../research/15-foundation-settings-migration-surface.md).**
Three reproducible probes left behind, all read-only:
`prototypes/settings-surface-probe.mjs`,
`prototypes/settings-reachability-probe.mjs`,
`prototypes/settings-map-shape-probe.mjs`.

### The scoping verdict

**M002 owns NOTHING of the Foundation settings API and must not invent one; the
settings surface belongs to a dedicated later milestone.** Three measured
grounds. (1) **481 of the 490 settings are read only by component partials this
library has not wrapped**; only **42** are referenced anywhere in the button
chain's real 13-partial closure and only **6** are `util/`+`_global`-only
[V-EXEC] -- an API designed against 42 names would be validated by one component,
the same expiring-premise error inverted. (2) Every viable mechanism requires
rewriting `internal/_settings.scss`'s 26 deliberate plain assignments, which is
a library compile-time contract change touching the island's seeding idiom and
`verify-foundation-parity`'s subject -- M002 does not touch that file. (3) The
mechanism is verified all-or-nothing: `@use ... with` works and is LOUD, but can
be applied **once per compilation, before any other load** [V-EXEC], so a
half-shipped surface publishes an ordering constraint that every later addition
inherits.

### The seven non-foreclosure constraints M002 DOES own

1. **`_theme.scss` stays a DATA module -- no `!default` member, NOT the settings
   entry point.** Verified: configuring a module after anything has loaded it is
   a hard error, so a module consumers READ can never be the module they
   CONFIGURE. Breaks: reading `$wcag-palette` and configuring settings become
   mutually exclusive in one compilation -- including in `apps/nfs-demo`. Cost:
   zero, the file is not built.
2. **The six controls are documented as an ADDON surface, never the library's
   settings vocabulary.** Breaks: the withdrawn Out-of-scope entry returns a
   fourth time. Cost: one sentence in R009.
3. **The generated entry string reserves an ordered LEADING slot for
   configuration.** `@use 'nfs:/button'` transitively loads the settings module
   immediately, so an appended config clause can never work. Breaks: the addon's
   entry builder needs restructuring inside a Worker with degraded diagnostics.
   Cost: zero -- ordered array instead of concatenation, same ~4 lines as C2.
4. **The generator's entry-point arrays stay data, and no gate freezes a literal
   closure file count.** A settings module is the same class of file as
   `_theme.scss` (C3's Q1b negative control). Breaks: silently absent from the
   inlined sources; runtime `Can't find stylesheet to import`. Cost: zero.
5. **M002 does not touch `internal/_settings.scss` -- no `!default`, no split, no
   new members.** `internal/*: null` is documentation, not enforcement (re-verified
   a third way), so one `!default` makes the name de-facto configurable public API
   with no key validation. Breaks: the loud-failure property is lost permanently.
   Cost: zero.
6. **M002's README documents today's silent-ignore as a known limitation.** This
   is the positive obligation and the reason the ticket runs now: M002 ships the
   first user-facing theming docs. Cost: two sentences.
7. **R009's "Foundation global" identity column is vocabulary, not wiring.**
   VERIFIED inert when seeded into the island: `$foundation-palette`,
   `$primary-color`, `$global-radius`, `$global-font-size`, `$global-margin` --
   ticket 12's `$global-text-direction` finding is **one instance of a general
   rule**, not a special case. Breaks: a settings milestone routes the six
   controls through `$foundation-palette`/`$global-radius` and ships a silent
   no-op. Cost: one footnote.

### The `@use ... with` reconciliation, ground by ground

- **"Forces bare Foundation-shaped globals": APPLIES, and INVERTS.** A defect for
  a theme mixin whose point is that no global is ever named; the *goal* for a
  settings module, because a migrator arrives holding exactly those names.
- **"Cannot be invoked twice": APPLIES, and bites HARDER than for the mixin.**
  Verified three ways, including the realistic multi-file case (two consumer
  partials each configuring = hard error). The rule is "configure once, first,
  from the entry stylesheet". Survivable -- it is Foundation's own legacy
  requirement, now enforced with an error instead of silence -- and it does not
  touch `theme()`: configured settings + TWO scoped `theme()` calls in one
  compilation is verified to work.
- **"Emitted 5490 bytes": DOES NOT APPLY.** A settings module emits **0 bytes**.
- **The property nobody costed:** an unknown, misspelled, or not-yet-carried name
  is a **hard compile error** under `@use ... with`, with no validation code at
  all -- the exact inverse of today's silence.

### Question 4 -- the probe

**SILENT IGNORE, confirmed, and it is the worst outcome.** Pasting Foundation's
entire 490-variable `_settings.scss` below the `@use` compiles to CSS
**byte-identical** to the untouched default theme (5839 B), no warning -- even
with a value deliberately changed. Same for the legacy `@import` route and for
hand-declared globals. Two mercies and one extra trap: the four public `theme()`
arguments are airtight (any undeclared argument or `with` clause is a hard
error); pasting ABOVE the `@use` is a hard Sass error; but a typo'd key in the
one public map argument silently emits `.button.sucess` (+932 B of junk CSS).

### Curated control set

**Unchanged, closed at six.** The panel is a live-tweak subset of `theme()`'s
arguments; the library's settings API is Foundation's 490-name vocabulary. The
narrow claim survives -- M002's addon needs no public Sass API extension -- but it
must never bound the library's settings surface.

### For ticket 14

Do not duplicate; consume one finding: the inertness measured for
`$global-text-direction` is **general**, not special. Five more globals are
equally inert through the same mechanism -- the island pre-seeds the derived name
non-`!default` before the `@import`s, so the upstream cascade never fires.
