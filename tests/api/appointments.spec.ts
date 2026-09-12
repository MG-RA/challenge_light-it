import { readAppointments } from './appointmentResponse';
import {
  expectAppointmentGone,
  expectAppointmentUnchanged,
  expectNothingStored,
  expectStoredAppointment,
} from './dbState';
import { dateAfter, test, expect } from './writes';

test.describe('Appointments API', () => {
  test('GET /appointments contains only the patient records and matches the DB', async ({ api, db, testUser }) => {
    const { appointments } = await readAppointments(await api.listAppointments(), 'list');
    const rows = await db.appointmentsForPatient(testUser.id);
    expect(appointments.map((a) => a.id).toSorted((a, b) => a - b)).toEqual(rows.map((a) => a.id));
    for (const appointment of appointments) {
      expect(appointment.patient_id).toBe(testUser.id);
      expect(appointment).toMatchObject({ ...rows.find((row) => row.id === appointment.id)! });
    }
  });

  test('GET /appointments/:id returns an owned appointment matching the DB', async ({ api, db, testUser }) => {
    const [row] = await db.appointmentsForPatient(testUser.id);
    test.skip(!row, 'No owned appointment available for detail coverage');
    if (!row) return;
    const { appointments: [appointment] } = await readAppointments(await api.getAppointment(row.id), 'detail');
    expect(appointment).toMatchObject({ ...row });
    expect(appointment!.patient_id).toBe(testUser.id);
  });

  for (const kind of ['list', 'detail'] as const) {
    test(`appointment ${kind} uses the OpenAPI date-only format`,
      { annotation: { type: 'issue', description: 'F-15: appointment_date is a timestamp, not date (docs/FINDINGS.md)' } },
      async ({ api, db, testUser }) => {
        const [row] = await db.appointmentsForPatient(testUser.id);
        test.skip(!row, 'No owned appointment available for date-format coverage');
        if (!row) return;
        const response = await (kind === 'list' ? api.listAppointments() : api.getAppointment(row.id));
        const { appointments, dateFormatViolations } = await readAppointments(response, kind);
        expect(appointments.length).toBeGreaterThan(0);
        for (const appointment of appointments) expect(appointment.patient_id).toBe(testUser.id);
        test.fail(true, 'F-15: only exact UTC-midnight timestamp serialization may fail');
        expect(dateFormatViolations).toEqual([]);
      });
  }
});

// Writes owned, marked appointments on the shared target and removes them afterwards.
test.describe('Appointments API writes', { tag: '@mutating' }, () => {
  test('POST /appointments stores exactly one owned appointment and detail agrees', async ({ owned, api, db, testUser }) => {
    const booked = await owned.book();
    await expectStoredAppointment(db, booked.id, testUser.id, {
      ...booked.payload, patient_id: testUser.id,
    });
    const { appointments: [detail] } = await readAppointments(await api.getAppointment(booked.id), 'detail');
    const { created_at: _created, updated_at: _updated, ...stored } = booked.row;
    expect(detail).toMatchObject(stored);
  });

  test('PUT /appointments/:id/reschedule stores the new slot and preserves identity', async ({ owned, db, testUser }) => {
    const booked = await owned.book();
    const next = await owned.freeSlot(booked.doctor, booked.row);
    const { appointment_date, time_slot } = next.body;
    const result = await owned.reschedule(booked.id, { appointment_date, time_slot });
    expect(result.status).toBe(200);
    await expectStoredAppointment(db, booked.id, testUser.id, {
      appointment_date, time_slot,
      id: booked.id, patient_id: testUser.id, doctor_id: booked.row.doctor_id, notes: booked.marker,
    });
  });

  test('PUT /appointments/:id/cancel stores the cancellation without touching a control', async ({ owned, db, testUser }) => {
    const booked = await owned.book();
    const control = await owned.book();
    const result = await owned.cancel(booked.id);
    expect(result.status).toBe(200);
    await expectStoredAppointment(db, booked.id, testUser.id, { id: booked.id, status: 'cancelled' });
    await expectAppointmentUnchanged(db, testUser.id, control.row);
  });

  test('DELETE /appointments/:id removes the row and detail returns 404', async ({ owned, api, db, testUser }) => {
    const booked = await owned.book();
    const result = await owned.remove(booked.id);
    expect(result.status).toBe(200);
    await expectAppointmentGone(db, booked.id, testUser.id);
    await expect(await api.getAppointment(booked.id)).toHaveStatus(404);
  });

  for (const scenario of ['missing doctor', 'yesterday', 'year 0123', 'invalid clock', 'inactive doctor'] as const) {
    test(`POST /appointments rejects ${scenario} without storing a row`, async ({ owned, db, testUser }) => {
      const { body } = await owned.freeSlot();
      const payload: Partial<typeof body> = { ...body };
      if (scenario === 'missing doctor') delete payload.doctor_id;
      if (scenario === 'yesterday') payload.appointment_date = dateAfter(-1);
      if (scenario === 'year 0123') payload.appointment_date = '0123-11-23';
      if (scenario === 'invalid clock') payload.time_slot = '25:99';
      if (scenario === 'inactive doctor') {
        const inactive = await db.inactiveDoctor();
        test.skip(!inactive, 'No inactive doctor exists for this validation case');
        if (!inactive) return;
        payload.doctor_id = inactive.id;
      }
      const result = await owned.create(payload);
      expect.soft(scenario === 'missing doctor' ? [400] : [400, 409], 'proposed business validation expectation')
        .toContain(result.status);
      await expectNothingStored(db, result.marker, testUser.id);
    });
  }

  test('POST /appointments rejects a duplicate slot and leaves exactly one booking', async ({ owned, db, testUser }) => {
    const first = await owned.book();
    const second = await owned.create(first.payload);
    expect.soft([400, 409], 'proposed conflict expectation').toContain(second.status);
    await expectNothingStored(db, second.marker, testUser.id);
    await expectAppointmentUnchanged(db, testUser.id, first.row);
  });

  test('PUT /appointments/:id/reschedule rejects an invalid body and stores no change', async ({ owned, db, testUser }) => {
    const booked = await owned.book();
    const result = await owned.reschedule(booked.id, { appointment_date: dateAfter(-1), time_slot: '25:99' });
    expect.soft([400, 409], 'proposed business validation expectation').toContain(result.status);
    await expectAppointmentUnchanged(db, testUser.id, result.before);
  });
});
