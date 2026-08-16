import type { FullConfig } from '@playwright/test';

// Waits for the Storybook static server to answer before any spec starts.
//
// This is deliberately not Playwright's own `webServer`. project.json's `e2e`
// target starts `ngx-foundation-sites:static-storybook` as a continuous Nx
// `dependsOn` task, so the same task graph shares that one server with
// `ngx-foundation-sites:test-storybook` (both depend on it). Nx starts a
// continuous task without waiting for it to answer, and a `webServer` whose
// command is a waiter fails with "Process from config.webServer exited early"
// as soon as the waiter succeeds. Polling here avoids both -- copied from
// apps/nfs-demo/playwright-global-setup.ts, which established this pattern.
const READY_TIMEOUT_MS = 300_000;
const POLL_INTERVAL_MS = 500;

async function waitForHost(baseURL: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  for (;;) {
    try {
      const response = await fetch(baseURL);

      if (response.ok) {
        // Drain the body so the socket is released.
        await response.text();

        return;
      }
    } catch {
      // Not listening yet.
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `Host ${baseURL} did not answer within ${READY_TIMEOUT_MS} ms. Start it with its own Nx target (nx run ngx-foundation-sites:static-storybook) to see why.`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURLs = [
    ...new Set(
      config.projects
        .map((project) => project.use.baseURL)
        .filter((baseURL): baseURL is string => Boolean(baseURL)),
    ),
  ];

  await Promise.all(baseURLs.map(waitForHost));
}
