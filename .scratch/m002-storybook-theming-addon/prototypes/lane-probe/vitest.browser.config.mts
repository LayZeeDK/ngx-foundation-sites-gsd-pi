import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Throwaway probe config for ticket 10 -- stands in for the repo's
// `test-browser` lane (real Chromium, Vitest browser mode).
export default defineConfig({
  root: process.cwd(),
  test: {
    include: [
      '.scratch/m002-storybook-theming-addon/prototypes/lane-probe/*.browser.spec.mts',
    ],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
