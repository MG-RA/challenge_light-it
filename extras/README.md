# Extras

Work beyond the four requested deliverables. None of it is needed to run Part 4.

| Item | What it is |
|---|---|
| [api-tests/](api-tests) | Playwright API checks that go further than the Postman collection can: responses validated against the OpenAPI contract, API values reconciled with the read-only database, authorization boundaries (missing, malformed and forged tokens, another patient's appointment), and write checks that verify the stored row |
| [other-findings.md](other-findings.md) | Bugs and observations found outside the reschedule story |

## Running the API checks

They need the database variables in `.env` as well (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, read-only access). A setup step downloads the OpenAPI contract, which is published behind the API login, into the git-ignored `.auth/openapi.json`.

```bash
npm run test:extras
```

This runs the read-only checks, which is also what CI runs. Known defects are marked as **expected failures**: they pass while the bug exists, and turn red when the bug is fixed, so a red run always means something changed.

**Checks that write data** are opt-in, run on one worker, and only touch appointments they create (marked `qa-suite` in the notes, deleted afterwards, deletion verified in the database):

```bash
RUN_MUTATING=1 npm run test:extras:writes
```

The login throttling probe sends up to ten failed logins and only runs when asked:

```bash
RUN_RATE_LIMIT=1 npx playwright test extras/api-tests/rate-limit.spec.ts --project=extras-api --workers=1
```

The earlier, broader UI suite and the whole-system test plan and test-case documents are preserved at the git tag `archive/full-suite`.
