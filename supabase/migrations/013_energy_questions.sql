-- 013_energy_questions.sql

-- 1. ENERGY LOGS
create table energy_logs (
    id uuid primary key default gen_random_uuid(),
    space_id uuid not null references public.spaces(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    date date not null default current_date,
    morning_level smallint check (morning_level between 1 and 5) null,
    night_level smallint check (night_level between 1 and 5) null,
    unique(space_id, user_id, date)
);

alter table energy_logs enable row level security;

create policy "Users can read energy logs in their space"
    on energy_logs for select
    using (space_id in (select id from public.spaces where auth.uid() = ANY(users)));

create policy "Users can insert their own energy logs"
    on energy_logs for insert
    with check (user_id = auth.uid() and space_id in (select id from public.spaces where auth.uid() = ANY(users)));

create policy "Users can update their own energy logs"
    on energy_logs for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid() and space_id in (select id from public.spaces where auth.uid() = ANY(users)));

-- 2. QUESTIONS
create table questions (
    id uuid primary key default gen_random_uuid(),
    question_text text not null,
    display_order integer unique not null
);

-- Questions are readable by anyone (or authenticated users)
alter table questions enable row level security;
create policy "Anyone can read questions"
    on questions for select
    using (true);

-- 3. QUESTION RESPONSES
create table question_responses (
    id uuid primary key default gen_random_uuid(),
    space_id uuid not null references public.spaces(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    question_id uuid not null references public.questions(id) on delete cascade,
    date date not null default current_date,
    encrypted_answer text not null,
    unique(space_id, user_id, date)
);

alter table question_responses enable row level security;

create policy "Users can read responses in their space"
    on question_responses for select
    using (space_id in (select id from public.spaces where auth.uid() = ANY(users)));

create policy "Users can insert their own responses"
    on question_responses for insert
    with check (user_id = auth.uid() and space_id in (select id from public.spaces where auth.uid() = ANY(users)));

create policy "Users can update their own responses"
    on question_responses for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid() and space_id in (select id from public.spaces where auth.uid() = ANY(users)));

-- 4. SEED DATA
insert into questions (question_text, display_order) values
    ('What was the highlight of your day?', 1),
    ('What is one thing you are looking forward to tomorrow?', 2),
    ('What made you smile today?', 3),
    ('What is something you learned today?', 4),
    ('If you could relive one moment from today, what would it be?', 5),
    ('What is something you struggled with today?', 6),
    ('How did you show kindness to yourself today?', 7),
    ('What is a small win you had today?', 8),
    ('What are you most grateful for right now?', 9),
    ('If your day was a movie, what would the genre be?', 10);
