# Execution record — 2026-09-11

## Final default run

Command: `npx playwright test`, configured **4 workers**, local **0 retries**, mutation flag unset. Started **2026-09-11 23:23:04 UTC** (20:23:04 America/Montevideo). Duration **11.7 seconds**. Windows, Node 26.8.2, npm 11.7.0, Chromium. Exit code **0**.

| Project | Cases | Normal passes | Known failures reproduced | Skipped | Unexpected |
|---|---:|---:|---:|---:|---:|
| Framework | 17 | 17 | 0 | 0 | 0 |
| Setup | 1 | 1 | 0 | 0 | 0 |
| API | 31 | 26 | 5 | 0 | 0 |
| DB | 2 | 2 | 0 | 0 | 0 |
| UI | 11 | 10 | 1 | 0 | 0 |
| **Total** | **62** | **56** | **6** | **0** | **0** |

No flaky results or unexpected passes. Playwright reports “62 passed” because matching expected failures count as expected outcomes. The total includes setup and local framework tests; it is not 62 independent product behaviors.

## Separate state run

The [state execution record](STATE_EXECUTION.md) preserves **6 normal passes, 8 failed scenarios, 2 skips**, with **0 cleanup failures and 0 observed residue**. That run exited 1. All 14 created appointments were removed. A successful payment response without a persisted payment stopped further live cases; zero/negative/duplicate payment steps were unexecuted, notification read was skipped, and profile writes remain gated. No state failures were reclassified as expected.

Default live API coverage touches **9 of 17 operations**, including all eight protected GET operations. With executed state cases, this reaches **14 of 17**; logout, live profile update and notification-read remain uncovered.

## Inspected expected failures

| Finding | Cases | Failure signature reviewed |
|---|---:|---|
| F-01 | 1 | Six doctor-list entries omit only `is_active` and `consultation_fee`; additional completeness policy, not literal OpenAPI violation |
| F-13 | 1 | Dashboard PNG is **6,442,770 bytes**, exceeding **512,000 bytes** |
| F-14 | 2 | Profile and appointment-list headers are `public, max-age=0, must-revalidate` |
| F-15 | 2 | Appointment list and owned detail serialize dates as exact UTC-midnight timestamps instead of date-only strings |

The final JSON errors matched these signatures, rather than unrelated status/schema/timeout failures. The final list contained nine entries; record counts can change in the shared environment. The earlier read-only cycle observed eight.

## Other validation

- Typecheck and lint passed after the final code change.
- Default discovery with unset / `0` / `false` / `1` each lists **62** cases and no state mutations. Dedicated state discovery with `1` lists **16** cases: authentication plus 15 state cases. Missing opt-in is rejected; local guards verify supported and invalid flag values.
- **17 local tests** cover configuration, literal/completeness semantics, narrow known-defect guards, diagnostic redaction, cleanup continuation, ownership, timeout reconciliation, persistence polling, payment caps/false IDs, notification attribution, and synthetic profile responses.
- The new availability UI case passed first in isolation, then in the full default suite. Selecting two active doctors triggered their availability GETs and displayed matching time options. API writes were blocked. The reported missing-data symptom (F-19) was not reproduced on this path; date-specific vacancy and error recovery remain unverified.
- Invalid-password UI login observed rejection and visible feedback. Sidebar destination checks passed; payment and notification reads matched owned DB data. No record-dependent skips occurred.

The earlier 16:40 UTC read-only baseline had 50 cases (44 normal passes, six expected failures). The later expansion added 11 local state/profile checks and one booking availability UI check. It did not remove or hide product failures.

## Limits and evidence handling

The default suite performs no profile, appointment, payment, or notification writes. Its zero-row DB UPDATE permission probe was denied. The separate state run's writes and cleanup are documented above. No controlled second-user, expired-token, logout, axe, mobile, additional-browser, or hosted CI cycle was run.

Local default reports: `playwright-report/index.html` and `test-results/results.json`. State evidence is separated under `state-results/<run-id>/`. These ignored artifacts can contain account data and are not sanitized for distribution; this document preserves a sanitized summary. The [initial audit](AUDIT.md) is a historical baseline.
