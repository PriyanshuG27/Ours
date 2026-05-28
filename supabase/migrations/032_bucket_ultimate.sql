-- Add new columns to bucket_items
ALTER TABLE bucket_items ADD COLUMN target_date timestamptz;
ALTER TABLE bucket_items ADD COLUMN budget_cents integer;
ALTER TABLE bucket_items ADD COLUMN saved_cents integer NOT NULL DEFAULT 0;
ALTER TABLE bucket_items ADD COLUMN category text;
ALTER TABLE bucket_items ADD COLUMN hype_votes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE bucket_items ADD COLUMN vibe_rating_a integer;
ALTER TABLE bucket_items ADD COLUMN vibe_rating_b integer;

-- Add new column to bucket_todos
ALTER TABLE bucket_todos ADD COLUMN assigned_to uuid REFERENCES auth.users(id);

-- Create bucket_media table for multi-photo galleries, voice memos, and links
CREATE TABLE bucket_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_item_id uuid NOT NULL REFERENCES bucket_items(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  media_type text NOT NULL CHECK (media_type IN ('photo', 'voice', 'link')),
  url_or_content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bucket_media_bucket_item ON bucket_media (bucket_item_id, created_at ASC);

ALTER TABLE bucket_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Space members can read bucket media" ON bucket_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_media.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can insert bucket media" ON bucket_media
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can update bucket media" ON bucket_media
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_media.space_id
      AND auth.uid() = ANY(s.users)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_media.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can delete bucket media" ON bucket_media
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_media.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE bucket_media;
