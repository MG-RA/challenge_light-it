import { setTimeout } from 'node:timers/promises';

/** Require a predicate to remain true across an observation window; this is not proof forever. */
export async function observe<T>(
  read: () => Promise<T>,
  accepts: (value: T) => boolean,
  options: { timeoutMs?: number; stableMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 4_000, stableMs = 1_000, intervalMs = 200 } = options;
  const deadline = Date.now() + timeoutMs;
  let since: number | undefined;
  do {
    const value = await read();
    if (accepts(value)) {
      since ??= Date.now();
      if (Date.now() - since >= stableMs) return value;
    } else since = undefined;
    await setTimeout(intervalMs);
  } while (Date.now() < deadline);
  throw new Error('Persistence condition did not hold throughout the bounded observation window');
}
