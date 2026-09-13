import { randomInt, randomUUID } from 'node:crypto';
import type { ApiClient } from '../../src/api/ApiClient';
import type {
  CreateAppointmentRequest,
  CreatePaymentRequest,
  RescheduleAppointmentRequest,
} from '../../src/api/types';
import { mutationsEnabled } from '../../src/config/mutations';
import type { Db, DoctorRow, StateAppointmentRow } from '../../src/db/Db';
import { observe } from '../../src/db/observe';
import { test as base, expect } from '../../src/fixtures';
import { dateAfter } from '../../src/support/dates';

/** Bookings and payments this worker may submit; mutating runs use a single worker. */
const BOOKING_CAP = 20;
const PAYMENT_CAP = 4;
const runMarker = `qa-suite ${randomUUID()}`;
let bookingSubmissions = 0;
let paymentSubmissions = 0;

type Slot = { doctor: DoctorRow; body: CreateAppointmentRequest };
export type Booked = Awaited<ReturnType<OwnedData['book']>>;

/**
 * Owned test data for the `@mutating` API cases: every write carries a unique run
 * marker in `notes`, only marker-carrying rows are mutated, and teardown removes
 * whatever the test left. Verify the resulting state with tests/api/dbState.ts.
 */
export class OwnedData {
  private readonly created = new Map<number, string>();
  private readonly attemptedMarkers = new Set<string>();

  constructor(
    private readonly api: ApiClient,
    private readonly db: Db,
    readonly ownerId: number,
  ) {}

  /** A doctor/date/slot from the availability catalog that the DB shows as free. */
  async freeSlot(
    doctor?: DoctorRow,
    exclude?: { appointment_date: string; time_slot: string },
  ): Promise<Slot> {
    const selected = doctor ?? (await this.db.firstActiveDoctor());
    const response = await this.api.getDoctorAvailability(selected.id);
    await expect(response).toHaveStatus(200);
    const body: unknown = await response.json();
    expect(body, `availability body for doctor ${selected.id}`).toEqual(
      expect.objectContaining({ time_slots: expect.any(Array) }),
    );
    const slots = (body as { time_slots: unknown[] }).time_slots;
    for (const slot of slots)
      expect(slot, `time slot ${JSON.stringify(slot)} is HH:mm`).toMatch(
        /^(?:[01]\d|2[0-3]):[0-5]\d$/,
      );
    const occupied = await this.db.occupiedSlots(selected.id, dateAfter(1), dateAfter(30));
    const start = randomInt(30);
    for (let offset = 0; offset < 30; offset++) {
      const date = dateAfter(((start + offset) % 30) + 1);
      for (const time of slots as string[]) {
        if (exclude?.appointment_date === date && exclude.time_slot === time) continue;
        if (!occupied.some((a) => a.appointment_date === date && a.time_slot === time)) {
          return {
            doctor: selected,
            body: { doctor_id: selected.id, appointment_date: date, time_slot: time },
          };
        }
      }
    }
    throw new Error('No free catalog slot within the next 30 days; no write was attempted');
  }

  /** Send one create request and report the rows it stored under its own marker. */
  async create(body: Partial<CreateAppointmentRequest>) {
    if (++bookingSubmissions > BOOKING_CAP)
      throw new Error(`Booking submission cap (${BOOKING_CAP}) reached`);
    const marker = `${runMarker} ${randomUUID()}`;
    const payload = { ...body, notes: marker };
    // Retain intent before the request: a timeout can happen after the server commits.
    this.attemptedMarkers.add(marker);
    const response = await this.api.createAppointment(payload);
    // A rejected create can still have written, so look for the marker either way.
    const rows = await observe(
      () => this.db.markedAppointments(marker, this.ownerId),
      () => true,
    );
    for (const row of rows) this.created.set(row.id, marker);
    return {
      status: response.status(),
      body: await response.json().catch(() => undefined),
      marker,
      payload,
      rows,
    };
  }

  /** Create an appointment at a free slot and assert it stored exactly one owned row. */
  async book(doctor?: DoctorRow) {
    const slot = await this.freeSlot(doctor);
    // Point-in-time recheck; it is not a reservation against other bookers.
    const occupied = await this.db.occupiedSlots(
      slot.doctor.id,
      slot.body.appointment_date,
      slot.body.appointment_date,
    );
    expect(
      occupied.some((a) => a.time_slot === slot.body.time_slot),
      'slot still free before creation',
    ).toBe(false);
    const created = await this.create(slot.body);
    expect(created.status, 'create an appointment at a free slot').toBe(201);
    expect(created.rows, 'exactly one row per accepted create').toHaveLength(1);
    const row = created.rows[0]!;
    expect(row, 'stored row matches the submitted booking').toMatchObject({
      ...slot.body,
      patient_id: this.ownerId,
      notes: created.marker,
    });
    expect(
      ['active', 'pending', 'completed', 'cancelled'],
      'stored status is a documented value',
    ).toContain(row.status);
    return { ...created, doctor: slot.doctor, row, id: row.id };
  }

  /** Refuse to touch anything this run did not create and still own. */
  private async ownedRow(id: number): Promise<StateAppointmentRow> {
    const marker = this.created.get(id);
    const row = marker === undefined ? undefined : await this.db.stateAppointment(id, this.ownerId);
    if (!row || row.notes !== marker) {
      throw new Error(
        `Refusing to mutate appointment ${id}: not verified as created and owned by this run`,
      );
    }
    return row;
  }

  async reschedule(id: number, body: Partial<RescheduleAppointmentRequest>) {
    const before = await this.ownedRow(id);
    const response = await this.api.rescheduleAppointment(id, body as RescheduleAppointmentRequest);
    return {
      status: response.status(),
      body: await response.json().catch(() => undefined),
      before,
    };
  }

  async cancel(id: number) {
    const before = await this.ownedRow(id);
    const response = await this.api.cancelAppointment(id);
    return {
      status: response.status(),
      body: await response.json().catch(() => undefined),
      before,
    };
  }

  async remove(id: number) {
    const before = await this.ownedRow(id);
    const response = await this.api.deleteAppointment(id);
    return {
      status: response.status(),
      body: await response.json().catch(() => undefined),
      before,
    };
  }

  async pay(id: number, body: Omit<CreatePaymentRequest, 'appointment_id'>) {
    await this.ownedRow(id);
    if (++paymentSubmissions > PAYMENT_CAP)
      throw new Error(`Payment submission cap (${PAYMENT_CAP}) reached`);
    const before = await this.db.paymentsForAppointment(id);
    const response = await this.api.createPayment({ ...body, appointment_id: id });
    return {
      status: response.status(),
      body: await response.json().catch(() => undefined),
      before,
    };
  }

  /**
   * Delete everything still stored from this test. A paid appointment the API
   * refuses to delete is cancelled instead and reported as declared residue.
   */
  async cleanup(): Promise<string[]> {
    const failures: string[] = [];
    const residue: string[] = [];
    // Recover rows even when the request or its initial DB observation threw.
    for (const marker of this.attemptedMarkers) {
      try {
        const rows = await observe(
          () => this.db.markedAppointments(marker, this.ownerId),
          () => true,
        );
        for (const row of rows) this.created.set(row.id, marker);
      } catch {
        failures.push('could not reconcile an attempted create; marked rows may remain');
      }
    }
    for (const [id, marker] of this.created) {
      try {
        const row = await this.db.stateAppointment(id, this.ownerId);
        if (!row) continue;
        if (row.notes !== marker) throw new Error('row no longer carries its run marker');
        const payments = await this.db.paymentsForAppointment(id);
        const response = await this.api.deleteAppointment(id);
        const after = await observe(
          () => this.db.stateAppointment(id, this.ownerId),
          (r) => r === undefined,
        ).catch(() => this.db.stateAppointment(id, this.ownerId));
        if (!after) continue;
        if (payments.length === 0) throw new Error(`survived DELETE (HTTP ${response.status()})`);
        const cancellation = await this.api.cancelAppointment(id);
        if (cancellation.status() !== 200)
          throw new Error('linked payments blocked deletion and cancellation failed');
        await observe(
          () => this.db.stateAppointment(id, this.ownerId),
          (r) => r?.notes === marker && r.status === 'cancelled',
        );
        residue.push(
          `appointment ${id} kept and cancelled; ${payments.length} linked payment(s) blocked deletion`,
        );
      } catch (error) {
        failures.push(
          `appointment ${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.created.clear();
    this.attemptedMarkers.clear();
    if (failures.length)
      throw new Error(`Cleanup left owned test data behind: ${failures.join('; ')}`);
    return residue;
  }
}

/**
 * Adds the `owned` fixture to the shared test object. Read-only cases in these
 * files keep working unchanged; only `@mutating` cases request `owned`.
 */
export const test = base.extend<{ owned: OwnedData }>({
  owned: async ({ api, db, testUser }, use, info) => {
    if (!mutationsEnabled(process.env.RUN_MUTATING))
      throw new Error('Remote writes require RUN_MUTATING=1');
    if (info.config.workers !== 1 || info.project.retries !== 0) {
      throw new Error('Write cases need one worker and zero retries; do not override them');
    }
    const identity = await api.getMe();
    await expect(identity).toHaveStatus(200);
    expect(
      await identity.json(),
      'API token must belong to the configured DB account',
    ).toMatchObject({ id: testUser.id });

    const owned = new OwnedData(api, db, testUser.id);
    try {
      await use(owned);
    } finally {
      for (const note of await owned.cleanup())
        info.annotations.push({ type: 'residue', description: note });
    }
  },
});

export { expect };
