# Database and migrations

## Conventions

All application tables use the `ca1_` prefix. RLS is enabled with deny-all policies because the server uses the Supabase service role. Do not query the service-role client from browser code.

## Base/practical tables

`ca1_exam_definitions`, `ca1_exam_tasks`, `ca1_task_components`, `ca1_mcq_slots`, `ca1_mcq_questions`, `ca1_exam_sessions`, `ca1_roster`, `ca1_students`, `ca1_api_keys`, `ca1_question_papers`, `ca1_mcq_assignments`, `ca1_submissions`, `ca1_submission_attempts`, `ca1_flags`, `ca1_exceptions`, `ca1_staff`, and `ca1_audit_log` are created by migration 001 and extended by 002–011.

## Team/CA3 tables

- `ca1_teams`, `ca1_team_members` — migration 012; rejoin indexes in 013.
- `ca1_project_artifacts`, `ca1_project_scores`, `ca1_project_individual_scores`, `ca1_ca3_config` — migration 015.
- `ca1_github_contribution_stats` — migration 016; scorecard columns in 018.
- private Storage paths — migration 017.

## Merged assessment tables

Migrations 021–024 create the assessment, cohort, assignment, paper, paper-question, evaluation-job, identity-map, and identity-issue tables. They import legacy data when source tables are available.

## Migration ledger

| Migration | Purpose |
|---|---|
| 001 | Base practical schema, indexes, RLS. |
| 002 | Staff, exam definition, tasks, rubric, MCQ bank, roster seed. |
| 003 | Corpus on exam definition; session creation and sheet snapshot. |
| 004 | Magic-code Task 1 and mark/component redesign. |
| 005 | Session-scoped papers/MCQs/submissions and key reveal. |
| 006 | Final test submission and database locks. |
| 007 | Destructive student-data deletion function, roster preserved. |
| 008 | Destructive exam-session deletion function, reusable accounts retained. |
| 009 | Actor claims per session/task. |
| 010 | Explicit results release timestamp. |
| 011 | MCQ answer-position balancing. |
| 012 | Teams and active roster reservations. |
| 013 | Historical team rejoin support. |
| 014 | Project strength and review comments. |
| 015 | CA3 artifacts, shared/category/individual scores, publication config. |
| 016 | Raw GitHub contribution statistics. |
| 017 | Private synopsis/design PDF Storage paths and bucket. |
| 018 | Review comments and files-owned scorecard fields. |
| 019 | Presentation dates and capacity trigger (initially 20). |
| 020 | Capacity increased to 25. |
| 021 | Legacy assessment merge and identity diagnostics. |
| 022 | Legacy cohort-member backfill. |
| 023 | Legacy-only students union. |
| 024 | Legacy PRN/prn_id correction. |
| 025 | Super Admin assessment review comments. |
| 026 | Presentation date data migration to October 22/23. |
| 027 | AI evaluator feedback and metadata. |
| 028 | `presented` artifact status. |
| 029 | Per-member total override, initially max 40. |
| 030 (max) | Correct member total max to 45. |
| 030 (team review) | Data update for team 67 review decision. This is a data migration, not reusable schema. |
| 031 | Reassert member total max 45. |
| 032 | Explicit CA2/CA3 session registrations. |
| 033 | Normalize existing Presented artifacts with submitted timestamp. |
| 034 | Evaluation metadata: `evaluation_status`, `evaluated_at`, `evaluated_by`. |
| 035 | Repair late legacy assessment papers/questions and duplicate import collisions. |
| 036 | Add terminal `evaluation_complete` artifact status and promote evaluated Presented rows. |

## Migration hazards

- There are two files beginning with `030_`; apply both, and record which one was applied. The team review file contains a specific production data update and should not be blindly reused against another dataset.
- Migrations 007 and 008 define destructive functions; invocation is not part of normal setup.
- Migrations 021–024 conditionally reference legacy tables. On a database without those tables, follow their notices and do not fabricate source data.
- Migration 035 must handle both `legacy_id` and composite assessment/student uniqueness. Its question repair must handle both legacy ID and paper/order uniqueness.
- Migration 034 may already have been applied; do not re-run an unguarded `ADD COLUMN` statement. Migration 036 assumes its fields exist.
- Data migrations 026, 030 team review, 033, 035, and 036 should be backed up and verified with before/after counts.
