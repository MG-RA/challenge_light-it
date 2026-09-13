# API test patterns

## Adding an endpoint

1. Add one method to `src/api/ApiClient.ts` that returns the raw `APIResponse`. No assertions, no
   JSON parsing, no retries — negative cases matter as much as happy paths, so the test decides what
   a response means.
2. If the endpoint has a request body, add its type to `src/api/types.ts` and accept `Partial<…>`
   when tests must send malformed payloads (`createAppointment`, `updateMe`).
3. If a new component schema appears in `docs/openapi.json`, add the matching entry to `SchemaTypes`
   in `src/api/contract.ts` — it is a mapped type over `SchemaName`, so a missing entry fails
   `npm run typecheck` rather than silently skipping validation.

## Reconciling a response against the DB

The shape of every read test:

```ts
test('GET /doctors lists exactly the active doctors in the DB', async ({ api, db }) => {
  const doctors = await expectJson(await api.listDoctors(), 200, 'Doctor[]');
  const dbActive = await db.activeDoctors();
  for (const doctor of doctors) expect(doctor.id).toEqual(expect.any(Number));  // identity used for reconciliation
  expect(doctors.map((d) => d.id!).toSorted((a, b) => a - b)).toEqual(dbActive.map((d) => d.id));
  for (const row of dbActive) expect(doctors.find((d) => d.id === row.id)).toMatchObject({ /* fields */ });
});
```

Points that matter:

- Compare the **id sets** first (catches extra and missing records, including another user's data
  leaking in), then field-by-field per row.
- `expectJson` returns `Partial<…>`; explicitly assert any property you index on before using it.
- Add DB lookups as named methods on `Db` with `$1` parameters. `one` / `oneOrThrow` / `query` are
  the primitives; `oneOrThrow` takes a description so a missing row fails legibly.
- Field name differences between layers are mapped in the test, not hidden in the client —
  e.g. notifications: `expect(found).toMatchObject({ ...stored, isRead: is_read })` (F-10).

## Authorization coverage

Drive the matrix from data rather than copy-pasting tests — see `tests/api/auth.spec.ts`: for each
token mode (`undefined`, `'not-a-jwt'`) × each endpoint, assert 401 via
`anonApi.withToken(token)`. `withToken` reuses the same request context, so a new cookie jar is not
created; `anonApi` and `api` are separate contexts precisely so an "anonymous" client can never
inherit a session.

## Eventual consistency

The API and its DB are not strictly synchronous. Never sleep — use `observe()`
(`src/db/observe.ts`), which requires a predicate to hold *continuously* across a stability window
(default 1s within a 4s budget), so a value that flickers true does not pass.

For state verification prefer the wrappers in `tests/api/dbState.ts`, which wait and then assert, so
a never-settling value still fails with a real diff instead of a timeout:

| Helper | Proves |
|---|---|
| `expectStoredAppointment(db, id, ownerId, expected)` | the row settled on these fields |
| `expectAppointmentUnchanged(db, ownerId, before)` | a control row is untouched, field for field |
| `expectAppointmentGone(db, id, ownerId)` | no row remains |
| `expectNothingStored(db, marker, ownerId)` | a rejected create persisted nothing |
| `expectStoredPayments(db, appointmentId, expected)` | payments in id order |
| `expectStoredNotifications(db, ownerId, expected)` | a read-flag change is provably isolated |

A rejected write must still be checked for persistence — `OwnedData.create` reads back by marker
regardless of status, because a 4xx response does not prove nothing was written.

## @mutating writes

Every write test is `@mutating`, imports `test` from `tests/api/writes.ts`, and requests `owned`.
The guarantees that fixture enforces, all of which you must preserve:

- **Gate:** throws unless `RUN_MUTATING=1`, workers is 1, and retries is 0. The config also sets
  `grepInvert: /@mutating/` and `fullyParallel: false` for these runs.
- **Identity check:** `GET /users/me` must match the configured DB account before any write.
- **Ownership marker:** every create writes `notes = "qa-suite <run-uuid> <case-uuid>"`. Mutating
  helpers (`reschedule`, `cancel`, `remove`, `pay`) call the private `ownedRow` guard, which refuses
  any row this run did not create and which no longer carries its marker.
- **Caps:** `BOOKING_CAP = 20`, `PAYMENT_CAP = 4` per run, since payments cannot be deleted through
  the API.
- **Teardown:** `cleanup()` deletes everything still stored. A paid appointment the API refuses to
  delete is cancelled instead and reported as **declared residue** via a test annotation. Cleanup
  failure fails the test — silent residue is not acceptable.

Booking a slot: `owned.book()` picks a free doctor/date/slot from the availability catalog
cross-checked against `db.occupiedSlots`, rechecks immediately before creating, asserts 201, and
asserts exactly one owned row was stored. Use `owned.freeSlot(doctor, exclude)` when you need a
second distinct slot (reschedule targets).

New write tests should:

1. `const booked = await owned.book();` — never mutate pre-existing data.
2. Send the request through an `owned.*` method, not `api.*` directly, so the ownership guard runs.
3. Assert the HTTP status (hard if specified, `expect.soft` with a "proposed" label if not).
4. Assert the resulting DB state with a `dbState` helper.
5. Where isolation matters, book a **control** row and assert `expectAppointmentUnchanged` on it.

## Test data

- Booking dates come from `dateAfter(n)` (whole-day offsets, `YYYY-MM-DD`), with a randomized start
  offset when searching for a free slot so parallel or repeated runs do not collide on the same day.
- Not-found ids come from the DB (`db.unusedDoctorId()` = `max(id) + 1`), never a hardcoded `99999`.
- Never hardcode doctor ids, appointment ids, or user ids — read them from `db` or `testUser`.
