# Delete the CSS-in-JS path and re-anchor the proofs that depended on it

Type: task
Status: resolved
Blocked by: 08

## Question

Remove the second, drift-prone styling path entirely. R026 names all three
artifacts, so all three go:

- `packages/ngx-foundation-sites/src/lib/nfs-button/nfs-button.styles.ts`
- `packages/ngx-foundation-sites/src/lib/nfs-style-loader.ts` + `nfs-style-loader.spec.ts`
- `packages/ngx-foundation-sites/src/lib/nfs-style-extractor.ts` + `nfs-style-extractor.spec.ts`

Plus everything that reaches into them, which is the part that will bite:

- `nfs-button.ts` -- the `NFS_BUTTON_STYLE_ID` constant, both service
  injections, the constructor `extractStyles`/`load` calls, and the `OnDestroy`
  implementation whose only job is `unload`.
- `packages/ngx-foundation-sites/src/index.ts` -- drop the removed public
  exports, and note this is a breaking change to the package's public API.
- `packages/ngx-foundation-sites/src/scss/verify-parity.mjs` -- its entire
  contract is "every Foundation-matching selector in `nfs-button.styles.ts` is
  present in the precompiled CSS". With `nfs-button.styles.ts` gone the script is
  either deleted or repointed at a real target: comparing the compiled output
  against Foundation's own compiled button CSS, which would be a genuinely
  stronger D017 parity check. Decide which, and say why.
  **Trap established by ticket 14:** if the replacement asserts contrast behaviour,
  assert the **picked colour, not the ratio**. Foundation's `color-luminance` uses a
  hand-rolled `pow()` (`scss/util/_math.scss:33-54`) that does not converge for small
  inputs, inflating linearised channels 11..52 by up to 6.73x. Picks are stable across
  every independent implementation (5/5); ratios are not (`primary` vs `#0a0a0a`:
  Foundation 4.3, true 4.224). Ticket 14's ground-truth table is the fixture. Roughly
  15 lines of WCAG luminance/ratio plus Foundation's quantise-and-tie rule is enough --
  `@material/material-color-utilities` has the right primitives but its 0.4.0 barrel is
  broken under Node ESM, so it is not worth the dependency.
  **Trap established by ticket 01:** any such check must compare *parsed* CSS, not
  text. `SharedStylesHost` passes styles through verbatim but the build does not --
  dev reformats and prepends an `/* angular:styles/component:css;<hash>;<path> */`
  marker, and production minifies (`rgb(9, 8, 7)` becomes `#090807`). A `toBe` or
  substring assertion against hand-written CSS will fail for reasons unrelated to
  parity. Compare declarations via a CSS parser, or compare Sass output to Sass
  output and never to the shipped bundle.
- `nfs-button.spec.ts` -- the ref-counting tests asserting zero leaked
  `style[data-nfs-style-id="nfs-button"]` elements after destruction (R005's
  proof) must be rewritten against Angular's own SharedStylesHost behaviour as
  established in ticket 01, not deleted. R005 loses its evidence otherwise.
- `nfs-button.ssr.spec.ts` -- assertions about the inlined
  `style[data-nfs-critical-css]` block (R018's proof) must be re-anchored to
  Angular's `ng-app-id` server-emitted styles.
- `nfs-button.hydration-modes.browser.spec.ts` -- check for the same coupling.

**Two small additions carried in from ticket 08**, both in code you are already
touching:

1. **Make `$palette` merge rather than replace.** As shipped it is a whole-palette
   replace, so a consumer overriding only `success` silently loses `secondary`,
   `warning` and `alert` unless they restate all four. A `map.merge` against the
   defaults is a one-line change, strictly friendlier, and still serves M002's
   compliant theme, which passes the whole palette anyway. Do this rather than
   documenting a sharp edge in ticket 11.
2. **`verify-parity.mjs` must be replaced, not ported.** Ticket 08 found a real bug the
   old script structurally could not catch: `.button.hollow` was shipping the solid
   primary fill because the SCSS included `button-hollow-style` but never
   `button-hollow`. The script compares *selectors*, not *declarations*, so the two
   styling paths disagreed silently. Whatever replaces it must compare declarations.

R005 and R018 are both *validated* requirements whose recorded proof cites the
deleted services by name. Their coverage must survive this ticket, re-anchored to
the framework's own mechanism. Report the new proof wording for both to the user
-- `.gsd/` is read-only, so it cannot be updated from here.

## Answer

Complete on `feat/scss-only-button-styling`, four commits, **all five gates green**:
lint exit 0, `test` **43/43**, `test-browser` **2/2**, `build` exit 0, `build-storybook`
exit 0, zero Sass deprecation warnings. The count moved 59 -> 43: minus the two deleted
service specs and the CSS-in-JS-coupled describes, plus six new proofs.

The deletion and the proof re-anchoring were committed **together**, deliberately -- they
are inseparable, and splitting them would leave a bisectable red commit.

Published `.d.ts` now exports exactly `NfsButton` and `Placeholder`, with no `OnDestroy`
and zero occurrences of the deleted symbols in the emitted JS, types or SCSS.

### R005's proof, re-anchored

`nfs-button.spec.ts`, `describe('SharedStylesHost stylesheet lifecycle (R005)')` --
four tests replaying ticket 01's observed sequence. The load-bearing assertion is
`isConnected`, which is what distinguishes a genuine `element.remove()` at usage `<= 0`
from a merely decremented counter:

```ts
expect(styleElements).toHaveLength(1);
expect(styleElements[0]).toBe(firstStyleElement);   // two instances, one node
fixtureA.destroy();
expect(nfsDefaultsStyleElements()).toHaveLength(1);
expect(styleElement.isConnected).toBe(true);        // still attached
fixtureB.destroy();
expect(nfsDefaultsStyleElements()).toHaveLength(0);
expect(styleElement.isConnected).toBe(false);       // real removal
```

### R018's proof, re-anchored

`nfs-button.ssr.spec.ts`, with `APP_ID` pinned to `'nfs-button-ssr-app'` so the id can be
asserted exactly -- ticket 01 named an `APP_ID` mismatch as adoption's sole residual risk,
so pinning it converts that risk into a covered case:

```ts
expect(styleElements[0].getAttribute('ng-app-id')).toBe(SSR_APP_ID);  // server
expect(doc.head.querySelectorAll('style')).toHaveLength(1);           // no parallel path
expect(styleElements[0]).toBe(result.preHydrationStyleElement);       // adopted by identity
expect(styleElement.hasAttribute('ng-app-id')).toBe(false);           // stripped
expect(styleElement.hasAttribute('ng-style-reused')).toBe(true);      // dev-mode stamp
```

Both specs locate the stylesheet by a `@layer nfs-defaults` marker in `textContent`, never
by CSS-text comparison -- respecting ticket 01's build-mutation trap.
`nfs-button.hydration-modes.browser.spec.ts` needed no change; it never touched either
service.

### The parity replacement

`packages/ngx-foundation-sites/scripts/verify-foundation-parity.mjs` compiles NfsButton's
stylesheet and **stock, unseeded** Foundation (`@include foundation-button`) with the same
Sass, parses both with postcss, and compares **declarations**. Current run: 231
declarations across 101 shared selectors, 7 recorded deviations. **Wired into `lint`** --
the old script was wired to nothing, which is exactly how it came to describe a file that
no longer existed.

Validated by re-injecting both of ticket 08's bugs:

- Reverting `@include fb.button-hollow` -> 9 failures, naming
  `.button.hollow is missing Foundation's background-color: transparent`. The old
  selector-level check stayed green.
- Drifting `$button-background-hover-lightness` to `-15%` -> 10 failures, 8 of them on
  palette-variant hovers with no recorded deviation at all.

Deviations pin their expected value rather than muting a property, so drift *inside* an
allowlist still fails. It also absorbs the deleted logical-property specs as a fourth
check, parsed rather than regexed -- note the old `/\bfloat\s*:/` assertion is now simply
wrong, since `float: inline-end` legitimately appears under ticket 03's mechanism.
Comparing picked colours against Foundation's own output proved strictly stronger than
recomputing them, so ticket 14's ground-truth table was not needed as a fixture and no
contrast maths or new dependency was added.

### Findings

1. **Foundation 6.9.0 contradicts itself upstream, and that is the true source of ticket
   08's "bug 2".** `components/_button.scss:36` defaults `$button-background-hover` to
   `scale-color(..., -15%)` while `:77` sets `$button-background-hover-lightness: -20%`.
   So stock Foundation's zero-config `.button:hover` is -15% and its `auto` path is -20%.
   The `_settings.scss` contradiction was inherited verbatim, not introduced here.
   NfsButton passing `auto` therefore matches Foundation's `auto` path but **deviates from
   stock Foundation's zero-config default hover** -- a real, now-pinned deviation rather
   than a bug fix. Defensible under D017, but it should be a conscious record, not a
   silent one.
2. **`@angular/common` had to leave `peerDependencies`** -- it was imported only by the
   two deleted services, and `@nx/dependency-checks` fails lint on the stale entry.
   `README.md:15`'s install snippet still lists it (ticket 11).
3. **`{projectRoot}/scripts/**/*.mjs` is now exempt from `@nx/dependency-checks`** --
   build-time tooling, never published, so its `postcss`/`sass` imports are not part of the
   package's dependency contract.
4. **`.gsd/` needs R005's and R018's proof wording updated** to cite `SharedStylesHost` /
   `addServerStyles` and the spec names above rather than the deleted services. Read-only,
   so this is a report.

### Deliberately not done

Reformatting the pre-existing specs to Prettier -- they were already non-conforming before
this ticket and Prettier is not a gate in this repo. Only the new script was formatted. A
`prettier --check` target would be the fix if that should be enforced.
