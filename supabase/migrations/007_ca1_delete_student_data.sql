-- Delete a student's account and all linked exam data while preserving the
-- roster entry so the student can register again later.
CREATE OR REPLACE FUNCTION ca1_delete_students(p_student_ids BIGINT[])
RETURNS TABLE(deleted_count BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
  ids BIGINT[];
  prns TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT id ORDER BY id)
  INTO ids
  FROM ca1_students
  WHERE id = ANY(p_student_ids);

  IF ids IS NULL OR CARDINALITY(ids) = 0 THEN
    RETURN QUERY SELECT 0::BIGINT;
    RETURN;
  END IF;

  -- Keep the PRNs only long enough to remove student-attributed audit rows.
  PERFORM 1 FROM ca1_students WHERE id = ANY(ids) FOR UPDATE;

  SELECT ARRAY_AGG(prn) INTO prns
  FROM ca1_students
  WHERE id = ANY(ids);

  -- Flags can involve more than one student. Remove deleted IDs from shared
  -- flags and delete a flag only when it no longer names any student.
  UPDATE ca1_flags
  SET student_ids = ARRAY(
    SELECT student_id
    FROM UNNEST(student_ids) AS source(student_id)
    WHERE NOT student_id = ANY(ids)
  )
  WHERE student_ids && ids;

  DELETE FROM ca1_flags WHERE CARDINALITY(student_ids) = 0;

  DELETE FROM ca1_audit_log
  WHERE target = ANY(ARRAY(SELECT 'student:' || value::TEXT FROM UNNEST(ids) AS id(value)))
     OR actor = ANY(ARRAY(SELECT 'student:' || value FROM UNNEST(prns) AS prn(value)));

  -- API keys, papers, MCQ assignments, submissions, attempts, and exceptions
  -- are removed by their ON DELETE CASCADE foreign keys.
  DELETE FROM ca1_students WHERE id = ANY(ids);

  RETURN QUERY SELECT CARDINALITY(ids)::BIGINT;
END;
$$;
