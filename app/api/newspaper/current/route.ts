import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = userData.user.id;

  // 1. Get space ID for the user
  const { data: spaces, error: spaceError } = await (supabase as any)
    .from('spaces')
    .select('id, users, user_names, created_at')
    .contains('users', [userId])
    .limit(1);

  if (spaceError || !spaces || spaces.length === 0) {
    return NextResponse.json({ error: 'Space not found' }, { status: 404 });
  }

  const spaceId = spaces[0].id;
  const names = { a: spaces[0].user_names[0] || 'Partner A', b: spaces[0].user_names[1] || 'Partner B' };

  // Calculate edition number
  const createdDate = new Date(spaces[0].created_at);
  const msInWeek = 1000 * 60 * 60 * 24 * 7;
  let editionNumber = Math.floor((Date.now() - createdDate.getTime()) / msInWeek) + 1;
  if (editionNumber < 1) editionNumber = 1;

  // Determine current week start (Monday)
  // JS Date handling: 0 is Sunday, 1 is Monday.
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const weekStart = new Date(today.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // 2. Fetch weekly_stats
  const { data: statsData } = await (supabase as any)
    .from('weekly_stats')
    .select('*')
    .eq('space_id', spaceId)
    .eq('week_start', weekStartStr)
    .maybeSingle();

  const stats = statsData || {
    photos_count: 0,
    tasks_done_count: 0,
    rules_broken_count: 0,
    focus_minutes: 0,
    watch_sessions_count: 0,
    captures_count: 0,
  };

  // 3. Fetch random dictionary entry
  const { data: dictEntries } = await (supabase as any)
    .from('dictionary_entries')
    .select('encrypted_word, encrypted_meaning')
    .eq('space_id', spaceId);
  
  let dictWord = null;
  if (dictEntries && dictEntries.length > 0) {
    const randomEntry = dictEntries[Math.floor(Math.random() * dictEntries.length)];
    dictWord = {
      word: randomEntry.encrypted_word,
      meaning: randomEntry.encrypted_meaning,
    };
  }

  // 4. Fetch last watch session title
  const { data: watchEvents } = await (supabase as any)
    .from('feed_events')
    .select('metadata')
    .eq('space_id', spaceId)
    .eq('type', 'watch_session')
    .order('created_at', { ascending: false })
    .limit(1);

  let watchTitle = null;
  if (watchEvents && watchEvents.length > 0 && watchEvents[0].metadata?.title) {
    watchTitle = watchEvents[0].metadata.title;
  }

  // 5. Fetch last Q&A response pair (if both answered this week)
  const { data: qaResponses, error: qaError } = await (supabase as any)
    .from('question_responses')
    .select('question_id, user_id, encrypted_answer')
    .eq('space_id', spaceId)
    .gte('date', weekStartStr)
    .order('date', { ascending: false });

  let qa = null;
  if (qaResponses && qaResponses.length >= 2) {
    // Find the latest question that both users answered
    const questionGroups = qaResponses.reduce((acc: any, curr: any) => {
      if (!acc[curr.question_id]) acc[curr.question_id] = [];
      acc[curr.question_id].push(curr);
      return acc;
    }, {});

    for (const qId of Object.keys(questionGroups)) {
      // Find distinct users who answered this question
      const uniqueUsers = Array.from(new Set(questionGroups[qId].map((r: any) => r.user_id)));
      
      if (uniqueUsers.length >= 2) {
        // Find the responses for user A and user B
        const userAId = spaces[0].users[0];
        const userBId = spaces[0].users[1];
        
        const r1 = questionGroups[qId].find((r: any) => r.user_id === userAId);
        const r2 = questionGroups[qId].find((r: any) => r.user_id === userBId);
        
        if (r1 && r2) {
          // Fetch the actual question text since we can't join without a foreign key
          let questionText = "Daily Question";
          const { data: dynQ } = await (supabase as any).from('dynamic_questions').select('question_text').eq('id', qId).maybeSingle();
          if (dynQ && dynQ.question_text) {
            questionText = dynQ.question_text;
          } else {
            const { data: statQ } = await (supabase as any).from('questions').select('question_text').eq('id', qId).maybeSingle();
            if (statQ && statQ.question_text) {
              questionText = statQ.question_text;
            }
          }

          qa = {
            question: questionText,
            answerA: r1.encrypted_answer,
            answerB: r2.encrypted_answer,
          };
          break; // Only need one complete pair
        }
      }
    }
  }

  return NextResponse.json({
    names,
    editionNumber,
    stats,
    qa,
    dictWord,
    watchTitle,
    weekStart: weekStartStr
  });
}
