-- Additional raw fields used by the automated individual contribution scorecard.
ALTER TABLE ca1_github_contribution_stats
  ADD COLUMN review_comments INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN files_owned INTEGER NOT NULL DEFAULT 0;
