import { defineConfig, devices } from '@playwright/test';

// The four app-side host configurations of the six-host matrix. Storybook's dev
// server and its static build plus test-runner are the other two and are gated
// by `nx run ngx-foundation-sites:storybook` / `:test-storybook`.
//
// One spec set, four hosts: Angular delivers component styles through a
// different mechanism in each (production inlining, dev-server inlining,
// server-emitted `<style ng-app-id>` adopted by the client), so a host that is
// never exercised is a host where the style pipeline is unverified.
const hosts = [
  { name: 'dev-csr', port: 4200 },
  { name: 'static-csr', port: 4201 },
  { name: 'ssr-node', port: 4202 },
  { name: 'dev-ssr', port: 4203 },
] as const;

// Narrows the run to a subset of hosts, e.g.
// `NFS_DEMO_HOSTS=ssr-node npx nx run nfs-demo:e2e`. It narrows the projects AND
// what the global setup waits for; `--project` alone narrows only the projects.
// Either way the `e2e` target's dependsOn still starts all four hosts, since
// that list is static -- use the serve targets directly to run just one.
const requested = process.env['NFS_DEMO_HOSTS']
  ?.split(',')
  .map((name) => name.trim())
  .filter(Boolean);

const selected = requested?.length
  ? hosts.filter((host) => requested.includes(host.name))
  : [...hosts];

if (selected.length === 0) {
  throw new Error(
    `NFS_DEMO_HOSTS matched no host. Known hosts: ${hosts
      .map((host) => host.name)
      .join(', ')}.`,
  );
}

// The RTL spec is the one gate whose subject is a CSS ENGINE behaviour rather
// than an Angular style-delivery mechanism: it asserts that `float: inline-end`
// and `margin-inline-start` actually mirror under `dir="rtl"`. Every browser
// observation behind that mechanism (ticket 03) was headless Chromium, and
// `css-logical-props` resolving as supported across all 136 pinned browserslist
// targets is a support-TABLE claim, not an observation. So it also runs under
// WebKit and Firefox.
//
// Against ONE host, not all four: the engine is orthogonal to how Angular
// delivered the stylesheet, which the four Chromium projects already cover
// 4x-over. `static-csr` is the host chosen because it serves the production
// build -- the exact artefact a consumer ships -- with no dev-server transform
// in the path.
const rtlEngineHost = 'static-csr';
const rtlEngines = [
  { suffix: 'webkit', device: 'Desktop Safari' },
  { suffix: 'firefox', device: 'Desktop Firefox' },
] as const;

const rtlEngineProjects = selected
  .filter((host) => host.name === rtlEngineHost)
  .flatMap((host) =>
    rtlEngines.map((engine) => ({
      name: `${host.name}-${engine.suffix}`,
      testMatch: /nfs-button-rtl\.spec\.ts$/,
      use: {
        ...devices[engine.device],
        baseURL: `http://localhost:${host.port}`,
      },
    })),
  );

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  // No `webServer`: project.json's `e2e` target owns the hosts as continuous Nx
  // dependsOn tasks, and this only waits for them. See playwright-global-setup.ts
  // for why that split is not optional.
  globalSetup: './playwright-global-setup.ts',
  projects: [
    ...selected.map((host) => ({
      name: host.name,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${host.port}`,
      },
    })),
    ...rtlEngineProjects,
  ],
});
