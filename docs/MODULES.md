# Module inventory

## `lib/`

- `api.ts` — response helpers, API-key resolution, session lookup, hashing, source IP.
- `api-key-vault.ts` — encryption/decryption support for stored API-key values where used.
- `db.ts` — lazy Supabase service-role client and audit helper.
- `session.ts` — signed cookie sessions and auth guards.
- `types.ts` — shared exam, student, session, submission, assessment, and API types.
- `paper.ts` — deterministic paper/MCQ/magic-code generation.
- `grading.ts` — Task 2/3 grading, effective marks, pending Apify verification.
- `apify.ts` — Apify run/dataset/source retrieval and verification.
- `weather.ts` — Open-Meteo current temperature retrieval.
- `test-submission.ts` — final-submission availability and write errors.
- `session-lifecycle.ts` — close/verification delay orchestration.
- `student-session.ts` and `student-exams.ts` — session registration and exam-history selection.
- `assessment.ts` — merged assessment paper generation, retrieval, and Groq subjective evaluation.
- `artifacts.ts` — CA3 artifact fields, validation, PDF upload, presentation dates, submission.
- `ca3-rubric.ts` — six rubric categories and maximums.
- `ca3-scoring.ts` — differential category allocation and member totals.
- `github-analysis.ts` — branch/commit/PR/review analysis and per-member persistence.
- `groq.ts` — Groq request wrapper with primary/backup key rotation.
- `ca3-ai-evaluation.ts` — PDF/repository evidence extraction and category evaluation.

## Components

- `components/ui/Alert.tsx`, `Countdown.tsx`, `SaveTick.tsx` — reusable feedback/countdown/save indicators.
- `components/student/AccountMenu.tsx`, `PageHeader.tsx` — student shell/navigation.
- `components/student/ArtifactsForm.tsx` — CA3 artifact form and client interactions.
- `components/student/GithubContributionGuidance.tsx` — student GitHub guidance.
- `components/sa/Ca1Shell.tsx` — CA1 staff shell.
- `components/sa/Ca1QuestionReview.tsx` — question-bank review/editing.
- `components/sa/ProjectEvaluation.tsx` — individual CA3 team review and score persistence.
- `components/sa/CA3Evaluate.tsx` — batch evaluation controls, status selection, retries, and logs.
- `components/sa/CA3Insights.tsx` — CA3 evaluation/data-quality findings.
- `components/sa/CA3ResultsFiltered.tsx` — CA3 result filters, status tiles, table/export.

## Scripts and static files

- `scripts/generate-corpus.ts` — deterministic corpus/reference table generation.
- `scripts/generate-spreadsheet.ts` — deterministic Task 3 city spreadsheet.
- `scripts/generate-sa-hash.js` — staff bcrypt hash helper.
- `dist-scripts/` — generated compiled script artifacts; regenerate from source when needed.
- `public/corpus/` — five pages, index, manifest, reference table.
- `test/actors/` — student actor test material.
- `mcq-validation.json` — validation data; inspect before changing question-bank assumptions.

## UI implementation notes

Client components must use route APIs, not `db`, `session`, or service-role code. Next.js 16 build-time rules require `useSearchParams()` to be inside a Suspense boundary; preserve wrapper/page splits where present. Browser extensions can add body attributes and cause development hydration warnings; that is not necessarily application markup drift.
