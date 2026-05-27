-- 1. Add new columns to rules
ALTER TABLE rules ADD COLUMN encrypted_penalty text;
ALTER TABLE rules ADD COLUMN category text NOT NULL DEFAULT 'Household';

-- 2. Add new column to ledger_entries
ALTER TABLE ledger_entries ADD COLUMN forgiveness_requested boolean NOT NULL DEFAULT false;

-- 3. Fix the RLS Policy on ledger_entries
DROP POLICY IF EXISTS "Either party can update is_settled" ON ledger_entries;

CREATE POLICY "Only charger can update is_settled" ON ledger_entries
    FOR UPDATE
    USING (auth.uid() = charger_id AND exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

CREATE POLICY "Charged partner can update forgiveness_requested" ON ledger_entries
    FOR UPDATE
    USING (auth.uid() = charged_id AND exists (select 1 from spaces s where s.id = space_id and auth.uid() = any(s.users)));

-- 4. Enable Realtime for Rulebook
ALTER PUBLICATION supabase_realtime ADD TABLE rules;
ALTER PUBLICATION supabase_realtime ADD TABLE ledger_entries;
