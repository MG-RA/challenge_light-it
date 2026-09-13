# State execution — 2026-09-11

Run ID: `eb1647b0-fd7a-4ec4-b372-1a977c63d694`.

> Historical record, superseded by [the 2026-09-12 write run](runs/2026-09-12-writes.md). These scenarios have since moved into the `api` project as `@mutating` cases with the same assertions; the separate state configuration, `tests/state`, and the run registry no longer exist. See [write testing](WRITE_TESTING.md).

Command: `npm run test:state` with `RUN_MUTATING=1`, one worker, zero retries. Started **2026-09-11 23:08:29 UTC** (20:08:29 America/Montevideo). Duration **123.8 seconds**. Exit code **1**, because real failures remain visible.

| Category | Result |
|---|---:|
| Cases selected | 16: one setup plus 15 state cases |
| Normal passes | 6, including setup |
| Failed scenarios | 8 |
| Skipped cases | 2 |
| Cleanup failures | 0 |
| Expected-failure markers | 0 |
| Booking submissions / created appointments | 15 / 14 |
| Payment submissions / persisted payments observed | 1 / 0 |
| Allowed residue / unresolved appointments | 0 / 0 |
| New owned notifications observed | 0 |

## Before/action/after evidence

| Scenario | Observed result | Persistence and cleanup |
|---|---|---|
| Initial create/delete probe | Passed | Appointment 1102 created, removed, detail 404 |
| Valid creation | Passed | 1103 matched intended fields and API detail; deleted |
| Valid reschedule | Passed | 1104 kept identity/ownership and stored the new slot; deleted |
| Cancel | Failed, F-16 | 1105 remained `active` after HTTP 200; both 1105 and control 1106 deleted. The later control assertion was not reached after the state failure |
| Delete | Passed | 1107 removed and detail returned 404 |
| Missing doctor | Passed | HTTP 400; no marked row observed |
| Yesterday | Failed, F-12 | HTTP 201; 1108 persisted `2026-09-10`; deleted |
| Year 0123 | Failed, F-12 | HTTP 201; 1109 persisted `0123-11-23`; deleted |
| Invalid clock | Failed, F-02 | HTTP 201; 1110 persisted `25:99`; deleted |
| Inactive doctor | Failed, F-04 | HTTP 201; 1111 referenced doctor 7 selected by `not is_active`; deleted |
| Sequential duplicate | Failed, F-03 | 1112 and 1113 both persisted doctor 1 / 2026-09-21 / 09:00; both deleted |
| Invalid reschedule | Failed, F-17 | HTTP 200; 1114 changed from 2026-09-28 / 09:00 to 2026-09-10 / 25:99; deleted |
| Valid payment registration | Failed, F-18; triggered stop | HTTP 200 reported payment ID 999, but no new payment for owned appointment 1115; appointment deleted |
| Zero / negative / duplicate payment steps | Unexecuted | Safety stop after the valid-payment mismatch; no further POST /payments |
| Notification read | Skipped | Safety gate; additionally no new notification was observed |
| Live profile | Skipped | Safety gate; independently disabled until reliable reset/disposable account exists |

Seven booking scenarios failed and one payment scenario failed. These are not cleanup failures. Local profile response-control tests are framework tests, not evidence of current live profile behavior.

## Cleanup and final residue check

The registry recorded deletion of all 14 created appointments, **1102 through 1115**. No returned ID was deleted without checking ownership and the exact run marker.

At **23:11:30 UTC**, a separate read-only check found:

- No appointments with those IDs or the run's marker prefix.
- No payments linked to those appointments.
- No payment with the reported ID 999.
- No notification IDs newly present for the account compared with the initial snapshot.

No further writes were issued after the payment stop, other than allowed cleanup. The suite was not rerun to pursue the blocked cases.

## Evidence files and subsequent validation

Local ignored artifacts are under `state-results/eb1647b0-fd7a-4ec4-b372-1a977c63d694/`: `manifest.json`, `results.json`, `html/`, per-case error contexts, and generated summary files. This document preserves the sanitized findings when those local files are unavailable.

Typecheck and lint passed. The subsequent default read-only regression selected **62 cases**: **56 normal passes, 6 existing expected failures, no skips or unexpected results**, in **11.7 seconds**. It included **17 local framework tests**, including a regression check for the newly observed false payment ID. A read-only UI case also verified availability loading for two selected doctors; the reported missing-data path was not reproduced. See [execution record](EXECUTION.md).

The final code also adds a token/account preflight and rejects repeat overrides. These read-only guards were typechecked; the live mutation suite was deliberately not repeated. Paid-record cleanup and notification attribution remain locally verified branches rather than live demonstrations.
