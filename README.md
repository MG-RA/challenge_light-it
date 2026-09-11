# Light-it QA Challenge — Playwright suite

End-to-end checks for the **MedAppoint** medical appointment system across three layers:

| Layer | Target | Project |
|---|---|---|
| UI | https://light-it-qa-challenge.vercel.app | `ui` (Chromium) |
| API | https://qa-challenge-backend.vercel.app ([spec](docs/openapi.json)) | `api` |
| DB | Supabase Postgres, **read-only** user | `db` (also available as a fixture in every test) |

## Setup

Requires Node 26+ (see `.nvmrc`).

```bash
npm install
npx playwright install chromium
cp .env.example .env   # then fill in credentials
```

## Running

```bash
npm test               # everything
npm run test:api       # API only
npm run test:ui        # UI only
npm run test:db        # DB only
npm run test:readonly  # everything except tests tagged @mutating
npm run pw:ui          # Playwright UI mode
npm run report         # open last HTML report
npm run typecheck
npm run lint           # oxlint, type-aware + eslint-plugin-playwright
```

## Structure

```
src/
  config/env.ts        typed, validated env vars
  auth/session.ts      where the JWT is saved/loaded (.auth/), incl. the SPA's localStorage format
  api/ApiClient.ts     one method per endpoint, returns raw APIResponse
  api/types.ts         models from the OpenAPI spec (what the spec *claims*)
  api/contract.ts      Ajv validation against docs/openapi.json (all listed fields required, no extras)
  db/Db.ts             read-only pg pool + common lookups (DB = source of truth)
  pages/               page objects; pages/components/ for shared parts (Sidebar), composed not inherited
  fixtures/            test.extend: api, anonApi, db, credentials, testUser, page objects, apiBaseURL option
  fixtures/matchers.ts expect.extend: toHaveStatus (shows body on failure), toMatchSchema
  fixtures/expectJson  status + schema check, returns the body typed from the schema
tests/
  auth.setup.ts        logs in once via API → .auth/token.json + .auth/user.json
  api/ ui/ db/
docs/openapi.json      snapshot of the Swagger spec
```

## Notes

- **Auth:** login is rate-limited (spec documents `429`). `auth.setup.ts` calls it once per run; the JWT
  goes into the API fixture, and the same JWT goes into `localStorage.token` for the browser, which is where the SPA stores it.
- **Data mutation:** API tests that create, cancel, or delete appointments or payments change shared remote state. Create your own
  data and clean it up; never rely on the seeded records staying put. Tag them `@mutating`
  (`test('...', { tag: '@mutating' }, ...)`) so `test:readonly` can skip them.
- **Known bugs:** tests that reproduce a logged finding are marked `test.fail(...)` with an `issue` annotation naming it,
  so the run stays green until the bug is fixed, then goes red to prompt removing the marker.
- **CI:** `.github/workflows/playwright.yml` needs repo secrets `APP_USER_EMAIL`, `APP_USER_PASSWORD`, `DB_HOST`,
  `DB_USER`, `DB_PASSWORD`.
