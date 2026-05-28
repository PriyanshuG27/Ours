import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = userData.user.id;

  // 1. Get space ID for the user
  const { data: spaces, error: spaceError } = await (supabase as any)
    .from('spaces')
    .select('id, users')
    .contains('users', [userId])
    .limit(1);

  if (spaceError || !spaces || spaces.length === 0) {
    return NextResponse.json({ error: 'Space not found' }, { status: 404 });
  }

  const spaceId = spaces[0].id;

  try {
    const { encryptedHtml, publishedDate, stats } = await req.json();

    if (!encryptedHtml || !publishedDate || !stats) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Insert into archives
    const { error: insertError } = await (supabase as any)
      .from('newspaper_archives')
      .upsert({
        space_id: spaceId,
        published_date: publishedDate,
        encrypted_html_snapshot: encryptedHtml,
        stats_snapshot: stats,
      }, { onConflict: 'space_id, published_date' });

    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: 'Failed to archive newspaper' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
