import { defineConfig } from 'vitest/config';

// Throwaway probe config for ticket 10. Root is the repo root so `sass`
// resolves exactly as it would for a spec inside packages/.
export default defineConfig({
  root: process.cwd(),
  test: {
    environment: 'jsdom',
    include: [
      '.scratch/m002-storybook-theming-addon/prototypes/lane-probe/*.spec.mts',
    ],
  },
});
