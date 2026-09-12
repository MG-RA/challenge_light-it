import type { APIResponse } from '@playwright/test';
import { missingFields, type SchemaData, type SchemaRef, type SpecData } from '../api/contract';
import { expect } from './matchers';

/**
 * Asserts the status and that the body matches `schema` from the spec, then
 * returns optional properties, as specified by the literal component schemas.
 */
export async function expectJson<R extends SchemaRef>(
  response: APIResponse,
  status: number,
  schema: R,
): Promise<SpecData<R>> {
  await expect(response).toHaveStatus(status);
  const body: unknown = await response.json();
  expect(body).toMatchSchema(schema);
  return body as SpecData<R>;
}

/** Literal schema validation plus the separately documented field-completeness policy. */
export async function expectCompleteJson<R extends SchemaRef>(
  response: APIResponse,
  status: number,
  schema: R,
): Promise<SchemaData<R>> {
  const body = await expectJson(response, status, schema);
  expect(missingFields(schema, body), `${schema} field-completeness policy`).toEqual([]);
  return body as SchemaData<R>;
}
