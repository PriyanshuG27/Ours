-- Add is_flagged column to task_completions
ALTER TABLE task_completions ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE;

-- Allow space members to update task_completions (needed to set is_flagged = true)
CREATE POLICY "Space members can update task completions" ON task_completions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN spaces s ON s.id = t.space_id
      WHERE t.id = task_completions.task_id
      AND auth.uid() = ANY(s.users)
    )
  );
