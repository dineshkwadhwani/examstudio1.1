-- ============================================================
-- CA1 Practical Examination Platform — Database Migration
-- Run this in your Supabase SQL editor
-- All tables prefixed ca1_
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Exam definitions ────────────────────────────────────────
CREATE TABLE ca1_exam_definitions (
  id                      BIGSERIAL PRIMARY KEY,
  code                    TEXT NOT NULL UNIQUE,
  title                   TEXT NOT NULL,
  course_code             TEXT NOT NULL DEFAULT 'F0003',
  total_marks             NUMERIC(4,1) NOT NULL DEFAULT 15,
  duration_minutes        INT NOT NULL DEFAULT 50,
  mcq_count               INT NOT NULL DEFAULT 10,
  mcq_marks_each          NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  email_domain            TEXT NOT NULL DEFAULT 'sitpune.edu.in',
  -- Corpus belongs to the exam definition, not to individual sessions
  corpus_path             TEXT NOT NULL DEFAULT '/corpus',
  corpus_hash             TEXT NOT NULL DEFAULT '',
  corpus_manifest         JSONB NOT NULL DEFAULT '[]',
  corpus_reference_table  JSONB NOT NULL DEFAULT '{}',
  created_by              TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Exam tasks ──────────────────────────────────────────────
CREATE TABLE ca1_exam_tasks (
  id             BIGSERIAL PRIMARY KEY,
  exam_id        BIGINT NOT NULL REFERENCES ca1_exam_definitions(id) ON DELETE CASCADE,
  task_no        INT NOT NULL,
  title          TEXT NOT NULL,
  marks          NUMERIC(3,1) NOT NULL,
  co_codes       TEXT[] NOT NULL,
  bloom_level    INT NOT NULL CHECK (bloom_level BETWEEN 1 AND 6),
  bloom_label    TEXT NOT NULL,
  requires_apify BOOLEAN NOT NULL DEFAULT FALSE,
  config         JSONB NOT NULL DEFAULT '{}',
  UNIQUE (exam_id, task_no)
);

-- ─── Task components ─────────────────────────────────────────
CREATE TABLE ca1_task_components (
  id           BIGSERIAL PRIMARY KEY,
  task_id      BIGINT NOT NULL REFERENCES ca1_exam_tasks(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  description  TEXT NOT NULL,
  marks        NUMERIC(3,1) NOT NULL,
  grading_rule TEXT NOT NULL CHECK (grading_rule IN ('exact','tolerance','gate')),
  tolerance    NUMERIC(6,2),
  UNIQUE (task_id, code)
);

-- ─── MCQ slots ───────────────────────────────────────────────
CREATE TABLE ca1_mcq_slots (
  id          BIGSERIAL PRIMARY KEY,
  exam_id     BIGINT NOT NULL REFERENCES ca1_exam_definitions(id) ON DELETE CASCADE,
  slot_no     INT NOT NULL,
  concept     TEXT NOT NULL,
  co_code     TEXT NOT NULL,
  bloom_level INT NOT NULL CHECK (bloom_level BETWEEN 1 AND 6),
  bloom_label TEXT NOT NULL,
  UNIQUE (exam_id, slot_no)
);

-- ─── MCQ questions bank ──────────────────────────────────────
CREATE TABLE ca1_mcq_questions (
  id            BIGSERIAL PRIMARY KEY,
  slot_id       BIGINT NOT NULL REFERENCES ca1_mcq_slots(id) ON DELETE CASCADE,
  stem          TEXT NOT NULL,
  options       JSONB NOT NULL,   -- [{key:'A',text:'...'}, ...]
  correct_key   TEXT NOT NULL,
  rationale     TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  times_served  INT NOT NULL DEFAULT 0,
  times_correct INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Exam sessions ───────────────────────────────────────────
CREATE TABLE ca1_exam_sessions (
  id               BIGSERIAL PRIMARY KEY,
  exam_id          BIGINT NOT NULL REFERENCES ca1_exam_definitions(id),
  label            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'setup'
                   CHECK (status IN ('setup','registration_open','running','closed','archived')),
  started_at       TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,

  -- Spreadsheet (frozen at session creation from TASK3_SHEET_CSV_URL env var)
  sheet_csv_url    TEXT NOT NULL DEFAULT '',
  sheet_snapshot   JSONB NOT NULL DEFAULT '{}',
  sheet_hash       TEXT NOT NULL DEFAULT '',

  -- Break-glass switch for Apify outages
  relax_apify_verification BOOLEAN NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one session can be running at a time
CREATE UNIQUE INDEX ca1_one_active_session
  ON ca1_exam_sessions (status)
  WHERE status = 'running';

-- ─── Roster ──────────────────────────────────────────────────
CREATE TABLE ca1_roster (
  id         BIGSERIAL PRIMARY KEY,
  prn        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Students ────────────────────────────────────────────────
CREATE TABLE ca1_students (
  id                   BIGSERIAL PRIMARY KEY,
  prn                  TEXT NOT NULL UNIQUE REFERENCES ca1_roster(prn),
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  phone                TEXT NOT NULL,
  password_hash        TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at        TIMESTAMPTZ,
  registered_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── API keys ────────────────────────────────────────────────
CREATE TABLE ca1_api_keys (
  id         BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL UNIQUE REFERENCES ca1_students(id) ON DELETE CASCADE,
  key_hash   TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked    BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX ca1_api_keys_hash_idx ON ca1_api_keys (key_hash);

-- ─── Question papers ─────────────────────────────────────────
CREATE TABLE ca1_question_papers (
  id                 BIGSERIAL PRIMARY KEY,
  student_id         BIGINT NOT NULL UNIQUE REFERENCES ca1_students(id) ON DELETE CASCADE,
  session_id         BIGINT NOT NULL REFERENCES ca1_exam_sessions(id),
  seed               TEXT NOT NULL,
  first_fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  fetch_count        INT NOT NULL DEFAULT 1,

  -- Task 2
  t2_target_word     TEXT NOT NULL,
  t2_scoped_page     INT NOT NULL,
  t2_expected_total  INT NOT NULL,
  t2_expected_scoped INT NOT NULL,

  -- Task 3
  t3_city            TEXT NOT NULL,
  t3_lat             NUMERIC(9,6) NOT NULL,
  t3_lon             NUMERIC(9,6) NOT NULL,

  rendered_paper     JSONB NOT NULL DEFAULT '{}'
);

-- ─── MCQ assignments ─────────────────────────────────────────
CREATE TABLE ca1_mcq_assignments (
  id               BIGSERIAL PRIMARY KEY,
  student_id       BIGINT NOT NULL REFERENCES ca1_students(id) ON DELETE CASCADE,
  slot_no          INT NOT NULL,
  question_id      BIGINT NOT NULL REFERENCES ca1_mcq_questions(id),
  option_order     TEXT[] NOT NULL,
  answered_key     TEXT,
  answered_at      TIMESTAMPTZ,
  first_answered_at TIMESTAMPTZ,
  change_count     INT NOT NULL DEFAULT 0,
  answer_history   JSONB NOT NULL DEFAULT '[]',
  is_correct       BOOLEAN,
  UNIQUE (student_id, slot_no)
);

-- ─── Submissions ─────────────────────────────────────────────
CREATE TABLE ca1_submissions (
  id                  BIGSERIAL PRIMARY KEY,
  student_id          BIGINT NOT NULL REFERENCES ca1_students(id) ON DELETE CASCADE,
  task_no             INT NOT NULL CHECK (task_no IN (1,2,3)),
  payload             JSONB NOT NULL DEFAULT '{}',
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt_count       INT NOT NULL DEFAULT 1,
  source_ip           TEXT,
  user_agent          TEXT,

  -- Apify
  submitted_run_id    TEXT,
  submitted_actor_id  TEXT,
  submitted_actor_url TEXT,
  apify_user_id       TEXT,
  apify_run_status    TEXT,
  apify_finished_at   TIMESTAMPTZ,
  apify_dataset_items JSONB,
  raw_apify_response  JSONB,

  -- Source capture
  source_snapshot     TEXT,
  source_fetched_at   TIMESTAMPTZ,
  key_hardcoded       BOOLEAN,

  -- Task 3
  server_reference    JSONB,

  -- Grading
  verification_status TEXT NOT NULL DEFAULT 'pending'
                      CHECK (verification_status IN
                             ('pending','verified','failed','flagged','deferred')),
  marks_awarded       NUMERIC(3,1),
  grading_detail      JSONB,

  -- Override
  override_marks      NUMERIC(3,1),
  override_reason     TEXT,
  override_by         TEXT,
  override_at         TIMESTAMPTZ,

  UNIQUE (student_id, task_no)
);

-- Apify account may claim each task once across different students
CREATE UNIQUE INDEX ca1_uniq_apify_user_task
  ON ca1_submissions (apify_user_id, task_no)
  WHERE apify_user_id IS NOT NULL
    AND verification_status <> 'failed';

-- Same run may not be submitted twice for the same task
CREATE UNIQUE INDEX ca1_uniq_run_task
  ON ca1_submissions (submitted_run_id, task_no)
  WHERE submitted_run_id IS NOT NULL;

-- ─── Submission attempts ─────────────────────────────────────
CREATE TABLE ca1_submission_attempts (
  id               BIGSERIAL PRIMARY KEY,
  student_id       BIGINT NOT NULL REFERENCES ca1_students(id) ON DELETE CASCADE,
  task_no          INT NOT NULL,
  attempt_no       INT NOT NULL,
  payload          JSONB NOT NULL,
  submitted_run_id TEXT,
  apify_user_id    TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_ip        TEXT,
  UNIQUE (student_id, task_no, attempt_no)
);

-- ─── Flags ───────────────────────────────────────────────────
CREATE TABLE ca1_flags (
  id          BIGSERIAL PRIMARY KEY,
  session_id  BIGINT REFERENCES ca1_exam_sessions(id),
  reason      TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('info','review','serious')),
  student_ids BIGINT[] NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}',
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  resolution  TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Exceptions ──────────────────────────────────────────────
CREATE TABLE ca1_exceptions (
  id          BIGSERIAL PRIMARY KEY,
  student_id  BIGINT NOT NULL REFERENCES ca1_students(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  detail      TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Staff ───────────────────────────────────────────────────
CREATE TABLE ca1_staff (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('sa','invigilator')),
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Audit log ───────────────────────────────────────────────
CREATE TABLE ca1_audit_log (
  id     BIGSERIAL PRIMARY KEY,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail JSONB,
  at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE ca1_roster             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_students           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_api_keys           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_question_papers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_mcq_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_submission_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_flags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_exceptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_staff              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_exam_definitions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_exam_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_exam_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_task_components    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_mcq_slots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_mcq_questions      ENABLE ROW LEVEL SECURITY;

-- All access is via service role key in server-side API routes.
-- No client-side direct database access.
-- RLS denies everything from the anon/authenticated roles.
CREATE POLICY "deny_all_ca1_roster"      ON ca1_roster             FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_students"    ON ca1_students           FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_api_keys"    ON ca1_api_keys           FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_papers"      ON ca1_question_papers    FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_mcq_assign" ON ca1_mcq_assignments    FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_submissions" ON ca1_submissions        FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_attempts"   ON ca1_submission_attempts FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_flags"      ON ca1_flags              FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_exceptions" ON ca1_exceptions          FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_staff"      ON ca1_staff              FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_audit"      ON ca1_audit_log          FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_exam_def"   ON ca1_exam_definitions   FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_sessions"   ON ca1_exam_sessions      FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_tasks"      ON ca1_exam_tasks         FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_components" ON ca1_task_components    FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_slots"      ON ca1_mcq_slots          FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_questions"  ON ca1_mcq_questions      FOR ALL USING (false);
