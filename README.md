# Light-it QA challenge — MedAppoint

[![Playwright](https://github.com/MG-RA/challenge_light-it/actions/workflows/playwright.yml/badge.svg?branch=main)](https://github.com/MG-RA/challenge_light-it/actions/workflows/playwright.yml)

Playwright and TypeScript test suite for MedAppoint, covering the web UI, the REST API and the read-only Postgres database. API responses are validated against the supplied OpenAPI contract and reconciled with stored data; the database is the oracle. Tests that change remote data are opt-in.

## At a glance

- **Verdict: not release-ready.** Two P0 blockers: a payment reports success but is never stored (F-18), and a cancellation reports success but the appointment stays active (F-16). Both were reproduced twice against the database.
- **16 confirmed bugs** — 2 P0, 4 P1, 8 P2, 2 P3 — plus one historical report awaiting re-verification. Next most urgent: double booking of the same slot (F-03), invalid dates and times accepted and stored (F-02, F-12, F-17).
- **83 automated tests.** The 67 in the default suite pass in GitHub Actions ([latest run on `main`](https://github.com/MG-RA/challenge_light-it/actions/runs/34776679694)); 9 of them track 7 known bugs as expected failures, so any red run means something changed. 16 opt-in tests write owned, marked data to the shared environment and reproduce the write-path bugs; cleanup is verified in the DB.
- **Run it:** `npm ci`, `npx playwright install chromium`, fill `.env` from `.env.example`, then `npm test`.

## Start here

| Document | What it contains |
|---|---|
| [Findings](docs/FINDINGS.md) | Prioritized bug list: reproduction steps, expected vs. actual, impact and evidence for each finding |
| [Test cases](test-cases/README.md) | One written case per automated test: steps, expected results, related finding and latest result |
| [QA plan](QA_PLAN.md) | Scope, risks, assertion policies, execution model, coverage gaps and roadmap |
| [Contributing](CONTRIBUTING.md) | Where code belongs, assertion and known-defect conventions, safe remote writes, time zones |

## Current state

**Automation:** 83 Playwright tests in 15 files. The default run executes 67; the other 16 write owned data to the shared environment and run only when explicitly enabled.

**Latest results:** one full run of every suite on 2026-09-13 (default, API writes, UI writes, then the rate-limit check), with the default suite and the payment writes rerun after later changes on the same day:

| Result | Cases |
|---|---:|
| Passed | 61 |
| Expected failures (known defects marked `test.fail`) | 9 |
| Failed, each reproducing a finding (opt-in write and rate-limit runs only) | 12 |
| Skipped (no attributable notification) | 1 |

**The default suite is green in GitHub Actions:** every defect it reproduces is an expected failure, so a red CI run always means something new — a regression, a changed defect signature, or a fix to confirm. Every failure reproduces a documented finding; there were no new failures, no unexpected passes, no retries and no suite errors. Write cleanup was verified: no marked rows remained and no payment residue was created. Per-run tallies and durations are in the [run record](test-cases/README.md#run-record); per-case results are in the [test-case matrix](test-cases/README.md#traceability-matrix).

**Bugs requiring action** (full details in [FINDINGS.md](docs/FINDINGS.md)):

| Priority | ID | Summary |
|---|---|---|
| **P0** | F-18 | Payment reports success without storing a payment — **release blocker** |
| **P0** | F-16 | Cancellation reports success but leaves the appointment active — **release blocker** |
| P1 | F-03 | The same doctor, date and time can be booked twice |
| P1 | F-17 | Rescheduling accepts and stores an invalid date and time |
| P1 | F-12 | Booking accepts past dates; the UI has no past-date validation |
| P1 | F-02 | Booking stores an impossible clock value (`25:99`) |
| P2 | F-05 | An occupied appointment slot remains selectable |
| P2 | F-21 | Next appointment card shows the wrong appointment |
| P2 | F-23 | Upcoming appointments counter does not update |
| P2 | F-22 | No login throttling within ten failed attempts |
| P2 | F-04 | Booking accepts an inactive doctor |
| P2 | F-24 | Payments accept zero and negative amounts with HTTP 200 |
| P2 | F-15 | Appointment dates are timestamps, not the declared date-only format |
| P2 | F-01 | Doctor list omits fee and active status |
| P3 | F-14 | Patient-specific responses use public cache directives |
| P3 | F-20 | Empty-signature tokens get an undocumented plain-text 403 |

FINDINGS.md also holds F-06 (profile save corrupts names: historical, awaiting re-verification with a disposable account) and UI feedback and open clarifications (F-07 to F-11, F-13, F-19).

## Setup

Requires Node 26+ (see `.nvmrc`).

```bash
npm ci
npx playwright install chromium
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env`. Fill in the challenge credentials and DB connection values. Variables already set in the environment take precedence over `.env`. `TEST_TIMEZONE` (default `UTC`) sets the one time zone used by both test date math and the browser, so results do not depend on the machine's clock zone.

| Surface | Target | Playwright project |
|---|---|---|
| UI | https://light-it-qa-challenge.vercel.app | `ui` (Chromium) |
| API | https://qa-challenge-backend.vercel.app | `api` |
| DB | Supabase Postgres, read-only account | no project of its own; the data oracle for the `api` and `ui` tests |

## Commands

```bash
npm test                # default suite (no remote writes)
npm run test:api
npm run test:ui
npm run test:list       # list tests without running them
npm run typecheck
npm run lint
npm run report          # open the last HTML report
```

The `api` and `ui` projects share one API login from `tests/auth.setup.ts`.

**Opt-in runs** (shared live environment, run one at a time):

- **API writes:** `RUN_MUTATING=1 npm run test:writes`
- **UI writes:** `RUN_MUTATING=1 npx playwright test tests/ui/booking-state.spec.ts tests/ui/dashboard-state.spec.ts --project=ui --workers=1`
- **Login rate limit:** `RUN_RATE_LIMIT=1 npx playwright test tests/api/rate-limit.spec.ts --project=api --no-deps --workers=1`. Sends at most ten failed logins; run it last.

How write tests stay safe on shared data:

- `RUN_MUTATING` must be exactly `1`; other non-boolean values fail configuration. Write tests run on one worker with no retries, and the `owned` fixture refuses to start otherwise.
- Every created appointment carries a unique run marker in `notes`. Only rows this run created and still owns may be rescheduled, cancelled, deleted or paid.
- Teardown deletes every marked row and verifies its absence in the DB. An appointment kept by linked payments is cancelled instead and annotated as residue.
- Caps: 20 booking and 4 payment submissions per worker process. A failed test restarts the worker and resets them, so they are not a run-wide budget.
- A killed process can leave a marked row behind. Find it with `select id, notes from appointments where notes like 'qa-suite %'`.

## Structure

```text
src/api/             API client, models, OpenAPI contract validation
src/auth/            shared session and forged-token helpers
src/config/          environment validation and write opt-in
src/db/              parameterized DB lookups and bounded state observation
src/fixtures/        test fixtures, custom matchers, redacted diagnostics
src/pages/           page objects and the shared sidebar component
src/support/         calendar math in the suite time zone
tests/api/           API read cases, opt-in writes, ownership and cleanup helpers
tests/ui/            login, dashboard, navigation and booking
test-cases/          written test cases, mirroring tests/
docs/FINDINGS.md     prioritized defect register
docs/openapi.json    supplied OpenAPI contract snapshot, never edited
QA_PLAN.md           scope, risks, approach and roadmap
```

## Reports and CI

HTML reports go to `playwright-report/`; JSON and JUnit results go to `test-results/`. GitHub Actions ([workflow](.github/workflows/playwright.yml)) runs type checking, lint and the default suite, on pushes to `main`, same-repository pull requests and manual dispatch. It needs repository secrets `APP_USER_EMAIL`, `APP_USER_PASSWORD`, `DB_HOST`, `DB_USER` and `DB_PASSWORD`. The first hosted runs passed on 2026-09-13, for [pull request #1](https://github.com/MG-RA/challenge_light-it/actions/runs/34776433354) and for the [merge to `main`](https://github.com/MG-RA/challenge_light-it/actions/runs/34776679694): 69 tests, 59 passed, 9 expected failures, 1 skipped, no retries (two DB connectivity checks have since been retired). Their logs and artifacts were checked and contain no credentials, tokens, traces or screenshots. Opt-in write and rate-limit results come from local runs; see the [run record](test-cases/README.md#run-record).

Status diagnostics redact response bodies. In CI no traces, screenshots or videos are recorded, because traces carry the session token and artifacts of a public repository are downloadable; CI artifacts hold only reports and assertion messages. Local runs keep all three for failures and can contain account data, so review them before sharing; `.env`, `.auth/` and raw reports are git-ignored.
