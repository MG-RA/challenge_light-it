# QA plan — MedAppoint

Updated 2026-09-13. Companion documents: [README](README.md) (setup and commands), [FINDINGS](docs/FINDINGS.md) (defects) and [test cases](test-cases/README.md) (every automated test with its latest result).

---

## 1. Product and objective

MedAppoint is a patient-facing appointment system: a Vercel-hosted SPA over a REST API over Supabase
Postgres. Patients log in, browse doctors and availability, book / reschedule / cancel appointments,
pay for them, and read notifications.

**Objective of the QA effort:** give the team a trustworthy, repeatable signal about whether patient
data stays isolated and whether booking and payment writes actually persist what the API claims they
persisted — and keep every claim we publish traceable to evidence.

**Explicit non-objective:** a green suite is not a release recommendation. The suite deliberately
reproduces known defects as *expected* failures, so "all passed" includes reproduced bugs.

## 2. Scope

**In scope**

| Surface | Target | What we test |
|---|---|---|
| API | `https://qa-challenge-backend.vercel.app` | All 17 OpenAPI operations: status, schema, ownership, auth gates, stored effect of writes |
| UI | `https://light-it-qa-challenge.vercel.app` | Login, access control, dashboard, sidebar navigation, booking journey |
| DB | Supabase Postgres, read-only account | Independent oracle for API/UI values; connectivity and grant enforcement |

**Out of scope** — stated so nobody assumes coverage: load and stress testing, broad penetration
testing, email/SMS delivery, payment-provider internals, database write-path testing, and any test
that mutates records we do not own.

**Currently constrained, not by choice** — prerequisites to obtain, not decisions taken:

- A second controlled account (User B). Current cross-patient appointment reads and forged-token
  rejection are covered; controlled cross-user writes and a complete two-account matrix remain blocked.
- A disposable account or reliable profile reset. Without it `PUT /users/me` stays unautomated
  (F-06 corrupts names irreversibly).
- Attributable notification generation. Without it `PUT /notifications/{id}/read` stays unverified.

## 3. Risk register

Priorities drive test order and release gates. Status reflects the repo as of 2026-09-13.

| # | Risk | Priority | Current coverage | Status |
|---|---|---|---|---|
| R1 | One patient can read or modify another's records | **P0** | Own-record reconciliation vs DB; missing/malformed token on 8 protected GETs; cross-patient appointment read (403); altered `user_id`, `alg:none` and empty-signature tokens on profile | **Partial** — cross-user writes and list isolation need User B; F-20 open (edge 403) |
| R2 | A write reports success but does not persist | **P0** | Write cases assert the stored row after every write | **Failing** — F-16 cancel, F-18 payment |
| R3 | Invalid bookings are accepted and stored | **P0** | API: past date, invalid clock, inactive doctor, duplicate slot, invalid reschedule. UI: past-date validation, occupied-slot selection | **Failing** — F-02, F-03, F-04, F-05, F-12, F-17; Q-tier, not yet a gate (pending §12 Q1–4) |
| R4 | Payment integrity (amount, ownership, duplication) | P1 | Valid step only; zero/negative/duplicate implemented but not reached | **Blocked** — the valid payment fails first (F-18) |
| R5 | Authentication weaknesses (expiry, logout, rate limit) | P1 | API login failure; bounded failed-login probe; UI login, field validation, 429 feedback and logout | **Failing** — F-22 no throttle within ten attempts; token expiry and server-side revocation untested |
| R6 | Contract drift between spec, API and DB | P1 | Literal schema + completeness policy on read paths | **Partial** — F-01, F-15 open |
| R7 | Sensitive data in responses, caches or CI artifacts | P1 | Cache-header cases; redacted matcher diagnostics | **Partial** — F-14 open; traces/screenshots unredacted |
| R8 | UI journeys break for real users | P2 | Login, redirect, logout, dashboard greeting/counters/next appointment/Quick Actions, sidebar, booking availability, validation and failure recovery | **Failing** — F-21 next appointment, F-23 counter; no successful UI booking journey |
| R9 | Accessibility, mobile, cross-browser regressions | P3 | None | **Uncovered** |
| R10 | Performance budgets | P3 | None automated; banner size recorded as feedback | **Uncovered** — F-13 feedback, budgets not agreed |

## 4. Test approach

**API-heavy, DB-verified.** The API is the richest surface and the DB is an independent oracle, so
the bulk of the investment sits there. The UI covers journeys the API cannot prove.

Layers:

1. **Contract** — validate each response against the literal OpenAPI component schema, resolving
   references, preserving optional properties and allowing extra fields.
2. **Data reconciliation** — compare API values against the read-only DB for the authenticated
   account's own records. Agreement proves consistency, *not* correctness: both surfaces can hold the
   same corrupt row.
3. **Authorization** — missing, malformed, expired and tampered tokens on all 16 protected
   operations; and, once User B exists, every cross-user read and write.
4. **Write behavior** — one API write, then bounded polling of the stored row (200 ms interval,
   4 s bound, 1 s stable window), then verified teardown.
5. **UI journeys** — real navigation and network traffic by default. Where a backend defect or live data would hide UI behavior (validation, availability failure, counter refresh, 429 feedback), a case controls the API response and says so; those cases prove UI behavior only.

### 4.1 Oracle tiers — the rule that keeps claims honest

Every assertion declares what it is based on. This is the most important convention in the suite and
it carries through into every report:

| Tier | Meaning | On failure |
|---|---|---|
| **C — Contract** | Documented in the OpenAPI snapshot: status, type, format, enum, explicitly required field | A defect, no discussion needed |
| **P — Policy** | Our stronger expectation: field completeness, persistence after success, no sensitive fields, no write after rejection | A defect *given our policy* — state the policy in the report |
| **Q — Clarification** | Proposed business rule with no agreed requirement: duplicate prevention, past-date rejection, inactive-doctor rejection, exact rejection status | **Not a release gate** until agreed. Raise as a question |

Never promote a Q to a C to make a finding look stronger. Where the spec documents no validation
response, assert that the request violates the contract but leave the exact status **TBD** rather
than inventing a 400.

### 4.2 Known-defect marking

A known defect gets its own test. Status, shape, unrelated fields and data preconditions are asserted
**before** the narrowly scoped expected-failure marker on the single defect-specific assertion. A fix
therefore surfaces as an *unexpected pass* for review rather than silently staying green. Never mark
a whole test body as expected-to-fail.

The marker is used only for stable read-path signatures (F-01, F-14, F-20). Write, UI and
business-rule defects stay **ordinary failures**, so a red run keeps them visible; contract drift that
would otherwise stop DB reconciliation (F-15) uses a soft assertion instead.

### 4.3 Documented exception

**F-15:** the API returns appointment dates as UTC-midnight timestamps instead of `YYYY-MM-DD`.
Read-side tests convert that one exact representation and validate everything else normally;
soft date-format assertions in the list and detail reconciliation cases (TC-APT-001/002) keep the mismatch visible. Non-midnight values, offsets,
malformed and impossible dates still fail. The published schema is not modified.

## 5. Environment, data and accounts

- **Single shared remote environment.** No dedicated test environment, no fixture seeding, no reset.
  External concurrent writes can produce genuine mismatches; treat an isolated reconciliation failure
  as environmental only after re-observing it.
- **One account for all workers.** Login is rate-limited. A full default run performs five login
  attempts (setup, API bad password, UI success, UI bad password, UI logout session). The opt-in
  rate-limit check adds up to ten failed attempts; run it alone and last. Never load-test login.
- **Discover data at runtime** from the DB. No hard-coded seeded IDs. When no eligible record exists,
  skip conditionally with an explicit reason — skips must appear in the run summary, never be silent.
- **Owned data only.** Created appointments carry a cryptographically unique run marker in `notes`.
  Only a row this run created *and* still owns may be rescheduled, cancelled, deleted or paid.
- **Caps:** 20 booking submissions and 4 payments on one dedicated appointment, per worker process.
  A failed test restarts the worker and resets them, so they are not a run-wide budget. Expand
  variants in separately scoped runs; never raise caps implicitly.
- **Teardown deletes what the test created and verifies absence.** A DELETE is never retried. A paid
  appointment that cannot be deleted is cancelled and annotated as residue.
- **Config:** `.env` from `.env.example`; secrets never committed; `.auth/` git-ignored.

## 6. Execution model

| Suite | Command | Selection | Concurrency |
|---|---|---|---|
| Default regression | `npm test` | `@mutating` excluded by `grepInvert` | 4 workers local, 2 CI; 0 retries local, 1 CI |
| Per surface | `npm run test:api` / `test:ui` / `test:db` | project filter | as above |
| API writes | `RUN_MUTATING=1 npm run test:writes` | `@mutating` in `api` | **1 worker, 0 retries, declaration order, 90 s timeout** |
| UI writes | `RUN_MUTATING=1 npx playwright test tests/ui/booking-state.spec.ts tests/ui/dashboard-state.spec.ts --project=ui --workers=1` | `@mutating` in `ui` | as above |
| Rate limit | `RUN_RATE_LIMIT=1 npx playwright test tests/api/rate-limit.spec.ts --project=api --no-deps --workers=1` | one case; skipped otherwise | 1 worker, 0 retries |
| Static | `npm run typecheck` / `npm run lint` | — | — |

`RUN_MUTATING` accepts unset, `0`, `false` or `1`; any other value fails configuration. Only `1`
makes write cases discoverable, and the `owned` fixture refuses to run if the forced single-worker
settings were overridden or if the token identity is not the configured DB account.

**Cadence**

- Every PR and every push to `main`: typecheck, lint, default regression (CI, Chromium).
- Write suite: **manual, deliberate, with permission**. Never scheduled, never in PR CI. It writes to
  a shared production-like target and can leave documented payment/notification residue.
- Before any submission or milestone: one default run plus one write run on the same day, with
  results recorded in the test cases and findings.

**Reporting:** HTML + list + JSON locally; CI adds JUnit and GitHub annotations and retains artifacts
14 days. `test-results/results.json` separates actual from expected status. The durable
record is each case's **Last recorded** result in [test-cases/](test-cases/README.md) and the
evidence status in [FINDINGS](docs/FINDINGS.md); raw reports stay local and unsanitized.

## 7. Entry and exit criteria

**Entry:** reachable targets, valid credentials, read-only DB access, Node 26+ and browsers
installed, `.env` populated, prior run's residue confirmed cleaned.

**Exit for a QA cycle** — all must hold:

1. `npm run typecheck` and `npm run lint` pass.
2. Default regression has no unexplained failures and no unexpected passes; every expected failure
   matched its recorded signature on inspection, not merely by count.
3. Write-run outcomes, blocked steps and skips are recorded honestly; blocked steps are never
   reported as passes.
4. Cleanup verified: created rows absent, residue within documented boundaries and annotated.
5. Test-case results, findings and this plan are updated and agree with the run.

**Release gates** — what QA blocks on, as opposed to reports:

- Any open **C- or P-tier** defect under R1 or R2 blocks release.
- Any C-tier contract failure on a documented status or required field blocks release.
- Q-tier expectations do **not** block until the business rule is agreed and promoted. This includes
  the R3 validation defects (F-02, F-03, F-04, F-12, F-17): they are reported at their severity, and
  they become blocking once §12 questions 1–3 are answered and the rule is promoted to C or P.

## 8. Defect workflow

1. Reproduce with a controlled, owned request. Capture before-state → single action → after-state
   from both API and DB.
2. Record in [docs/FINDINGS.md](docs/FINDINGS.md) with ID, severity, area, oracle tier, and an
   **evidence status** that distinguishes *controlled reproduction this cycle*, *observed stored
   data*, and *historical, not rerun*. Never blur those three.
3. Add one narrow automated case per [§4.2](#42-known-defect-marking), linked from the finding.
4. On fix: the case reports an unexpected pass → verify → remove the marker → note the fix date in
   the finding.
5. Sanitize before sharing. Traces, screenshots and native assertion diffs are **not** redacted by
   the custom matcher; review artifacts before distribution.

Severity reflects potential impact; evidence status reflects what was actually demonstrated. Always
show both.

## 9. Current coverage baseline

Discovery on 2026-09-13 (`npm run test:list`):

| Suite | setup | api | db | ui | total |
|---|---:|---:|---:|---:|---:|
| Default (`npm test`) | 1 | 34 | 2 | 33 | **70** |
| With `RUN_MUTATING=1` | 1 | 47 | 2 | 35 | **85** |

15 write cases (13 API, 2 UI). The default count includes the rate-limit case, which skips unless
`RUN_RATE_LIMIT=1`. Live endpoint coverage reaches **14 of 17 operations**: `POST /auth/logout` and
`PUT /users/me` have no API coverage, and `PUT /notifications/{id}/read` is automated but skips
without an attributable notification. Calling an operation is not case coverage; remaining gaps are
in §10.

**Latest recorded results** (one full run of every suite on 2026-09-13, commit `d152cd3`, clean tree):
**64 passed, 4 expected failures (F-01, F-14 ×2, F-20), 16 failed, 1 skipped**. Every failure
reproduces a finding; no unexpected passes, retries or suite errors; write cleanup verified. Per-run
tallies are in the [run record](test-cases/README.md#run-record) and per-case results in the
[test-case matrix](test-cases/README.md#traceability-matrix).

## 10. Roadmap

Ordered by risk, with the prerequisite each wave depends on. Do not start a wave whose prerequisite
is unmet — record it as blocked instead.

**Wave 0 — restore a trustworthy baseline** *(no prerequisites; do this first)*

- ~~Run default + write suites once and retire the stale totals.~~ Done 2026-09-12.
- ~~Consolidate documentation into README, this plan, FINDINGS and test cases.~~ Done 2026-09-13.
- ~~Run the full default, write and rate-limit suites on one day against the current tree, so every
  case's last result comes from the same code.~~ Done 2026-09-13 (commit `d152cd3`).

**Wave 1 — close the P0 gap** *(prerequisite: User B account + token)*

- Done without User B (2026-09-12): cross-patient appointment detail read, and altered-identity,
  `alg:none` and empty-signature tokens on `GET /users/me` ([auth tests](tests/api/auth.spec.ts)).
- Cross-user read matrix: profile, appointments, payments, notifications for A and B.
- Cross-user write matrix on B-owned records, using only disposable data. Never delete B's fixtures.
- Auth gates on the 8 protected **write** operations, not just the GETs.

**Wave 2 — retest and finish the write path** *(prerequisite: fixes for F-16/F-17/F-18)*

- Retest cancellation, invalid reschedule and payment persistence within existing caps.
- Resume the blocked zero / negative / duplicate payment steps.
- Concurrent duplicate-booking attempt; the sequential case already fails.
- Demonstrate paid-record cleanup live rather than only locally.

**Wave 3 — contract and boundary depth** *(no prerequisites)*

- Per-operation inline response validation; each required field omitted in its own case.
- ID boundary cases (`abc`, `1.5`, `0`, `-1`, large integers) on every `{id}` route.
- Ownership-override attempts via extra body fields.
- Unknown doctor availability, unknown appointment detail, and an explicit login response contract.

**Wave 4 — blocked-by-access work** *(prerequisites named per item)*

- Profile round trip — needs a disposable account or reliable reset (F-06).
- Notification read — needs an attributable generated notification.
- Server-side logout revocation and token expiry — need a separate controlled session. Browser
  logout is covered (TC-UI-NAV-005).
- Rate-limit threshold, recovery time and account-versus-IP scope — need agreed bounds. The bounded
  ten-attempt probe is done (TC-AUTH-RATE-001, F-22).

**Wave 5 — UI and non-functional** *(no prerequisites)*

- Successful booking → cancellation UI journey; empty next-appointment branch; stale availability
  races. Validation, availability failure/recovery and occupied-slot checks are done.
- axe accessibility smoke on login and dashboard; mobile viewport; Firefox and WebKit.
- Agreed performance budgets (F-13); no image budget is automated.

**Standing engineering follow-ups:** trusted-CA DB TLS — certificate verification is currently
disabled — artifact redaction beyond the matcher, and artifact retention appropriate to the data.

## 11. Document map

| Document | Role |
|---|---|
| [README.md](README.md) | Entry point: current state, setup and commands |
| [QA_PLAN.md](QA_PLAN.md) | Scope, risks, approach, gates and roadmap |
| [docs/FINDINGS.md](docs/FINDINGS.md) | Prioritized defect register with reproduction and evidence |
| [test-cases/](test-cases/README.md) | One written case per automated test, with latest results |
| [docs/openapi.json](docs/openapi.json) | Supplied contract snapshot used by contract validation; never edited |

Keep results in the test cases, defects in FINDINGS, and planned coverage in §10.

## 12. Open questions for the product owner

These block Q-tier expectations from becoming release gates. None can be resolved from the repo.

1. Must duplicate bookings (same doctor / date / slot) be rejected, and with which status?
2. Must past-dated bookings be rejected? What is the earliest valid booking date?
3. Must bookings against an inactive doctor be rejected, and how are existing appointments handled
   when a doctor is deactivated afterwards?
4. Is `/doctors/{id}/availability` a static slot catalog or per-date vacancy? Which layer resolves
   occupied slots, and in which timezone? (F-05)
5. Which doctor fields must the list return? The spec declares them but not as required. (F-01)
6. Is the appointment date meant to be `YYYY-MM-DD` or a timestamp? (F-15)
7. Are public cache directives on per-user responses intentional? (F-14)
8. What is the agreed appointment status lifecycle? The enum alone is not an acceptance criterion.
9. Is the future-dated notification (`2027-03-15`) deliberate seed data? (F-07)
10. What page-weight and load budgets apply? (F-13)
