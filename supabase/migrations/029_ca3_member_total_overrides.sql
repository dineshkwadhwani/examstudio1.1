-- Store the final per-member CA3 total after the differential allocation pass.
-- A NULL value means the review page should use the calculated allocation.
ALTER TABLE ca1_project_individual_scores
  ADD COLUMN student_total_override NUMERIC(5,2),
  ADD CONSTRAINT ca1_project_individual_scores_total_override_check
    CHECK (student_total_override IS NULL OR (student_total_override >= 0 AND student_total_override <= 40));
