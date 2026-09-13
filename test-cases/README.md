# Test cases for the automated suite

Written test cases for **every test that exists in code today**: 62 Playwright tests in 13 files, as reported by `RUN_MUTATING=1 npx playwright test --list` on 2026-09-12. Each parameterized loop in a spec is expanded into its own case, so one case maps to exactly one Playwright test.

This folder documents what the automation does. It does not add planned coverage. Planned cases are in [the API design catalog](../docs/API_TEST_CASES.md), and each case here links back to its catalog ID where one exists.

## Layout

The folder mirrors `tests/`:

| Case document | Spec file | Cases |
|---|---|---:|
| [auth.setup.md](auth.setup.md) | [tests/auth.setup.ts](../tests/auth.setup.ts) | 1 |
| [db/connection.md](db/connection.md) | [tests/db/connection.spec.ts](../tests/db/connection.spec.ts) | 2 |
| [api/auth.md](api/auth.md) | [tests/api/auth.spec.ts](../tests/api/auth.spec.ts) | 21 |
| [api/users.md](api/users.md) | [tests/api/users.spec.ts](../tests/api/users.spec.ts) | 1 |
| [api/caching.md](api/caching.md) | [tests/api/caching.spec.ts](../tests/api/caching.spec.ts) | 2 |
| [api/doctors.md](api/doctors.md) | [tests/api/doctors.spec.ts](../tests/api/doctors.spec.ts) | 5 |
| [api/appointments.md](api/appointments.md) | [tests/api/appointments.spec.ts](../tests/api/appointments.spec.ts) | 15 |
| [api/payments.md](api/payments.md) | [tests/api/payments.spec.ts](../tests/api/payments.spec.ts) | 2 |
| [api/notifications.md](api/notifications.md) | [tests/api/notifications.spec.ts](../tests/api/notifications.spec.ts) | 2 |
| [ui/login.md](ui/login.md) | [tests/ui/login.spec.ts](../tests/ui/login.spec.ts) | 3 |
| [ui/dashboard.md](ui/dashboard.md) | [tests/ui/dashboard.spec.ts](../tests/ui/dashboard.spec.ts) | 3 |
| [ui/navigation.md](ui/navigation.md) | [tests/ui/navigation.spec.ts](../tests/ui/navigation.spec.ts) | 4 |
| [ui/booking.md](ui/booking.md) | [tests/ui/booking.spec.ts](../tests/ui/booking.spec.ts) | 1 |
| **Total** | | **62** |

Helpers such as `tests/api/writes.ts`, `dbState.ts`, `appointmentResponse.ts` and `knownDefectChecks.ts` contain no tests. Their checks are written into the steps of the cases that call them.

## Case format

Every case has:

- **ID:** `TC-<AREA>-<NNN>`. IDs are stable. Do not renumber when tests are added; append.
- **Automated test:** spec file and line, plus the exact Playwright title so `--grep` finds it.
- **Project / tag:** Playwright project (`setup`, `api`, `db`, `ui`) and `@mutating` when the test writes remote data.
- **Type, priority:** priority follows the catalog. **P0** is patient isolation and booking/payment integrity, **P1** is core behavior and contract, **P2** is secondary behavior.
- **Basis:** **C** means the OpenAPI contract specifies it. **P** means suite policy, such as DB reconciliation or field completeness. **Q** means a proposed business rule that is not in the spec. Q expectations are soft assertions in code.
- **Catalog ID / finding:** a link to `docs/API_TEST_CASES.md` and `docs/FINDINGS.md`.
- **Preconditions, test data, steps with expected results, cleanup.**
- **Last recorded result:** from the [2026-09-12 default run](../docs/runs/2026-09-12-default.md) or the [2026-09-12 write run](../docs/runs/2026-09-12-writes.md) (`@mutating`), both on the current tree.

### Result vocabulary

| Term | Meaning |
|---|---|
| Pass | Every assertion held. |
| Expected failure (F-xx) | The test is marked `test.fail`. All unrelated checks passed first, and only the known-defect assertion failed. Playwright reports this as passed. |
| Fail (F-xx) | An ordinary failure that reproduces a finding. `@mutating` tests never use `test.fail`. |
| Skipped | A data precondition or safety gate was not met. A skip is never counted as a pass. |
| Not executed | The test was not reached in a recorded run. |

## Shared preconditions

These apply to every case unless the case says otherwise.

1. `.env` provides `BASE_URL`, `API_BASE_URL`, the test account credentials, and read-only Postgres credentials. See [.env.example](../.env.example).
2. The `setup` project (TC-SETUP-001) has logged in once and saved the session. The `api` and `ui` projects depend on it. The `db` project does not.
3. The DB user is read-only. Expected values are always read from Postgres at run time. Seeded IDs are never hard-coded.
4. `@mutating` cases run only with `RUN_MUTATING=1 npm run test:writes`. They also require one worker and zero retries, and the `owned` fixture enforces this. Every write carries a unique run marker in `notes`. Only rows that carry the marker are mutated, and teardown deletes them. Caps are 20 booking submissions and 4 payment submissions per run.

## Traceability matrix

| Case ID | Playwright test | Project | Catalog | Finding | Last recorded |
|---|---|---|---|---|---|
| TC-SETUP-001 | authenticate | setup | API-AUTH-01 | — | Pass |
| TC-DB-001 | Database › read-only user can connect and see the app tables | db | — | — | Pass |
| TC-DB-002 | Database › DB user cannot write (guards against accidental mutation) | db | — | — | Pass |
| TC-AUTH-001 | Auth API › rejects wrong password with 401 | api | API-AUTH-02 | — | Pass |
| TC-AUTH-002 | Auth API › profile rejects a missing token | api | API-SEC-01, API-USR-03 | — | Pass |
| TC-AUTH-003 | Auth API › doctors rejects a missing token | api | API-SEC-01 | — | Pass |
| TC-AUTH-004 | Auth API › appointments rejects a missing token | api | API-SEC-01 | — | Pass |
| TC-AUTH-005 | Auth API › payments rejects a missing token | api | API-SEC-01 | — | Pass |
| TC-AUTH-006 | Auth API › notifications rejects a missing token | api | API-SEC-01 | — | Pass |
| TC-AUTH-007 | Auth API › doctor detail rejects a missing token | api | API-SEC-01 | — | Pass |
| TC-AUTH-008 | Auth API › doctor availability rejects a missing token | api | API-SEC-01 | — | Pass |
| TC-AUTH-009 | Auth API › appointment detail rejects a missing token | api | API-SEC-01 | — | Pass |
| TC-AUTH-010 | Auth API › profile rejects a malformed token | api | API-SEC-01, API-USR-03 | — | Pass |
| TC-AUTH-011 | Auth API › doctors rejects a malformed token | api | API-SEC-01 | — | Pass |
| TC-AUTH-012 | Auth API › appointments rejects a malformed token | api | API-SEC-01 | — | Pass |
| TC-AUTH-013 | Auth API › payments rejects a malformed token | api | API-SEC-01 | — | Pass |
| TC-AUTH-014 | Auth API › notifications rejects a malformed token | api | API-SEC-01 | — | Pass |
| TC-AUTH-015 | Auth API › doctor detail rejects a malformed token | api | API-SEC-01 | — | Pass |
| TC-AUTH-016 | Auth API › doctor availability rejects a malformed token | api | API-SEC-01 | — | Pass |
| TC-AUTH-017 | Auth API › appointment detail rejects a malformed token | api | API-SEC-01 | — | Pass |
| TC-AUTH-018 | Authorization boundaries › appointment detail refuses another patient's appointment | api | API-APT-14 | — | Pass |
| TC-AUTH-019 | Authorization boundaries › profile rejects a token whose user_id was altered | api | API-SEC-02 | — | Pass |
| TC-AUTH-020 | Authorization boundaries › profile rejects a token with an alg:none header | api | API-SEC-02 | — | Pass |
| TC-AUTH-021 | Authorization boundaries › profile answers an empty-signature token with the documented 401 | api | API-SEC-02 | F-20 | Expected failure |
| TC-USR-001 | Users API › GET /users/me returns the logged-in user, matching the DB | api | API-USR-01, API-SEC-04 | — | Pass |
| TC-CACHE-001 | HTTP caching › profile response is not cacheable by shared caches | api | API-SEC-04 | F-14 | Expected failure |
| TC-CACHE-002 | HTTP caching › appointments response is not cacheable by shared caches | api | API-SEC-04 | F-14, F-15 | Expected failure |
| TC-DOC-001 | Doctors API › GET /doctors lists exactly the active doctors in the DB | api | API-DOC-01 | — | Pass |
| TC-DOC-002 | Doctors API › GET /doctors satisfies the field-completeness policy | api | API-DOC-02 | F-01 | Expected failure |
| TC-DOC-003 | Doctors API › GET /doctors/:id matches the stored doctor | api | API-DOC-04 | F-09 | Pass |
| TC-DOC-004 | Doctors API › GET /doctors/:id/availability returns valid clock slots | api | API-DOC-07 | F-05 | Pass |
| TC-DOC-005 | Doctors API › GET /doctors/:id returns 404 for an unknown doctor | api | API-DOC-05 | — | Pass |
| TC-APT-001 | Appointments API › GET /appointments contains only the patient records and matches the DB | api | API-APT-01 | F-15 | Pass |
| TC-APT-002 | Appointments API › GET /appointments/:id returns an owned appointment matching the DB | api | API-APT-13 | F-15 | Pass |
| TC-APT-003 | Appointments API › appointment list uses the OpenAPI date-only format | api | API-APT-02 | F-15 | Expected failure |
| TC-APT-004 | Appointments API › appointment detail uses the OpenAPI date-only format | api | API-APT-02, API-APT-13 | F-15 | Expected failure |
| TC-APT-005 | Appointments API writes › POST /appointments stores exactly one owned appointment and detail agrees | api @mutating | API-APT-04 | — | Pass |
| TC-APT-006 | Appointments API writes › PUT /appointments/:id/reschedule stores the new slot and preserves identity | api @mutating | API-APT-19 | — | Pass |
| TC-APT-007 | Appointments API writes › PUT /appointments/:id/cancel stores the cancellation without touching a control | api @mutating | API-APT-16 | F-16 | Fail |
| TC-APT-008 | Appointments API writes › DELETE /appointments/:id removes the row and detail returns 404 | api @mutating | API-APT-25 | — | Pass |
| TC-APT-009 | Appointments API writes › POST /appointments rejects missing doctor without storing a row | api @mutating | API-APT-05 | — | Pass |
| TC-APT-010 | Appointments API writes › POST /appointments rejects yesterday without storing a row | api @mutating | API-APT-07 | F-12 | Fail |
| TC-APT-011 | Appointments API writes › POST /appointments rejects year 0123 without storing a row | api @mutating | API-APT-07 | F-12 | Fail |
| TC-APT-012 | Appointments API writes › POST /appointments rejects invalid clock without storing a row | api @mutating | API-APT-08 | F-02 | Fail |
| TC-APT-013 | Appointments API writes › POST /appointments rejects inactive doctor without storing a row | api @mutating | API-APT-09 | F-04 | Fail |
| TC-APT-014 | Appointments API writes › POST /appointments rejects a duplicate slot and leaves exactly one booking | api @mutating | API-APT-10 | F-03 | Fail |
| TC-APT-015 | Appointments API writes › PUT /appointments/:id/reschedule rejects an invalid body and stores no change | api @mutating | API-APT-22 | F-17 | Fail |
| TC-PAY-001 | GET /payments matches payments for the patient appointments | api | API-PAY-01, API-PAY-02 | F-09 | Pass |
| TC-PAY-002 | POST /payments stores one valid payment and rejects invalid amounts | api @mutating | API-PAY-04, API-PAY-07, API-PAY-08 | F-18 | Fail (first step; later steps not executed) |
| TC-NOT-001 | GET /notifications contains only the user records and maps isRead to is_read | api | API-NOT-01, API-NOT-02 | F-10 | Pass |
| TC-NOT-002 | PUT /notifications/:id/read changes only that read flag and repeats idempotently | api @mutating | API-NOT-04, API-NOT-05 | — | Skipped |
| TC-UI-LOGIN-001 | Login page › valid credentials land on the dashboard | ui | — | — | Pass |
| TC-UI-LOGIN-002 | Login page › invalid password keeps the user on /login | ui | — | — | Pass |
| TC-UI-ACCESS-001 | Access control › unauthenticated visit to /dashboard redirects to /login | ui | — | — | Pass |
| TC-UI-DASH-001 | Dashboard › greets the user by first name from the DB | ui | — | — | Pass |
| TC-UI-DASH-002 | Dashboard › sidebar navigation links to each section | ui | — | — | Pass |
| TC-UI-DASH-003 | Dashboard › each image is under 500 KB | ui | — | F-13 | Expected failure |
| TC-UI-NAV-001 | Sidebar destinations › opens Doctors with its page heading | ui | — | — | Pass |
| TC-UI-NAV-002 | Sidebar destinations › opens Appointments with its page heading | ui | — | — | Pass |
| TC-UI-NAV-003 | Sidebar destinations › opens Notifications with its page heading | ui | — | — | Pass |
| TC-UI-NAV-004 | Sidebar destinations › returns to Dashboard from Doctors | ui | — | — | Pass |
| TC-UI-BOOK-001 | booking loads the selected doctor availability into time options without submitting | ui | API-DOC-07 | F-19 | Pass |

## Keeping this folder in sync

When a test is added, renamed or removed:

1. Run `RUN_MUTATING=1 npx playwright test --list` and compare the output with the matrix above.
2. Add or edit the case in the document that mirrors the spec. Update the line reference and the exact title.
3. Update the matrix row and the per-file count.
4. If the test covers a catalog row or a finding, link it here, and update the automation mapping in `docs/API_TEST_CASES.md` and `docs/FINDINGS.md`.
