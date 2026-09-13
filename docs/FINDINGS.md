# Findings — prioritized bug list

Updated 2026-09-13. Evidence comes from the API write run on 2026-09-12 and the API read, UI, DB and rate-limit runs on 2026-09-13. Each finding links the test cases that reproduce it; their latest results are in the [test-case matrix](../test-cases/README.md#traceability-matrix).

The numbered list is the recommended triage order, highest priority first. **P1**: address first because a core operation loses or corrupts state. **P2**: schedule next for incorrect UI behavior, eligibility, contracts or a bounded security concern. **P3**: lower-impact response consistency or feedback. Priority is proposed fix order; severity is potential impact. No P0 blocker has been established. Existing finding IDs stay unchanged regardless of rank.

Evidence status is explicit: a historical report or unconfirmed policy is not presented as a freshly reproduced defect. All live owned records created during the cited runs were cleaned up; payment follow-on probes stopped when valid payment persistence failed.

## Bugs and issues requiring action

1. **F-18 — Payment reports success without storing a payment**

   **Priority:** P1 · **Severity:** High · **Status:** Reproduced: 2026-09-12 API/DB write run.

   **Description / actual result:** HTTP 200 reports a payment ID, but no payment row appears for appointment 1137 during bounded reconciliation.

   **How to reproduce:** Create an owned unpaid appointment; submit a cash payment using the stored doctor fee; query linked payments.

   **Expected result:** A successful payment response identifies a persisted payment linked to the correct appointment.

   **Impact:** The user can believe payment was recorded when payment history and the DB contain no record. No external charge or provider failure was demonstrated.

   **Recommended action / limits:** Verify persistence before returning success; then retest valid, zero, negative and duplicate payments. Later probes were stopped after the valid-payment failure.

   **Evidence / coverage:** [Payment cases](../test-cases/api/payments.md).

2. **F-16 — Cancellation reports success but leaves the appointment active**

   **Priority:** P1 · **Severity:** High · **Status:** Reproduced: 2026-09-12 API/DB write run.

   **Description / actual result:** HTTP 200; appointment 1126 remains active. The control comparison was not reached.

   **How to reproduce:** Create an owned appointment and a control; send PUT /api/appointments/{id}/cancel; poll the target row.

   **Expected result:** Successful cancellation persists cancelled status for the target and leaves the control unchanged.

   **Impact:** Users may believe a booking is cancelled while it remains active; cancellation-dependent views cannot reflect a change that was never stored.

   **Recommended action / limits:** Persist cancellation before reporting success and verify the full target/control flow.

   **Evidence / coverage:** [TC-APT-007](../test-cases/api/appointments.md).

3. **F-03 — The same doctor, date and time can be booked twice**

   **Priority:** P1 · **Severity:** High · **Status:** Reproduced: 2026-09-12 sequential API/DB write run.

   **Description / actual result:** Second create returns 201 and persists another row (1134).

   **How to reproduce:** Create an owned booking in a free slot; submit another booking for the same doctor/date/time with a separate marker.

   **Expected result:** Reject the conflicting request without creating a second active booking; preserve the first row. Exact rejection status needs agreement.

   **Impact:** Two patients or bookings can occupy the same appointment slot, creating a scheduling conflict.

   **Recommended action / limits:** Enforce the agreed uniqueness rule atomically; then test concurrent requests. Sequential duplication is proven; concurrency has not been tested.

   **Evidence / coverage:** [TC-APT-014](../test-cases/api/appointments.md).

4. **F-17 — Rescheduling accepts and stores an invalid date and time**

   **Priority:** P1 · **Severity:** High · **Status:** Reproduced: 2026-09-12 API/DB write run.

   **Description / actual result:** HTTP 200; appointment 1135 changes from 2026-09-18 / 09:00 to 2026-09-11 / 25:99.

   **How to reproduce:** Create an owned appointment; reschedule it to yesterday with time_slot 25:99; compare the full DB row.

   **Expected result:** Reject invalid values and preserve the entire original row.

   **Impact:** An existing valid appointment becomes an unusable or misleading schedule entry.

   **Recommended action / limits:** Apply agreed booking validation to rescheduling. Separate date and time probes are still needed because this request combined both.

   **Evidence / coverage:** [TC-APT-015](../test-cases/api/appointments.md).

5. **F-12 — Booking accepts past dates; the UI also lacks past-date validation**

   **Priority:** P1 · **Severity:** High · **Status:** API/DB reproduced 2026-09-12; UI reproduced 2026-09-13.

   **Description / actual result:** API returns 201 and stores both invalid booking dates (1129, 1130). UI date has no minimum; submitting the past date does not return focus to Date.

   **How to reproduce:** Submit owned bookings for yesterday and 0123-11-23; separately fill the UI date with 2000-01-01 and submit with POST intercepted.

   **Expected result:** Reject past booking dates under the proposed business rule; provide clear UI validation and enforce it server-side.

   **Impact:** Users can create appointments that cannot represent a future visit.

   **Recommended action / limits:** Add aligned client/server date validation with an agreed timezone. The UI reproduction made no invalid server write.

   **Evidence / coverage:** [TC-APT-010/011](../test-cases/api/appointments.md); [TC-UI-BOOK-007](../test-cases/ui/booking.md).

6. **F-02 — Booking stores an impossible clock value**

   **Priority:** P1 · **Severity:** High · **Status:** Reproduced: 2026-09-12 API/DB write run.

   **Description / actual result:** HTTP 201; appointment 1131 stores 25:99.

   **How to reproduce:** Create a marked appointment with otherwise valid values and time_slot 25:99; read its DB row.

   **Expected result:** Reject impossible time values without storing a booking. The schema currently leaves time_slot unconstrained.

   **Impact:** Invalid appointment times undermine scheduling and downstream displays.

   **Recommended action / limits:** Validate real clock values and membership in the agreed doctor/date availability.

   **Evidence / coverage:** [TC-APT-012](../test-cases/api/appointments.md).

7. **F-06 — Profile save merges surname and notes into the first name**

   **Priority:** P1 · **Severity:** High · **Status:** Historical manual reproduction with DB corroboration; not rerun.

   **Description / actual result:** Recorded HTTP 200 changed first_name to Proud Phoenix test, emptied last_name and retained notes=test. A later save failed because last_name was required.

   **How to reproduce:** The recorded save submitted the tester’s assigned first name, last name and notes as separate fields. Do not reuse that alias for another account.

   **Expected result:** Preserve the assigned name fields and store notes independently.

   **Impact:** Corrupts profile names, can expose notes in greetings, and can prevent subsequent saves.

   **Recommended action / limits:** Reverify with a disposable account or reliable reset before changing another profile. The documented alias-mismatch 403 is intentional.

   **Evidence / coverage:** Historical manual reproduction only. No automated case exists: profile writes stay disabled until a disposable account or reliable reset is available (see the [QA plan](../QA_PLAN.md#2-scope)).

8. **F-05 — An occupied appointment slot remains selectable**

   **Priority:** P2 · **Severity:** Medium · **Status:** Reproduced: 2026-09-13 owned-booking UI/DB check.

   **Description / actual result:** The occupied time remains present and enabled after availability loads.

   **How to reproduce:** Create and verify one future owned booking; open the booking form with the same doctor and date; inspect its time option.

   **Expected result:** Exclude or disable a booked slot for that doctor/date under the proposed vacancy rule.

   **Impact:** The form offers a conflicting booking choice; F-03 separately confirms the API accepts sequential duplicates.

   **Recommended action / limits:** Define date/timezone availability semantics and filter occupied slots. The published availability endpoint has no date parameter and may be a slot catalog; no backend root cause is established. Identical working hours across doctors alone are not a bug.

   **Evidence / coverage:** [TC-UI-BOOK-008](../test-cases/ui/booking.md).

9. **F-21 — Next appointment shows a different record from the earliest eligible appointment**

   **Priority:** P2 · **Severity:** Medium · **Status:** Reproduced: 2026-09-13 UI/DB check.

   **Description / actual result:** UI shows Dr. Carlos Méndez; the earliest eligible DB record belongs to Dr. María Fernández. Inspected card shows September 1, already past on the run date.

   **How to reproduce:** Read patient appointments; select the earliest future active/pending record by date/time; open the dashboard.

   **Expected result:** Display the earliest future eligible appointment, or an empty state if none exists.

   **Impact:** Users can rely on the wrong doctor/date when planning their next visit.

   **Recommended action / limits:** Use patient-scoped eligible data and chronological ordering with agreed timezone/status rules. Doctor equality failed first; later date/time/status assertions were not reached.

   **Evidence / coverage:** [TC-UI-DASH-011](../test-cases/ui/dashboard.md).

10. **F-23 — Upcoming appointments counter stays at 3 when data changes**

   **Priority:** P2 · **Severity:** Medium · **Status:** Reproduced: 2026-09-13 controlled UI and real API/DB state checks.

   **Description / actual result:** Controlled expectations 0 and 2 both display 3. Real DB count changes 3 → 4 → 3, but Upcoming remains 3 after creation/reload.

   **How to reproduce:** Load an empty appointment response, then a response with two eligible appointments and reload. Separately create/delete a real marked future booking, checking DB and reloading after each change.

   **Expected result:** Recalculate the count from current eligible patient appointments after reload.

   **Impact:** The dashboard gives an incorrect summary and fails to acknowledge a newly booked visit.

   **Recommended action / limits:** Derive the counter from current appointment data. Completed changed 0 → 1 and Cancelled 0 → 2 in controlled tests; those counters are not demonstrated to be static. Background push updates and a hardcoded source implementation were not established.

   **Evidence / coverage:** [TC-UI-DASH-013/016](../test-cases/ui/dashboard.md).

11. **F-22 — No login throttling observed within ten failed attempts**

   **Priority:** P2 · **Severity:** Medium · **Status:** Bounded observation: 2026-09-13; enforcement policy unconfirmed.

   **Description / actual result:** All ten responses are 401; no 429 is observed.

   **How to reproduce:** Using the configured QA account and one deliberately invalid password, submit at most ten login requests and stop early on 429.

   **Expected result:** Apply an agreed failed-login protection policy. OpenAPI declares 429 but specifies no threshold or time window; ten is the test’s proposed bound.

   **Impact:** Repeated password attempts may be insufficiently restricted, but this sample does not prove unlimited attempts or a successful password compromise.

   **Recommended action / limits:** Confirm account/IP scope, threshold and recovery; test against that policy. Simulated 429 UI feedback already passes.

   **Evidence / coverage:** [TC-AUTH-RATE-001](../test-cases/api/rate-limit.md).

12. **F-04 — Booking accepts a doctor who is already inactive**

   **Priority:** P2 · **Severity:** Medium · **Status:** Reproduced: 2026-09-12 API/DB write run.

   **Description / actual result:** HTTP 201; appointment 1132 persists against the inactive doctor.

   **How to reproduce:** Select doctor 7 from the DB where is_active=false; submit an otherwise valid owned booking.

   **Expected result:** Reject new bookings for inactive doctors under the proposed business rule.

   **Impact:** Users can receive a booking with a doctor who is unavailable for new appointments.

   **Recommended action / limits:** Validate current doctor eligibility on create. Existing appointments for a doctor deactivated later are a separate policy question.

   **Evidence / coverage:** [TC-APT-013](../test-cases/api/appointments.md).

13. **F-15 — Appointment dates are timestamps instead of the declared date-only format**

   **Priority:** P2 · **Severity:** Medium · **Status:** Reproduced: 2026-09-13 consolidated API list/detail checks.

   **Description / actual result:** Values include UTC-midnight timestamps such as 2026-09-12T00:00:00.000Z rather than YYYY-MM-DD.

   **How to reproduce:** Read GET /api/appointments and an owned detail; compare raw appointment_date against the Appointment model.

   **Expected result:** Serialize the calendar date as YYYY-MM-DD. Detail has no operation response schema; applying the Appointment model there is suite policy.

   **Impact:** Strict consumers reject values; timezone interpretation may shift the displayed day. No actual UI shift was demonstrated.

   **Recommended action / limits:** Serialize date-only values or agree an intentional contract change. TC-APT-001/002 now use soft contract assertions and continue DB reconciliation; standalone TC-APT-003/004 were retired. These failures are not marked expected.

   **Evidence / coverage:** [Appointment cases](../test-cases/api/appointments.md).

14. **F-01 — Doctor list omits fees and active status returned by detail**

   **Priority:** P2 · **Severity:** Medium · **Status:** Reproduced: 2026-09-13 default run; suite completeness policy.

   **Description / actual result:** List items omit consultation_fee and is_active; detail supplies them.

   **How to reproduce:** Compare GET /api/doctors item fields with doctor detail and DB values.

   **Expected result:** Expose agreed list-consumer fields or document an explicit list-specific schema.

   **Impact:** Clients need extra detail requests for fees; field availability differs between list and detail.

   **Recommended action / limits:** Agree required list fields. These properties are optional in OpenAPI: this is a suite completeness-policy failure, not a literal schema violation. Active-only list filtering passes.

   **Evidence / coverage:** [Doctor cases](../test-cases/api/doctors.md).

15. **F-14 — Patient-specific responses use public cache directives**

   **Priority:** P3 · **Severity:** Low · **Status:** Reproduced: 2026-09-13 default run; no cross-user disclosure demonstrated.

   **Description / actual result:** Cache-Control is public, max-age=0, must-revalidate.

   **How to reproduce:** Read authenticated profile and appointment-list response headers.

   **Expected result:** Apply an agreed cache policy appropriate for patient-specific data and intermediaries.

   **Impact:** Headers warrant privacy review; a cross-user cache leak is not established. A 304 alone is normal revalidation.

   **Recommended action / limits:** Review private/no-store requirements and intermediary behavior. Historical BYPASS/ETag observations are not a substitute for a leakage test.

   **Evidence / coverage:** [Caching cases](../test-cases/api/caching.md).

16. **F-20 — Empty-signature tokens receive an undocumented plain-text 403**

   **Priority:** P3 · **Severity:** Low · **Status:** Reproduced: 2026-09-13 default run.

   **Description / actual result:** The edge responds 403 text/plain with x-vercel-mitigated: deny instead of the documented 401.

   **How to reproduce:** Remove the signature from a session token and request GET /api/users/me.

   **Expected result:** An agreed, documented auth refusal that clients can handle.

   **Impact:** Clients expecting JSON/401 may mishandle the response. Access is denied; this is not an authentication bypass.

   **Recommended action / limits:** Document the edge response or align it with the API response; independently verify unsigned-token rejection at the API. Other altered-token controls returned 401.

   **Evidence / coverage:** [Auth cases](../test-cases/api/auth.md).

## UI feedback and observations

These retain their IDs for traceability. They are not confirmed functional bugs and do not inflate the active bug list.

17. **F-13 — Oversized dashboard banner**

    **Priority:** P3 feedback · **Status:** measured again in the 2026-09-13 default run.

    **Description:** /images/dashboard.png is 6,442,770 bytes (6.14 MiB). The former 512,000-byte limit was a proposed budget, not an agreed acceptance criterion; its automated failure case was retired as requested.

    **Impact / suggestion:** unnecessary image transfer. Agree a budget, resize for rendered use and consider a compressed format. Historical dimensions and missing alt text were not remeasured. Do not present estimated transfer time as measured page-load time.

18. **F-19 — Reported availability load failure was not reproduced**

    **Priority:** no fix assigned · **Status:** tested path passes.

    Selecting doctors loads returned slots. Controlled different-doctor replacement/reset and failure/recovery checks also pass (TC-UI-BOOK-005/006, 2026-09-13). Occupied-slot filtering is the separate confirmed F-05 issue. Slow responses and stale-response races remain untested. [Booking cases](../test-cases/ui/booking.md).

19. **F-07 — Future-dated notification**

    **Priority:** clarification · **Status:** historical observation; fixture intent and original timestamp unknown.

    Stored created_at=2027-03-15 was future-dated relative to the observation. Confirm whether this was deliberate seed data before reporting an application clock defect.

20. **F-08 — Confirmed versus active status terminology**

    **Priority:** clarification · **Status:** no defect established.

    UI uses Confirmed; API uses active/pending/completed/cancelled. A user-facing mapping can be intentional. Current dashboard tests assume active → Confirmed and pending → Pending; obtain product agreement on labels.

21. **F-09 — Different decimal string formatting**

    **Priority:** no fix assigned · **Status:** numeric reconciliation passes.

    Values such as "120" and DB 120.00 are numerically equal. The contract models monetary amounts as strings. A display-format requirement must be agreed before this is a bug.

22. **F-10 — Notification isRead versus DB is_read**

    **Priority:** no fix assigned · **Status:** documented mapping; reconciliation passes.

    API camelCase and DB snake_case are intentional representations in the supplied contract. This is not a field mismatch defect.

23. **F-11 — Nonnumeric doctor identifier returns 404**

    **Priority:** clarification · **Status:** historical observation; not rerun.

    GET /doctors/abc reportedly returned 404. No agreed rule requires 400. Current not-found coverage uses an unused numeric ID; clarify invalid-path policy before assigning a bug.

## Latest verified controls and remaining gaps

Across all 85 automated cases, the latest recorded results are **64 passed, 4 expected failures, 16 failed and 1 skipped** ([per-case results](../test-cases/README.md#results-summary)). Every failure reproduces a finding above. The failure count is not the bug count: F-12 fails three cases, and F-15 and F-23 two each.

Completed and Cancelled counters update with controlled data after reload. Quick Actions, sidebar destinations, New Appointment, logout with Back/direct-route/reload checks, required fields, malformed email, availability failure/recovery, and simulated 429 feedback pass. DB connection/table access and write denial pass. The earlier point-in-time Upcoming match was insufficient: later change-based tests establish F-23.

Earlier API runs verified owned data reconciliation, token refusal and selected authorization controls; matching corrupted stored data does not establish a correct profile write. The old expected-failure handling of F-15 and automated image budget no longer describe the current suite.

Remaining gaps: concurrent duplicates; a second controlled user for broader authorization; expired tokens and server-side logout revocation; successful UI booking persistence; real cancellation/completion-driven counter changes; empty next-appointment branch; stale availability races and date/doctor controls; rate-limit threshold/recovery/scope; disposable profile reset; payment follow-on cases and attributable notification mutation. Background live updates and product timezone semantics are unconfirmed. Browser logout, bounded login attempts, and availability failure/recovery are completed checks, not wholly deferred work.
