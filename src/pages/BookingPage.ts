import type { Locator, Page, Response } from '@playwright/test';

/** A doctor picked by database id, or by position in the select (1 is the first real doctor). */
export type DoctorChoice = { id: number } | { index: number };
/** The fields to fill; omitted fields are left empty. */
export type BookingForm = { doctor?: DoctorChoice; date?: string; slot?: string };
/** Form controls by the field name used in the API payload. */
export type BookingField = 'doctor_id' | 'appointment_date' | 'time_slot';

export class BookingPage {
  readonly doctor: Locator;
  readonly date: Locator;
  readonly timeSlot: Locator;
  /** Selectable time options, excluding the "Select a time slot" placeholder. */
  readonly slots: Locator;
  readonly submit: Locator;
  readonly availabilityError: Locator;

  constructor(private readonly page: Page) {
    this.doctor = page.locator('#doctor_id').describe('Doctor select');
    this.date = page.locator('#appointment_date').describe('Date input');
    this.timeSlot = page.locator('#time_slot').describe('Time slot select');
    this.slots = this.timeSlot
      .locator('option')
      .filter({ hasNotText: 'Select a time slot' })
      .describe('Time slot options');
    this.submit = page.getByTestId('submit-appointment').describe('Book Appointment button');
    this.availabilityError = page
      .getByText(/availability unavailable|unable to load|failed to.*availability/i)
      .describe('Availability load error');
  }

  async goto(): Promise<void> {
    await this.page.goto('/appointments/new');
  }

  field(name: BookingField): Locator {
    return { doctor_id: this.doctor, appointment_date: this.date, time_slot: this.timeSlot }[name];
  }

  /** The option for one exact time, e.g. "09:00". */
  slot(time: string): Locator {
    return this.timeSlot
      .locator('option')
      .filter({ hasText: new RegExp(`^${time}$`) })
      .describe(`Time slot option ${time}`);
  }

  async chooseDoctor(doctor: DoctorChoice): Promise<void> {
    await this.doctor.selectOption('id' in doctor ? String(doctor.id) : { index: doctor.index });
  }

  /** Chooses a doctor and returns the availability response that loads their time slots. */
  async chooseDoctorAndWaitForSlots(doctorId: number): Promise<Response> {
    const availability = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === `/api/doctors/${doctorId}/availability`,
    );
    await this.chooseDoctor({ id: doctorId });
    return availability;
  }

  /** Fills the given fields in form order; the doctor goes first because it loads the slots. */
  async fill({ doctor, date, slot }: BookingForm): Promise<void> {
    if (doctor) await this.chooseDoctor(doctor);
    if (date !== undefined) await this.date.fill(date);
    if (slot !== undefined) await this.timeSlot.selectOption(slot);
  }
}
