create type board_column_enum as enum ('on_my_mind', 'lets_talk', 'resolved');

create table board_cards (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  space_id uuid references spaces(id) on delete cascade not null,
  author_id uuid references auth.users(id) not null,
  encrypted_text text not null,
  "column" board_column_enum not null default 'on_my_mind',
  position integer not null default 0,
  resolved_at timestamptz
);

alter table board_cards enable row level security;

create policy "Users can read board cards in their space"
  on board_cards for select
  using (exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

create policy "Users can insert board cards in their space"
  on board_cards for insert
  with check (exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

create policy "Users can update board cards in their space"
  on board_cards for update
  using (exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

create policy "Users can delete their own board cards"
  on board_cards for delete
  using (auth.uid() = author_id and exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

create or replace function archive_old_resolved_cards()
returns void as $$
begin
  delete from board_cards
  where "column" = 'resolved'
  and resolved_at < now() - interval '7 days';
end;
$$ language plpgsql security definer;
