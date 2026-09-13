import { expect as base, type APIResponse } from '@playwright/test';
import { schemaErrors, type SchemaRef } from '../api/contract';
import { diagnosticUrl, redactedBody } from './redact';

const MAX_ERRORS = 20;

export const expect = base.extend({
  /** Asserts the status code; unlike `expect(res.status()).toBe(n)`, the failure shows the body. */
  async toHaveStatus(response: APIResponse, expected: number) {
    const actual = response.status();
    const pass = actual === expected;
    const body = await response.text();
    const message = () =>
      `${this.utils.matcherHint('toHaveStatus', 'response', 'status', { isNot: this.isNot })}\n\n` +
      `${diagnosticUrl(response.url())}\n` +
      `Expected status: ${this.isNot ? 'not ' : ''}${this.utils.printExpected(expected)}\n` +
      `Received status: ${this.utils.printReceived(actual)}\n` +
      `Body: ${redactedBody(body)}`;
    return { name: 'toHaveStatus', pass, expected, actual, message };
  },

  /** Asserts `received` conforms to a schema from docs/openapi.json (see src/api/contract.ts). */
  toMatchSchema(received: unknown, ref: SchemaRef) {
    const errors = schemaErrors(ref, received);
    const pass = errors.length === 0;
    const shown = errors.slice(0, MAX_ERRORS).map((e) => `  - ${e}`);
    if (errors.length > MAX_ERRORS) shown.push(`  … and ${errors.length - MAX_ERRORS} more`);
    const message = () =>
      `${this.utils.matcherHint('toMatchSchema', 'received', 'schema', { isNot: this.isNot })}\n\n` +
      (pass
        ? `Expected value not to match ${ref}`
        : `Value does not match ${ref}:\n${shown.join('\n')}`);
    return { name: 'toMatchSchema', pass, expected: ref, message };
  },
});
