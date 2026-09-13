# Other findings (outside the reschedule story)

Found while exploring the rest of MedAppoint, before and alongside Part 1. They are not part of the reschedule report, but the brief asks to document what we spot. Rescheduling defects live in the [Part 1 report](../part-1-functional-testing/README.md); where a finding below is the root cause of one of those, it links there.

**How to read this list.** Ordered by proposed fix priority. **P0** blocks a release: a write that reports success but is not stored. **P1** stores invalid or conflicting data. **P2** wrong behavior with a limited audience, a contract gap or a bounded security concern. **P3** low impact. Every finding was reproduced against the live environment on 2026-09-12 or 2026-09-13 unless it says otherwise; write probes used appointments created for the test and deleted afterwards.

**Where the evidence lives.** "Extras" means an automated check in [extras/api-tests](api-tests) (see [extras/README.md](README.md)). "Archive" means the check belonged to the earlier, broader UI suite, which was replaced by the three Part 4 flows; it remains available at the git tag `archive/full-suite`.

## Bugs

| ID | Priority | Finding | Evidence | Check |
|---|---|---|---|---|
| F-18 | **P0** | **A payment reports success but is not stored.** `POST /api/payments` returns 200 with a payment id; no payment row exists for the appointment. | Appointments 1137, 1156 and 1160 on three runs | Extras (`payments.spec.ts`, writes) |
| F-16 | **P0** | **Cancelling reports success but the appointment stays active.** The API returns `{"success":true,"status":"cancelled"}`; the stored status is still `active`. The UI shows "Cancelled" until reload. | Appointments 1126 and 1145 (API), and once through the UI in Part 1 | Extras (`appointments.spec.ts`, writes) |
| F-03 | P1 | **The same doctor, date and time can be booked twice.** A second `POST /api/appointments` for an occupied slot returns 201 and stores another row. Part 1 BUG-01 shows the same gap for rescheduling. | Rows 1134 and 1153 | Extras (writes) |
| F-12 | P1 | **Bookings accept past dates** (yesterday, and year 0123), and the booking form's date input has no minimum. | Rows 1129/1130 and 1148/1149; an active appointment dated 0123-11-23 is visible on the account | Extras (writes); UI part in Archive |
| F-02 | P1 | **A booking can store the time `25:99`.** | Rows 1131 and 1150 | Extras (writes) |
| F-05 | P2 | **The booking form offers a time that is already booked** for that doctor and date. | Booked slot stayed present and enabled | Archive |
| F-21 | P2 | **"Your next appointment" on the dashboard shows the wrong appointment** (a different doctor from the earliest upcoming one). | UI showed Dr. Carlos Méndez; the earliest eligible row belongs to Dr. María Fernández | Archive |
| F-23 | P2 | **The dashboard "Upcoming appointments" counter does not follow the data.** It stayed at 3 for an empty list, for a two-item list, and after a real booking raised the stored count to 4. The Completed and Cancelled counters do update. | Controlled responses and a real booking | Archive |
| F-22 | P2 | **No login throttling within ten failed attempts.** All ten returned 401; the API documents a 429 but no threshold. | One bounded run | Extras (`rate-limit.spec.ts`, opt-in) |
| F-04 | P2 | **A booking with an inactive doctor is accepted.** | Rows 1132 and 1151 (doctor 7) | Extras (writes) |
| F-24 | P2 | **Payments of 0 and −1 return 200.** Nothing is stored, but F-18 means no payment is ever stored, so validation is unproven. | One run | Extras (`payments.spec.ts`, writes) |
| F-15 | P2 | **Appointment dates are sent as UTC-midnight timestamps**, not the documented `YYYY-MM-DD`. This is the root cause of Part 1 BUG-03 (dates shown a day early west of UTC). | e.g. `2026-09-12T00:00:00.000Z` | Extras (expected failure) |
| F-01 | P2 | **The doctor list omits `consultation_fee` and `is_active`**, which the detail endpoint returns. The fields are optional in the contract, so this breaks the suite's completeness policy, not the literal schema. | Every list item | Extras (expected failure) |
| F-14 | P3 | **Patient-specific responses are marked `Cache-Control: public`** (profile and appointment list). No cross-user leak was demonstrated. | Header `public, max-age=0, must-revalidate` | Extras (expected failure) |
| F-20 | P3 | **A token with an empty signature gets a plain-text 403 from the edge firewall** instead of the documented 401. Access is still denied. | `x-vercel-mitigated: deny` | Extras (expected failure) |

## Needs re-verification

| ID | Finding | Status |
|---|---|---|
| F-06 | Saving the profile merged the surname and notes into the first name and emptied the surname. | Earlier manual report with database corroboration; not rerun, because it corrupts the account's name and no disposable account was available. |

## Observations (not confirmed bugs)

| ID | Observation |
|---|---|
| F-13 | The dashboard banner image is 6.1 MiB; worth resizing, but no page-weight budget is agreed. |
| F-19 | A reported failure to load availability was not reproduced; doctor availability loaded in every run. |
| F-07 | A notification was stored with a future `created_at` (2027-03-15); may be deliberate seed data. |
| F-08 | Status labels differ between screens ("Confirmed" vs. `active`); Part 1 BUG-07 records the confirmed case of a pending appointment shown as "Confirmed". |
| F-09 | Money amounts are strings (`"120"` vs. `120.00` in the database); numerically equal. |
| F-10 | Notifications use `isRead` in the API and `is_read` in the database; this matches the contract. |
| F-11 | `GET /api/doctors/abc` returns 404 rather than 400; no rule requires either. |
