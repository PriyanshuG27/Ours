CREATE TYPE rule_status_enum AS ENUM ('proposed', 'active', 'retired');

CREATE TABLE rules (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    space_id uuid not null references spaces(id) on delete cascade,
    author_id uuid not null references auth.users(id) on delete cascade,
    encrypted_text text not null,
    status rule_status_enum not null default 'proposed',
    accepted_at timestamptz
);

ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Space members can read all rules" ON rules
    FOR SELECT
    USING (exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

CREATE POLICY "Author can insert rules" ON rules
    FOR INSERT
    WITH CHECK (auth.uid() = author_id AND exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

CREATE POLICY "Partner can update status" ON rules
    FOR UPDATE
    USING (auth.uid() != author_id AND exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

CREATE TABLE ledger_entries (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    rule_id uuid not null references rules(id) on delete cascade,
    space_id uuid not null references spaces(id) on delete cascade,
    charger_id uuid not null references auth.users(id) on delete cascade,
    charged_id uuid not null references auth.users(id) on delete cascade,
    encrypted_note text,
    is_settled boolean not null default false,
    settled_at timestamptz
);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Space members can read all ledger entries" ON ledger_entries
    FOR SELECT
    USING (exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

CREATE POLICY "Charger can insert ledger entries" ON ledger_entries
    FOR INSERT
    WITH CHECK (auth.uid() = charger_id AND exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

CREATE POLICY "Either party can update is_settled" ON ledger_entries
    FOR UPDATE
    USING (exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));
