# Dashboard (UI)

Spec: [tests/ui/dashboard.spec.ts](../../tests/ui/dashboard.spec.ts) · Project: `ui` (Desktop Chrome, depends on `setup`)

**Starting state:** the browser is authenticated with the token saved by TC-SETUP-001. **Before each case:** open `/dashboard`.

**Page object:** [DashboardPage](../../src/pages/DashboardPage.ts). It exposes `greeting` (the `h1` in `main`), `banner` (the only `img` in `main`, which has no alt text), and the composed [Sidebar](../../src/pages/components/Sidebar.ts).

---

## TC-UI-DASH-001: Dashboard greets the user by first name from the DB

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts:10](../../tests/ui/dashboard.spec.ts:10) › `Dashboard › greets the user by first name from the DB` |
| Project / tag | ui / — |
| Type | Functional, data reconciliation |
| Priority | P1 |
| Catalog / finding | — / — |
| Last recorded | Pass (2026-09-12) |

**Test data:** `testUser.first_name`, read from the `users` row for the configured email.

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/dashboard` while authenticated. | The dashboard loads without a redirect to login. |
| 2 | Read the greeting heading. | The heading **contains** the user's first name from the DB. |

---

## TC-UI-DASH-002: Sidebar navigation links to each section

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts:14](../../tests/ui/dashboard.spec.ts:14) › `Dashboard › sidebar navigation links to each section` |
| Project / tag | ui / — |
| Type | Functional, accessibility structure (ARIA snapshot) |
| Priority | P2 |
| Catalog / finding | — / — |
| Last recorded | Pass (2026-09-12) |

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/dashboard` while authenticated. | — |
| 2 | Match the ARIA snapshot of the sidebar's `navigation` region. | The region has four links **in this order**. Names end with the section label, because the icon ligature text such as `medical_services` comes first. |
| | | • `…Dashboard` → `/dashboard` |
| | | • `…Doctors` → `/doctors` |
| | | • `…Appointments` → `/appointments` |
| | | • `…Notifications` → `/notifications` |

---

## TC-UI-DASH-003: Each dashboard image is under 500 KB

| Field | Value |
|---|---|
| Automated test | [dashboard.spec.ts:29](../../tests/ui/dashboard.spec.ts:29) › `Dashboard › each image is under 500 KB` |
| Project / tag | ui / — |
| Type | Performance budget, known defect |
| Priority | P2 |
| Basis | P. The suite proposes a budget of **512,000 bytes** (500 × 1024) per image. |
| Catalog / finding | — / **F-13** |
| Last recorded | Expected failure, F-13 (2026-09-12). `/images/dashboard.png` was **6,442,770 bytes**. |

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/dashboard` while authenticated. | — |
| 2 | Wait for the banner image to finish loading. | `banner.complete === true`. |
| 3 | Read the banner's `currentSrc` and `naturalWidth`. | `naturalWidth > 0`, so the image actually rendered. |
| 4 | Collect all requests of resource type `image` from the page. | At least one image request exists. |
| 5 | For each image request, read the response. | A response exists and `response.ok()` is true. |
| 6 | For each **non-banner** image, measure the body size. | Size ≤ 512,000 bytes. This is a pre-check, so a failure here is unexpected. |
| 7 | Confirm the banner response was captured. | The banner size is defined. |
| 8 | *(after `test.fail`)* Assert banner size ≤ 512,000 bytes. | **Target:** the banner is within budget. **Current:** expected failure (F-13). |

**Note:** this is a transfer-size check. It does not measure page load time.
