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
    const response = await loginPage.loginAndWaitForResponse(credentials.email, 'definitely-wrong');
    expect(response.status()).toBe(401);
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.submitButton).toBeEnabled();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Access control', () => {
  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});

for (const scenario of ['missing email', 'missing password', 'malformed email'] as const) {
  test(`login validates ${scenario} before submitting`, async ({ page, loginPage }) => {
    let requests = 0;
    await page.route('**/api/auth/login', async (route) => {
      requests++;
      await route.fulfill({ status: 400, json: { error: 'Unexpected submission' } });
    });
    await loginPage.goto();
    await loginPage.emailInput.fill(scenario === 'missing email' ? '' : scenario === 'malformed email' ? 'invalid' : 'qa@example.com');
    await loginPage.passwordInput.fill(scenario === 'missing password' ? '' : 'deliberately-invalid');
    await loginPage.submitButton.click();
    const field = scenario === 'missing password' ? loginPage.passwordInput : loginPage.emailInput;
    await expect(field).toBeFocused();
    expect(await field.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
    expect(requests).toBe(0);
    await expect(page).toHaveURL(/\/login$/);
  });
}

test('login shows actionable feedback for throttling', async ({ page, loginPage }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({
    status: 429, headers: { 'Retry-After': '60' }, json: { error: 'Too many requests. Try again in 60 seconds.' },
  }));
  await loginPage.goto();
  await loginPage.login('qa@example.com', 'deliberately-invalid');
  await expect(page.getByText(/too many|try again in|wait.*seconds/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
