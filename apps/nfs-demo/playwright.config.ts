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
// `NFS_DEMO_HOSTS=ssr-node npx nx run nfs-demo:e2e`. Selecting with `--project`
// alone works too, but the global setup would still wait for all four hosts.
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
  projects: selected.map((host) => ({
    name: host.name,
    use: {
      ...devices['Desktop Chrome'],
      baseURL: `http://localhost:${host.port}`,
    },
  })),
});
