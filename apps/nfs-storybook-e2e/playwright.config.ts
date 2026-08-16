import { defineConfig, devices } from '@playwright/test';

// R021 lane 3: the only lane that can reach the Storybook MANAGER (addon
// panels, the manager-to-preview globals channel, URL state) -- Vitest's
// `test`/`test-browser` lanes and `@storybook/test-runner` all navigate to
// `iframe.html` (the preview only) and structurally cannot see it
// (research/04). One browser engine only: a Storybook addon's behaviour is
// not a CSS-engine claim (unlike nfs-demo's logical-properties RTL matrix),
// so there is nothing for a second engine to prove here.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4400',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  // No `webServer`: project.json's `e2e` target owns `static-storybook` as a
  // continuous Nx `dependsOn` task (shared with `ngx-foundation-sites:test-
  // storybook`), and this only waits for it. See playwright-global-setup.ts
  // for why that split is not optional.
  globalSetup: './playwright-global-setup.ts',
  projects: [{ name: 'chromium' }],
});
