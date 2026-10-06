-- Merge the original Symbi Assess CA1 assessment workflow into Exam Studio.
-- This migration is additive: the practical-exam, team, artifact, grading,
-- and CA3 presentation tables are intentionally left unchanged.

CREATE TABLE ca1_assessments (
  id BIGSERIAL PRIMARY KEY,
  legacy_id UUID UNIQUE,
  name TEXT NOT NULL,
  assessment_type TEXT NOT NULL DEFAULT 'mcq'
    CHECK (assessment_type IN ('mcq', 'subjective', 'subjective_online')),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  total_time_seconds INTEGER,
  time_per_question INTEGER,
  marks_per_correct NUMERIC(7,2) NOT NULL DEFAULT 1,
  total_marks NUMERIC(7,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  migrated_at TIMESTAMPTZ
);

CREATE TABLE ca1_assessment_questions (
  id BIGSERIAL PRIMARY KEY,
  assessment_id BIGINT NOT NULL REFERENCES ca1_assessments(id) ON DELETE CASCADE,
  legacy_id UUID UNIQUE,
  co TEXT,
  topic_number TEXT,
  topic_name TEXT,
  bloom_level INTEGER,
  bloom_label TEXT,
  question_text TEXT NOT NULL,
  image_url TEXT,
  model_answer TEXT,
  max_marks NUMERIC(7,2),
  options JSONB NOT NULL DEFAULT '{}',
  correct_answer CHAR(1),
  explanation TEXT,
  question_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ca1_assessment_questions_assessment_idx
  ON ca1_assessment_questions (assessment_id, question_order);

CREATE TABLE ca1_assessment_cohorts (
  id BIGSERIAL PRIMARY KEY,
  legacy_id UUID UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE UNIQUE INDEX ca1_assessment_cohorts_name_unique
  ON ca1_assessment_cohorts (lower(name));

CREATE TABLE ca1_assessment_cohort_members (
  id BIGSERIAL PRIMARY KEY,
  cohort_id BIGINT NOT NULL REFERENCES ca1_assessment_cohorts(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES ca1_students(id) ON DELETE CASCADE,
  legacy_profile_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, student_id)
);

CREATE INDEX ca1_assessment_cohort_members_student_idx
  ON ca1_assessment_cohort_members (student_id);

CREATE TABLE ca1_assessment_assignments (
  id BIGSERIAL PRIMARY KEY,
  legacy_id UUID UNIQUE,
  assessment_id BIGINT NOT NULL REFERENCES ca1_assessments(id) ON DELETE CASCADE,
  cohort_id BIGINT REFERENCES ca1_assessment_cohorts(id) ON DELETE CASCADE,
  student_id BIGINT REFERENCES ca1_students(id) ON DELETE CASCADE,
  assigned_by_email TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cohort_id IS NOT NULL OR student_id IS NOT NULL)
);

CREATE TABLE ca1_assessment_papers (
  id BIGSERIAL PRIMARY KEY,
  legacy_id UUID UNIQUE,
  assignment_id BIGINT NOT NULL REFERENCES ca1_assessment_assignments(id) ON DELETE CASCADE,
  assessment_id BIGINT NOT NULL REFERENCES ca1_assessments(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES ca1_students(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  score NUMERIC(7,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id)
);

CREATE INDEX ca1_assessment_papers_student_idx
  ON ca1_assessment_papers (student_id, created_at DESC);

CREATE TABLE ca1_assessment_paper_questions (
  id BIGSERIAL PRIMARY KEY,
  legacy_id UUID UNIQUE,
  paper_id BIGINT NOT NULL REFERENCES ca1_assessment_papers(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES ca1_assessment_questions(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  selected_answer CHAR(1),
  answer_text TEXT,
  is_correct BOOLEAN,
  marks_awarded NUMERIC(7,2),
  evaluation_feedback TEXT,
  evaluation_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (evaluation_status IN ('not_started', 'queued', 'processing', 'completed', 'failed')),
  UNIQUE (paper_id, question_order)
);

CREATE TABLE ca1_assessment_evaluation_jobs (
  id BIGSERIAL PRIMARY KEY,
  paper_id BIGINT NOT NULL REFERENCES ca1_assessment_papers(id) ON DELETE CASCADE,
  paper_question_id BIGINT NOT NULL REFERENCES ca1_assessment_paper_questions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (paper_question_id)
);

CREATE TABLE ca1_assessment_identity_map (
  legacy_profile_id UUID PRIMARY KEY,
  root_student_id BIGINT NOT NULL UNIQUE REFERENCES ca1_students(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'symbi_assess'
);

CREATE TABLE ca1_assessment_identity_issues (
  id BIGSERIAL PRIMARY KEY,
  legacy_profile_id UUID,
  email TEXT,
  reason TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (legacy_profile_id, reason)
);

ALTER TABLE ca1_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_assessment_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_assessment_cohort_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_assessment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_assessment_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_assessment_paper_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_assessment_evaluation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_assessment_identity_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_assessment_identity_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_ca1_assessments" ON ca1_assessments FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_assessment_questions" ON ca1_assessment_questions FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_assessment_cohorts" ON ca1_assessment_cohorts FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_assessment_cohort_members" ON ca1_assessment_cohort_members FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_assessment_assignments" ON ca1_assessment_assignments FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_assessment_papers" ON ca1_assessment_papers FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_assessment_paper_questions" ON ca1_assessment_paper_questions FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_assessment_evaluation_jobs" ON ca1_assessment_evaluation_jobs FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_assessment_identity_map" ON ca1_assessment_identity_map FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_assessment_identity_issues" ON ca1_assessment_identity_issues FOR ALL USING (false);

-- Import is deliberately conditional so the root app can be deployed before
-- the old public-schema tables are present in a fresh environment.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.assessments') IS NULL
     OR to_regclass('public.cohorts') IS NULL
     OR to_regclass('public.questions') IS NULL
     OR to_regclass('public.assignments') IS NULL
     OR to_regclass('public.cohort_students') IS NULL
     OR to_regclass('public.student_papers') IS NULL
     OR to_regclass('public.paper_questions') IS NULL THEN
    RAISE NOTICE 'Nested Symbi Assess tables not found; schema created without data import.';
    RETURN;
  END IF;

  EXECUTE $import$
    INSERT INTO ca1_assessment_identity_issues (legacy_profile_id, email, reason)
    SELECT p.id, p.email, 'NO_ROOT_STUDENT_FOR_EMAIL'
      FROM public.profiles p
      LEFT JOIN ca1_students s ON lower(trim(s.email)) = lower(trim(p.email))
     WHERE p.role = 'student' AND s.id IS NULL
    ON CONFLICT (legacy_profile_id, reason) DO NOTHING
  $import$;

  EXECUTE $import$
    INSERT INTO ca1_assessment_identity_map (legacy_profile_id, root_student_id, email)
    SELECT p.id, s.id, lower(trim(p.email))
      FROM public.profiles p
      JOIN ca1_students s ON lower(trim(s.email)) = lower(trim(p.email))
     WHERE p.role = 'student'
    ON CONFLICT (legacy_profile_id) DO UPDATE
      SET root_student_id = EXCLUDED.root_student_id,
          email = EXCLUDED.email
  $import$;

  EXECUTE $import$
    INSERT INTO ca1_assessments (
      legacy_id, name, assessment_type, total_questions, total_time_seconds,
      time_per_question, marks_per_correct, total_marks, is_active,
      created_by_email, created_at, migrated_at
    )
    SELECT a.id, a.name, a.assessment_type, a.total_questions,
           a.total_time_seconds, a.time_per_question, a.marks_per_correct,
           a.total_marks, a.is_active, COALESCE(p.email, 'legacy-import'),
           a.created_at, now()
    FROM public.assessments a
      LEFT JOIN public.profiles p ON p.id = a.teacher_id
    ON CONFLICT (legacy_id) DO UPDATE SET
      name = EXCLUDED.name,
      assessment_type = EXCLUDED.assessment_type,
      total_questions = EXCLUDED.total_questions,
      total_time_seconds = EXCLUDED.total_time_seconds,
      time_per_question = EXCLUDED.time_per_question,
      marks_per_correct = EXCLUDED.marks_per_correct,
      total_marks = EXCLUDED.total_marks,
      is_active = EXCLUDED.is_active
  $import$;

  EXECUTE $import$
    INSERT INTO ca1_assessment_questions (
      assessment_id, legacy_id, co, topic_number, topic_name, bloom_level,
      bloom_label, question_text, image_url, model_answer, max_marks,
      options, correct_answer, explanation, question_order, created_at
    )
    SELECT ra.id, q.id, q.co, q.topic_number, q.topic_name, q.bloom_level,
           q.bloom_label, q.question_text, q.image_url, q.model_answer,
           q.max_marks,
           jsonb_build_object('A', q.option_a, 'B', q.option_b,
                              'C', q.option_c, 'D', q.option_d),
           q.correct_answer, q.explanation,
           row_number() OVER (PARTITION BY q.assessment_id ORDER BY q.created_at, q.id),
           q.created_at
      FROM public.questions q
      JOIN ca1_assessments ra ON ra.legacy_id = q.assessment_id
    ON CONFLICT (legacy_id) DO UPDATE SET
      question_text = EXCLUDED.question_text,
      options = EXCLUDED.options,
      correct_answer = EXCLUDED.correct_answer,
      explanation = EXCLUDED.explanation,
      model_answer = EXCLUDED.model_answer,
      max_marks = EXCLUDED.max_marks
  $import$;

  EXECUTE $import$
    INSERT INTO ca1_assessment_cohorts (legacy_id, name, description, created_by_email, created_at)
    SELECT c.id, c.name, c.description, COALESCE(p.email, 'legacy-import'), c.created_at
      FROM public.cohorts c
      LEFT JOIN public.profiles p ON p.id = c.teacher_id
    ON CONFLICT (legacy_id) DO UPDATE SET
      name = EXCLUDED.name, description = EXCLUDED.description
  $import$;

  EXECUTE $import$
    INSERT INTO ca1_assessment_cohort_members (cohort_id, student_id, legacy_profile_id, created_at)
    SELECT rc.id, im.root_student_id, cs.student_id, cs.created_at
      FROM public.cohort_students cs
      JOIN ca1_assessment_cohorts rc ON rc.legacy_id = cs.cohort_id
      JOIN ca1_assessment_identity_map im ON im.legacy_profile_id = cs.student_id
    ON CONFLICT (cohort_id, student_id) DO NOTHING
  $import$;

  EXECUTE $import$
    INSERT INTO ca1_assessment_assignments (
      legacy_id, assessment_id, cohort_id, student_id, assigned_by_email, assigned_at
    )
    SELECT a.id, ra.id, rc.id, im.root_student_id,
           COALESCE(p.email, 'legacy-import'), a.assigned_at
      FROM public.assignments a
      JOIN ca1_assessments ra ON ra.legacy_id = a.assessment_id
      LEFT JOIN ca1_assessment_cohorts rc ON rc.legacy_id = a.cohort_id
      LEFT JOIN ca1_assessment_identity_map im ON im.legacy_profile_id = a.student_id
      LEFT JOIN public.profiles p ON p.id = a.assigned_by
     WHERE rc.id IS NOT NULL OR im.root_student_id IS NOT NULL
    ON CONFLICT (legacy_id) DO NOTHING
  $import$;

  EXECUTE $import$
    INSERT INTO ca1_assessment_papers (
      legacy_id, assignment_id, assessment_id, student_id, started_at,
      submitted_at, score, status, created_at
    )
    SELECT sp.id, aa.id, ra.id, im.root_student_id, sp.started_at,
           sp.submitted_at, sp.score, sp.status, sp.created_at
      FROM public.student_papers sp
      JOIN ca1_assessment_identity_map im ON im.legacy_profile_id = sp.student_id
      JOIN ca1_assessments ra ON ra.legacy_id = sp.assessment_id
      JOIN ca1_assessment_assignments aa ON aa.legacy_id = sp.assignment_id
    ON CONFLICT (legacy_id) DO UPDATE SET
      started_at = EXCLUDED.started_at,
      submitted_at = EXCLUDED.submitted_at,
      score = EXCLUDED.score,
      status = EXCLUDED.status
  $import$;

  EXECUTE $import$
    INSERT INTO ca1_assessment_paper_questions (
      legacy_id, paper_id, question_id, question_order, selected_answer,
      answer_text, is_correct, marks_awarded, evaluation_feedback,
      evaluation_status
    )
    SELECT pq.id, rp.id, rq.id, pq.question_order, pq.selected_answer,
           pq.answer_text, pq.is_correct, pq.marks_awarded,
           pq.evaluation_feedback, pq.evaluation_status
      FROM public.paper_questions pq
      JOIN ca1_assessment_papers rp ON rp.legacy_id = pq.paper_id
      JOIN ca1_assessment_questions rq ON rq.legacy_id = pq.question_id
    ON CONFLICT (legacy_id) DO UPDATE SET
      selected_answer = EXCLUDED.selected_answer,
      answer_text = EXCLUDED.answer_text,
      is_correct = EXCLUDED.is_correct,
      marks_awarded = EXCLUDED.marks_awarded,
      evaluation_feedback = EXCLUDED.evaluation_feedback,
      evaluation_status = EXCLUDED.evaluation_status
  $import$;
END $$;
