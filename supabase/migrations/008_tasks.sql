-- Create enums
CREATE TYPE mood_tag_enum AS ENUM ('easy', 'struggled', 'forced', 'proud');
CREATE TYPE skip_status_enum AS ENUM ('pending', 'approved', 'denied');

-- Tasks table
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  streak_count integer DEFAULT 0,
  last_completed_at timestamptz,
  is_active boolean DEFAULT true
);

-- Task completions table
CREATE TABLE task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_by uuid NOT NULL REFERENCES auth.users(id),
  completed_at timestamptz DEFAULT now(),
  mood_tag mood_tag_enum NOT NULL,
  streak_at_completion integer NOT NULL
);

-- Skip requests table
CREATE TABLE skip_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id),
  reason text,
  status skip_status_enum DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX idx_tasks_space_id ON tasks(space_id);
CREATE INDEX idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX idx_skip_requests_task_id ON skip_requests(task_id);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE skip_requests ENABLE ROW LEVEL SECURITY;

-- Tasks Policies
CREATE POLICY "Space members can read all tasks in their space" ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = tasks.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Owner can insert tasks" ON tasks
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Owner can update tasks" ON tasks
  FOR UPDATE
  USING (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  )
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  );

-- Task Completions Policies
CREATE POLICY "Space members can read task completions" ON task_completions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN spaces s ON s.id = t.space_id
      WHERE t.id = task_completions.task_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Owner can insert completions" ON task_completions
  FOR INSERT
  WITH CHECK (
    auth.uid() = completed_by
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND t.owner_id = auth.uid()
    )
  );

-- Skip Requests Policies
CREATE POLICY "Space members can read skip requests" ON skip_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN spaces s ON s.id = t.space_id
      WHERE t.id = skip_requests.task_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Requester can insert skip requests" ON skip_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Space members can update skip requests" ON skip_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN spaces s ON s.id = t.space_id
      WHERE t.id = skip_requests.task_id
      AND auth.uid() = ANY(s.users)
    )
  );

-- Auto-approve pending skips PostgreSQL function
CREATE OR REPLACE FUNCTION auto_approve_pending_skips()
RETURNS void AS $$
BEGIN
  -- We just set status to approved for any pending request older than 24h.
  -- Streak protection is inherently handled because 'approved' status
  -- does not trigger a streak break. The streak count on tasks remains unchanged.
  UPDATE skip_requests
  SET 
    status = 'approved',
    resolved_at = now()
  WHERE 
    status = 'pending'
    AND created_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
