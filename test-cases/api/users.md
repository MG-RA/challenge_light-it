# Users API

Spec: [tests/api/users.spec.ts](../../tests/api/users.spec.ts) · Project: `api` (depends on `setup`)

---

## TC-USR-001: `GET /api/users/me` returns the logged-in user and matches the DB

| Field | Value |
|---|---|
| Automated test | [users.spec.ts:4](../../tests/api/users.spec.ts:4) › `Users API › GET /users/me returns the logged-in user, matching the DB` |
| Project / tag | api / — |
| Type | Functional, contract, data reconciliation, security |
| Priority / basis | P1 / C (status and `User` schema), P (field completeness, DB identity, no password hash) |
| Catalog / finding | API-USR-01, API-SEC-04 (password field only) / — |
| Last recorded | Pass (2026-09-12) |

**Preconditions**
- A valid session token from TC-SETUP-001.
- The worker-scoped `testUser` fixture has loaded the account's `users` row by configured email.

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/users/me` with the bearer token. | HTTP **200**. |
| 2 | Validate the body with `expectCompleteJson(…, 'User')`. | The body passes literal OpenAPI `User` validation (C) **and** the field-completeness policy: every declared `User` property is present (P). |
| 3 | Check for sensitive fields. | The body has **no** `password_hash` property. |
| 4 | Compare with the DB `testUser` row. | `id`, `email`, `first_name` and `last_name` equal the stored values. |

**Postconditions:** none. The case only reads.

**Not covered here (planned):** second-user isolation (API-SEC-03), controlled null/string `phone`/`notes` fixtures (API-USR-02), and profile updates (API-USR-04…07, blocked by F-06).
