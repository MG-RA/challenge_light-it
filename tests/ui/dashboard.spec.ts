import { test, expect } from '../../src/fixtures';
import { env } from '../../src/config/env';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
  });

  test('greets the user by first name from the DB', async ({ dashboardPage, db }) => {
    const user = await db.userByEmail(env.user.email);
    await expect(dashboardPage.greeting).toContainText(user.first_name);
  });

  test('sidebar navigation links are present', async ({ dashboardPage }) => {
    for (const name of ['Dashboard', 'Doctors', 'Appointments', 'Notifications'] as const) {
      await expect(dashboardPage.navLink(name)).toBeVisible();
    }
  });
});
