# Setup: authentication

Spec: [tests/auth.setup.ts](../tests/auth.setup.ts) · Project: `setup`

---

## TC-SETUP-001: Log in once through the API, save the session and download the contract

| Field | Value |
|---|---|
| Automated test | [auth.setup.ts:9](../tests/auth.setup.ts:9) › `authenticate` |
| Project / tag | setup / — |
| Type | Functional, prerequisite |
| Priority / basis | P1 / C, P |
| Finding | — |
| Last recorded | Pass (2026-09-13): contract `Medical Appointment System API 1.0.0`, sha256 `fe7e6b030e799f29` (identical to the snapshot previously committed). |

**Purpose.** Login is rate-limited (documented 429). The suite therefore logs in once per run and reuses the JWT for API fixtures. It also seeds the token into the browser's `localStorage.token` for UI tests. The OpenAPI contract is published behind the same login, so this case downloads it for the contract checks instead of the repository storing a copy.

**Preconditions**
- Valid test-account email and password are configured in `.env`.
- The account is not rate-limited.

**Test data:** configured `credentials` fixture. Credentials are never logged.

| # | Action | Expected result |
|---|---|---|
| 1 | Using the unauthenticated client (`anonApi`), send `POST /api/auth/login` with `{ email, password }`. | HTTP **200**. On failure, the redacted body is printed. |
| 2 | Parse the JSON body and read `token`. | `token` is present and truthy (non-empty). |
| 3 | Save the session with `saveSession(token)`. | The auth state file is written. `api` and `ui` projects can now use the token. |
| 4 | **Step "download the OpenAPI contract":** `GET /api-docs.json?token=<token>`. | HTTP **200** with an OpenAPI 3 document that has paths and component schemas. It is saved to `.auth/openapi.json` (git-ignored). |
| 5 | Annotate the run. | A `contract` annotation records title, version, the first 16 hex characters of the SHA-256, and any component schemas the suite does not model. |

**Postconditions:** the session and contract files exist for dependent projects. No remote data changes.

**Not covered here:** token schema validation, using the token on `/users/me` in the same case, unknown email and missing fields. Failed-login throttling is TC-AUTH-RATE-001 in [rate-limit.md](api/rate-limit.md).
