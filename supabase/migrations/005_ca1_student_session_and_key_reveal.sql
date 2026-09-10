-- Make student work session-scoped. A student may take a later scheduled
-- session without their earlier paper, answers, or MCQs being reused.
ALTER TABLE ca1_question_papers
  DROP CONSTRAINT IF EXISTS ca1_question_papers_student_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS ca1_question_papers_student_session_key
  ON ca1_question_papers (student_id, session_id);

ALTER TABLE ca1_mcq_assignments
  ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES ca1_exam_sessions(id);
UPDATE ca1_mcq_assignments a
SET session_id = p.session_id
FROM ca1_question_papers p
WHERE p.student_id = a.student_id
  AND a.session_id IS NULL;
ALTER TABLE ca1_mcq_assignments
  DROP CONSTRAINT IF EXISTS ca1_mcq_assignments_student_id_slot_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS ca1_mcq_assignments_student_session_slot_key
  ON ca1_mcq_assignments (student_id, session_id, slot_no);

ALTER TABLE ca1_submissions
  ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES ca1_exam_sessions(id);
UPDATE ca1_submissions s
SET session_id = p.session_id
FROM ca1_question_papers p
WHERE p.student_id = s.student_id
  AND s.session_id IS NULL;
ALTER TABLE ca1_submissions
  DROP CONSTRAINT IF EXISTS ca1_submissions_student_id_task_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS ca1_submissions_student_session_task_key
  ON ca1_submissions (student_id, session_id, task_no);

ALTER TABLE ca1_submission_attempts
  ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES ca1_exam_sessions(id);
UPDATE ca1_submission_attempts a
SET session_id = p.session_id
FROM ca1_question_papers p
WHERE p.student_id = a.student_id
  AND a.session_id IS NULL;
ALTER TABLE ca1_submission_attempts
  DROP CONSTRAINT IF EXISTS ca1_submission_attempts_student_id_task_no_attempt_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS ca1_submission_attempts_student_session_task_attempt_key
  ON ca1_submission_attempts (student_id, session_id, task_no, attempt_no);

-- API keys remain hashed for authentication. The encrypted copy lets the
-- authenticated owner reveal a key later without storing it in plaintext.
ALTER TABLE ca1_api_keys
  ADD COLUMN IF NOT EXISTS key_ciphertext TEXT;
