# Write testing

Write cases live in the `api` project, tagged `@mutating`, next to the read cases for the same endpoint. They send one API write, then verify what Postgres stored through the read-only connection. The suite has exactly two surfaces: **API** (with DB verification) and **UI**.

The earlier separate state suite, its second Playwright configuration, and its on-disk run registry were removed; this document replaces `STATE_TESTING.md`. The [first live execution](STATE_EXECUTION.md) of those scenarios remains valid evidence — the scenarios and their assertions were carried over.

## Commands and isolation

```powershell
$env:RUN_MUTATING = '1'
npm run test:writes
Remove-Item Env:RUN_MUTATING
```

Use only on the challenge account, with permission to create owned test data and to retain the declared payment/notification residue.

- `RUN_MUTATING` accepts unset, `0`, `false`, or `1`; any other value fails configuration.
- Without `1`, the configuration applies `grepInvert: /@mutating/`, so `npm test` cannot select a write case.
- With `1`, the run switches to **one worker, zero retries, no parallelism, declaration order**, and a 90-second case timeout. The `owned` fixture re-checks those settings and refuses to run if they were overridden.
- The fixture also calls `GET /api/users/me` and requires the token identity to equal the configured DB account before any write.
- `npm run test:writes` selects only the tagged cases; `RUN_MUTATING=1 npm test` runs the read cases and the write cases together, still on one worker.

## Ownership and cleanup

- Every created appointment carries a cryptographically unique run marker in `notes`. Rows are found by marker, never by a returned ID alone.
- Only a row that this test created **and** that still carries its marker for the configured patient may be rescheduled, cancelled, deleted or paid; anything else throws instead of mutating.
- Rejected creates are also checked: a create that returns an error may still have written, so the marker is queried either way.
- Teardown deletes everything the test created and verifies absence in the DB. A failed cleanup fails the test; a DELETE is never retried.
- If an appointment cannot be deleted because payments are linked to it, teardown cancels it instead and records a `residue` annotation on the test. Payments have no delete endpoint.
- Caps per worker process: **20 booking submissions** and **four payment submissions** on one owned appointment, ordered valid fee, zero, negative, duplicate.

Compared with the removed state runner, there is no longer a durable pre-write intent registry, cross-run recovery, or `state-results/<run-id>/` summary. Reconciliation is per test, through DB reads in teardown. An interrupted run (killed process, machine loss) can therefore leave an owned marked appointment behind; the markers make it identifiable, and `select id, notes from appointments where notes like 'qa-suite %'` finds it.

## Verifying stored state

[tests/api/dbState.ts](../tests/api/dbState.ts) holds the state assertions. Perform the steps, then call one:

| Function | Checks |
|---|---|
| `expectStoredAppointment` | The owner's row settled on the expected fields |
| `expectAppointmentUnchanged` | A control or rejected-write target is identical, field for field |
| `expectAppointmentGone` | No row remains for that id and owner |
| `expectNothingStored` | A rejected create persisted no row under its marker |
| `expectStoredPayments` | The appointment's payments, in id order |
| `expectStoredNotifications` | The user's notifications, so a read flag change is provably isolated |

Each one polls at 200 ms for up to 4 seconds and requires the expectation to hold for a 1-second stable window, because the API and its database are not strictly synchronous. A value that never settles is still asserted, so the failure shows the real stored row rather than a timeout. This is bounded evidence, not proof that no later asynchronous write occurs.

## Scenarios and expectations

Appointments: create, valid reschedule, cancel with an owned control, delete plus detail `404`, missing doctor, yesterday, year `0123`, invalid clock `25:99`, inactive doctor, sequential duplicate slot, and invalid reschedule. Valid slots come from the API availability catalog intersected with DB vacancies in the next 30 days, rechecked immediately before a normal create; this does not reserve the shared slot.

Payments: one valid fee payment on a dedicated appointment, then zero, negative and duplicate amounts.

Notifications: a new unread notification is marked read twice, and only its flag may change. A notification qualifies only if its message contains the exact run marker or an explicit matching appointment ID — appearing during the run is not attribution.

Missing required fields expect the documented `400`. Where no code is specified, the rejection expectation is a soft `400`/`409` business proposal, kept distinguishable from contract assertions. Creation status is checked against the published enum rather than an invented initial state.

## Limits

No direct DB writes, administrator reset, second-user mutations, concurrent double-booking, unsupported lifecycle transitions, or automated repeated runs. Profile writes remain disabled: F-06 prevents restoring the exact previous account data, and the assigned-alias rule forbids guessed names. The one combined payment case reports its steps individually.

Reports can contain owned IDs, markers, and before/after state. Review artifacts before sharing. A clean read-only run does not erase failures reported by these cases.
