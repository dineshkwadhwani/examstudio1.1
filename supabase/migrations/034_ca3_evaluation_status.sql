-- Track whether the Super Admin has completed the CA3 evaluation.
-- This is separate from artifact status: Submitted/Presented continue to
-- describe the student submission and locking lifecycle.
ALTER TABLE ca1_project_artifacts
  ADD COLUMN evaluation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN evaluated_at TIMESTAMPTZ,
  ADD COLUMN evaluated_by BIGINT REFERENCES ca1_staff(id),
  ADD CONSTRAINT ca1_project_artifacts_evaluation_status_check
    CHECK (evaluation_status IN ('pending', 'evaluated'));
