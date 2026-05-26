CREATE TABLE spaces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  invite_code text unique not null,
  users uuid[] not null default '{}',
  user_names text[] not null default '{}',
  space_name text,
  is_active boolean default true,
  CONSTRAINT check_users_length CHECK (array_length(users, 1) <= 2)
);

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own space" ON spaces
  FOR SELECT
  USING (auth.uid() = ANY(users));

CREATE POLICY "Creator can insert" ON spaces
  FOR INSERT
  WITH CHECK (auth.uid() = users[1]);

CREATE POLICY "Partner can join" ON spaces
  FOR UPDATE
  USING (array_length(users, 1) = 1 AND auth.uid() != users[1])
  WITH CHECK (array_length(users, 1) = 1 AND auth.uid() != users[1]);
