import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import { AUTH_STATE_FILE } from './src/fixtures/paths';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Shared remote env + rate-limited login: keep concurrency modest.
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
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
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: env.apiBaseUrl },
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
