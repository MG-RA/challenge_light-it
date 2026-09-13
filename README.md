# Light-it QA challenge — MedAppoint

Playwright and TypeScript checks across the UI, REST API, and read-only Postgres database. API responses are checked against the supplied OpenAPI snapshot and stored data. Remote write cases are explicitly opt-in.

## Reviewer guide

1. [QA plan](QA_PLAN.md): scope, risks, assertion policies, coverage limits, and next steps.
2. [Implemented test cases](test-cases/README.md): cases mapped to the automation. The broader [API catalog](docs/API_TEST_CASES.md) contains 77 designed case groups across 17 operations; these are not all automated.
3. [Findings](docs/FINDINGS.md): reproducible defects, business-rule questions, and historical observations.
4. [Latest default run](docs/runs/2026-09-13-default.md) and [latest write run](docs/runs/2026-09-12-writes.md): sanitized execution evidence.

**Submission status:** the default run has 42 normal passes, seven reproduced known failures, and no unexpected results. Playwright counts expected failures in its green headline. This is not an approval to release MedAppoint: the latest write run has eight failures and one skipped case.

## Setup

Requires Node 26+ (see `.nvmrc`).

```bash
npm ci
npx playwright install chromium
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env`. Fill in the supplied challenge credentials and DB connection values. Existing environment variables take precedence. Keep `.env`, `.auth/`, and unsanitized reports out of the submission.

| Surface | Target | Project |
|---|---|---|
| UI | https://light-it-qa-challenge.vercel.app | `ui` (Chromium) |
| API | https://qa-challenge-backend.vercel.app | `api` |
| DB | Supabase Postgres, read-only account | `db`; also the API data oracle |

## Commands

```bash
npm test                # default suite; requires RUN_MUTATING to be unset, 0, or false
npm run test:api
npm run test:ui
npm run test:db
npm run typecheck
npm run lint
npx playwright test --list
npm run pw:ui
npm run report
```

API and UI depend on the shared authentication setup; DB checks do not. The default run includes four login attempts (setup, API bad password, UI success, UI bad password). Login is rate-limited, so avoid unnecessary repeated runs.

The default suite does not change profiles, bookings, payments, or notifications. The DB permission check issues a zero-row UPDATE and expects permission denial. To opt in to writes, follow the [write runbook](docs/WRITE_TESTING.md), including its cleanup and residue limits. `npm run test:writes` requires exactly `RUN_MUTATING=1`; other non-boolean values fail configuration. Submission caps are per worker process, and restart after failure resets them; they are not a durable run-wide budget.

## Structure

```text
src/api/             raw-response API client, models, contract validation
src/auth/            shared session and forged-token helpers
src/config/          environment validation and mutation opt-in
src/db/              parameterized lookups and bounded state observation
src/fixtures/        API, DB and page fixtures; assertions and redacted diagnostics
src/pages/           focused page objects and composed sidebar
tests/api/           read and opted-in write cases, ownership and cleanup helpers
tests/ui/            login, dashboard, navigation and booking availability
tests/db/            connectivity and permission checks
test-cases/          implemented cases with automation mappings
docs/openapi.json    supplied contract snapshot, unchanged
docs/runs/           sanitized dated execution records
```

## Reports and CI

HTML reports are in `playwright-report/`; JSON and CI JUnit results are in `test-results/`. CI runs type checking, lint, and the default suite. Configure repository secrets `APP_USER_EMAIL`, `APP_USER_PASSWORD`, `DB_HOST`, `DB_USER`, and `DB_PASSWORD`. Default workers: four locally, two in CI; retries: zero locally, one in CI.

Custom status diagnostics redact body values, but assertion diffs, screenshots and traces can contain account data or tokens. Review artifacts before sharing; CI retains them for 14 days. A hosted CI run has not been verified.

The [QA plan](QA_PLAN.md) records remaining gaps, including controlled second-account testing, full booking UI journeys, accessibility, mobile, other browsers, and trusted-CA DB TLS. [TEST_STRATEGY.md](TEST_STRATEGY.md) and the [initial audit](docs/AUDIT.md) are historical references.
