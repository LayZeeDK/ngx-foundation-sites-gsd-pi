# Can a consumer-settings-dependent defect be gated at all?

Type: research
Status: resolved
Blocked by: 01

## Question

If elimination fails or is partial, the fallback is detection -- and detection has
a structural problem this ticket must confront rather than design around: **the
defect count depends on input this repo's CI never sees.** A consumer sets
`$buttongroup-radius-on-each: false` in *their* build. Nothing in this
repository's test run observes it.

So: what gate is even possible?

1. **Cartesian-product gate over a bounded set.** Viable only if ticket 01 finds
   the activating-settings set small and monotone. Cost the combinations
   honestly -- and note ticket 13's measured compile cost (135-210 ms per
   palette-driven component; ~1.2-1.4 s for full coverage), because a
   product-gate multiplies that.
2. **A validator the consumer runs.** Ship a check that runs against the
   consumer's own compiled output. Establish whether anything in this repo's idiom
   supports that today -- the existing gates (`verify-foundation-parity`,
   `verify-exports-map`, `verify-autodocs-coverage`, and M002's planned
   `verify-theming-sources` / `verify-theming-bundle`) are all
   *build-time-in-this-repo*, not consumer-side. A consumer-run validator would
   be a new class of artifact with its own packaging and support burden. Say what
   it would cost.
3. **CSS validity via the browser's own CSSOM.** Ticket 14 named this as the
   missing gate -- `test-browser` already runs real Chromium, so CSSOM will drop
   an invalid declaration and the drop is observable, at zero new dependencies.
   Establish whether it generalises from our fixed settings to arbitrary consumer
   settings, and note its blind spot: it **cannot** catch the class-name
   interpolation defect, because `.align-inline-start` is valid CSS that simply
   matches nothing.
4. **Documented limitation plus a runtime warning.** The honest floor. Foundation
   itself may say something here -- check, and graduate the map's fog item on
   upstream documentation.

Also settle two framing questions:

- **What does "gated" even mean for a defect the consumer activates?** Is the
  obligation to prevent, to detect in our CI, to detect in theirs, or to
  disclose? These are different products. Name which one the migration-
  seamlessness constraint actually demands.
- **Does a partial elimination change the gate?** If ticket 02 eliminates four of
  six classes, the gate only needs to cover the residue -- which may flip an
  infeasible gate into a cheap one. Do not assume the classes are gated as a
  block.

## Notes

Blocked by ticket 01 because feasibility of every option above depends on whether
the activating-settings set is bounded and monotone.

Ticket 02 runs in parallel. If it lands first, read
`../research/02-is-the-residue-eliminable.md` -- a proof of full eliminability
makes most of this ticket moot, and the right answer then is a short one saying
so rather than a survey of gates nobody needs.

Reuse M002's probes where they help (`.scratch/m002-storybook-theming-addon/prototypes/`).
Prefer a measured claim over a reasoned one.

## Answer

Full write-up: `../research/03-can-a-consumer-dependent-defect-be-gated.md`.

**No gate is needed for the six defect classes -- detection is UNNECESSARY, not
merely infeasible.** Ticket 02 landed first and proved full eliminability: the
direction-twin construction synthesises no new property name, value or class name,
so no consumer settings configuration can produce invalid CSS by construction. The
question this ticket was built to answer is dissolved rather than answered.

**Exactly one risk survives, and it is a browser-support question, not a settings
one.** `:dir()` fails 2 of the 136 targets the pinned R022 `.browserslistrc`
resolves to (chrome/edge 119).

**Options, each decided:**

1. **Cartesian gate -- WRONG SHAPE** (ticket 01: two multipliers with infinite
   domains). Not costed further. For scale at this ticket's measured compile rate:
   8192 cells x 1344 ms is over 3 hours and still incomplete.
2. **Consumer-run validator -- UNNECESSARY, so never priced.** Nothing left to
   validate. Recorded: the package ships `./scss/*` and `./css/*` with no `bin`, so
   this would have been a new artifact class -- a cost now avoided.
3. **CSSOM validity in `test-browser` -- KEEP, re-purposed as a regression
   tripwire.** Graduated from ticket 14's [INFER] to VERIFIED in real Chromium: all
   class 1-4 declarations are dropped, at both the declaration level and the sheet
   level, with five valid controls surviving. It does NOT generalise to arbitrary
   consumer settings and no longer needs to. Its value now is that the guarantee is
   a property of the GENERATOR, not of the sheet -- a generator bug or a reintroduced
   rebind would break it silently.
4. **Documented limitation -- REPLACED by prevention**, except for `:dir()` support.

**What "gated" means here, decided:** the migration-seamlessness constraint demands
**prevent**, and elimination delivers it for all six classes. *Detect in our CI*
narrows to two cheap checks; *detect in theirs* is DROPPED (never buildable, now
pointless); *disclose* is still owed but narrowed to `:dir()` support and
`$global-text-direction` -- no longer a confession about invalid CSS, which ticket 15
named the worst migration outcome.

**The R022 obligation is a GATE plus a DISCLOSURE, not nothing.** Verified:
`scripts/verify-browserslist.mjs` (36 lines) asserts the query STRING and a non-empty
resolution, and checks no CSS feature against the resolved targets -- so nothing in
this repo would notice `:dir()` failing 2 of 136. That is the one place a real gate
is still warranted, and it is an extension of an existing gate, not a new artifact
class.

**The partial-elimination conditional resolved rather than fired** (elimination was
total), leaving one measured law that makes ticket 02's onboarding test mechanical:
**the unbounded magnitude is pure REPLICATION of a fixed site set** -- all 1187
class-2 declarations at 48 columns x 12 breakpoints come from the same 22 source
sites as the 98 at defaults, with zero new sites in any class. So "the widest
settings configuration" is **two compiles**, complete over every broken source site
across 24 configurations (8/8, 22/22, 14/14, 1/1, 11/11, 2/2). Both are required:
non-monotonicity holds at site level too. Measured cost: the admitting compile is
NOT more expensive than the defaults compile (within noise), so the gate is 2x one
compile -- 782 ms for `button-group`, 312 ms for `menu`, 2819 ms library-wide.

**Foundation's own documentation (fog item GRADUATED).** RTL is one 45-line page
documenting a BUILD-TIME choice, and `$global-text-direction` appears exactly once in
the whole shipped docs tree. **No settings/RTL interaction is documented anywhere** --
`sass.md` and `global.md` have zero mentions of "direction", the settings template a
consumer edits carries a bare uncommented line, and the shipped `customizer/` has no
direction handling at all. `dir="rtl"` is documented as a JAVASCRIPT requirement, so
upstream has no runtime CSS direction contract. Two contract facts fall out:
`.align-left`/`.align-right` ARE documented direction-sensitive public API
(`menu.md:49-53`), so the rebind's rename broke a DOCUMENTED contract; and
`$global-left`/`$global-right` are labelled **"Internal variables"**
(`_global.scss:126`), so the rebind overwrites undocumented internals while the twins
depend only on the public variable -- an argument for the twins independent of
validity.

**[WARN] Two false all-clears caught while building the CSSOM oracle**, both
producing "0 survived", which reads as "the browser dropped every defect":
(a) `CSSStyleRule` has a `.cssRules` property (CSS Nesting) and an empty
`CSSRuleList` is **truthy**, so the natural recursion collects nothing -- the first
run reported `0 rules kept` plus four `[OK] ALL DROPPED` lines from a sheet where
nothing had been examined. **Any CSSOM gate must carry a positive control asserting a
known-VALID declaration survived.** (b) Chromium's CSSOM expands `border-width` into
four longhands when enumerated, so a class-6 detector written against the source text
reports 0 for a detector reason unrelated to browser behaviour. Also: an unshuffled
whole-library-only cost run would have reported "+10% for the admitting compile" --
the sign flip at `menu` is what exposes it as noise.
