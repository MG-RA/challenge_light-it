import { expect } from '../../src/fixtures';
import { observe } from '../../src/db/observe';
import type { Db, NotificationRow, PaymentRow, StateAppointmentRow } from '../../src/db/Db';

/**
 * State verification for API write tests: run the request, then call one of these
 * to check what Postgres actually stored. Each one waits for the expectation to
 * hold across a bounded window (the API and its DB are not strictly synchronous)
 * and then asserts, so a never-settling value still fails with a real diff.
 */
async function settle<T>(read: () => Promise<T>, accepts: (value: T) => boolean): Promise<T> {
  try {
    return await observe(read, accepts);
  } catch {
    // Never settled: return the last reading so the assertion below shows it.
    return await read();
  }
}

function matches(row: object | undefined, expected: object): boolean {
  return (
    row !== undefined &&
    Object.entries(expected).every(
      ([key, value]) => (row as Record<string, unknown>)[key] === value,
    )
  );
}

/** The owner's appointment row settled on `expected`. */
export async function expectStoredAppointment(
  db: Db,
  id: number,
  ownerId: number,
  expected: Partial<StateAppointmentRow>,
): Promise<StateAppointmentRow> {
  const row = await settle(
    () => db.stateAppointment(id, ownerId),
    (r) => matches(r, expected),
  );
  expect(row, `stored appointment ${id}`).toMatchObject(expected);
  return row!;
}

/** The appointment row is unchanged, field for field. */
export async function expectAppointmentUnchanged(
  db: Db,
  ownerId: number,
  before: StateAppointmentRow,
): Promise<void> {
  const row = await settle(
    () => db.stateAppointment(before.id, ownerId),
    (r) => matches(r, before),
  );
  expect(row, `appointment ${before.id} must not change`).toEqual(before);
}

/** No appointment row remains for this id and owner. */
export async function expectAppointmentGone(db: Db, id: number, ownerId: number): Promise<void> {
  const row = await settle(
    () => db.stateAppointment(id, ownerId),
    (r) => r === undefined,
  );
  expect(row, `appointment ${id} must not remain stored`).toBeUndefined();
}

/** No row was stored under this run marker (used after a create that must be rejected). */
export async function expectNothingStored(db: Db, marker: string, ownerId: number): Promise<void> {
  const rows = await settle(
    () => db.markedAppointments(marker, ownerId),
    (r) => r.length === 0,
  );
  expect(rows, 'a rejected create must not persist a marked row').toEqual([]);
}

/** The payments of one appointment settled on `expected`, in id order. */
export async function expectStoredPayments(
  db: Db,
  appointmentId: number,
  expected: Partial<PaymentRow>[],
): Promise<PaymentRow[]> {
  const rows = await settle(
    () => db.paymentsForAppointment(appointmentId),
    (r) => r.length === expected.length && r.every((row, index) => matches(row, expected[index]!)),
  );
  expect(rows, `stored payments for appointment ${appointmentId}`).toMatchObject(expected);
  return rows;
}

/** The owner's notifications settled on `expected`, so a read flag change is provably isolated. */
export async function expectStoredNotifications(
  db: Db,
  ownerId: number,
  expected: NotificationRow[],
): Promise<void> {
  const rows = await settle(
    () => db.notificationsForUser(ownerId),
    (r) => JSON.stringify(r) === JSON.stringify(expected),
  );
  expect(rows, `stored notifications for user ${ownerId}`).toEqual(expected);
}
