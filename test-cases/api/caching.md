# HTTP caching

Spec: [tests/api/caching.spec.ts](../../tests/api/caching.spec.ts) · Project: `api` (depends on `setup`)

Both cases are **known-defect** cases (F-14). All preconditions are validated **before** the `test.fail` marker by `cacheHeaderForCheck` ([knownDefectChecks.ts:23](../../tests/api/knownDefectChecks.ts:23)). This way an unrelated regression, such as a wrong status, a schema break, or a *different* unsafe header, still fails as unexpected.

When F-14 is fixed, Playwright reports an **unexpected pass**. Remove the `test.fail` line and update the finding.

---

## TC-CACHE-001: Profile response is not cacheable by shared caches

| Field | Value |
|---|---|
| Automated test | [caching.spec.ts:6](../../tests/api/caching.spec.ts:6) › `HTTP caching › profile response is not cacheable by shared caches` |
| Project / tag | api / — |
| Type | Security, HTTP headers |
| Priority / basis | P1 / P |
| Finding | **F-14** (annotation `issue`) |
| Last recorded | Expected failure, F-14 (2026-09-13). Header was `public, max-age=0, must-revalidate`. |

**Preconditions:** a valid session token.

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/users/me` with the bearer token. | HTTP **200**, and the body passes `expectCompleteJson(…, 'User')`. |
| 2 | Read the `Cache-Control` response header. Treat a missing header as an empty string. | — |
| 3 | Pre-check: classify the header. | If it contains `public`, it must be exactly `public, max-age=0, must-revalidate` (the known F-14 signature). Otherwise it must contain `private` or `no-store`. Any other value fails as **unexpected**. |
| 4 | *(after `test.fail`)* Assert the header does not contain `public`. | **Target:** no `public` directive. **Current:** fails with the F-14 signature and is reported as an expected failure. |

---

## TC-CACHE-002: Appointment list response is not cacheable by shared caches

| Field | Value |
|---|---|
| Automated test | [caching.spec.ts:6](../../tests/api/caching.spec.ts:6) › `HTTP caching › appointments response is not cacheable by shared caches` |
| Project / tag | api / — |
| Type | Security, HTTP headers |
| Priority / basis | P1 / P |
| Finding | **F-14**. Body validation uses the F-15 compatibility path. |
| Last recorded | Expected failure, F-14 (2026-09-13). Header was `public, max-age=0, must-revalidate`. |

**Preconditions:** a valid session token.

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/appointments` with the bearer token. | HTTP **200**. |
| 2 | Validate the body with `readAppointments(…, 'list')`. | The body is an array. Only exact UTC-midnight timestamps (`YYYY-MM-DDT00:00:00.000Z`) are normalized to `YYYY-MM-DD` (F-15). After that, it passes `Appointment[]` schema validation and the field-completeness policy. |
| 3 | Read the `Cache-Control` header. | — |
| 4 | Pre-check: classify the header as in TC-CACHE-001, step 3. | The known signature or `private`/`no-store` is accepted. Anything else fails as unexpected. |
| 5 | *(after `test.fail`)* Assert the header does not contain `public`. | **Target:** no `public` directive. **Current:** expected failure (F-14). |

**Note:** these cases show unsafe *headers*. They do not show an actual cross-user cache leak.
