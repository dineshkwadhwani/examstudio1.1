-- Make CA3 evaluation completion the terminal artifact workflow state.
-- Presented remains the required precondition and evaluation_complete remains
-- locked for student edits.
ALTER TABLE ca1_project_artifacts
  DROP CONSTRAINT IF EXISTS ca1_project_artifacts_status_check;

ALTER TABLE ca1_project_artifacts
  ADD CONSTRAINT ca1_project_artifacts_status_check
  CHECK (status IN ('draft', 'submitted', 'presented', 'evaluation_complete', 'locked'));

-- Preserve evaluations completed before this workflow state was introduced.
-- Only Presented artifacts may be promoted automatically.
UPDATE ca1_project_artifacts
   SET status = 'evaluation_complete',
       updated_at = COALESCE(evaluated_at, updated_at, now())
 WHERE status = 'presented'
   AND evaluation_status = 'evaluated';
