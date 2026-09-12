import { test, expect } from '../../src/fixtures';

const IMAGE_BUDGET_BYTES = 500 * 1024;

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

  test(
    `each image is under ${IMAGE_BUDGET_BYTES / 1024} KB`,
    { annotation: { type: 'issue', description: 'F-13: 6.1 MiB banner PNG (docs/FINDINGS.md)' } },
    async ({ page, dashboardPage }) => {
      await expect(dashboardPage.banner).toHaveJSProperty('complete', true);
      const bannerUrl = await dashboardPage.banner.evaluate((img: HTMLImageElement) => img.currentSrc);
      expect(await dashboardPage.banner.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      const images = (await page.requests()).filter((r) => r.resourceType() === 'image');
      expect(images.length, 'images loaded').toBeGreaterThan(0);
      let bannerBytes: number | undefined;
      for (const request of images) {
        const response = await request.response();
        if (!response) throw new Error(`No response for ${request.url()}`);
        expect(response.ok(), request.url()).toBe(true);
        const size = (await response.body()).length;
        if (request.url() === bannerUrl) bannerBytes = size;
        else expect(size, request.url()).toBeLessThanOrEqual(IMAGE_BUDGET_BYTES);
      }
      expect(bannerBytes, 'banner response was captured').toBeDefined();
      test.fail(true, 'F-13: only the dashboard banner size assertion below may fail');
      expect(bannerBytes, bannerUrl).toBeLessThanOrEqual(IMAGE_BUDGET_BYTES);
    },
  );
});
