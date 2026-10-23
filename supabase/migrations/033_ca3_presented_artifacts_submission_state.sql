-- Normalize existing Presented CA3 artifacts.
-- Presented artifacts must retain the submitted state and timestamp while
-- remaining locked for student edits by virtue of status = 'presented'.
BEGIN;

DO $$
DECLARE
  presented_ids UUID[];
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO presented_ids
  FROM ca1_project_artifacts
  WHERE status = 'presented';

  -- Preserve an existing timestamp; otherwise use the last update time or now.
  UPDATE ca1_project_artifacts
  SET status = 'submitted',
      submitted_at = COALESCE(submitted_at, updated_at, now()),
      updated_at = now()
  WHERE id = ANY(presented_ids);

  -- Return only those originally Presented artifacts to Presented. No external
  -- session can observe the temporary Submitted state.
  UPDATE ca1_project_artifacts
  SET status = 'presented',
      updated_at = now()
  WHERE id = ANY(presented_ids);
END $$;

COMMIT;
