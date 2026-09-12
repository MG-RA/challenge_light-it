import type { Page } from '@playwright/test';

export class DoctorsPage {
  constructor(private readonly page: Page) {}
  get heading() {
    return this.page.getByRole('main').getByRole('heading', { name: /Doctors/i, level: 1 });
  }
}
