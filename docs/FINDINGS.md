# Findings — MedAppoint

Defects and observations found while building the suite. Confirmed items are backed by
read-only DB queries or API responses (no shared state was mutated to find them).
Severity reflects impact in a medical/financial, multi-tenant context.

| ID | Severity | Area | Summary | Status |
|---|---|---|---|---|
| F-01 | Medium | Contract | `GET /doctors` omits `is_active` & `consultation_fee` (in spec + `/doctors/{id}`) | Confirmed |
| F-02 | High | Data integrity | Invalid `time_slot` `"25:99"` persisted; no format validation | Confirmed (DB) |
| F-03 | High | Booking | Double-booking allowed — one doctor/date/slot has up to **8** active appts | Confirmed (DB) |
| F-04 | High | Booking | Active appointments against an **inactive** doctor (id 7) | Confirmed (DB) |
| F-05 | High | Booking | `availability` returns a static slot list ignoring booked slots (root cause of F-03) | Confirmed (API) |
| F-06 | Medium | Data quality | Free text / clinical note stored in `first_name` (user 68), empty `last_name` | Confirmed (DB) |
| F-07 | Low | Data plausibility | Future-dated notification (`created_at` 2027-03-15) | Confirmed (DB) |
| F-08 | Low | UI/contract | UI shows status **"Confirmed"**; enum has no such value | Confirmed (UI) |
| F-09 | Low | Contract | Numeric-as-string inconsistency: payment `amount` `"60"` vs DB `60.00` / fee `"120.00"` | Confirmed (API) |
| F-10 | Low | Contract | Notification field `isRead` (camelCase) vs snake_case everywhere else / DB `is_read` | Confirmed (API) |
| F-11 | Info | Contract | `GET /doctors/abc` → 404 (arguably 400 for a non-numeric id) | Observation |

### Positive controls verified (worth stating — you tested them and they hold)

- **IDOR read blocked**: `GET /appointments/{other-user-id}` → **403**.
- **Password hygiene**: bcrypt (`$2b$10$…`), never returned by the API.
- **Auth gate**: missing / malformed token → **401**.
- **CORS**: no `Access-Control-Allow-Origin` echoed for an arbitrary evil origin.
- **JWT**: 24h expiry (`exp - iat`).

---

## Confirmed details

### F-01 — `GET /doctors` drops fields the spec promises
- **Expected**: `Doctor` schema (spec) includes `is_active`, `consultation_fee`; `GET /doctors/{id}` returns both.
- **Actual**: list items only have `id, first_name, last_name, specialty, bio, avatar_url`.
- **Impact**: a client can't show price or filter inactive doctors from the list; contract drift.
- **Covered by**: `tests/api/doctors.spec.ts` (schema test).

### F-02 — Invalid time persisted
- **Evidence**: `select distinct time_slot from appointments` → includes **`25:99`** (1 row). Valid slots are `09:00`–`15:30`.
- **Impact**: no input validation on `time_slot`; corrupt data reaches the DB.
- **Test to add**: `POST /appointments` with `time_slot:"25:99"` → expect `400` (currently likely `201`).

### F-03 — Double-booking
- **Evidence**: grouping non-cancelled appts by `(doctor_id, date, time_slot)` yields many `count > 1`;
  worst is **doctor 1, 2026-11-04 09:30 → 8 active**. My own seeded appt 1072 is literally noted `"Double booked appointment"`.
- **Impact**: two patients, one slot — core functional failure.
- **Test to add**: book a slot twice → second should be `409/400`.

### F-04 — Booking an inactive doctor
- **Evidence**: doctor 7 (`is_active = false`) has **active** appointments (ids 1, 9, 198).
- **Impact**: patients hold appointments with a doctor the system considers unavailable; the list endpoint even hides that doctor (F-01), so the UI can't explain it.
- **Test to add**: `POST /appointments` with `doctor_id:7` → expect rejection.

### F-05 — Availability ignores existing bookings
- **Evidence**: `GET /doctors/1/availability` → full static slot list (`09:00…15:30`) despite doctor 1 being heavily booked.
- **Impact**: root cause of F-03 — the UI offers slots that are already taken.
- **Test to add**: reconcile `availability` against booked `appointments` in the DB.

### F-06 — Wrong data in name field
- **Evidence**: user 68 `first_name = "Jolly Koala Allergic to penicilin."`, `last_name = ""`.
- **Impact**: clinical info in the wrong column, no length/format validation, empty required-looking field (and a spelling error in seed data).

### F-08 — UI status vocabulary mismatch
- **Evidence**: dashboard renders **"Confirmed"** for the next appointment; API/spec status enum is `active|pending|completed|cancelled`.
- **Impact**: UI and API speak different languages for the same concept — confuses users and automation.

### F-09 / F-10 — Serialization inconsistencies
- `amount` comes back as `"60"` from `/payments` but `60.00` in the DB; `consultation_fee` is `"120.00"`. Inconsistent decimal formatting.
- Notifications expose `isRead` while every sibling field is snake_case. Pick one convention.

---

## To verify with mutating tests (designed, not yet run — protects shared env)

These need write calls; run them isolated with self-cleanup (Strategy §6).

- **IDOR write**: cancel / reschedule / delete another user's appointment; `PUT /notifications/1/read`
  (id 1 belongs to another user) → expect `403`.
- **Booking validation**: past date; `doctor_id:7` (inactive); `time_slot:"25:99"`; double-book → expect `400/409`.
- **Payments**: `amount:0`, negative, non-numeric; invalid `method`; pay for another user's appointment;
  pay the same appointment twice → expect rejection.
- **Lifecycle**: cancel an already-`completed`/`cancelled` appt; reschedule a `cancelled` one → expect rejection.
- **PUT /users/me**: the spec lists a `403` response for updating *your own* profile — clarify why; test missing required fields → `400`.
- **Auth**: hammer `POST /auth/login` → expect `429` (documented) and confirm lockout window.
