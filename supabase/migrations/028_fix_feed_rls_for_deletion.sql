-- Drop existing restrictive author-only policies
DROP POLICY IF EXISTS "Authors can update their own feed events" ON feed_events;
DROP POLICY IF EXISTS "Authors can delete their own feed events" ON feed_events;

-- Create new policies allowing any space member to update/delete
-- Since this app focuses on a shared 2-player space, either partner
-- can update (e.g. to request a delete) or delete (e.g. to approve a delete)
CREATE POLICY "Space members can update feed events"
    ON feed_events FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM spaces s
        WHERE s.id = feed_events.space_id
        AND auth.uid() = ANY(s.users)
      )
    );

CREATE POLICY "Space members can delete feed events"
    ON feed_events FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM spaces s
        WHERE s.id = feed_events.space_id
        AND auth.uid() = ANY(s.users)
      )
    );
