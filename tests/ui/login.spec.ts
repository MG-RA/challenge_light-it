import { test, expect } from '../../src/fixtures';
import { env } from '../../src/config/env';

// These tests exercise the login form itself, so start logged out.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login page', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('valid credentials land on the dashboard', async ({ page, loginPage, dashboardPage }) => {
    await loginPage.login(env.user.email, env.user.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dashboardPage.greeting).toBeVisible();
  });

  test('invalid password keeps the user on /login', async ({ page, loginPage }) => {
    await loginPage.login(env.user.email, 'definitely-wrong');
    await expect(page).toHaveURL(/\/login$/);
    // TODO: assert on the error message once its copy/role is known
  });

  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});
