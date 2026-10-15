-- Add Super Admin-only assessment review notes. The existing review_comments
-- column remains the initial review shown to students.
ALTER TABLE ca1_teams
  ADD COLUMN assessment_review_comments TEXT;
