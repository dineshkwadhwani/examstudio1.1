-- A registered Exam Studio student must explicitly register for each CA2/CA3
-- session. Account registration and exam-session registration are separate.
CREATE TABLE ca1_exam_session_registrations (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES ca1_exam_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES ca1_students(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX ca1_exam_session_registrations_student_idx
  ON ca1_exam_session_registrations (student_id, registered_at DESC);

CREATE INDEX ca1_exam_session_registrations_session_idx
  ON ca1_exam_session_registrations (session_id);

-- Preserve access for students who already participated in a session before
-- this registration table was introduced.
INSERT INTO ca1_exam_session_registrations (session_id, student_id)
SELECT DISTINCT session_id, student_id
FROM (
  SELECT session_id, student_id FROM ca1_question_papers
  UNION
  SELECT session_id, student_id FROM ca1_mcq_assignments
  UNION
  SELECT session_id, student_id FROM ca1_submissions
) existing
WHERE session_id IS NOT NULL;

ALTER TABLE ca1_exam_session_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_ca1_exam_session_registrations"
  ON ca1_exam_session_registrations FOR ALL USING (false);
