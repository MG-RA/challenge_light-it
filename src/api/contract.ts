import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { loadSpec, type OpenApiSpec } from './spec';
import type { ApiError, Appointment, Doctor, Notification, Payment, User } from './types';

// TS model per component schema of the contract. The contract is downloaded at run time, so the
// names are checked when it loads: a modeled schema missing from the live spec fails loudly.
type SchemaTypes = {
  User: User;
  Doctor: Doctor;
  Appointment: Appointment;
  Payment: Payment;
  Notification: Notification;
  Error: ApiError;
};

export type SchemaName = keyof SchemaTypes;
/** A component schema from the spec, or `Name[]` for an array of them. */
export type SchemaRef = SchemaName | `${SchemaName}[]`;

/** Every modeled schema name; the Record type makes this list complete by construction. */
const MODELED: Record<SchemaName, true> = {
  User: true,
  Doctor: true,
  Appointment: true,
  Payment: true,
  Notification: true,
  Error: true,
};

/** The TS type a SchemaRef validates to, e.g. 'Doctor[]' → Doctor[]. */
export type SchemaData<R extends SchemaRef> = R extends `${infer N extends SchemaName}[]`
  ? SchemaTypes[N][]
  : R extends SchemaName
    ? SchemaTypes[R]
    : never;

/** Raw component schemas do not require properties; literal validation cannot promise full models. */
export type SpecData<R extends SchemaRef> = R extends `${infer N extends SchemaName}[]`
  ? Partial<SchemaTypes[N]>[]
  : R extends SchemaName
    ? Partial<SchemaTypes[R]>
    : never;

type Contract = { spec: OpenApiSpec; ajv: Ajv; validators: Map<SchemaRef, ValidateFunction> };
let loaded: Contract | undefined;

/** Loads and compiles the downloaded contract on first use, so importing this module needs no file. */
function contract(): Contract {
  if (loaded) return loaded;
  const spec = loadSpec();
  const missing = Object.keys(MODELED).filter((name) => !(name in spec.components.schemas));
  if (missing.length) {
    throw new Error(
      `The OpenAPI contract no longer declares ${missing.join(', ')}. ` +
        'Update src/api/types.ts and SchemaTypes before trusting contract checks.',
    );
  }
  // `example` is an OpenAPI annotation Ajv doesn't know; `nullable` it supports natively.
  const ajv = new Ajv({ allErrors: true, keywords: ['example'] });
  addFormats(ajv);
  // Preserve the published contract, including its optional properties and allowance for extras.
  for (const [name, schema] of Object.entries(spec.components.schemas)) ajv.addSchema(schema, name);
  loaded = { spec, ajv, validators: new Map() };
  return loaded;
}

function validatorFor(ref: SchemaRef): ValidateFunction {
  const { ajv, validators } = contract();
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
  if (e.keyword === 'additionalProperties')
    return `${where} has unexpected property '${e.params.additionalProperty}'`;
  if (e.keyword === 'enum')
    return `${where} must be one of ${JSON.stringify(e.params.allowedValues)}`;
  return `${where} ${e.message}`;
}

/** Contract violations of `data` against `ref`, one per entry; empty when it conforms. */
export function schemaErrors(ref: SchemaRef, data: unknown): string[] {
  const validate = validatorFor(ref);
  return validate(data) ? [] : (validate.errors ?? []).map(formatError);
}

/** Separate suite policy: listed fields must be present. Extra fields remain allowed. */
export function missingFields(ref: SchemaRef, data: unknown): { index: number; field: string }[] {
  const name = (ref.endsWith('[]') ? ref.slice(0, -2) : ref) as SchemaName;
  const declared = Object.keys(contract().spec.components.schemas[name]?.properties ?? {});
  const records: unknown[] = ref.endsWith('[]') && Array.isArray(data) ? data : [data];
  return records.flatMap((record, index) =>
    declared
      .filter(
        (field) => record === null || typeof record !== 'object' || !Object.hasOwn(record, field),
      )
      .map((field) => ({ index, field })),
  );
}

/** Component schemas the live contract declares that the suite does not model yet. */
export function unmodeledSchemas(spec: OpenApiSpec): string[] {
  return Object.keys(spec.components.schemas).filter((name) => !(name in MODELED));
}
