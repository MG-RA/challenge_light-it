import { test, expect } from '../../src/fixtures';
import type { ApiClient } from '../../src/api/ApiClient';

test.describe('Auth API', () => {
  test('rejects wrong password with 401', async ({ anonApi, credentials }) => {
    await expect(await anonApi.login({ email: credentials.email, password: 'definitely-wrong' })).toHaveStatus(401);
  });

  for (const token of [undefined, 'not-a-jwt']) {
    const mode = token === undefined ? 'missing' : 'malformed';
    for (const endpoint of ['profile', 'doctors', 'appointments', 'payments', 'notifications'] as const) {
      test(`${endpoint} rejects a ${mode} token`, async ({ anonApi }) => {
        const client = anonApi.withToken(token);
        const read: Record<typeof endpoint, () => ReturnType<ApiClient['getMe']>> = {
          profile: () => client.getMe(),
          doctors: () => client.listDoctors(),
          appointments: () => client.listAppointments(),
          payments: () => client.listPayments(),
          notifications: () => client.listNotifications(),
        };
        await expect(await read[endpoint]()).toHaveStatus(401);
      });
    }

    for (const endpoint of ['doctor detail', 'doctor availability', 'appointment detail'] as const) {
      test(`${endpoint} rejects a ${mode} token`, async ({ anonApi, db, testUser }) => {
        const isAppointment = endpoint === 'appointment detail';
        const [row] = isAppointment ? await db.appointmentsForPatient(testUser.id) : await db.activeDoctors();
        test.skip(!row, `No ${isAppointment ? 'owned appointment' : 'active doctor'} for auth gate coverage`);
        if (!row) return;
        const client = anonApi.withToken(token);
        const response = endpoint === 'doctor detail' ? await client.getDoctor(row.id)
          : endpoint === 'doctor availability' ? await client.getDoctorAvailability(row.id)
            : await client.getAppointment(row.id);
        await expect(response).toHaveStatus(401);
      });
    }
  }
});
