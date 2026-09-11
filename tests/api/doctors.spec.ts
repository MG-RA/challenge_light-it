import { test, expect, expectJson } from '../../src/fixtures';
import type { Doctor } from '../../src/api/types';

test.describe('Doctors API', () => {
  test('GET /doctors lists exactly the active doctors in the DB', async ({ api, db }) => {
    const res = await api.listDoctors();
    await expect(res).toHaveStatus(200);
    // Cast rather than expectJson: the list fails the Doctor schema until F-01 is fixed.
    const doctors = (await res.json()) as Doctor[];

    const dbActive = await db.activeDoctors();
    expect(doctors.map((d) => d.id).toSorted((a, b) => a - b)).toEqual(dbActive.map((d) => d.id));
  });

  // Expected to fail until F-01 is fixed; an unexpected pass turns the run red.
  // Note: while marked, *any* failure here counts as expected.
  test.fail(
    'GET /doctors items match the Doctor schema from the spec',
    { annotation: { type: 'issue', description: 'F-01: list omits is_active & consultation_fee (docs/FINDINGS.md)' } },
    async ({ api }) => {
      await expectJson(await api.listDoctors(), 200, 'Doctor[]');
    },
  );

  test('GET /doctors/:id returns 404 for an unknown doctor', async ({ api, db }) => {
    const res = await api.getDoctor(await db.unusedDoctorId());
    await expect(res).toHaveStatus(404);
  });
});
