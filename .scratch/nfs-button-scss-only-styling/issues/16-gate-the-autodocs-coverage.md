# Gate the autodocs coverage, and remove the duplicated component description

Type: task
Status: resolved
Blocked by: 15

## Question

Two small items ticket 15 fixed-but-did-not-secure. Both are cheap; the first matters more
than its size suggests.

### 1. Nothing stops the autodocs ArgTypes table going empty again

Ticket 15 made every `NfsButton` input render its description, type and default in Storybook
autodocs, satisfying R007. But nothing gates it. `test-storybook` fails only on browser
console errors, and this defect produced none -- the table was empty on a **green build**, and
would be again if `compodoc: true`, the pinned `compodocArgs` tsconfig, or
`preview.ts`'s `setCompodocJson` call regressed independently.

**This is the fifth time this effort has found a gate that asserts a shape rather than a
behaviour**, after R004's RTL spec, `verify-parity.mjs`, the registry-consumption needle, and
the axe palette coverage. Every one of them passed indefinitely after the thing it was meant
to protect had moved. Closing this one is consistent with the rest of the map rather than an
extra.

Add a check over the generated `documentation.json` -- roughly 20 lines -- wired as a
dependency of `test-storybook` (and ideally of `build-storybook`, since that is what produces
the artifact). It must fail if:

- `documentation.json` is missing, or
- `components` is empty, or `NfsButton` is absent from it, or
- `NfsButton`'s documented inputs do not cover all six (`color`, `hollow`, `size`,
  `expanded`, `dropdown`, `disabled`), or
- any of those inputs has an empty description.

Assert against the **generated artifact**, not against a rendered page -- a headless render
per build would be disproportionate, and the artifact is the actual failure point. Note
`documentation.json` is gitignored, so the check must run after the docgen step rather than
assuming a committed file.

Keep the failure message specific enough to diagnose without reading this ticket: name which
of the three moving parts (`compodoc` flag, `compodocArgs` tsconfig, `setCompodocJson`) is the
likely cause.

### 2. The hard-coded component description is redundant and has drifted

`nfs-button.stories.ts` sets `parameters.docs.description.component`. Since ticket 15 wired
docgen, the class JSDoc now supplies that description, so the hard-coded copy is duplicate
prose with two sources of truth -- **and it has already drifted**: it lists `expanded` and
`dropdown` where the class JSDoc does not.

Delete the hard-coded parameter and widen the class JSDoc so nothing is lost from the rendered
page. Then confirm by rendering (as ticket 15 did) that the docs page still shows a complete,
accurate component description. If deleting it visibly degrades the page, keep it and say why
instead -- the goal is one accurate source, not fewer lines for their own sake.

## Answer

Two commits. All verifications pass: `lint`, `test` 43/43, `build-storybook`,
`test-storybook` 17/17, `compodoc`, and the new `verify-autodocs-coverage`.

### The gate

`packages/ngx-foundation-sites/scripts/verify-autodocs-coverage.mjs`, following
`verify-foundation-parity.mjs`'s accumulate-then-report-then-`exit(1)` convention. Wiring: a
new `verify-autodocs-coverage` target that `dependsOn: ["build-storybook"]` -- since
`build-storybook` is what *produces* `documentation.json`, the check cannot be its dependency
and must depend on it instead -- and `test-storybook` now depends on the gate rather than
directly on the build, so it reaches the build *through* it.

**A cache-correctness bug found on the way:** `documentation.json` was missing from
`build-storybook`'s `outputs`, so a warm cache would restore `dist/storybook/**` but not the
artifact, and the gate would fail spuriously. Added, and proven by deleting the artifact and
confirming a cache hit restores it.

Two assertions beyond the ticket's list, both justified: the component-level description must
be non-empty (item 2 made the class JSDoc its only source), and `.storybook/preview.ts` must
call `setCompodocJson(`. That last one is a source-shape check, marked `ponytail:` in the
header as the weakest assertion here -- necessarily, because that moving part leaves **no trace
in the artifact**: a perfect `documentation.json` feeds an empty table when the wire is cut.

### Proven by breaking all three moving parts

| regression | observed |
|---|---|
| `compodocArgs` `-p` repointed at `.storybook/tsconfig.json` | `documentation.json documents zero components`; diagnosis names the tsconfig pin and the `components: []` mechanism. Exit 1. |
| `setCompodocJson` removed from `preview.ts` | `preview.ts does not call setCompodocJson`; diagnosis names `globalThis.__STORYBOOK_COMPODOC_JSON__` and the all-`-` table. Exit 1. |
| `compodoc: false` + artifact deleted | **`build-storybook` itself fails first** -- webpack cannot resolve `preview.ts`'s import of the artifact -- so the regression is caught harder than by the gate. Run standalone, the gate reports the missing artifact and names the flag. |

The three artifact-content branches were also exercised by mutating the generated JSON
(dropping `expanded`, blanking a description, blanking the class description); all fired with
the right per-failure diagnosis.

**Honest limitation recorded:** `compodoc: false` with a *stale* `documentation.json` still on
disk passes the gate. That state is populated-but-stale rather than empty -- a lesser defect
than the one ticket 15 found -- and in any clean tree or CI the `preview.ts` import turns it
into a hard build failure. A config-level `compodoc: true` assertion was deliberately not
added, since it would duplicate config into the gate to catch a local-dev-only false pass.

### Item 2

`parameters.docs.description.component` deleted (the whole `parameters` block held nothing
else) and the class JSDoc widened to name all six variants. **The rendered description survived
byte-identical** -- verified on a served static build in Chromium: both paragraphs render, all
six ArgTypes rows keep description, type and default, `focus()` documented, 16 story sections
present, **0 console messages and 0 page errors**.
