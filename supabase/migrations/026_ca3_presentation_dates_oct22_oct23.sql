-- Move the existing CA3 presentation bookings to the new dates.
-- October 15 bookings become October 22; October 16 bookings become October 23.

BEGIN;

ALTER TABLE ca1_project_artifacts
  DROP CONSTRAINT IF EXISTS ca1_project_artifacts_presentation_date_check;

UPDATE ca1_project_artifacts
   SET presentation_date = DATE '2026-10-22'
 WHERE presentation_date = DATE '2026-10-15';

UPDATE ca1_project_artifacts
   SET presentation_date = DATE '2026-10-23'
 WHERE presentation_date = DATE '2026-10-16';

ALTER TABLE ca1_project_artifacts
  ADD CONSTRAINT ca1_project_artifacts_presentation_date_check
  CHECK (
    presentation_date IS NULL OR
    presentation_date IN (DATE '2026-10-22', DATE '2026-10-23')
  );

COMMIT;
