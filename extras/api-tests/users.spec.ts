import { test, expect, expectCompleteJson } from '../../src/fixtures';

test.describe('Users API', () => {
  test('GET /users/me returns the logged-in user, matching the DB', async ({ api, testUser }) => {
    const me = await expectCompleteJson(await api.getMe(), 200, 'User');

    expect(me, 'profile does not expose the password hash').not.toHaveProperty('password_hash');
    expect(me, 'profile matches the configured account in the DB').toMatchObject({
      id: testUser.id,
      email: testUser.email,
      first_name: testUser.first_name,
      last_name: testUser.last_name,
    });
  });
});
