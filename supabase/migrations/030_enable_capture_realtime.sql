-- Enable realtime for capture_events so the partner device can listen to new captures
ALTER PUBLICATION supabase_realtime ADD TABLE capture_events;
