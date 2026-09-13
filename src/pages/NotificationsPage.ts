import type { Page } from '@playwright/test';

export class NotificationsPage {
  constructor(private readonly page: Page) {}
  get heading() {
    return this.page.getByRole('main').getByRole('heading', { name: /Notifications/i, level: 1 });
  }
}
