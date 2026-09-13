# Contributing

The tests run against a **shared remote** environment: the web app, its API and a read-only database. Nothing runs locally, and anything a test writes is visible to other users. Most rules below follow from that.

Before pushing: `npm run format && npm run typecheck && npm run lint && npm test`. CI fails on unformatted code.

## Where code belongs

| Layer | Path | Rule |
|---|---|---|
| UI flows | `tests/ui` | One patient journey per spec, split into `test.step`s. Assertions live in specs, nowhere else. |
| Page objects | `src/pages` | Readonly locators plus actions (`login`, `fill`, `reschedule`), no assertions. Prefer roles, labels and test ids; keep any structural lookup inside the page object with a comment saying why. |
| Fixtures | `src/fixtures` | Page objects, the API clients and `testAppointments`. Specs import `test` and `expect` from `src/fixtures`, never from `@playwright/test` (lint enforces it). |
| API client | `src/api/ApiClient.ts` | One method per endpoint, returning the raw response. |
| Dates | `src/support/dates.ts` | All calendar math and date formatting. Never derive a calendar date from `toISOString()`, and never hardcode a future date. |
| Extras | `extras/api-tests` | API contract and database checks; see [extras/README.md](extras/README.md). |

## Test data

- A flow that needs an appointment creates it with `testAppointments.create(...)`, or books it through the UI with a note from `testAppointments.newMarker()`.
- Never change appointments a test did not create. The fixture deletes everything carrying the test's markers after the test and confirms each deletion with a 404.
- Pick slots with `testAppointments.freeSlot()`: two to six months ahead, never on one of the patient's own appointments.

## Assertions

- Use web-first assertions on locators (`await expect(locator).toHaveText(...)`); fixed waits and `networkidle` fail lint.
- Give every non-locator assertion a message that says what it checks, e.g. `expect(response.status(), 'reschedule response status').toBe(200)`.
- API dates arrive as UTC-midnight timestamps (see Part 1, BUG-03); compare them with `apiCalendarDate(...)`.

## Known defects

Never loosen an assertion to make a bug pass. Put the known-bad check in its own test, assert everything else first, then mark it:

```ts
test('the rescheduled appointment shows its new date without reloading',
  { annotation: { type: 'issue', description: 'BUG-04 (part-1-functional-testing): ...' } },
  async ({ appointmentsPage, testAppointments }) => {
    // ...set up and reschedule; these assertions must pass...
    test.fail(true, 'BUG-04: only the card date right after confirming may fail');
    await expect(appointmentsPage.schedule(card)).toHaveText(newDateAndTime);
  });
```

An unrelated regression still fails the test, and a fix shows up as an unexpected pass: remove the marker and update the report.
