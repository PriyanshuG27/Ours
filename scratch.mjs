import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: spaces } = await supabase.from('spaces').select('id, users').limit(1);
  if (!spaces || spaces.length === 0) {
    console.log("No spaces found.");
    return;
  }
  const spaceId = spaces[0].id;
  
  const { data: qaResponses, error } = await supabase
    .from('question_responses')
    .select('question_id, user_id, date, encrypted_answer, questions(question_text)')
    .eq('space_id', spaceId)
    // .gte('date', '2026-05-24')
    .order('date', { ascending: false });

  console.log("QA Responses Error:", error);
  console.log("QA Responses Data:", JSON.stringify(qaResponses, null, 2));
}

check();
