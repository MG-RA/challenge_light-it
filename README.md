# Light-it QA challenge — Playwright suite

API, UI, and Postgres checks for **MedAppoint**. Two surfaces are tested: the API, which uses the read-only DB as its oracle, and the UI. Cases that write to the shared target are tagged `@mutating` and are excluded unless they are opted in.

| Surface | Target | Project |
|---|---|---|
| UI | https://light-it-qa-challenge.vercel.app | `ui` (Chromium) |
| API | https://qa-challenge-backend.vercel.app | `api` |
| DB | Supabase Postgres, read-only user | `db` connectivity/grant check; the oracle for API cases through fixtures |

Start with the [test strategy](TEST_STRATEGY.md), [latest execution](docs/EXECUTION.md), and [app findings](docs/FINDINGS.md). The [initial audit](docs/AUDIT.md) records the baseline before this improvement cycle.

The [API test-case catalog](docs/API_TEST_CASES.md) designs 77 case groups across all 17 OpenAPI operations, with priorities, inputs, expected results, prerequisites, and existing automation coverage.

## Setup

Requires Node 26+ (see `.nvmrc`).

```bash
npm ci
npx playwright install chromium
cp .env.example .env
```

Fill in `.env` with the challenge credentials and DB connection values. Environment variables already set take precedence. On PowerShell use `Copy-Item .env.example .env`. Do not commit credentials or `.auth/`.

## Running

```bash
npm test                # default suite, remote mutations excluded
npm run test:api
npm run test:ui
npm run test:db
npm run typecheck
npm run lint
npm run pw:ui
npm run report
npx playwright test --list
```

All projects load the configured base URLs. API/UI depend on the setup project; DB does not.

The last recorded default run, taken before the local framework project was removed, was **62 cases, 56 normal passes, 6 reproduced known failures, 0 skips, 0 unexpected results**; Playwright's headline counts expected failures as passes. Default discovery now lists **45 cases**. The write cases, then executed as a separate suite, had **6 passes, 8 failures, 2 skips** with no leftover test records ([record](docs/STATE_EXECUTION.md)). Live coverage touches 14 of 17 operations; that is not comprehensive coverage of each operation.

## Structure and assertion rules

```text
src/
  config/             environment validation and exact mutation opt-in
  auth/session.ts     shared JWT and SPA localStorage state under .auth/
  api/                thin raw-response client, complete models, literal schema validation
  db/Db.ts            parameterized read lookups and finite connection/query timeouts
  db/observe.ts       bounded polling for state that is not written synchronously
  pages/              focused page objects and composed Sidebar
  fixtures/           API/DB/page fixtures, JSON assertions and redacted status diagnostics
tests/
  auth.setup.ts       one shared authentication setup
  api/                read cases plus opted-in @mutating write cases
  api/writes.ts       owned-data fixture: run markers, caps and verified cleanup
  api/dbState.ts      stored-state assertions called after a write
  ui/                 login, dashboard, sidebar navigation, booking availability
  db/                 connectivity and read-only grant check
docs/openapi.json      supplied contract snapshot, unchanged
```

- `expectJson` checks status and the literal schema and returns optional-property types.
- `expectCompleteJson` also enforces our field-completeness policy. The snapshot does not mark component fields required; the policy is an additional expectation. Extra fields are allowed.
- Known failures are marked only after response/data preconditions pass. Each default case has a single final defect-specific assertion; fixes produce an unexpected pass for review.
- F-15: the API returns appointment dates as UTC-midnight timestamps. Read-side comparisons use a narrowly tested conversion for that exact representation; separate raw-date tests keep the contract mismatch visible.
- Monetary strings are compared numerically; `120` and `120.00` are equivalent for these read-side comparisons.
- Missing runtime records cause explicit conditional skips, not invented IDs.

## Remote writes and authentication

The default suite makes no profile, booking, payment, or notification changes. Its DB permission check issues a zero-row UPDATE and expects permission denial.

`RUN_MUTATING` accepts unset, `0`, `false`, or `1`; other values fail configuration. Without exactly `1`, `@mutating` cases are excluded from discovery:

```powershell
$env:RUN_MUTATING = '1'
npm run test:writes
Remove-Item Env:RUN_MUTATING
```

With the flag set, the configuration switches to one worker, zero retries and sequential order, and the `owned` fixture refuses to run if those were overridden or if the token identity is not the configured DB account. Writes carry unique run markers, only marker-carrying owned rows are mutated, and each test's teardown deletes what it created and verifies absence. Caps are 20 booking submissions and four payments on one owned appointment. Use it only with permission for the documented limited payment/notification residue. See [write testing](docs/WRITE_TESTING.md).

The first live run of these scenarios stopped when HTTP 200 reported payment ID 999 without a matching DB row. Zero/negative/duplicate payment steps and notification mutation did not run. All 14 created appointments were deleted, and a later read-only residue check was empty. No write failure was converted to an expected failure.

Profile writes stay unautomated: F-06 prevents exact restoration of prior account data, and the spec's profile `403` means names do not match the assigned candidate alias. The historical reproduction remains in the findings.

Setup authenticates once for shared API/browser state. A full default run also includes three intentional login attempts: API bad password, UI valid credentials, and UI bad password. Login is rate-limited; avoid unnecessary repeated runs.

## Reports and CI

- HTML: `playwright-report/index.html`; JSON: `test-results/results.json`.
- CI adds JUnit and GitHub annotations. Secrets required: `APP_USER_EMAIL`, `APP_USER_PASSWORD`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`.
- Default workers: 4 locally, 2 in CI; retries: 0 locally, 1 in CI.
- Conditional data-dependent skips are allowed by lint; unconditional skipped tests still warn.
- Status matcher diagnostics redact body values. Native assertion diffs, screenshots and traces can still contain account data/tokens. Review artifacts before sharing; CI retains them for 14 days.
- Trusted DB certificate configuration, second-account authorization, the stopped and skipped write cases, availability error/recovery behavior (F-19), axe, mobile, and other browsers remain follow-ups.
