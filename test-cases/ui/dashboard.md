# Dashboard (UI)

Specs: [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) and [dashboard-state.spec.ts](../../tests/ui/dashboard-state.spec.ts) · Project: ui (Desktop Chrome, depends on setup).

**Starting state:** authenticated browser. DB queries use the read-only fixture. Each case opens the dashboard independently. Counter labels are scoped to their individual cards; matching one number elsewhere on the page cannot pass a case.

**Business expectations:** upcoming means future active/pending appointments in browser local time; completed and cancelled count their respective statuses. Active displays Confirmed. These UX rules are proposed expectations, not OpenAPI guarantees. Tests require correct values after page load/reload; they do not assert live push updates while the page stays open.

**Retired IDs:** TC-UI-DASH-002 (sidebar, covered in navigation) and TC-UI-DASH-003 (image size, retained as F-13 feedback). IDs are not reused.

---

## TC-UI-DASH-001: Dashboard greets the user by first name from the DB

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `Dashboard › greets the user by first name from the DB` |
| Project / tag | ui / — |
| Type | Functional, data reconciliation |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** Authenticated browser and DB user found by configured email.

**Test data:** testUser.first_name.

| # | Action | Expected result |
|---|---|---|
| 1 | Read the configured user from DB. | User row exists. |
| 2 | Open /dashboard. | Dashboard loads. |
| 3 | Read the main greeting heading. | Contains the DB first name. |

**Postconditions:** No remote data changed.

---

## TC-UI-DASH-004: Quick Actions opens Book

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `Dashboard › Quick Actions opens Book` |
| Project / tag | ui / — |
| Type | Functional, UI |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** Authenticated browser; reachable application.

**Test data:** Configured QA user.

| # | Action | Expected result |
|---|---|---|
| 1 | Open /dashboard. | Quick Actions section is available. |
| 2 | Click Book inside Quick Actions. | URL ends with /appointments/new. |
| 3 | Observe the destination heading. | Main h1 is Book Appointment. |

**Postconditions:** No remote data changed.

---

## TC-UI-DASH-005: Quick Actions opens Doctors

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `Dashboard › Quick Actions opens Doctors` |
| Project / tag | ui / — |
| Type | Functional, UI |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** Authenticated browser; reachable application.

**Test data:** Configured QA user.

| # | Action | Expected result |
|---|---|---|
| 1 | Open /dashboard. | Quick Actions section is available. |
| 2 | Click Doctors inside Quick Actions. | URL ends with /doctors. |
| 3 | Observe the destination heading. | Main h1 is Doctors. |

**Postconditions:** No remote data changed.

---

## TC-UI-DASH-006: Quick Actions opens History

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `Dashboard › Quick Actions opens History` |
| Project / tag | ui / — |
| Type | Functional, UI |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** Authenticated browser; reachable application.

**Test data:** Configured QA user.

| # | Action | Expected result |
|---|---|---|
| 1 | Open /dashboard. | Quick Actions section is available. |
| 2 | Click History inside Quick Actions. | URL ends with /appointments. |
| 3 | Observe the destination heading. | Main h1 is Appointments. |

**Postconditions:** No remote data changed.

---

## TC-UI-DASH-007: Quick Actions opens Alerts

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `Dashboard › Quick Actions opens Alerts` |
| Project / tag | ui / — |
| Type | Functional, UI |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** Authenticated browser; reachable application.

**Test data:** Configured QA user.

| # | Action | Expected result |
|---|---|---|
| 1 | Open /dashboard. | Quick Actions section is available. |
| 2 | Click Alerts inside Quick Actions. | URL ends with /notifications. |
| 3 | Observe the destination heading. | Main h1 is Notifications. |

**Postconditions:** No remote data changed.

---

## TC-UI-DASH-008: upcoming count matches the current DB snapshot

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `Dashboard › upcoming count reflects patient records` |
| Project / tag | ui / — |
| Type | Functional, data reconciliation |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** Authenticated browser and read access to the configured patient appointments.

**Test data:** Current owned appointment rows; future active/pending records.

| # | Action | Expected result |
|---|---|---|
| 1 | Query appointments for the configured patient only. | Rows are available; an empty list is valid. |
| 2 | Calculate the upcoming count from DB rows. | Expected count is determined independently of UI text. |
| 3 | Open /dashboard and read the matching card. | Card number equals the calculated count. |

**Postconditions:** No remote data changed.

**Coverage limit:** A coincidental match cannot establish that the card refreshes. TC-UI-DASH-013–016 test changes explicitly.

---

## TC-UI-DASH-009: completed count matches the current DB snapshot

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `Dashboard › completed count reflects patient records` |
| Project / tag | ui / — |
| Type | Functional, data reconciliation |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** Authenticated browser and read access to the configured patient appointments.

**Test data:** Current owned appointment rows; completed records.

| # | Action | Expected result |
|---|---|---|
| 1 | Query appointments for the configured patient only. | Rows are available; an empty list is valid. |
| 2 | Calculate the completed count from DB rows. | Expected count is determined independently of UI text. |
| 3 | Open /dashboard and read the matching card. | Card number equals the calculated count. |

**Postconditions:** No remote data changed.

**Coverage limit:** A coincidental match cannot establish that the card refreshes. TC-UI-DASH-013–016 test changes explicitly.

---

## TC-UI-DASH-010: cancelled count matches the current DB snapshot

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `Dashboard › cancelled count reflects patient records` |
| Project / tag | ui / — |
| Type | Functional, data reconciliation |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** Authenticated browser and read access to the configured patient appointments.

**Test data:** Current owned appointment rows; cancelled records.

| # | Action | Expected result |
|---|---|---|
| 1 | Query appointments for the configured patient only. | Rows are available; an empty list is valid. |
| 2 | Calculate the cancelled count from DB rows. | Expected count is determined independently of UI text. |
| 3 | Open /dashboard and read the matching card. | Card number equals the calculated count. |

**Postconditions:** No remote data changed.

**Coverage limit:** A coincidental match cannot establish that the card refreshes. TC-UI-DASH-013–016 test changes explicitly.

---

## TC-UI-DASH-011: Next appointment is the earliest eligible owned record

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `Dashboard › next appointment is the earliest future active or pending record` |
| Project / tag | ui / — |
| Type | Functional, UI |
| Priority | P1 |
| Finding | F-21 |
| Last recorded | Expected failure, F-21 (2026-09-13): UI Carlos Méndez; expected María Fernández. |

**Preconditions:** Authenticated browser and DB appointment/doctor read access.

**Test data:** Future active/pending patient appointments, sorted by date, time and ID.

| # | Action | Expected result |
|---|---|---|
| 1 | Read owned DB appointments; exclude past/completed/cancelled; sort. | Earliest eligible record is selected, or no record exists. |
| 2 | Open /dashboard; inspect Your next appointment. | If empty: no doctor and visible no-upcoming message. |
| 3 | If populated, look up selected doctor in DB and confirm the card renders a doctor. | The card shows a `Dr. …` name. |
| 4 | *(after `test.fail`)* Compare the displayed doctor. | Displayed doctor full name matches. |
| 5 | *(after `test.fail`)* Compare displayed date, time and status. | Date/time match; active is Confirmed, pending is Pending. |

**Postconditions:** No remote data changed.

**Coverage limit:** Live seed data selects the populated or empty branch; this run exercised the populated branch. The empty branch has no marker, so it fails normally. Assertions after the first mismatch may not run.

---

## TC-UI-DASH-012: View all opens appointment history

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `Dashboard › next appointment View all opens appointment history` |
| Project / tag | ui / — |
| Type | Functional, UI |
| Priority | P2 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** Authenticated browser; reachable application.

**Test data:** Configured QA user.

| # | Action | Expected result |
|---|---|---|
| 1 | Open /dashboard. | Next appointment section loads. |
| 2 | Click View all. | URL ends with /appointments. |
| 3 | Inspect main heading. | Appointments h1 is visible. |

**Postconditions:** No remote data changed.

---

## TC-UI-DASH-013: Upcoming appointments counter refreshes when appointment data changes

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `dashboard Upcoming appointments counter updates when appointment data changes` |
| Project / tag | ui / — |
| Type | Functional, controlled UI integration |
| Priority | P1 |
| Finding | F-23 |
| Last recorded | Expected failure, F-23 (2026-09-13): stayed 3 for both datasets. |

**Preconditions:** Authenticated browser, configured user identity, appointment GET intercepted before dashboard navigation.

**Test data:** First response: []. Second: six owned appointments (future active, pending, completed, cancelled, cancelled; one past active), with unique IDs. Expected counts: 2 upcoming, 1 completed, 2 cancelled.

| # | Action | Expected result |
|---|---|---|
| 1 | Intercept GET /api/appointments with an empty array; open dashboard. | The counter renders a number, and appointment data was requested. |
| 2 | *(after `test.fail`)* **Soft:** read the counter. | Upcoming appointments displays 0. |
| 3 | Switch response to the six-record dataset and reload. | Upcoming appointments displays 2 (soft). |
| 4 | Check request counters. | Appointment data was requested again after reload (soft). |

**Postconditions:** No remote data changed.

**Coverage limit:** Responses are controlled, so this verifies UI aggregation/reload, not backend persistence, cancellation or completion endpoints. The reload-refresh check sits after the F-23 marker here, but TC-UI-DASH-014/015 run the same flow unmarked and still fail on that regression.

---

## TC-UI-DASH-014: Completed counter refreshes when appointment data changes

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `dashboard Completed counter updates when appointment data changes` |
| Project / tag | ui / — |
| Type | Functional, controlled UI integration |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass, 2026-09-13: zero and changed dataset both reflected. |

**Preconditions:** Authenticated browser, configured user identity, appointment GET intercepted before dashboard navigation.

**Test data:** First response: []. Second: six owned appointments (future active, pending, completed, cancelled, cancelled; one past active), with unique IDs. Expected counts: 2 upcoming, 1 completed, 2 cancelled.

| # | Action | Expected result |
|---|---|---|
| 1 | Intercept GET /api/appointments with an empty array; open dashboard. | Completed displays 0. |
| 2 | Switch response to the six-record dataset and reload. | Completed displays 1. |
| 3 | Check request counters. | Appointment data was requested initially and again after reload. |

**Postconditions:** No remote data changed.

**Coverage limit:** Responses are controlled, so this verifies UI aggregation/reload, not backend persistence, cancellation or completion endpoints.

---

## TC-UI-DASH-015: Cancelled counter refreshes when appointment data changes

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) › `dashboard Cancelled counter updates when appointment data changes` |
| Project / tag | ui / — |
| Type | Functional, controlled UI integration |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass, 2026-09-13: zero and changed dataset both reflected. |

**Preconditions:** Authenticated browser, configured user identity, appointment GET intercepted before dashboard navigation.

**Test data:** First response: []. Second: six owned appointments (future active, pending, completed, cancelled, cancelled; one past active), with unique IDs. Expected counts: 2 upcoming, 1 completed, 2 cancelled.

| # | Action | Expected result |
|---|---|---|
| 1 | Intercept GET /api/appointments with an empty array; open dashboard. | Cancelled displays 0. |
| 2 | Switch response to the six-record dataset and reload. | Cancelled displays 2. |
| 3 | Check request counters. | Appointment data was requested initially and again after reload. |

**Postconditions:** No remote data changed.

**Coverage limit:** Responses are controlled, so this verifies UI aggregation/reload, not backend persistence, cancellation or completion endpoints.

---

## TC-UI-DASH-016: Upcoming count follows a persisted booking and deletion

| Field | Value |
|---|---|
| Automated test | [dashboard-state.spec.ts](../../tests/ui/dashboard-state.spec.ts) › `dashboard upcoming counter changes after a persisted booking and deletion` |
| Project / tag | ui / **@mutating** |
| Type | Functional, UI/API/DB state reconciliation |
| Priority | P1 |
| Finding | F-23 |
| Last recorded | Fail, 2026-09-13: persisted booking increased DB count; UI remained 3 after reload. Deletion and restoration completed. |

**Preconditions:** RUN_MUTATING=1; one worker; zero retries; authenticated token agrees with DB user; free slot within 30 days.

**Test data:** One uniquely marked appointment owned by this run, created via the existing owned fixture.

| # | Action | Expected result |
|---|---|---|
| 1 | Read upcoming DB count N; open dashboard. | Counter equals N. |
| 2 | Create one future appointment via owned.book(). | Exactly one marked row persisted; status is active/pending; DB count becomes N+1. |
| 3 | Reload dashboard. | Counter increases to N+1 (soft assertion so cleanup and later checks continue). |
| 4 | Delete the owned row and query DB until absent. | DB count returns to N. |
| 5 | Reload dashboard again. | Counter returns to N. |

**Postconditions:** Only the marked appointment is deleted; DB absence is verified. Fixture cleanup also runs after failures.

**Coverage limit:** Does not cancel or complete appointments. Those backend transitions are distinct from counter aggregation and may fail independently.
