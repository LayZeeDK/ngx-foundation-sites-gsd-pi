# The gating contract between the settings surface and cross-component RTL

Type: research
Status: resolved
Blocked by: 01, 02, 03

## Question

The map's destination. Lock the contract: **how do the settings-migration
milestone and the cross-component RTL obligation gate each other?**

Decide between these shapes, on the evidence tickets 01-03 produce:

1. **Eliminate first, then open settings.** RTL residue is made structurally
   impossible; settings become safe by construction; the coupling dissolves.
   Cleanest if ticket 02 proves full eliminability.
2. **Per-component coupling.** A component's settings surface opens only when its
   own RTL residue is closed. Aligns with ticket 14's framing of cross-component
   RTL as a *component-onboarding obligation* rather than a milestone-shaped
   project, and it lets both milestones progress incrementally. Requires the
   sensitivity map to be per-component, which ticket 01 should deliver.
3. **Open settings with detection.** Accept latent defects, gate them by whatever
   ticket 03 finds feasible. Only viable if a real gate exists.
4. **Open settings with disclosure.** Document the interaction, warn, and accept.
   The honest floor -- and note it is what the library does *today* by accident,
   which ticket 15 already named as the worst outcome for migration. If this
   wins, it must win explicitly, not by default.

Then state, precisely enough for a planner:

- **Ordering.** Which milestone can start first, and what it must not do until
  the other lands.
- **The obligation each owes the other**, in one sentence each, testable.
- **The trigger.** What measurement or event flips the decision -- following
  ticket 13's discipline of writing thresholds down rather than leaving a
  rationale that expires.
- **Whether M002 is implicated.** Ticket 01 answers whether any of the addon's six
  controls activates residue. If yes, state what M002's hand-off must gain; if
  no, state the clean bill of health so nobody re-opens it on suspicion.
- **What happens to the rebind.** Ticket 14 said it stays where it is and must not
  be lifted into a shared partial. Confirm that survives, or say what replaces it
  and whether Button eventually migrates.

## Notes

This is a synthesis ticket -- resolved AFK from tickets 01-03 plus the M002 map's
`research/13`, `14` and `15`. Do not re-measure what they measured; do not
re-open decisions they locked.

Beware the failure mode this map exists to prevent: a contract that reads well
and expires. Every clause must be durable -- grounded in a measured property of
Foundation's Sass or of the mechanism, not in the current component count, the
current settings surface, or "no consumer has asked for this yet". The M002 map
was corrected twice for exactly that error.

Out of scope here: designing either milestone. This ticket says how they gate
each other, not what they contain.

## Answer

Full contract in `.scratch/settings-rtl-coupling/research/04-the-gating-contract.md`.

**Shape: option 1, ELIMINATION-FIRST, admitted per component by a mechanical test
-- with one correction the evidence forces: the gate is NOT temporal.** Neither
milestone waits for the other. What gates is a two-compile admission test on the
COMPONENT side; once it holds over the shipped set the settings surface is safe for
every Foundation setting at every value, by construction (T02: 0 invalid across 8
configurations, exact dual-build equivalence, 0 computed-style diffs in both
directions in one document).

**Nine locked clauses.** C1 shape (prevention, never detection or disclosure).
C2 the admission test -- **two compiles** (defaults + `$buttongroup-radius-on-each:
false` with `$global-flexbox: false`), complete over source sites across 24
configurations because magnitude growth is pure replication of the same 22 sites;
must pin the component set, must not compile through `foundation-everything()`
(the `$global-flexbox: true !global` overwrite), must report per-class counts never
pass/fail, must pair a validity oracle with a class-name parity check. C3 twins by
default, rebind iff C2 returns zero, no third mechanism. **C4 the settings surface
FORCES the twin layer to be Sass** (T02 R2: Sass cannot rewrite selectors it did
not author, so the twins cannot be generated at consumer compile time; a
pre-generated CSS blob is keyed on the library's settings and desynchronises
silently from consumer-tracking base rules -- machine-check: orphan twins > 0 is a
failure). C5 no key withheld; the sole prohibition is live-and-unsafe. C6 extend
`verify-browserslist.mjs` to check features against RESOLVED targets (today it
checks none). C7 the `:dir()` disclosure -- the only clause that can expire.
C8 the CSSOM tripwire with a MANDATORY positive control. C9 the parity gate's
`text-align` table is mechanism-coupled and wrong in both directions.

**Ordering: none, deliberately.** Inventing one would be the expiring-premise
error this map exists to prevent. Settings must not ship a live key set before C2
is wired as CI; onboarding must not admit an unadmitted component, lift the rebind
into a shared partial, or ship a pre-generated twin blob.

**The two obligations, discharged by the SAME artifact.** Settings owes RTL: *a CI
gate compiling the whole shipped component set at the two-compile envelope,
reporting per-class counts, failing on any non-zero class 1-4 count, any renamed
Foundation public class name, or any orphan twin.* RTL owes settings: *every
admitted component emits zero BROKEN-class declarations and zero renamed public
class names across that envelope, so no settings key ever has to be withheld.*

**Triggers, all thresholds or version numbers** (eight, tabulated). The expiring
one: **delete C7 when the pinned `.browserslistrc` resolves to no chrome or edge
below 120** -- `:dir()` shipped in 120, the pin floors at 119, and the file's own
header records the rolling query already resolving to 121. Volume is explicitly NOT
a trigger (+14.1% library-wide, +62% `button-group`, compile time indistinguishable
from noise); any budget chosen now would expire.

**Rejected shapes.** Option 2 loses on the settings axis for two measured reasons
-- `@use ... with` is once-per-module-per-compilation so the settings door has no
per-component granularity to gate, and the activating settings are cross-component
so a per-component gate degenerates to library-wide; its component-side half
survives verbatim as C2+C3. Option 3 loses three times: unnecessary (prevention
proved), wrong shape (two infinite-domain multipliers; 8192 cells = >3 h and still
incomplete), and could never report pass/fail (non-monotone, three classes maskable
to zero). Option 4 loses because it IS today's accidental behaviour (490 settings
pasted -> byte-identical, no warning), because Foundation documents ZERO
settings/RTL interaction so there is no upstream hazard to relay, and because it
means shipping a break of documented public API (`.align-left`/`.align-right`).
What survives is a browser-support disclosure, a different object.

**M002: CLEAN BILL OF HEALTH, stated so nobody re-opens on suspicion.** Verified
three ways; the radius worry does not land because the radius-shaped class is gated
by a BOOLEAN, not a radius (0/20 identically at radius 0, 6px, 50%). The closed
HANDOFF needs no correction. Forward rule: "can it change WHICH rules are
emitted?", not "is it a Foundation global?" -- a single boolean control re-opens it.

**The rebind: STAYS, Button only, now by mechanical rule.** Button is not a special
case, it is the case that passes C2 -- and the only one today. The
no-shared-partial prohibition sharpens: "shared" is exactly the scope at which its
precondition stops holding. Migration is **discretionary forever** -- the
correctness case is zero and stays zero (3 valid declarations vs 4 twin rules;
`css-logical-props` 136/136 vs `:dir()` 134/136).

**Unproven premises, flagged:** C4's option (b) tracking consumer settings is the
single load-bearing INFER -- hence trigger 3 with a measurable threshold rather
than a rationale.
