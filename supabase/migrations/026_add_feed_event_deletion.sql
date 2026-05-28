ALTER TABLE feed_events ADD COLUMN delete_requested_by uuid REFERENCES auth.users(id);
