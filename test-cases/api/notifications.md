# Notifications API

Spec: [tests/api/notifications.spec.ts](../../tests/api/notifications.spec.ts) · Project: `api` (depends on `setup`)

---

## TC-NOT-001: `GET /api/notifications` contains only the user's records and maps `isRead` to `is_read`

| Field | Value |
|---|---|
| Automated test | [notifications.spec.ts:5](../../tests/api/notifications.spec.ts:5) › `GET /notifications contains only the user records and maps isRead to is_read` |
| Project / tag | api / — |
| Type | Functional, data isolation, data reconciliation |
| Priority / basis | P0 / C (200, `Notification[]`, camelCase `isRead` boolean), P (completeness, exact owned ID set, DB values) |
| Finding | F-10 (API `isRead` versus DB `is_read`) |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** a valid session token. An empty list is valid.

**Expected source:** `db.notificationsForUser(testUser.id)` returns `id, user_id, type, message, is_read`.

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/notifications` and validate with `expectCompleteJson(…, 'Notification[]')`. | HTTP **200**. Literal schema validation passes, and every declared field (including `isRead`) is present. |
| 2 | Read the user's notifications from the DB. | — |
| 3 | Compare the sorted API IDs with the DB IDs. | The ID sets are **identical**. |
| 4 | For each DB row, find the API item with the same ID. | It matches `id`, `user_id`, `type` and `message`, and **`isRead` equals DB `is_read`**. |
| 5 | For each API item, check ownership. | `user_id === testUser.id`. |

---

## TC-NOT-002: `PUT /api/notifications/{id}/read` changes only that read flag and repeats idempotently

| Field | Value |
|---|---|
| Automated test | [notifications.spec.ts:18](../../tests/api/notifications.spec.ts:18) › `PUT /notifications/:id/read changes only that read flag and repeats idempotently` |
| Project / tag | api / **@mutating** |
| Type | Functional, state verification, idempotence |
| Priority / basis | P1 / C (200), P (only the target flag changes, sibling notifications unchanged), Q (a repeat is 200 with no change) |
| Finding | — |
| Last recorded | **Skipped** (2026-09-12 write run). No new unread notification could be attributed to the run. |

**Safety rule:** existing notifications are **never** changed. Only a notification that this run created and can be traced back to may be marked read.

**Preconditions**
- The shared `@mutating` preconditions (see [appointments.md](appointments.md#shared-mechanics)).
- Booking an appointment produces a new unread notification for the test user. If no such notification can be attributed to the run, the case is **skipped**.

| # | Action | Expected result |
|---|---|---|
| 1 | Capture the baseline notifications for the user from the DB. | — |
| 2 | `owned.book()` creates appointment A. | HTTP 201 with one owned row. |
| 3 | Read the notifications again. Pick target N: **not** in the baseline, `is_read = false`, and a `message` that contains A's marker or references `appointment #<A>` / `appointment id <A>`. | N is found. Otherwise the case is skipped. |
| 4 | Build the expected state: the current rows with only N's `is_read` set to `true`. | — |
| 5 | **Step "first read":** send `PUT /api/notifications/{N}/read`. | HTTP **200**. |
| 6 | Settle the DB notifications for the user. | They equal the expected state **exactly**: only N's flag changed, and every other row is unchanged. |
| 7 | Send `GET /api/notifications` and validate with `expectCompleteJson`. | HTTP 200, schema and completeness pass, and N has `isRead === true`. |
| 8 | **Step "repeated read":** repeat steps 5–7 for N. | HTTP **200**. The DB state is identical to the expected state, and `isRead` is still `true`. |

**Cleanup:** teardown deletes A. Notifications cannot be removed, so N may remain as a read notification.

**Not covered:** another user's notification (403) and a missing ID.
