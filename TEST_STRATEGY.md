# Test strategy — MedAppoint QA challenge

> Historical strategy, superseded by [QA_PLAN.md](QA_PLAN.md). Coverage and implementation statements below describe an older tree, including removed local tests. Use the [implemented case map](test-cases/README.md) and [latest default run](docs/runs/2026-09-13-default.md) for the submission.

Updated 2026-09-11. This document separates delivered coverage from planned work. See [execution results](docs/EXECUTION.md), [app findings](docs/FINDINGS.md), and the [initial framework audit](docs/AUDIT.md).

## 1. Objective, scope, and evidence

Demonstrate a maintainable Playwright framework with trustworthy assertions across API, browser, and read-only Postgres access. The default suite covers all eight protected GET operations, login, DB reconciliation, auth gates, and focused UI checks. Opted-in [`@mutating` API cases](docs/WRITE_TESTING.md) drive owned writes and verify persistence in the same project as the read cases. Their [live run](docs/STATE_EXECUTION.md), then executed as a separate suite, found eight failures; it does not establish that write paths are correct.

| Surface | Target | Purpose |
|---|---|---|
| UI | https://light-it-qa-challenge.vercel.app | Login feedback, access redirect, dashboard, sidebar destinations |
| API | https://qa-challenge-backend.vercel.app | Response shape, ownership, stored values, auth rejection, caching |
| DB | Supabase Postgres, read-only account | Independent comparison of stored values; no fixture seeding |

No separate acceptance-criteria document is in the repo. The [OpenAPI snapshot](docs/openapi.json) specifies 17 operations and some behavior, including the assigned-alias restriction on profile updates. Treat each source appropriately:

- **Specification:** status codes, types, formats, enums, and explicitly required fields.
- **Suite policy:** listed component fields should be present. This is stronger than the source schemas, which do not declare those fields required. Additional response fields remain allowed.
- **Business assumptions to confirm:** preventing double bookings, past-date bookings, inactive-doctor bookings, invalid lifecycle transitions, and unauthorized payments. These drive implemented and future tests but are not all established requirements.
- **Stored data:** an oracle for whether API/UI values agree with persistence. Agreement does not prove that a write was valid; both surfaces can contain the same corrupt data.
- **Historical exploration:** useful leads and recorded reproductions, labeled separately from observations repeated in this cycle.

Availability has no date parameter in the snapshot. Current tests check the slot catalog's shape, valid clock strings, and uniqueness, not whether a specific date is free. “Confirmed” can be a display mapping for API status `active`; different vocabulary alone is not a defect.

## 2. Risk and architecture

| Priority | Risk | Delivered evidence | Remaining gap |
|---|---|---|---|
| P0 | Patient isolation | Own list/detail records vs DB; missing/malformed tokens on all protected GET operations | Controlled second-user read/write authorization matrix |
| P0 | Booking integrity | Create/delete/reschedule verified; cancellation, invalid inputs and duplicate booking failed live | Fixes/retests, concurrent duplicate attempts, controlled cross-user mutations |
| P1 | Payments | List vs DB and auth gates; valid registration reported an ID without persistence | Zero/negative/duplicate steps implemented but stopped; controlled cross-user writes |
| P1 | Authentication | Setup success, API wrong password, UI success and visible rejection, logged-out redirect | Expired token, logout semantics, rate-limit boundary |
| P2 | Contract and data consistency | Literal schemas, explicit completeness checks, read-side DB comparisons | Broader mutation response contracts, stopped payment/notification transitions |
| P3 | UI and non-functional | Actual sidebar navigation, dashboard greeting/image budget | Full booking UI journey, axe, mobile, other browsers, performance measurements |

Retain an API-heavy design: thin `ApiClient` methods return raw responses; fixtures provide isolated request contexts and a worker-scoped DB pool; focused page objects own locators. DB row models remain separate from API models. Write cases live beside the read cases for the same endpoint and verify persistence through `tests/api/dbState.ts`. The local framework tests that covered guards, harness cleanup and synthetic profile assertions were removed with the separate state runner; only the two product surfaces remain.

### Assertion policy

1. `expectJson` validates status and the literal component schema, returning optional-property types.
2. `expectCompleteJson` additionally requires all listed component fields and returns complete models. Extra properties remain allowed.
3. DB comparisons project selected business fields. Decimal strings such as `120` and `120.00` are compared numerically after format and finiteness checks; these read-side checks are not payment arithmetic tests.
4. Known defects get individual tests with issue annotations. Status, shape, unrelated fields, and necessary data preconditions are validated **before** applying `test.fail` to the final defect-specific assertion. Fixed behavior produces an unexpected pass for review.
5. **F-15 exception:** data and header tests accept only the documented `YYYY-MM-DDT00:00:00.000Z` appointment representation, convert it to the calendar date, and validate every other field normally. Separate list/detail contract cases retain the date-only expectation. Non-midnight, offset, malformed, and impossible dates fail normally. The OpenAPI schema itself is unchanged.

The default run's known expectations are F-01 completeness (one), F-13 banner size (one), F-14 headers (two), and F-15 dates (two). A green runner summary includes reproduced defects; it is not a defect-free release recommendation.

State tests have no whole-test expected-failure markers. Product assertion failures and cleanup failures remain visible separately. Business rejection expectations use 400/409 when unspecified; documented missing-field rejection uses 400. HTTP success alone is never enough: verify the owned DB row and returned identity.

## 3. Implemented versus planned coverage

All paths below have the `/api` prefix. “Executed” refers to the default and state runs on 2026-09-11, not historical exploration. “Gate” means missing and malformed bearer tokens, not complete authorization testing.

| Operation | Planned next work | Implemented | Executed | Result / evidence |
|---|---|---|---|---|
| POST /auth/login | Missing fields, expiry, bounded rate-limit checks | Setup success, API bad password, UI success/rejection | Yes | Pass; [API](tests/api/auth.spec.ts), [UI](tests/ui/login.spec.ts) |
| POST /auth/logout | Invalidation semantics using a separate session | No | No | Deferred |
| GET /users/me | Controlled second-user isolation | Complete schema, selected DB fields, gate, cache policy | Yes | Data/gate pass; F-14 reproduced; [users](tests/api/users.spec.ts), [caching](tests/api/caching.spec.ts) |
| PUT /users/me | Live round trip once restoration is possible | Local controlled 400/403/round-trip checks; live case gated | Local only | Historical F-06; assigned-alias 403 is documented |
| GET /doctors | Clarify mandatory list fields | Literal schema, active IDs and selected fields vs DB, gate, completeness | Yes | Data/gate pass; F-01 reproduced; [doctors](tests/api/doctors.spec.ts) |
| GET /doctors/{id} | Additional identifier boundaries | Complete schema, DB fields, numeric fee, unknown ID, gate | Yes | Pass; [doctors](tests/api/doctors.spec.ts) |
| GET /doctors/{id}/availability | Clarify date-specific semantics, unknown ID | Slot shape, clock format, uniqueness, gate; UI options match response | Yes | Pass; [doctors](tests/api/doctors.spec.ts) |
| GET /appointments | Controlled second-user reads | IDs, ownership, selected DB fields, adapted schema, raw-date contract, gate, cache | Yes | Data/gate pass; F-14/F-15 reproduced; [appointments](tests/api/appointments.spec.ts) |
| POST /appointments | Fix/retest validation; concurrent duplication | Valid create/detail, missing doctor, past dates, invalid time, inactive doctor, sequential duplicate | Yes, state | Create/missing-field pass; F-02/F-03/F-04/F-12 reproduced |
| GET /appointments/{id} | Not-found and controlled second-user reads | Owned detail vs DB, adapted schema, raw-date contract, gate | Yes | Data/gate pass; F-15 reproduced; [appointments](tests/api/appointments.spec.ts) |
| PUT /appointments/{id}/cancel | Fix persistence; controlled cross-user writes | Owned cancel, stored status, control check | Yes, state | F-16: 200 but status unchanged; control assertion not reached |
| PUT /appointments/{id}/reschedule | Fix validation; cross-user writes | Valid move and invalid request before/after checks | Yes, state | Valid move pass; F-17 invalid update persisted |
| DELETE /appointments/{id} | Paid-record cleanup demonstration | Probe, independent delete/404, exhaustive owned cleanup | Yes, state | All 14 run appointments removed |
| POST /payments | Resume capped validation after persistence is understood | Valid/zero/negative/duplicate steps and DB assertions | Valid step only | F-18 triggered stop; other three steps unexecuted |
| GET /payments | Empty/nonempty controlled fixtures | Complete schema, IDs/fields vs owned DB payments, numeric amount, gate | Yes | Pass; [payments](tests/api/payments.spec.ts) |
| GET /notifications | Controlled empty/nonempty fixtures | Complete schema, IDs/ownership/fields vs DB, `isRead` mapping, gate | Yes | Pass; [notifications](tests/api/notifications.spec.ts) |
| PUT /notifications/{id}/read | Obtain attributable generated notification | Read-flag persistence, unchanged siblings, repeat idempotence | Local only; live skipped | Safety stop; no new notifications observed |

The [auth matrix](tests/api/auth.spec.ts) covers all eight protected GET operations. The default suite touches **9 of 17 operations**; default plus executed state cases touch **14 of 17**. Live logout, profile update, and notification-read remain uncovered. Helpers and controlled local responses do not count as live endpoint coverage.

UI: a [booking availability check](tests/ui/booking.spec.ts), six existing checks, and four [sidebar journey checks](tests/ui/navigation.spec.ts) cover login, rejection feedback, unauthenticated redirect, greeting, link markup, banner budget, each section's URL/heading, and return to Dashboard. There is no automated appointment creation, profile-save, or notification-read journey.

## 4. Data, execution, and reporting

- Discover records from the DB at runtime; do not depend on fixed seeded IDs. Lists may be empty if the DB agrees. Record-dependent detail/format/auth checks conditionally skip with an explicit reason when no eligible record exists; skips must appear in the execution summary.
- All workers share one challenge account. The default suite does not write profile, appointment, payment, or notification records. DB reconciliation is a point-in-time comparison, not an atomic cross-service snapshot; external concurrent writes can produce a real environmental mismatch.
- `RUN_MUTATING` accepts unset/`0`/`false`/`1`; other values fail configuration. Only `1` makes `@mutating` cases discoverable, and it also forces one worker, zero retries and sequential order.
- Legacy booking drafts were replaced by owned, marked writes. Only a row this run created and still owns may be mutated; teardown deletes what the test created and verifies absence, and no DELETE is retried. A paid appointment that cannot be deleted is cancelled and annotated as residue.
- Caps are 20 booking submissions and four payments on one dedicated appointment. Payment/notification residue is permitted only within the documented boundaries. The actual run made 15 booking submissions (14 persisted), one payment submission (none persisted), and left no observed residue. Remaining steps stopped on a mismatched payment response ID.
- Stored-state assertions live in `tests/api/dbState.ts` and are called after the write steps. Polling uses a 4-second bound and a 1-second observation window. This does not prove absence forever. A separate later read-only residue check was also empty. Ambiguous new notifications are recorded but never marked read solely because they appeared during the run.
- Profile mutation automation was removed because F-06 prevents reliable restoration; no local response-double tests replace it. Never substitute a guessed alias: the spec requires the candidate's assigned first and last names.
- Authentication setup logs in once for the shared API/browser session. A complete default run also performs API bad-password, UI successful-login, and UI bad-password calls: **four login attempts in total** absent retries. Avoid repeated full runs and load-style login testing.
- Local workers: 4; CI: 2. Retries: 0 locally, 1 in CI. Fixtures close their contexts/pools; DB connection timeout is 5 s, server statement timeout 5 s, client query timeout 7 s.
- Reports: HTML, list, JSON; CI additionally JUnit/GitHub annotations. `test-results/results.json` separates actual and expected status. The dated [execution record](docs/EXECUTION.md) is the durable sanitized result.
- Custom status diagnostics redact arbitrary scalar content and omit unstructured bodies and URL query/fragment data. This does **not** sanitize Playwright traces, screenshots, native assertion diffs, or all reports. Review artifacts before sharing; CI retains them for 14 days.
- DB certificate verification is still disabled for the challenge connection. Trusted-CA configuration is an explicit security follow-up.

## 5. Entry, exit, and next cycle

**Entry:** URLs, account credentials, read-only DB access, installed Node/browser dependencies, and a reachable target.

**Exit for this framework cycle:** typecheck/lint pass; default regression has no unexplained failures; expected failures match their signatures; write outcomes and blocked steps are honestly recorded; cleanup/residue is verified; documentation matches execution. Write-path product failures remain red. These criteria do not approve the remote application's release.

**Next cycle, in order:**

1. Investigate/fix the demonstrated cancellation, input-validation, duplicate-booking and payment-persistence defects; do not rerun blocked writes blindly.
2. Resume zero/negative/duplicate payment and attributable-notification steps after their prerequisites are met; demonstrate paid-record cleanup with controlled residue/reset.
3. Add controlled second-user read/write checks and concurrent duplicate attempts using disposable data.
4. Restore profile round-trip automation only when exact restoration is possible; use the documented assigned alias.
5. Extend the passing availability integration check (F-19) with failure/recovery coverage, then add a booking/cancellation UI journey, axe smoke, mobile, and additional browsers.

Load/stress testing, broad penetration testing, email/SMS delivery, payment-provider internals, and database write-path testing remain out of scope. The appointment state model is a hypothesis to verify, not an acceptance criterion inferred solely from enum values.
