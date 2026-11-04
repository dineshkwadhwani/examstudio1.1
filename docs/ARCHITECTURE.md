# Architecture

## Runtime

Exam Studio is a Next.js 16.3.4 App Router application using React 19.2.8, TypeScript, Tailwind CSS 4, and Supabase Postgres. Server routes use a lazy service-role Supabase client from `lib/db.ts`. Client components communicate with route handlers using `fetch`; they do not import database/session modules.

## Trust boundaries

1. **Browser/student UI** — receives only the authenticated student’s data and public-safe configuration.
2. **Student cookie routes** — `/api/me/*`, `/api/mcq`, `/api/keys`, and auth routes; each validates the signed cookie.
3. **Exam API** — `/api/v1/*`; requires `X-API-Key`, resolves it to a student, and enforces the student’s relevant session.
4. **Staff/Super Admin routes** — `/api/sa/*`; handlers call `requireStaff()` or `requireSA()` themselves.
5. **Database and external providers** — Supabase service role, GitHub, Apify, Open-Meteo, Groq, and private Storage are server-side only.

## Authentication

`lib/session.ts` signs a 24-hour HTTP-only cookie named `ca1_session` with `jose`. Student sessions contain the student identity; staff sessions contain staff identity and role. `requireSA()` requires a staff session with `role === 'sa'`. Passwords use bcryptjs. The registration route validates institutional email, phone, PRN roster membership, and an open registration session.

## Main data flows

### CA1 practical exam

Roster → student account → session registration/assignment → MCQ and paper → API-key task submissions → delayed Apify verification → closed/archived results → reports.

### CA1 merged assessments

Legacy `profiles`, `assessments`, `assignments`, `student_papers`, and `paper_questions` are imported into normalized `ca1_*` assessment tables. `ca1_assessment_identity_map` links legacy profiles to root students. Migration 035 repairs late/duplicate imports idempotently, selecting one source paper per assessment/student pair and reconciling paper questions.

### CA3 project evaluation

Roster/student accounts → team membership → project artifacts → Submitted → Presented → Evaluation Complete → published student results. Shared project scores cover six rubric categories; GitHub contribution creates per-member scores and differential allocation for three categories.

## Important invariants

- Only one original practical exam session may be `running` via a partial unique index.
- CA2/CA3 session registration is separate from student account registration (`ca1_exam_session_registrations`).
- A student may have multiple papers across sessions, but not duplicate paper/assessment/student pairs in the merged assessment subsystem.
- CA3 artifact status and `evaluation_status` are separate historically; migration 036 promotes completed evaluations to terminal `evaluation_complete` status.
- Effective marks are `override_marks ?? marks_awarded`; zero overrides are valid and must not fall back to system marks.
- CA3 evaluation does not overwrite manual Live Demo, Presentation, or contribution overrides when automated category evaluation runs.
- GitHub analysis unions the default branch, any submitted branch hint, and all visible branches, deduplicating commits by SHA.

## External dependencies

- GitHub REST API: repository metadata, branches, commits/details, pull requests, reviews.
- Apify API: run, dataset, and actor source inspection.
- Open-Meteo: no-key current temperature lookup.
- Groq OpenAI-compatible chat endpoint: category suggestions and subjective assessment evaluation; key rotation is process-local.
- Supabase Storage: private PDF artifact storage.
