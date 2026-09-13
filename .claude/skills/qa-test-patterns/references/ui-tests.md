# UI test patterns

## Page objects

Locators only. A page object never asserts, never waits explicitly, and never knows about test data.

```ts
export class LoginPage {
  readonly emailInput: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.locator('#email').describe('Email input');
  }

  async goto(): Promise<void> { await this.page.goto('/login'); }
}
```

Rules:

- **Locators are `readonly` fields built in the constructor.** A `get` accessor is acceptable for
  small pages (`BookingPage`, `DoctorsPage`) but be consistent within a file.
- **`.describe('…')` on every locator.** It is what appears in traces and failure output; unnamed
  locators make reports unreadable.
- **Locator priority: `data-testid` > `id` > role/label/text.** Check the live DOM before choosing.
  Use `getByTestId('…')` when the element has one (e.g. `doctor-card`, `submit-appointment`), else
  `locator('#id')` (e.g. `#email`, `#doctor_id`), else `getByRole`/`getByLabel`/`getByText`. No
  class-based CSS or XPath selectors — the Tailwind classes are styling, not a contract.
- **Scope to a landmark** when a name is ambiguous: `page.getByRole('main').getByRole('heading', …)`
  keeps sidebar copy from matching.
- **Regex names where the DOM injects icon text.** Sidebar link accessible names include the icon
  ligature ("medical_services Doctors"), hence a `RegExp` anchored with `$` rather than an exact name.
- **Compose, do not inherit.** `DashboardPage` holds a `Sidebar` instance; shared widgets live in
  `src/pages/components/`. There is no `BasePage`.
- Document DOM quirks in a comment where they force an odd locator (the dashboard banner has no
  `alt`, so it has no accessible name and is located by role alone).
- Methods encapsulate *interactions*, not expectations: `login(email, password)`,
  `loginAndWaitForResponse(...)` which pairs the click with `waitForResponse` in a `Promise.all`.

## Authentication state

The `ui` project runs with `storageState: AUTH_STATE_FILE`, written by `tests/auth.setup.ts` — a
single API login per run (login is rate-limited and documents a 429), with the JWT seeded into
`localStorage.token`, which is where the SPA reads it.

Tests that need a logged-out browser opt out at file level:

```ts
test.use({ storageState: { cookies: [], origins: [] } });
```

UI login itself is still covered explicitly in `tests/ui/login.spec.ts` — reusing the token for
speed must not mean the login form goes untested.

## Assertions

Web-first only: `await expect(locator).toBeVisible()`, `toHaveText`, `toHaveURL`, `toHaveJSProperty`.
`waitForTimeout`, `networkidle`, and `page.pause` are lint errors. Assert against the DB where the
UI renders stored data:

```ts
await expect(dashboardPage.greeting).toContainText(testUser.first_name);
```

For structural navigation checks prefer one aria snapshot over many individual locator assertions —
it pins names *and* URLs in a single readable expectation (`tests/ui/dashboard.spec.ts`).

## Network-coupled UI tests

To assert on a request the page makes, create the waiter **before** the action and match on the
parsed pathname plus method — never a substring of the full URL:

```ts
const pending = page.waitForResponse((res) =>
  new URL(res.url()).pathname === `/api/doctors/${doctor.id}/availability`
  && res.request().method() === 'GET');
await booking.doctor.selectOption(String(doctor.id));
const response = await pending;
```

For a click that navigates, use the `Promise.all([waitForResponse, action])` form as in
`LoginPage.loginAndWaitForResponse`.

## Read-only UI exploration

The target is shared and live. A UI test that walks a form which could submit must block writes at
the network layer, so an unexpected submit cannot create data:

```ts
await page.route('**/api/**', (route) => route.request().method() === 'GET'
  ? route.continue() : route.abort());
```

Any UI test that genuinely needs to write belongs behind the same `@mutating` tag and owned-data
discipline as the API writes — see `references/api-tests.md`.

## Resource/performance checks

`page.requests()` filtered by `resourceType()` gives request/response bodies for byte-budget
assertions. Confirm the image actually loaded (`toHaveJSProperty('complete', true)` plus
`naturalWidth > 0`) before measuring, so a broken image cannot pass a size budget. Keep the single
known-bad assertion behind `test.fail` and let every other image fail normally (F-13).

## Skipping on missing data

Same pattern as API tests — a precondition the shared environment may not satisfy is a skip with a
reason, not a silent pass:

```ts
test.skip(doctors.length < 2, 'Two active doctors needed to verify changing the selected doctor');
```
