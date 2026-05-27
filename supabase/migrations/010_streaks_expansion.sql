-- Add Co-op Streaks and Rewards to Tasks table
ALTER TABLE tasks
  ADD COLUMN is_coop boolean DEFAULT false,
  ADD COLUMN shared_streak_count integer DEFAULT 0,
  ADD COLUMN partner_streak_count integer DEFAULT 0,
  ADD COLUMN photo_proofs_count integer DEFAULT 0,
  ADD COLUMN streak_freezes integer DEFAULT 0;

-- Add Photo Path to completions
ALTER TABLE task_completions
  ADD COLUMN photo_path text;
