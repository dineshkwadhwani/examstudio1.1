-- Store evaluator-facing output from the optional AI-assisted CA3 scoring pass.
-- These values are suggestions only; final_score remains a Super Admin decision.
ALTER TABLE ca1_project_scores
  ADD COLUMN system_feedback TEXT,
  ADD COLUMN system_evaluated_at TIMESTAMPTZ,
  ADD COLUMN system_model TEXT;
