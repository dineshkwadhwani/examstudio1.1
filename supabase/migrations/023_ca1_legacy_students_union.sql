-- Add legacy-only CA1 cohort users to the root student directory.
--
-- Existing root students remain authoritative when their email already exists.
-- Legacy-only users receive no usable password and must be provisioned by the
-- Super Admin before they can authenticate.

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.cohort_students') IS NULL
     OR to_regclass('public.ca1_roster') IS NULL
     OR to_regclass('public.ca1_students') IS NULL
     OR to_regclass('public.ca1_assessment_identity_map') IS NULL
     OR to_regclass('public.ca1_assessment_cohorts') IS NULL
     OR to_regclass('public.ca1_assessment_cohort_members') IS NULL THEN
    RAISE NOTICE 'Legacy-only student union skipped because source or target tables are not available.';
    RETURN;
  END IF;

  EXECUTE $union$
    INSERT INTO public.ca1_roster (prn, name)
    SELECT DISTINCT ON (legacy.prn) legacy.prn, legacy.name
      FROM (
        SELECT trim(to_jsonb(p)->>'prn') AS prn,
               COALESCE(NULLIF(trim(to_jsonb(p)->>'name'), ''), trim(to_jsonb(p)->>'full_name')) AS name,
               lower(trim(p.email)) AS email
          FROM public.profiles p
         WHERE NULLIF(trim(to_jsonb(p)->>'prn'), '') IS NOT NULL
           AND NULLIF(trim(p.email), '') IS NOT NULL
           AND COALESCE(NULLIF(trim(to_jsonb(p)->>'name'), ''), trim(to_jsonb(p)->>'full_name')) IS NOT NULL
      ) legacy
     WHERE NOT EXISTS (
       SELECT 1 FROM public.ca1_roster r WHERE lower(trim(r.prn)) = lower(legacy.prn)
     )
     ORDER BY legacy.prn, legacy.email
    ON CONFLICT (prn) DO NOTHING
  $union$;

  EXECUTE $union$
    INSERT INTO public.ca1_students (
      prn, name, email, phone, password_hash, must_change_password
    )
    SELECT legacy.prn, legacy.name, legacy.email, '', '', TRUE
      FROM (
        SELECT DISTINCT ON (lower(trim(p.email)))
               trim(to_jsonb(p)->>'prn') AS prn,
               COALESCE(NULLIF(trim(to_jsonb(p)->>'name'), ''), trim(to_jsonb(p)->>'full_name')) AS name,
               lower(trim(p.email)) AS email
          FROM public.profiles p
         WHERE NULLIF(trim(to_jsonb(p)->>'prn'), '') IS NOT NULL
           AND NULLIF(trim(p.email), '') IS NOT NULL
           AND COALESCE(NULLIF(trim(to_jsonb(p)->>'name'), ''), trim(to_jsonb(p)->>'full_name')) IS NOT NULL
         ORDER BY lower(trim(p.email)), p.id
      ) legacy
      JOIN public.ca1_roster r ON r.prn = legacy.prn
     WHERE NOT EXISTS (
       SELECT 1 FROM public.ca1_students s WHERE lower(trim(s.email)) = legacy.email
     )
       AND NOT EXISTS (
       SELECT 1 FROM public.ca1_students s WHERE s.prn = legacy.prn
     )
    ON CONFLICT DO NOTHING
  $union$;

  EXECUTE $union$
    INSERT INTO public.ca1_assessment_identity_map (
      legacy_profile_id, root_student_id, email
    )
    SELECT p.id, s.id, lower(trim(p.email))
      FROM public.profiles p
      JOIN public.ca1_students s
        ON lower(trim(s.email)) = lower(trim(p.email))
    ON CONFLICT DO NOTHING
  $union$;

  EXECUTE $union$
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
  $union$;
END $$;
