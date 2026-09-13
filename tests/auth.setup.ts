import { unmodeledSchemas } from '../src/api/contract';
import { saveSpec } from '../src/api/spec';
import { saveSession } from '../src/auth/session';
import { test as setup, expect } from '../src/fixtures';

// Log in ONCE per run via the API (login is rate-limited, documented 429) and
// reuse the JWT for both API tests and the browser.
// UI login itself is covered explicitly in tests/ui/login.spec.ts.
setup('authenticate', async ({ anonApi, credentials }) => {
  const res = await anonApi.login(credentials);
  await expect(res).toHaveStatus(200);
  const { token } = (await res.json()) as { token: string };
  expect(token, 'login response contains a session token').toBeTruthy();
  saveSession(token);

  // The API docs sit behind the same login, so the contract is downloaded per run, never committed.
  await setup.step('download the OpenAPI contract', async () => {
    const docs = await anonApi.getOpenApiSpec(token);
    await expect(docs).toHaveStatus(200);
    const { spec, sha256 } = saveSpec(await docs.text());
    const unmodeled = unmodeledSchemas(spec);
    setup.info().annotations.push({
      type: 'contract',
      description:
        `${spec.info.title} ${spec.info.version}, sha256 ${sha256.slice(0, 16)}` +
        (unmodeled.length ? `; schemas not modeled by the suite: ${unmodeled.join(', ')}` : ''),
    });
  });
});
