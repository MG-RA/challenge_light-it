# Doctors API

Spec: [tests/api/doctors.spec.ts](../../tests/api/doctors.spec.ts) · Project: `api` (depends on `setup`)

Expected values come from `db.activeDoctors()`: `doctors where is_active order by id`.

---

## TC-DOC-001: `GET /api/doctors` lists exactly the active doctors in the DB

| Field | Value |
|---|---|
| Automated test | [doctors.spec.ts:5](../../tests/api/doctors.spec.ts:5) › `Doctors API › GET /doctors lists exactly the active doctors in the DB` |
| Project / tag | api / — |
| Type | Functional, contract, data reconciliation |
| Priority / basis | P1 / C (status, `Doctor[]` schema, active-only list), P (exact ID set and field values against the DB) |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** a valid session token and a read-only DB connection.

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/doctors` and validate with `expectJson(…, 'Doctor[]')`. | HTTP **200**. The body passes literal OpenAPI `Doctor[]` validation. |
| 2 | For every list item, check `id`. | `id` is a number. Raw schema properties are optional, so the case requires the identity it uses for reconciliation. |
| 3 | Read active doctors from the DB. | — |
| 4 | Compare the sorted API IDs with the DB IDs. | The ID sets are **identical**: no inactive doctors and no missing active doctors. |
| 5 | For each DB row, find the API item with the same `id`. | The item matches `first_name`, `last_name`, `specialty`, `bio` and `avatar_url`. |

**Note:** `consultation_fee` and `is_active` are not compared here because the list omits them (see TC-DOC-002).

---

## TC-DOC-002: `GET /api/doctors` satisfies the field-completeness policy

| Field | Value |
|---|---|
| Automated test | [doctors.spec.ts:27](../../tests/api/doctors.spec.ts:27) › `Doctors API › GET /doctors satisfies the field-completeness policy` |
| Project / tag | api / — |
| Type | Contract (suite policy), known defect |
| Priority / basis | P1 / P. This is **not** a literal OpenAPI violation. |
| Finding | **F-01** |
| Last recorded | Expected failure, F-01 (2026-09-13). Every list entry omitted only `is_active` and `consultation_fee`. |

**Preconditions:** a valid session token. At least one doctor must be listed, or the case is skipped.

| # | Action | Expected result |
|---|---|---|
| 1 | Send `GET /api/doctors` and validate with `expectJson(…, 'Doctor[]')`. | HTTP **200**. Literal schema validation passes. |
| 2 | Compute missing declared fields per item (`missingFields('Doctor[]', …)`). | — |
| 3 | Pre-check: filter out `is_active` and `consultation_fee` from the gaps. | No **other** field is missing. An unrelated gap fails as unexpected. |
| 4 | If the list is empty, skip. | — |
| 5 | *(after `test.fail`)* Assert the full gap list is empty. | **Target:** every declared `Doctor` field is present in each item. **Current:** expected failure (F-01). |

---

## TC-DOC-003: `GET /api/doctors/{id}` matches the stored doctor

| Field | Value |
|---|---|
| Automated test | [doctors.spec.ts:43](../../tests/api/doctors.spec.ts:43) › `Doctors API › GET /doctors/:id matches the stored doctor` |
| Project / tag | api / — |
| Type | Functional, contract, data reconciliation |
| Priority / basis | P1 / C (status, schema, fee as a string), P (completeness, DB values, numeric fee equivalence) |
| Finding | F-09 (decimal formatting: compare numerically) |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** at least one active doctor exists in the DB. Otherwise the case is skipped.

**Test data:** the first active doctor by `id`.

| # | Action | Expected result |
|---|---|---|
| 1 | Read the first active doctor row from the DB. | A row is returned. |
| 2 | Send `GET /api/doctors/{id}` and validate with `expectCompleteJson(…, 'Doctor')`. | HTTP **200**. The body passes literal `Doctor` schema validation and every declared field is present. |
| 3 | Compare every stored field except `consultation_fee`. | `id`, names, `specialty`, `is_active`, `bio` and `avatar_url` equal the DB row. |
| 4 | Check the format of `consultation_fee`. | A decimal string matching `^-?\d+(?:\.\d+)?$`. |
| 5 | Check the value of `consultation_fee`. | `Number(fee)` is finite and **numerically** equals the DB fee. `'120'` and `'120.00'` count as equal. |

---

## TC-DOC-004: `GET /api/doctors/{id}/availability` returns valid clock slots

| Field | Value |
|---|---|
| Automated test | [doctors.spec.ts:62](../../tests/api/doctors.spec.ts:62) › `Doctors API › GET /doctors/:id/availability returns valid clock slots` |
| Project / tag | api / — |
| Type | Functional, contract |
| Priority / basis | P1 / C (200, `time_slots` string array), P (field required, `HH:mm` format, uniqueness) |
| Finding | — (whether slots are a static catalog or date-specific vacancy is open; see F-05) |
| Last recorded | Pass (2026-09-13) |

**Preconditions:** at least one active doctor exists. Otherwise the case is skipped.

| # | Action | Expected result |
|---|---|---|
| 1 | Read the first active doctor ID from the DB. | A row is returned. |
| 2 | Send `GET /api/doctors/{id}/availability`. | HTTP **200**. |
| 3 | Parse the body. | The object contains `time_slots` as an array. |
| 4 | Check each slot. | It matches the 24-hour clock `^(?:[01]\d\|2[0-3]):[0-5]\d$`, for example `09:00`. `25:99` and `9:00` are rejected. |
| 5 | Check for duplicates. | `new Set(slots).size === slots.length`, so there are no duplicate slots. |

**Not covered here:** date-specific vacancy (no date query parameter is documented), an empty catalog, and unknown or inactive doctor availability.

---

## TC-DOC-005: `GET /api/doctors/{id}` returns 404 for an unknown doctor

| Field | Value |
|---|---|
| Automated test | [doctors.spec.ts:80](../../tests/api/doctors.spec.ts:80) › `Doctors API › GET /doctors/:id returns 404 for an unknown doctor` |
| Project / tag | api / — |
| Type | Functional, negative |
| Priority / basis | P1 / C |
| Finding | — |
| Last recorded | Pass (2026-09-13) |

**Test data:** `db.unusedDoctorId()` returns `coalesce(max(id), 0) + 1` from `doctors`, computed at run time. It is not hard-coded.

| # | Action | Expected result |
|---|---|---|
| 1 | Get an unused doctor ID from the DB. | An integer greater than every existing doctor ID. |
| 2 | Send `GET /api/doctors/{unusedId}` with the bearer token. | HTTP **404**. The body is not asserted because no schema is declared. |
