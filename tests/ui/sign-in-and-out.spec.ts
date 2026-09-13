import type { User } from '../../src/api/types';
import { storedToken } from '../../src/auth/session';
import { test, expect } from '../../src/fixtures';

// This flow starts signed out, so it does not reuse the session saved by the setup project.
test.use({ storageState: { cookies: [], origins: [] } });

test('a patient signs in, reaches the dashboard and signs out', async ({
  page,
  api,
  loginPage,
  dashboardPage,
  sidebar,
  credentials,
}) => {
  const me = (await (await api.getMe()).json()) as User;

  await test.step('a wrong password is rejected and keeps the patient on the sign-in page', async () => {
    await loginPage.goto();
    const response = await loginPage.loginAndWaitForResponse(credentials.email, 'not-the-password');
    expect(response.status(), 'login response status for a wrong password').toBe(401);
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  await test.step('the correct password opens the dashboard for this patient', async () => {
    await loginPage.login(credentials.email, credentials.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dashboardPage.greeting).toContainText(me.first_name);
  });

  await test.step('signing out ends the session and protects the app', async () => {
    await sidebar.logoutButton.click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await storedToken(page), 'session token after signing out').toBeNull();

    await page.goto('/appointments');
    await expect(page, 'a protected page redirects to sign-in').toHaveURL(/\/login$/);
  });
});
