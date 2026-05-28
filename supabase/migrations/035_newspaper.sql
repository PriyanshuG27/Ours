-- 035_newspaper.sql

CREATE TABLE weekly_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    week_start date NOT NULL,
    photos_count integer DEFAULT 0,
    tasks_done_count integer DEFAULT 0,
    rules_broken_count integer DEFAULT 0,
    focus_minutes integer DEFAULT 0,
    watch_sessions_count integer DEFAULT 0,
    captures_count integer DEFAULT 0,
    UNIQUE(space_id, week_start)
);

CREATE INDEX idx_weekly_stats_space_week ON weekly_stats(space_id, week_start);

ALTER TABLE weekly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Space members can read weekly_stats"
    ON weekly_stats FOR SELECT
    USING (EXISTS (SELECT 1 FROM spaces s WHERE s.id = space_id AND auth.uid() = ANY(s.users)));

CREATE TABLE newspaper_archives (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    published_date date NOT NULL,
    html_snapshot text NOT NULL,
    stats_snapshot jsonb NOT NULL,
    UNIQUE(space_id, published_date)
);

CREATE INDEX idx_newspaper_archives_space_date ON newspaper_archives(space_id, published_date DESC);

ALTER TABLE newspaper_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Space members can read newspaper_archives"
    ON newspaper_archives FOR SELECT
    USING (EXISTS (SELECT 1 FROM spaces s WHERE s.id = space_id AND auth.uid() = ANY(s.users)));

-- Trigger function to increment weekly stats
CREATE OR REPLACE FUNCTION increment_weekly_stats()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_week_start DATE;
  v_space_id UUID;
  v_photos INT := 0;
  v_tasks INT := 0;
  v_rules INT := 0;
  v_focus INT := 0;
  v_watch INT := 0;
  v_captures INT := 0;
BEGIN
  -- Determine the start of the current week (Monday)
  v_week_start := date_trunc('week', now())::date;

  IF TG_TABLE_NAME = 'feed_events' THEN
    v_space_id := NEW.space_id;
    IF NEW.type = 'photo' THEN
      v_photos := 1;
    ELSIF NEW.type = 'focus_session' THEN
      v_focus := COALESCE((NEW.metadata->>'durationSeconds')::int, 0) / 60;
    ELSIF NEW.type = 'watch_session' THEN
      v_watch := 1;
    END IF;
  ELSIF TG_TABLE_NAME = 'task_completions' THEN
    -- task_completions doesn't have space_id directly, get it from tasks
    SELECT space_id INTO v_space_id FROM tasks WHERE id = NEW.task_id;
    v_tasks := 1;
  ELSIF TG_TABLE_NAME = 'ledger_entries' THEN
    v_space_id := NEW.space_id;
    v_rules := 1;
  ELSIF TG_TABLE_NAME = 'capture_events' THEN
    v_space_id := NEW.space_id;
    v_captures := 1;
  END IF;

  IF v_space_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only perform UPSERT if there is an actual increment
  IF v_photos > 0 OR v_tasks > 0 OR v_rules > 0 OR v_focus > 0 OR v_watch > 0 OR v_captures > 0 THEN
    INSERT INTO weekly_stats (
      space_id, week_start, photos_count, tasks_done_count, rules_broken_count, focus_minutes, watch_sessions_count, captures_count
    )
    VALUES (
      v_space_id, v_week_start, v_photos, v_tasks, v_rules, v_focus, v_watch, v_captures
    )
    ON CONFLICT (space_id, week_start)
    DO UPDATE SET 
      photos_count = weekly_stats.photos_count + EXCLUDED.photos_count,
      tasks_done_count = weekly_stats.tasks_done_count + EXCLUDED.tasks_done_count,
      rules_broken_count = weekly_stats.rules_broken_count + EXCLUDED.rules_broken_count,
      focus_minutes = weekly_stats.focus_minutes + EXCLUDED.focus_minutes,
      watch_sessions_count = weekly_stats.watch_sessions_count + EXCLUDED.watch_sessions_count,
      captures_count = weekly_stats.captures_count + EXCLUDED.captures_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to feed_events
CREATE TRIGGER trigger_weekly_stats_feed
AFTER INSERT ON feed_events
FOR EACH ROW EXECUTE FUNCTION increment_weekly_stats();

-- Attach trigger to task_completions
CREATE TRIGGER trigger_weekly_stats_tasks
AFTER INSERT ON task_completions
FOR EACH ROW EXECUTE FUNCTION increment_weekly_stats();

-- Attach trigger to ledger_entries
CREATE TRIGGER trigger_weekly_stats_ledger
AFTER INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION increment_weekly_stats();

-- Attach trigger to capture_events
CREATE TRIGGER trigger_weekly_stats_capture
AFTER INSERT ON capture_events
FOR EACH ROW EXECUTE FUNCTION increment_weekly_stats();
