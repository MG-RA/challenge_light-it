# API test-case design

Designed 2026-09-12 from [openapi.json](openapi.json), Medical Appointment System API 1.0.0. Contains **77 case groups covering all 17 operations**; parameterized variants expand into individual tests. This is a design catalog, not a new execution report or an executable suite. Existing automation is mapped below; new cases remain planned. No remote requests were made to produce this document.

## How to use the cases

Each row supplies a stable ID, priority, input/action, and expected result. Expand comma-separated variants into independent tests (for example, remove one required field per test). Use the shared prerequisites and assertion rules below with every row.

- **P0:** patient isolation, booking/payment integrity. **P1:** core behavior and contract validation. **P2:** boundaries and secondary behavior.
- **C — Contract:** explicitly specified status, schema, security requirement, or endpoint description.
- **P — Suite policy:** stronger checks such as field completeness, DB persistence, no sensitive fields, and no mutation after rejection.
- **Q — Clarification:** proposed behavior or unspecified response code; agree the acceptance rule before treating the case as a release gate. A Q does not weaken an accompanying C assertion.
- **R:** read operation; **W:** potentially changes state, including negative write requests; **S:** isolated session or rate-limit environment needed. Login is also rate-limited, including successful setup.

For schema-invalid requests with no documented validation response, assert the request violates the contract, but keep the server's exact rejection status **TBD**. Do not invent a documented 400/422. Where a code is documented for a particular condition, assert it exactly.

## Data and execution prerequisites

| Fixture | Definition and setup |
|---|---|
| User A | Configured test account with valid credentials and bearer token; correlate identity with the read-only DB. Never put credentials/tokens in cases or committed reports. |
| User B | Separately controlled account and token with known B-owned appointments/notifications/payments. Required for cross-user cases; not currently available in the documented suite. |
| Doctor D | Discover an active doctor and its current fee; discover a separate inactive doctor for negative cases. Do not hard-code seeded IDs. |
| Missing ID | Valid integer confirmed absent from the corresponding table immediately before the request. |
| Appointment A1 | Fresh A-owned appointment with unique run marker in notes; active doctor, valid future date, API-listed slot checked for vacancy in DB. Create a separate owned control A2. |
| Valid create body | `{"doctor_id": <D.id>, "appointment_date": "<future YYYY-MM-DD>", "time_slot": "<available slot>", "notes": "<run marker>"}`. Angle brackets denote substitutions, not literal payload values. |
| Valid reschedule body | `{"appointment_date": "<different future YYYY-MM-DD>", "time_slot": "<available slot>"}` for the same doctor. |
| Valid payment body | `{"appointment_id": <A1.id>, "amount": <numeric fee>, "method": "cash"}`; use a dedicated payment-purpose appointment. |
| Notification N1 | New A-owned unread notification unambiguously attributable to the run; retain unrelated notification snapshots as controls. |
| Profile data | Known candidate-assigned first/last names and exact before-state. Live writes require a disposable account or reliable reset because F-06 prevents dependable restoration. |

For R cases, use existing read-only fixtures. For W cases, follow [write testing](WRITE_TESTING.md): one worker, no retries, owned marked data, bounded DB verification, and verified teardown. Preserve current caps of 20 booking submissions and four payments on one appointment; run expanded variants in separately scoped runs rather than increasing caps implicitly. Never use real payment-provider credentials for method coverage.

Capture before-state, send one request, check status and applicable response contract, verify after-state via API and read-only DB, then clean up owned records and verify cleanup. Rejected writes must leave target and control records unchanged (P). Never delete B's baseline fixtures during A's authorization tests. Payments/notifications can leave residue; use the existing residue rules. Explicitly report missing prerequisites as blocked/skipped, never passed. Rate-limit and concurrent cases require a controlled environment with bounded request counts; no load test against the shared target.

## Shared response and security cases

| ID | Priority / basis / mode | Action and variants | Expected result |
|---|---|---|---|
| API-CON-01 | P1 / C / R,W | Apply to every response with a declared JSON schema. | Exact documented status; JSON media type; validate the operation's actual response schema, resolving component references. Preserve optional properties and allowed extras. |
| API-CON-02 | P1 / C,P / R,W | Validate present properties: integers, booleans, email, date/date-time, enums, arrays, and nullable fields. | Types/formats/enums follow the snapshot (C). Separately assert listed fields present under completeness policy (P); report these failures separately. |
| API-CON-03 | P1 / C,Q / R,W | Inspect responses with only a description and no body schema, including errors. | Assert documented status (C); do not require JSON, an empty body, or `{error: ...}`. Error-envelope/media-type agreement remains Q. The `Error` component is not referenced by any operation. |
| API-SEC-01 | P0 / C,P,Q / R,W | For **all 16 protected operations**, send no bearer token and a malformed token, using otherwise-valid payloads and existing IDs. | Access denied (C); exact 401 is documented only for GET `/api/users/me`, proposed elsewhere (Q). No patient data disclosed or state changed (P). Existing automation uses 401 for protected GETs. |
| API-SEC-02 | P0 / C,P,Q / R,W,S | Repeat all protected operations with expired and signature-tampered tokens. Use controlled tokens, not guessed secrets. | Access denied (C), no state change/disclosure (P); exact code Q except profile GET 401. Expiry setup needs controlled session/token support. |
| API-SEC-03 | P0 / C,P / R | With distinct A/B sessions, call user profile and each user's appointment/payment/notification lists. | Each response belongs to its authenticated user; payments link only to that user's appointments. Compare controlled records and DB, not just nonempty results. |
| API-SEC-04 | P1 / P / R | Inspect profile, appointment, payment, notification responses and diagnostics. | No password/hash or token leakage; user-specific responses cannot be reused by shared caches. Existing cache tests cover profile and appointment lists only; F-14. |
| API-VAL-01 | P1 / C,P,Q / W,S | On each body-bearing operation, send absent body, `{}`, omit each required field separately, then explicit null/wrong types. | Required/type rules follow each request schema (C). Use endpoint-specific documented statuses below; otherwise rejection code Q. No partial write (P). Login variants use bounded attempts. |
| API-VAL-02 | P2 / C,P,Q / R,W | On each `{id}` route, try `abc`, `1.5`, `0`, `-1`, and a large representable integer independently. | `abc`/fractional IDs violate integer schema; rejection code Q. Zero/negative/large integers have no documented bounds: resolve missing-resource behavior without inventing a positive-ID constraint. No 500 or unintended mutation (P). |
| API-VAL-03 | P2 / P,Q / W | Individually add `patient_id`, `user_id`, `id`, or `status` to applicable create/update bodies using controlled records. | Cannot override ownership/identity through extra fields (P); reject vs ignore is Q. Extra properties are not forbidden by the snapshot. |

## Authentication

### POST /api/auth/login

Security override: public (`security: []`). Required body fields: string `email` with email format and string `password`.

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-AUTH-01 | P1 / C,P / S | Valid A credentials, no Authorization header; then use returned token on GET `/api/users/me`. | 200; JSON object with string token if present (C). Require nonempty usable token and profile identity A (P). |
| API-AUTH-02 | P1 / C / S | Known email with wrong password; separately unknown email with a password. | 401 for invalid credentials; no error body schema is declared. |
| API-AUTH-03 | P1 / C,Q / S | Omit email/password separately; invalid email format; numeric/null values. | Contract-invalid input; validation response code unspecified. Do not assume these all return the invalid-credentials 401. |
| API-AUTH-04 | P2 / Q / S | Empty password, whitespace email, email case variants. | Establish normalization/empty-value behavior. No `minLength` or case-normalization rule is supplied. |
| API-AUTH-05 | P1 / C,Q / S | In isolated environment, reach an agreed rate-limit threshold with an agreed request cap; wait the configured window and retry valid login. | 429 when limited (C); threshold, scope, recovery timing, `Retry-After`, and response body require agreement (Q). Do not infer values from the snapshot. |

### POST /api/auth/logout

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-AUTH-06 | P1 / C / S | Log out a dedicated authenticated session. | 200; no request or response body schema declared. Do not log out the shared test session. |
| API-AUTH-07 | P1 / Q / S | After logout, reuse that token on profile GET; test a separate A session and repeat logout. | Determine token invalidation, scope, and repeated-logout behavior. The snapshot does not promise server-side revocation or specify repeat status. |

## Users

### GET /api/users/me

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-USR-01 | P1 / C,P / R | Fetch profile with A token. | 200 + `User`; identity/email/names match A's stored data; no password hash (P). |
| API-USR-02 | P2 / C / R | With controlled profiles, cover null and string phone/notes and valid created timestamp. | Present `phone`/`notes` accept null or string; present `created_at` is date-time. Missing fields are allowed by literal schema. |
| API-USR-03 | P0 / C / R | Fetch profile with no valid authentication. | 401. Cross-reference SEC-01/02 for token variants. |

### PUT /api/users/me

Required: `first_name`, `last_name`; optional: `notes`; all strings, none nullable in this request.

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-USR-04 | P1 / C,P / W | Send exact assigned names and unique notes; GET/DB-read afterwards. | 200 + `User` (C); names and notes persist independently, identity/email unchanged (P). Restore and verify exact original data; currently blocked live by F-06. |
| API-USR-05 | P1 / C,P / W | Omit first name; separately last name; null or numeric names/notes. | 400 validation error; no profile changes (P). |
| API-USR-06 | P1 / C,P / W | Change first name only, last name only, then both to values different from assigned alias. | 403 for alias mismatch; before-state unchanged (P). |
| API-USR-07 | P2 / C,P,Q / W | Keep assigned names; omit notes, then separately send empty-string notes. | Both bodies are schema-valid (C). Clarify whether omission preserves notes and empty string clears them (Q); never merge notes into a name (P). |

## Doctors

### GET /api/doctors

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-DOC-01 | P1 / C,P / R | List doctors; compare with active DB rows. | 200 + `Doctor[]`; lists active doctors (C); exact active ID set and selected values agree with DB (P). |
| API-DOC-02 | P1 / P / R | Inspect each list entry for every listed Doctor field. | Completeness policy requires `is_active` and `consultation_fee` as well as other listed fields. Known F-01; omissions alone do not violate literal schema. |
| API-DOC-03 | P2 / C / R | Controlled dataset with no active doctors. | 200 with `[]`; schema has no minimum array length. No direct DB changes to prepare this on the shared target. |

### GET /api/doctors/{id}

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-DOC-04 | P1 / C,P / R | Fetch D by existing ID. | 200 + `Doctor`; selected data matches DB; decimal fee string compared numerically under suite policy. String type is required if present; exact decimal precision is not specified. |
| API-DOC-05 | P1 / C / R | Fetch a confirmed missing integer ID. | 404; no response schema declared. |
| API-DOC-06 | P2 / Q / R | Fetch an existing inactive doctor. | Establish whether detail remains accessible. The active-only rule is stated for the list, not detail. |

### GET /api/doctors/{id}/availability

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-DOC-07 | P1 / C,P / R | Fetch D's availability. | 200 + object; `time_slots`, if present, is string array (C). Require field, valid `HH:mm` clocks, uniqueness (P); examples are not an exhaustive slot catalog. |
| API-DOC-08 | P1 / C / R | Fetch availability for a confirmed missing ID. | 404; no response body assertion. |
| API-DOC-09 | P2 / C,Q / R | Controlled doctor with no slots; compare different doctors' catalogs. | Empty array is schema-valid (C). Date-specific vacancy and inactive-doctor behavior require clarification (Q). No date query parameter is documented. |

## Appointments

### GET /api/appointments

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-APT-01 | P0 / C,P / R | List A's appointments with controlled A/B data. | 200 + `Appointment[]`; only A records, exact owned ID set and selected fields match DB (P). |
| API-APT-02 | P1 / C / R | Inspect raw nonempty response dates and statuses. | `appointment_date` is date-only, not a timestamp; status, if present, is active/pending/completed/cancelled. Keep raw F-15 contract failure separate from compatibility comparisons. |
| API-APT-03 | P2 / C / R | Use account with no appointments. | 200 + `[]`. |

### POST /api/appointments

Required: integer `doctor_id`, date string `appointment_date`, string `time_slot`; optional string `notes`.

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-APT-04 | P0 / C,P / W | Submit valid create body; identify new record by run marker and read detail/list/DB. | 201 (C), exactly one owned row with submitted values and allowed status (P). Create response has **no schema**; do not require a returned ID/object as a contract assertion. |
| API-APT-05 | P1 / C,P / W | Omit doctor, date, slot separately. | 400 missing required fields; no new marked row (P). |
| API-APT-06 | P1 / C,P,Q / W | Numeric-string/fractional doctor ID, null slot, timestamp instead of date, impossible date `2028-02-30`; separate requests. | Schema-invalid; exact rejection code Q; no stored row (P). |
| API-APT-07 | P1 / Q / W | Yesterday, year `0123`, today, valid future leap day; compute dates using agreed business timezone. | Decide past/same-day rules and booking horizon. Date validity alone does not prohibit past dates. Existing past-date proposals expose F-12. |
| API-APT-08 | P1 / Q / W | `25:99`, empty slot, and valid clock absent from catalog independently. | Proposed rejection with no persistence; status/rule needs agreement. `time_slot` is unconstrained string, not a regex or enum. F-02 concerns business validation. |
| API-APT-09 | P1 / P,Q / W | Existing inactive doctor; separately nonexistent doctor. | Proposed rejection with no row or dangling relation; exact response codes and inactive-doctor rule unspecified. F-04. |
| API-APT-10 | P0 / P,Q / W | Create one booking, then submit same doctor/date/slot again with separate marker. | Proposed at most one booking, second rejected, original unchanged. Conflict rule/code Q; existing 400/409 policy is not a documented status. F-03. |
| API-APT-11 | P0 / P,Q / W | In isolated fixture, submit two simultaneous requests for one free doctor/date/slot with distinct markers. | Proposed exactly one persisted booking; loser rejects with agreed code; verify both responses and DB count. Separate from sequential duplication. |
| API-APT-12 | P2 / C,P,Q / W | Omit notes; separately send empty notes or bounded Unicode text. | Schema-valid inputs (C); provided text round-trips without corruption (P); omitted-note default is unspecified (Q). |

### GET /api/appointments/{id}

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-APT-13 | P0 / C,P / R | Fetch A-owned appointment with A token. | 200 (C); identity, ownership, values match DB and `Appointment` shape (P). This operation does **not** reference a response schema; detail schema/date checks are stronger suite policy here. |
| API-APT-14 | P0 / C,P / R | A fetches a known B-owned appointment. | 403 (C), no B data in body (P). Do not substitute 404 for the documented 403. |
| API-APT-15 | P1 / C / R | Fetch confirmed missing integer appointment ID. | 404. |

### PUT /api/appointments/{id}/cancel

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-APT-16 | P0 / C,P / W | Cancel active A1; read target and control A2. | 200 + object with optional boolean `success` and string `status` (C). Require `success: true`, `status: "cancelled"`, persisted cancellation, unchanged A2 (P). `status` has no response enum here. F-16. |
| API-APT-17 | P0 / P,Q / W | A cancels known B-owned appointment. | No foreign change or disclosure (P); rejection code Q because this route documents only 200. |
| API-APT-18 | P2 / P,Q / W | Repeat cancellation; separately cancel missing or completed appointment. | Clarify idempotence, not-found response, and allowed lifecycle transitions; assert no unrelated record changes. |

### PUT /api/appointments/{id}/reschedule

Required: date string `appointment_date`, string `time_slot`.

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-APT-19 | P0 / C,P / W | Move A1 to another valid future date/slot. | 200 + object with optional boolean `success` and `Appointment` object (C). Require true success and matching returned/persisted appointment; preserve ID, owner, doctor, notes, and control A2 (P). |
| API-APT-20 | P1 / C,P / W | Omit date; separately omit slot. | 400; complete original row unchanged (P). |
| API-APT-21 | P0 / C,P / W | A reschedules known B-owned appointment using valid body. | 403; B row unchanged and no data disclosure (P). |
| API-APT-22 | P1 / C,P,Q / W | Timestamp/impossible date/null slot (C-invalid); separately yesterday/`25:99` (Q business rules). | Reject without partial update (P); exact code beyond missing fields unspecified. Keep invalid date and invalid slot separate to identify cause. F-17 existing automation combines both. |
| API-APT-23 | P0 / P,Q / W | Reschedule A1 into A2's occupied slot. | Proposed conflict rejection with both rows unchanged; conflict status/rule requires agreement. |
| API-APT-24 | P2 / P,Q / W | Reschedule to same values, missing ID, cancelled appointment, completed appointment independently. | Clarify no-op/idempotence, missing-resource response, and lifecycle rules; no unrelated changes. |

### DELETE /api/appointments/{id}

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-APT-25 | P0 / C,P / W | Delete fresh unpaid A1; GET and DB-read afterwards. | 200 (C); target absent, detail 404, list excludes it, A2 unchanged (P). No deletion response body schema declared. |
| API-APT-26 | P0 / C,P / W | A deletes known B-owned appointment. | 403; B record unchanged (P). |
| API-APT-27 | P2 / P,Q / W | Delete nonexistent/already deleted ID; separately a payment-bearing owned appointment. | Agree missing/repeat status and paid-record deletion/cascade/retention policy; no unrelated loss or dangling payments (P). Use controlled reset/residue plan. |

## Payments

### GET /api/payments

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-PAY-01 | P0 / C,P / R | List with A token against controlled A/B payment records. | 200 + `Payment[]`; only payments associated with A appointments; IDs and stored values match DB (P). |
| API-PAY-02 | P1 / C,P / R | Controlled rows cover each method/status and null/non-null `paid_at`. | Present method is cash/card/insurance; status pending/paid/refunded; amount string; paid_at null or date-time (C). Numeric amount equivalence is P; decimal scale and relationship between status/paid_at are not specified. |
| API-PAY-03 | P2 / C / R | A has no payments. | 200 + `[]`. |

### POST /api/payments

Required: integer `appointment_id`, number `amount`, string enum `method`. Request amount is a **number**; list response amount is a **string**.

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-PAY-04 | P0 / C,P / W | Valid payment on dedicated A1, independently for cash/card/insurance across scoped runs. | 200 + object with optional boolean `success`, integer `payment_id` (C). Require true success and real returned ID; exactly one matching DB/list payment, correct amount/method/appointment, unchanged prior rows (P). F-18 blocks expansion until persistence is understood. |
| API-PAY-05 | P1 / C,P / W | Invalid method `wire`; separately wrong-case `CASH`. | 400 invalid payment method; no added payment or appointment change (P). |
| API-PAY-06 | P1 / C,P,Q / W | Omit each required field; string amount `"120.00"`, fractional appointment ID, null amount/method. | Schema-invalid; missing/type validation status unspecified (only invalid method explicitly has 400). No new row or partial write (P). |
| API-PAY-07 | P0 / P,Q / W | Zero, negative, below-fee, above-fee, fractional amount, agreed maximum boundary independently. | Establish positive amount, currency/precision, under/overpayment and limit rules. Snapshot supplies no minimum/maximum/currency. Proposed zero/negative rejection exists but was not executed after F-18. |
| API-PAY-08 | P0 / P,Q / W | Register same payment twice on dedicated A1. | Establish duplicate/partial-payment rules; proposed second-payment rejection and no extra row. No idempotency key is documented. |
| API-PAY-09 | P0 / P,Q / W | A pays known B-owned appointment; separately missing appointment. | No unauthorized or dangling payment (P); exact rejection codes not documented (Q). |
| API-PAY-10 | P1 / P,Q / W | Pay cancelled/completed appointment independently. | Agree lifecycle eligibility and status; verify amount, ownership, and related state remain consistent. Do not infer rules from enum values. |

## Notifications

### GET /api/notifications

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-NOT-01 | P0 / C,P / R | List A notifications against controlled A/B data. | 200 + `Notification[]`; only A records and exact owned IDs/values match DB (P). |
| API-NOT-02 | P1 / C,P / R | Inspect unread/read rows. | Present `isRead` is camelCase boolean (C); require it and match DB `is_read` (P). Extra `is_read` field alone is not prohibited, but cannot replace required-by-policy `isRead`. |
| API-NOT-03 | P2 / C / R | A has no notifications. | 200 + `[]`. Future timestamps alone are not prohibited by the schema. |

### PUT /api/notifications/{id}/read

| ID | Priority / basis / mode | Input / steps | Expected result |
|---|---|---|---|
| API-NOT-04 | P1 / C,P / W | Mark attributable unread N1 read, then GET list and DB-read. | 200 (C); only N1 read flag changes to true, all other fields/records unchanged (P). No body or `success` shape required by contract. |
| API-NOT-05 | P2 / P,Q / W | Mark already-read N1 again. | Proposed 200 and unchanged records (idempotence); repeat status is not explicitly specified. |
| API-NOT-06 | P0 / C,P / W | A marks known B-owned notification read. | 403; foreign flag and all other fields unchanged (P). |
| API-NOT-07 | P2 / P,Q / W | Mark confirmed missing notification ID read. | Missing-resource response unspecified; no unrelated changes. Do not invent a documented 404. |

## Existing automation and next additions

Mapping is based on the current working tree. “Partial” means some assertions/variants already exist, not that the catalog row has fully passed. Current run evidence is in [docs/runs/](runs/2026-09-12-default.md) (2026-09-12); [EXECUTION.md](EXECUTION.md) and [STATE_EXECUTION.md](STATE_EXECUTION.md) are historical.

| Design IDs / area | Existing source | Coverage and remaining work |
|---|---|---|
| AUTH-01/02; SEC-01 | [setup](../tests/auth.setup.ts), [auth](../tests/api/auth.spec.ts) | Valid setup, wrong password, missing/malformed token on eight protected GETs. Add explicit token schema/use case, unknown email, validation, expiry, and eight protected write gates. |
| SEC-02 (partial); APT-14 | [auth](../tests/api/auth.spec.ts) `Authorization boundaries` | Read-only, no User B: another patient's appointment detail → 403 with no data (APT-14, passes); `GET /users/me` with an altered `user_id` claim and a signed `alg: none` header → 401 (pass); empty signature → edge 403 (F-20). Remaining SEC-02: expired tokens and the other 15 operations. |
| AUTH-05/06/07 | None live | Controlled rate-limit and dedicated logout-session cases planned. |
| USR-01; SEC-04 | [users](../tests/api/users.spec.ts), [caching](../tests/api/caching.spec.ts) | Own identity/no password hash; profile/appointment cache policy. Add controlled null/string fixtures and two-user isolation. |
| USR-04/05/06 | None | No profile write automation. Blocked by the F-06 restoration prerequisite. |
| DOC-01/02/04/05/07 | [doctors](../tests/api/doctors.spec.ts) | Active list, completeness, detail/fee, unknown detail, availability clock/uniqueness. Add unknown availability and controlled empty/inactive cases. |
| APT-01/02/13 | [appointments](../tests/api/appointments.spec.ts) | Own list/detail/DB and separate raw-date expectations; cross-patient detail read is covered under APT-14; missing-detail variant remains planned. Detail shape/date is suite policy, unlike list's declared schema. |
| APT-04/05/07/08/09/10/16/19/22/25 | [appointment writes](../tests/api/appointments.spec.ts) | Partial: valid create, missing doctor only, two past dates, invalid clock, inactive doctor, sequential duplicate, cancel, reschedule, combined invalid reschedule, delete. Add each missing field, independent invalid variants, response-schema assertions, cross-user cases, concurrency, and boundaries. |
| PAY-01/02 | [payments](../tests/api/payments.spec.ts) | Own list/DB/schema; controlled enum/null/empty fixtures and second-user setup remain planned. |
| PAY-04/07/08 | [payment writes](../tests/api/payments.spec.ts) | Cash valid/zero/negative/duplicate steps implemented; only valid attempted in recorded run, F-18 stopped the rest. Other methods/validation/ownership planned. |
| NOT-01/02/04/05 | [notifications](../tests/api/notifications.spec.ts) | Own list mapping implemented; read/repeat state test skipped in recorded run. Need attributable unread fixture and controlled B record. |
| Shared CON/VAL/SEC matrices | [contract helpers](../src/api/contract.ts) | Component validation exists; complete operation-level inline response validation and all request variants are not implied by these helpers. |

All abbreviated IDs in this mapping have the `API-` prefix. Existing default/state execution touched 14 of 17 operations; operation coverage is not case coverage.

## Suggested implementation order and reporting

1. Add read-side gaps: unknown availability (DOC-08), unknown appointment (APT-15), explicit successful login contract/use (AUTH-01), and expanded literal response validation. Reuse setup authentication to avoid redundant logins.
2. Add controlled A/B fixtures and protected-write auth/ownership cases. Treat negative write tests as mutations because a faulty service may accept them.
3. Retest existing persistence defects F-16/F-17/F-18 within the state runner's bounds, then expand required-field/type/method cases and inline mutation-response checks.
4. Run isolated profile, notification, concurrency, and rate-limit cases only once their named prerequisites exist and proposed business rules are agreed.

For every executed variant record: full ID plus variant suffix (for example `API-APT-05-missing-time-slot`), C/P/Q basis, observed status, schema errors, sanitized before/after evidence, cleanup result, and pass/fail/blocked/skipped. Link a finding for a reproduced defect. Do not label schema-valid past dates, empty strings, extra fields, or zero amounts as contract violations. A confirmed contract mismatch and an unconfirmed business-rule expectation must remain distinguishable in the report.
