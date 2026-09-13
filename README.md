# Light-it QA challenge — MedAppoint

Playwright and TypeScript test suite for MedAppoint, covering the web UI, the REST API and the read-only Postgres database. API responses are validated against the supplied OpenAPI contract and reconciled with stored data; the database is the oracle. Tests that change remote data are opt-in.

## Start here

| Document | What it contains |
|---|---|
| [Findings](docs/FINDINGS.md) | Prioritized bug list: reproduction steps, expected vs. actual, impact and evidence for each finding |
| [Test cases](test-cases/README.md) | One written case per automated test: steps, expected results, related finding and latest result |
| [QA plan](QA_PLAN.md) | Scope, risks, assertion policies, execution model, coverage gaps and roadmap |

## Current state

**Automation:** 85 Playwright tests in 16 files. The default run executes 70; the other 15 write owned data to the shared environment and run only when explicitly enabled.

**Latest results** (API writes on 2026-09-12; API reads, UI, DB and the rate-limit check on 2026-09-13):

| Result | Cases |
|---|---:|
| Passed | 64 |
| Expected failures (known defects marked `test.fail`) | 4 |
| Failed, each reproducing a finding | 16 |
| Skipped (no attributable notification) | 1 |

Per-case results are in the [test-case matrix](test-cases/README.md#traceability-matrix). No single full run of the current tree has been recorded yet.

**Bugs requiring action** (full details in [FINDINGS.md](docs/FINDINGS.md)):

| Priority | ID | Summary |
|---|---|---|
| P1 | F-18 | Payment reports success without storing a payment |
| P1 | F-16 | Cancellation reports success but leaves the appointment active |
| P1 | F-03 | The same doctor, date and time can be booked twice |
| P1 | F-17 | Rescheduling accepts and stores an invalid date and time |
| P1 | F-12 | Booking accepts past dates; the UI has no past-date validation |
| P1 | F-02 | Booking stores an impossible clock value (`25:99`) |
| P1 | F-06 | Profile save merges surname and notes into the first name (historical) |
| P2 | F-05 | An occupied appointment slot remains selectable |
| P2 | F-21 | Next appointment card shows the wrong appointment |
| P2 | F-23 | Upcoming appointments counter does not update |
| P2 | F-22 | No login throttling within ten failed attempts |
| P2 | F-04 | Booking accepts an inactive doctor |
| P2 | F-15 | Appointment dates are timestamps, not the declared date-only format |
| P2 | F-01 | Doctor list omits fee and active status |
| P3 | F-14 | Patient-specific responses use public cache directives |
| P3 | F-20 | Empty-signature tokens get an undocumented plain-text 403 |

FINDINGS.md also records UI feedback and open clarifications (F-07 to F-11, F-13, F-19).

## Setup

Requires Node 26+ (see `.nvmrc`).

```bash
npm ci
npx playwright install chromium
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env`. Fill in the challenge credentials and DB connection values. Variables already set in the environment take precedence over `.env`.

| Surface | Target | Playwright project |
|---|---|---|
| UI | https://light-it-qa-challenge.vercel.app | `ui` (Chromium) |
| API | https://qa-challenge-backend.vercel.app | `api` |
| DB | Supabase Postgres, read-only account | `db`; also the data oracle for API and UI |

## Commands

```bash
npm test                # default suite (no remote writes)
npm run test:api
npm run test:ui
npm run test:db
npm run test:list       # list tests without running them
npm run typecheck
npm run lint
npm run report          # open the last HTML report
```

The `api` and `ui` projects share one API login from `tests/auth.setup.ts`; `db` does not need it.

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
tests/api/           API read cases, opt-in writes, ownership and cleanup helpers
tests/ui/            login, dashboard, navigation and booking
tests/db/            connectivity and read-only permission checks
test-cases/          written test cases, mirroring tests/
docs/FINDINGS.md     prioritized defect register
docs/openapi.json    supplied OpenAPI contract snapshot, never edited
QA_PLAN.md           scope, risks, approach and roadmap
```

## Reports and CI

HTML reports go to `playwright-report/`; JSON and JUnit results go to `test-results/`. GitHub Actions ([workflow](.github/workflows/playwright.yml)) runs type checking, lint and the default suite, and needs repository secrets `APP_USER_EMAIL`, `APP_USER_PASSWORD`, `DB_HOST`, `DB_USER` and `DB_PASSWORD`. A hosted CI run has not been verified yet.

Status diagnostics redact response bodies, but screenshots, traces and assertion diffs can still contain account data. Review artifacts before sharing them; `.env`, `.auth/` and raw reports are git-ignored.
