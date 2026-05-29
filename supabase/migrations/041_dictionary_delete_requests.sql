-- 041_dictionary_delete_requests.sql

ALTER TABLE dictionary_entries 
ADD COLUMN delete_requested_by uuid REFERENCES auth.users(id);

-- Make sure members can update dictionary entries if they want to request a delete
-- The existing update policy in 025_memory.sql already allows members to update any entry
-- So we don't strictly need a new policy, but it's good to ensure it works.
