# Postman: appointment rescheduling

Import `medappoint-reschedule.postman_collection.json` and `medappoint.postman_environment.json` into Postman.
Select the imported environment and fill in these three values locally:

| Variable | Value |
| --- | --- |
| `baseUrl` | `https://qa-challenge-backend.vercel.app` (pre-filled) |
| `username` | Your assigned account email |
| `password` | Your account password |

The frontend origin (`https://light-it-qa-challenge.vercel.app`) returns **405**
for `POST /api/auth/login`. Use the backend origin above. The collection adds
`/api/auth/login` itself; do not append `/api` to `baseUrl`.

Run the **entire collection** from the Collection Runner, with one iteration and
stop-on-failure disabled so cleanup can run. No token, doctor ID, appointment ID,
date or valid time slot needs to be pasted. The collection obtains or generates
them automatically. Login happens first and logout happens last.

Optional environment variables: `startDays` (default `7`), `searchDays` (default
`30`), and `invalidTime` (default `25:99`, deliberately invalid). Dates use UTC.
Keep `invalidTime` invalid if overriding it. The collection contains no account
credentials or hardcoded target URLs or record IDs.

## Coverage

- Login and authenticated patient identity.
- Existing appointments, doctor discovery, active doctor detail and slot catalog.
- Temporary appointment creation and discovery by unique run marker.
- Original detail, reschedule response, independent detail and list verification.
- Missing date, past date, invalid clock and missing token.
- A second temporary appointment to test an occupied doctor/date/time slot.
- Independent reads after rejected changes, including the conflict control.
- Ownership checks, deletion of both temporary appointments, and absence checks.
- Rescheduling a deleted numeric appointment ID, followed by another absence check.

There are **33 request definitions**. A full run sends **36 requests** because the
three-step cleanup sequence runs once for each temporary appointment.

One missing-field case represents required-input validation. Past dates, invalid
clocks, authentication, occupied slots and deleted IDs cover distinct failure
modes. The independent reads and ownership checks are retained because they
establish whether the operation actually changed state and whether cleanup is safe.

## Assertion policy and limitations

HTTP and response-field checks follow the supplied Swagger contract. Additional
field-completeness and before/after consistency checks verify usable responses.
Past-date, invalid-clock and conflict rejection are explicitly labeled proposed
business rules where Swagger does not define the policy. Missing-field cases
expect the documented `400`; missing authentication expects `401`.

One original-detail assertion checks the date-only contract strictly. The known
UTC-midnight timestamp format is normalized only for semantic comparisons elsewhere.
This preserves the finding without reporting it repeatedly. For invalid scheduling
requests, error-body checks run only if a rejection was returned; an unexpected
success is captured by the HTTP assertion and the subsequent state check.

The availability API supplies a slot catalog rather than a global calendar, and
appointment listing is patient-scoped. Candidate selection avoids this patient's
existing bookings but cannot guarantee another patient has not occupied the slot.
The collection requires no database connection or second account. Persistence is
verified through subsequent API reads.

Only appointments created with this run's unique marker are changed or deleted.
Failed prerequisites route to cleanup. A manual abort or network/authentication
failure can prevent cleanup; failed cleanup assertions must be investigated.

## Validation on 2026-09-13

- Imported and executed through Newman, the Postman collection runner.
- Controlled API: all 36 requests completed with zero failures and no residual
  appointments.
- Controlled prerequisite failure: remaining scenarios were bypassed, cleanup ran,
  and no appointments remained.
- Live challenge API, final collection: 36 requests, 111 assertions, 103 passed and 8 failed;
  **no script errors or request transport failures**. Rescheduling persisted,
  both temporary appointments were deleted, and logout completed.
- Live failures: one date-format assertion, one stale reschedule-response assertion,
  and six assertions for accepted past-date, invalid-clock and occupied-slot requests
  (the HTTP result and persisted API-visible change for each scenario).

The earlier export reported 36 failures, including 23 repetitions of the date-format
issue. The reduction reflects focused assertions and fewer overlapping scenarios,
not fixes to the application or relaxed rejection expectations.

## Focused finding: reschedule succeeds but returns the old date

**Priority: P2.** A client that renders the successful PUT response can display the
old appointment date even though the change has persisted. This is a stale response,
not a failed reschedule. A specific frontend impact was not tested here.

**Reproduction:** run requests 07-11. Create the marked appointment, read its
original detail, PUT a different generated future date, and GET its detail again.
The date/time returned by the PUT should match the submitted values and subsequent
GET. The collection checks identity separately to pinpoint the disagreement.

**Observed on 2026-09-13, temporary appointment 1186:**

| Evidence | `appointment_date` |
| --- | --- |
| Original GET | `2026-10-12T00:00:00.000Z` |
| Requested new calendar date, verified by request 11 | `2026-10-13` |
| PUT response (`200`, `success: true`) | `2026-10-12T00:00:00.000Z` |
| Subsequent GET (`200`) | `2026-10-13T00:00:00.000Z` |

The ID remained `1186` and the time slot remained `09:00`. The independent detail
and list checks passed, and cleanup deleted the temporary appointments. The date
disagreement remains after normalizing the UTC-midnight representation, so it is
separate from the date-format contract violation.

The final run reproduced the same behavior with temporary appointment `1188`:
the PUT returned September 24 while the requested and subsequently read date was
September 25, 2026. The separate identity assertion passed. Both temporary
appointments from that run were also deleted successfully.

**Suggested fix and regression check:** return the updated appointment after the
reschedule operation. Assert the PUT date/time matches the request and a fresh GET,
while preserving appointment identity, status and notes. No server implementation
was available to establish the internal cause.

The invalid scheduling cases also remain actionable: each returned `200` where the
proposed validation rule expects rejection, and the next GET confirmed a changed
appointment. Occupied-slot prevention is the highest operational risk because it
can leave two appointments assigned to one doctor at the same date and time.

Runner workflow reference:
[Postman documentation](https://learning.postman.com/docs/tests-and-scripts/running-collections/building-workflows).
