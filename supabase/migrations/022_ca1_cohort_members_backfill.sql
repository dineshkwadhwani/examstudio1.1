-- Backfill CA1 cohort membership after the initial merge.
--
-- Migration 021 intentionally allowed the root app to deploy before the old
-- Symbi Assess tables existed. This follow-up is safe to run later and uses
-- normalized email as the authoritative identity mapping. It also does not
-- require the legacy profile role to be exactly `student`.

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.cohorts') IS NULL
     OR to_regclass('public.cohort_students') IS NULL
     OR to_regclass('public.ca1_assessment_cohorts') IS NULL
     OR to_regclass('public.ca1_assessment_cohort_members') IS NULL
     OR to_regclass('public.ca1_students') IS NULL THEN
    RAISE NOTICE 'CA1 cohort backfill skipped because source or target tables are not available.';
    RETURN;
  END IF;

  EXECUTE $backfill$
    INSERT INTO public.ca1_assessment_cohorts (
      legacy_id, name, description, created_by_email, created_at
    )
    SELECT c.id, c.name, c.description,
           COALESCE(p.email, 'legacy-import'), c.created_at
      FROM public.cohorts c
      LEFT JOIN public.profiles p ON p.id = c.teacher_id
    ON CONFLICT (legacy_id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description
  $backfill$;

  EXECUTE $backfill$
    INSERT INTO public.ca1_assessment_identity_map (
      legacy_profile_id, root_student_id, email
    )
    SELECT p.id, s.id, lower(trim(s.email))
      FROM public.profiles p
      JOIN public.ca1_students s
        ON lower(trim(s.email)) = lower(trim(p.email))
    ON CONFLICT DO NOTHING
  $backfill$;

  EXECUTE $backfill$
    INSERT INTO public.ca1_assessment_identity_issues (
      legacy_profile_id, email, reason
    )
    SELECT DISTINCT cs.student_id, p.email, 'NO_ROOT_STUDENT_FOR_EMAIL'
      FROM public.cohort_students cs
      JOIN public.profiles p ON p.id = cs.student_id
      LEFT JOIN public.ca1_students s
        ON lower(trim(s.email)) = lower(trim(p.email))
     WHERE s.id IS NULL
    ON CONFLICT (legacy_profile_id, reason) DO NOTHING
  $backfill$;

  EXECUTE $backfill$
    INSERT INTO public.ca1_assessment_cohort_members (
      cohort_id, student_id, legacy_profile_id, created_at
    )
    SELECT rc.id, s.id, cs.student_id, COALESCE(cs.created_at, now())
      FROM public.cohort_students cs
      JOIN public.profiles p ON p.id = cs.student_id
      JOIN public.ca1_students s
        ON lower(trim(s.email)) = lower(trim(p.email))
      JOIN public.ca1_assessment_cohorts rc ON rc.legacy_id = cs.cohort_id
    ON CONFLICT (cohort_id, student_id) DO NOTHING
  $backfill$;
END $$;
