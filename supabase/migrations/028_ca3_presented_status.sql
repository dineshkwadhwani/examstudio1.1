-- Allow the Super Admin to mark submitted CA3 artifacts as presented.
-- Presented artifacts are locked for student edits but can be returned to
-- submitted before final scoring.
ALTER TABLE ca1_project_artifacts
  DROP CONSTRAINT IF EXISTS ca1_project_artifacts_status_check;

ALTER TABLE ca1_project_artifacts
  ADD CONSTRAINT ca1_project_artifacts_status_check
  CHECK (status IN ('draft', 'submitted', 'presented', 'locked'));
