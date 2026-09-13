# Booking form (UI)

Spec: [tests/ui/booking.spec.ts](../../tests/ui/booking.spec.ts) · Project: `ui` (Desktop Chrome, depends on `setup`)

**Page object:** [BookingPage](../../src/pages/BookingPage.ts). It exposes the `Doctor` select, the `Date` input, and the `Time Slot` options, excluding the placeholder "Select a time slot".

---

## TC-UI-BOOK-001: Booking loads the selected doctor's availability into time options without submitting

| Field | Value |
|---|---|
| Automated test | [booking.spec.ts:4](../../tests/ui/booking.spec.ts:4) › `booking loads the selected doctor availability into time options without submitting` |
| Project / tag | ui / — |
| Type | Integration (UI ↔ API), regression |
| Priority | P1 |
| Catalog / finding | API-DOC-07 (UI view) / **F-19** (reported load issue, not reproduced) |
| Last recorded | Pass (2026-09-12). Two doctors' availability GETs returned 200, and the options matched. |

**Preconditions**
- The browser is authenticated.
- At least **two** active doctors exist in the DB, so a change of selection can be observed. Otherwise the case is **skipped**.

**Safety:** every non-GET request to `**/api/**` is **aborted** at the network layer. Even if the app unexpectedly submits, no booking is created, so the case is read-only.

**Test data:** the first two active doctors by `id`, and tomorrow's date in UTC (`YYYY-MM-DD`).

| # | Action | Expected result |
|---|---|---|
| 1 | Read the first two active doctors from the DB. | Two rows are returned. |
| 2 | Install a route guard: allow `GET /api/**`, abort every other method. | — |
| 3 | Open `/appointments/new`. | The booking form loads. |
| 4 | Fill **Date** with tomorrow. | — |
| 5 | For doctor 1: start waiting for `GET /api/doctors/{id}/availability`, then select the doctor's `id` in **Doctor**. | An availability request is sent for **that** doctor's ID. |
| 6 | Inspect the response. | HTTP **200**. The body contains a `time_slots` array, and every slot matches `^(?:[01]\d\|2[0-3]):[0-5]\d$`. |
| 7 | Inspect the **Time Slot** options. | The option texts equal `time_slots` **exactly and in order**, excluding the placeholder. |
| 8 | Repeat steps 5–7 for doctor 2. | A new request is sent for doctor 2, and the options are **replaced** with doctor 2's `time_slots`. |

**Postconditions:** no write requests reached the API.

**Not covered:** failed or slow availability responses and recovery, date-specific vacancy (F-05), and submitting a booking.
