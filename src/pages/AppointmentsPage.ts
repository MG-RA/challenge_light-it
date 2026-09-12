import type { Page } from '@playwright/test';

export class AppointmentsPage {
  constructor(private readonly page: Page) {}
  get heading() {
    return this.page.getByRole('main').getByRole('heading', { name: /Appointments/i, level: 1 });
  }
}
