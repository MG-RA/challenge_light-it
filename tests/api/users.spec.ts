import { test, expect, expectJson } from '../../src/fixtures';

test.describe('Users API', () => {
  test('GET /users/me returns the logged-in user, matching the DB', async ({ api, testUser }) => {
    const me = await expectJson(await api.getMe(), 200, 'User');

    expect(me).not.toHaveProperty('password_hash');
    expect(me).toMatchObject({
      id: testUser.id,
      email: testUser.email,
      first_name: testUser.first_name,
      last_name: testUser.last_name,
    });
  });
});
