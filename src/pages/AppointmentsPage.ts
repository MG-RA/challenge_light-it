import type { Locator, Page, Response } from '@playwright/test';

export class AppointmentsPage {
  readonly heading: Locator;
  readonly rescheduledMessage: Locator;

  constructor(private readonly page: Page) {
    this.heading = page
      .getByRole('main')
      .getByRole('heading', { name: 'Appointments', level: 1 })
      .describe('Appointments heading');
    this.rescheduledMessage = page
      .getByText('Appointment rescheduled successfully')
      .describe('Reschedule success message');
  }

  async goto(): Promise<void> {
    await this.page.goto('/appointments');
    await this.heading.waitFor();
  }

  /**
   * The card of the appointment whose notes are exactly `notes`. Cards have no test ids, so this is
   * the nearest block around the notes that also holds the card's Reschedule button.
   */
  card(notes: string): Locator {
    return this.page
      .getByRole('main')
      .getByText(notes, { exact: true })
      .locator('xpath=ancestor::div[.//button[contains(normalize-space(.), "Reschedule")]][1]')
      .describe(`Appointment card "${notes.slice(0, 24)}…"`);
  }

  /** The "M/D/YYYY • HH:mm" line of a card. */
  schedule(card: Locator): Locator {
    return card.getByText('•').describe('Appointment date and time');
  }

  /** Opens the card's reschedule form, picks the new date and time, confirms, and returns the API response. */
  async reschedule(
    card: Locator,
    { date, time }: { date: string; time: string },
  ): Promise<Response> {
    await card.getByRole('button', { name: /reschedule/i }).click();
    // Only one reschedule form is open at a time, and it holds the page's only date input and select.
    const form = this.page.getByRole('main');
    await form.locator('input[type=date]').fill(date);
    await form.getByRole('combobox').selectOption(time);
    const response = this.page.waitForResponse(
      (res) => res.request().method() === 'PUT' && res.url().includes('/reschedule'),
    );
    await form.getByRole('button', { name: 'Confirm', exact: true }).click();
    return response;
  }
}
