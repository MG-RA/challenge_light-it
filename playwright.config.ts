import { defineConfig, devices } from '@playwright/test';
import { AUTH_STATE_FILE } from './src/auth/session';
import { env } from './src/config/env';
import { mutationsEnabled } from './src/config/mutations';
import type { TestOptions } from './src/fixtures';

// Tests tagged @mutating write owned records on the shared target; RUN_MUTATING=1 selects them.
const mutating = mutationsEnabled(process.env.RUN_MUTATING);
// Discovery must never replace the last executed HTML/JSON report.
const listing = process.argv.includes('--list');
// Shared remote env + rate-limited login: keep concurrency modest.
const parallelWorkers = process.env.CI ? 2 : 4;

export default defineConfig<TestOptions>({
  // Writes run sequentially, in declaration order, and are never retried.
  fullyParallel: !mutating,
  forbidOnly: !!process.env.CI,
  grepInvert: mutating ? undefined : /@mutating/,
  retries: mutating || !process.env.CI ? 0 : 1,
  workers: mutating ? 1 : parallelWorkers,
  reporter: listing
    ? [['list']]
    : [
        ['list'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ...(process.env.CI
          ? ([['junit', { outputFile: 'test-results/junit.xml' }], ['github']] as const)
          : []),
      ],
  timeout: mutating ? 90_000 : 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: env.baseUrl,
    // Same zone as Node date math (env.ts pins process.env.TZ), so the app and the oracle agree on "today".
    timezoneId: env.timezone,
    // Traces hold the bearer and localStorage token, and screenshots/videos show account data.
    // CI artifacts on a public repository are downloadable, so keep them local-only.
    trace: process.env.CI ? 'off' : 'retain-on-failure',
    screenshot: process.env.CI ? 'off' : 'only-on-failure',
    video: process.env.CI ? 'off' : 'retain-on-failure',
  },

  projects: [
    // Part 4: the UI flows. `npm test` runs these (plus the login setup they depend on).
    { name: 'setup', testDir: './tests', testMatch: /auth\.setup\.ts/ },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE_FILE },
      dependencies: ['setup'],
    },

    // Extras: API contract, authorization and database checks. `npm run test:extras` runs these.
    {
      name: 'extras-setup',
      testDir: './extras/api-tests',
      testMatch: /contract\.setup\.ts/,
      dependencies: ['setup'],
    },
    {
      // API clients come from fixtures, which use the `apiBaseURL` option (defaults to API_BASE_URL).
      name: 'extras-api',
      testDir: './extras/api-tests',
      dependencies: ['extras-setup'],
    },
  ],
});
