import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';

// apps/nfs-demo -> apps -> workspace root; `nx serve` must run from the
// workspace root since apps/nfs-demo has no local nx/toolchain of its own.
const workspaceRoot = join(__dirname, '..', '..');
const port = 4200;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npx nx serve nfs-demo --port=${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
