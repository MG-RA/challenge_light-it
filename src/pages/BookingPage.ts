import type { Page } from '@playwright/test';

export class BookingPage {
  constructor(private readonly page: Page) {}
  get doctor() { return this.page.locator('#doctor_id').describe('Doctor select'); }
  get date() { return this.page.locator('#appointment_date').describe('Date input'); }
  get slots() {
    return this.page.locator('#time_slot').locator('option').filter({ hasNotText: 'Select a time slot' })
      .describe('Time slot options');
  }
  async goto() { await this.page.goto('/appointments/new'); }
}
