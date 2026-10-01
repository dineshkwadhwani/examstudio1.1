-- Raw GitHub activity used to support category G individual contribution scores.
CREATE TABLE ca1_github_contribution_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id BIGINT NOT NULL REFERENCES ca1_teams(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES ca1_students(id) ON DELETE CASCADE,
  github_username TEXT NOT NULL,
  commit_count INTEGER NOT NULL DEFAULT 0,
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  active_days INTEGER NOT NULL DEFAULT 0,
  first_commit_at TIMESTAMPTZ,
  last_commit_at TIMESTAMPTZ,
  prs_opened INTEGER NOT NULL DEFAULT 0,
  prs_reviewed INTEGER NOT NULL DEFAULT 0,
  contribution_percentage NUMERIC(6,3),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, student_id)
);

ALTER TABLE ca1_github_contribution_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_ca1_github_contribution_stats"
  ON ca1_github_contribution_stats FOR ALL USING (false);
