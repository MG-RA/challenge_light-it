import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'MedAppoint' }).describe('Login heading');
    this.emailInput = page.getByLabel('Email').describe('Email input');
    this.passwordInput = page.getByLabel('Password').describe('Password input');
    this.submitButton = page.getByRole('button', { name: 'Sign In' }).describe('Sign In button');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
