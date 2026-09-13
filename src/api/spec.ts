import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The OpenAPI contract is served behind the same login as the API, so it is not committed.
 * The setup project downloads it once per run into the git-ignored .auth folder.
 */
export const SPEC_FILE = path.resolve(__dirname, '../../.auth/openapi.json');

export type ComponentSchema = { properties?: Record<string, unknown> } & Record<string, unknown>;

export type OpenApiSpec = {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, unknown>;
  components: { schemas: Record<string, ComponentSchema> };
};

function isOpenApiSpec(value: unknown): value is OpenApiSpec {
  const spec = value as Partial<OpenApiSpec> | null;
  return (
    typeof spec?.openapi === 'string' &&
    spec.openapi.startsWith('3.') &&
    typeof spec.info?.title === 'string' &&
    typeof spec.paths === 'object' &&
    typeof spec.components?.schemas === 'object'
  );
}

/** Checks and stores the downloaded contract; returns it with the SHA-256 of the exact bytes served. */
export function saveSpec(raw: string): { spec: OpenApiSpec; sha256: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The API docs endpoint did not return JSON');
  }
  if (!isOpenApiSpec(parsed)) {
    throw new Error(
      'The API docs endpoint did not return an OpenAPI 3 document with paths and schemas',
    );
  }
  fs.mkdirSync(path.dirname(SPEC_FILE), { recursive: true });
  fs.writeFileSync(SPEC_FILE, raw);
  return { spec: parsed, sha256: createHash('sha256').update(raw).digest('hex') };
}

export function loadSpec(): OpenApiSpec {
  if (!fs.existsSync(SPEC_FILE)) {
    throw new Error(
      `No OpenAPI contract at ${SPEC_FILE}. Run the "setup" project first (don't pass --no-deps).`,
    );
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(SPEC_FILE, 'utf8'));
  if (!isOpenApiSpec(parsed)) throw new Error(`${SPEC_FILE} is not an OpenAPI 3 document`);
  return parsed;
}
