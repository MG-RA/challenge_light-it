import { test, expect } from '../../src/fixtures';
import { signOutBrowser, storedToken } from '../../src/auth/session';

test.describe('Sidebar destinations', () => {
  for (const section of ['Doctors', 'Appointments', 'Notifications'] as const) {
    test(`opens ${section} with its page heading`, async ({ page, dashboardPage, appShell }) => {
      await dashboardPage.goto();
      await appShell.sidebar.link(section).click();

      await expect(page).toHaveURL(new RegExp(`/${section.toLowerCase()}$`));
      await expect(appShell.pageTitle(section)).toBeVisible();
    });
  }

  test('returns to Dashboard from Doctors', async ({ page, dashboardPage, appShell }) => {
    await dashboardPage.goto();
    await appShell.sidebar.link('Doctors').click();
    await expect(appShell.pageTitle('Doctors')).toBeVisible();

    await appShell.sidebar.link('Dashboard').click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dashboardPage.greeting).toBeVisible();
  });
});

test('sidebar logout clears the session and protects routes after reload and back', async ({
  page,
  appShell,
  loginPage,
  credentials,
}) => {
  // Log in separately so server-side revocation cannot invalidate the shared setup token.
  await signOutBrowser(page);
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await appShell.sidebar.logoutButton.click();

  await expect(page).toHaveURL(/\/login$/);
  expect(await storedToken(page), 'session token after logout').toBeNull();

  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/appointments');
  await expect(page).toHaveURL(/\/login$/);

  await page.reload();
  await expect(loginPage.submitButton).toBeVisible();
});

test('sidebar New Appointment opens booking form', async ({
  page,
  dashboardPage,
  appShell,
  bookingPage,
}) => {
  await dashboardPage.goto();
  await appShell.sidebar.newAppointmentLink.click();

  await expect(page).toHaveURL(/\/appointments\/new$/);
  await expect(bookingPage.submit).toBeVisible();
});
