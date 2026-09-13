# Light-it QA challenge — MedAppoint

[![Playwright](https://github.com/MG-RA/challenge_light-it/actions/workflows/playwright.yml/badge.svg?branch=main)](https://github.com/MG-RA/challenge_light-it/actions/workflows/playwright.yml)

Deliverables for the Light-it QA challenge on MedAppoint, a patient appointment app. Everything is in English and runs against the challenge environment (web app, REST API and a read-only database).

## Deliverables

| Part | Deliverable | Where |
|---|---|---|
| 1. Functional testing | Report on *"reschedule an existing appointment"*: strategy, 25 executed test cases, 8 bugs and 6 improvements with evidence, and a **No-Go** recommendation | [part-1-functional-testing/](part-1-functional-testing/README.md) |
| 2. SQL | The five queries, each with a comment | [part-2-sql/queries.sql](part-2-sql/queries.sql) |
| 3. API testing | Postman collection for the reschedule flow, with an environment template | [part-3-postman/](part-3-postman/README.md) |
| 4. UI automation | Three Playwright flows, described below | [tests/ui/](tests/ui) |
| AI usage | How AI was used and how its output was validated | [AI_USAGE.md](AI_USAGE.md) |
| Extras | API contract, authorization and database checks; findings outside the story | [extras/](extras/README.md) |

## Part 4 — UI automation

### The three flows

| Flow | What it proves | Test data |
|---|---|---|
| [Sign in and out](tests/ui/sign-in-and-out.spec.ts) | A wrong password is rejected; the right one opens this patient's dashboard; signing out clears the session and protected pages redirect to sign-in | None |
| [Book an appointment](tests/ui/book-appointment.spec.ts) | The booking form stores exactly the chosen doctor, date and time, shows a confirmation, and the appointment appears in the list as active | Creates one appointment, deleted afterwards |
| [Reschedule an appointment](tests/ui/reschedule-appointment.spec.ts) | The Part 1 user story: the same appointment moves to the new date and time and stays active, in the list and in the API | Creates one appointment, deleted afterwards |

The reschedule spec also holds one clearly labelled **expected failure** for Part 1's BUG-04 (the card keeps the old date until the page is reloaded). It passes while the bug exists and fails once it is fixed, so the suite stays green without hiding the defect.

### Run the tests from scratch

Requirements: **Node.js 26** (see `.nvmrc`) and Git.

```bash
git clone https://github.com/MG-RA/challenge_light-it.git
cd challenge_light-it
npm ci
npx playwright install chromium
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` for the last step. Then fill in `.env`:

| Variable | Needed for | Value |
|---|---|---|
| `BASE_URL` | Part 4 | `https://light-it-qa-challenge.vercel.app` (pre-filled) |
| `API_BASE_URL` | Part 4 | `https://qa-challenge-backend.vercel.app` (pre-filled) |
| `APP_USER_EMAIL`, `APP_USER_PASSWORD` | Part 4 | The challenge patient account |
| `TEST_TIMEZONE` | Optional | Time zone for the browser and date math; defaults to `UTC` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Extras only | Read-only database access |

Run the flows:

```bash
npm test
```

No manual steps are needed: a setup step signs in once through the API, and the flows reuse that session (except the sign-in flow, which starts signed out). Part 4 was verified to run with only the four Part 4 variables set.

| Command | What it does |
|---|---|
| `npm test` | The three flows, headless |
| `npm run test:headed` | The same, with a visible browser |
| `npm run report` | Opens the HTML report of the last run |
| `npm run test:extras` | The read-only extras (needs the database variables) |
| `npm run typecheck`, `npm run lint`, `npm run format:check` | Static checks, also run in CI |

### How the flows are built

- **Page objects** ([src/pages](src/pages)) hold every locator and page action; specs read as the patient's steps. Locators prefer roles, labels and test ids.
- **Fixtures** ([src/fixtures](src/fixtures)) provide the page objects, an authenticated API client and `testAppointments`.
- **Test data through the API, cleaned up every time.** The booking and reschedule flows run on a shared environment, so every appointment they create carries a unique `qa-suite` note. After each test, `testAppointments` deletes every appointment with one of that test's notes and confirms each deletion with a 404, even if the test failed. The flows need no database access.
- **Stable dates.** New slots are picked two to six months ahead, avoiding the patient's own appointments; the browser and date math share one time zone (`TEST_TIMEZONE`), so results do not depend on the machine's clock. In UTC−3 the app shows dates a day early (Part 1, BUG-03), which is why the default is UTC.
- **Readable failures.** Tests are split into named steps, and every non-locator assertion says what it checks.
- **Quality gates.** TypeScript strict mode, oxlint with the Playwright plugin (no raw locators, fixed waits or nested ternaries in specs), Prettier, and GitHub Actions on every push and pull request. CI records no traces or screenshots, because they would contain the session token.

### CI

[The workflow](.github/workflows/playwright.yml) runs type checking, lint, the format check, the three flows and the read-only extras. It reads the environment from repository secrets (`APP_USER_EMAIL`, `APP_USER_PASSWORD`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`) and from repository variables or secrets (`BASE_URL`, `API_BASE_URL`, `DB_NAME`, `DB_PORT`). Variables are preferable for the non-secret values, because GitHub masks secret values as `***` in logs.

## Repository structure

```text
part-1-functional-testing/  Part 1 report and evidence images
part-2-sql/                 Part 2 queries
part-3-postman/             Part 3 collection, environment template and notes
tests/auth.setup.ts         signs in once through the API for the flows
tests/ui/                   Part 4 flows
src/pages/                  page objects
src/fixtures/               fixtures, test data cleanup, custom matchers
src/api/                    API client and OpenAPI contract validation (used by the extras)
src/config/, src/support/   environment validation, date helpers
extras/                     API checks and other findings
AI_USAGE.md                 how AI was used
CONTRIBUTING.md             conventions for changing the tests
```
