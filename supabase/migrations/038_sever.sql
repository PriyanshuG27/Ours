-- 038_sever.sql — Space dissolution (Sever Protocol)

-- 1. Add severed_at column to track when a space was severed
ALTER TABLE spaces ADD COLUMN severed_at timestamptz;

-- 2. Cleanup function: hard-delete spaces severed more than 30 days ago.
--    All child tables use ON DELETE CASCADE, so this single DELETE
--    cascades to feed_events, tasks, board_cards, rules, etc.
CREATE OR REPLACE FUNCTION cleanup_severed_spaces()
RETURNS void AS $$
BEGIN
  DELETE FROM spaces
  WHERE severed_at IS NOT NULL
  AND severed_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
