import type { Page } from '@playwright/test';

export class BookingPage {
  constructor(private readonly page: Page) {}
  get doctor() { return this.page.getByLabel('Doctor', { exact: true }); }
  get date() { return this.page.getByLabel('Date', { exact: true }); }
  get slots() { return this.page.getByLabel('Time Slot', { exact: true }).locator('option').filter({ hasNotText: 'Select a time slot' }); }
  async goto() { await this.page.goto('/appointments/new'); }
}
