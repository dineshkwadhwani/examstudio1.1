<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Exam Studio — full project handoff

## Product

Exam Studio is a practical-examination platform for the Symbiosis Institute of Technology, Pune. The current product label is **F0003 CA2/CA3**. It supports student registration, MCQs, individualized question papers, Apify-based task submissions, grading, results, and student project teams.

## Stack and runtime

- Next.js `16.3.4` with the App Router; React `19.2.8`; TypeScript.
- Tailwind CSS 4 through `@tailwindcss/postcss`.
- Supabase PostgreSQL accessed with `@supabase/supabase-js`.
- Vercel deployment.
- `jose` for signed sessions, `bcryptjs` for passwords, `pdf-lib`, `xlsx`, Apify, and Open-Meteo integrations.
- The authoritative dependencies and commands are in `package.json`. The older README wording may say Next.js 15; use the installed/package version and the Next.js docs in `node_modules/next/dist/docs/`.

## Repository structure

- `app/`: App Router pages and route handlers.
- `app/api/auth/`: student/staff login, registration, logout, and password changes.
- `app/api/me/`: authenticated student APIs.
- `app/api/sa/`: Super Admin APIs.
- `app/api/v1/`: API-key-authenticated endpoints used by student actors.
- `components/student/`: student header/account navigation.
- `components/ui/`: reusable UI components.
- `lib/db.ts`: lazy Supabase service-role client and audit helper.
- `lib/session.ts`: signed cookie session creation and guards.
- `lib/api.ts`: JSON response helpers, API-key resolution, active/open exam helpers, and hashing utilities.
- `lib/grading.ts`, `lib/paper.ts`, `lib/student-session.ts`, `lib/test-submission.ts`, and `lib/session-lifecycle.ts`: exam-domain services.
- `supabase/migrations/`: numbered SQL migrations. Apply in order.
- `scripts/`: corpus, spreadsheet, and Super Admin password-hash utilities.
- `tests/`: existing Node/MJS tests for database, API keys, reports, and student exams.
- `test/actors/`: actor-side practical task test material.

## Authentication and authorization

The application uses a signed, HTTP-only `ca1_session` cookie. `lib/session.ts` exposes `getSession()`, `requireStudent()`, `requireStaff()`, and `requireSA()` (`role === 'sa'`).

Student sessions contain the student ID, PRN, name, email, and password-change state. Staff sessions contain staff ID, email, name, and role (`sa` or `invigilator`).

All database access is server-side through the Supabase service-role key. RLS is enabled on the CA1 tables and denies anon/authenticated access. Do not query Supabase directly from client components and do not put service-role credentials in client code.

Every route handler must perform its own authorization check. Do not rely only on page navigation or hidden buttons. Use the response helpers from `lib/api.ts` consistently. Use `audit()` for important state changes such as login, team creation, team submission, team approval/rejection, team edits, and membership changes.

## Exam domain

The CA1 schema includes exam definitions, tasks, MCQ slots/questions/assignments, exam sessions, roster, students, API keys, question papers, submissions, attempts, flags, exceptions, staff, and audit logs.

Main student flow:

1. A roster PRN must exist before a student can register.
2. Registration is available only while an exam session is open for registration.
3. Student logs in, completes MCQs, fetches an individualized paper, performs the practical tasks, submits through the UI/API, and can view results when released.
4. Student actor APIs use `X-API-Key` and are under `/api/v1/*`.

Do not change exam scoring, session lifecycle, or API-key behavior while modifying teams unless the task explicitly requires it.

## Student team feature

Team tables are introduced by `supabase/migrations/012_ca1_teams.sql`, `supabase/migrations/013_ca1_team_rejoin.sql`, and `supabase/migrations/014_ca1_team_review.sql`. Apply these migrations in order. Migration 013 removes the historical full membership uniqueness constraint and replaces it with a partial active-membership index so a student can leave and later rejoin the same team. Migration 014 adds the Super Admin project strength and review comments.

CA3 artifacts and evaluation are introduced by migrations `015` through `018`. Migration 015 stores one artifact submission per approved team, per-category shared scores, individual contribution scores, GitHub usernames, and the CA3 publication flag. Migration 016 stores traceable GitHub contribution statistics. Migration 017 adds private Supabase Storage for the synopsis and design-document PDFs. Migration 018 adds raw fields for the automated GitHub contribution scorecard. The demo video remains a mandatory external URL stored in the existing artifact record. Apply them after 014; do not renumber or edit an already-applied migration.

### Team rules

- Any registered student can create a team.
- A team name is mandatory even for a saved draft and is unique case-insensitively.
- A team can have a minimum of 3 and maximum of 4 active members for approval submission.
- A roster student can be added before registering. This reserves their PRN; they must register later to access the application/team.
- A student/roster PRN can have only one active team reservation at a time.
- Membership is immediate; there is no invitation/acceptance workflow.
- Students can search the full roster by name or PRN.
- Draft and rejected teams can be edited by their registered members: rename, add/remove members, and provide project details.
- A student may leave a draft/rejected team. A reservation is released by setting `left_at`; historical rows are retained.
- A team may be saved without project name/description, but cannot be submitted without both.
- Submission requires exactly 3 or 4 active members, a project name, and a project description.
- Submission changes status to `pending_approval`.
- Super Admin approval changes status to `approved`.
- Super Admin rejection requires a reason and changes status to `rejected`; students can edit and resubmit.
- Student artifact fields remain editable after submission; saving final Super Admin scores changes artifact status to `locked` and permanently disables further student edits.
- Super Admin can explicitly edit any team, including approved teams: team name, project details, active members, project strength (0–10), and review comments.
- Project strength and review comments are Super Admin review data and must not be returned by the student team API or shown to students.
- All team members have equal access to the team page; there is no separate owner permission model for student edits.

### Team database model

`ca1_teams` stores the team name, optional project fields, project strength, review comments, creator, status, rejection reason, submission/review metadata, and timestamps.

`ca1_team_members` stores active and historical reservations. `roster_prn` is required and references `ca1_roster`; `student_id` may be null until the roster student registers. Active reservations have `left_at IS NULL` and are protected by a unique partial index on `roster_prn`. Migration 013 adds a second partial index preventing duplicate active membership of the same PRN in the same team while allowing historical rejoin rows.

### Team routes

- Student UI: `/team`.
- Student API: `GET/POST /api/me/team`.
- Super Admin list/export: `/sa/teams` and `GET /api/sa/teams`.
- Super Admin CSV export: `GET /api/sa/teams?format=csv`.
- Super Admin review actions: `POST /api/sa/teams` with `approve` or `reject`.
- Super Admin detail/edit UI: `/sa/teams/[id]`.
- Super Admin detail/search/edit API: `GET/POST /api/sa/teams/[id]`.

The CSV export contains one row per team with team ID/name, status, project name/description, rejection reason, and up to four active member name/PRN pairs.

When a previously unregistered reserved roster student registers, `app/api/auth/register/route.ts` links their new `student_id` to the active reservation so they can see `/team`.

## Database and migrations

Migrations are plain SQL and must be applied in numeric order. The current sequence ends at 018. Do not edit an already-applied migration to change production behavior; add a new numbered migration instead.

Important migration sequence:

- `001_ca1_schema.sql`: base schema and RLS.
- `002_ca1_seed.sql`: staff, roster, and seed data.
- `003`–`011`: corpus, task, session, submission, actor, results, and MCQ changes.
- `012_ca1_teams.sql`: initial team schema.
- `013_ca1_team_rejoin.sql`: allows rejoining a team after leaving.
- `014_ca1_team_review.sql`: adds the nullable 0–10 project strength and editable review comments.
- `015_ca1_project_artifacts.sql`: adds CA3 artifact submissions, rubric score tables, individual scores, and results publication state.
- `016_ca1_github_contribution_stats.sql`: adds traceable GitHub contribution statistics for individual evaluation support.
- `017_ca1_artifact_pdf_storage.sql`: adds synopsis/design PDF storage paths and the private `ca3-artifacts` Storage bucket.
- `018_ca1_github_scorecard.sql`: adds review-comment and primarily-owned-file fields used by automated contribution analysis.

All tables use the `ca1_` prefix. Preserve the existing deny-all RLS policy pattern when adding tables.

## Development commands

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

For focused validation, lint modified files as well as running `npx tsc --noEmit`. Existing repository-wide lint may report unrelated legacy errors; distinguish those from errors introduced by the current change.

Do not run destructive commands such as `git reset --hard` or broad deletes. Preserve unrelated worktree changes.

## Environment variables

Required server variables are documented in `.env.example` and normally provided in `.env.local`/Vercel:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `APIFY_API_TOKEN`
- `NEXT_PUBLIC_APP_URL`
- `GITHUB_ANALYSIS_TOKEN` (optional; server-side GitHub contribution analysis)

Never print secret values, commit `.env.local`, or include secrets in error messages.

## Editing conventions

- Follow the existing App Router conventions and read the relevant installed Next.js guide before introducing new routing/server APIs.
- Use route handlers for mutations when that matches the surrounding code; authenticate inside the handler.
- Keep interactive components marked `'use client'`; keep database access out of client components.
- Use `apply_patch` for file edits.
- Prefer `rg`/`rg --files` for searching.
- Keep UI consistent with existing Tailwind classes, student light theme, and Super Admin dark theme.
- Use accessible labels, status/error regions, and clear loading/disabled states.
- Avoid changing unrelated exam functionality while working on teams.
