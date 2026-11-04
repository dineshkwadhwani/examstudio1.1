# Testing and validation

## Required checks before handoff

```bash
npx tsc --noEmit
npm run lint
npm run build
node --test tests/*.mjs
```

The repository has no `test` npm script, so use the explicit Node command. `npm run lint` invokes the repository ESLint configuration. If a full build fails because a worker or local environment is restricted, record the exact error and test with the supported fallback rather than hiding it.

Audit result on 2026-11-05: `npx tsc --noEmit` passed. Full ESLint reported pre-existing errors in legacy React effects and generated/CommonJS script files; it did not report errors in the new `docs/` files. The Node suite ran 14 tests: 12 passed, while the stale database/report suites failed because `scripts/database.mjs` and `lib/report-math.ts` are absent from the current tree. The API-key and student-exams suites passed. Default `npm run build` hit a restricted-environment Turbopack worker-port error; `npm run build -- --webpack` completed successfully and enumerated all routes.

## Existing test coverage

- `tests/api-key.test.mjs` — missing/misplaced/invalid/revoked/valid API keys and secret non-leakage.
- `tests/database.test.mjs` — pooler URL, TLS CA, hostname matching, password redaction.
- `tests/reports.test.mjs` — effective marks/zero overrides, statistics, attainment, item analysis, PDF and XLSX output, authorization and debrief/report routes.
- `tests/student-exams.test.mjs` — session history union, pagination beyond 1,000 rows, database failures, profile authorization.
- `tests/actors/` and `test/actors/` — actor-side material; not a full integration test suite.

## Manual smoke tests

- Student registration with valid/invalid PRN and email.
- Login, password change, API key reveal, MCQ save, paper fetch.
- One Task 1/2/3 submission and result release.
- CA2/CA3 session registration from an already registered student.
- Team draft, membership reservation, artifact submission, PDF upload, presentation date.
- GitHub analysis with public repository, multiple branches, duplicate username, and missing username.
- Groq single-category evaluation, batch evaluation log, rate-limit key rotation, retry stop behavior.
- Save Scores and Evaluation Complete after scores already completed.
- CA3 Results filters/export/status tiles and Insights links.
- CA1 Results with All assessments + All cohorts, a selected cohort, selected date, pending papers, and completed papers.

## Security checks

- Search client bundles for service-role key names/values.
- Confirm route handlers reject anonymous and wrong-role requests.
- Confirm reports do not expose private PDFs or API keys.
- Confirm spreadsheet/roster imports validate inputs and do not mutate unrelated students.
