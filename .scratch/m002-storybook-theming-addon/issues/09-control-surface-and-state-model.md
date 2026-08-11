# Decision: control surface, preset semantics, and CSS injection

Type: research
Status: open
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

**The R026 question.** R026 bans CSS-in-JS, and is enforced by an ESLint rule
with an executable test (`nfs-button.r026-lint.spec.ts`). This addon injects
browser-compiled CSS *through JavaScript*. State where the line falls: R026
bans a hand-fed CSS string as the component's styling source; a dev-only
Storybook addon injecting compiled output is plausibly outside it -- but
"plausibly" is not a decision. Check the actual lint rule's scope and file
globs, and confirm whether the addon's code would trip it. If it would, decide
the resolution (scope the rule, or change the approach) rather than deferring.

## Notes

Blocked by 05 because whether the state model needs debounce, async, or worker
machinery depends on measured compile latency. If compilation turns out to be
fast, a large amount of speculative machinery drops out of the design -- prefer
the simplest model the measurements permit.
