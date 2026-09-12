import type { Locator, Page } from '@playwright/test';
import { Sidebar } from './components/Sidebar';

export class DashboardPage {
  readonly sidebar: Sidebar;
  readonly greeting: Locator;
  readonly banner: Locator;

  constructor(private readonly page: Page) {
    this.sidebar = new Sidebar(page);
    this.greeting = page.getByRole('main').getByRole('heading', { level: 1 }).describe('Dashboard greeting');
    // No alt attribute, so it has no accessible name to locate by.
    this.banner = page.getByRole('main').getByRole('img').describe('Dashboard banner');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }
}
