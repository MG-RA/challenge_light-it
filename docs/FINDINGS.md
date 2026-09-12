# Findings — MedAppoint

Updated 2026-09-11. Severity reflects potential impact; **evidence status** describes what was actually demonstrated. Fresh results come from the [execution record](EXECUTION.md). Historical observations below were already recorded before this cycle; their original observation timestamps were not captured and they were not all reproduced again.

The read-only cycle was followed by an isolated [state execution](STATE_EXECUTION.md). It created 14 owned appointments and removed all of them. One payment submission returned an ID without persistence and stopped further live scenarios. No profile or notification writes occurred; no residue was observed in the final independent check.

| ID | Severity | Area | Summary | Evidence status |
|---|---|---|---|---|
| F-01 | Medium | API completeness | Doctor list omits fee and active fields returned by detail | Reproduced 2026-09-11; additional suite policy |
| F-02 | High | Data integrity | Create accepts invalid clock value `25:99` | Controlled API/DB reproduction 2026-09-11 |
| F-03 | High | Booking data | Sequential creation accepts a duplicate doctor/date/slot | Controlled API/DB reproduction 2026-09-11; concurrency deferred |
| F-04 | Medium | Booking data | Create accepts a currently inactive doctor | Controlled API/DB reproduction 2026-09-11 |
| F-05 | Info | Availability | Slot list's date-specific meaning is unclear | Clarification needed; no root cause established |
| F-06 | High | Profile | Recorded profile save merged last name and notes into first name | Historical manual reproduction + DB corroboration; not rerun |
| F-07 | Info | Data plausibility | Notification timestamp was future-dated | Historical observation; fixture intent unknown |
| F-08 | Info | UI terminology | “Confirmed” differs from API enum vocabulary | Mapping clarification, not a proven defect |
| F-09 | Info | Serialization | Equivalent numeric strings use different decimal formatting | Consistency observation; numeric comparisons now pass |
| F-10 | Info | Serialization | Notification API uses `isRead`; DB uses `is_read` | Documented mapping; current reconciliation passes |
| F-11 | Info | Validation | Nonnumeric doctor identifier returned 404 | Historical observation; no agreed 400 requirement |
| F-12 | High | Booking | Create accepts yesterday and year 0123 | Controlled API/DB reproduction 2026-09-11 |
| F-13 | Medium | Performance | Dashboard PNG body is 6.14 MiB | Reproduced 2026-09-11 |
| F-14 | Low | HTTP/privacy | Profile and appointment responses use public cache directives | Reproduced 2026-09-11; no cross-user disclosure demonstrated |
| F-15 | Medium | Contract | Appointment date is serialized as timestamp, contrary to `format: date` | Newly reproduced 2026-09-11 on list and detail |
| F-16 | High | Cancellation | HTTP 200 leaves owned appointment active | Controlled API/DB reproduction 2026-09-11 |
| F-17 | High | Rescheduling | Invalid date/time accepted and persisted | Controlled API/DB reproduction 2026-09-11 |
| F-18 | High | Payments | HTTP 200 returns payment ID with no persisted row | Controlled API/DB reproduction 2026-09-11; safety stop |
| F-19 | Info | Booking UI | Reported availability does not load | Not reproduced: selected-doctor GET and displayed slots passed |

## Reproduced in this cycle

### F-01 — Doctor list omits useful fields

- **Reproduction:** authenticate, call `GET /api/doctors`, compare item keys with `GET /api/doctors/{id}`.
- **Observed:** six list records contain `id, first_name, last_name, specialty, bio, avatar_url`; `is_active` and `consultation_fee` are absent. Detail returns these fields.
- **Oracle distinction:** these properties are declared in the snapshot but **not required**. The response passes literal OpenAPI validation. It fails the suite's separately named field-completeness policy.
- **Impact:** clients need detail requests to obtain fees; list/detail completeness is inconsistent. The list's active-only filtering itself matched the DB.
- **Suggestion:** agree which fields list consumers need; add them to the list and/or publish a separate list-item schema with explicit required properties.
- **Automation:** [doctors tests](../tests/api/doctors.spec.ts), one guarded completeness expectation. Wrong types, non-200 responses, and unrelated missing fields fail before the expected-failure marker.

### F-13 — Oversized dashboard banner

- **Reproduction:** open the authenticated dashboard; inspect the loaded image response.
- **Current evidence:** `/images/dashboard.png` is **6,442,770 bytes**, exceeding the suite's proposed **512,000-byte** per-image budget.
- **Historical layout evidence:** 2764×1236 source displayed at approximately 974×160 in a 1280×720 viewport; no alt attribute was observed. These dimensions/alt details were not independently remeasured this cycle.
- **Impact:** unnecessary transfer cost. Approximately 5.2 seconds at 10 Mbps is an idealized transfer-time estimate, **not a measured page-load result**.
- **Suggestion:** agree a performance budget, resize for rendered use, consider WebP/AVIF, and use appropriate asset caching. Give decorative imagery an empty alt attribute.
- **Automation:** [dashboard tests](../tests/ui/dashboard.spec.ts). Image load/response checks and other image budgets must pass before only the banner budget assertion is marked expected.

### F-14 — Per-user API responses marked public

- **Reproduction:** authenticate, then read `GET /api/users/me` and `GET /api/appointments`.
- **Current evidence:** both responses return `Cache-Control: public, max-age=0, must-revalidate`.
- **Historical observation:** weak ETag, `Vary: Origin`, conditional request returning 304, and `x-vercel-cache: BYPASS`. Those conditional/CDN details were not rechecked this cycle.
- **Impact:** public cache directives are inappropriate for per-user data without carefully verified shared-cache behavior. This finding demonstrates headers, **not an actual cross-user cache leak**. A 304 alone is normal revalidation behavior.
- **Suggestion:** use a private/no-store policy for sensitive patient responses and verify any relevant intermediaries.
- **Automation:** [caching tests](../tests/api/caching.spec.ts), separate cases for each endpoint. Successful status and body validation precede the marker; a different unsafe header is unexpected. Appointment body validation uses the explicit F-15 compatibility path.

### F-15 — Appointment date violates the date-only contract

- **Found:** new automated read coverage on 2026-09-11.
- **Reproduction:** authenticate; read `GET /api/appointments`, then `GET /api/appointments/{owned-id}` using an ID discovered from the tester's records.
- **Expected:** `Appointment.appointment_date` has OpenAPI `type: string, format: date`, for example `2026-09-12`.
- **Actual:** list entries use values such as `2026-09-12T00:00:00.000Z`; owned detail uses the same timestamp representation. All eight list items in the observed account had the mismatch. Responses were 200.
- **Stored value:** Postgres column type is `date`. After extracting the calendar date from the exact observed midnight representation, list and detail values matched owned DB records.
- **Impact:** strict date consumers reject the response; consumers that interpret it as a local timestamp may show a different calendar day. No actual UI date shift was established in this cycle.
- **Suggestion:** serialize the stored calendar date as `YYYY-MM-DD`. If timestamps are intentional, revise the contract and confirm consumer timezone semantics instead.
- **Automation:** [appointment tests](../tests/api/appointments.spec.ts) contain separate list/detail contract expectations. [The compatibility helper](../tests/api/appointmentResponse.ts) permits only exact UTC-midnight timestamps for independent DB/header tests, validates calendar dates and all other fields, and leaves the published schema unchanged. The removed local guard tests, which rejected non-midnight timestamps, offsets, impossible dates, and unrelated type errors, are not part of the two-surface suite.
- **Classification:** both new contract cases first validate status, shape, required data, and ownership, then mark only the known date-format assertion as expected. This does not hide arbitrary appointment failures.

## Historical findings and clarification requests

### F-02 — Invalid time persisted

Previous query `select distinct time_slot from appointments` included `25:99` (one row). This is evidence of an invalid stored clock value, not proof that today's create endpoint accepts it. The previously observed valid catalog ran from 09:00 to 15:30.

**Current write evidence:** POST returned 201 and appointment 1110 persisted `25:99`. The owned, marked row was deleted. Rejection is a proposed business expectation (400 or 409), independent of the historical stored-data observation. See [state evidence](STATE_EXECUTION.md).

### F-03 — Duplicate booking records

Previous grouping of non-cancelled appointments by doctor/date/time found duplicate groups, including **doctor 1, 2026-11-04 09:30, eight active records**. The tester's seeded appointment 1072 was noted “Double booked appointment.”

**Interpretation:** stored duplicates are a data-integrity observation. Seeded data or earlier behavior may explain them; they do not alone prove current concurrent or sequential create behavior.

**Current write evidence:** two sequential requests created appointments 1112 and 1113 for doctor 1 / 2026-09-21 / 09:00. The second returned 201; both rows persisted and were deleted. Duplicate rejection is a proposed business expectation. Concurrent requests remain deferred; availability presentation alone cannot guarantee write integrity.

### F-04 — Appointments with an inactive doctor

Previous data showed doctor 7 (`is_active = false`) referenced by active appointment IDs 1, 9, and 198.

**Interpretation:** the doctor may have been deactivated after booking. Booking-time validation failure and handling of later deactivation are different questions.

**Current write evidence:** doctor 7 was selected from `not is_active`; POST returned 201 and appointment 1111 persisted against that doctor. The row was deleted. Rejection is a proposed business expectation; handling later deactivation remains a separate clarification.

### F-05 — Availability semantics unclear

Previous `GET /doctors/1/availability` returned a full slot list despite stored bookings. The snapshot exposes **no date parameter**, so it may be a reusable slot catalog rather than vacancy for a specific day.

**Clarification:** define date and timezone semantics and which layer resolves occupied slots. Do not call this the root cause of F-03 without application implementation or controlled write evidence. Current automation verifies shape, clock strings, and uniqueness only.

### F-06 — Profile save corrupts names

The earlier manual profile-form test was corroborated with an API call and stored data:

```bash
curl -X PUT "$API/api/users/me" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"first_name":"Proud","last_name":"Phoenix","notes":"test"}'
# Recorded response: 200, first_name "Proud Phoenix test", last_name "", notes "test".
```

These names were the tester's assigned alias, **not reusable values for another candidate**. Saving the resulting empty last name again was recorded as `400 {"error":"last_name is required"}`.

Previous DB inspection found two users with empty last names whose notes were appended to first names, including the tester's account. This supports the recorded reproduction; it does not establish that every possible profile save behaves identically.

**Impact:** the recorded save corrupted display names, exposed notes in name fields, and made a subsequent save fail validation. API-vs-DB reads alone can agree on this corrupt state.

**Automation status:** the unsafe live round-trip and guessed-name fixture were removed, and no profile write case exists. Another save can corrupt restoration too; automation stays disabled until a disposable account or reliable reset exists. See [write testing](WRITE_TESTING.md).

**Specification clarification:** `PUT /users/me` explicitly documents 403 when first/last names differ from the candidate's assigned alias. That 403 is not itself a bug or an unanswered requirement.

### F-07 — Future notification timestamp

Previous DB inspection found `created_at = 2027-03-15`, in the future relative to that observation. The original observation timestamp and fixture intent were not recorded.

**Status:** data-plausibility observation. Confirm whether future dates are deliberately seeded; do not infer a clock bug from a single fixture value.

### F-08 — UI status vocabulary

The dashboard previously rendered “Confirmed”; API enum values are `active | pending | completed | cancelled`.

**Status:** terminology/mapping clarification. A human-readable label for `active` can be intentional. Establish the mapping before classifying a defect.

### F-09 / F-10 — Decimal formatting and field naming

Historical observations: payment `amount` was `"60"` versus DB `60.00`; fee formatting also differed. Current doctor detail returned `"120"` for a stored `120.00`, and numeric reconciliation passed. The supplied schemas intentionally model monetary values as strings.

Notifications expose the documented field `isRead`; the DB uses `is_read`. Current explicit mapping and ownership reconciliation passed.

**Status:** design consistency observations, not demonstrated contract violations. Historical SPA submission of `doctor_id: "1"` rather than integer 1 is a separate request-coercion observation, not retested here.

### F-11 — Nonnumeric doctor ID returns 404

Previously recorded: `GET /doctors/abc` returned 404. No agreed requirement establishes that 400 is mandatory. Current automation tests an unused numeric ID; the nonnumeric case was not rerun.

### F-12 — Past booking date accepted

Earlier manual exploration recorded a successful booking with `appointment_date: "2025-12-11"`. Previous DB queries found five active appointments dated before their creation day, including ID 1087 dated `0123-11-23`.

**Interpretation:** preserve the recorded manual success as historical write-path evidence. Registration/creation timestamps alone do not establish whether other rows were seeded or user-created.

**Current write evidence:** HTTP 201 created appointment 1108 dated `2026-09-10` (yesterday at execution), and 1109 dated `0123-11-23`. Both persisted and were deleted. The two legacy drafts were replaced by the [`@mutating` appointment cases](../tests/api/appointments.spec.ts). Past-date rejection is a proposed business expectation, not an invented precise status requirement.

## New state and UI investigations

### F-16 — Cancellation reports success without persisting cancellation

Owned appointment 1105 was `active` before PUT cancel. The endpoint returned 200, but bounded DB polling never observed `cancelled`; it remained `active`. The unrelated owned control assertion was not reached after this failure. Both 1105 and control 1106 were deleted successfully. Verify the write is committed before returning success; add this scenario to application regression coverage. No backend root cause is established.

### F-17 — Invalid reschedule changes persisted state

Owned appointment 1114 began at `2026-09-28 / 09:00`. Rescheduling to `2026-09-10 / 25:99` returned 200 and persisted both invalid values. The row was deleted. The proposed business expectation is rejection (400 or 409) with the full row unchanged. Validate rescheduling with the same agreed date/time rules as creation.

### F-18 — Payment reports an ID without persistence

Appointment 1115 had no linked payments before submission. A cash payment using the doctor's stored fee (120) returned HTTP 200 and ID `999`, while bounded DB reconciliation found no new linked payment. This triggered the safety stop; zero/negative/duplicate probes were not sent. Appointment 1115 was deleted. A subsequent independent DB check also found no payment ID 999 or linked payment. Verify successful payment responses identify a committed record; no provider, transaction, or mock implementation root cause is established.

### F-19 — Reported booking availability load issue not reproduced

The user reported that booking did not load availability from the endpoint. Read-only browser inspection and a new [UI regression](../tests/ui/booking.spec.ts) observed GET `/api/doctors/{id}/availability` returning 200 after doctor selection. Selecting two active doctors populated time options matching each response's `time_slots`. The inspected doctor returned ten slots. API writes were blocked during exploration; no booking was submitted.

This does not reproduce the reported symptom on the checked path. It does not establish date-specific vacancy, recovery from failed requests, slow-network behavior, or every doctor/date combination. Keep F-05's catalog-versus-vacancy clarification separate. Next targeted checks are failed-response feedback and doctor switching with distinguishable controlled responses.

All live state signatures above remain ordinary failed tests, not expected failures. See [state execution](STATE_EXECUTION.md) for timestamps, before/action/after evidence, and cleanup verification.

## Positive controls: current versus historical

**Passed this cycle:**

- Missing and malformed tokens rejected with 401 on all eight protected GET operations.
- Authenticated profile identity and selected fields agree with the DB; no top-level `password_hash` on that response.
- Doctor list matches active DB records; detail fields and numeric fee agree.
- Owned appointment list/detail agree with DB after the explicit F-15 date conversion.
- Payment and notification IDs/fields match the authenticated account's DB records.
- Invalid UI login gets a 401 response and visible feedback; valid login works; unauthenticated dashboard redirects.
- Sidebar links open the correct URL and page heading; returning to Dashboard works.
- DB table access works; the zero-row UPDATE is denied.
- Isolated create, valid reschedule, delete/detail-404, and missing-doctor rejection matched API/DB expectations.
- Booking doctor selection loaded availability and displayed the returned time options; no submission occurred in that UI check.

**Historical only, not reverified here:** one cross-user appointment GET returned 403; bcrypt password hashes were observed in storage; arbitrary-origin CORS access was not echoed; JWT lifetime was 24 hours. These do not establish complete authorization, CORS, or token-security coverage.

## Deferred verification

Use two controlled accounts and disposable owned records for future authorization checks. Do not mutate arbitrary seeded records belonging to other users.

Booking lifecycle and validation cases are implemented and executed, with failures above. Payment zero/negative/duplicate steps and attributable notification read are implemented but blocked by the payment safety stop; paid-record cleanup is only locally verified. Live profile round trip requires disposable-account/reset access. Concurrent booking, second-user authorization, expired tokens, logout semantics, bounded rate-limit checks, and availability failure/recovery UI coverage remain follow-ups.
