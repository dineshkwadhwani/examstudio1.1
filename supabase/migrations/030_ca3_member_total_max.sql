-- Individual contribution is added to the allocated project score.
-- Per-member totals therefore have a maximum of 45 (40 project + 5 contribution).
ALTER TABLE ca1_project_individual_scores
  DROP CONSTRAINT IF EXISTS ca1_project_individual_scores_total_override_check;

ALTER TABLE ca1_project_individual_scores
  ADD CONSTRAINT ca1_project_individual_scores_total_override_check
    CHECK (student_total_override IS NULL OR (student_total_override >= 0 AND student_total_override <= 45));
