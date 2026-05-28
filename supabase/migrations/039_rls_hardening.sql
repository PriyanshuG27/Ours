-- 039_rls_hardening.sql — Phase 13 RLS Audit Fixes
--
-- Full audit completed. All 20+ tables verified.
-- Only actionable fix: board-media storage policies used
-- auth.role() = 'authenticated' which allows ANY authenticated user
-- to read/write ANY board media. Tightened to space-member-only.

-- 1. Drop the overly permissive board-media storage policies
DROP POLICY IF EXISTS "Users can read board media" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert board media" ON storage.objects;

-- 2. Recreate with proper space-member scoping.
--    Board media paths follow: board-media/{space_id}/{filename}
--    We extract the space_id from the folder path and verify membership.
CREATE POLICY "Space members can read board media" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'board-media'
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = (storage.foldername(name))[1]::uuid
      AND auth.uid() = ANY(s.users)
    )
  );

CREATE POLICY "Space members can insert board media" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'board-media'
    AND EXISTS (
      SELECT 1 FROM spaces s
      WHERE s.id = (storage.foldername(name))[1]::uuid
      AND auth.uid() = ANY(s.users)
    )
  );

-- NOTE: The following tables were audited and found to have correct RLS:
-- spaces, feed_events, tasks, task_completions, skip_requests,
-- energy_logs, questions, question_responses, board_cards,
-- board_card_messages, rules, ledger_entries, capture_events,
-- bucket_items, bucket_todos, bucket_media, dictionary_entries,
-- weekly_stats (SELECT only, writes via SECURITY DEFINER trigger),
-- newspaper_archives (SELECT only, writes via service_role),
-- push_subscriptions (user_id = auth.uid() scoping),
-- notification_log (SELECT by own user, inserts via service_role).
--
-- question_responses: blind reveal is enforced client-side.
-- Both partners can SELECT all responses in their space, which is
-- acceptable for a 2-person app where the client controls reveal timing.
