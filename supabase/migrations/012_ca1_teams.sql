-- Student project teams. A roster PRN is reserved as soon as it is added.
CREATE TABLE ca1_teams (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  project_name TEXT,
  project_description TEXT,
  created_by BIGINT NOT NULL REFERENCES ca1_students(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'rejected', 'approved')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by BIGINT REFERENCES ca1_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ca1_teams_name_unique ON ca1_teams (lower(name));

CREATE TABLE ca1_team_members (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES ca1_teams(id) ON DELETE CASCADE,
  roster_prn TEXT NOT NULL REFERENCES ca1_roster(prn),
  student_id BIGINT REFERENCES ca1_students(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE (team_id, roster_prn)
);

-- This prevents both registered and unregistered roster members from being
-- reserved by more than one team at a time.
CREATE UNIQUE INDEX ca1_team_members_active_prn
  ON ca1_team_members (roster_prn) WHERE left_at IS NULL;

CREATE INDEX ca1_team_members_team_idx ON ca1_team_members (team_id) WHERE left_at IS NULL;
CREATE INDEX ca1_teams_status_idx ON ca1_teams (status);

ALTER TABLE ca1_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca1_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_ca1_teams" ON ca1_teams FOR ALL USING (false);
CREATE POLICY "deny_all_ca1_team_members" ON ca1_team_members FOR ALL USING (false);
