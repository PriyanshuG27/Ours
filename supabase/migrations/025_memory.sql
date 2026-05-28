-- Phase 10: Memory Features — capture_events, bucket_items, dictionary_entries

-- ============================================================
-- Enum: bucket item lifecycle
-- ============================================================
CREATE TYPE bucket_status_enum AS ENUM ('someday', 'planning', 'done');

-- ============================================================
-- Table: capture_events
-- Coordinated 60-second dual-photo capture between partners
-- ============================================================
CREATE TABLE capture_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  initiator_id uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  photo_a_url text,          -- initiator's photo (storage path)
  photo_b_url text,          -- partner's photo (storage path)
  is_paired boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_capture_events_space
  ON capture_events (space_id, created_at DESC);

ALTER TABLE capture_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Space members can read capture events" ON capture_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = capture_events.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can insert capture events" ON capture_events
  FOR INSERT WITH CHECK (
    auth.uid() = initiator_id
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can update capture events" ON capture_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = capture_events.space_id
      AND auth.uid() = ANY(s.users)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = capture_events.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

-- ============================================================
-- Table: bucket_items
-- Shared bucket list with dual-completion workflow
-- ============================================================
CREATE TABLE bucket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  encrypted_why text NOT NULL,  -- E2EE ciphertext
  status bucket_status_enum NOT NULL DEFAULT 'someday',
  completion_a jsonb,  -- { user_id, photo_url, encrypted_note }
  completion_b jsonb,  -- { user_id, photo_url, encrypted_note }
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bucket_items_space
  ON bucket_items (space_id, created_at DESC);

ALTER TABLE bucket_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Space members can read bucket items" ON bucket_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_items.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can insert bucket items" ON bucket_items
  FOR INSERT WITH CHECK (
    auth.uid() = creator_id
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can update bucket items" ON bucket_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_items.space_id
      AND auth.uid() = ANY(s.users)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = bucket_items.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

-- ============================================================
-- Table: dictionary_entries
-- Inside jokes / private words glossary — fully E2EE
-- ============================================================
CREATE TABLE dictionary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  encrypted_word text NOT NULL,     -- E2EE ciphertext
  encrypted_meaning text NOT NULL,  -- E2EE ciphertext
  encrypted_origin text,            -- E2EE ciphertext (nullable)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dictionary_entries_space
  ON dictionary_entries (space_id, created_at ASC);

ALTER TABLE dictionary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Space members can read dictionary entries" ON dictionary_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = dictionary_entries.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can insert dictionary entries" ON dictionary_entries
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can update dictionary entries" ON dictionary_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = dictionary_entries.space_id
      AND auth.uid() = ANY(s.users)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = dictionary_entries.space_id
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can delete dictionary entries" ON dictionary_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = dictionary_entries.space_id
      AND auth.uid() = ANY(s.users)
    )
  );
