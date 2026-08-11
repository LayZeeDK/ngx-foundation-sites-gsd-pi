# Scaling and performance re-evaluation against N components -- findings

Resolves `.scratch/m002-storybook-theming-addon/issues/13-scaling-performance-re-evaluation.md`.
Status: **resolved, decisions LOCKED** (AFK -- no human in the loop, per map.md Notes).

No repo file was changed. One new reproducible probe was left behind:

- `prototypes/scaling-curve.mjs` -- compiles the real chain and 34 real
  Foundation component chains in four different architectures and times them.
  Two full runs recorded at `prototypes/run-scaling.txt` and
  `prototypes/run-scaling-2.txt`.

## Evidence key

- **[V-EXEC]** -- verified by executing a read-only command here, output quoted.
- **[V-REPO]** -- verified by reading a tracked file in this repo (path + line).
- **[V-SRC]** -- verified by reading shipped `node_modules` source.
- **[V-PRIOR]** -- carried from tickets 01-12's own verification, cited.
- **[INFER]** -- reasoned, not executed. Flagged explicitly.

## The test applied

From map.md Notes and this ticket's own bar:

> No decision may rest on a premise that expires. Where a decision stands, its
> rationale must become durable -- "one component exists today, and here is the
> threshold that changes it" -- so a future reader knows when to revisit rather
> than inheriting a stale premise as settled.

Applied literally. **Nothing below builds machinery.** All four of ticket 09's
performance decisions survive; three of the four rationales do not, and are
replaced with measured thresholds.

---

## 0. Verdict up front

**The reference project's four stacked mitigations were responses to a cost this
architecture never reaches, and that is now a measured statement rather than an
architectural argument.**

The load-bearing measurement is not the curve's slope. It is the curve's
**ceiling**:

> **A theme apply over EVERY Foundation component the six curated controls can
> affect costs ~1.2-1.4 s in the Worker -- still LESS than the reference project
> needed for TWO components (1464-1504 ms).**
> [V-EXEC, anchored; V-PRIOR: research/01 C7]

Three findings get it there, all measured, none of them "this repo has one
component":

1. **The compile-time curve is ADDITIVE in emitted components** -- not
   floor-dominated. Predicted-from-parts is within 2-7% of measured
   [V-EXEC]. Ticket 12's *closure* is floor-dominated (12 of 13 partials shared);
   **time is not**, and inferring one from the other would have been wrong. The
   island floor is only 20-30% of the cost at N=1 and 5-7% at N=31.
2. **Cost tracks palette-driven colour math, not components and not CSS
   volume.** Five components measured 133-198 ms each to emit (Node); two more sit
   at 31-74 ms; the remaining 24 at -10 to +21 ms. `off-canvas` emits 8945 bytes
   for ~10 ms; `badge` emits 479 bytes for ~133-173 ms [V-EXEC]. Four of the
   expensive five loop `$foundation-palette` through `color-pick-contrast`, and
   the fifth (`button-group`) loops `$button-palette` into the same contrast
   mixins [V-SRC].
3. **So the set that scales is bounded by the CONTROLS, not by the component
   count.** Only **19 of Foundation's 35** component partials read any of the six
   curated globals at all, and the expensive tier is **6** -- five measured plus
   `progress-bar` [INFER] [V-EXEC]. The remaining 16 partials emit byte-identical
   CSS for every theme -- they are not merely cheap, they are outside the compile.

That bound is durable because it is derived from ticket 12's C6 (the six controls
ARE Foundation globals), not from how many components exist.

Summary of the five decisions:

| # | Decision | Class | One line |
| --- | --- | --- | --- |
| 1 | **No debounce timer, latest-wins coalescer** (ticket 09 D.1/D.3) | **UNAFFECTED, rationale RESTATED** | The coalescer's justification was never the 197 ms figure -- it is that the coalescing interval IS the machine's compile time, so it self-tunes at any N. A timer starts to pay only past ~1000 ms per apply, which the library's own ceiling barely reaches. |
| 2 | **No cache** (tickets 01 s2.3, 09) | **UNAFFECTED today, rationale CORRECTED, seam named** | Dismissing the LRU as "over-engineering for 6 controls and one component" was the wrong reason. The right one: at 197 ms nothing is *perceptibly* saved, because ticket 09's own indicator threshold is 300 ms. Threshold: the 2nd palette-driven component. The seam is a 3-line memo at one call site, and it **structurally cannot inherit `CACHE_VERSION`** (section 4.2). |
| 3 | **Single Worker, no pool** (tickets 01 s2.2, 05 s5, 09 D.2) | **UNAFFECTED, rationale PARTLY REFUTED** | The reference's 20.5% does NOT generalise -- measured pool gain grows to 4.1x by N=20. "The slowest component dominates" is TRUE but only sets the pool's *ceiling* (~250 ms). A pool is rejected on three better grounds, one of them new and structural: 4 of 31 components **cannot be islanded alone at all** [V-EXEC]. |
| 4 | **Pre-compiling the default theme at init** (never considered) | **DECIDED: OUT, on architecture** | The reference pre-compiled to fill a hole it created by SUPPRESSING the library's stylesheets. This addon is additive (R008 unlayered overlay), so the default theme is **never compiled at all** -- zero-compile beats cache-hit. Pre-compiling would also refetch the ~825 KiB gzip chunk on every story load, destroying ticket 08's lazy split. |
| 5 | Seven premise lines in research/01, two in research/05, one in research/09 | **ALL RESTATED** | Section 7, line by line, each with a durable replacement. |

---

## 1. Method, and the false result it corrected

`prototypes/scaling-curve.mjs` compiles four architectures over the same real
Foundation sources, read from `node_modules/foundation-sites` and
`packages/ngx-foundation-sites/src/scss`, with every synthetic module served from
an in-memory overlay (no repo file written):

| Series | Shape | What it prices |
| --- | --- | --- |
| **A** | SHARED island, N distinct REAL components, ONE compile | The architecture ticket 12 locked (C2/C3) |
| **B** | SHARED island, N emissions of the repo's REAL `_button.scss` `theme()` under distinct selectors, ONE compile | Pessimistic marginal: button was the reference's slowest component, and this uses the real file with its full palette x (fill + hollow) loop -- **no synthetic Sass at all** |
| **C** | PER-COMPONENT island (the file shape this repo uses today), N components, ONE compile | What island DUPLICATION costs -- ticket 12 flagged "one shared island" as `[INFER]` |
| **D** | N SEPARATE compiles of single-component chains | **The reference project's architecture** |

**A false result had to be corrected first, and it is worth recording.** The
first version measured each case in declaration order. It reported that `callout`
(1074 bytes of CSS) cost 191 ms to emit while `card` (553 bytes) cost -1.3 ms --
and the six cases measured *earliest* were uniformly 2-3x more expensive than
identical work measured later. That is ticket 05's documented ~1.7x mid-run
regime shift (V8 tier-up or Snapdragon DVFS) [V-PRIOR: research/05 s2.2],
reproduced as a fake finding.

The fix, and the reason the numbers below are trustworthy: **every case is
measured interleaved** -- one sample of every case per pass, case order shuffled
each pass, two full warm-up passes discarded, median across 7 passes. Drift then
hits every series equally instead of whichever ran first.

**Anchoring, which is what makes the numbers portable.** Absolute Node medians
drifted ~20% between the two runs (real button chain 181.3 ms vs 147.1 ms). Every
figure below is therefore anchored: the real `nfs:/button` chain is measured in
the same interleaved pass and mapped onto ticket 05's **measured** browser-Worker
median of 197.4 ms [V-PRIOR: research/05 s5]. The anchoring cancels the drift --
worker-projected figures agree between runs to within 3%:

```
                      run 1   run 2      run 1    run 2
anchor (Node ms)      181.3   147.1  ->  factor 1.09x / 1.34x
A N=1  (worker ms)    249.9   245.8
A N=31 (worker ms)   1246.0  1214.6
B N=1  (worker ms)    184.9   187.7
```

Worker figures are **projections from a measured anchor**, not direct
measurements -- flagged in section 7.

---

## 2. The measured scaling curve

All figures [V-EXEC, `prototypes/scaling-curve.mjs`], both runs. Node medians
quoted as `run1 / run2`; worker figures are the anchored mean of both runs.

### 2.1 The floor is small, and it grows exactly once

```
=== 4. ISLAND FLOOR (island @used, no component rules emitted) ===
repo's real 3-import shape (util + global + 1 component) | 48.0 / 35.9 ms | 12 fnd files
multi-component-capable (+ sassy-lists + typography)     | 56.1 / 40.6 ms | 24 fnd files
same, with all 31 component partials imported            | 78.9 / 59.2 ms | 55 fnd files
```

Worker-anchored: **~50 ms -> ~58 ms -> ~82 ms**.

Two findings here:

1. **A multi-component island needs Foundation's own dependency preamble, and it
   is nearly free.** The repo's island imports exactly three things
   [V-REPO: `internal/_foundation-button.scss:51-53`]. That shape is **not
   sufficient once a second component's rules are actually EMITTED**: `menu` and
   its relatives call `-zf-each-breakpoint-in()`, which needs sassy-lists'
   `sl-remove()`, and `dropdown-menu` / `tooltip` need `typography/typography`
   (ticket 12 C3 found the latter half). Foundation's own `foundation.scss`
   imports both preambles [V-SRC: `foundation-sites/scss/foundation.scss:9-16`].
   Adding them costs **+8 ms once** and +12 partials, and then never again.
   **This extends ticket 12's C3 complication: it is not only the parity gate's
   fixed three-`@import` island that is button-shaped -- the LIBRARY's island is
   too, and it is under-imported for emission, not merely for compilation.**
2. **Parsing component partials is ~1 ms each.** 31 partials added 22.8 / 18.6 ms
   over the empty island. So source volume -- the thing ticket 12 measured -- is
   *not* what the compile time is made of.

### 2.2 The curve, four architectures (worker-anchored ms)

| N | **A** shared island, real components | **B** N x real button `theme()` | **C** per-component islands | **D** N separate compiles |
| --- | --- | --- | --- | --- |
| 1 | 248 | 186 | 248 | 251 |
| 2 | 323 | 342 | 367 | 390 |
| 3 | 336 | 473 | 413 | 457 |
| 5 | 731 | 728 | 911 | 956 |
| 10 | 932 | 1422 | 1325 | 1517 |
| 20 | 1190 | 2841 | 1791 | 2111 |
| 27-31 | 1230 (N=31) | 4284 (N=31) | 2185 (N=27) | 2572 (N=27) |

Raw Node medians, both runs, for series A and B:

```
=== A. SHARED island, N distinct REAL components, ONE compile ===
  N | run1 ms | run2 ms | css KiB | files | load()
  1 |   229.5 |   183.2 |     9.3 |    28 |    28
  2 |   298.2 |   239.3 |    13.8 |    30 |    30
  3 |   319.7 |   241.0 |    14.2 |    32 |    32
  5 |   670.8 |   545.7 |    15.8 |    36 |    36
 10 |   841.4 |   706.4 |    21.8 |    46 |    46
 20 |  1111.1 |   871.2 |    54.2 |    66 |    66
 31 |  1144.2 |   905.0 |    75.6 |    88 |    88

=== B. N emissions of the REPO'S REAL button theme(), ONE compile ===
  1 |   169.8 |   139.9 |     5.8 |    16 |    16
  2 |   309.7 |   258.2 |    11.6 |    16 |    16
  5 |   689.8 |   525.1 |    28.9 |    16 |    16
 10 |  1316.3 |  1051.0 |    57.8 |    16 |    16
 20 |  2714.5 |  2031.1 |   116.8 |    16 |    16
 31 |  3990.8 |  3145.3 |   181.6 |    16 |    16
```

Series B is **linear** at 100-129 ms per emission (Node), with a constant
16-file closure -- the cleanest possible demonstration that the cost is emission,
not sources.

### 2.3 The curve is ADDITIVE, verified against its own parts

Per-component **emission** cost was measured with the parse floor held constant:
compile the union island (all 31 partials imported) emitting exactly one
component, minus the same island emitting nothing.

```
=== ADDITIVITY CHECK (run 1) ===
floor 78.9 + sum of 31 emission costs 1085.5 = 1164.4 ms predicted
vs 1144.2 ms measured for ONE compile emitting all 31   -> ratio 1.02

=== ADDITIVITY CHECK (run 2) ===
floor 59.2 + 913.5 = 972.7 predicted vs 905.0 measured   -> ratio 1.07
```

**So the curve is `T(N) = floor + sum of per-component emission costs`, to within
2-7%.** No amortisation beyond the floor, and no super-linear blow-up either. It
is additive -- but additive in a term that is nearly zero for most components,
which is the next section and the whole story.

### 2.4 Cost is palette colour math -- not components, not CSS bytes

Emission cost per component (Node ms, `run1 / run2`), sorted:

| Tier | Components | Emission ms | CSS bytes |
| --- | --- | --- | --- |
| **Palette loop** | `button-group` 198/151, `callout` 191/158, `label` 189/143, `button` 173/135, `badge` 173/133 | **133-198** | 479 - 16300 |
| Partial palette | `menu` 74/58, `tabs` 36/31 | 31-74 | 1361 - 4582 |
| Everything else (24) | `visibility` 19/21, `orbit` 16/16, `off-canvas` 9/10, ... `thumbnail` -10/-1 | **-10 .. +21** | 306 - 8945 |

**`off-canvas` emits 8945 bytes for ~10 ms. `badge` emits 479 bytes for
~183 ms (worker).** CSS volume does not predict cost; a factor of 18 in the wrong
direction.

What does predict it, verified at the source [V-SRC, `rg -c` over
`node_modules/foundation-sites/scss/components/`]:

```
components referencing $foundation-palette / color-pick-contrast:
  button 2   callout 2   label 2   badge 2   menu 1   tabs 1
  off-canvas 0   table 0   switch 0   card 0   accordion 0
```

`button-group` shows 0 for that pattern and is still in the top tier because it
loops `$button-palette` x 3 fillings x sizes and calls Foundation's fill/hollow
mixins, which call `color-pick-contrast` internally
[V-SRC: `_button-group.scss:220,232,244`].

> **The durable statement: a theme apply costs one island floor plus one
> palette-x-contrast loop per palette-driven component. Sass colour math is the
> unit of cost -- not the component, not the stylesheet.**

### 2.5 The scaling set is bounded by the CONTROLS, at 19 of 35

The six curated controls are `$foundation-palette` keys plus `$global-radius`
[V-PRIOR: ticket 12 C6]. A component that reads none of them emits identical CSS
for every theme. Counted over Foundation's 35 component partials [V-EXEC]:

```
read $foundation-palette (the map)        :  5  badge button callout label progress-bar
read $global-radius                       : 14  accordion button button-group callout card
                                               dropdown label pagination progress-bar reveal
                                               switch table thumbnail tooltip
read a palette COLOR global directly      : 11  accordion accordion-menu badge breadcrumbs
                                               button drilldown label pagination switch
                                               tabs thumbnail
UNION -- reachable by the six controls    : 19 of 35
```

So even at "all Foundation components supported":

- at most **19** components have anything to emit that the controls change;
- **5** of them (badge, button, callout, label, progress-bar) are in the expensive
  palette-loop tier; `button-group` joins them via `$button-palette`;
- the other 16 partials are **outside the compile**, not merely cheap.

**This bound does not expire.** It follows from what the controls *are* -- and
ticket 12 already established that identity (C6) and closed the control set at
six on merit (C6, C7). If the control set ever grows, the bound is recomputed
from the same one-line sweep, which is why the sweep is recorded here.

### 2.6 The ceiling, and the comparison that matters

Worker-anchored model, from the measured parts:

```
T_worker(N) ~= 58 ms   island floor (multi-component-capable)
             + ~1 ms   per component partial parsed
             + 135-210 ms per PALETTE-DRIVEN component emitted
             + 0-20 ms  per remaining themeable component emitted
```

The 135 ms low end is an **nfs-shaped** `theme()` emitting only palette variants
(series B, measured on the real `_button.scss`); the 210 ms high end is
Foundation's fuller component export mixin (series A).

| Scenario | Worker apply | Source |
| --- | --- | --- |
| **Today: button only** | **197 ms** | [V-PRIOR: research/05 s5, measured] |
| 2 palette-driven components | ~330-410 ms | model |
| 3 palette-driven components | ~470-620 ms | model |
| 31 components emitted (5 of the 6 expensive ones) | **1230 ms** | [V-EXEC, series A N=31] |
| **All 19 themeable components** (all 6 expensive) | **~1.2-1.4 s** | measured 1230 ms + `progress-bar` [INFER] |
| Pessimistic: 31 button-equivalents | 4284 ms | [V-EXEC, series B] |
| **Reference project, TWO components** | **1464-1504 ms** | [V-PRIOR: research/01 C7] |

> **The whole library, under this architecture, still costs less than the
> reference project's two components.** That is the sentence that replaces every
> "this repo has one component" rationale below.

### 2.7 Why the reference's curve does not transfer -- priced, not asserted

Ticket 12 established the architecture (one compile, island served once). This
prices the two alternatives it rules out:

| At N=20 | Worker apply | vs shared-island single compile |
| --- | --- | --- |
| **A** shared island, ONE compile (ticket 12's architecture) | **1190 ms** | -- |
| **C** per-component islands, one compile | 1791 ms | **+50%** (run1 +49%, run2 +52%) |
| **D** N separate compiles (the reference's shape) | 2111 ms | **+77%** (run1 +81%, run2 +74%) |

And a precise mechanism note: `load()` call count equals unique-files-served in
**every** row of every series [V-EXEC], so duplicated islands still fetch each
source exactly once. **The duplication penalty is re-EVALUATION, which no closure
measurement can see.** Ticket 12's `[INFER]` that "a realistic multi-component
architecture keeps one shared island" is now backed by a price for getting it
wrong.

**A structural finding falls out of series C.** A per-component island can hold
only one component partial, so a component that reads a *sibling* component's
globals cannot be islanded alone at all:

```
=== 2. SOLO-ISLAND PREFLIGHT: 27/31 OK ===
  CANNOT be islanded alone -- button-group: Undefined variable.
  CANNOT be islanded alone -- accordion-menu: Undefined mixin.
  CANNOT be islanded alone -- dropdown-menu: Undefined mixin.
  CANNOT be islanded alone -- menu-icon: Undefined variable.
```

This matters for decision 3: the unit a worker pool could schedule is not "a
component" but "a dependency-closed group of components", and 4 of 31 prove the
distinction is real rather than theoretical.

*(Three components could not be emitted through the shared island either --
`progress-bar`, `drilldown`, `slider`, all `Undefined variable` [V-EXEC]. They
need further Foundation preamble this probe did not chase. `progress-bar` is one
of the five palette-driven components, so its emission cost is `[INFER]` at
~135-200 ms by analogy with `label` / `badge`; nothing above depends on it.)*

---

## 3. Decision 1 -- debounce: UNAFFECTED, rationale RESTATED

**Ticket 09 D.1/D.3's "no debounce timer, single-slot latest-wins coalescer"
stands at every N up to and including the library's ceiling.**

### 3.1 Why the decision survives, stated durably

Ticket 09 gave four grounds and one number. **The number was the weakest ground
and is the one to drop.** "At 197 ms per compile a continuous drag settles at
roughly 5 updates per second" [V-PRIOR: research/09 D.3] is an N=1 fact. The
other three are properties of the mechanism and hold at any N:

- **It self-tunes.** The coalescing interval *is* the machine's actual compile
  time. That is what makes it survive N: at 197 ms it emits ~5 Hz, at 1200 ms it
  emits ~0.8 Hz, and at both it emits the newest value each time with no constant
  to re-tune. A 250-300 ms trailing debounce chosen at N=1 would be actively
  wrong at N=19 -- it would fire mid-compile forever.
- **It cannot build a backlog.** One-deep by definition, at any T.
- **Staleness is bounded by T, not by drag length.** The displayed frame is never
  more than one compile behind the pointer.

So the decision is not merely still correct -- **the coalescer is the only one of
the four mitigations that is N-independent by construction**, and that is the
reason to keep it, replacing "197 ms is fast enough".

### 3.2 The threshold where a timer starts to pay

A timer's only possible benefit is *avoiding compiles nobody will look at*. It
never improves latency: a trailing debounce delays the final value by
`debounce + T` instead of `T`, and shows nothing in between.

So the threshold is perceptual, and it is where intermediate frames stop being
actionable:

| Apply duration | Update rate | Verdict |
| --- | --- | --- |
| < 300 ms | > 3 Hz | Live. Coalescer alone. **Today: 197 ms.** |
| 300-1000 ms | 1-3 Hz | Steppy but still feedback. Coalescer alone; the cheaper move is the already-named 50 ms debounce on the globals **write** [V-PRIOR: research/09 D.3]. |
| **> 1000 ms** | **< 1 Hz** | Each intermediate compile finishes for a value the user left over a second ago. **A trailing debounce of ~T pays here.** |

**Measured trigger: the ~6th palette-driven component, or equivalently a measured
apply above 1000 ms.** The library's own ceiling is ~1.2-1.4 s, so this
threshold is *reached at full coverage and never exceeded* -- a debounce is the
last mitigation this architecture could ever need, not the first.

**And past the threshold the coalescer is not replaced.** A debounce is added in
FRONT of it (timer -> coalescer -> worker); the coalescer still guarantees
one-deep and latest-wins for anything that gets through. Ticket 09's mechanism
never becomes wrong, only incomplete.

**Un-debounced `updateGlobals` is unaffected by N.** The channel payload is the
same six scalars at any component count [V-PRIOR: ticket 12 C6], so ticket 09's
named upgrade path (a 50 ms trailing debounce on the write only) neither becomes
more nor less necessary as components land.

---

## 4. Decision 2 -- caching: UNAFFECTED today, rationale CORRECTED, seam named

### 4.1 The asymmetry is real, and bigger than the ticket's 1000x

```
=== I. Cache-hit cost: JSON key + Map.get on the canonical theme ===
0.30 / 0.28 us per hit
asymmetry vs the N=1 worker compile (197.4 ms): ~650,000-715,000x
```

The reference's ~1 ms "cache hit" [V-PRIOR: research/01 C7] was measuring
something else -- its cache was two-level plus IndexedDB, so a hit paid
deserialisation. An in-memory `Map` keyed on the compile input string, with the
canonical-minimal sparse theme as the key material [V-PRIOR: research/09 A.6],
costs **0.3 microseconds**. So the ticket's 1000x understates it by three orders
of magnitude.

### 4.2 The `CACHE_VERSION` liability is STRUCTURALLY excluded, not merely avoided

Ticket 01 T3 flagged the reference's hand-incremented `CACHE_VERSION` (reached
`'v5'`) as a maintenance liability [V-PRIOR: research/01 T3]. The durable rule
that prevents inheriting it:

> **A cache may not outlive the artifact that determines its contents.**

Here that is automatic and free. The compile inputs are (a) the entry string,
which the Worker already builds from `THEMEABLE_MODULES` plus the six canonical
scalars [V-PRIOR: ticket 12 C2], and (b) the generated sources module, which is
**bundled into the same Worker chunk as the cache** [V-PRIOR: research/08 s4.1].
An in-memory `Map` in a Worker instance therefore cannot survive a change to
either: a new build is a new chunk is a new Worker is a new empty `Map`. **There
is nothing to version.**

The `CACHE_VERSION` liability is a property of **persistence**, not of caching.
So the rule to record is narrow and testable: *no cache that outlives the Worker*
-- which rules out IndexedDB, `localStorage` and `sessionStorage`, and rules them
out for a reason that does not expire at N.

### 4.3 What is warranted NOW: nothing. And why that is not the old reason

Tickets 01 and 09 dismissed the LRU as over-engineering "for 6 controls and one
component" [V-PRIOR: research/01 s2.3]. **That reason is void** -- it is a
component-count premise, and the key space argument was never the point anyway
(the key space is six scalars at *any* N; ticket 12 C6 makes that permanent).

The correct reason is a measurement against ticket 09's own locked UX:

> A cache hit can only *save* time the user can perceive. Ticket 09 locked a
> `Compiling...` indicator that appears **only past 300 ms** [V-PRIOR:
> research/09 D.5]. At the measured 197 ms apply, a repeat theme is already
> below the threshold at which the design admits anything is happening. **A cache
> would make an invisible wait invisible.**

So: **no cache today.** The moment it starts paying is exactly the moment a
repeat theme crosses ticket 09's own 300 ms indicator threshold, because then a
recomputation of something already computed *visibly flashes a spinner*.

### 4.4 The threshold and the seam

**Trigger: measured apply > 300 ms -- the 2nd palette-driven component** (model:
~330-410 ms). Caching is therefore the **first** of the reference's four
to earn its place here, and the only one whose trigger is plausibly reachable.

The seam, so that this is a decision and not a deferral:

```
// in the Worker, at the ONE place that already turns an entry string into CSS
const cache = new Map();                      // keyed on the entry string

function compile(entry) {
  const hit = cache.get(entry);
  if (hit) { return hit; }
  const css = sass.compileString(entry, OPTS).css;
  if (cache.size >= 8) { cache.delete(cache.keys().next().value); }
  cache.set(entry, css);
  return css;
}
```

Properties that make this the whole answer, and make it safe to *not* build now:

- **One level, not two.** The reference needed a per-component level *and* a
  combined level because it compiled per component and recombined the results
  [V-PRIOR: research/01 C7]. One compile emits one CSS string, so there is one
  cache key. **The second level returns if and only if the compile is split --
  it is downstream of the pool decision (section 5), never an independent
  choice.**
- **Nothing else in the design has to know.** Not the globals model, not the
  coalescer, not the sequence numbers, not the injection node. The change is
  local to the Worker's request handler, which is why deferring it costs nothing.
- **Cap it, and the cap is why.** At N=1 an entry is 5.8 KiB; at full coverage
  series A emits 75.6 KiB and series B 181.6 KiB per entry [V-EXEC]. An unbounded
  `Map` over a drag would hold megabytes at N. Insertion-order eviction is three
  lines and needs no LRU bookkeeping; a true LRU is warranted only if a
  measurement ever shows eviction thrash, which six scalars make unlikely.
- **`Map`, not LRU, and not `WeakMap`.** Keys are strings.

---

## 5. Decision 3 -- worker pool: UNAFFECTED, the reference's reading PARTLY REFUTED

### 5.1 The reference's 20.5% does NOT generalise -- measured

The ticket asked whether the reference's pool result (1842 -> 1464 ms, 20.5%,
"because the slowest component dominates") argues against a pool even at N>1,
independently of component count. **Confirmed as a bound, refuted as a
conclusion.**

Measured, by LPT-packing the real per-component solo compile costs into P workers
and comparing against the measured shared single compile (this arithmetic
*favours* the pool: it excludes `postMessage`, worker spin-up and CSS
recombination):

```
=== F. POOL arithmetic (run 1 / run 2) ===
  N | shared ONE compile | P=2 wall | P=4 wall | P=8 wall | best gain
  1 |      229.5 / 183.2 | 234/182  | 234/182  | 234/182  | 0.98x / 1.01x
  2 |      298.2 / 239.3 | 234/182  | 234/182  | 234/182  | 1.27x / 1.32x
  5 |      670.8 / 545.7 | 454/365  | 237/193  | 237/193  | 2.83x / 2.83x
 10 |      841.4 / 706.4 | 696/553  | 349/277  | 237/193  | 3.54x / 3.66x
 20 |     1111.1 / 871.2 | 985/780  | 509/405  | 269/213  | 4.14x / 4.09x
```

Reading those rows honestly:

- **At N=1 a pool is exactly nothing.** 0.98x / 1.01x. One synchronous Dart Sass
  compile is indivisible; a pool of one is a Worker. This is the only ground that
  is airtight today, and it is architectural rather than count-based: the apply is
  ONE compile [V-PRIOR: ticket 12 C2].
- **"The slowest component dominates" is TRUE, and sets the pool's ceiling.**
  Every P=8 wall saturates at 182-269 ms = the single slowest solo compile
  (button, 234.5 / 181.8 ms) [V-EXEC]. The reference's mechanism is real.
- **But its 20.5% figure does not transfer.** It measured pool-vs-*sequential*
  inside a per-component-split architecture, with two components in a 2.7:1 cost
  ratio (button 1359-1655 vs accordion 500-570 [V-PRIOR: research/01 C7]) --
  Amdahl caps that case near 26%. With more components the imbalance dilutes and
  the measured gain rises to **4.1x by N=20**. Any argument of the form "a pool
  only buys 20%, so never build one" is unsound and must be removed from the map.

### 5.2 Why no pool, on grounds that do not expire

Three grounds, in order of strength:

1. **There is nothing to parallelise.** The apply is one indivisible compile. A
   pool requires first *splitting* it per component -- which is a different
   architecture, not an optimisation of this one.
2. **The split has a measured price, and it is large.** Per-component islands cost
   **+50%** and separate compiles **+77%** total work at N=20 (section 2.7). So a
   2-worker pool at N=20 would land at 780-985 ms against 871-1111 ms shared --
   roughly break-even. A pool needs **P>=4** to be worth the wiring, and P is not
   ours to choose (`navigator.hardwareConcurrency` on a designer's laptop, inside
   a Storybook preview iframe that is already sharing the machine with the
   manager, the compiler chunk and a webpack dev server).
3. **The split unit is not a component -- and that is structural, not a detail.**
   4 of 31 components cannot be islanded alone at all (`button-group`,
   `accordion-menu`, `dropdown-menu`, `menu-icon`) [V-EXEC, section 2.7]. A pool
   would need a dependency-closed grouping pass over Foundation's Sass, which is
   a whole subsystem. The reference never faced this because its components were
   independent.

Plus the reason none of it is needed: the library's full-coverage apply is
**~1.2-1.4 s**, and the perceptual thresholds that would justify a 2-4x cut sit right
at that ceiling.

### 5.3 The threshold, and the cheaper move to make first

**A pool pays only when ALL THREE hold:**

1. measured apply > **1000 ms** (so a 2-4x cut is perceptible rather than
   cosmetic) -- reached at ~6 palette-driven components;
2. the themeable set partitions into **dependency-closed groups** whose slowest
   group is under half the shared compile (measured ceiling: ~250 ms, so headroom
   exists -- up to ~4.7x at N=20);
3. `P >= 4` is actually available at runtime.

**The lazier move that comes first, named so the pool is not the default
upgrade:** *narrow what recompiles*. Section 2.5 measured that only 19 of 35
components are sensitive to the six controls, and section 2.4 that 5-6 of them
carry ~90% of the cost. A radius-only change does not need the palette-only
components re-emitted. That is a per-control sensitivity map -- data, not
machinery, and derivable by the same one-line sweep recorded here. It is also
exactly what Ant Design Pro's own post-mortem recommended [V-PRIOR: research/01
s4.3, HANDOFF s7 favourable condition 1]. **Try that before a pool.** Neither is
M002 scope.

---

## 6. Decision 4 -- pre-compiling the default theme at init: OUT, on architecture

Never considered by this map; the reference did it so first paint is a cache hit
[V-PRIOR: research/01 C7, `runtime-theme-injector.ts:600-627`]. **Considered here
and declined, on four grounds -- and none of them is "one component exists".**

**1. This addon never compiles the default theme, so there is no first paint to
warm.** The reference had to pre-compile because it *suppressed* the library's
own stylesheets -- a DI swap creating `<link>`s pre-`disabled`, an imperative
sweep disabling `link[id^="nfs-style"]`, and a `MutationObserver` on
`document.head` [V-PRIOR: research/01 C6]. That created an unstyled window it
then had to fill, and gated every story render on `waitForInitialTheme()`
[V-PRIOR: research/01 C9]. **This addon is ADDITIVE**: R008's unlayered output
beats the component's own `@layer nfs-defaults` with no suppression at all,
verified in real Chromium across all four insertion orders [V-PRIOR: research/09
C.2]. Foundation's default theme is *already on screen* as static, compiled,
bundled CSS. **Zero compile beats a cache hit**, and pre-compiling would produce
CSS whose only job is to duplicate what is already rendered.

**2. It would destroy ticket 08's lazy split -- the addon's largest cost
control.** `sass` is imported from the worker module and nowhere else, so the
worker chunk *is* the code-split point and constructing the Worker is what
fetches the ~825 KiB gzip [V-PRIOR: research/08 s5, research/09 D.2]. Ticket 09
made construction lazy *on the first theme change* precisely so a story that
never opens the panel pays nothing. Pre-compiling at init means constructing the
Worker at init means **fetching 825 KiB gzip on every story load** -- a 70%
increase to the preview's initial payload [V-PRIOR: research/05 s6] to
pre-compute CSS nobody needs.

**3. The `loading -> ready` window it would supposedly fix is 1 ms.** Measured
here for the first time -- the panel-init data probe, which reads the six
Foundation-global defaults plus `$wcag-palette` [V-PRIOR: ticket 12 C1/C5]:

```
=== 3. ANCHOR + panel-init probe ===
panel-init DATA probe (no island) : median 1.1 / 0.7 ms | 2 files | css 78 B
```

**~1 ms and two files**, because it touches `internal/_settings.scss` and
`_theme.scss` and *never enters the Foundation island*. Ticket 09's accepted
`loading -> ready` first-panel-open behaviour is therefore not a compile-cost
problem at all; whatever latency it has is chunk fetch, which pre-compiling makes
worse, not better. **Ticket 09's decision is UNAFFECTED and now has a number
behind it.**

**4. It gets MORE wrong as components land, not less.** More components means
more static default CSS already shipped in `@layer nfs-defaults`, so the thing a
pre-compile would duplicate grows; and the pre-compile itself would cost the full
`T(N)` -- up to ~1.4 s of init work for output already on screen.

> **LOCKED: the default theme is NEVER compiled -- not at init, not on demand.
> The addon compiles only non-default themes, and "reset to default" is
> `updateGlobals({ nfsTheme: undefined })` plus clearing the injected node, which
> ticket 09 already specified as having no reset code to write** [V-PRIOR:
> research/09 A.6, HANDOFF s1].

**Answering ticket 12 s6.6 directly:** it noted that the probe compile and a
default-theme pre-compile "are two compiles that could be one". They must NOT be
merged -- there is no default pre-compile to merge with, and merging would drag
the Foundation island into a 1 ms data read, turning it into a ~200 ms one.

---

## 7. Decision 5 -- every "one component" rationale, restated

Ticket 12's sweep found seven premise-carrying lines in research/01, all
performance, all routed here [V-PRIOR: ticket 12 s3]. Re-run and confirmed
verbatim, plus two in research/05 and one in research/09 that decision 5 also
names [V-EXEC, `git grep -n -i`]:

```
research/01:168, :238, :246, :253, :298, :300, :307
research/05:497, :649
research/09:584
```

Each line, and its durable replacement. **Research files are unedited by design
-- these replacements flow into the hand-off.**

| Where | The expiring premise | Durable replacement |
| --- | --- | --- |
| `research/01:168` | The reference's breadth "forced its variable-to-component dependency map, its **per-component** cache-key hashing and its 12 bespoke control widgets" | Accurate about the reference; keep as history. Add the reason it cannot recur here: a per-component cache key presupposes a per-component compile, and one compile emitting N components' rules has exactly one key (ticket 12 C2, section 4.4). |
| `research/01:238` | "**Button was the slow one** (~1.3-1.6 s), and this repo's **only component IS the button**. So a naive implementation here plausibly lands near the reference's worst case" | Button IS the expensive tier -- measured, and for a stated reason: it loops `$foundation-palette` through `color-pick-contrast` [V-SRC]. But the prediction was wrong by ~7x: the real button chain compiles in **197 ms**, not 1.3-1.6 s. **Durable form:** cost is one island floor plus one palette-x-contrast loop per palette-driven component; button is one of six such components in all of Foundation (five read $foundation-palette, plus button-group), and the whole set costs ~1.2-1.4 s. |
| `research/01:246` | "two-level LRU caching, **per-component** and combined" | Keep as a description of the reference. Add: the two levels exist *because* it compiled per component and recombined. One compile means one level; the second returns if and only if the compile is split (section 4.4). |
| `research/01:253` | "Whether it needs a worker at all is ticket 05's measurement to make -- **with one component and a 6-file graph** the number may be much smaller" | Answered and closed: a single Worker is required at any N, because it is about *thread occupancy*, not throughput -- 337 ms of main-thread block becomes a 19.1 ms max frame gap [V-PRIOR: research/05 s5]. That argument gets stronger as the apply lengthens: at ~1.2-1.4 s a main-thread compile would block 72-84 frames. **No component count appears in the reason.** |
| `research/01:298` + `:300` | "The reference went worker-pool-per-component, then measured only a 20.5% end-to-end gain because the slowest component dominates ... **With ONE component** a pool has no parallelism to exploit at all" | **PARTLY REFUTED (section 5.1).** "Slowest dominates" is true and sets the pool's ceiling (~250 ms measured); the 20.5% is an N=2, 2.7:1-imbalance artifact and measured gain reaches 4.1x by N=20. **Durable form:** a pool is out because the apply is ONE indivisible compile; splitting it to create parallelism costs +50-77% measured, and 4 of 31 components cannot be islanded alone. Threshold in section 8. |
| `research/01:307` | "**With 6 controls and one component** the cache key space is tiny; a plain Map may be the whole answer" | The conclusion (a plain `Map`) is right; the reason is void twice over. The key space is six scalars at **any** N (ticket 12 C6), and key-space size was never the question. **Durable form:** one compile means one cache key; an in-memory `Map` in the Worker cannot outlive the sources bundled in the same chunk, so it needs no `CACHE_VERSION`; and it is not warranted until a repeat theme crosses ticket 09's own 300 ms indicator threshold (section 4). |
| `research/05:497` + `:649` | "the reference project's **worker pool** was a throughput optimisation that buys nothing for a **one-component repo**. That stands -- a pool is unnecessary; a single worker is not" | The verdict stands, the reason changes. **Durable form:** a single Worker is required because one compile fully blocks whichever thread runs it; a pool is unnecessary because there is only ever one compile to run. Replace "one-component repo" with "one compile per apply". |
| `research/09:584` | "A pool is not needed. Ticket 01 found the reference project's pool was a throughput optimisation for a **many-component workspace**" | Same correction. The reference's pool existed because its architecture *had* N compiles; ours has one. **"One Worker converts the jank to nothing; a second converts nothing to nothing"** is right at N=1 and wrong as a general claim -- see section 5.1 and the HANDOFF change in section 9. |

---

## 8. The threshold table

The deliverable this ticket exists for: what measurement, not what guess, changes
each decision. **N counts PALETTE-DRIVEN themeable components** (`badge`,
`button`, `callout`, `label`, `progress-bar`, plus `button-group` via
`$button-palette`) -- the radius-only ones cost 0-20 ms each and do not move any
threshold.

| Mitigation | State today | Trigger measurement | Reached at | Why that threshold | Cost when triggered |
| --- | --- | --- | --- | --- | --- |
| **Latest-wins coalescer** | **BUILT** (ticket 09) | -- | -- | N-independent by construction: the coalescing interval IS the compile time | already paid, ~6 lines |
| **Cache** (one level, in-memory, Worker-scoped, capped) | not built | worker apply **> 300 ms** for a *repeat* theme | **2nd** palette component (~330-410 ms) | ticket 09's own `Compiling...` indicator threshold -- past it, recomputing a known theme visibly flashes a spinner | ~3 lines at one call site (section 4.4) |
| **Debounce timer** (in front of the coalescer) | not built | worker apply **> 1000 ms** | **5th-6th** palette component (~980-1170 ms) = full library coverage | below 1 Hz, intermediate frames finish for values the user left over a second ago | `setTimeout` of ~T, one constant to justify |
| **Worker pool** | not built | apply > 1000 ms **AND** a dependency-closed grouping exists whose slowest group < half the shared compile **AND** `P >= 4` | not reached by Foundation's own component set | splitting costs +50-77% measured; pool ceiling is the slowest group (~250 ms measured) | a whole subsystem: split, group, recombine, plus the second cache level |
| **Persistent cache** (IndexedDB / storage) | not built | **never** | -- | it is the only shape that needs a hand-bumped `CACHE_VERSION` (ticket 01 T3); a Worker-scoped cache cannot go stale | rejected, not deferred |
| **Pre-compile default theme at init** | not built | **never** | -- | the default theme is never compiled at all (section 6); it is already on screen as static CSS | rejected, not deferred |
| **Per-component source chunks** (ticket 12 s6.4) | not built | worker chunk growth > ~10% of the `sass` payload it travels with | not reached: ~8% at full coverage | ticket 12 C4's measured bound; the sources arrive with the compiler that needs them | rejected on the numbers, seam is the generated module's shape |
| **Multi-component-capable island preamble** | not built | the **2nd** themeable module lands | 2nd component, *any* tier | required for correctness, not performance: the repo's three-`@import` island cannot EMIT most components (section 2.1) | +8 ms floor, +12 partials, one time |

Two secondary numbers a planner may need:

- **Island floor:** ~50 ms today, ~58 ms multi-component-capable, ~82 ms with all
  31 partials parsed (worker-anchored). ~1 ms per partial parsed.
- **Panel-init data probe:** ~1 ms, 2 files, no Foundation island.

---

## 9. What ticket 11 must change in `HANDOFF.md`

Precise, section by section. Nothing else in the hand-off changes.

**s1 (R009 text), the recompile-policy bullet (`HANDOFF.md:112-116`).** Keep
every clause -- no debounce timer, single-slot latest-wins coalescer, supersede
never cancel, 300 ms indicator, last good CSS survives errors. **Add the
durability clause:** *the coalescer is chosen because its coalescing interval is
the machine's actual compile time, so it self-tunes and needs no re-tuning as
components land; a trailing debounce would be added in FRONT of it, never instead
of it, and only past a measured 1000 ms apply.* Do not let "at 197 ms a timer
adds a magic number" survive as the reason.

**s1, add one bullet: the default theme is never compiled.** *The addon compiles
only non-default themes. Foundation's default theme is already on screen as the
library's static `@layer nfs-defaults` CSS, so there is no first-paint compile,
no pre-compile at init, and no `waitForInitialTheme()`-style readiness gate.* This
is currently implicit in the sparse-globals model and needs to be explicit,
because it is what makes the reference's fourth mitigation inapplicable.

**s3, D035 clause (e) (`HANDOFF.md:393`).** The clause text stands. Its
**Rationale** must lose the pool sentence's generality. Replace any form of "a
pool would convert nothing to nothing" with: *a pool is out because a theme apply
is ONE indivisible compile; creating parallelism means splitting it per
component, which measures +50% (per-component islands) to +77% (separate
compiles) in total work at N=20, and 4 of 31 Foundation components cannot be
islanded alone at all.* Add the threshold row from section 8.

**s3, D035(e) Rationale, cache clause.** Replace "6 controls and one component
make the key space tiny" with: *one compile means one cache key, so the
reference's second (per-component) level has no counterpart here; a cache is not
warranted until a repeat theme crosses the 300 ms indicator threshold this same
decision locks; and any cache must be in-memory and Worker-scoped, because that
is what makes a `CACHE_VERSION` string structurally unnecessary.*

**s7, favourable condition 2 (`HANDOFF.md:715-718`).** The Worker half is
correct and stays. **"One Worker converts the jank to nothing; a pool would
convert nothing to nothing" must go** -- it is false as a general claim (measured
pool gain reaches 4.1x by N=20). Replace with: *one Worker converts the jank to
nothing. A pool has nothing to overlap, because the apply is one compile -- and
the reference's own 20.5% is an N=2 artifact, not a law.* Also add the durable
main-thread argument: at the full-coverage ~1.2-1.4 s apply, a main-thread compile
would block 72-84 frames, so the Worker decision gets stronger with N.

**s7, favourable condition 1.** Ticket 12 C4/C13 already replaced the closure
number. **Add the time bound**, which is the stronger version of "the chain is
already narrow": *a theme apply over every component the six controls can affect
costs ~1.2-1.4 s in the Worker -- less than the reference project needed for two
components -- because only 19 of Foundation's 35 component partials read any of
the six curated globals, and only 5 are in the expensive palette-x-contrast
tier.*

**s7, D020 costing.** Unchanged, and reinforced by a new angle: the payload buys
*evaluating Foundation's real colour functions*, and section 2.4 shows that
colour math IS where the time goes. The single revisit condition ("literal
pass-through values") gets stronger for the same reason.

**s2 (R021 text).** No assertion changes. One addition implied by section 2.1:
**Lane 1 should assert the generated sources module contains the island's
dependency preamble** (sassy-lists + typography) once a second themeable module
lands -- because a missing preamble is not a compile failure, it is an
*emission* failure that only fires when that component's rules are actually
emitted inside the Worker, where the diagnostic degrades [V-PRIOR: research/09
D.7]. Today, with one component, it cannot fire. Record it as a conditional item
rather than a gate.

**s6.2 (fog: behaviour as more `nfs-*` components land).** Ticket 12 rewrote the
architecture half. Add the performance half in one sentence with a pointer:
*apply cost grows by ~135-210 ms per palette-driven component and ~0-20 ms per
other themeable component, ceiling ~1.2-1.4 s at full coverage; the thresholds that
would add a cache, a debounce or a pool are tabulated in research/13 section 8.*

**s8 (not verified).** Add: every browser-Worker figure in research/13 is a
**projection** anchored on ticket 05's measured 197.4 ms, not a direct
measurement; the nfs wrapper modules for 34 of 35 components do not exist, so
series A models them with Foundation's own component export mixins and series B
models them with N emissions of the real `_button.scss`; `progress-bar`'s
emission cost is `[INFER]`.

**s9 (application checklist).** Add one item: *D035(e)'s Rationale carries the
corrected pool and cache reasoning plus research/13's threshold table; no code
is added for any of it.*

**Consider a D038** carrying decision 4 (the default theme is never compiled)
with scope `anti-feature`, alongside ticket 12's proposed D037 for
`$global-text-direction`. It is a considered rejection of a thing the reference
shipped, which is exactly what a register row is for.

---

## 10. VERIFIED vs INFERRED

### VERIFIED by execution or direct source reading, this session

- The compile-time curve is **additive**: floor plus the sum of per-component
  emission costs predicts a single compile emitting all 31 components to within
  **2% (run 1) and 7% (run 2)**.
- The curve is **not floor-dominated in time**, unlike ticket 12's closure: the
  island floor is 21-34% of the cost at N=1 and 5-7% at N=31.
- **Emission cost is bimodal and tracks palette colour math, not CSS volume.**
  Five components cost 133-198 ms (Node) to emit; 24 cost -10 to +21 ms.
  `off-canvas` emits 8945 bytes for ~10 ms; `badge` emits 479 bytes for ~133-173
  ms. The expensive set is exactly the set whose partials reference
  `$foundation-palette` + `color-pick-contrast` (2 hits each for button, callout,
  label, badge), plus `button-group` via `$button-palette` x 3 fillings.
- **Only 19 of Foundation's 35 component partials read any of the six curated
  globals**: 5 read `$foundation-palette`, 14 read `$global-radius`, 11 read a
  palette colour global directly.
- **Island floors:** repo's three-`@import` shape 48.0 / 35.9 ms (12 Foundation
  partials); multi-component-capable, with sassy-lists + typography, 56.1 /
  40.6 ms (24 partials); with all 31 component partials imported and nothing
  emitted, 78.9 / 59.2 ms (55 partials). Parsing a component partial is ~1 ms.
- **The repo's three-`@import` island cannot EMIT most components.** `menu` and
  relatives need sassy-lists' `sl-remove()` via `-zf-each-breakpoint-in()`;
  `dropdown-menu` / `tooltip` need `typography/typography`. Foundation's own
  `foundation.scss` imports both preambles.
- **Per-component islands cost +49% / +52% and N separate compiles +81% / +74%**
  more than one shared-island compile at N=20.
- `load()` call count equals unique-files-served in **every** configuration, so
  duplicated islands still fetch each source once -- **the duplication penalty is
  re-evaluation, invisible to any closure measurement.**
- **4 of 31 components cannot be islanded alone**: `button-group`,
  `accordion-menu`, `dropdown-menu`, `menu-icon`. 3 more cannot be emitted through
  the shared island without further preamble: `progress-bar`, `drilldown`,
  `slider`.
- **Pool arithmetic** (LPT over measured solo costs, excluding all pool overhead,
  so favourable to the pool): gain 0.98x/1.01x at N=1, 1.27x/1.32x at N=2,
  2.83x at N=5, 3.54x/3.66x at N=10, 4.14x/4.09x at N=20. Every P=8 wall
  saturates at the slowest single solo compile (button, 234.5 / 181.8 ms), which
  confirms "the slowest component dominates" as a *ceiling*.
- **Series B is linear**: 100-129 ms (Node) per additional real-`_button.scss`
  emission, with a constant 16-file closure at every N.
- **Panel-init data probe: 1.1 / 0.7 ms, 2 files, 78 bytes of CSS**, and it never
  enters the Foundation island.
- **Cache-hit cost: 0.30 / 0.28 microseconds** for `JSON.stringify(6 scalars)` +
  `Map.get`, i.e. ~650,000-715,000x cheaper than the measured 197.4 ms apply.
- The premise-line sweep: seven hits in research/01 (`:168 :238 :246 :253 :298
  :300 :307`), two in research/05 (`:497 :649`), one in research/09 (`:584`).
- Ticket 05's ~1.7x mid-run regime shift **reproduces**, and it produced a
  false result in the first version of this probe (declaration-order measurement
  made the first six cases 2-3x more expensive). Interleaved + shuffled +
  anchored measurement removes it: worker-projected figures agree between two
  runs to within 3% while raw Node medians drift ~20%.

### INFERRED (reasoned, not executed)

- **Every browser-Worker figure is a projection**, anchored on ticket 05's
  measured 197.4 ms Worker median for the real button chain. Node-to-Worker is
  treated as a single scalar factor, which the two runs support (1.09x and 1.34x
  against drifting Node baselines producing agreeing worker figures) but which is
  not itself measured at N>1.
- **The nfs wrapper modules for 34 of 35 components do not exist**, so their
  emission cost is modelled two ways: Foundation's own component export mixin
  (series A, over-emits relative to an nfs `theme()`) and N emissions of the real
  `_button.scss` (series B, the repo's actual emission shape). The true marginal
  for a future nfs wrapper is bracketed by the two, 135-210 ms worker.
- `progress-bar`'s emission cost (~135-200 ms), by analogy with `label` / `badge`,
  since it could not be emitted through the probe's island.
- The perceptual thresholds -- 300 ms (ticket 09's own locked indicator
  threshold, so internally consistent rather than invented), 500 ms and 1000 ms
  (~1 Hz) -- are judgement calls about when intermediate frames stop being
  actionable. The *measurements* they are applied to are verified; the boundaries
  are not measurable here and no user study exists.
- That a future component's `theme()` emits only palette variants rather than
  Foundation's full component surface. Ticket 12 C2's seam covers the argument
  shape; the emission volume is unknown.
- That `P >= 4` is not reliably available in a Storybook preview iframe on a
  designer's laptop. Reasoned from contention (manager + preview + dev server),
  not measured.
- That an unbounded cache `Map` would matter at N. Reasoned from the measured
  per-entry CSS size (5.8 KiB at N=1, 75.6-181.6 KiB at full coverage).

### CARRIED from tickets 01-12 without re-verification

The 197.4 ms Worker warm median, 556-587 ms cold, 337 ms main-thread block and
19.1 ms max frame gap; the 801-802 KiB gzip `sass` bundle and the +70% preview
figure; the four-producer sha256 identity `49bfb1a2e67bf91a`; ticket 12's closure
bounds (16 files / 84.4 KiB / 24.1 KiB gzip today, 52 / 212.9 / 46.2 at 35
components, 111 / 349.1 / 70.1 at the ceiling) and its floor-dominated closure
finding; ticket 12's C1/C2/C3/C5/C6 corrections (`_theme.scss`,
`THEMEABLE_MODULES`, N entry points, the global-name defaults probe, the six
controls as Foundation globals); the reference project's own measured figures
(~145-150 ms module load, ~177 ms pool init, ~500-570 ms accordion, ~1359-1655 ms
button, 1464-1504 ms two-component apply, ~1 ms cache hit, 1842 -> 1464 ms pool
result, `CACHE_VERSION` at `'v5'`, the three suppression mechanisms and
`waitForInitialTheme()`); ticket 09's locked control surface, sparse
canonical-minimal globals model, injection node, error UX and Worker lifecycle;
ticket 08's build-time inlining and lazy-by-construction worker chunk; R008's
unlayered cascade win in real Chromium; and jsdom discarding `@layer` rules.
