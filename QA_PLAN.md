# QA plan — MedAppoint

Owner: QA. Version 1.0, drafted 2026-09-12. **This is the entry point.** Every other document under
`docs/` is either a catalog, a dated record, or an archive; see [§11 Document map](#11-document-map).

Read in this order: this plan → [test cases](docs/API_TEST_CASES.md) → [findings](docs/FINDINGS.md) →
the latest dated run record.

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

Priorities drive test order and release gates. Status reflects the repo as of 2026-09-12.

| # | Risk | Priority | Current coverage | Status |
|---|---|---|---|---|
| R1 | One patient can read or modify another's records | **P0** | Own-record reconciliation vs DB; missing/malformed token on 8 protected GETs; cross-patient appointment read (403); altered `user_id`, `alg:none` and empty-signature tokens on profile | **Partial** — cross-user writes and list isolation need User B; F-20 open (edge 403) |
| R2 | A write reports success but does not persist | **P0** | Write cases assert the stored row after every write | **Failing** — F-16 cancel, F-18 payment |
| R3 | Invalid bookings are accepted and stored | **P0** | Past date, invalid clock, inactive doctor, duplicate slot | **Failing** — F-02, F-03, F-04, F-12, F-17; Q-tier, not yet a gate (pending §12 Q1–3) |
| R4 | Payment integrity (amount, ownership, duplication) | P1 | Valid step only; zero/negative/duplicate implemented but blocked | **Blocked** by the F-18 safety stop |
| R5 | Authentication weaknesses (expiry, logout, rate limit) | P1 | Login success/failure only | **Partial** |
| R6 | Contract drift between spec, API and DB | P1 | Literal schema + completeness policy on read paths | **Partial** — F-01, F-15 open |
| R7 | Sensitive data in responses, caches or CI artifacts | P1 | Cache-header cases; redacted matcher diagnostics | **Partial** — F-14 open; traces/screenshots unredacted |
| R8 | UI journeys break for real users | P2 | Login, redirect, dashboard, sidebar, availability load | **Partial** — no booking journey |
| R9 | Accessibility, mobile, cross-browser regressions | P3 | None | **Uncovered** |
| R10 | Performance budgets | P3 | One image-size budget | **Partial** — F-13 open |

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
5. **UI journeys** — real navigation and real network traffic; no mocking of the product API.

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

### 4.3 Documented exception

**F-15:** the API returns appointment dates as UTC-midnight timestamps instead of `YYYY-MM-DD`.
Read-side tests convert that one exact representation and validate everything else normally;
separate list/detail contract cases keep the mismatch visible. Non-midnight values, offsets,
malformed and impossible dates still fail. The published schema is not modified.

## 5. Environment, data and accounts

- **Single shared remote environment.** No dedicated test environment, no fixture seeding, no reset.
  External concurrent writes can produce genuine mismatches; treat an isolated reconciliation failure
  as environmental only after re-observing it.
- **One account for all workers.** Login is rate-limited. A full default run performs four login
  attempts (setup, API bad password, UI success, UI bad password). Avoid repeated full runs and never
  load-test login.
- **Discover data at runtime** from the DB. No hard-coded seeded IDs. When no eligible record exists,
  skip conditionally with an explicit reason — skips must appear in the run summary, never be silent.
- **Owned data only.** Created appointments carry a cryptographically unique run marker in `notes`.
  Only a row this run created *and* still owns may be rescheduled, cancelled, deleted or paid.
- **Caps:** 20 booking submissions and 4 payments on one dedicated appointment, per worker process.
  Expand variants in separately scoped runs; never raise caps implicitly.
- **Teardown deletes what the test created and verifies absence.** A DELETE is never retried. A paid
  appointment that cannot be deleted is cancelled and annotated as residue.
- **Config:** `.env` from `.env.example`; secrets never committed; `.auth/` git-ignored.

## 6. Execution model

| Suite | Command | Selection | Concurrency |
|---|---|---|---|
| Default regression | `npm test` | `@mutating` excluded by `grepInvert` | 4 workers local, 2 CI; 0 retries local, 1 CI |
| Per surface | `npm run test:api` / `test:ui` / `test:db` | project filter | as above |
| Writes | `RUN_MUTATING=1 npm run test:writes` | `@mutating` only | **1 worker, 0 retries, declaration order, 90 s timeout** |
| Static | `npm run typecheck` / `npm run lint` | — | — |

`RUN_MUTATING` accepts unset, `0`, `false` or `1`; any other value fails configuration. Only `1`
makes write cases discoverable, and the `owned` fixture refuses to run if the forced single-worker
settings were overridden or if the token identity is not the configured DB account.

**Cadence**

- Every PR and every push to `main`: typecheck, lint, default regression (CI, Chromium).
- Write suite: **manual, deliberate, with permission**. Never scheduled, never in PR CI. It writes to
  a shared production-like target and can leave documented payment/notification residue.
- Before any submission or milestone: one default run plus one write run, both recorded in
  `docs/runs/` on the same day.

**Reporting:** HTML + list + JSON locally; CI adds JUnit and GitHub annotations and retains artifacts
14 days. `test-results/results.json` separates actual from expected status. Each run's durable,
sanitized summary goes in `docs/runs/YYYY-MM-DD-<suite>.md`.

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
5. A dated run record exists, and plan, catalog and findings agree with it.

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

Discovery on 2026-09-12, from the working tree:

| Suite | setup | api | db | ui | total |
|---|---:|---:|---:|---:|---:|
| Default (`npm test`) | 1 | 35 | 2 | 11 | **49** |
| With `RUN_MUTATING=1` | 1 | 48 | 2 | 11 | **62** |

13 write cases. Live endpoint coverage reaches **14 of 17 operations**; `POST /auth/logout`,
`PUT /users/me` and `PUT /notifications/{id}/read` have no live coverage. Calling an operation is not
case coverage — the [catalog](docs/API_TEST_CASES.md) designs 77 case groups, most still planned.

**Latest recorded runs (2026-09-12):**

- [Default](docs/runs/2026-09-12-default.md): 42 passes, 7 expected failures (F-01, F-13, F-14×2, F-15×2, F-20), 0 unexpected.
- [Writes](docs/runs/2026-09-12-writes.md): 5 passes, 8 failures (F-02/03/04/12×2/16/17/18), 1 skip; residue check clean.

`docs/EXECUTION.md` and `docs/STATE_EXECUTION.md` describe an older tree and are historical only.

## 10. Roadmap

Ordered by risk, with the prerequisite each wave depends on. Do not start a wave whose prerequisite
is unmet — record it as blocked instead.

**Wave 0 — restore a trustworthy baseline** *(no prerequisites; do this first)*

- ~~Run default + write suites once, record both in `docs/runs/`, retire the stale totals.~~ Done 2026-09-12.
- Execute the document consolidation in [§11](#11-document-map).
- Either fill `exploratory.md` with the session notes it was meant to hold, or delete it.

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
- Unknown availability (DOC-08), unknown appointment (APT-15), explicit login contract (AUTH-01).

**Wave 4 — blocked-by-access work** *(prerequisites named per item)*

- Profile round trip — needs a disposable account or reliable reset (F-06).
- Notification read — needs an attributable generated notification.
- Logout semantics and token expiry — need a separate controlled session.
- Bounded rate-limit probe — needs a controlled environment and agreed bounds.

**Wave 5 — UI and non-functional** *(no prerequisites)*

- Booking → cancellation UI journey; availability failure and recovery, extending F-19.
- axe accessibility smoke on login and dashboard; mobile viewport; Firefox and WebKit.
- Agreed performance budgets beyond the single image check (F-13).

**Standing engineering follow-ups:** trusted-CA DB TLS — certificate verification is currently
disabled — artifact redaction beyond the matcher, and artifact retention appropriate to the data.

## 11. Document map

| Document | Role |
|---|---|
| [README.md](README.md) | Submission entry point, setup and commands |
| [QA_PLAN.md](QA_PLAN.md) | Authoritative plan: scope, risks, approach, gates and roadmap |
| [test-cases/README.md](test-cases/README.md) | Implemented UI, API and DB case map |
| [docs/API_TEST_CASES.md](docs/API_TEST_CASES.md) | Broader API design catalog; not all cases automated |
| [docs/FINDINGS.md](docs/FINDINGS.md) | Defect register and evidence |
| [docs/WRITE_TESTING.md](docs/WRITE_TESTING.md) | Write commands, ownership, caps and cleanup limits |
| [Latest default run](docs/runs/2026-09-13-default.md) | Current read-only execution and submission refinements |
| [Latest write run](docs/runs/2026-09-12-writes.md) | Current live write evidence; not rerun during final review |
| `TEST_STRATEGY.md`, `docs/EXECUTION.md`, `docs/STATE_EXECUTION.md`, `docs/AUDIT.md` | Historical records retained to preserve evidence and existing links |

Keep current run totals in dated records, operational write mechanics in the runbook, and planned coverage separate from implemented cases. The empty local `exploratory.md` is not a submission deliverable.

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
