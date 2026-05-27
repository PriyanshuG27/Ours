-- Create feed event type enum
CREATE TYPE feed_event_type AS ENUM (
  'photo', 'note', 'task_done', 'mood',
  'watch_session', 'focus_session', 'capture'
);

-- Create feed_events table
CREATE TABLE feed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  type feed_event_type NOT NULL,
  media_url text,
  encrypted_caption text,
  metadata jsonb DEFAULT '{}',
  is_pinned boolean DEFAULT false
);

-- Index for feed queries (cursor pagination by created_at)
CREATE INDEX idx_feed_events_space_created
  ON feed_events (space_id, created_at DESC);

-- Index for daily photo count check
CREATE INDEX idx_feed_events_author_type_created
  ON feed_events (author_id, type, created_at DESC);

-- Enable RLS
ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;

-- Space members can read all feed events in their space
-- Uses EXISTS + ANY(s.users) to compare auth.uid() against the uuid[] array
CREATE POLICY "Space members can read feed events" ON feed_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = feed_events.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

-- Author can insert feed events (must be in the space)
CREATE POLICY "Author can insert feed events" ON feed_events
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  );

-- Space members can update pin status
CREATE POLICY "Space members can update pin status" ON feed_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = feed_events.space_id
      AND auth.uid() = ANY(s.users)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = feed_events.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

-- Storage bucket for media (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage: space members can upload media scoped to their spaceId folder
CREATE POLICY "Space members can upload media" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = (storage.foldername(name))[1]::uuid
      AND auth.uid() = ANY(s.users)
    )
  );

-- Storage: space members can read media from their spaceId folder
CREATE POLICY "Space members can read media" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = (storage.foldername(name))[1]::uuid
      AND auth.uid() = ANY(s.users)
    )
  );
