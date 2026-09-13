# Setup: authentication

Spec: [tests/auth.setup.ts](../tests/auth.setup.ts) · Project: `setup`

---

## TC-SETUP-001: Log in once through the API and save the session

| Field | Value |
|---|---|
| Automated test | [auth.setup.ts:7](../tests/auth.setup.ts:7) › `authenticate` |
| Project / tag | setup / — |
| Type | Functional, prerequisite |
| Priority / basis | P1 / C, P |
| Catalog | API-AUTH-01 (partial: token issuance only) |
| Finding | — |
| Last recorded | Pass (2026-09-12 default and write runs) |

**Purpose.** Login is rate-limited (documented 429). The suite therefore logs in once per run and reuses the JWT for API fixtures. It also seeds the token into the browser's `localStorage.token` for UI tests.

**Preconditions**
- Valid test-account email and password are configured in `.env`.
- The account is not rate-limited.

**Test data:** configured `credentials` fixture. Credentials are never logged.

| # | Action | Expected result |
|---|---|---|
| 1 | Using the unauthenticated client (`anonApi`), send `POST /api/auth/login` with `{ email, password }`. | HTTP **200**. On failure, the redacted body is printed. |
| 2 | Parse the JSON body and read `token`. | `token` is present and truthy (non-empty). |
| 3 | Save the session with `saveSession(token)`. | The auth state file is written. `api` and `ui` projects can now use the token. |

**Postconditions:** the session file exists for dependent projects. No remote data changes.

**Not covered here (planned):** token schema validation, using the token on `/users/me` in the same case, unknown email, missing fields, and rate limiting (API-AUTH-01/03/05).
