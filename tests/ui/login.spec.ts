import { test, expect } from '../../src/fixtures';

// These tests exercise logged-out behaviour, so start without the stored session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login page', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('valid credentials land on the dashboard', async ({ page, loginPage, dashboardPage, credentials }) => {
    await loginPage.login(credentials.email, credentials.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dashboardPage.greeting).toBeVisible();
  });

  test('invalid password keeps the user on /login', async ({ page, loginPage, credentials }) => {
    await loginPage.login(credentials.email, 'definitely-wrong');
    await expect(page).toHaveURL(/\/login$/);
    // TODO: assert on the error message once its copy/role is known
  });
});

test.describe('Access control', () => {
  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});
