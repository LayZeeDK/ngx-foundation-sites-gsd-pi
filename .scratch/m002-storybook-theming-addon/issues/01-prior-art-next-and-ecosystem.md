# Prior art: how ngx-foundation-sites-next themed, and what the ecosystem already built

Type: research
Status: resolved
Blocked by: --

## Question

R009 asks for a theming addon "similar to `ngx-foundation-sites-next`". What did
that addon actually deliver, what decisions did it have to make, and what
comparable prior art exists in the wider Storybook / Sass ecosystem?

**Hard constraint on this ticket: `ngx-foundation-sites-next` shapes REQUIREMENTS
ONLY. No code-copying.** Read it to learn what the addon had to do and which
problems it hit. Do not lift implementation, file layout, or config. Do not
justify an architecture with "next did it that way" -- findings are stated as
capability and constraint, never as a diff to apply.

Answer these:

1. **Local clone** (`d:/projects/github/LayZeeDK/ngx-foundation-sites-next`):
   which Sass variables did it expose as live controls, and why those? Did it
   have presets, and how did preset-vs-custom state behave? Where did
   compilation happen (browser? worker? build-time pre-generation?). What
   delivery shape did it use -- workspace-local Storybook config, or a
   published addon package? What is visibly unfinished, worked around, or
   commented as a known problem?
2. **Web / GitHub prior art** (explicitly in scope by user instruction): do
   Storybook addons already exist that compile Sass in the browser for live
   theming? Search GitHub and npm for Sass-in-browser theming addons, design-token
   / theme-switcher addons, and anything wiring `sass`'s browser build into a
   Storybook panel. Also check how large design systems expose live theme
   editing in Storybook (Material, Carbon, Spectrum, Fluent) -- even where they
   use CSS custom properties rather than Sass, since the *control surface and
   preset semantics* transfer even though D020 forbids their mechanism.
3. **What NOT to repeat.** Any prior art that was abandoned, deprecated, or
   whose README documents why the approach failed, is a first-class finding.

Deliver a findings document that separates: (a) capabilities the addon must
have, (b) decisions this map still has to make, (c) traps to avoid -- with a
source link or clone path for each claim.

## Notes

Reference is a sibling project by the same author, so its choices carry weight
as intent, but it predates this repo's M003 architecture (compiled SCSS +
`theme()` mixin + R026 CSS-in-JS ban). Do not assume its constraints are ours.

## Answer

Full findings: `../research/01-prior-art-next-and-ecosystem.md` (733 lines) --
capabilities C1-C9, 10 open decisions each routed to its owning ticket, traps
T1-T11, then the web/GitHub section and a verified-vs-inferred ledger.

**Prior art is thin, and that IS the answer.** Zero Storybook addons compile
Sass in the browser (`gh api search/code` for `compileString storybook addon`
returns 0). `@storybook/addon-themes`, `storybook-addon-sass-postcss` and
`storybook-design-token` all swap prebuilt CSS or preprocess at build time. The
only real architectural precedent is `storybook-addon-customize-antd-theme` --
browser-compiled **Less**, stranded on Storybook 6 / antd 4 since 2021 -- whose
channel topology and curated variable set (`primary-color`,
`border-radius-base`) match R009's shape almost exactly.

**No first-party design system ships a compiler.** Carbon, Spectrum, Fluent,
Polaris and SLDS all converged on the CSS-custom-property mechanism D020
forbids. D020 is therefore load-bearing and expensive -- M002 is doing something
the ecosystem consistently chose not to do. That is a legitimate design choice,
not a mistake, but ticket 11's requirements should **say so explicitly** rather
than let a future reader assume the unusual path was accidental.

**The abandonment report.** Ant Design Pro shipped browser Less compilation and
published why they regret it: "the whole page is stuck", "not suitable for
adaptation in a formal environment". Their fix was narrowing what the browser
recompiles. Favourable for us: this repo's `theme()` chain is *already* narrow
-- 3 library files + 3 Foundation entry points, which is exactly where the
reference's own optimisation pass converged after measuring a 70-file
alternative.

**What the reference had to do, stated as constraints (not as code to copy):**
pre-bundle Dart Sass; supply every source as a string through a custom importer;
carry durable state on Storybook globals and compile progress on the channel;
and gate every style-dependent assertion on an explicit readiness promise.

**Where the reference must NOT be followed:**

- Its **worker pool** is a throughput optimisation for N components (measured
  only 20.5% gain; button alone cost ~1.4 s). For a one-component repo it buys
  nothing -- the real argument for a worker here is *responsiveness*, not
  throughput.
- Its **style-suppression stack** (DI swap + imperative disable +
  `MutationObserver`) fixes a DOM-order cascade problem that M003's
  `@layer nfs-defaults` / unlayered split should already solve.
- Its **regex rewriting of Foundation's Sass** and hand-written `round()` /
  `red()` shims were consequences of loading Sass from a CDN. This repo compiles
  the same Foundation with pinned `sass@1.102.0` and only `--quiet-deps`.
- Its **`preset.js` is CommonJS**, invalid under Storybook 10's ESM-only addon
  mandate (ticket 02).

**Two findings that sharpen existing map items:**

- The reference shipped the addon with **zero tests and zero
  README/AGENTS documentation**, so R021 has no patterns to reuse from it.
  However, this repo's own `scripts/verify-foundation-parity.mjs` already
  provides a Node-side `sass.compileString` harness -- routed to ticket 10.
- **Three mutually inconsistent "WCAG-compliant palettes" coexist in the
  reference at HEAD**, corroborating the map's founding-brief correction. And
  this repo's compliant palette is already restated across **five** tracked
  files, not the two the map first recorded -- routed to ticket 07.
