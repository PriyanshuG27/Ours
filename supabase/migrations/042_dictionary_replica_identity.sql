-- 042_dictionary_replica_identity.sql

-- Enable REPLICA IDENTITY FULL so that DELETE events include all columns
-- (including space_id) in the old_record payload. Without this, the frontend's
-- realtime filter `space_id=eq.${spaceId}` ignores DELETE events.
ALTER TABLE dictionary_entries REPLICA IDENTITY FULL;
