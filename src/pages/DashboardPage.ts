import type { Locator, Page } from '@playwright/test';

export class DashboardPage {
  readonly greeting: Locator;

  constructor(private readonly page: Page) {
    this.greeting = page
      .getByRole('main')
      .getByRole('heading', { level: 1 })
      .describe('Dashboard greeting');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }
}
