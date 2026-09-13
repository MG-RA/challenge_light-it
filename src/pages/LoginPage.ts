import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.locator('#email').describe('Email input');
    this.passwordInput = page.locator('#password').describe('Password input');
    this.submitButton = page.getByRole('button', { name: 'Sign In' }).describe('Sign In button');
    this.errorMessage = page
      .getByText('Invalid email or password', { exact: false })
      .describe('Login rejection feedback');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAndWaitForResponse(email: string, password: string) {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res) =>
          new URL(res.url()).pathname === '/api/auth/login' && res.request().method() === 'POST',
      ),
      this.login(email, password),
    ]);
    return response;
  }
}
