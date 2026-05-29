-- 040_realtime_task_completions.sql

-- Add task_completions to the realtime publication so streaks update instantly
ALTER PUBLICATION supabase_realtime ADD TABLE task_completions;
