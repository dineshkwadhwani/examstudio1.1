-- Delete one exam session and its exam work while keeping student accounts,
-- roster entries, and reusable API keys intact.
CREATE OR REPLACE FUNCTION ca1_delete_exam_session(p_session_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE session_status TEXT;
BEGIN
  SELECT status INTO session_status
  FROM ca1_exam_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF session_status IN ('registration_open', 'running') THEN
    RAISE EXCEPTION 'Close the exam before deleting it.';
  END IF;

  DELETE FROM ca1_flags WHERE session_id = p_session_id;
  DELETE FROM ca1_audit_log WHERE target = 'session:' || p_session_id::TEXT;
  DELETE FROM ca1_submission_attempts WHERE session_id = p_session_id;
  DELETE FROM ca1_submissions WHERE session_id = p_session_id;
  DELETE FROM ca1_mcq_assignments WHERE session_id = p_session_id;
  DELETE FROM ca1_question_papers WHERE session_id = p_session_id;
  DELETE FROM ca1_exam_sessions WHERE id = p_session_id;

  RETURN TRUE;
END;
$$;
