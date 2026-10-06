-- CA3 presentation-date booking. Each presentation date has 20 places.
ALTER TABLE ca1_project_artifacts
  ADD COLUMN presentation_date DATE;

ALTER TABLE ca1_project_artifacts
  ADD CONSTRAINT ca1_project_artifacts_presentation_date_check
  CHECK (
    presentation_date IS NULL OR
    presentation_date IN (DATE '2026-10-09', DATE '2026-10-15', DATE '2026-10-16')
  );

CREATE INDEX ca1_project_artifacts_presentation_date_idx
  ON ca1_project_artifacts (presentation_date)
  WHERE presentation_date IS NOT NULL;

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

  -- Serialize bookings for the same date so two concurrent saves cannot
  -- both observe the 20th slot as available.
  PERFORM pg_advisory_xact_lock(
    hashtext('ca3_presentation_date:' || NEW.presentation_date::TEXT)
  );

  SELECT COUNT(*)
    INTO booked_count
    FROM ca1_project_artifacts
   WHERE presentation_date = NEW.presentation_date
     AND team_id <> NEW.team_id;

  IF booked_count >= 20 THEN
    RAISE EXCEPTION 'PRESENTATION_DATE_FULL';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ca1_project_artifacts_presentation_capacity
  BEFORE INSERT OR UPDATE OF presentation_date ON ca1_project_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION ca1_check_presentation_date_capacity();

