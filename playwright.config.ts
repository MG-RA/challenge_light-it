import { defineConfig, devices } from '@playwright/test';
import { AUTH_STATE_FILE } from './src/auth/session';
import { env } from './src/config/env';
import type { TestOptions } from './src/fixtures';

export default defineConfig<TestOptions>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Shared remote env + rate-limited login: keep concurrency modest.
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ...(process.env.CI
      ? ([['junit', { outputFile: 'test-results/junit.xml' }], ['github']] as const)
      : []),
  ],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: env.baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      // API clients come from fixtures, which use the `apiBaseURL` option (defaults to API_BASE_URL).
      name: 'api',
      testDir: './tests/api',
      dependencies: ['setup'],
    },
    {
      name: 'db',
      testDir: './tests/db',
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE_FILE },
      dependencies: ['setup'],
    },
  ],
});
