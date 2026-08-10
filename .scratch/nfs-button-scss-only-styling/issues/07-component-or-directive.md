# Does the chosen styling architecture free NfsButton to be a Directive?

Type: research
Status: resolved
Blocked by: 01, 06

## Question

R025 requires template-less building blocks to be Directives, *except* where the
block needs Angular's Component-only per-instance stylesheet lifecycle -- in
which case it stays a Component with an empty or omitted template. NfsButton is
currently a Component whose entire template is `<ng-content></ng-content>`
(`nfs-button.html`) on an attribute selector (`button[nfsButton], a[nfsButton]`),
which is what triggered R025 in the first place.

**The user has already locked half of this.** Standing decision, recorded in the
map's Notes: prefer a Directive, but if NfsButton needs `styles`/`styleUrl` then
Component is authorized and requires no further approval. Styling requirements
outrank the Directive preference. So this ticket is no longer "which is nicer" --
it is a single narrow question:

> Is there any non-CSS-in-JS style-delivery mechanism that satisfies **R005's
> ref-counted lazy load/unload** without Component-hood?

If no, the answer is Component and the ticket closes on that. Do not spend effort
justifying Component beyond naming the requirement that forces it.

Once ticket 06 has fixed how styles are delivered, decide -- decision only, not
the conversion:

1. **Does the architecture require Component-hood?** If default CSS arrives via
   `styleUrl`, R025's carve-out applies and NfsButton must stay a Component. If
   the chosen architecture delivers CSS some other way, the carve-out lapses and
   Directive becomes available. Answer from ticket 06's choice and ticket 01's
   findings. Enumerate the Directive-compatible alternatives honestly before
   concluding -- principally a consumer-imported global or precompiled stylesheet
   (the current Option-1 path), which needs no Component but gives up
   per-component ref-counted load/unload. State exactly which requirement each
   alternative sacrifices.
2. **Would R025's literal "empty or omitted template" actually work?** Verify
   against `angular/angular` v22 whether a Component with an attribute selector
   and *no* `<ng-content>` preserves the host element's original child nodes, or
   whether non-projected content is dropped from the DOM. `<button nfsButton>Save</button>`
   losing its label would be a silent, total regression. Verify with a real
   TestBed check, not by reasoning about `ɵɵprojection`.
3. **What does Material do?** MatButton is a Component with a real template
   containing `<ng-content>`. R010 requires matching Material's building-block
   shape, so if Material keeps a Component + `<ng-content>`, note the tension
   with R025's preference and say which requirement wins here.

Deliverable: Component or Directive, with the reason tied to a named requirement.
If the answer is "stays a Component", say explicitly that R025 is *satisfied by
its own exception* rather than violated, so M003 S01 can be re-scoped rather than
executed as titled. Performing any conversion is out of scope for this map.

## Answer

**NfsButton stays a Component, and R025 is satisfied by its own exception rather than
violated.** The forcing requirement is **R005**, not the styling-source requirement.

The chain, all already evidenced:

1. R005 requires lazy load/unload of component CSS with a reference count -- restated by
   the user as a hard requirement in the original brief.
2. Ticket 01 established that this lifecycle is **structurally Component-only**:
   `styles`, `encapsulation` and `getExternalStyles` all sit inside `ComponentDef`, none
   in `DirectiveDef`; `ɵɵExternalStylesFeature` returns a `ComponentDefFeature`; and the
   lifecycle is keyed to the component LView, which a directive does not have. A runtime
   def-key diff confirmed a directive has none of the three.
3. Ticket 06 selected `styleUrl` delivery, which is that same Component-only channel.

**The Directive-compatible alternative was evaluated and is worse on its own terms.** A
consumer-imported global or precompiled stylesheet needs no Component -- but it
sacrifices R005 outright, and ticket 12 measured it as *more* fragile, not less: a plain
SCSS import in `.storybook/preview.ts` silently no-ops in Storybook dev and hard-fails
`build-storybook`, because both `oneOf` branches gate on `?ngGlobalStyle` / `?ngResource`
resource queries a plain import never carries. The option that trades away a requirement
also costs more configuration. Rejected on both counts.

Per the user's standing decision, Component-hood needs no further approval where styling
requires it. Worth stating precisely which requirement forces it: without R005, a
Directive plus a global stylesheet would have satisfied "no CSS-in-JS" on its own.

**On R025's literal "empty or omitted template":** NfsButton keeps
`<ng-content></ng-content>`, matching Material's MatButton, which R010 requires as the
parity reference -- so R025's recommended shape is not exercised here. Whether an
attribute-selector Component with **no** `<ng-content>` preserves the host element's
original child nodes remains unverified, and it matters as **advice for future `nfs-*`
components** rather than for this one: `<button nfsButton>Save</button>` losing its label
would be a silent, total regression. Delegated to ticket 08 as a ten-line TestBed check,
since that ticket already has TestBed running. The result is guidance for R025's future
application, not a blocker here.

**Consequence for M003 S01, to report:** the slice is titled "NfsButton: Component to
Directive" and sits in `refining`. **The conversion should not happen.** R025's own
exception covers NfsButton, and R005's recorded proof already anticipated this ("Tension
with R025 resolved: SharedStylesHost's ref-counted lifecycle is Component-only, so R025
carves out an exception"). S01 wants re-scoping to the styling work this map performs.
`.gsd/` is read-only, so this is a report, not an edit.
