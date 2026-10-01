-- CA3 project artifact submission, rubric suggestions, final scores, and
-- cohort-wide publication control.
CREATE TABLE ca1_project_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id BIGINT NOT NULL UNIQUE REFERENCES ca1_teams(id) ON DELETE CASCADE,
  synopsis TEXT,
  design_document_url TEXT,
  input_definition TEXT,
  output_definition TEXT,
  github_repo_url TEXT,
  project_url TEXT,
  execution_trace TEXT,
  demo_video_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'locked')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ca1_team_members ADD COLUMN github_username TEXT;

CREATE TABLE ca1_project_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id BIGINT NOT NULL REFERENCES ca1_teams(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN
    ('multi_agent_design', 'design', 'live_demo', 'presentation', 'documentation', 'code_review')),
  max_marks NUMERIC(4,2) NOT NULL,
  system_score NUMERIC(4,2),
  final_score NUMERIC(4,2),
  override_reason TEXT,
  evaluator_notes TEXT,
  scored_by BIGINT REFERENCES ca1_staff(id),
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, category),
  CHECK (system_score IS NULL OR (system_score >= 0 AND system_score <= max_marks)),
  CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= max_marks))
);

CREATE TABLE ca1_project_individual_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id BIGINT NOT NULL REFERENCES ca1_teams(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES ca1_students(id) ON DELETE CASCADE,
  max_marks NUMERIC(4,2) NOT NULL DEFAULT 5,
  system_score NUMERIC(4,2),
  final_score NUMERIC(4,2),
  override_reason TEXT,
  evaluator_notes TEXT,
  scored_by BIGINT REFERENCES ca1_staff(id),
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, student_id),
  CHECK (system_score IS NULL OR (system_score >= 0 AND system_score <= max_marks)),
  CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= max_marks))
);

CREATE TABLE ca1_ca3_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  results_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  published_by BIGINT REFERENCES ca1_staff(id)
);

INSERT INTO ca1_ca3_config (id, results_published) VALUES (true, false);

ALTER TABLE ca1_project_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_project_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_project_individual_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_ca3_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_ca1_project_artifacts" ON ca1_project_artifacts FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_project_scores" ON ca1_project_scores FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_project_individual_scores" ON ca1_project_individual_scores FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_ca3_config" ON ca1_ca3_config FOR ALL USING (false);
