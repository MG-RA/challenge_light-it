# Test Strategy — MedAppoint (Light-it QA Challenge)

> No requirements or acceptance criteria were provided. Defining scope, oracles, and
> risk myself — and saying so explicitly — is part of the deliverable. This document
> is the reasoning; [`docs/FINDINGS.md`](docs/FINDINGS.md) is the evidence it produced.

## 1. Context & system under test

MedAppoint is a patient portal for booking medical appointments. Three surfaces, three test layers:

| Surface | Under test | What it tells me |
|---|---|---|
| **Web UI** | `light-it-qa-challenge.vercel.app` (SPA, JWT in `localStorage`) | User-facing behaviour |
| **REST API** | `qa-challenge-backend.vercel.app` — 17 endpoints, [OpenAPI](docs/openapi.json) | The real contract & business logic |
| **Postgres** | Supabase, **read-only** user | **Oracle / source of truth** |

The read-only DB is the strategic asset. With no requirements, the database lets me
verify what the API and UI *claim* against what is actually stored, and mine the seed
data for invariants that should hold but don't.

## 2. Deriving the oracle (what "correct" means without a spec)

I reconstructed expected behaviour from three sources, in order of authority:

1. **Business logic that any appointment system must honour** — a slot can't be double-booked;
   you can't book an inactive doctor or a past date; you can only see/modify your own records;
   money can't be negative.
2. **The OpenAPI spec** — declared schemas, status codes, enums. Treated as a *claim to be
   verified*, not ground truth (it's already wrong — see F-01).
3. **The database schema & seed data** — column types, constraints, and the shape of real rows.

Where these disagree, that disagreement **is** a bug.

## 3. Risk analysis (drives prioritisation)

Medical + money + multi-tenant → risk is concentrated, not uniform. I test in this order:

| Priority | Risk area | Why it's top | Failure impact |
|---|---|---|---|
| **P0** | Authorization / tenant isolation (IDOR) | Multi-user PII + health data | Patient reads/edits another patient's record |
| **P0** | Booking integrity (double-book, inactive doctor, past date, slot format) | Core function | Two patients, one slot; nonsense data persisted |
| **P1** | Payments correctness | Money | Wrong/negative amount, pay for another user, double-pay |
| **P1** | Auth (login, token, expiry, rate-limit) | Gatekeeper | Account takeover, brute force |
| **P2** | Contract conformance (schemas, status codes, enums) | Integration reliability | Clients break on undocumented shapes |
| **P2** | Appointment lifecycle (cancel/reschedule/complete state machine) | Data consistency | Illegal transitions |
| **P3** | UI functional + data rendering | UX | Wrong info shown to patient |
| **P3** | Non-functional (a11y, cross-browser, perf headers, CORS) | Quality bar | Degraded experience |

## 4. Test architecture — a spec-inverted pyramid

Most logic lives in the API, and the UI is a thin client over it. So the suite is
**API-heavy, DB-verified, UI-thin** rather than a classic UI-top pyramid:

```
        ┌───────────────┐
        │   UI  (few)   │  critical journeys only: login, book, cancel, view
        ├───────────────┤
        │  API  (many)  │  every endpoint × happy + negative + authz + contract
        ├───────────────┤
        │ DB assertions │  cross-cut: API/UI results reconciled against Postgres
        └───────────────┘
```

- **API tests** carry the coverage — fast, stable, and where the business rules actually are.
- **DB assertions** are a *cross-cutting oracle* available in every test (a worker-scoped
  fixture), not a separate silo. "The API said X; does the DB agree?"
- **UI tests** cover only journeys where the *rendering/interaction* is the risk, not the
  data (which the API layer already proves). This keeps the slow, flaky layer minimal.

Framework already scaffolded — see [`README.md`](README.md). Page Objects, a per-endpoint
`ApiClient`, typed models from the spec, and fixtures (`api`, `anonApi`, `db`, page objects).

## 5. Test design techniques

Explicitly applied so coverage is reasoned, not ad hoc:

- **Equivalence partitioning & boundary values** — `time_slot` (valid `HH:mm` vs `25:99`),
  amounts (`0`, negative, huge, non-numeric), dates (past / today / far future), pagination.
- **Decision tables** — booking validity = f(doctor active?, date past?, slot taken?, slot valid?).
- **State-transition testing** — appointment lifecycle over `pending → active → completed`
  and `→ cancelled`; assert illegal transitions are rejected (cancel a completed, reschedule a cancelled).
- **CRUD + negative-path** — every mutation gets its unhappy twin (missing fields, wrong types, not-found ids).
- **Authorization matrix** — for each protected endpoint: no token / expired token / malformed token /
  **another user's resource id** (IDOR, read *and* write).
- **Contract testing** — every response validated against the OpenAPI schema (status, keys, types, enums).

## 6. Test data strategy (the hard part on a shared, mutable environment)

The DB user is read-only, but the **API mutates shared, live state** that other candidates
also touch. Rules the suite follows:

1. **Never depend on seed data staying put.** Read the DB at runtime for expected values; don't hard-code ids.
2. **Create-your-own, then clean up.** Mutating tests create their own appointment/payment and
   delete/cancel it in teardown; assertions target *that* record's id.
3. **Isolation over ordering.** Tests must pass in any order and in parallel — no test relies on
   another's side effect.
4. **Idempotent auth.** Login is rate-limited (`429` is documented). Authenticate **once per run**
   in `auth.setup.ts`, reuse the JWT for both API and browser. Never log in per test.
5. **Read vs write split.** Read-only checks (contract, authz-deny, list shape) run freely;
   destructive checks are quarantined and self-healing.

## 7. Environments & configuration

- All endpoints, credentials, and DB settings live in `.env` (git-ignored); `.env.example` documents them.
- Config is typed and validated at load (`src/config/env.ts`) — a missing var fails fast with a clear message.
- Playwright *projects* separate `setup` → `api` / `ui` / `db`, so any layer can run alone in CI or locally.

## 8. CI/CD & reporting

- **GitHub Actions**: `npm ci` → `npx playwright install --with-deps chromium` → typecheck → `npx playwright test`.
- **Secrets** (credentials, DB) injected as GitHub Secrets, never committed.
- **Parallelism** tuned down (`workers: 2` in CI) because the target is a shared remote env and login is throttled.
- **Retries: 1 in CI only** — surfaces flake without masking real failures; `trace/video/screenshot` retained on failure.
- **Reporting**: HTML report (published as a CI artifact) + JUnit/`list` for the PR summary.
- **Definition of done for a PR**: typecheck clean, suite green, no `.only`, new endpoints have happy + negative + authz cases.

## 9. Non-functional coverage

- **Security**: authz matrix (§5), no PII/secret leakage in responses (password hash never returned — verified),
  CORS not wildcarded for arbitrary origins (verified), JWT expiry (24h — verified), login rate-limiting.
- **Accessibility**: `@axe-core/playwright` smoke on login + dashboard (labels, contrast, roles).
- **Cross-browser**: extend the `ui` project to WebKit/Firefox for the critical booking journey.
- **Performance (light)**: assert sane response times and cache/security headers; not load testing (out of scope, §10).

## 10. Scope

**In:** functional API/UI/DB correctness, contract conformance, authz, input validation,
appointment & payment business rules, core a11y/security smoke.

**Out (call it out, don't pretend):** load/stress & scalability, penetration testing beyond
authz/validation smoke, email/SMS delivery, third-party payment-processor internals,
DB write-path testing (no write grant by design).

## 11. Entry / exit criteria

- **Entry**: endpoints reachable, valid credentials, DB read access, spec available.
- **Exit (per cycle)**: P0/P1 suites green or every failure filed with evidence; contract suite green
  or documented deviations agreed; no open P0 defect without a decision.

## 12. Deliverables

1. This strategy.
2. Automated suite (UI/API/DB) — running, typed, CI-ready.
3. [`docs/FINDINGS.md`](docs/FINDINGS.md) — prioritised defect log with reproductions and evidence.
4. HTML test report per run.

---

### Appendix A — Endpoint coverage matrix (target)

Legend: H happy · N negative/validation · A authz (no/expired/malformed/IDOR) · C contract/schema · D DB-reconciled

| Endpoint | H | N | A | C | D |
|---|:-:|:-:|:-:|:-:|:-:|
| POST /auth/login | ✓ | ✓ (bad pw, missing, 429) | — | ✓ | — |
| POST /auth/logout | ✓ | — | ✓ | — | — |
| GET /users/me | ✓ | — | ✓ | ✓ | ✓ |
| PUT /users/me | ✓ | ✓ (missing req, 403?) | ✓ | ✓ | ✓ |
| GET /doctors | ✓ | — | ✓ | ✓ | ✓ |
| GET /doctors/{id} | ✓ | ✓ (404, non-numeric) | ✓ | ✓ | ✓ |
| GET /doctors/{id}/availability | ✓ | ✓ (404) | ✓ | ✓ | ✓ (vs booked) |
| GET /appointments | ✓ | — | ✓ | ✓ | ✓ |
| POST /appointments | ✓ | ✓ (past date, inactive dr, bad slot, double-book) | ✓ | ✓ | ✓ |
| GET /appointments/{id} | ✓ | ✓ (404) | ✓ **IDOR** | ✓ | ✓ |
| PUT /appointments/{id}/cancel | ✓ | ✓ (already cancelled/completed) | ✓ **IDOR** | — | ✓ |
| PUT /appointments/{id}/reschedule | ✓ | ✓ (past, bad slot) | ✓ **IDOR** | ✓ | ✓ |
| DELETE /appointments/{id} | ✓ | ✓ (404) | ✓ **IDOR** | — | ✓ |
| POST /payments | ✓ | ✓ (≤0, non-numeric, bad method, double-pay) | ✓ (pay other's appt) | ✓ | ✓ |
| GET /payments | ✓ | — | ✓ | ✓ | ✓ |
| GET /notifications | ✓ | — | ✓ | ✓ | ✓ |
| PUT /notifications/{id}/read | ✓ | ✓ (404) | ✓ **IDOR** | — | ✓ |

### Appendix B — Appointment state model (to verify)

```
        create
          │
          ▼
      ┌────────┐  confirm?   ┌────────┐   (visit)   ┌───────────┐
      │pending │ ──────────▶ │ active │ ──────────▶ │ completed │
      └────────┘             └────────┘             └───────────┘
          │                      │
          └───────── cancel ─────┴────────▶ ┌───────────┐
                                            │ cancelled │
                                            └───────────┘
```
Illegal transitions that must be rejected: cancel/reschedule a `completed` or `cancelled`
appointment; complete a `cancelled` one. (Enum source: spec = `active|pending|completed|cancelled`;
UI shows "Confirmed" — see F-08.)
