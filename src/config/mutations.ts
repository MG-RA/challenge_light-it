/** Only an explicit 1 enables tests that change shared remote data. */
export function mutationsEnabled(value: string | undefined): boolean {
  if (value === undefined || value === '0' || value === 'false') return false;
  if (value === '1') return true;
  throw new Error('RUN_MUTATING must be 1, 0, false, or unset (1 enables remote writes).');
}
