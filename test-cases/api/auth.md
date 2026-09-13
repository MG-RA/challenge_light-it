# Auth API

Spec: [tests/api/auth.spec.ts](../../tests/api/auth.spec.ts) · Project: `api` (depends on `setup`)

Contains 1 login-rejection case, 16 auth-gate cases and 4 authorization-boundary cases. The gate cases come from the loop at [auth.spec.ts:10](../../tests/api/auth.spec.ts:10): 2 token modes × 8 protected GET operations.

## Shared details for the auth-gate cases (TC-AUTH-002 … 017)

| Field | Value |
|---|---|
| Type | Security, access control |
| Priority / basis | P0 / C (access denied), Q (exact 401 is documented only for `GET /api/users/me`, and the suite applies 401 to all protected GETs) |
| Catalog | API-SEC-01 |
| Client | `anonApi.withToken(token)` sends no stored credentials. |
| Token modes | **missing**: `token = undefined`, so no `Authorization` header is sent. **malformed**: `Authorization: Bearer not-a-jwt`. |
| Last recorded | Pass for all 16 (2026-09-12) |

Cases for routes with an ID (doctor detail, doctor availability, appointment detail) look up a **real** ID in the DB first. This makes sure a 401 comes from the auth gate and not from a missing resource. If no row exists, the case is **skipped** and not passed.

---

## TC-AUTH-001: Login rejects a wrong password with 401

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:7](../../tests/api/auth.spec.ts:7) › `Auth API › rejects wrong password with 401` |
| Project / tag | api / — |
| Type | Security, negative |
| Priority / basis | P1 / C |
| Catalog / finding | API-AUTH-02 (known email variant only) / — |
| Last recorded | Pass (2026-09-12) |

**Preconditions:** the configured account exists, and the login rate limit is not exhausted. This case adds one login attempt.

**Test data:** the configured account email with the password `definitely-wrong`.

| # | Action | Expected result |
|---|---|---|
| 1 | Send `POST /api/auth/login` without `Authorization`, using `{ email: <configured>, password: "definitely-wrong" }`. | HTTP **401**. The body is not asserted because no error schema is declared. |

---

## TC-AUTH-002: `GET /api/users/me` rejects a missing token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:14](../../tests/api/auth.spec.ts:14) › `Auth API › profile rejects a missing token` |
| Project / tag | api / — |
| Catalog | API-SEC-01, API-USR-03 (401 is documented for this route) |

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/users/me` with no `Authorization` header. | HTTP **401**. |

## TC-AUTH-003: `GET /api/doctors` rejects a missing token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:14](../../tests/api/auth.spec.ts:14) › `Auth API › doctors rejects a missing token` |
| Project / tag | api / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/doctors` with no `Authorization` header. | HTTP **401**. |

## TC-AUTH-004: `GET /api/appointments` rejects a missing token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:14](../../tests/api/auth.spec.ts:14) › `Auth API › appointments rejects a missing token` |
| Project / tag | api / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/appointments` with no `Authorization` header. | HTTP **401**, with no appointment data disclosed. |

## TC-AUTH-005: `GET /api/payments` rejects a missing token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:14](../../tests/api/auth.spec.ts:14) › `Auth API › payments rejects a missing token` |
| Project / tag | api / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/payments` with no `Authorization` header. | HTTP **401**. |

## TC-AUTH-006: `GET /api/notifications` rejects a missing token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:14](../../tests/api/auth.spec.ts:14) › `Auth API › notifications rejects a missing token` |
| Project / tag | api / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/notifications` with no `Authorization` header. | HTTP **401**. |

## TC-AUTH-007: `GET /api/doctors/{id}` rejects a missing token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:28](../../tests/api/auth.spec.ts:28) › `Auth API › doctor detail rejects a missing token` |
| Project / tag | api / — |
| Precondition | At least one active doctor exists (`db.activeDoctors()`). Otherwise the case is skipped. |

| # | Action | Expected result |
|---|---|---|
| 1 | Read the first active doctor ID from the DB. | A row is returned. |
| 2 | Send `GET /api/doctors/{id}` with no `Authorization` header. | HTTP **401**, not 404. |

## TC-AUTH-008: `GET /api/doctors/{id}/availability` rejects a missing token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:28](../../tests/api/auth.spec.ts:28) › `Auth API › doctor availability rejects a missing token` |
| Project / tag | api / — |
| Precondition | At least one active doctor exists. Otherwise the case is skipped. |

| # | Action | Expected result |
|---|---|---|
| 1 | Read the first active doctor ID from the DB. | A row is returned. |
| 2 | Send `GET /api/doctors/{id}/availability` with no `Authorization` header. | HTTP **401**. |

## TC-AUTH-009: `GET /api/appointments/{id}` rejects a missing token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:28](../../tests/api/auth.spec.ts:28) › `Auth API › appointment detail rejects a missing token` |
| Project / tag | api / — |
| Precondition | The test user owns at least one appointment (`db.appointmentsForPatient`). Otherwise the case is skipped. |

| # | Action | Expected result |
|---|---|---|
| 1 | Read the first appointment ID owned by the test user from the DB. | A row is returned. |
| 2 | Send `GET /api/appointments/{id}` with no `Authorization` header. | HTTP **401**, with no appointment data disclosed. |

---

## TC-AUTH-010: `GET /api/users/me` rejects a malformed token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:14](../../tests/api/auth.spec.ts:14) › `Auth API › profile rejects a malformed token` |
| Project / tag | api / — |
| Catalog | API-SEC-01, API-USR-03 |

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/users/me` with `Authorization: Bearer not-a-jwt`. | HTTP **401**. |

## TC-AUTH-011: `GET /api/doctors` rejects a malformed token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:14](../../tests/api/auth.spec.ts:14) › `Auth API › doctors rejects a malformed token` |
| Project / tag | api / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/doctors` with `Authorization: Bearer not-a-jwt`. | HTTP **401**. |

## TC-AUTH-012: `GET /api/appointments` rejects a malformed token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:14](../../tests/api/auth.spec.ts:14) › `Auth API › appointments rejects a malformed token` |
| Project / tag | api / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/appointments` with `Authorization: Bearer not-a-jwt`. | HTTP **401**. |

## TC-AUTH-013: `GET /api/payments` rejects a malformed token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:14](../../tests/api/auth.spec.ts:14) › `Auth API › payments rejects a malformed token` |
| Project / tag | api / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/payments` with `Authorization: Bearer not-a-jwt`. | HTTP **401**. |

## TC-AUTH-014: `GET /api/notifications` rejects a malformed token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:14](../../tests/api/auth.spec.ts:14) › `Auth API › notifications rejects a malformed token` |
| Project / tag | api / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/notifications` with `Authorization: Bearer not-a-jwt`. | HTTP **401**. |

## TC-AUTH-015: `GET /api/doctors/{id}` rejects a malformed token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:28](../../tests/api/auth.spec.ts:28) › `Auth API › doctor detail rejects a malformed token` |
| Project / tag | api / — |
| Precondition | At least one active doctor exists. Otherwise the case is skipped. |

| # | Action | Expected result |
|---|---|---|
| 1 | Read the first active doctor ID from the DB. | A row is returned. |
| 2 | Send `GET /api/doctors/{id}` with `Authorization: Bearer not-a-jwt`. | HTTP **401**. |

## TC-AUTH-016: `GET /api/doctors/{id}/availability` rejects a malformed token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:28](../../tests/api/auth.spec.ts:28) › `Auth API › doctor availability rejects a malformed token` |
| Project / tag | api / — |
| Precondition | At least one active doctor exists. Otherwise the case is skipped. |

| # | Action | Expected result |
|---|---|---|
| 1 | Read the first active doctor ID from the DB. | A row is returned. |
| 2 | Send `GET /api/doctors/{id}/availability` with `Authorization: Bearer not-a-jwt`. | HTTP **401**. |

## TC-AUTH-017: `GET /api/appointments/{id}` rejects a malformed token

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:28](../../tests/api/auth.spec.ts:28) › `Auth API › appointment detail rejects a malformed token` |
| Project / tag | api / — |
| Precondition | The test user owns at least one appointment. Otherwise the case is skipped. |

| # | Action | Expected result |
|---|---|---|
| 1 | Read the first appointment ID owned by the test user from the DB. | A row is returned. |
| 2 | Send `GET /api/appointments/{id}` with `Authorization: Bearer not-a-jwt`. | HTTP **401**. |

---

## Shared details for the authorization-boundary cases (TC-AUTH-018 … 021)

| Field | Value |
|---|---|
| Type | Security, access control |
| Priority | P0 |
| Catalog | API-APT-14, API-SEC-02 (profile only) |
| Data | Another patient's appointment and `patient_id` come from `db.otherPatientAppointment(testUser.id)`. Forged tokens are built from the session token with [`forgeJwt`](../../src/auth/jwt.ts). No secret is guessed, and no request uses another account's credentials. |
| Mutation | None. The cases do not log in. |

## TC-AUTH-018: `GET /api/appointments/{id}` refuses another patient's appointment

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:46](../../tests/api/auth.spec.ts:46) › `Authorization boundaries › appointment detail refuses another patient's appointment` |
| Project / tag | api / — |
| Basis | C (403 is documented for this operation), P (no data in the refusal) |
| Precondition | An appointment owned by a different patient exists. Otherwise the case is skipped. |
| Last recorded | Pass (2026-09-12) |

| # | Action | Expected result |
|---|---|---|
| 1 | Read one appointment with `patient_id <> <test user>` from the DB. | A row is returned. |
| 2 | Send `GET /api/appointments/{id}` with the test user's token. | HTTP **403**, not 200 and not 404. |
| 3 | Inspect the body. | No `patient_id` property. |

## TC-AUTH-019: `GET /api/users/me` rejects a token whose `user_id` was altered

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:56](../../tests/api/auth.spec.ts:56) › `Authorization boundaries › profile rejects a token whose user_id was altered` |
| Project / tag | api / — |
| Basis | C (401 is documented for this route) |
| Precondition | Another patient exists. Otherwise the case is skipped. |
| Last recorded | Pass (2026-09-12) |

| # | Action | Expected result |
|---|---|---|
| 1 | Decode the session token payload. | `user_id` equals the test user's DB id. This guard stops the case from forging a meaningless token if the claim is renamed. |
| 2 | Replace `user_id` with the other patient's id, keeping the header and original signature. | — |
| 3 | Send `GET /api/users/me` with the forged token. | HTTP **401**. |

## TC-AUTH-020: `GET /api/users/me` rejects a token with an `alg: none` header

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:67](../../tests/api/auth.spec.ts:67) › `Authorization boundaries › profile rejects a token with an alg:none header` |
| Project / tag | api / — |
| Basis | C |
| Last recorded | Pass (2026-09-12) |

| # | Action | Expected result |
|---|---|---|
| 1 | Set the header to `{"alg":"none","typ":"JWT"}`, keeping the payload and the original signature, so the request reaches the API past the edge firewall. | — |
| 2 | Send `GET /api/users/me` with it. | HTTP **401**. |

## TC-AUTH-021: `GET /api/users/me` answers an empty-signature token with the documented 401

| Field | Value |
|---|---|
| Automated test | [auth.spec.ts:72](../../tests/api/auth.spec.ts:72) › `Authorization boundaries › profile answers an empty-signature token with the documented 401` |
| Project / tag | api / — |
| Basis | C |
| Finding | [F-20](../../docs/FINDINGS.md) |
| Last recorded | Expected failure F-20 (2026-09-12) |

| # | Action | Expected result |
|---|---|---|
| 1 | Set the header to `alg: none` and drop the signature (`header.payload.`). Send `GET /api/users/me`. | Access denied. Before the marker, anything other than 401 must be the known signature: `403` with `x-vercel-mitigated: deny`. |
| 2 | (Expected failure) Assert the status. | HTTP **401**. Currently the edge firewall returns 403; a 401 is reported as an unexpected pass. |

---

**Not covered by this file (planned in the catalog):** expired tokens and tampered tokens on the other 15 operations (API-SEC-02), unknown email, login validation and rate limit (API-AUTH-02/03/05), logout (API-AUTH-06/07), and auth gates on the 8 protected **write** operations.
