# Appointments API

Spec: [tests/api/appointments.spec.ts](../../tests/api/appointments.spec.ts) · Project: `api` (depends on `setup`)

This file contains 2 read cases (default run) and 11 `@mutating` write cases (write run only).

## Shared mechanics

**F-15 compatibility read** (`readAppointments`, [appointmentResponse.ts:11](../../tests/api/appointmentResponse.ts:11)), used by every read step below:
1. The response has HTTP **200**. A list must be an array. A detail is wrapped as a one-item list.
2. Only an `appointment_date` of **exactly** `YYYY-MM-DDT00:00:00.000Z` is converted to `YYYY-MM-DD`, and the conversion is returned as a date-format violation. TC-APT-001/002 assert that list **last**, behind the F-15 expected-failure marker, so DB reconciliation runs hard first and F-15 stays visible. Other datetime formats, offsets or impossible dates are **not** converted and fail validation.
3. The normalized records must pass `Appointment[]` schema validation **and** the field-completeness policy.

**Selected DB fields** (`db.appointmentsForPatient`): `id, patient_id, doctor_id, appointment_date, time_slot, status`.

**Owned write data** (`owned` fixture, [writes.ts](../../tests/api/writes.ts)). This applies to every `@mutating` case:
- **Guard:** requires `RUN_MUTATING=1`, one worker and zero retries. It also confirms `GET /users/me` returns the same `id` as the DB `testUser`.
- **`freeSlot()`:** picks the first active doctor and gets their availability, which must be 200 with valid `HH:mm` slots. It then finds a catalog slot in the next 1–30 days with no non-cancelled DB appointment for that doctor. If none is found, the case throws **before any write**.
- **`create(body)`:** counts toward the booking cap of 20 per worker process. It sets `notes` to a unique run marker and sends `POST /api/appointments`. It then reads DB rows carrying that marker, even when the request was rejected.
- **`book()`:** gets a free slot, rechecks that the slot is still free, and creates the appointment. It asserts HTTP **201**, **exactly one** marked row, row values equal to the payload plus `patient_id` and marker, and a status in `active|pending|completed|cancelled`.
- **reschedule / cancel / remove:** refuse to act unless the row was created by this run, is owned by the test user, and still carries its marker. Each one captures the `before` row.
- **Teardown:** re-queries every attempted marker (including creates whose request or first DB read threw), deletes every marked row that still exists and confirms it is gone in the DB. A row that survives DELETE without linked payments fails cleanup; one blocked by linked payments is cancelled, the stored cancellation is verified, and it is annotated as residue.

**Settled DB assertions** ([dbState.ts](../../tests/api/dbState.ts)) poll the DB for a bounded window until the expectation holds. They then assert, so a value that never settles still fails with a real diff.

---

## TC-APT-001: `GET /api/appointments` contains only the patient's records and matches the DB

| Field | Value |
|---|---|
| Automated test | [appointments.spec.ts:15](../../tests/api/appointments.spec.ts:15) › `Appointments API › GET /appointments contains only the patient records and matches the DB` |
| Project / tag | api / — |
| Type | Functional, data isolation, data reconciliation |
| Priority / basis | P0 / C (200, `Appointment[]`, date-only format), P (exact owned ID set, DB values, completeness) |
| Finding | **F-15** (expected failure on the final date-format assertion) |
| Last recorded | **Expected failure, F-15** (2026-09-13): ID set, ownership and DB values all matched; only the date-format assertion failed. |

**Preconditions:** a valid session token and a `testUser` DB row. An empty list still reconciles, but the case is then skipped before the F-15 assertion.

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/appointments` and read it with `readAppointments(…, 'list')`. | HTTP 200. The array passes schema and completeness checks after the F-15 normalization. |
| 2 | Read the test user's appointments from the DB. | — |
| 3 | Compare the sorted API IDs with the DB IDs. | The ID sets are **identical**: nothing belonging to another patient and nothing missing. |
| 4 | For each API item, check ownership. | `patient_id === testUser.id`. |
| 5 | For each API item, compare with its DB row. | It matches `id, patient_id, doctor_id, appointment_date` (normalized), `time_slot` and `status`. |
| 6 | *(after `test.fail`)* Assert no date-format violations were recorded. | **Target:** every `appointment_date` is `YYYY-MM-DD`. **Current:** fails with UTC-midnight timestamps and is reported as an expected failure (F-15). |

---

## TC-APT-002: `GET /api/appointments/{id}` returns an owned appointment matching the DB

| Field | Value |
|---|---|
| Automated test | [appointments.spec.ts:28](../../tests/api/appointments.spec.ts:28) › `Appointments API › GET /appointments/:id returns an owned appointment matching the DB` |
| Project / tag | api / — |
| Type | Functional, data reconciliation |
| Priority / basis | P0 / C (200), P (`Appointment` shape and completeness, DB values). The detail operation declares no response schema, so the schema check here is suite policy. |
| Finding | **F-15** (expected failure on the final date-format assertion) |
| Last recorded | **Expected failure, F-15** (2026-09-13): the detail matched the DB row; only the date-format assertion failed. |

**Preconditions:** the test user owns at least one appointment. Otherwise the case is skipped.

| # | Action | Expected result |
|---|---|---|
| 1 | Read the first owned appointment row from the DB. | A row is returned. |
| 2 | Send `GET /api/appointments/{id}` and read it with `readAppointments(…, 'detail')`. | HTTP 200. The object passes schema and completeness checks after normalization. |
| 3 | Compare with the DB row. | All selected DB fields match. |
| 4 | Check ownership. | `patient_id === testUser.id`. |
| 5 | *(after `test.fail`)* Assert no date-format violations were recorded. | **Target:** `YYYY-MM-DD`. **Current:** fails with a UTC-midnight timestamp and is reported as an expected failure (F-15). |

---

TC-APT-003 and TC-APT-004 are retired: date-only validation is the final assertion of TC-APT-001 and TC-APT-002. It sits behind the F-15 expected-failure marker, after every reconciliation check, so a reconciliation regression still fails the case and a fix surfaces as an unexpected pass. IDs are not reused.

## TC-APT-005: `POST /api/appointments` stores exactly one owned appointment, and detail agrees

| Field | Value |
|---|---|
| Automated test | [appointments.spec.ts:43](../../tests/api/appointments.spec.ts:43) › `Appointments API writes › POST /appointments stores exactly one owned appointment and detail agrees` |
| Project / tag | api / **@mutating** |
| Type | Functional, state verification |
| Priority / basis | P0 / C (201), P (one persisted row, detail matches the DB). The create response has no schema, so the case does not rely on a returned ID. |
| Finding | — |
| Last recorded | Pass (2026-09-13 write run): the appointment was created, verified and deleted. |

**Preconditions:** the shared `@mutating` preconditions and a free catalog slot within 30 days.

**Test data:** `{ doctor_id: <first active>, appointment_date: <free future date>, time_slot: <free catalog slot>, notes: <run marker> }`

| # | Action | Expected result |
|---|---|---|
| 1 | `owned.book()`: find a free slot and send `POST /api/appointments`. | HTTP **201**. Exactly **one** DB row carries the marker, with the submitted values, `patient_id = testUser.id`, and a valid status. |
| 2 | Settle and assert the stored row by ID and owner. | The row matches the payload plus `patient_id`. |
| 3 | Send `GET /api/appointments/{id}` and read it with `readAppointments(…, 'detail')`. | HTTP 200. Schema and completeness pass. |
| 4 | Compare the detail with the stored row, excluding `created_at` and `updated_at`. | Every other stored field matches, including `notes = marker`. |

**Cleanup:** teardown deletes the appointment and confirms it is gone from the DB.

---

## TC-APT-006: `PUT /api/appointments/{id}/reschedule` stores the new slot and preserves identity

| Field | Value |
|---|---|
| Automated test | [appointments.spec.ts:53](../../tests/api/appointments.spec.ts:53) › `Appointments API writes › PUT /appointments/:id/reschedule stores the new slot and preserves identity` |
| Project / tag | api / **@mutating** |
| Type | Functional, state verification |
| Priority / basis | P0 / C (200), P (persisted new values, unchanged identity) |
| Finding | — |
| Last recorded | Pass (2026-09-13 write run). |

**Preconditions:** the shared `@mutating` preconditions. The same doctor has at least two free catalog slots within 30 days.

| # | Action | Expected result |
|---|---|---|
| 1 | `owned.book()` creates appointment A. | HTTP 201 with one owned row (see TC-APT-005, step 1). |
| 2 | Find a different free slot for the **same doctor**, excluding A's current date and slot. | A new `appointment_date` and `time_slot`. |
| 3 | Send `PUT /api/appointments/{A}/reschedule` with `{ appointment_date, time_slot }`. | HTTP **200**. |
| 4 | Settle and assert the stored row. | `appointment_date` and `time_slot` are the new values. `id`, `patient_id`, `doctor_id` and `notes` (the marker) are unchanged. |

**Cleanup:** teardown deletes A.
**Not asserted:** the response body shape (`success`, `appointment`). Not yet automated.

---

## TC-APT-007: `PUT /api/appointments/{id}/cancel` stores the cancellation without touching a control

| Field | Value |
|---|---|
| Automated test | [appointments.spec.ts:65](../../tests/api/appointments.spec.ts:65) › `Appointments API writes › PUT /appointments/:id/cancel stores the cancellation without touching a control` |
| Project / tag | api / **@mutating** |
| Type | Functional, state verification, isolation |
| Priority / basis | P0 / C (200), P (persisted `cancelled`, control row unchanged) |
| Finding | **F-16** |
| Last recorded | **Fail, F-16** (2026-09-13 write run). HTTP 200, but appointment 1145 stayed `active`. The control assertion was not reached. Both rows were deleted. |

**Preconditions:** the shared `@mutating` preconditions and two free slots.

| # | Action | Expected result |
|---|---|---|
| 1 | `owned.book()` creates target appointment T. | HTTP 201 with one owned row. |
| 2 | `owned.book()` creates control appointment C. | HTTP 201 with one owned row. C's full row is captured. |
| 3 | Send `PUT /api/appointments/{T}/cancel`. | HTTP **200**. |
| 4 | Settle and assert T's stored row. | `status = 'cancelled'`. |
| 5 | Settle and assert C's stored row. | C equals its captured row **field for field**, including `updated_at`. |

**Cleanup:** teardown deletes T and C.

---

## TC-APT-008: `DELETE /api/appointments/{id}` removes the row, and detail returns 404

| Field | Value |
|---|---|
| Automated test | [appointments.spec.ts:74](../../tests/api/appointments.spec.ts:74) › `Appointments API writes › DELETE /appointments/:id removes the row and detail returns 404` |
| Project / tag | api / **@mutating** |
| Type | Functional, state verification |
| Priority / basis | P0 / C (200), P (row absent, detail 404) |
| Finding | — |
| Last recorded | Pass (2026-09-13 write run). |

| # | Action | Expected result |
|---|---|---|
| 1 | `owned.book()` creates an unpaid appointment A. | HTTP 201 with one owned row. |
| 2 | Send `DELETE /api/appointments/{A}`. | HTTP **200**. |
| 3 | Settle the DB lookup by ID and owner. | No row remains. |
| 4 | Send `GET /api/appointments/{A}`. | HTTP **404**. |

**Cleanup:** nothing is left for teardown to remove. Teardown confirms this.

---

## TC-APT-009 … TC-APT-013: `POST /api/appointments` rejects invalid input without storing a row

These cases are generated by the loop at [appointments.spec.ts:82](../../tests/api/appointments.spec.ts:82). They share these steps:

| # | Action | Expected result |
|---|---|---|
| 1 | `owned.freeSlot()`: build a valid body for a free slot. | A valid baseline body. |
| 2 | Apply the case's single mutation to the body (see the table below). | — |
| 3 | `owned.create(payload)` sends `POST /api/appointments` with a unique marker. | **Soft** assertion (the status is not documented, except the documented 400 for a missing field). |
| 4 | Settle the DB lookup for the marker. | **Hard:** **no** row carries the marker. |

**Cleanup:** teardown deletes any marked row that was wrongly created.

| Case | Playwright title (after `Appointments API writes › `) | Mutation | Expected status | Basis | Finding / last recorded (2026-09-13) |
|---|---|---|---|---|---|
| **TC-APT-009** | `POST /appointments rejects missing doctor without storing a row` | Remove `doctor_id`. | `400` | C | — / **Pass**: HTTP 400, no row |
| **TC-APT-010** | `POST /appointments rejects yesterday without storing a row` | `appointment_date = today − 1 day` in `TEST_TIMEZONE` (default UTC). | `400` or `409` (soft) | Q (the date is schema-valid) | **F-12** / **Fail**: HTTP 201, row 1148 persisted |
| **TC-APT-011** | `POST /appointments rejects year 0123 without storing a row` | `appointment_date = '0123-11-23'`. | `400` or `409` (soft) | Q | **F-12** / **Fail**: HTTP 201, row 1149 persisted |
| **TC-APT-012** | `POST /appointments rejects invalid clock without storing a row` | `time_slot = '25:99'`. | `400` or `409` (soft) | Q (`time_slot` is an unconstrained string) | **F-02** / **Fail**: HTTP 201, row 1150 persisted |
| **TC-APT-013** | `POST /appointments rejects inactive doctor without storing a row` | `doctor_id = db.inactiveDoctor().id`. **Skipped** if no inactive doctor exists. | `400` or `409` (soft) | Q | **F-04** / **Fail**: HTTP 201, row 1151 persisted (doctor 7) |

Each case is an ordinary failure while its finding is open. No `test.fail` is used. The hard "nothing stored" assertion is what fails.

---

## TC-APT-014: `POST /api/appointments` rejects a duplicate slot and leaves exactly one booking

| Field | Value |
|---|---|
| Automated test | [appointments.spec.ts:103](../../tests/api/appointments.spec.ts:103) › `Appointments API writes › POST /appointments rejects a duplicate slot and leaves exactly one booking` |
| Project / tag | api / **@mutating** |
| Type | Business rule, data integrity |
| Priority / basis | P0 / P (no second row, original unchanged), Q (400 or 409) |
| Finding | **F-03** |
| Last recorded | **Fail, F-03** (2026-09-13 write run): the second create returned 201 and row 1153 was persisted for the same doctor, date and slot as the first booking. Both were deleted. |

| # | Action | Expected result |
|---|---|---|
| 1 | `owned.book()` creates booking B1 at a free slot. | HTTP 201 with one owned row. B1's full row is captured. |
| 2 | `owned.create(B1.payload)` sends the same doctor, date and slot with a **new** marker. | **Soft:** status is `400` or `409`. |
| 3 | Settle the DB lookup for the second marker. | **Hard:** no row carries it. |
| 4 | Settle B1's row. | B1 is unchanged field for field. |

**Cleanup:** teardown deletes B1 and any duplicate.
**Not covered:** concurrent duplicate submissions.

---

## TC-APT-015: `PUT /api/appointments/{id}/reschedule` rejects an invalid body and stores no change

| Field | Value |
|---|---|
| Automated test | [appointments.spec.ts:111](../../tests/api/appointments.spec.ts:111) › `Appointments API writes › PUT /appointments/:id/reschedule rejects an invalid body and stores no change` |
| Project / tag | api / **@mutating** |
| Type | Business rule, state verification |
| Priority / basis | P1 / P (no partial update), Q (400 or 409) |
| Finding | **F-17** |
| Last recorded | **Fail, F-17** (2026-09-13 write run). HTTP 200, and 1154 changed from 2026-09-24 / 09:30 to 2026-09-12 / 25:99. The row was deleted. |

| # | Action | Expected result |
|---|---|---|
| 1 | `owned.book()` creates appointment A. | HTTP 201 with one owned row. |
| 2 | Send `PUT /api/appointments/{A}/reschedule` with `{ appointment_date: <yesterday>, time_slot: '25:99' }`. The `before` row is captured first. | **Soft:** status is `400` or `409`. |
| 3 | Settle A's row. | **Hard:** A equals `before` field for field. |

**Cleanup:** teardown deletes A.
**Note:** the invalid date and the invalid clock are combined in one request, so a failure does not show which one the API accepted. Separate date and clock variants are still needed.
