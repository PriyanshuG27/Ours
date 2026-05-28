CREATE TABLE bucket_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_item_id uuid NOT NULL REFERENCES bucket_items(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id),
  encrypted_text text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bucket_todos_bucket_item
  ON bucket_todos (bucket_item_id, created_at ASC);

ALTER TABLE bucket_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Space members can read bucket todos" ON bucket_todos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_todos.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can insert bucket todos" ON bucket_todos
  FOR INSERT WITH CHECK (
    auth.uid() = creator_id
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can update bucket todos" ON bucket_todos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_todos.space_id
      AND auth.uid() = ANY(s.users)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_todos.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can delete bucket todos" ON bucket_todos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_todos.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE bucket_todos;
