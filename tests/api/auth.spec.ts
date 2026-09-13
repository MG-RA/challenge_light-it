import { test, expect } from '../../src/fixtures';
import type { ApiClient } from '../../src/api/ApiClient';
import { decodeJwtPayload, forgeJwt } from '../../src/auth/jwt';
import { expectUnsignedTokenDenied } from './knownDefectChecks';

test.describe('Auth API', () => {
  test('rejects wrong password with 401', async ({ anonApi, credentials }) => {
    await expect(
      await anonApi.login({ email: credentials.email, password: 'definitely-wrong' }),
    ).toHaveStatus(401);
  });

  for (const token of [undefined, 'not-a-jwt']) {
    const mode = token === undefined ? 'missing' : 'malformed';
    for (const endpoint of [
      'profile',
      'doctors',
      'appointments',
      'payments',
      'notifications',
    ] as const) {
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

    for (const endpoint of [
      'doctor detail',
      'doctor availability',
      'appointment detail',
    ] as const) {
      test(`${endpoint} rejects a ${mode} token`, async ({ anonApi, db, testUser }) => {
        const isAppointment = endpoint === 'appointment detail';
        const [row] = isAppointment
          ? await db.appointmentsForPatient(testUser.id)
          : await db.activeDoctors();
        test.skip(
          !row,
          `No ${isAppointment ? 'owned appointment' : 'active doctor'} for auth gate coverage`,
        );
        if (!row) return;
        const client = anonApi.withToken(token);
        const readDetail: Record<typeof endpoint, () => ReturnType<ApiClient['getMe']>> = {
          'doctor detail': () => client.getDoctor(row.id),
          'doctor availability': () => client.getDoctorAvailability(row.id),
          'appointment detail': () => client.getAppointment(row.id),
        };
        await expect(await readDetail[endpoint]()).toHaveStatus(401);
      });
    }
  }
});

// Read-only isolation checks that need no second account: the other record and user
// come from the DB, and no request is sent with that user's credentials.
test.describe('Authorization boundaries', () => {
  test("appointment detail refuses another patient's appointment", async ({
    api,
    db,
    testUser,
  }) => {
    const other = await db.otherPatientAppointment(testUser.id);
    test.skip(!other, 'No appointment owned by another patient for isolation coverage');
    if (!other) return;
    const response = await api.getAppointment(other.id);
    await expect(response).toHaveStatus(403);
    const body: unknown = await response.json().catch(() => ({}));
    expect(body ?? {}, 'a refusal must not disclose appointment data').not.toHaveProperty(
      'patient_id',
    );
  });

  test('profile rejects a token whose user_id was altered', async ({
    anonApi,
    db,
    testUser,
    token,
  }) => {
    const other = await db.otherPatientAppointment(testUser.id);
    test.skip(!other, 'No other patient to impersonate');
    if (!other) return;
    // Guard: if the identity claim is renamed, fail here rather than forge a meaningless token.
    expect(decodeJwtPayload(token), 'session token identity claim').toMatchObject({
      user_id: testUser.id,
    });
    const forged = forgeJwt(token, { payload: { user_id: other.patient_id } });
    await expect(await anonApi.withToken(forged).getMe()).toHaveStatus(401);
  });

  // Keeps a signature so the request reaches the API: the edge firewall blocks empty signatures first (F-20).
  test('profile rejects a token with an alg:none header', async ({ anonApi, token }) => {
    const forged = forgeJwt(token, { header: { alg: 'none', typ: 'JWT' } });
    await expect(await anonApi.withToken(forged).getMe()).toHaveStatus(401);
  });

  test(
    'profile answers an empty-signature token with the documented 401',
    {
      annotation: {
        type: 'issue',
        description: 'F-20: edge firewall returns text/plain 403 (docs/FINDINGS.md)',
      },
    },
    async ({ anonApi, token }) => {
      const unsigned = forgeJwt(token, { header: { alg: 'none', typ: 'JWT' }, signature: '' });
      const response = await anonApi.withToken(unsigned).getMe();
      expectUnsignedTokenDenied(response);
      test.fail(true, 'F-20: only the edge firewall 403 may fail');
      await expect(response).toHaveStatus(401);
    },
  );
});
