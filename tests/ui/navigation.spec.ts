import { test, expect } from '../../src/fixtures';
import { DoctorsPage } from '../../src/pages/DoctorsPage';
import { AppointmentsPage } from '../../src/pages/AppointmentsPage';
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
