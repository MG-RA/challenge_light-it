import type { Locator, Page } from '@playwright/test';
import { Sidebar } from './components/Sidebar';

export class DashboardPage {
  readonly sidebar: Sidebar;
  readonly greeting: Locator;

  constructor(private readonly page: Page) {
    this.sidebar = new Sidebar(page);
    this.greeting = page.getByRole('main').getByRole('heading', { level: 1 }).describe('Dashboard greeting');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }
}
