-- Enable real-time for tasks and skip_requests
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE skip_requests;
