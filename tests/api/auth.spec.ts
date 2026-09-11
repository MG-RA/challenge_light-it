import { test, expect } from '../../src/fixtures';

test.describe('Auth API', () => {
  test('rejects wrong password with 401', async ({ anonApi, credentials }) => {
    const res = await anonApi.login({ email: credentials.email, password: 'definitely-wrong' });
    await expect(res).toHaveStatus(401);
  });

  test('protected endpoint requires a token', async ({ anonApi }) => {
    const res = await anonApi.getMe();
    await expect(res).toHaveStatus(401);
  });

  test('protected endpoint rejects a malformed token', async ({ anonApi }) => {
    const res = await anonApi.withToken('not-a-jwt').getMe();
    await expect(res).toHaveStatus(401);
  });
});
