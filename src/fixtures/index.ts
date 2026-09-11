import fs from 'node:fs';
import { test as base } from '@playwright/test';
import { ApiClient } from '../api/ApiClient';
import { env } from '../config/env';
import { Db } from '../db/Db';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { expect } from './matchers';
import { AUTH_TOKEN_FILE } from './paths';

type TestFixtures = {
  /** API client with no credentials (for auth/negative tests). */
  anonApi: ApiClient;
  /** API client authenticated as the challenge user (token from auth.setup). */
  api: ApiClient;
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
};

type WorkerFixtures = {
  token: string;
  db: Db;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  token: [
    async ({}, use) => {
      if (!fs.existsSync(AUTH_TOKEN_FILE)) {
        throw new Error(`No auth token at ${AUTH_TOKEN_FILE}. Run the "setup" project first (don't pass --no-deps).`);
      }
      const { token } = JSON.parse(fs.readFileSync(AUTH_TOKEN_FILE, 'utf8')) as { token: string };
      await use(token);
    },
    { scope: 'worker' },
  ],

  db: [
    async ({}, use) => {
      const db = new Db();
      await use(db);
      await db.close();
    },
    { scope: 'worker' },
  ],

  anonApi: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: env.apiBaseUrl });
    await use(new ApiClient(ctx));
    await ctx.dispose();
  },

  // Its own context rather than anonApi's: request contexts keep a cookie jar,
  // so sharing one could leave the "anonymous" client authenticated.
  api: async ({ playwright, token }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: env.apiBaseUrl });
    await use(new ApiClient(ctx, token));
    await ctx.dispose();
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
});

export { expect };
