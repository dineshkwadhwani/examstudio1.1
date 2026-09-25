-- A student may leave a team and later be added to that same team again.
-- Historical membership rows must not block that rejoin.
ALTER TABLE ca1_team_members
  DROP CONSTRAINT IF EXISTS ca1_team_members_team_id_roster_prn_key;

CREATE UNIQUE INDEX IF NOT EXISTS ca1_team_members_active_team_prn
  ON ca1_team_members (team_id, roster_prn)
  WHERE left_at IS NULL;
