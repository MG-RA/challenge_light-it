# Payments API

Spec: [tests/api/payments.spec.ts](../../tests/api/payments.spec.ts) · Project: `api` (depends on `setup`)

---

## TC-PAY-001: `GET /api/payments` matches payments for the patient's appointments

| Field | Value |
|---|---|
| Automated test | [payments.spec.ts:5](../../tests/api/payments.spec.ts:5) › `GET /payments matches payments for the patient appointments` |
| Project / tag | api / — |
| Type | Functional, data isolation, data reconciliation |
| Priority / basis | P0 / C (200, `Payment[]`, `amount` as a string, enums), P (completeness, exact owned ID set, numeric amount) |
| Finding | F-09 (compare decimals numerically) |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** a valid session token. An empty list is valid.

**Expected source:** `db.paymentsForPatient(testUser.id)` returns `payments` joined to `appointments` where `patient_id` is the test user.

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/payments` and validate with `expectCompleteJson(…, 'Payment[]')`. | HTTP **200**. Literal schema validation passes (method is `cash|card|insurance`, status is `pending|paid|refunded`), and every declared field is present. |
| 2 | Read the patient's payments from the DB. | — |
| 3 | Compare the sorted API IDs with the DB IDs. | The ID sets are **identical**. Only payments linked to the patient's own appointments appear. |
| 4 | For each DB row, compare every field except `amount`. | `id`, `appointment_id`, `method` and `status` match. |
| 5 | Check the format of `amount`. | A decimal string matching `^-?\d+(?:\.\d+)?$`. |
| 6 | Check the value of `amount`. | `Number(amount)` is finite and numerically equals the DB amount. |

---

## TC-PAY-002: `POST /api/payments` stores one valid payment and rejects a duplicate

| Field | Value |
|---|---|
| Automated test | [payments.spec.ts:25](../../tests/api/payments.spec.ts:25) › `POST /payments stores one valid payment and rejects a duplicate` |
| Project / tag | api / **@mutating** |
| Type | Functional, business rules, state verification |
| Priority / basis | P0 / C (200 with `success`/`payment_id`), P (one persisted payment, returned ID equals the stored ID), Q (duplicate rejected with 400 or 409) |
| Finding | **F-18** |
| Last recorded | **Fail, F-18** (2026-09-13 payment write run). The valid payment returned HTTP 200, but no payment was persisted for appointment 1160, so step 4 failed and the duplicate (step 6) was not sent. The appointment was deleted. |

**Preconditions**
- The shared `@mutating` preconditions (see [appointments.md](appointments.md#shared-mechanics)).
- The first active doctor has a positive, finite `consultation_fee`.
- The payment cap allows 4 submissions per worker process. This case uses up to 2; TC-PAY-003 uses the other 2.

**Test data:** a dedicated fresh appointment. `amount` is the doctor's fee **as a number** (the request schema is a number, while the response amount is a string). `method` is `cash`.

| # | Action | Expected result |
|---|---|---|
| 1 | `owned.book()` creates dedicated appointment A. | HTTP 201 with one owned row. |
| 2 | Read `fee = Number(doctor.consultation_fee)`. | The fee is finite and `> 0`. |
| 3 | `owned.pay(A, { amount: fee, method: 'cash' })`. Payments for A are captured before the request. | HTTP **200**. The payments captured beforehand are `[]`. |
| 4 | Settle A's payments in the DB. | **Exactly one** row with `appointment_id = A` and `method = 'cash'`. `Number(amount) === fee`, and `status` is `pending`, `paid` or `refunded`. |
| 5 | Check the response body. | It matches `{ success: true, payment_id: <stored row id> }`. |
| 6 | `owned.pay(A, { amount: fee, method: 'cash' })` again. | **Soft:** 400 or 409. **Hard:** A's payments still equal only the payment from step 4. |

**Cleanup:** teardown tries to delete A. If linked payments block the deletion, A is **cancelled** instead and recorded as a `residue` annotation. Payments cannot be removed through the API. If cancellation also fails, cleanup fails.

---

## TC-PAY-003: `POST /api/payments` rejects zero and negative amounts without storing a payment

| Field | Value |
|---|---|
| Automated test | [payments.spec.ts:56](../../tests/api/payments.spec.ts:56) › `POST /payments rejects zero and negative amounts without storing a payment` |
| Project / tag | api / **@mutating** |
| Type | Business rules, state verification |
| Priority / basis | P0 / P (nothing stored after an invalid amount), Q (rejected with 400 or 409: the request schema only requires a number, and the documented 400 is for an invalid method) |
| Finding | **F-24** |
| Last recorded | **Fail, F-24** (2026-09-13 payment write run). Both amounts returned HTTP 200; no payment row was stored for the dedicated appointment. Because of F-18 no payment is stored at all, so the empty table does not show that amounts are validated. The appointment was deleted. |

**Why separate from TC-PAY-002:** these checks do not need a successful payment first. Before the split they were steps after the valid payment and were never sent while F-18 is open.

**Test data:** a dedicated fresh appointment B, `method` `cash`.

| # | Action | Expected result |
|---|---|---|
| 1 | `owned.book()` creates dedicated appointment B. | HTTP 201 with one owned row. |
| 2 | **Step "rejects a zero amount":** `owned.pay(B, { amount: 0, method: 'cash' })`. | **Soft:** 400 or 409. **Hard:** B has no payment rows. |
| 3 | **Step "rejects a negative amount":** `owned.pay(B, { amount: -1, method: 'cash' })`. | **Soft:** 400 or 409. **Hard:** B has no payment rows. |

**Cleanup:** as in TC-PAY-002. A zero or negative payment that did persist would block deletion and be declared as residue.

**Not covered (either payment case):** `card`/`insurance`, an invalid method (400), missing or wrong-type fields, another user's or a missing appointment, and cancelled or completed appointments.
