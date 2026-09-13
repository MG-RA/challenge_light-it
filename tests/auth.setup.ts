import { saveSession } from '../src/auth/session';
import { test as setup, expect } from '../src/fixtures';

// Log in ONCE per run via the API (login is rate-limited, documented 429) and
// reuse the JWT for both API tests and the browser.
// UI login itself is covered explicitly in tests/ui/login.spec.ts.
setup('authenticate', async ({ anonApi, credentials }) => {
  const res = await anonApi.login(credentials);
  await expect(res).toHaveStatus(200);
  const { token } = (await res.json()) as { token: string };
  expect(token).toBeTruthy();
  saveSession(token);
});
