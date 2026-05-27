-- Drop old restrictive policies
DROP POLICY IF EXISTS "Owner can update tasks" ON tasks;
DROP POLICY IF EXISTS "Owner can insert completions" ON task_completions;
DROP POLICY IF EXISTS "Requester can insert skip requests" ON skip_requests;

-- Create new policies allowing space members to interact with co-op tasks

-- Tasks: space members can update if it's their task OR if it's a co-op task
CREATE POLICY "Space members can update tasks" ON tasks
  FOR UPDATE
  USING (
    (auth.uid() = owner_id OR is_coop = true)
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  )
  WITH CHECK (
    (auth.uid() = owner_id OR is_coop = true)
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  );

-- Completions: space members can insert if it's their task OR if it's a co-op task
CREATE POLICY "Space members can insert completions" ON task_completions
  FOR INSERT
  WITH CHECK (
    auth.uid() = completed_by
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id 
      AND (t.owner_id = auth.uid() OR t.is_coop = true)
    )
  );

-- Skips: space members can insert skips if it's their task OR if it's a co-op task
CREATE POLICY "Space members can insert skips" ON skip_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id 
      AND (t.owner_id = auth.uid() OR t.is_coop = true)
    )
  );
