ALTER TABLE capture_events ADD COLUMN partner_joined boolean NOT NULL DEFAULT false;
ALTER TABLE capture_events ADD COLUMN shutter_clicked_at timestamptz;

-- Update RLS for capture_events to allow UPDATE by space members
-- Since we already have an UPDATE policy, let's verify if we need to modify it or just drop/recreate
DROP POLICY IF EXISTS "Space members can update capture events" ON capture_events;
CREATE POLICY "Space members can update capture events" ON capture_events
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM spaces s
        WHERE s.id = capture_events.space_id
        AND auth.uid() = ANY(s.users)
      )
    );
