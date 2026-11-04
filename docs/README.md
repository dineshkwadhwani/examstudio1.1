# Exam Studio documentation

This directory is the canonical handoff for Exam Studio. It describes the repository as audited on **2026-11-05 (Asia/Kolkata)**. Start with [TRANSFER.md](TRANSFER.md) when moving the project to another machine, then read [ARCHITECTURE.md](ARCHITECTURE.md) and [DATABASE.md](DATABASE.md).

## Documents

- [TRANSFER.md](TRANSFER.md) — clean-machine setup, secrets, local development, deployment, and handoff checklist.
- [ARCHITECTURE.md](ARCHITECTURE.md) — runtime architecture, authentication, boundaries, data flow, and security.
- [ROUTES.md](ROUTES.md) — every page and API route, grouped by audience and authorization.
- [MODULES.md](MODULES.md) — every `lib/`, component, script, public asset, and test module.
- [DATABASE.md](DATABASE.md) — schema families, migration history 001–036, constraints, and migration hazards.
- [CA1.md](CA1.md) — original practical examination, sessions, papers, Apify tasks, grading, and reports.
- [CA1-LEGACY-ASSESSMENTS.md](CA1-LEGACY-ASSESSMENTS.md) — merged assessment/cohort/paper workflow and legacy import repair.
- [CA3.md](CA3.md) — teams, artifacts, rubric, GitHub analysis, Groq evaluation, scoring, publication, and Insights.
- [OPERATIONS.md](OPERATIONS.md) — exam-day and evaluation-day runbooks, recovery procedures, and data checks.
- [TESTING.md](TESTING.md) — validation commands, test coverage, and known build/lint caveats.
- [AUDIT-2026-11-05.md](AUDIT-2026-11-05.md) — file inventory, verified facts, drift findings, and follow-up risks.

## Source-of-truth rules

1. `package.json` is authoritative for dependency versions and commands.
2. Applied Supabase migrations are append-only. Add a new migration; do not edit an applied one.
3. `.env.local` and production environment settings are secrets/configuration, never documentation artifacts.
4. Server routes are the authorization boundary. Client-side hidden buttons are not security controls.
5. Effective marks use overrides when present, including a zero override.

The root `README.md`, `HANDOFF.md`, `CLAUDE.md`, `AGENTS.md`, and `VSCODE_PROMPT.md` remain useful entry points, but this directory is the maintained technical handoff. Historical statements in older files are not authoritative when they conflict with this set or with the current source.
