import { test, expect } from '../../src/fixtures';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
  });

  test('greets the user by first name from the DB', async ({ dashboardPage, testUser }) => {
    await expect(dashboardPage.greeting).toContainText(testUser.first_name);
  });

  test('sidebar navigation links to each section', async ({ dashboardPage }) => {
    // Link names include the icon ligature text (e.g. "medical_services Doctors"), hence the regexes.
    await expect(dashboardPage.sidebar.nav).toMatchAriaSnapshot(`
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
