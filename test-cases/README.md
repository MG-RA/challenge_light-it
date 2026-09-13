# Test cases for the automated suite

One written case for **every Playwright test in the repository**: 85 tests in 16 spec files (`RUN_MUTATING=1 npm run test:list`). Each parameterized loop is expanded, so one case maps to exactly one Playwright test. This folder documents what the automation does; it does not describe planned coverage. Planned work is in the [QA plan](../QA_PLAN.md#10-roadmap), and defects are in [FINDINGS.md](../docs/FINDINGS.md).

## Layout

The folder mirrors `tests/`:

| Case document | Spec file | Cases | Runs in |
|---|---|---:|---|
| [auth.setup.md](auth.setup.md) | [tests/auth.setup.ts](../tests/auth.setup.ts) | 1 | default |
| [db/connection.md](db/connection.md) | [tests/db/connection.spec.ts](../tests/db/connection.spec.ts) | 2 | default |
| [api/auth.md](api/auth.md) | [tests/api/auth.spec.ts](../tests/api/auth.spec.ts) | 21 | default |
| [api/users.md](api/users.md) | [tests/api/users.spec.ts](../tests/api/users.spec.ts) | 1 | default |
| [api/caching.md](api/caching.md) | [tests/api/caching.spec.ts](../tests/api/caching.spec.ts) | 2 | default |
| [api/doctors.md](api/doctors.md) | [tests/api/doctors.spec.ts](../tests/api/doctors.spec.ts) | 5 | default |
| [api/appointments.md](api/appointments.md) | [tests/api/appointments.spec.ts](../tests/api/appointments.spec.ts) | 13 | 2 default, 11 `@mutating` |
| [api/payments.md](api/payments.md) | [tests/api/payments.spec.ts](../tests/api/payments.spec.ts) | 2 | 1 default, 1 `@mutating` |
| [api/notifications.md](api/notifications.md) | [tests/api/notifications.spec.ts](../tests/api/notifications.spec.ts) | 2 | 1 default, 1 `@mutating` |
| [api/rate-limit.md](api/rate-limit.md) | [tests/api/rate-limit.spec.ts](../tests/api/rate-limit.spec.ts) | 1 | default, skipped unless `RUN_RATE_LIMIT=1` |
| [ui/login.md](ui/login.md) | [tests/ui/login.spec.ts](../tests/ui/login.spec.ts) | 7 | default |
| [ui/dashboard.md](ui/dashboard.md) | [tests/ui/dashboard.spec.ts](../tests/ui/dashboard.spec.ts) | 13 | default |
| [ui/dashboard.md](ui/dashboard.md) | [tests/ui/dashboard-state.spec.ts](../tests/ui/dashboard-state.spec.ts) | 1 | `@mutating` |
| [ui/navigation.md](ui/navigation.md) | [tests/ui/navigation.spec.ts](../tests/ui/navigation.spec.ts) | 6 | default |
| [ui/booking.md](ui/booking.md) | [tests/ui/booking.spec.ts](../tests/ui/booking.spec.ts) | 7 | default |
| [ui/booking.md](ui/booking.md) | [tests/ui/booking-state.spec.ts](../tests/ui/booking-state.spec.ts) | 1 | `@mutating` |
| **Total** | | **85** | **70 default, 15 `@mutating`** |

Helpers such as `tests/api/writes.ts`, `dbState.ts`, `appointmentResponse.ts` and `knownDefectChecks.ts` contain no tests. Their checks are written into the steps of the cases that use them.

## Case format

Every case has:

- **ID:** `TC-<AREA>-<NNN>`. IDs are stable: append new ones, never renumber or reuse. Retired: TC-APT-003/004 (folded into TC-APT-001/002) and TC-UI-DASH-002/003 (covered by navigation; image size kept as F-13 feedback).
- **Automated test:** spec file and line, plus the exact Playwright title so `--grep` finds it.
- **Project / tag:** Playwright project (`setup`, `api`, `db`, `ui`), plus `@mutating` when the test writes remote data.
- **Priority / basis:** **P0** patient isolation and booking/payment integrity, **P1** core behavior and contract, **P2** secondary behavior. A case's priority is how important its coverage is; a finding's priority in [FINDINGS.md](../docs/FINDINGS.md) is fix order. P0 lines up in both: P0 cases guard the risks whose defects are P0 release blockers. **C** means the OpenAPI contract specifies it, **P** is suite policy (DB reconciliation, field completeness), **Q** is a proposed business rule not in the spec; Q expectations are soft assertions.
- **Finding:** the related [FINDINGS.md](../docs/FINDINGS.md) ID, if any.
- **Preconditions, test data, steps with expected results, cleanup.**
- **Last recorded:** the latest result and its date.

### Result vocabulary

| Term | Meaning |
|---|---|
| Pass | Every assertion held. |
| Expected failure (F-xx) | Marked `test.fail`. All unrelated checks passed first, and only the known-defect assertion failed. Playwright counts it as passed. |
| Fail (F-xx) | An ordinary failure that reproduces a finding. Only opt-in runs (`@mutating` writes and the rate-limit check) use this; see [known-defect marking](../QA_PLAN.md#42-known-defect-marking). |
| Skipped | A data precondition or safety gate was not met. Never counted as a pass. |

## Shared preconditions

These apply to every case unless the case says otherwise.

1. `.env` provides `BASE_URL`, `API_BASE_URL`, the test account credentials and read-only Postgres credentials. See [.env.example](../.env.example).
2. The `setup` project (TC-SETUP-001) has logged in once and saved the session. The `api` and `ui` projects depend on it; `db` does not.
3. The DB user is read-only. Expected values are read from Postgres at run time; seeded IDs are never hard-coded.
4. `@mutating` cases run only with `RUN_MUTATING=1`, one worker and zero retries; the `owned` fixture enforces this. Every write carries a unique run marker in `notes`, only marker-carrying rows are mutated, and teardown deletes them and verifies absence. Caps are 20 booking and 4 payment submissions per worker process; a failed test restarts the worker and resets them.

## Results summary

Latest recorded result per case, all from 2026-09-13 as described in the [run record](#run-record).

| Result | Cases |
|---|---:|
| Pass | 64 |
| Expected failure | 9 (F-01, F-12 UI, F-14 ×2, F-15 ×2, F-20, F-21, F-23 controlled) |
| Fail | 11 (F-02, F-03, F-04, F-05, F-12 ×2, F-16, F-17, F-18, F-22, F-23 persisted) |
| Skipped | 1 (TC-NOT-002: no attributable notification) |

The default suite (what CI runs) has no ordinary failures: every open finding it reproduces is an expected failure. All 11 ordinary failures come from the opt-in write and rate-limit runs. Every failure reproduces a finding; none is a suite error. The failure count is not the bug count, because some findings fail more than one case.

## Run record

2026-09-13, commit `d152cd3` (branch `chore/node26-quality-batch1`, clean tree), local Chromium, run in the order the [QA plan](../QA_PLAN.md#6-execution-model) requires. No marked rows existed before the write runs.

| Order | Run | Command | Duration | Result |
|---:|---|---|---:|---|
| 1 | Default | `npm test` | 32 s | 60 passed, 4 expected failures, 5 failed (F-12 UI, F-15 ×2, F-21, F-23), 1 skipped (rate limit, gated) |
| 2 | API writes | `RUN_MUTATING=1 npm run test:writes` | 2.3 min | setup + 4 passed, 8 failed (F-02, F-03, F-04, F-12 ×2, F-16, F-17, F-18), 1 skipped (TC-NOT-002) |
| 3 | UI writes | `RUN_MUTATING=1 npx playwright test tests/ui/booking-state.spec.ts tests/ui/dashboard-state.spec.ts --project=ui --workers=1` | 33 s | setup passed, 2 failed (F-05, F-23) |
| 4 | Rate limit | `RUN_RATE_LIMIT=1 npx playwright test tests/api/rate-limit.spec.ts --project=api --no-deps --workers=1` | 4 s | 1 failed (F-22: ten 401s, no 429) |
| 5 | Default, CI mode, after marking the default-suite defects | `CI=1 npx playwright test` | 45 s | 60 passed, 9 expected failures, 0 failed, 1 skipped; exit code 0 |

Run 5 replaces run 1 for the default suite. Its only change was moving the five ordinary failures from run 1 (F-12 UI, F-15 ×2, F-21, F-23) behind scoped expected-failure markers, and each still failed with the signature recorded in run 1. Each case is counted once (the setup case in run 5), which gives the 85-case summary above. There were no retries, no flaky results and no unexpected passes; every expected failure matched its recorded signature on inspection. After runs 2 and 3, a DB query for `notes like 'qa-suite %'` returned no rows, and no payment residue was created because the valid payment did not persist (F-18). Raw HTML/JSON reports stay local because traces and screenshots are not redacted.

## Traceability matrix

| Case ID | Playwright test | Project / tag | Finding | Last recorded |
|---|---|---|---|---|
| TC-SETUP-001 | authenticate | setup | — | Pass |
| TC-DB-001 | Database › read-only user can connect and see the app tables | db | — | Pass |
| TC-DB-002 | Database › DB user cannot write (guards against accidental mutation) | db | — | Pass |
| TC-AUTH-001 | Auth API › rejects wrong password with 401 | api | — | Pass |
| TC-AUTH-002 | Auth API › profile rejects a missing token | api | — | Pass |
| TC-AUTH-003 | Auth API › doctors rejects a missing token | api | — | Pass |
| TC-AUTH-004 | Auth API › appointments rejects a missing token | api | — | Pass |
| TC-AUTH-005 | Auth API › payments rejects a missing token | api | — | Pass |
| TC-AUTH-006 | Auth API › notifications rejects a missing token | api | — | Pass |
| TC-AUTH-007 | Auth API › doctor detail rejects a missing token | api | — | Pass |
| TC-AUTH-008 | Auth API › doctor availability rejects a missing token | api | — | Pass |
| TC-AUTH-009 | Auth API › appointment detail rejects a missing token | api | — | Pass |
| TC-AUTH-010 | Auth API › profile rejects a malformed token | api | — | Pass |
| TC-AUTH-011 | Auth API › doctors rejects a malformed token | api | — | Pass |
| TC-AUTH-012 | Auth API › appointments rejects a malformed token | api | — | Pass |
| TC-AUTH-013 | Auth API › payments rejects a malformed token | api | — | Pass |
| TC-AUTH-014 | Auth API › notifications rejects a malformed token | api | — | Pass |
| TC-AUTH-015 | Auth API › doctor detail rejects a malformed token | api | — | Pass |
| TC-AUTH-016 | Auth API › doctor availability rejects a malformed token | api | — | Pass |
| TC-AUTH-017 | Auth API › appointment detail rejects a malformed token | api | — | Pass |
| TC-AUTH-018 | Authorization boundaries › appointment detail refuses another patient's appointment | api | — | Pass |
| TC-AUTH-019 | Authorization boundaries › profile rejects a token whose user_id was altered | api | — | Pass |
| TC-AUTH-020 | Authorization boundaries › profile rejects a token with an alg:none header | api | — | Pass |
| TC-AUTH-021 | Authorization boundaries › profile answers an empty-signature token with the documented 401 | api | F-20 | Expected failure |
| TC-AUTH-RATE-001 | login throttles a bounded series of failed attempts | api `@rate-limit` | F-22 | Fail |
| TC-USR-001 | Users API › GET /users/me returns the logged-in user, matching the DB | api | — | Pass |
| TC-CACHE-001 | HTTP caching › profile response is not cacheable by shared caches | api | F-14 | Expected failure |
| TC-CACHE-002 | HTTP caching › appointments response is not cacheable by shared caches | api | F-14 | Expected failure |
| TC-DOC-001 | Doctors API › GET /doctors lists exactly the active doctors in the DB | api | — | Pass |
| TC-DOC-002 | Doctors API › GET /doctors satisfies the field-completeness policy | api | F-01 | Expected failure |
| TC-DOC-003 | Doctors API › GET /doctors/:id matches the stored doctor | api | F-09 | Pass |
| TC-DOC-004 | Doctors API › GET /doctors/:id/availability returns valid clock slots | api | — | Pass |
| TC-DOC-005 | Doctors API › GET /doctors/:id returns 404 for an unknown doctor | api | — | Pass |
| TC-APT-001 | Appointments API › GET /appointments contains only the patient records and matches the DB | api | F-15 | Expected failure |
| TC-APT-002 | Appointments API › GET /appointments/:id returns an owned appointment matching the DB | api | F-15 | Expected failure |
| TC-APT-005 | Appointments API writes › POST /appointments stores exactly one owned appointment and detail agrees | api `@mutating` | — | Pass |
| TC-APT-006 | Appointments API writes › PUT /appointments/:id/reschedule stores the new slot and preserves identity | api `@mutating` | — | Pass |
| TC-APT-007 | Appointments API writes › PUT /appointments/:id/cancel stores the cancellation without touching a control | api `@mutating` | F-16 | Fail |
| TC-APT-008 | Appointments API writes › DELETE /appointments/:id removes the row and detail returns 404 | api `@mutating` | — | Pass |
| TC-APT-009 | Appointments API writes › POST /appointments rejects missing doctor without storing a row | api `@mutating` | — | Pass |
| TC-APT-010 | Appointments API writes › POST /appointments rejects yesterday without storing a row | api `@mutating` | F-12 | Fail |
| TC-APT-011 | Appointments API writes › POST /appointments rejects year 0123 without storing a row | api `@mutating` | F-12 | Fail |
| TC-APT-012 | Appointments API writes › POST /appointments rejects invalid clock without storing a row | api `@mutating` | F-02 | Fail |
| TC-APT-013 | Appointments API writes › POST /appointments rejects inactive doctor without storing a row | api `@mutating` | F-04 | Fail |
| TC-APT-014 | Appointments API writes › POST /appointments rejects a duplicate slot and leaves exactly one booking | api `@mutating` | F-03 | Fail |
| TC-APT-015 | Appointments API writes › PUT /appointments/:id/reschedule rejects an invalid body and stores no change | api `@mutating` | F-17 | Fail |
| TC-PAY-001 | GET /payments matches payments for the patient appointments | api | F-09 | Pass |
| TC-PAY-002 | POST /payments stores one valid payment and rejects invalid amounts | api `@mutating` | F-18 | Fail (first step; later steps not reached) |
| TC-NOT-001 | GET /notifications contains only the user records and maps isRead to is_read | api | F-10 | Pass |
| TC-NOT-002 | PUT /notifications/:id/read changes only that read flag and repeats idempotently | api `@mutating` | — | Skipped |
| TC-UI-LOGIN-001 | Login page › valid credentials land on the dashboard | ui | — | Pass |
| TC-UI-LOGIN-002 | Login page › invalid password keeps the user on /login | ui | — | Pass |
| TC-UI-ACCESS-001 | Access control › unauthenticated visit to /dashboard redirects to /login | ui | — | Pass |
| TC-UI-LOGIN-003 | login validates missing email before submitting | ui | — | Pass |
| TC-UI-LOGIN-004 | login validates missing password before submitting | ui | — | Pass |
| TC-UI-LOGIN-005 | login validates malformed email before submitting | ui | — | Pass |
| TC-UI-LOGIN-006 | login shows actionable feedback for throttling | ui | — | Pass |
| TC-UI-DASH-001 | Dashboard › greets the user by first name from the DB | ui | — | Pass |
| TC-UI-DASH-004 | Dashboard › Quick Actions opens Book | ui | — | Pass |
| TC-UI-DASH-005 | Dashboard › Quick Actions opens Doctors | ui | — | Pass |
| TC-UI-DASH-006 | Dashboard › Quick Actions opens History | ui | — | Pass |
| TC-UI-DASH-007 | Dashboard › Quick Actions opens Alerts | ui | — | Pass |
| TC-UI-DASH-008 | Dashboard › upcoming count reflects patient records | ui | — | Pass |
| TC-UI-DASH-009 | Dashboard › completed count reflects patient records | ui | — | Pass |
| TC-UI-DASH-010 | Dashboard › cancelled count reflects patient records | ui | — | Pass |
| TC-UI-DASH-011 | Dashboard › next appointment is the earliest future active or pending record | ui | F-21 | Expected failure |
| TC-UI-DASH-012 | Dashboard › next appointment View all opens appointment history | ui | — | Pass |
| TC-UI-DASH-013 | dashboard Upcoming appointments counter updates when appointment data changes | ui | F-23 | Expected failure |
| TC-UI-DASH-014 | dashboard Completed counter updates when appointment data changes | ui | — | Pass |
| TC-UI-DASH-015 | dashboard Cancelled counter updates when appointment data changes | ui | — | Pass |
| TC-UI-DASH-016 | dashboard upcoming counter changes after a persisted booking and deletion | ui `@mutating` | F-23 | Fail |
| TC-UI-NAV-001 | Sidebar destinations › opens Doctors with its page heading | ui | — | Pass |
| TC-UI-NAV-002 | Sidebar destinations › opens Appointments with its page heading | ui | — | Pass |
| TC-UI-NAV-003 | Sidebar destinations › opens Notifications with its page heading | ui | — | Pass |
| TC-UI-NAV-004 | Sidebar destinations › returns to Dashboard from Doctors | ui | — | Pass |
| TC-UI-NAV-005 | sidebar logout clears the session and protects routes after reload and back | ui | — | Pass |
| TC-UI-NAV-006 | sidebar New Appointment opens booking form | ui | — | Pass |
| TC-UI-BOOK-001 | booking loads the selected doctor availability into time options without submitting | ui | F-19 | Pass |
| TC-UI-BOOK-002 | booking validates missing doctor_id before submitting | ui | — | Pass |
| TC-UI-BOOK-003 | booking validates missing appointment_date before submitting | ui | — | Pass |
| TC-UI-BOOK-004 | booking validates missing time_slot before submitting | ui | — | Pass |
| TC-UI-BOOK-005 | switching doctors replaces slots and clears the previous selection | ui | — | Pass |
| TC-UI-BOOK-006 | availability failure has feedback and recovers after changing doctor | ui | — | Pass |
| TC-UI-BOOK-007 | booking rejects a past date in the UI | ui | F-12 | Expected failure |
| TC-UI-BOOK-008 | booked doctor date and slot cannot be selected again | ui `@mutating` | F-05 | Fail |

## Keeping this folder in sync

When a test is added, renamed or removed:

1. Run `RUN_MUTATING=1 npm run test:list` and compare the output with the matrix above.
2. Add or edit the case in the document that mirrors the spec, including the line reference and exact title.
3. Update the matrix row, the per-file count and the results summary.
4. If the test covers a finding, link it both here and in [FINDINGS.md](../docs/FINDINGS.md).
