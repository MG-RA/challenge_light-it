import { test, expect } from '../../src/fixtures';
import { DoctorsPage } from '../../src/pages/DoctorsPage';
import { AppointmentsPage } from '../../src/pages/AppointmentsPage';
import { BookingPage } from '../../src/pages/BookingPage';
import { NotificationsPage } from '../../src/pages/NotificationsPage';

test.describe('Sidebar destinations', () => {
  for (const section of ['Doctors', 'Appointments', 'Notifications'] as const) {
    test(`opens ${section} with its page heading`, async ({ page, dashboardPage }) => {
      await dashboardPage.goto();
      await dashboardPage.sidebar.link(section).click();
      await expect(page).toHaveURL(new RegExp(`/${section.toLowerCase()}$`));
      const destination = section === 'Doctors' ? new DoctorsPage(page)
        : section === 'Appointments' ? new AppointmentsPage(page) : new NotificationsPage(page);
      await expect(destination.heading).toBeVisible();
    });
  }

  test('returns to Dashboard from Doctors', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.sidebar.link('Doctors').click();
    await expect(new DoctorsPage(page).heading).toBeVisible();
    await dashboardPage.sidebar.link('Dashboard').click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dashboardPage.greeting).toBeVisible();
  });
});

test('sidebar logout clears the session and protects routes after reload and back', async ({ page, dashboardPage, loginPage, credentials }) => {
  // Use a separate session so server-side revocation cannot invalidate shared setup.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await loginPage.goto();
  await loginPage.login(credentials.email, credentials.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await dashboardPage.sidebar.logoutButton.click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/appointments');
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(loginPage.submitButton).toBeVisible();
});

test('sidebar New Appointment opens booking form', async ({ page, dashboardPage }) => {
  await dashboardPage.goto();
  await dashboardPage.sidebar.newAppointmentLink.click();
  await expect(page).toHaveURL(/\/appointments\/new$/);
  await expect(new BookingPage(page).submit).toBeVisible();
});
