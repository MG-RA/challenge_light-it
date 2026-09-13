# Login page and access control (UI)

Spec: [tests/ui/login.spec.ts](../../tests/ui/login.spec.ts) · Project: `ui` (Desktop Chrome, depends on `setup`)

**Starting state:** every case in this file overrides `storageState` to empty (`cookies: []`, `origins: []`). The browser starts **logged out**, without the token saved by setup.

**Page object:** [LoginPage](../../src/pages/LoginPage.ts). It exposes the email input (label `Email`), the password input (label `Password`), the `Sign In` button, and the rejection text `Invalid email or password`.

---

## TC-UI-LOGIN-001: Valid credentials land on the dashboard

| Field | Value |
|---|---|
| Automated test | [login.spec.ts:11](../../tests/ui/login.spec.ts:11) › `Login page › valid credentials land on the dashboard` |
| Project / tag | ui / — |
| Type | Functional, E2E, smoke |
| Priority | P1 |
| Catalog / finding | — / — |
| Last recorded | Pass (2026-09-12) |

**Preconditions:** the browser is logged out, valid credentials are configured, and the login rate limit is not exhausted. This case adds one login.

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/login`. | The login page loads. |
| 2 | Fill **Email** and **Password** with the configured credentials, then click **Sign In**. | — |
| 3 | Observe the URL. | The URL ends with `/dashboard`. |
| 4 | Observe the dashboard. | The greeting heading (the `h1` in `main`) is visible. |

---

## TC-UI-LOGIN-002: Invalid password keeps the user on `/login`

| Field | Value |
|---|---|
| Automated test | [login.spec.ts:17](../../tests/ui/login.spec.ts:17) › `Login page › invalid password keeps the user on /login` |
| Project / tag | ui / — |
| Type | Security, negative, UX feedback |
| Priority | P1 |
| Catalog / finding | — / — |
| Last recorded | Pass (2026-09-12) |

**Preconditions:** the browser is logged out. This case adds one failed login attempt.

**Test data:** the configured email with the password `definitely-wrong`.

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/login`. | The login page loads. |
| 2 | Fill the configured email and `definitely-wrong`, click **Sign In**, and wait for the `POST /api/auth/login` response. | The network response status is **401**. |
| 3 | Observe the page feedback. | Text containing `Invalid email or password` is visible. |
| 4 | Observe the submit button. | **Sign In** is enabled again, so the user can retry. |
| 5 | Observe the URL. | The URL still ends with `/login`. |

---

## TC-UI-ACCESS-001: Unauthenticated visit to `/dashboard` redirects to `/login`

| Field | Value |
|---|---|
| Automated test | [login.spec.ts:27](../../tests/ui/login.spec.ts:27) › `Access control › unauthenticated visit to /dashboard redirects to /login` |
| Project / tag | ui / — |
| Type | Security, route guard |
| Priority | P0 |
| Catalog / finding | — / — |
| Last recorded | Pass (2026-09-12) |

**Preconditions:** the browser is logged out (empty storage state). No login happens in this case.

| # | Action | Expected result |
|---|---|---|
| 1 | Navigate directly to `/dashboard`. | — |
| 2 | Observe the URL. | The browser is redirected, and the URL ends with `/login`. |
