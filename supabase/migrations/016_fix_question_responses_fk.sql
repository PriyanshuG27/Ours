-- 016_fix_question_responses_fk.sql

-- Drop the foreign key constraint on question_responses.question_id
-- because it now might reference the dynamic_questions table instead 
-- of the static questions table.
alter table question_responses drop constraint question_responses_question_id_fkey;
