# How I used AI

**Tool:** Claude Code (Anthropic, Claude Opus models), working in this repository with a terminal, a browser it could drive and the read-only database, from the first commit on 2026-09-11. I directed the work and made the decisions; the assistant did most of the scripting, coding and first drafts. Earlier commits carry a `Co-Authored-By: Claude` trailer.

**Additional tool:** OpenAI Codex helped prepare the Part 2 SQL queries and revise
the Postman reschedule collection. It inspected the API contract and database
schema, generated queries and request scripts, formatted the scripts, investigated
failed assertions, and reviewed the deliverables against the evaluation criteria.
I supplied the requirements, ran the collection in Postman, shared the exported
results, and requested a more focused final submission.

## What it did, and what stayed with me

| Area | The assistant | Me |
|---|---|---|
| Exploration | Wrote and ran throwaway Playwright and SQL scripts against the UI, API and database, and summarized the results | What to explore; approving any test that touched data the tests did not create |
| Part 1 report | Drafted the strategy, test cases, bug reports and evidence images from recorded results | Severity, priority, bugs vs. improvements, the go/no-go verdict |
| Automation | Generated and refactored the Playwright code, lint/format rules and the CI workflow | What to automate; reviewing every change |
| Review | Compared the repository with the brief and flagged gaps and over-engineering | What to cut and what to keep |

## How I validated it

- **Validation depends on the claim.** The earlier UI investigation used API and database evidence. Codex executed all five SQL queries through a read-only database connection and reconciled patient counts, doctor coverage, appointment totals and revenue. The Postman collection verifies changes through independent API GETs; it does not connect to the database, so its findings establish API-visible state rather than direct database evidence.
- **Code is checked by tools:** type checking, lint, formatting and test runs against the live environment after every change, plus GitHub Actions.
- **Every screenshot was viewed and every number in the report cross-checked** against the recorded results.
- **Data safety:** tests only changed appointments they created, then deleted them and verified the deletion. The two exceptions ran only with my approval and were verified to leave the data exactly as it was.
- **Postman validation:** Codex ran the collection with Newman against a controlled API, exercised cleanup after a prerequisite failure, and ran it against the live challenge API. My exported Postman run matched the earlier Newman result. After reducing duplicate cases and assertions, the final collection was checked again. Exact counts and field-level evidence are recorded in [part-3-postman/README.md](part-3-postman/README.md).

## Mistakes it made that these checks caught

- The first report draft **overstated**: a wrong test-case count, an appointment called "past" that was actually tomorrow (shown a day early by BUG-03), and "every patient in the Americas". Cross-checking against the evidence fixed all three.
- An evidence image **cropped the wrong element**; viewing it caught that, and it was re-taken.
- A scripted bulk edit **corrupted a test file**; the formatter refused to parse it, so it never reached a commit.
- It made adding tests cheap, and the suite **grew past 80 tests** before I re-read the brief, which values depth on one story and three solid UI flows. I refocused on the four deliverables.
- The initial Postman collection repeated the same date-format failure throughout the flow and described one failure too broadly. Review reduced the format check to one focused assertion, removed overlapping missing-input cases, and separated response identity checks from requested date/time checks. Live evidence then established that the reschedule response returned the old date even though a subsequent GET showed the new one.

## How it shaped my approach

Cheap verification scripts made the database the oracle for every claim, which is how the stale confirmation (BUG-04) and the silently changed date (BUG-05) were found. I spent the time saved on depth, such as the same appointment in two time zones (BUG-03), instead of more tests, and let the brief, not the tool's speed, set the scope.
