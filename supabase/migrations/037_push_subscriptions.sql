-- 037_push_subscriptions.sql

-- 1. Push Subscriptions Table
create table push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade unique,
    subscription jsonb not null,
    created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "Users can read their own push subscription"
    on push_subscriptions for select
    using (user_id = auth.uid());

create policy "Users can insert their own push subscription"
    on push_subscriptions for insert
    with check (user_id = auth.uid());

create policy "Users can update their own push subscription"
    on push_subscriptions for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Users can delete their own push subscription"
    on push_subscriptions for delete
    using (user_id = auth.uid());


-- 2. Notification Log Table (for rate limiting)
create table notification_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null,
    sent_at timestamptz default now()
);

alter table notification_log enable row level security;

create policy "Users can read their own notification log"
    on notification_log for select
    using (user_id = auth.uid());

-- Inserts are handled by Edge Functions (service_role), so users don't need insert policy.
