import type { FullConfig } from '@playwright/test';

// Waits for every host the run selected to answer before any spec starts.
//
// This is deliberately not Playwright's own `webServer`. project.json's `e2e`
// target starts the four hosts as continuous Nx `dependsOn` tasks, so that one
// task graph deduplicates the shared ngx-foundation-sites build and the two
// nfs-demo build targets; letting Playwright spawn `nx run nfs-demo:<target>`
// instead nests Nx inside Nx, which trips "Recursive task invocation detected"
// and races four sibling processes on the same build outputs. But Nx starts a
// continuous task without waiting for it to answer, and a `webServer` whose
// command is a waiter fails with "Process from config.webServer exited early"
// as soon as the waiter succeeds. Polling here avoids both.
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
        `Host ${baseURL} did not answer within ${READY_TIMEOUT_MS} ms. Start it with its own Nx target (nx run nfs-demo:serve | serve-static | serve-ssr | serve-ssr-node) to see why.`,
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
