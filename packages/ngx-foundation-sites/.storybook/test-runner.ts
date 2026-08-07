import type { TestRunnerConfig } from '@storybook/test-runner';

// R018/R010-adjacent integration check: fails any story whose render emits a
// browser console error, closing the Integration verification-class gap for
// NfsButton (S11). Run via the `test-storybook` Nx target.
const config: TestRunnerConfig = {
  async preVisit(page) {
    page.on('console', (message) => {
      if (message.type() === 'error') {
        throw new Error(`Console error in story: ${message.text()}`);
      }
    });
  },
};

export default config;
