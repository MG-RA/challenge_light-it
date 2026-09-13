# Contributing to the MedAppoint QA suite

The suite tests a **shared remote** deployment: web app, API and Supabase Postgres. Nothing runs
locally, the DB account is read-only, and writes touch live data. Most rules below follow from that.

Before pushing: `npm run format && npm run typecheck && npm run lint && npm test`. CI fails on unformatted code (`npm run format:check`).

## Where code belongs

| Layer | Path | Rule |
|---|---|---|
| Env config | `src/config/env.ts` | Every variable goes through a validator. Credential groups are lazy getters, so listing tests needs no secrets. |
| Time zone | `src/support/dates.ts` | All calendar math: `dateAfter`, `appointmentStart`, `isUpcoming`. Never derive a date from `toISOString()`. |
| Auth | `src/auth/session.ts` | One API login per run (`tests/auth.setup.ts`); the token is reused by API fixtures and seeded into `localStorage.token` for the browser. |
| API client | `src/api/ApiClient.ts` | One method per endpoint, returning the raw `APIResponse`. No assertions. |
| Contract | `src/api/contract.ts`, `src/api/spec.ts` | The setup project downloads the login-protected spec to `.auth/openapi.json` (git-ignored, never committed); validators compile from it on first use. Never hand-write schemas in tests. |
| DB oracle | `src/db/Db.ts` | Named, parameterized lookups. No SQL in spec files. |
| Fixtures | `src/fixtures/` | `test` and `expect` with the custom matchers. |
| Page objects | `src/pages/` | Readonly locators plus actions (`fill`, `login`, `chooseDoctor`), no assertions. Prefer test ids and roles; keep any id, CSS or structural lookup inside the page object. Shared layout (sidebar, page title) is `AppShell`. Specs get page objects from fixtures (`appShell`, `loginPage`, `dashboardPage`, `bookingPage`), not `new`. |
| Network stubs | `src/mocks/ApiMocks.ts` | UI tests that control backend answers use the `apiMocks` fixture, never `page.route` directly. A stubbed test proves UI behavior only. |
| Specs | `tests/api`, `tests/ui` | Assertions live here. |

Import `test` and `expect` from `src/fixtures` (or from `tests/api/writes.ts` when a test needs the
`owned` fixture), never from `@playwright/test`: that loses the custom matchers.

## Assertions

- **The DB is the oracle.** An API or UI value is checked against `db.*` rows, not against itself.
  Row types in `Db.ts` stay separate from `src/api/types.ts`: stored data versus what the spec claims.
- **Pick the weakest assertion that proves the claim:**
  - `await expect(res).toHaveStatus(n)` for status only. It is async, so always `await` it.
  - `expectJson(res, 200, 'Doctor[]')` for status plus literal OpenAPI validation. Component schemas
    declare no required fields, so assert any field you rely on afterwards.
  - `expectCompleteJson(res, 200, 'User')` adds the suite's field-completeness policy. Say which of
    the two failed when you report it.
- **Label the basis:** C (in the contract), P (suite policy) or Q (proposed business rule). A Q
  expectation uses `expect.soft` with a message saying it is proposed; state checks stay hard.
- **Every non-locator assertion carries a message** saying what it checks, e.g.
  `expect(result.status, 'cancel response status').toBe(200)`. Inside loops, name the record:
  `` `payment ${row.id} amount equals the DB value` ``. Locator assertions already print their
  `describe()` label, and `toHaveStatus` prints the URL and redacted body.
- **Form validation:** `await expect(field).toBeInvalid()` or `toBeInvalid('rangeUnderflow')`; the
  failure names the field and lists the constraints that actually fail.
- **Web-first UI assertions only.** `waitForTimeout`, `networkidle`, `page.pause` and focused tests
  fail lint.
- **Decimals arrive as strings:** compare `Number(a) === Number(b)`.
- **Skip with narrowing:** `test.skip(!row, 'reason'); if (!row) return;`.
- **Never echo raw response bodies.** Diagnostics go through `src/fixtures/redact.ts`.

## Lint and format

`npm run lint` (oxlint, type-aware, with the Playwright plugin) and `npm run format:check` (Prettier)
both run in CI. Beyond correctness, lint enforces the conventions above:

- Everywhere: no nested ternaries, no `waitForTimeout`/`networkidle`/`page.pause`, no forced
  actions, element handles or `nth()`, web-first assertions, awaited `toHaveStatus`, and a blank line
  between tests and hooks.
- In `tests/**` only: no raw `page.locator()` (add it to a page object), no `page.route` (use
  `apiMocks`), and no value imports from `@playwright/test` (type imports are fine).

If a rule fights a real need, change the page object or helper rather than disabling the rule inline.

## Known defects

Never widen the spec or loosen a check to accommodate a bug.

In the **default suite** (what CI runs), a test that reproduces an open finding uses a scoped
expected failure: assert everything unrelated first, then mark, then assert the one known-bad thing.

```ts
test('GET /doctors satisfies the field-completeness policy',
  { annotation: { type: 'issue', description: 'F-01: list omits fee and active fields' } },
  async ({ api }) => {
    const { doctors, gaps } = await doctorCompletenessGaps(await api.listDoctors());
    test.skip(doctors.length === 0, 'No doctors available to assess item completeness');
    test.fail(true, 'F-01: only missing is_active/consultation_fee may fail');
    expect(gaps).toEqual([]);
  });
```

An unrelated regression then still fails, and a fix shows up as an unexpected pass. Put the finding ID
in both the annotation and the `test.fail` reason, and link the spec from `docs/FINDINGS.md`.

**Opt-in runs** (`@mutating`, `@rate-limit`) keep ordinary failures: they are manual and inspected
case by case. See [QA_PLAN §4.2](QA_PLAN.md#42-known-defect-marking).

## Tests that write remote data

- Tag the test `@mutating` and use the `owned` fixture. It refuses to run without `RUN_MUTATING=1`,
  one worker, zero retries, and a token that belongs to the configured DB user.
- Create data only through `owned.book()` / `owned.create()`: every row carries a unique run marker,
  and only rows this run created and still owns can be rescheduled, cancelled, deleted or paid.
- Verify stored state with the settled helpers in `tests/api/dbState.ts`, not with the response.
- Teardown deletes marked rows and verifies absence. Payments cannot be deleted, so keep payment
  tests within the cap of 4 per worker process.
- Run writes one suite at a time, never in CI:
  `RUN_MUTATING=1 npm run test:writes`.

## Dates and time zones

`TEST_TIMEZONE` (default `UTC`) sets `process.env.TZ` for every Playwright process and the browser's
`timezoneId`. Build dates with `dateAfter(days)` and compare appointment times with
`appointmentStart` / `isUpcoming`, so the test and the app agree on "today". Never hardcode a future
date: it silently turns into a past date.

## Keeping the documentation in sync

When you add, rename or remove a test:

1. Run `RUN_MUTATING=1 npm run test:list` and update the matching file in `test-cases/`, including
   the spec line and exact title. IDs are append-only; retired IDs are listed, never reused.
2. Update the counts and matrix in `test-cases/README.md`.
3. Link any finding both ways between the case and `docs/FINDINGS.md`.
4. After a run, record results in the case, the run record and FINDINGS. Raw reports stay local: local
   traces and screenshots are not redacted.
