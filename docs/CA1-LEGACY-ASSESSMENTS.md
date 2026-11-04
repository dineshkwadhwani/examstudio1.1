# CA1 merged assessment subsystem

## Purpose

Migrations 021–024 merge the previous assessment application into Exam Studio. This is separate from the original 15-mark practical exam tables, although both use the `ca1_` prefix and the same root student directory.

## Normalized tables

- `ca1_assessments` — assessment definitions and marks configuration.
- `ca1_assessment_questions` — question banks, CO/Bloom metadata, correct answers/model answers.
- `ca1_assessment_cohorts` — named cohorts.
- `ca1_assessment_cohort_members` — student/cohort membership.
- `ca1_assessment_assignments` — assessment assignment to a cohort/student.
- `ca1_assessment_papers` — one paper per assessment/student pair, with status and score.
- `ca1_assessment_paper_questions` — paper questions, answers, marks, feedback, and evaluation status.
- `ca1_assessment_evaluation_jobs` — asynchronous evaluation job state.
- `ca1_assessment_identity_map` — legacy profile to root `ca1_students` mapping.
- `ca1_assessment_identity_issues` — unmapped/ambiguous identity diagnostics.

## Legacy import

Migration 021 imports the old assessment structure when source tables exist. Migration 022 backfills cohort membership. Migrations 023–024 union legacy-only users and repair PRN sourcing from `profiles.prn_id`.

Migration 035 is an additive repair for papers that appeared after the original import. It:

1. Rebuilds email-based identity mappings.
2. Re-imports assignments.
3. Selects the latest legacy paper for each assessment/student pair to respect the normalized unique key.
4. Maps every source paper to the integrated paper.
5. Reconciles paper questions by both legacy ID and paper/order so duplicate import attempts do not violate uniqueness.

Two legacy students without identity mappings are intentionally skipped until their root accounts can be matched. Do not invent mappings based on names alone.

## Results UI behavior

`/sa/ca1/results` calls `/api/sa/assessment-results`. Blank assessment, cohort, and date parameters mean no filter. The API conditionally applies `.eq`, `.gte`, and `.lt`; it does not use sentinel dates, so papers with `submitted_at IS NULL` remain visible in an unfiltered result set.

## Safe repair procedure

- First count source papers, identity mappings, assessment links, assignment links, and importable rows.
- Inspect duplicate assessment/student pairs before repair.
- Apply migration 035 once.
- Re-run counts and verify paper/question uniqueness.
- Preserve the two intentionally unmatched records until identity evidence is available.
