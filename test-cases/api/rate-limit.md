# Login rate limit

Spec: [tests/api/rate-limit.spec.ts](../../tests/api/rate-limit.spec.ts) · Project: `api` (no session needed)

This case sends deliberate failed logins, so it is **skipped** unless `RUN_RATE_LIMIT=1`. Run it on its own and last, so it cannot interfere with the login cases in the default run:

```bash
RUN_RATE_LIMIT=1 npx playwright test tests/api/rate-limit.spec.ts --project=api --no-deps --workers=1
```

---

## TC-AUTH-RATE-001: Login throttles a bounded series of failed attempts

| Field | Value |
|---|---|
| Automated test | [rate-limit.spec.ts:3](../../tests/api/rate-limit.spec.ts:3) › `login throttles a bounded series of failed attempts` |
| Project / tag | api / `@rate-limit` |
| Type | Security, abuse protection |
| Priority / basis | P1 / C (429 is documented for login), Q (ten attempts is a proposed bound; the spec gives no threshold or window) |
| Finding | **F-22** |
| Last recorded | **Fail, F-22** (2026-09-13): ten attempts returned 401 each; no 429. No further attempts were made. |

**Preconditions**
- `RUN_RATE_LIMIT=1`, one worker and zero retries. The case asserts both before sending anything.
- The configured account exists. No other login activity is running against it.

**Test data:** the configured account email with the fixed invalid password `deliberately-invalid-rate-limit-check`. Passwords are never guessed.

| # | Action | Expected result |
|---|---|---|
| 1 | Send `POST /api/auth/login` with the invalid password. | HTTP **401** or **429**. Any other status fails immediately. |
| 2 | Repeat up to ten attempts, stopping at the first 429. | — |
| 3 | Record the status sequence as an `observation` annotation. | Credentials are not recorded. |
| 4 | Assert the sequence contains 429. | **Target:** throttled within ten failed attempts. **Current:** fails (F-22). |

**Postconditions:** no data changes. The account may be temporarily throttled if protection exists.

**Limits:** a failure shows only that no throttle appeared within this sample; it does not prove unlimited attempts. Recovery time and account-versus-IP scope are not checked. The UI's handling of a 429 is TC-UI-LOGIN-006 in [login.md](../ui/login.md).
