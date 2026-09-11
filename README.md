# Light-it QA Challenge — Playwright suite

End-to-end checks for the **MedAppoint** medical appointment system across three layers:

| Layer | Target | Project |
|---|---|---|
| UI | https://light-it-qa-challenge.vercel.app | `ui` (Chromium) |
| API | https://qa-challenge-backend.vercel.app ([spec](docs/openapi.json)) | `api` |
| DB | Supabase Postgres, **read-only** user | `db` (also available as a fixture in every test) |

## Setup

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
npm run pw:ui          # Playwright UI mode
npm run report         # open last HTML report
npm run typecheck
```

## Structure

```
src/
  config/env.ts        typed, validated env vars
  api/ApiClient.ts     one method per endpoint, returns raw APIResponse
  api/types.ts         models from the OpenAPI spec (what the spec *claims*)
  db/Db.ts             read-only pg pool + common lookups (DB = source of truth)
  pages/               page objects
  fixtures/            test.extend: api, anonApi, db, page objects
tests/
  auth.setup.ts        logs in once via API → .auth/token.json + .auth/user.json
  api/ ui/ db/
docs/openapi.json      snapshot of the Swagger spec
```

## Notes

- **Auth:** login is rate-limited (spec documents `429`). `auth.setup.ts` calls it once per run; the JWT
  goes into the API fixture, and the same JWT goes into `localStorage.token` for the browser, which is where the SPA stores it.
- **Data mutation:** API tests that create, cancel, or delete appointments or payments change shared remote state. Create your own
  data and clean it up; never rely on the seeded records staying put.
