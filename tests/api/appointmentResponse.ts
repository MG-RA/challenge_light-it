import type { APIResponse } from '@playwright/test';
import type { Appointment } from '../../src/api/types';
import { missingFields } from '../../src/api/contract';
import { expect } from '../../src/fixtures/matchers';

/**
 * F-15 compatibility for data/header tests only. The API serializes dates as exact
 * UTC-midnight timestamps. Dedicated raw-contract tests keep that deviation red
 * (expected failure). Do not accept other datetime formats or weaken the spec.
 */
export async function readAppointments(response: APIResponse, kind: 'list' | 'detail') {
  await expect(response).toHaveStatus(200);
  const raw: unknown = await response.json();
  if (kind === 'list') expect(Array.isArray(raw), 'appointment list is an array').toBe(true);
  const records: unknown[] = kind === 'list' ? raw as unknown[] : [raw];
  const dateFormatViolations: { index: number; date: string }[] = [];
  const normalized = records.map((record, index) => {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) return record;
    const appointment = record as Record<string, unknown>;
    const date = appointment.appointment_date;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(date)) {
      dateFormatViolations.push({ index, date });
      return { ...appointment, appointment_date: date.slice(0, 10) };
    }
    return appointment;
  });
  // All other fields, missing properties and calendar validity still fail normally.
  expect(normalized).toMatchSchema('Appointment[]');
  expect(missingFields('Appointment[]', normalized), 'Appointment field-completeness policy').toEqual([]);
  return { appointments: normalized as Appointment[], dateFormatViolations };
}
