import { test, expect } from '../../src/fixtures';

// These tests exercise logged-out behaviour, so start without the stored session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login page', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('valid credentials land on the dashboard', async ({
    page,
    loginPage,
    dashboardPage,
    credentials,
  }) => {
    await loginPage.login(credentials.email, credentials.password);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dashboardPage.greeting).toBeVisible();
  });

  test('invalid password keeps the user on /login', async ({ page, loginPage, credentials }) => {
    const response = await loginPage.loginAndWaitForResponse(credentials.email, 'definitely-wrong');

    expect(response.status(), 'login response status for a wrong password').toBe(401);
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

const invalidLogins = [
  { scenario: 'missing email', email: '', password: 'deliberately-invalid', invalid: 'emailInput' },
  { scenario: 'missing password', email: 'qa@example.com', password: '', invalid: 'passwordInput' },
  {
    scenario: 'malformed email',
    email: 'invalid',
    password: 'deliberately-invalid',
    invalid: 'emailInput',
  },
] as const;

for (const { scenario, email, password, invalid } of invalidLogins) {
  test(`login validates ${scenario} before submitting`, async ({ page, apiMocks, loginPage }) => {
    const submissions = await apiMocks.blockLoginSubmissions();

    await loginPage.goto();
    await loginPage.login(email, password);

    const field = loginPage[invalid];
    await expect(field).toBeFocused();
    await expect(field).toBeInvalid();
    expect(submissions.count, 'login requests sent').toBe(0);
    await expect(page).toHaveURL(/\/login$/);
  });
}

test('login shows actionable feedback for throttling', async ({ page, apiMocks, loginPage }) => {
  await apiMocks.answerLogin({
    status: 429,
    headers: { 'Retry-After': '60' },
    json: { error: 'Too many requests. Try again in 60 seconds.' },
  });

  await loginPage.goto();
  await loginPage.login('qa@example.com', 'deliberately-invalid');

  await expect(loginPage.throttleMessage).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
