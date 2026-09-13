import { test as base, type PlaywrightWorkerArgs } from '@playwright/test';
import { ApiClient } from '../api/ApiClient';
import { loadToken } from '../auth/session';
import { env } from '../config/env';
import { Db, type UserRow } from '../db/Db';
import { ApiMocks } from '../mocks/ApiMocks';
import { BookingPage } from '../pages/BookingPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { AppShell } from '../pages/components/AppShell';
import { expect } from './matchers';

export type TestOptions = {
  /** Backend API base URL. A project can override it with `use: { apiBaseURL }`. */
  apiBaseURL: string;
};

type TestFixtures = {
  /** API client with no credentials (for auth/negative tests). */
  anonApi: ApiClient;
  /** API client authenticated as the challenge user (token from auth.setup). */
  api: ApiClient;
  /** Network stubs for UI tests that control backend answers (they prove UI behavior only). */
  apiMocks: ApiMocks;
  /** Sidebar and page title shared by every signed-in page. */
  appShell: AppShell;
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  bookingPage: BookingPage;
};

type WorkerFixtures = {
  /**
   * Login for the challenge account. One account shared by all workers today;
   * per-worker accounts (keyed on workerInfo.parallelIndex) would slot in here.
   */
  credentials: { email: string; password: string };
  /** The challenge account's row in the DB. */
  testUser: UserRow;
  token: string;
  db: Db;
};

// Each client gets its own request context: contexts keep a cookie jar, so
// sharing one could leave the "anonymous" client authenticated.
async function provideApiClient(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string,
  token: string | undefined,
  use: (client: ApiClient) => Promise<void>,
): Promise<void> {
  const ctx = await playwright.request.newContext({ baseURL });
  await use(new ApiClient(ctx, token));
  await ctx.dispose();
}

export const test = base.extend<TestOptions & TestFixtures, WorkerFixtures>({
  apiBaseURL: [env.apiBaseUrl, { option: true }],

  credentials: [
    async ({}, use) => {
      const { email, password } = env.user;
      await use({ email, password });
    },
    { scope: 'worker' },
  ],

  testUser: [
    async ({ db, credentials }, use) => {
      await use(await db.userByEmail(credentials.email));
    },
    { scope: 'worker' },
  ],

  token: [
    async ({}, use) => {
      await use(loadToken());
    },
    { scope: 'worker' },
  ],

  db: [
    async ({}, use) => {
      const db = new Db(env.db);
      await use(db);
      await db.close();
    },
    { scope: 'worker' },
  ],

  anonApi: ({ playwright, apiBaseURL }, use) =>
    provideApiClient(playwright, apiBaseURL, undefined, use),

  api: ({ playwright, apiBaseURL, token }, use) =>
    provideApiClient(playwright, apiBaseURL, token, use),

  apiMocks: async ({ page }, use) => {
    await use(new ApiMocks(page));
  },

  appShell: async ({ page }, use) => {
    await use(new AppShell(page));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  bookingPage: async ({ page }, use) => {
    await use(new BookingPage(page));
  },
});

export { expect };
export { expectJson, expectCompleteJson } from './expectJson';
