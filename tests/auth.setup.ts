import { saveSession } from '../src/auth/session';
import { test as setup, expect } from '../src/fixtures';

// Log in once per run through the API and reuse the session token: the browser flows start
// signed in, and the API clients send it as a bearer token. The sign-in flow itself is tested
// through the UI in tests/ui/sign-in-and-out.spec.ts.
setup('authenticate', async ({ anonApi, credentials }) => {
  const res = await anonApi.login(credentials);
  await expect(res).toHaveStatus(200);
  const { token } = (await res.json()) as { token: string };
  expect(token, 'login response contains a session token').toBeTruthy();
  saveSession(token);
});
