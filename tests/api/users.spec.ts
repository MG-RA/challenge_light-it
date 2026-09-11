import { test, expect } from '../../src/fixtures';
import type { User } from '../../src/api/types';
import { env } from '../../src/config/env';

test.describe('Users API', () => {
  test('GET /users/me returns the logged-in user, matching the DB', async ({ api, db }) => {
    const res = await api.getMe();
    expect(res.status()).toBe(200);
    const me = (await res.json()) as User;

    expect(me.email).toBe(env.user.email);
    expect(me).not.toHaveProperty('password_hash');

    const dbUser = await db.userByEmail(env.user.email);
    expect(me).toMatchObject({
      id: dbUser.id,
      first_name: dbUser.first_name,
      last_name: dbUser.last_name,
    });
  });
});
