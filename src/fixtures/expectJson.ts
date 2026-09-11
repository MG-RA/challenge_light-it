import type { APIResponse } from '@playwright/test';
import type { SchemaData, SchemaRef } from '../api/contract';
import { expect } from './matchers';

/**
 * Asserts the status and that the body matches `schema` from the spec, then
 * returns the body typed to match: validated, not just cast.
 */
export async function expectJson<R extends SchemaRef>(
  response: APIResponse,
  status: number,
  schema: R,
): Promise<SchemaData<R>> {
  await expect(response).toHaveStatus(status);
  const body: unknown = await response.json();
  expect(body).toMatchSchema(schema);
  return body as SchemaData<R>;
}
