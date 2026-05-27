-- 014_dynamic_questions.sql

create table dynamic_questions (
    id uuid primary key default gen_random_uuid(),
    space_id uuid not null references public.spaces(id) on delete cascade,
    date date not null default current_date,
    question_text text not null,
    unique(space_id, date)
);

alter table dynamic_questions enable row level security;

create policy "Users can read dynamic questions in their space"
    on dynamic_questions for select
    using (space_id in (select id from public.spaces where auth.uid() = ANY(users)));

-- The Edge function uses service_role key to insert, so we don't need to add an INSERT policy for users.
