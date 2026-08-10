# Rewrite the theming docs to the new mechanism

Type: task
Status: resolved
Blocked by: 08

## Question

R007 requires a README theming guide, and its recorded proof describes exactly
the two options this effort replaces: "Option 1 precompiled CSS, Option 2 SCSS
`@use ... with (...)` override, plus the `@layer nfs-defaults` cascade
guarantee". After ticket 06 that description is wrong, and a wrong theming guide
is worse than none -- consumers copy it.

Update:

- `packages/ngx-foundation-sites/README.md` -- the Theming section (both consumer
  options, whichever survive), and the RTL/Bidirectional Support section if
  ticket 03 changed the mechanism. Keep the Accessibility and Browser support
  sections honest if anything moved under them.
- **The Accessibility section now has a real disclosure to make**, and it is the most
  important edit in this ticket. Foundation's default theme ships three variants below
  WCAG AA, by user decision, with compliant prebuilt themes deferred to a later
  milestone. State it plainly with the measured ratios rather than burying it: `alert`
  fill and `alert` hollow at 4.498:1 (passing AA-large's 3.0 but not AA's 4.5), and
  `hollow success` at 1.799:1 / `hollow warning` at 1.842:1, which fail both. Say these
  are inherited from Foundation's own palette values, say the default theme is
  deliberately faithful to Foundation, and say a compliant theme is planned. A consumer
  shipping an accessibility-sensitive product needs to be able to find this before they
  ship, not after an audit. Also correct the section's existing claim that default-theme
  pairs "already meet 4.5:1 AA contrast" -- that was true of the variants scanned at the
  time and is not true of the palette added later. Point forward to M002's compliant
  theme as the supported route to AA, so the disclosure comes with a remedy rather than
  just a warning.

  **This disclosure gets more important once M002 lands, not less.** From M002 the axe
  suite runs against the compliant theme, so the test output will read clean while the
  *default* theme still ships the three failures. A reader who checks only CI would draw
  exactly the wrong conclusion. The README is what closes that gap, so write it to stand
  on its own rather than assuming anyone reads the spec.
- `packages/ngx-foundation-sites/src/lib/nfs-button/nfs-button.parity-review.md`
  -- its RTL "no gap" finding rests on the old rtlcss dual-file pipeline
  (D018/S04), which ticket 03 may have replaced. Re-audit that one claim; leave
  the rest of the Material parity review alone.
- JSDoc on NfsButton if its public API changed at all in ticket 09 (the
  `OnDestroy` removal is public-surface visible).
- Storybook autodocs pick up JSDoc automatically, so no separate edit -- but
  confirm the rendered docs page still reads correctly rather than assuming it.

**Exact stale references left for you, located by tickets 08 and 09** -- these are known
wrong, not suspected:

- `README.md:15` -- the install snippet still lists `@angular/common`, which left
  `peerDependencies` in ticket 09 (it was imported only by the two deleted services).
- `README.md:78`, `:121`, `:125` -- still document `NfsStyleLoader`,
  `NfsStyleExtractor` and the `data-nfs-style-id` attribute, all of which no longer exist.
- `nfs-button.parity-review.md:51` -- cites the deleted `nfs-button.styles.ts`.
- **The consumer theming path changed**, and this is the breaking one:
  `ngx-foundation-sites/scss/nfs-button` -> **`ngx-foundation-sites/scss/button`**, and the
  API changed from `@use ... with (...)` to `@include nfs-button.theme(...)`. Forced by a
  Sass module loop, not a preference. Document the new form and note the old one is gone.
- Internals moved under `scss/internal/`. Say plainly that this is a **signalling
  boundary, not an enforced one**: `.../scss/internal/foundation-button` still resolves,
  because M002 must be able to fetch and compile the source. Consumers should treat
  anything under `internal/` as unsupported.

**Corrected accessibility numbers from ticket 10 -- use these, not the earlier
prediction.** Axe's actual, gated set is **three** failures, not four:

| variant | pairing | ratio |
|---|---|---|
| `alert` fill | `#fefefe` on `#cc4b37` | 4.49 -- fails AA, passes AA-large |
| `hollow success` | `#3adb76` on the page background | 1.81 -- fails both |
| `hollow warning` | `#ffae00` on the page background | 1.85 -- fails both |

**`hollow alert` passes, and why it does is itself a docs obligation.** A hollow button pairs
its text against the **page background**, which this library does not control -- it ships no
global styles. On a pure-white page `#cc4b37` is 4.537 and passes; on Foundation's own
`#fefefe` body background it is 4.498 and fails. So **hollow-variant contrast depends on the
consumer's page background**, and a consumer who imports Foundation's global styles gets a
different answer from one who does not. Say this explicitly: it is the difference between a
consumer thinking they are compliant and actually being so, and it is not discoverable from
the palette alone.

**Two deviations from stock Foundation that a theming guide must disclose:**

1. `$palette` **merges** over the defaults (ticket 09), so overriding one colour keeps the
   rest -- document that, since the naive expectation is replacement.
2. NfsButton's default hover is **-20%**, whereas stock Foundation's zero-config
   `.button:hover` is **-15%**. Foundation 6.9.0 contradicts itself upstream
   (`components/_button.scss:36` vs `:77`); NfsButton follows Foundation's `auto` path.
   This is a recorded, gate-pinned deviation and belongs in the docs rather than being
   left for a consumer to discover by eye.

Also write down, for the user, the migration note a consumer of the current
published shape would need: `NfsStyleLoader` and `NfsStyleExtractor` leave the
public API in ticket 09, and the theming entry point has moved.

## Answer

Five commits on `feat/scss-only-button-styling`. `lint`, `compodoc` (R007's gate) and
`build-storybook` all exit 0 on the committed state.

**README.md** -- Theming rewritten around the shipped mixin API with an argument table and
real defaults; new sections for precompiled CSS, `scss/internal/` as a signalling boundary,
migration from the previously published shape, and deviations from stock Foundation (the
-20% vs -15% hover with its upstream `_button.scss:36` vs `:77` contradiction). Install
snippet no longer lists `@angular/common`. SSR section rewritten onto Angular's own
`<style ng-app-id>` emission and identity-based adoption.

**Accessibility section** -- the priority edit. The old "all meet 4.5:1" claim is replaced by
the three real failures (`alert` fill 4.498; `hollow success` 1.799; `hollow warning` 1.842),
stated as inherited from Foundation with the default theme deliberately faithful; the passing
values including `secondary` at 4.504 flagged as fragile; the planned compliant theme as the
remedy with interim palette values; a subsection on hollow contrast depending on the
**consumer's page background**; and -- unprompted and well judged -- an explicit "a green CI
run is not a clean bill of health" note for the post-M002 trap this map identified.

**Browser support** -- corrected from the rolling query to the pinned
`baseline widely available on 2026-05-07`, 136 targets.

**`nfs-button.parity-review.md`** -- only the RTL claim re-audited, as scoped. Verdict
unchanged (no gap) but now resting on the cross-engine gate rather than a mirrored artifact.
It also caught a pre-existing README error: `.button.expanded` emits physical-but-zero
`margin-left/right: 0`, not `margin-inline: 0` as previously documented.

**JSDoc needed no change, and that is a finding rather than a skip** -- `ngOnDestroy`'s doc
comment left with the method in ticket 09, and the class-level JSDoc never named any deleted
symbol. Confirmed against the generated compodoc page.

**Autodocs verified by rendering, not assumed** -- served the static Storybook build and
drove `/?path=/docs/nfsbutton--docs` in Chromium: description, ArgTypes table and all 14
stories render with zero console errors.

### Stale-reference sweep

`git grep` across tracked files for `NfsStyleLoader`, `NfsStyleExtractor`,
`nfs-button.styles`, `data-nfs-style-id`, `scss/nfs-button`, `nfs-button.rtl.css`,
`NFS_BUTTON_STYLE` returns 10 hits, **every one a deliberate historical or migration
reference**. No surviving statement claims a deleted artifact exists.

### Two defects requiring code, deliberately not fixed here

Both handed to ticket 15:

1. **The published `exports` map blocks the documented subpaths.** ng-packagr generates only
   `"."` and `"./package.json"`, so an `exports`-compliant resolver rejects
   `ngx-foundation-sites/scss/button`. Verified against the Verdaccio-installed copy:
   `ERR_PACKAGE_PATH_NOT_EXPORTED`. **Theming works today only because Angular's Sass importer
   resolves through node_modules load paths rather than `exports`** -- which is why the demo
   app and its four-host e2e are green. The documented public API is therefore addressable by
   accident, not by declaration.
2. **Storybook autodocs shows no input descriptions, types or defaults** -- `color` renders as
   `string`, every other input as `-`. Both Storybook targets set `compodoc: false`, so no
   docgen JSON exists for the Angular renderer. **Every input JSDoc is invisible in autodocs**,
   which makes R007's recorded proof ("Storybook autodocs renders the same JSDoc") partly
   false. Pre-existing and orthogonal to this ticket, but R007 is a validated requirement.
