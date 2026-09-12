# QA challenge audit — 2026-09-11

> Historical baseline before the framework improvement cycle. See [execution results](EXECUTION.md)
> and the revised [strategy](../TEST_STRATEGY.md) for current coverage. A-01/A-02/A-03 were addressed;
> default-suite failure guards, contract policy, diagnostics, and documentation were improved for
> A-04/A-05/A-07/A-08. Legacy mutation drafts were subsequently replaced by the
> opted-in [`@mutating` API cases](WRITE_TESTING.md). Broader artifact privacy and A-06 trusted DB TLS remain
> follow-ups. Original observations and counts below are preserved as the audit record.

## Assessment and scope

The suite is a good foundation: small page objects, thin API wrappers, typed fixtures, parameterized SQL, isolated anonymous request contexts, strict TypeScript, and useful failure messages. The main submission risk is confidence: the written strategy is substantially broader than the executed coverage, and some tests can pass for the wrong reason. Prioritize trustworthy assertions and evidence over adding more framework abstractions.

Reviewed the working tree based on commit `83f3965`, including existing uncommitted changes, all source/tests, configuration, CI, OpenAPI snapshot, README, strategy, and findings. This repository contains the test harness, not the application's implementation; backend root causes cannot be established from source here. Existing work was preserved. This audit adds documentation only.

## Validation performed

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npx playwright test --list` | 17 tests: setup 1, API 8, DB 2, UI 6 |
| `npx playwright test --workers=1 --retries=0` | Exit 0, 17.1 seconds; 14 normal passes including setup, 3 expected failures |
| Failure evidence review | Each expected failure matched its logged symptom; see below |
| `RUN_MUTATING=0` with `--list` only | 20 tests listed, including all 3 mutating cases; no mutations executed |
| `npm audit --json` | Reported 0 vulnerabilities across 152 dependencies; advisory output is not a security guarantee |
| Manual browser smoke | Login renders labeled Email/Password and Sign In; empty submission focuses Email with required-field feedback; malformed email gets native validation |

Environment: Windows, Node 26.8.2, npm 11.7.0. Initial sandboxed test launch failed with `spawn EPERM`; the authorized retry with process/network access succeeded. Serial execution reduced pressure on the shared environment; default parallel behavior and hosted GitHub Actions were not verified. No profile, booking, payment, or notification mutations were run. The existing DB permission test executed its zero-row UPDATE and correctly received a permission denial.

Live app checks also included the suite's authenticated dashboard, successful login, navigation markup, and logged-out dashboard redirect. The invalid-password UI case completed, but its assertion is insufficient (A-03). No full manual booking journey, mobile, cross-browser, load, or accessibility audit was performed.

## Prioritized findings

### A-01 — High: mutation opt-in accepts `0` and `false`

**Evidence:** `playwright.config.ts:11` uses truthiness of `process.env.RUN_MUTATING`. Nonempty strings, including `0` and `false`, remove the exclusion. Reproduced safely with `$env:RUN_MUTATING='0'; npx playwright test --list`: 20 tests instead of 17, including profile changes and bookings.

**Impact:** a CI/user value intended to disable writes enables them. Setting `1` also does not itself isolate mutations: without `--grep`, all tests run together under `fullyParallel` against one account.

**Suggestion:** require the exact value `1`, reject other nonempty values except an explicitly supported disabled value, and add a dedicated mutation command/project with explicit selection and serial execution. Verify selection with `--list` for unset, `0`, `false`, and `1` before running writes.

### A-02 — High: profile round-trip test permanently replaces account data

**Evidence:** `tests/api/users.spec.ts:20-30` writes generated notes and never restores the prior profile. Its comment acknowledges restoration is unsafe while F-06 exists. `src/fixtures/index.ts:69-75` invents `Test Patient` when the alias is missing. The saved OpenAPI explicitly says profile updates return 403 when names do not match the candidate's assigned alias. A 403 would fail the status assertion and could be accepted by the unconditional expected-failure marker as if F-06 had reproduced.

**Impact:** even after the application bug is fixed, every opted-in run overwrites notes. A missing/wrong alias can produce a misleading green result. Parallel profile writes also conflict with worker-cached `testUser` expectations.

**Suggestion:** require a validated assigned alias and a disposable account for this test. Assert preconditions before the known-bug assertion. Capture/restore exact prior state and verify restoration only when the API can support that safely; until then, keep this case explicitly manual/destructive and separate from self-cleaning booking checks. Do not claim every mutation is self-healing.

### A-03 — Medium: invalid-password UI test can pass without processing login

**Evidence:** `tests/ui/login.spec.ts:17-20` starts on `/login`, submits, and asserts the URL is still `/login`. That condition is already true before submission; the test never waits for the authentication response or verifies an error.

**Impact:** an unresponsive submit button, a stalled request, or missing error handling can pass this test.

**Suggestion:** wait for the submitted login response, assert rejection, then assert visible rejection feedback and no authenticated navigation. Keep message wording flexible if necessary, but require a visible outcome. Verify the strengthened test fails if submission is prevented or the request never completes.

### A-04 — Medium: unconditional expected failures accept unrelated errors

**Evidence:** `tests/api/doctors.spec.ts:17`, `tests/api/caching.spec.ts:4`, `tests/ui/dashboard.spec.ts:29`, and both mutating specs mark entire cases as expected failures. Status, JSON, and business assertions are inside the marked body. For example, the doctor contract test would accept a 500 response's status assertion failure as an expected failure for missing fields.

**Impact:** a green run does not necessarily mean the documented bug reproduced. The caching test also combines two endpoints, so a fix to only one remains hidden in aggregate status.

**Suggestion:** validate successful responses and other preconditions before applying a narrowly scoped expected-failure expectation; assert the exact known deviation separately from unrelated schema errors. Split cases by endpoint/bug and report normal passes, reproduced known defects, unexpected failures, and unexpected passes separately. This audit inspected the three current error contexts and confirmed their intended failure signatures.

### A-05 — Medium: “contract conformance” silently strengthens the published contract

**Evidence:** `src/api/contract.ts:31-37` makes every property required and forbids additional properties. The source component schemas do neither. README documents the transformation, but F-01 describes omitted fields as fields the spec “promises.”

**Impact:** the suite flags responses that the supplied schema permits. Missing fee/active fields may be a real product/API design problem, but this is not proof of a literal OpenAPI violation. Ordinary additive fields also become failures.

**Suggestion:** separate literal schema validation from an explicitly named completeness policy. Log missing `required` declarations as a specification issue, then request confirmation of mandatory fields. Generate or verify TS models against whichever policy is used; the current model comments imply a closer mirror of the raw spec than exists.

### A-06 — Medium: database TLS does not authenticate the server

**Evidence:** `src/db/Db.ts:47-51` sets `ssl: { rejectUnauthorized: false }` for every connection.

**Impact:** the connection is encrypted but an untrusted server certificate is accepted; read-only access does not protect credentials or returned records from interception.

**Suggestion:** support the project's trusted CA and enable certificate verification. Make any local exception explicit and environment-specific. Verify a trusted connection succeeds and an untrusted certificate is rejected. The current comment identifies the tradeoff, but the configuration offers no secure path.

### A-07 — Medium: shared test artifacts can contain credentials or patient-shaped data

**Evidence:** `src/fixtures/matchers.ts:16-24` includes up to 2,000 raw response characters in failures; tracing is enabled in `playwright.config.ts`; `.github/workflows/playwright.yml:45-53` uploads both reports and test results for 14 days. Login/API traces and dashboard screenshots can include tokens, account fields, or notes depending on the failure and capture behavior. This audit did not establish that a secret was actually published.

**Suggestion:** redact sensitive response fields in the matcher, exclude authentication traces from shared artifacts or suppress capture on sensitive tests, and inspect a representative failure artifact before sharing a challenge report. Use synthetic accounts and ensure artifact access/retention fits the data. Ignoring `.auth` in git is good, but does not address report content.

### A-08 — Medium: the plan and defect log overstate established behavior

**Evidence:** Strategy Appendix A is labeled “target,” but uses checkmarks throughout. Section 9 describes axe smoke checks although no axe dependency/tests exist. Most P0/P1 cases are absent. `exploratory.md` is empty. The profile 403 question is already answered in `docs/openapi.json`.

**Impact:** a reviewer cannot quickly distinguish executed coverage, designed cases, assumptions, and historical observations. Several “confirmed” findings infer current write behavior from seed/current data without a controlled reproduction.

**Suggestion:** use separate Planned / Implemented / Executed / Result columns, timestamp observations, and attach sanitized evidence. Correct the inference levels listed below. Document intentional login calls: this suite performs setup login, API wrong-password login, UI successful login, and UI wrong-password login; “once per run” applies only to shared session setup.

## Existing app findings: evidence review

| Finding | Audit conclusion | Suggested documentation change |
|---|---|---|
| F-01 | Reproduced: six list entries lack `is_active` and `consultation_fee` under the enhanced validator | Distinguish missing useful fields from literal OpenAPI nonconformance (A-05) |
| F-13 | Reproduced: dashboard PNG body is 6,442,770 bytes against a 512,000-byte budget | Preserve byte evidence; label download-time calculation as an estimate, not measured loading performance |
| F-14 | Reproduced: both `/api/users/me` and `/api/appointments` return `public, max-age=0, must-revalidate` | Header concern remains; this run did not prove cross-user cache disclosure or recheck 304/CDN behavior |
| F-02/F-03 | Existing rows support invalid times and duplicate bookings at observation time | They do not alone prove today's create endpoint accepts those cases; retain as observed data defects with a separate write-path hypothesis |
| F-04 | Active appointments with a currently inactive doctor are an observation | Doctor may have been deactivated after booking; controlled reproduction or history is needed to establish booking-time validation failure |
| F-05 | “Root cause of F-03” is not established | Availability endpoint has no date parameter in the supplied spec; a generic slot catalog is possible. Clarify semantics and test date-specific behavior. Duplicate prevention must also hold on writes |
| F-06/F-12 | Historical manual reproductions are documented; not rerun here | Preserve as historical reports with date, sanitized request/response, and cleanup status. Registration timestamps alone do not exclude seeded data |
| F-07 | Future timestamp is a data plausibility observation | Record observation time/timezone and confirm whether fixtures intentionally contain future dates |
| F-08 | “Confirmed” can be a legitimate display label for API `active` | Treat as a mapping clarification until the rendered mapping is demonstrably wrong |
| F-09/F-10 | Decimal formatting and camelCase differences are consistency observations | Spec already declares payment amount as string and notification `isRead`; classify as design suggestions absent a broken consumer/requirement |
| F-11 | 404 for nonnumeric doctor ID is already appropriately labeled an observation | Do not promote to a defect without an agreed requirement |

Existing IDOR, CORS, password-hygiene, and JWT-duration positive controls were not all rerun. The automated auth gates and the DB permission check passed; neither establishes complete authorization coverage.

## Actual endpoint coverage

The snapshot defines 17 operations. Default tests touch 5 distinct operations, including setup and the appointments header-only check. Calling an operation is not comprehensive coverage.

| Operation | Implemented coverage |
|---|---|
| POST `/auth/login` | API setup success, API bad password; UI success and weak UI rejection check |
| GET `/users/me` | Identity/schema vs DB; no/malformed token; cache headers |
| PUT `/users/me` | Opt-in round trip, expected failure; not executed in this audit |
| GET `/doctors` | Active IDs vs DB; enhanced schema expected failure |
| GET `/doctors/{id}` | Unknown ID only; happy path missing |
| GET `/appointments` | Cache headers only; no body/ownership reconciliation |
| POST `/appointments` | Two opt-in past-date cases, expected failures; not executed |
| DELETE `/appointments/{id}` | Cleanup helper only; no independent behavior/authz test |
| Other 9 operations | No automated test coverage: logout, availability, appointment detail/cancel/reschedule, payment create/list, notification list/read |

UI coverage is login, logged-out redirect, dashboard greeting, link markup, and image size. No automated booking/cancellation journey, actual sidebar destination checks, profile UI, notifications flow, mobile, axe, Firefox, or WebKit coverage exists.

## Suggested next work

1. **Before running mutations:** fix A-01; isolate the profile test (A-02); make known-bug failures specific (A-04).
2. **Before submission:** strengthen invalid-login assertions; reconcile the strategy and findings with actual evidence; explain the enhanced contract policy; add a concise execution summary showing known defects separately from passes.
3. **Next coverage increment:** add read-only doctor detail/availability, appointment list/detail ownership, payments list, notifications list, and a protected-endpoint auth matrix. For cross-user checks, use two controlled test accounts and only their disposable records.
4. **Then core business risk:** valid booking plus DB round trip, duplicate-slot rejection, inactive doctor/invalid time validation, cancel/reschedule lifecycle, payment amount/ownership checks. Require unique owned test data, cleanup verification, and serial execution where account state is shared. Review payment cleanup capability first.
5. **Then UI quality:** one booking/cancellation journey, rejection feedback, meaningful sidebar navigation, login/dashboard accessibility smoke, and a mobile viewport check. Expand browser coverage once the critical path is reliable.

Additional maintainability improvements: put finite connection/query timeouts on the DB pool; attempt all booking cleanups and aggregate failures rather than stopping at the first delete error; verify records are absent afterward; account for mutation side effects such as notifications. Avoid introducing more wrappers until these behavior gaps are covered.

## Evidence locations

The test run generated a local HTML report at `playwright-report/index.html`. Detailed expected-failure context is in:

- `test-results/doctors-Doctors-API-GET-do-ad9eb-Doctor-schema-from-the-spec-api/error-context.md`
- `test-results/caching-HTTP-caching-per-u-d8bc1--cacheable-by-shared-caches-api/error-context.md`
- `test-results/dashboard-Dashboard-each-image-is-under-500-KB-ui/error-context.md`

These generated paths are ignored by git and may be replaced on the next run. The sanitized observations above are the durable audit record. Review raw artifacts for account data before distributing them.
