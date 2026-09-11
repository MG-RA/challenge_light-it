import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/config/env';
import { test as setup, expect } from '../src/fixtures';
import { AUTH_STATE_FILE, AUTH_TOKEN_FILE } from '../src/fixtures/paths';

// Log in ONCE per run via the API (login is rate-limited, documented 429) and
// reuse the JWT for both API tests and the browser (the SPA reads localStorage.token).
// UI login itself is covered explicitly in tests/ui/login.spec.ts.
setup('authenticate', async ({ anonApi }) => {
  const res = await anonApi.login({ email: env.user.email, password: env.user.password });
  await expect(res).toHaveStatus(200);
  const { token } = (await res.json()) as { token: string };
  expect(token).toBeTruthy();

  fs.mkdirSync(path.dirname(AUTH_TOKEN_FILE), { recursive: true });
  fs.writeFileSync(AUTH_TOKEN_FILE, JSON.stringify({ token }));
  fs.writeFileSync(
    AUTH_STATE_FILE,
    JSON.stringify({
      cookies: [],
      origins: [{ origin: new URL(env.baseUrl).origin, localStorage: [{ name: 'token', value: token }] }],
    }),
  );
});
