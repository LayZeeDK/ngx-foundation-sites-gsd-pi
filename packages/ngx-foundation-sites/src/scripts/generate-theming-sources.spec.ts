// D034: the theming-sources generator (packages/ngx-foundation-sites/scripts/
// generate-theming-sources.mjs) unions two closures rather than compiling one
// combined entry. This spec is the negative control that justifies the split:
// without it, a single-entry generator would silently omit `nfs:/_theme.scss`
// and fail only at runtime, inside the addon's Worker, with a degraded
// diagnostic (D034's rationale).
//
// The generator is spawned as a real `node` subprocess rather than imported
// directly. Reason, discovered while wiring this spec: the Nx `test` target
// bundles spec files through Vite, whose resolve conditions
// (`@angular/build`'s vitest runner) omit `node`, so `sass`'s conditional
// `exports` map resolves to its browser/dart2js build inside THIS bundle --
// which cannot canonicalize `nfs:`/`fnd:` URLs against real disk paths the
// way the Node build does. Running the generator as its own `node` process
// uses the same entrypoint the `verify-theming-sources` gate and the
// `node ...generate-theming-sources.mjs` verify command do, so the closure
// this spec asserts on is the real one, not a re-implementation.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Resolved from the workspace root (Nx's vitest `root`), not `import.meta.url`:
// under the `test` target's Vite bundling, `import.meta.url` is a virtual
// module id rather than a real `file:` URL, which breaks `fileURLToPath`.
const GENERATOR_PATH = resolve(
  'packages/ngx-foundation-sites/scripts/generate-theming-sources.mjs',
);

interface ClosureKeys {
  themeableClosureKeys: string[];
  dataClosureKeys: string[];
  sourcesKeys: string[];
}

function closureKeys(): ClosureKeys {
  const output = execFileSync('node', [GENERATOR_PATH, '--print-closure-keys'], {
    encoding: 'utf8',
  });

  return JSON.parse(output) as ClosureKeys;
}

describe('generate-theming-sources', () => {
  const { themeableClosureKeys, dataClosureKeys, sourcesKeys } = closureKeys();

  it('negative control: the themeable-only closure over nfs:/button does NOT contain nfs:/_theme.scss', () => {
    expect(themeableClosureKeys).not.toContain('nfs:/_theme.scss');
  });

  it('the data-only closure over nfs:/theme DOES contain nfs:/_theme.scss', () => {
    expect(dataClosureKeys).toContain('nfs:/_theme.scss');
  });

  it('the unioned sources contain nfs:/_theme.scss, proving DATA_MODULES is required', () => {
    expect(sourcesKeys).toContain('nfs:/_theme.scss');
  });

  it("the themeable closure still contains nfs:/button's own chain", () => {
    expect(themeableClosureKeys).toContain('nfs:/_button.scss');
    expect(themeableClosureKeys).toContain('nfs:/internal/_foundation-button.scss');
    expect(themeableClosureKeys).toContain('nfs:/internal/_settings.scss');
  });

  it('the themeable closure includes Foundation partials served through the legacy @import island', () => {
    expect(themeableClosureKeys.some((key) => key.startsWith('fnd:/'))).toBe(true);
  });
});
