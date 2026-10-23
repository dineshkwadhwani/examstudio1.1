-- CA3 member totals include the project marks (/40) plus contribution (/5).
-- Replace the original migration 029 limit of 40 with the correct maximum 45.
ALTER TABLE ca1_project_individual_scores
  DROP CONSTRAINT IF EXISTS ca1_project_individual_scores_total_override_check;

ALTER TABLE ca1_project_individual_scores
  ADD CONSTRAINT ca1_project_individual_scores_total_override_check
    CHECK (
      student_total_override IS NULL
      OR (student_total_override >= 0 AND student_total_override <= 45)
    );
