import type { Page } from '@playwright/test';

export class BookingPage {
  constructor(private readonly page: Page) {}
  get doctor() { return this.page.locator('#doctor_id').describe('Doctor select'); }
  get date() { return this.page.locator('#appointment_date').describe('Date input'); }
  get timeSlot() { return this.page.locator('#time_slot').describe('Time slot select'); }
  get slots() {
    return this.timeSlot.locator('option').filter({ hasNotText: 'Select a time slot' }).describe('Time slot options');
  }
  get submit() { return this.page.getByTestId('submit-appointment').describe('Book Appointment button'); }
  /** The option for one exact time, e.g. "09:00". */
  slot(time: string) {
    return this.timeSlot.locator('option').filter({ hasText: new RegExp(`^${time}$`) }).describe(`Time slot option ${time}`);
  }
  async goto() { await this.page.goto('/appointments/new'); }
}
