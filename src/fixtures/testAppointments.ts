import { randomInt, randomUUID } from 'node:crypto';
import type { ApiClient } from '../api/ApiClient';
import type { Appointment, Doctor } from '../api/types';
import { apiCalendarDate, dateAfter } from '../support/dates';
import { expect } from './matchers';

export type Slot = { doctorId: number; date: string; time: string };
export type CreatedAppointment = Slot & { id: number; marker: string };

/**
 * Appointments the UI flows create, found and removed through the API only (no database needed).
 * Every appointment carries a unique `qa-suite` marker in its notes. After the test, anything
 * carrying one of this test's markers is deleted, and each deletion is confirmed with a 404.
 */
export class TestAppointments {
  private readonly markers = new Set<string>();

  constructor(private readonly api: ApiClient) {}

  /** A unique note that identifies an appointment created by this test. */
  newMarker(): string {
    const marker = `qa-suite ui ${randomUUID()}`;
    this.markers.add(marker);
    return marker;
  }

  /**
   * A time from the first active doctor's schedule, on a random date two to six months ahead.
   * The API offers no per-date vacancy (Part 1, BUG-01), so the far, random date keeps a clash with
   * another patient unlikely; the patient's own appointments and `avoid` are always excluded.
   */
  async freeSlot(avoid?: Slot): Promise<Slot> {
    const doctors = await this.json<Doctor[]>(this.api.listDoctors(), 'active doctors');
    const doctorId = avoid?.doctorId ?? doctors[0]!.id;
    const { time_slots: times } = await this.json<{ time_slots: string[] }>(
      this.api.getDoctorAvailability(doctorId),
      `doctor ${doctorId} availability`,
    );
    const own = await this.json<Appointment[]>(this.api.listAppointments(), 'own appointments');
    for (let attempt = 0; attempt < 50; attempt++) {
      const slot = {
        doctorId,
        date: dateAfter(60 + randomInt(120)),
        time: times[randomInt(times.length)]!,
      };
      const taken = [
        avoid,
        ...own.map((a) => ({
          doctorId: a.doctor_id,
          date: apiCalendarDate(a.appointment_date),
          time: a.time_slot,
        })),
      ].some(
        (other) =>
          other &&
          other.doctorId === slot.doctorId &&
          other.date === slot.date &&
          other.time === slot.time,
      );
      if (!taken) return slot;
    }
    throw new Error(`No free slot found for doctor ${doctorId}`);
  }

  /** Books an appointment through the API, as setup for a flow that starts from an existing one. */
  async create(slot: Slot): Promise<CreatedAppointment> {
    const marker = this.newMarker();
    const response = await this.api.createAppointment({
      doctor_id: slot.doctorId,
      appointment_date: slot.date,
      time_slot: slot.time,
      notes: marker,
    });
    await expect(response).toHaveStatus(201);
    const { id } = (await response.json()) as Appointment;
    return { ...slot, id, marker };
  }

  /** The patient's appointment carrying `marker`, as the API reports it, or undefined. */
  async findByMarker(marker: string): Promise<Appointment | undefined> {
    const own = await this.json<Appointment[]>(this.api.listAppointments(), 'own appointments');
    return own.find((appointment) => appointment.notes === marker);
  }

  /** Deletes every appointment carrying one of this test's markers and confirms each is gone. */
  async cleanup(): Promise<void> {
    if (this.markers.size === 0) return;
    const own = await this.json<Appointment[]>(this.api.listAppointments(), 'own appointments');
    const failures: string[] = [];
    for (const appointment of own.filter((a) => a.notes !== null && this.markers.has(a.notes))) {
      const deleted = await this.api.deleteAppointment(appointment.id);
      const after = await this.api.getAppointment(appointment.id);
      if (after.status() !== 404) {
        failures.push(
          `appointment ${appointment.id}: DELETE ${deleted.status()}, then GET ${after.status()}`,
        );
      }
    }
    this.markers.clear();
    if (failures.length)
      throw new Error(`Test appointments were not removed: ${failures.join('; ')}`);
  }

  private async json<T>(request: ReturnType<ApiClient['getMe']>, what: string): Promise<T> {
    const response = await request;
    expect(response.ok(), `${what}: HTTP ${response.status()}`).toBe(true);
    return (await response.json()) as T;
  }
}
