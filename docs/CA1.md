# CA1 practical examination

## Exam structure

The seeded exam is `F0003-CA1-2026 — CA1 Practical Examination — Autonomous AI Systems and Agent-Based Computing`.

| Component | Marks | Mechanism |
|---|---:|---|
| MCQ | 5 | Ten questions, 0.5 each, saved per click. |
| Task 1 | 1 | Magic-colour response. |
| Task 2 | 4 | Exact corpus total/scoped counts plus valid Apify run. |
| Task 3 | 5 | City match and temperature tolerance. |
| Total | 15 | Effective marks after overrides. |

The exact task component definitions live in migrations 002 and 004. Treat the database as authoritative if this summary conflicts with an old handoff file.

## Session lifecycle

`setup → registration_open → running → closed → archived`.

- Registration creates or links a student account; it does not automatically register a student for every future session.
- A student must be registered for the session to take it.
- Only a running session accepts the practical API calls.
- Expired sessions are closed by polling/cron lifecycle code and pending Apify work is delayed before verification.
- Results are released explicitly by the Super Admin after verification.

## Personalized papers

`lib/paper.ts` derives deterministic values from PRN plus session ID: target word, scoped page, MCQ question selection, option order, and magic colour. Papers are session-scoped and idempotent. The spreadsheet snapshot is frozen per session; corpus/reference data belongs to the exam definition.

## Student task flow

1. Register with a roster PRN and `@sitpune.edu.in` email.
2. Log in and generate the API key.
3. Complete MCQs; each click is saved immediately.
4. When the session runs, fetch the paper from the dashboard and/or `/api/v1/paper`.
5. Submit Task 1 through the UI and Tasks 2/3 through the API.
6. The server records attempts and grades after the session closes and verification is due.

## Reports

The report subsystem includes marks sheets, student PDFs, CO attainment, item analysis, exception records, and post-close MCQ debriefs. See `REPORTS_SETUP.md` for the historical report details and [TESTING.md](TESTING.md) for report tests.

## CA1 operational warnings

- Do not delete a session or student without understanding migrations 007/008; those are destructive database functions.
- Do not expose raw API keys or full student paper data in logs.
- When using “All assessments” and “All cohorts” in CA1 Results, leave both filters blank and click Search. The API treats blank filters as no restriction and includes pending and completed papers.
