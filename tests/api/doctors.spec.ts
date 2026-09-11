import { test, expect } from '../../src/fixtures';
import type { Doctor } from '../../src/api/types';

const DOCTOR_KEYS: (keyof Doctor)[] = [
  'id', 'first_name', 'last_name', 'specialty', 'bio', 'avatar_url', 'is_active', 'consultation_fee',
];

test.describe('Doctors API', () => {
  test('GET /doctors lists exactly the active doctors in the DB', async ({ api, db }) => {
    const res = await api.listDoctors();
    expect(res.status()).toBe(200);
    const doctors = (await res.json()) as Doctor[];

    const dbActive = await db.activeDoctors();
    expect(doctors.map((d) => d.id).sort((a, b) => a - b)).toEqual(dbActive.map((d) => d.id));
  });

  test('GET /doctors items match the Doctor schema from the spec', async ({ api }) => {
    const doctors = (await (await api.listDoctors()).json()) as Doctor[];
    for (const d of doctors) {
      expect.soft(Object.keys(d).sort(), `doctor ${d.id} keys`).toEqual([...DOCTOR_KEYS].sort());
    }
  });

  test('GET /doctors/:id returns 404 for an unknown doctor', async ({ api }) => {
    const res = await api.getDoctor(999999);
    expect(res.status()).toBe(404);
  });
});
