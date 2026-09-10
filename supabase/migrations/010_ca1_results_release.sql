-- Results are released explicitly by the Super Admin after verification.
ALTER TABLE ca1_exam_sessions
  ADD COLUMN IF NOT EXISTS results_released_at TIMESTAMPTZ;
