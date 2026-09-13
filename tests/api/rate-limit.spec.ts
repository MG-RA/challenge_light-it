import { test, expect } from '../../src/fixtures';

test('login throttles a bounded series of failed attempts', { tag: '@rate-limit' }, async ({ anonApi, credentials }) => {
  test.skip(process.env.RUN_RATE_LIMIT !== '1', 'Explicit bounded security run, isolated from normal login tests');
  expect(test.info().config.workers, 'rate-limit run requires one worker').toBe(1);
  expect(test.info().project.retries, 'rate-limit run must not retry').toBe(0);
  test.setTimeout(60000);
  // Proposed acceptance bound, not a documented server threshold. Never guess passwords.
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await anonApi.login({ email: credentials.email, password: 'deliberately-invalid-rate-limit-check' });
    statuses.push(response.status());
    expect([401, 429]).toContain(response.status());
    if (response.status() === 429) break;
  }
  test.info().annotations.push({ type: 'observation', description: `Failed attempt statuses: ${statuses.join(', ')}` });
  expect(statuses, 'proposed policy: throttle within 10 failed attempts; no 429 is not proof of unlimited attempts').toContain(429);
});
