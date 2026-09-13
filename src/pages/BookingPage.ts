import type { Locator, Page, Response } from '@playwright/test';

export type BookingForm = { doctorId: number; date: string; time: string; notes?: string };

export class BookingPage {
  readonly doctor: Locator;
  readonly date: Locator;
  readonly timeSlot: Locator;
  readonly notes: Locator;
  readonly submit: Locator;
  readonly confirmation: Locator;
  readonly viewAppointments: Locator;

  constructor(private readonly page: Page) {
    this.doctor = page.locator('#doctor_id').describe('Doctor select');
    this.date = page.locator('#appointment_date').describe('Date input');
    this.timeSlot = page.locator('#time_slot').describe('Time slot select');
    this.notes = page.locator('#notes').describe('Notes');
    this.submit = page.getByTestId('submit-appointment').describe('Book Appointment button');
    this.confirmation = page
      .getByRole('heading', { name: 'Appointment Booked!' })
      .describe('Booking confirmation');
    this.viewAppointments = page
      .getByRole('button', { name: 'View Appointments' })
      .or(page.getByRole('link', { name: 'View Appointments' }))
      .describe('View Appointments button');
  }

  async goto(): Promise<void> {
    await this.page.goto('/appointments/new');
  }

  /** Chooses the doctor, waits for their time slots, then fills the rest of the form. */
  async fill({ doctorId, date, time, notes }: BookingForm): Promise<Response> {
    const availability = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === `/api/doctors/${doctorId}/availability`,
    );
    await this.doctor.selectOption(String(doctorId));
    const slotsLoaded = await availability;
    await this.date.fill(date);
    await this.timeSlot.selectOption(time);
    if (notes !== undefined) await this.notes.fill(notes);
    return slotsLoaded;
  }
}
