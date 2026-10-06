-- Increase CA3 presentation capacity from 20 to 25 teams per date.
CREATE OR REPLACE FUNCTION ca1_check_presentation_date_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  booked_count INTEGER;
BEGIN
  IF NEW.presentation_date IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('ca3_presentation_date:' || NEW.presentation_date::TEXT)
  );

  SELECT COUNT(*)
    INTO booked_count
    FROM ca1_project_artifacts
   WHERE presentation_date = NEW.presentation_date
     AND team_id <> NEW.team_id;

  IF booked_count >= 25 THEN
    RAISE EXCEPTION 'PRESENTATION_DATE_FULL';
  END IF;

  RETURN NEW;
END;
$$;
