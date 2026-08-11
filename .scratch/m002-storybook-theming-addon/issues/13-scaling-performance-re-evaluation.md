# Re-evaluate the performance decisions against N components

Type: research
Status: resolved
Blocked by: 12

**Ticket 12 has resolved and ANSWERED this ticket's blocking question**, which
reframes the whole re-evaluation: a theme apply is **ONE compile emitting N
components' rules**, not N compiles. Verified -- one compile over two themeable
modules emits both selectors and serves the Foundation `@import` island **once**
(13 partials, not 26), and the shared `util/` + `_global` floor is 12 of those
13 partials, so per-component marginal cost is roughly one file.

So **the reference's additive per-component curve does NOT transfer**, and its
four mitigations must be re-derived rather than inherited. But note the reason
has changed: they do not transfer because of the *compile architecture*, a
durable property -- NOT because "this repo has one component", which is the
expiring premise this correction pass exists to remove. Do not let the right
answer keep the wrong reason.

## Question

Every performance decision on this map was made against a **single** compile of
a **single** component's chain: 280-305 ms warm on the main thread, 197 ms in a
Worker. Those numbers, and the decisions resting on them, are a snapshot of
N=1. Re-evaluate them now that all Foundation components are in the library's
future.

**The reference project already ran this experiment, and ticket 01 recorded its
numbers** (`research/01-*.md` section C7). At **two** components it measured:

| Stage | Cost |
| --- | --- |
| Dart Sass module load | ~145-150 ms |
| Worker pool init | ~177 ms |
| accordion compile | ~500-570 ms |
| button compile | ~1359-1655 ms |
| Full 2-component theme apply | ~1464-1504 ms |
| In-memory cache hit | ~1 ms |

And it needed **four stacked mitigations** to make that tolerable: a 300 ms
input debounce, compile coalescing, two-level LRU caching (per-component *and*
combined), and pre-compiling the default theme at init so first paint is a cache
hit.

This map decided, at N=1: **no debounce timer**, **no cache**, a **single
Worker**, and **no pool** -- each partly justified on the repo having one
component. Note also that Button was the reference's *slowest* component, and
Button is what this repo has.

### What to decide

1. **Debounce.** Ticket 09 locked a latest-wins coalescer with **no debounce
   timer**, reasoning that at 197 ms a timer adds a magic number without
   benefit. Does that survive when a theme apply spans N chains? State the
   threshold at which a timer starts to pay, and whether the coalescer alone
   still degrades gracefully past it.
2. **Caching.** Tickets 01 and 09 dismissed the reference's two-level LRU as
   over-engineering for "6 controls and one component", suggesting a plain `Map`
   may be the whole answer. Re-examine. The reference's ~1 ms cache hit against
   a ~1.5 s apply is a 1000x asymmetry, and the *combined* level exists
   precisely because per-component results recombine. Decide what is warranted
   NOW and what the seam looks like -- and note ticket 01 flagged the
   reference's manually-incremented `CACHE_VERSION` as a maintenance liability
   (T3), so a cache that ships must not inherit that.
3. **Worker: single, pool, or seam?** The reference's pool returned only a 20.5%
   end-to-end gain (1842 ms -> 1464 ms) because the slowest component dominates
   -- a real result that argues against a pool even at N>1, independently of
   component count. Confirm or refute that reading. **Do not build a pool**
   unless the evidence demands it; the deliverable is the correct rationale plus
   a seam, not machinery.
4. **Pre-compiling the default theme at init.** Never considered by this map.
   The reference did it so first paint is a cache hit. Weigh it against ticket
   09's locked `loading -> ready` first-panel-open behaviour, which is currently
   accepted as by-design.
5. **Restate every rationale that says "one component".** Tickets 01, 05 and 09
   each justify a choice on the repo having one component. Even where the
   *decision* stands, the *reason* must become durable -- "one component exists
   today, and here is the threshold that changes it" -- so a future reader knows
   when to revisit rather than inheriting a stale premise as settled.

### Bound the scaling law

Give the planner something to reason with: how does a theme apply scale as
components land -- linear in chains, dominated by the slowest, or amortised by
Foundation's shared `@import` island being compiled once? Ticket 05's harness
(`../prototypes/`) can measure a multi-entry compile today by compiling the
button chain alongside a second Foundation component's chain directly from
`node_modules/foundation-sites/scss`, without any nfs wrapper existing. **Do
that measurement rather than extrapolating** -- this map's value has been that
its claims were executed.

## Notes

Blocked by 12 because the scaling law depends on the compile architecture 12
settles: one compile emitting N components' rules is a different curve from N
compiles.

The bar is NOT to make M002 fast at N components -- there is one component to
build against, and speculative machinery is still rejected. The bar is that no
decision here rests on a premise that expires, and that the thresholds which
would change each decision are written down.

Do not edit `research/*.md` -- those record what was found at the time.
Corrections live in your findings and flow into the hand-off.

## Answer

**Resolved AFK. Full findings: [`research/13-scaling-performance-re-evaluation.md`](../research/13-scaling-performance-re-evaluation.md).**
New probe: `prototypes/scaling-curve.mjs`; raw output `prototypes/run-scaling.txt`
and `run-scaling-2.txt` (two independent runs, every ratio reproduced).

**All four performance decisions SURVIVE. Three of the four rationales do not,
and are replaced with measured thresholds.** No machinery was built.

### The measured curve

Four architectures compiled and timed over the same real Foundation sources,
interleaved and shuffled (a first, declaration-order version reproduced ticket
05's ~1.7x regime shift as a *fake* finding -- recorded in section 1), anchored on
ticket 05's measured 197.4 ms Worker median. Worker figures, mean of both runs:

| N | A: shared island, one compile (ticket 12's architecture) | B: N x the real button `theme()` | C: per-component islands | D: N separate compiles (the reference's shape) |
| --- | --- | --- | --- | --- |
| 1 | 248 | 186 | 248 | 251 |
| 2 | 323 | 342 | 367 | 390 |
| 5 | 731 | 728 | 911 | 956 |
| 10 | 932 | 1422 | 1325 | 1517 |
| 20 | 1190 | 2841 | 1791 | 2111 |
| 31 | **1230** | 4284 | 2185 (N=27) | 2572 (N=27) |

**Shape: ADDITIVE in emitted components, not floor-dominated.** Floor plus the
sum of per-component emission costs predicts the all-31 compile to within 2% and
7% across the two runs. Ticket 12's *closure* is floor-dominated; **time is not**,
and inferring one from the other would have been wrong.

**But the additive term is near zero for most components.** Cost tracks
palette-driven colour math, not components and not CSS volume: five components
measured 133-198 ms each to emit, two more 31-74 ms, the remaining 24 at -10 to
+21 ms. `off-canvas` emits **8945 bytes for ~10 ms**; `badge` emits **479 bytes
for ~133-173 ms**. The expensive ones are exactly those looping
`$foundation-palette` (or `$button-palette`) through `color-pick-contrast`.

**So the scaling set is bounded by the CONTROLS, not the component count** --
durable, because ticket 12 C6 established that the six controls ARE Foundation
globals. Only **19 of Foundation's 35** component partials read any of them; the
expensive tier is **6**. The other 16 emit byte-identical CSS for every theme --
outside the compile, not merely cheap.

```
T_worker(N) ~= 58 ms island floor + ~1 ms per partial parsed
             + 135-210 ms per PALETTE-DRIVEN component emitted
             + 0-20 ms per remaining themeable component
```

**The ceiling is the headline:**

> A theme apply over EVERY component the six controls can affect costs
> **~1.2-1.4 s** -- still LESS than the reference project needed for **TWO**
> components (1464-1504 ms).

Two more measured results: per-component islands cost **+50%** and separate
compiles **+77%** over one shared-island compile at N=20 (so the reference's
curve does not transfer, priced rather than asserted); and `load()` count equals
unique-files-served in every configuration, so **the duplication penalty is
re-evaluation, invisible to any closure measurement.**

### The five decisions

1. **Debounce -- UNAFFECTED, rationale RESTATED.** Ticket 09's "at 197 ms a timer
   is a magic number" is an N=1 fact and must be dropped. The durable ground is
   that the coalescing interval IS the machine's compile time, so it self-tunes at
   any N -- a 250-300 ms constant picked today would fire mid-compile forever at
   N=19. Threshold: a trailing debounce pays past **1000 ms** (below 1 Hz,
   intermediate frames finish for values the user left a second ago) -- the 5th-6th
   palette component, i.e. reached only at full library coverage. Past it the
   coalescer is **not replaced**; a timer goes in FRONT of it.
2. **Caching -- UNAFFECTED today, rationale CORRECTED, seam named.** "6 controls
   and one component make the key space tiny" is void twice over: the key space is
   six scalars at *any* N, and size was never the question. The right reason is
   ticket 09's own locked 300 ms indicator threshold -- at 197 ms a cache makes an
   invisible wait invisible. Measured hit cost **0.3 microseconds** (~700,000x, not
   1000x). Threshold: the **2nd** palette-driven component (~330-410 ms), which
   makes caching the first mitigation to earn its place. Seam: a 3-line memo at the
   single Worker call site, capped, keyed on the entry string. **The
   `CACHE_VERSION` liability is structurally excluded**, on a rule that does not
   expire: *a cache may not outlive the artifact that determines its contents* --
   the sources are bundled in the same Worker chunk as the cache, so a new build is
   a new empty Map. That rules out IndexedDB/storage permanently. **One level, not
   two**: the reference's per-component level presupposes a per-component compile,
   so it is downstream of the pool decision, never an independent choice.
3. **Worker pool -- decision UNAFFECTED, the reference's reading PARTLY REFUTED.**
   Measured pool gain (LPT over real solo costs, excluding all pool overhead, so
   favourable to the pool): 0.98x at N=1, **1.3x at N=2, 2.8x at N=5, 4.1x at
   N=20**. So the 20.5% figure is an N=2, 2.7:1-imbalance artifact and **must not
   survive as a general law**; "the slowest component dominates" is true but only
   sets the pool's *ceiling* (every P=8 wall saturates at the slowest solo compile,
   ~250 ms). No pool, on three grounds that do not expire: the apply is ONE
   indivisible compile; creating parallelism means splitting it, which costs
   +50-77% measured; and **4 of 31 components cannot be islanded alone at all**
   (`button-group`, `accordion-menu`, `dropdown-menu`, `menu-icon`) -- so the split
   unit is a dependency-closed group, not a component. Threshold needs all three of:
   apply > 1000 ms, a valid grouping, and P >= 4. **The lazier move named first:**
   narrow what recompiles, using the 19-of-35 sensitivity map already measured.
4. **Pre-compiling the default theme at init -- DECIDED: OUT, on architecture.**
   The reference pre-compiled to fill a hole it created by *suppressing* the
   library's stylesheets (DI swap + disable sweep + MutationObserver). This addon is
   **additive** -- R008's unlayered overlay -- so Foundation's default theme is
   already on screen as static bundled CSS and is **never compiled at all**.
   Zero-compile beats cache-hit. It would also construct the Worker at init,
   fetching ~825 KiB gzip on every story load and destroying ticket 08's lazy
   split. And the `loading -> ready` window it would supposedly fix is **1 ms**:
   the panel-init data probe measured 1.1 / 0.7 ms over 2 files, never entering the
   Foundation island -- so ticket 09's accepted behaviour is UNAFFECTED and now has
   a number. Answering ticket 12 s6.6 directly: the probe and a default pre-compile
   must **not** be merged -- there is no default pre-compile, and merging would drag
   the island into a 1 ms data read.
5. **Every "one component" rationale restated** -- all ten lines, individually,
   with durable replacements: `research/01:168, :238, :246, :253, :298, :300, :307`,
   `research/05:497, :649`, `research/09:584`. Notables: `01:238`'s prediction that
   this repo "plausibly lands near the reference's worst case" was **wrong by ~7x**
   (197 ms, not 1.3-1.6 s); `05:497`'s "one-component repo" becomes "one compile per
   apply"; and `09:584`'s "a second Worker converts nothing to nothing" is right at
   N=1 but false as stated.

### Threshold table (full version in section 8)

| Mitigation | Trigger | Reached at |
| --- | --- | --- |
| Cache (one level, in-memory, Worker-scoped, capped) | apply > **300 ms** for a repeat theme | **2nd** palette component |
| Debounce timer, in front of the coalescer | apply > **1000 ms** | **5th-6th** palette component = full coverage |
| Worker pool | apply > 1000 ms **AND** dependency-closed grouping **AND** P >= 4 | not reached by Foundation's own set |
| Persistent cache / pre-compiled default theme | **never** -- rejected, not deferred | -- |
| Multi-component-capable island preamble | the 2nd themeable module | 2nd component, any tier (correctness, +8 ms once) |

### One correctness finding worth flagging

The repo's three-`@import` island shape is **under-imported for EMISSION**, not
just for compilation (extending ticket 12's C3 complication from the parity gate
to the library itself): `menu` and relatives need sassy-lists' `sl-remove()` via
`-zf-each-breakpoint-in()`, and `dropdown-menu` / `tooltip` need
`typography/typography`. Foundation's own `foundation.scss` imports both
preambles. Cost to fix: **+8 ms of floor, once**. It fails only when a second
component's rules are actually emitted, inside the Worker where the diagnostic
degrades -- so it is invisible today.

### For ticket 11 (details in section 9)

`HANDOFF.md` s1 (recompile policy gains the self-tuning clause; new bullet: the
default theme is never compiled), s3 D035(e) Rationale (pool and cache reasoning
replaced), **s7 favourable condition 2 must lose "a pool would convert nothing to
nothing"** -- false as a general claim, s7 favourable condition 1 gains the
~1.2-1.4 s time bound, s2 gains a conditional preamble assertion, s6.2 gains the
performance half, s8 gains the projection caveat, s9 gains one checklist item, and
a candidate **D038** records decision 4 as an `anti-feature` alongside ticket 12's
proposed D037.
