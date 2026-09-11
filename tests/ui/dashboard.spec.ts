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

  test('sidebar navigation links to each section', async ({ dashboardPage }) => {
    // Link names include the icon ligature text (e.g. "medical_services Doctors"), hence the regexes.
    await expect(dashboardPage.nav).toMatchAriaSnapshot(`
      - navigation:
        - link /Dashboard$/:
          - /url: /dashboard
        - link /Doctors$/:
          - /url: /doctors
        - link /Appointments$/:
          - /url: /appointments
        - link /Notifications$/:
          - /url: /notifications
    `);
  });
});
