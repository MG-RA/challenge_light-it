import type { Locator, Page } from '@playwright/test';
import { Sidebar } from './Sidebar';

/** Layout shared by every signed-in page: the sidebar and the page title in the main area. */
export class AppShell {
  readonly sidebar: Sidebar;
  private readonly main: Locator;

  constructor(page: Page) {
    this.sidebar = new Sidebar(page);
    this.main = page.getByRole('main');
  }

  /** The page's level-1 heading. `name` matches as a case-insensitive substring. */
  pageTitle(name: string): Locator {
    return this.main.getByRole('heading', { name, level: 1 }).describe(`"${name}" page title`);
  }
}
