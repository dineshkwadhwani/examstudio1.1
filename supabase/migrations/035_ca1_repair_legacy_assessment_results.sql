-- Repair legacy CA1 assessment results that were created after the original
-- one-time import in migration 021. This is intentionally additive and
-- idempotent: existing imported rows are refreshed from their legacy source,
-- while legacy students without an identity mapping remain skipped.

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.assessments') IS NULL
     OR to_regclass('public.assignments') IS NULL
     OR to_regclass('public.student_papers') IS NULL
     OR to_regclass('public.paper_questions') IS NULL THEN
    RAISE NOTICE 'Legacy assessment repair skipped because source tables are not available.';
    RETURN;
  END IF;

  -- Rebuild identity mappings for profiles that now have a matching root
  -- student account. The two unmatched NLP students remain excluded safely.
  INSERT INTO ca1_assessment_identity_map (legacy_profile_id, root_student_id, email)
  SELECT p.id, s.id, lower(trim(p.email))
    FROM public.profiles p
    JOIN ca1_students s
      ON lower(trim(s.email)) = lower(trim(p.email))
   WHERE p.role = 'student'
  ON CONFLICT (legacy_profile_id) DO UPDATE
    SET root_student_id = EXCLUDED.root_student_id,
        email = EXCLUDED.email;

  -- Re-import assignments so papers can be linked even when the original
  -- migration ran before the legacy result rows were available.
  INSERT INTO ca1_assessment_assignments (
    legacy_id, assessment_id, cohort_id, student_id, assigned_by_email, assigned_at
  )
  SELECT a.id,
         imported_assessment.id,
         imported_cohort.id,
         identity_map.root_student_id,
         COALESCE(assigner.email, 'legacy-import'),
         a.assigned_at
    FROM public.assignments a
    JOIN ca1_assessments imported_assessment
      ON imported_assessment.legacy_id = a.assessment_id
    LEFT JOIN ca1_assessment_cohorts imported_cohort
      ON imported_cohort.legacy_id = a.cohort_id
    LEFT JOIN ca1_assessment_identity_map identity_map
      ON identity_map.legacy_profile_id = a.student_id
    LEFT JOIN public.profiles assigner
      ON assigner.id = a.assigned_by
   WHERE imported_cohort.id IS NOT NULL
      OR identity_map.root_student_id IS NOT NULL
  ON CONFLICT (legacy_id) DO UPDATE
    SET assessment_id = EXCLUDED.assessment_id,
        cohort_id = EXCLUDED.cohort_id,
        student_id = EXCLUDED.student_id,
        assigned_by_email = EXCLUDED.assigned_by_email,
        assigned_at = EXCLUDED.assigned_at;

  -- Import all legacy papers whose student, assessment, and assignment links
  -- are valid. A legacy paper may already have an integrated row for the same
  -- assessment/student pair, so the composite uniqueness rule must be handled
  -- separately from the legacy_id conflict rule.
  CREATE TEMP TABLE ca1_legacy_paper_map (
    legacy_id UUID PRIMARY KEY,
    paper_id BIGINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO ca1_assessment_papers (
    legacy_id, assignment_id, assessment_id, student_id, started_at,
    submitted_at, score, status, created_at
  )
  SELECT source.id,
         source.assignment_id,
         source.assessment_id,
         source.student_id,
         source.started_at,
         source.submitted_at,
         source.score,
         source.status,
         source.created_at
    FROM (
      SELECT DISTINCT ON (imported_assessment.id, identity_map.root_student_id)
             sp.id,
             imported_assignment.id AS assignment_id,
             imported_assessment.id AS assessment_id,
             identity_map.root_student_id AS student_id,
             sp.started_at,
             sp.submitted_at,
             sp.score,
             sp.status,
             sp.created_at
        FROM public.student_papers sp
        JOIN ca1_assessment_identity_map identity_map
          ON identity_map.legacy_profile_id = sp.student_id
        JOIN ca1_assessments imported_assessment
          ON imported_assessment.legacy_id = sp.assessment_id
        JOIN ca1_assessment_assignments imported_assignment
          ON imported_assignment.legacy_id = sp.assignment_id
       ORDER BY imported_assessment.id,
                identity_map.root_student_id,
                sp.submitted_at DESC NULLS LAST,
                sp.created_at DESC,
                sp.id DESC
    ) source
   WHERE NOT EXISTS (
     SELECT 1
       FROM ca1_assessment_papers existing
      WHERE existing.legacy_id = source.id
         OR (
           existing.assessment_id = source.assessment_id
           AND existing.student_id = source.student_id
         )
   );

  -- Resolve every source paper to its integrated paper, including source rows
  -- that were skipped above because the assessment/student pair already
  -- existed. Select the same latest source paper per student/assessment so
  -- duplicate legacy attempts cannot collide on question_order.
  INSERT INTO ca1_legacy_paper_map (legacy_id, paper_id)
  SELECT source.id, integrated.id
    FROM (
      SELECT DISTINCT ON (imported_assessment.id, identity_map.root_student_id)
             sp.id,
             imported_assessment.id AS assessment_id,
             identity_map.root_student_id AS student_id
        FROM public.student_papers sp
        JOIN ca1_assessment_identity_map identity_map
          ON identity_map.legacy_profile_id = sp.student_id
        JOIN ca1_assessments imported_assessment
          ON imported_assessment.legacy_id = sp.assessment_id
        JOIN ca1_assessment_assignments imported_assignment
          ON imported_assignment.legacy_id = sp.assignment_id
       ORDER BY imported_assessment.id,
                identity_map.root_student_id,
                sp.submitted_at DESC NULLS LAST,
                sp.created_at DESC,
                sp.id DESC
    ) source
    JOIN ca1_assessment_papers integrated
      ON integrated.legacy_id = source.id
      OR (
        integrated.assessment_id = source.assessment_id
        AND integrated.student_id = source.student_id
      )
  ON CONFLICT (legacy_id) DO UPDATE SET paper_id = EXCLUDED.paper_id;

  -- Restore the question-level answers, marks, and evaluation feedback. A
  -- question can already exist by paper/order under a different legacy ID, so
  -- reconcile both uniqueness keys before inserting missing rows.
  CREATE TEMP TABLE ca1_repair_questions (
    legacy_id UUID PRIMARY KEY,
    paper_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    question_order INTEGER NOT NULL,
    selected_answer CHAR(1),
    answer_text TEXT,
    is_correct BOOLEAN,
    marks_awarded NUMERIC(7,2),
    evaluation_feedback TEXT,
    evaluation_status TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO ca1_repair_questions (
    legacy_id, paper_id, question_id, question_order, selected_answer,
    answer_text, is_correct, marks_awarded, evaluation_feedback,
    evaluation_status
  )
  SELECT pq.id,
         imported_paper.id,
         imported_question.id,
         pq.question_order,
         pq.selected_answer,
         pq.answer_text,
         pq.is_correct,
         pq.marks_awarded,
         pq.evaluation_feedback,
         pq.evaluation_status
    FROM public.paper_questions pq
    JOIN ca1_legacy_paper_map paper_map
      ON paper_map.legacy_id = pq.paper_id
    JOIN ca1_assessment_questions imported_question
      ON imported_question.legacy_id = pq.question_id
    JOIN ca1_assessment_papers imported_paper
      ON imported_paper.id = paper_map.paper_id;

  UPDATE ca1_assessment_paper_questions existing
     SET paper_id = source.paper_id,
         question_id = source.question_id,
         question_order = source.question_order,
         selected_answer = source.selected_answer,
         answer_text = source.answer_text,
         is_correct = source.is_correct,
         marks_awarded = source.marks_awarded,
         evaluation_feedback = source.evaluation_feedback,
         evaluation_status = source.evaluation_status
    FROM ca1_repair_questions source
   WHERE existing.legacy_id = source.legacy_id
      OR (
        existing.paper_id = source.paper_id
        AND existing.question_order = source.question_order
      );

  INSERT INTO ca1_assessment_paper_questions (
    legacy_id, paper_id, question_id, question_order, selected_answer,
    answer_text, is_correct, marks_awarded, evaluation_feedback,
    evaluation_status
  )
  SELECT source.legacy_id,
         source.paper_id,
         source.question_id,
         source.question_order,
         source.selected_answer,
         source.answer_text,
         source.is_correct,
         source.marks_awarded,
         source.evaluation_feedback,
         source.evaluation_status
    FROM ca1_repair_questions source
   WHERE NOT EXISTS (
     SELECT 1
       FROM ca1_assessment_paper_questions existing
      WHERE existing.legacy_id = source.legacy_id
         OR (
           existing.paper_id = source.paper_id
           AND existing.question_order = source.question_order
         )
   );
END $$;
