import { unmodeledSchemas } from '../../src/api/contract';
import { saveSpec } from '../../src/api/spec';
import { loadToken } from '../../src/auth/session';
import { test as setup, expect } from '../../src/fixtures';

// The API docs sit behind the same login, so the contract is downloaded per run, never committed.
setup('download the OpenAPI contract', async ({ anonApi }) => {
  const docs = await anonApi.getOpenApiSpec(loadToken());
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
