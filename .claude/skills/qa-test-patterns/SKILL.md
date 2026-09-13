---
name: qa-test-patterns
description: Conventions for writing and reviewing Playwright API, UI and DB tests in this MedAppoint QA suite — fixtures, page objects, OpenAPI contract assertions, DB-as-oracle reconciliation, known-defect (test.fail) handling, and guarded @mutating writes. Use whenever adding, editing or reviewing anything under tests/ or src/ here, or when a test needs new locators, an API endpoint wrapper, a DB lookup or a findings-linked expected failure.
---

# MedAppoint QA suite — test patterns

Playwright + TypeScript suite testing a **shared remote** deployment (web app, API, Supabase Postgres).
Nothing here runs locally, the DB credentials are read-only, and writes touch live data — those two
facts drive most of the rules below.

## Layer map — where code belongs

| Layer | Path | Rule |
|---|---|---|
| Env config | `src/config/env.ts` | Every var goes through `required()`; credential groups stay behind lazy getters so `test:db` runs without app creds. |
| Auth | `src/auth/session.ts` | One API login per run (`tests/auth.setup.ts`), token reused by API fixtures and seeded into `localStorage.token` for the browser. |
| API wrapper | `src/api/ApiClient.ts` | One method per endpoint, returns the raw `APIResponse`. Never assert inside it. |
| Contract | `src/api/contract.ts` + `docs/openapi.json` | Ajv validators compiled from the published spec. Do not hand-write schemas in tests. |
| DB oracle | `src/db/Db.ts` | Named, parameterized lookup methods. No SQL strings inside spec files. |
| Fixtures | `src/fixtures/` | `test`/`expect` re-exported with custom matchers. Tests import from here, never from `@playwright/test`. |
| Page objects | `src/pages/` | Locators only, no assertions. |
| Specs | `tests/api`, `tests/ui`, `tests/db` | Assertions live here and nowhere else. |

**Import rule:** `import { test, expect } from '../../src/fixtures'` — or from `'./writes'` when the
test needs the `owned` fixture. Importing `test` or `expect` straight from `@playwright/test` in a
spec loses the custom matchers and is always wrong.

## Fixtures available

Test-scoped: `api` (authenticated), `anonApi` (no credentials; `.withToken(x)` for malformed-token
cases), `loginPage`, `dashboardPage`, plus Playwright's own.
Worker-scoped: `db`, `testUser` (the account's DB row), `credentials`, `token`.
Option: `apiBaseURL`.

Page objects without a fixture are constructed in the test: `new DoctorsPage(page)`. Add a fixture
only when nearly every spec in a project needs it.

## Non-negotiables

1. **The DB is the oracle.** An API or UI assertion that only checks the response against itself is
   incomplete — reconcile against `db.*` rows. `src/db/Db.ts` row types are deliberately separate
   from `src/api/types.ts`: one is what is stored, the other is what the spec claims.
2. **Await the async matcher.** `await expect(response).toHaveStatus(200)` — `toHaveStatus` is async
   (oxlint enforces it via `customMatchers`). `toMatchSchema` is sync.
3. **Web-first assertions only** in UI tests. `waitForTimeout`, `networkidle`, `page.pause` and
   focused tests are lint errors.
4. **Never widen the spec to accommodate a bug.** A known defect gets the `test.fail` pattern below,
   not a relaxed schema or a loosened regex.
5. **Writes are opt-in and owned.** Anything that changes remote state is tagged `@mutating`, uses
   the `owned` fixture, and is excluded unless `RUN_MUTATING=1`.
6. **Never echo response bodies raw.** Diagnostics go through `src/fixtures/redact.ts`.
7. **Skip with narrowing:** `test.skip(!row, 'reason'); if (!row) return;` — the second line is for
   TypeScript, since `test.skip` is not a type guard.
8. **Decimals arrive as strings.** Compare `Number(a) === Number(b)`, never string equality
   (`'50.00'` vs `'50.0'`, finding F-09).

## Assertion ladder for API responses

Pick the weakest rung that still proves the claim:

- `await expect(res).toHaveStatus(n)` — status only (auth gates, 404s). Failure prints the redacted body.
- `expectJson(res, 200, 'Doctor[]')` — status + literal OpenAPI validation. Returns `Partial<…>` because
  raw component schemas declare no required properties. Assert any field you then rely on.
- `expectCompleteJson(res, 200, 'User')` — the above plus the suite's separately-named
  **field-completeness policy** (every declared property present). Returns the full model type.

Keep that distinction visible in failure messages and findings: a response can pass literal OpenAPI
validation and still fail the completeness policy (F-01). Say which one failed.

## Known defects (expected failures)

Never let `test.fail` swallow an unrelated regression. Validate everything that must still hold
*before* the marker, then mark and assert the single known-bad expectation:

```ts
test('GET /doctors satisfies the field-completeness policy',
  { annotation: { type: 'issue', description: 'F-01: list omits fee and active fields' } },
  async ({ api }) => {
    const { doctors, gaps } = await doctorCompletenessGaps(await api.listDoctors());  // status, schema, unrelated gaps
    test.skip(doctors.length === 0, 'No doctors available to assess item completeness');
    test.fail(true, 'F-01: only missing is_active/consultation_fee may fail');
    expect(gaps).toEqual([]);
  });
```

Shared pre-checks live in `tests/api/knownDefectChecks.ts`. Every such test carries the `F-xx` id in
both the annotation and the `test.fail` reason, and `docs/FINDINGS.md` links back to the spec file.

## Proposed vs. specified expectations

When the expected behaviour is a reasonable business rule but is **not** in the spec, use a soft
assertion with a label saying so, and keep the state verification hard:

```ts
expect.soft([400, 409], 'proposed business validation expectation').toContain(result.status);
await expectNothingStored(db, result.marker, testUser.id);   // hard: nothing may persist
```

## Details

- Writing API tests, contract checks, and `@mutating` writes → `references/api-tests.md`
- Writing UI tests and page objects → `references/ui-tests.md`

## Commands

```bash
npm run typecheck && npm run lint && npm test
```

`npm run test:api` · `test:ui` · `test:db` · `test:headed` · `report`.
Mutating writes: `RUN_MUTATING=1 npm run test:writes` (never in CI; one worker, no retries).
