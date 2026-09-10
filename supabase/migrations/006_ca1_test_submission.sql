-- Completion belongs to one student in one exam session.
ALTER TABLE ca1_question_papers
  ADD COLUMN IF NOT EXISTS test_submitted_at TIMESTAMPTZ;

-- Serialize answer writes with final submission by locking the student's paper.
-- Grading updates remain allowed because they do not change student answers.
CREATE OR REPLACE FUNCTION ca1_guard_finished_test()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE finished_at TIMESTAMPTZ;
BEGIN
  SELECT test_submitted_at INTO finished_at FROM ca1_question_papers
    WHERE student_id = NEW.student_id AND session_id = NEW.session_id
    FOR UPDATE;
  IF finished_at IS NOT NULL THEN
    RAISE EXCEPTION 'Test already submitted. No further answers accepted.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ca1_lock_finished_mcq ON ca1_mcq_assignments;
CREATE TRIGGER ca1_lock_finished_mcq
BEFORE INSERT OR UPDATE OF answered_key ON ca1_mcq_assignments
FOR EACH ROW EXECUTE FUNCTION ca1_guard_finished_test();

DROP TRIGGER IF EXISTS ca1_lock_finished_tasks ON ca1_submissions;
CREATE TRIGGER ca1_lock_finished_tasks
BEFORE INSERT OR UPDATE OF payload ON ca1_submissions
FOR EACH ROW EXECUTE FUNCTION ca1_guard_finished_test();

DROP TRIGGER IF EXISTS ca1_lock_finished_attempts ON ca1_submission_attempts;
CREATE TRIGGER ca1_lock_finished_attempts
BEFORE INSERT ON ca1_submission_attempts
FOR EACH ROW EXECUTE FUNCTION ca1_guard_finished_test();
