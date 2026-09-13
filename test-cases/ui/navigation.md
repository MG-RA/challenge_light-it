# Sidebar navigation (UI)

Spec: [tests/ui/navigation.spec.ts](../../tests/ui/navigation.spec.ts) · Project: `ui` (Desktop Chrome, depends on `setup`)

**Starting state:** the browser is authenticated with the token saved by TC-SETUP-001.

**Page objects:** [Sidebar](../../src/pages/components/Sidebar.ts) finds links by a name ending with the section label. The destination headings are [DoctorsPage](../../src/pages/DoctorsPage.ts), [AppointmentsPage](../../src/pages/AppointmentsPage.ts) and [NotificationsPage](../../src/pages/NotificationsPage.ts). Each heading is an `h1` in `main` whose name matches the section, case-insensitive.

TC-UI-NAV-001…003 come from the loop at [navigation.spec.ts:7](../../tests/ui/navigation.spec.ts:7).

| Shared field | Value |
|---|---|
| Type | Functional, navigation |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass for TC-UI-NAV-001…004 (2026-09-13) |

---

## TC-UI-NAV-001: Sidebar opens Doctors with its page heading

| Field | Value |
|---|---|
| Automated test | [navigation.spec.ts:8](../../tests/ui/navigation.spec.ts:8) › `Sidebar destinations › opens Doctors with its page heading` |
| Project / tag | ui / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/dashboard`. | The dashboard loads. |
| 2 | Click the **Doctors** sidebar link. | The URL ends with `/doctors`. |
| 3 | Observe the page. | An `h1` in `main` matching `/Doctors/i` is visible. |

## TC-UI-NAV-002: Sidebar opens Appointments with its page heading

| Field | Value |
|---|---|
| Automated test | [navigation.spec.ts:8](../../tests/ui/navigation.spec.ts:8) › `Sidebar destinations › opens Appointments with its page heading` |
| Project / tag | ui / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/dashboard`. | The dashboard loads. |
| 2 | Click the **Appointments** sidebar link. | The URL ends with `/appointments`. |
| 3 | Observe the page. | An `h1` in `main` matching `/Appointments/i` is visible. |

## TC-UI-NAV-003: Sidebar opens Notifications with its page heading

| Field | Value |
|---|---|
| Automated test | [navigation.spec.ts:8](../../tests/ui/navigation.spec.ts:8) › `Sidebar destinations › opens Notifications with its page heading` |
| Project / tag | ui / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/dashboard`. | The dashboard loads. |
| 2 | Click the **Notifications** sidebar link. | The URL ends with `/notifications`. |
| 3 | Observe the page. | An `h1` in `main` matching `/Notifications/i` is visible. |

---

## TC-UI-NAV-004: Sidebar returns to Dashboard from Doctors

| Field | Value |
|---|---|
| Automated test | [navigation.spec.ts:18](../../tests/ui/navigation.spec.ts:18) › `Sidebar destinations › returns to Dashboard from Doctors` |
| Project / tag | ui / — |

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/dashboard`. | The dashboard loads. |
| 2 | Click the **Doctors** sidebar link. | The Doctors `h1` is visible. |
| 3 | Click the **Dashboard** sidebar link. | The URL ends with `/dashboard`. |
| 4 | Observe the page. | The dashboard greeting heading is visible. |

---

## TC-UI-NAV-005: Sidebar logout clears the session and protects routes

| Field | Value |
|---|---|
| Automated test | [navigation.spec.ts:28](../../tests/ui/navigation.spec.ts:28) › `sidebar logout clears the session and protects routes after reload and back` |
| Project / tag | ui / — |
| Type | Security, session handling |
| Priority | P0 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** valid credentials and an available login attempt. The case logs in with a **fresh** session, so logging out cannot invalidate the shared setup token. This adds one login.

| # | Action | Expected result |
|---|---|---|
| 1 | Clear cookies and `localStorage`, open `/login` and log in with the configured credentials. | The URL ends with `/dashboard`. |
| 2 | Click the sidebar **Logout** button. | The URL ends with `/login`, and `localStorage.token` is `null`. |
| 3 | Go back in browser history. | The URL still ends with `/login`. |
| 4 | Navigate directly to `/appointments`. | Redirected; the URL ends with `/login`. |
| 5 | Reload. | **Sign In** is visible. |

**Limits:** checks browser session termination, not server-side revocation of the old token.

---

## TC-UI-NAV-006: Sidebar New Appointment opens the booking form

| Field | Value |
|---|---|
| Automated test | [navigation.spec.ts:47](../../tests/ui/navigation.spec.ts:47) › `sidebar New Appointment opens booking form` |
| Project / tag | ui / — |
| Type | Functional, navigation |
| Priority | P1 |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/dashboard`. | The dashboard loads. |
| 2 | Click the sidebar **New Appointment** link. | The URL ends with `/appointments/new`. |
| 3 | Observe the form. | The **Book Appointment** submit button (`data-testid="submit-appointment"`) is visible. |
