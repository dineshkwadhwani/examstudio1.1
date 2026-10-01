-- Super Admin project review fields, editable throughout the approval lifecycle.
ALTER TABLE ca1_teams
  ADD COLUMN project_strength NUMERIC(4,2),
  ADD COLUMN review_comments TEXT;

ALTER TABLE ca1_teams
  ADD CONSTRAINT ca1_teams_project_strength_range
  CHECK (project_strength IS NULL OR (project_strength >= 0 AND project_strength <= 10));
