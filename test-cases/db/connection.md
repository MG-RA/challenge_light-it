# Database connection

Spec: [tests/db/connection.spec.ts](../../tests/db/connection.spec.ts) · Project: `db` (no dependency on `setup`; app credentials are not needed)

These cases protect the premise of the whole suite: the DB is a **read-only oracle**. If either case fails, stop and do not trust DB reconciliation in any other case.

---

## TC-DB-001: Read-only user can connect and see the app tables

| Field | Value |
|---|---|
| Automated test | [connection.spec.ts:4](../../tests/db/connection.spec.ts:4) › `Database › read-only user can connect and see the app tables` |
| Project / tag | db / — |
| Type | Environment, smoke |
| Priority / basis | P1 / P |
| Catalog / finding | — / — |
| Last recorded | Pass (2026-09-12) |

**Preconditions:** DB host, port, name, user, and password are configured in `.env`, and the host is reachable.

| # | Action | Expected result |
|---|---|---|
| 1 | Open a connection through the worker-scoped `db` fixture. | The connection succeeds. |
| 2 | Query `information_schema.tables` for `table_schema = 'public'`, ordered by name. | The query returns rows. |
| 3 | Collect `table_name` values. | The list contains at least `appointments`, `doctors`, `notifications`, `payments`, `users`. Other tables are allowed. |

---

## TC-DB-002: DB user cannot write

| Field | Value |
|---|---|
| Automated test | [connection.spec.ts:13](../../tests/db/connection.spec.ts:13) › `Database › DB user cannot write (guards against accidental mutation)` |
| Project / tag | db / — |
| Type | Security, safety guard |
| Priority / basis | P0 / P |
| Catalog / finding | — / — |
| Last recorded | Pass (2026-09-12): the UPDATE was denied |

**Preconditions:** same as TC-DB-001.

**Test data:** `update doctors set bio = bio where false`. The statement matches zero rows, so even if permission were granted, no data would change.

| # | Action | Expected result |
|---|---|---|
| 1 | Execute the zero-row UPDATE through `db.query`. | The promise **rejects**. |
| 2 | Inspect the error message. | It matches `/permission denied\|read-only/i`. |

**Postconditions:** no data changed, even if the guard fails.
