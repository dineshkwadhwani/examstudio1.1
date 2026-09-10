-- A student may replace a practical-task answer with another Actor, but an
-- Actor remains claimed by that student for this task and session. This keeps
-- the latest answer as the only graded entry without allowing an Actor to be
-- passed between API-key owners.
CREATE TABLE IF NOT EXISTS ca1_actor_claims (
  id          BIGSERIAL PRIMARY KEY,
  session_id  BIGINT NOT NULL REFERENCES ca1_exam_sessions(id) ON DELETE CASCADE,
  task_no     INT NOT NULL CHECK (task_no IN (2, 3)),
  actor_id    TEXT NOT NULL,
  student_id  BIGINT NOT NULL REFERENCES ca1_students(id) ON DELETE CASCADE,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, task_no, actor_id)
);

CREATE INDEX IF NOT EXISTS ca1_actor_claims_student_session_task_idx
  ON ca1_actor_claims (student_id, session_id, task_no);

-- Preserve ownership evidence from sessions that predate this table.
INSERT INTO ca1_actor_claims (session_id, task_no, actor_id, student_id, claimed_at)
SELECT session_id, task_no, submitted_actor_id, student_id, first_submitted_at
FROM ca1_submissions
WHERE task_no IN (2, 3)
  AND submitted_actor_id IS NOT NULL
ON CONFLICT (session_id, task_no, actor_id) DO NOTHING;

-- Actor identity, rather than the owner account, is the exclusivity rule.
DROP INDEX IF EXISTS ca1_uniq_apify_user_task;
