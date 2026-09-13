import { test, expect, expectJson, expectCompleteJson } from '../../src/fixtures';
import { doctorCompletenessGaps } from './knownDefectChecks';

test.describe('Doctors API', () => {
  test('GET /doctors lists exactly the active doctors in the DB', async ({ api, db }) => {
    const doctors = await expectJson(await api.listDoctors(), 200, 'Doctor[]');
    const dbActive = await db.activeDoctors();
    // Raw schema properties are optional; explicitly require the identity used for reconciliation.
    for (const doctor of doctors) expect(doctor.id).toEqual(expect.any(Number));
    expect(doctors.map((d) => d.id!).toSorted((a, b) => a - b)).toEqual(dbActive.map((d) => d.id));
    for (const row of dbActive) {
      expect(doctors.find((d) => d.id === row.id)).toMatchObject({
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        specialty: row.specialty,
        bio: row.bio,
        avatar_url: row.avatar_url,
      });
    }
  });

  test(
    'GET /doctors satisfies the field-completeness policy',
    {
      annotation: {
        type: 'issue',
        description: 'F-01: list omits fee and active fields; completeness policy, not raw OpenAPI',
      },
    },
    async ({ api }) => {
      const { doctors, gaps } = await doctorCompletenessGaps(await api.listDoctors());
      test.skip(doctors.length === 0, 'No doctors available to assess item completeness');
      test.fail(true, 'F-01: only missing is_active/consultation_fee may fail');
      expect(gaps).toEqual([]);
    },
  );

  test('GET /doctors/:id matches the stored doctor', async ({ api, db }) => {
    const [row] = await db.activeDoctors();
    test.skip(!row, 'No active doctor available for detail coverage');
    if (!row) return;
    const doctor = await expectCompleteJson(await api.getDoctor(row.id), 200, 'Doctor');
    const { consultation_fee, ...stored } = row;
    expect(doctor).toMatchObject(stored);
    expect(doctor.consultation_fee).toMatch(/^-?\d+(?:\.\d+)?$/);
    expect(Number.isFinite(Number(doctor.consultation_fee))).toBe(true);
    expect(Number(doctor.consultation_fee)).toBe(Number(consultation_fee));
  });

  test('GET /doctors/:id/availability returns valid clock slots', async ({ api, db }) => {
    const [row] = await db.activeDoctors();
    test.skip(!row, 'No active doctor available for availability coverage');
    if (!row) return;
    const response = await api.getDoctorAvailability(row.id);
    await expect(response).toHaveStatus(200);
    const body: unknown = await response.json();
    expect(body).toEqual(expect.objectContaining({ time_slots: expect.any(Array) }));
    const slots = (body as { time_slots: unknown[] }).time_slots;
    for (const slot of slots) expect(slot).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
    expect(new Set(slots).size, 'no duplicate slots').toBe(slots.length);
  });

  test('GET /doctors/:id returns 404 for an unknown doctor', async ({ api, db }) => {
    await expect(await api.getDoctor(await db.unusedDoctorId())).toHaveStatus(404);
  });
});
