# Exam Studio project context

Read `AGENTS.md` before making changes. It contains the full project handoff, architecture, database model, team-management rules, security boundaries, and verification commands.

## Quick orientation

- This is the Exam Studio practical-examination platform for F0003 CA2/CA3.
- The application uses Next.js 16.3.4 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase, and Vercel.
- Authentication is implemented with signed HTTP-only cookies in `lib/session.ts`; database access is server-side through the Supabase service-role client in `lib/db.ts`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, or other secrets to client components.
- Student routes are under `/`, `/team`, `/dashboard`, `/profile`, `/results`, and `/my-exams`.
- Super Admin routes are under `/sa/*`; Super Admin authorization must use `requireSA()`.
- API route handlers are under `app/api/**/route.ts` and should validate authentication and authorization inside every handler.

## Current feature focus

Student project teams, CA3 artifact submission, and Super Admin review are implemented by migrations `012_ca1_teams.sql` through `018_ca1_github_scorecard.sql`. Migration 014 is reserved for team review fields; artifacts begin at 015, GitHub contribution statistics at 016, private synopsis/design PDF storage at 017, and automated GitHub scorecard fields at 018. The mandatory demo video remains an external URL using the field from migration 015. Apply them in numeric order. See `AGENTS.md` for the complete lifecycle and route details.

CA3 student routes are `/project/guidelines`, `/project/artifacts`, and `/project/results`. Super Admin evaluation is available at `/sa/projects` and `/sa/teams/[id]/artifacts`. Student artifact fields remain editable after submission; saving final Super Admin scores permanently changes the artifact status to `locked`. Results remain hidden until the Super Admin publishes them.

When changing this project, preserve existing user changes, use `apply_patch` for edits, and run the relevant TypeScript and ESLint checks before handoff.
