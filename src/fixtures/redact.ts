const MAX_BODY_CHARS = 2_000;
const REDACTED = '[redacted]';
// Allowlist diagnostics rather than trying to enumerate every possible personal field.
const SAFE_SCALARS = new Set(['status', 'statuscode', 'code', 'success']);

function sanitize(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([field, item]) => [field, sanitize(item, field)]));
  }
  if (SAFE_SCALARS.has(key.toLowerCase()) && (typeof value === 'number' || typeof value === 'boolean')) return value;
  return REDACTED;
}

/** Never echo unstructured bodies or arbitrary scalar values into reports. */
export function redactedBody(body: string): string {
  let result: string;
  try {
    result = JSON.stringify(sanitize(JSON.parse(body)));
  } catch {
    return '[non-JSON body omitted]';
  }
  return result.length > MAX_BODY_CHARS ? `${result.slice(0, MAX_BODY_CHARS)}… (truncated)` : result;
}

export function diagnosticUrl(raw: string): string {
  const url = new URL(raw);
  return `${url.origin}${url.pathname}`;
}
