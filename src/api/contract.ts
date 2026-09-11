import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import spec from '../../docs/openapi.json';
import type { ApiError, Appointment, Doctor, Notification, Payment, User } from './types';

export type SchemaName = keyof typeof spec.components.schemas;
/** A component schema from the spec, or `Name[]` for an array of them. */
export type SchemaRef = SchemaName | `${SchemaName}[]`;

// TS model per spec schema. SchemaData indexes it by SchemaName, so a schema
// added to the spec without an entry here fails to compile.
type SchemaTypes = {
  User: User;
  Doctor: Doctor;
  Appointment: Appointment;
  Payment: Payment;
  Notification: Notification;
  Error: ApiError;
};

/** The TS type a SchemaRef validates to, e.g. 'Doctor[]' → Doctor[]. */
export type SchemaData<R extends SchemaRef> = R extends `${infer N extends SchemaName}[]`
  ? SchemaTypes[N][]
  : R extends SchemaName
    ? SchemaTypes[R]
    : never;

// `example` is an OpenAPI annotation Ajv doesn't know; `nullable` it supports natively.
const ajv = new Ajv({ allErrors: true, keywords: ['example'] });
addFormats(ajv);

// The spec lists each schema's fields but never marks them `required`, so as
// written it would accept a response missing every field. Treat the listed
// fields as the contract instead: all present, nothing extra (nullable fields
// must still be present, as null).
for (const [name, schema] of Object.entries(spec.components.schemas)) {
  ajv.addSchema({ ...schema, required: Object.keys(schema.properties), additionalProperties: false }, name);
}

const validators = new Map<SchemaRef, ValidateFunction>();

function validatorFor(ref: SchemaRef): ValidateFunction {
  let validate = validators.get(ref);
  if (!validate) {
    validate = ref.endsWith('[]')
      ? ajv.compile({ type: 'array', items: { $ref: ref.slice(0, -2) } })
      : ajv.compile({ $ref: ref });
    validators.set(ref, validate);
  }
  return validate;
}

function formatError(e: ErrorObject): string {
  const where = e.instancePath || '(root)';
  if (e.keyword === 'additionalProperties') return `${where} has unexpected property '${e.params.additionalProperty}'`;
  if (e.keyword === 'enum') return `${where} must be one of ${JSON.stringify(e.params.allowedValues)}`;
  return `${where} ${e.message}`;
}

/** Contract violations of `data` against `ref`, one per entry; empty when it conforms. */
export function schemaErrors(ref: SchemaRef, data: unknown): string[] {
  const validate = validatorFor(ref);
  return validate(data) ? [] : (validate.errors ?? []).map(formatError);
}
