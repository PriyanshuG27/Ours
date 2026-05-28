import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendPushNotification } from '../_shared/push.ts';

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Parse the cron payload if it exists (pg_cron can pass payload, or we deduce by time)
    // We'll deduce by time if no type is explicitly passed
    let type = 'unknown';
    
    // Using UTC to determine the time, but for a global app you'd ideally use user timezones.
    // For "Ours", we assume a single timezone or server time for simplicity as requested.
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay(); // 0 = Sunday
    
    // In UTC: Let's assume server is in a specific timezone, or we just rely on cron schedule exact triggers.
    // If pg_cron triggers this, we might pass a `type` query parameter or body.
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.type) type = body.type;
      } catch (e) {
        // Ignore JSON parse errors for empty bodies
      }
    }
    
    const url = new URL(req.url);
    if (url.searchParams.has('type')) {
      type = url.searchParams.get('type')!;
    }

    let payload = { title: 'Notification', body: 'Update from Ours', url: '/' };
    
    switch (type) {
      case 'energy_morning':
        payload = { title: 'Morning Check-in', body: 'Good morning! How are your energy levels today?', url: '/energy' };
        break;
      case 'energy_night':
        payload = { title: 'Night Check-in', body: 'Good evening! How are your energy levels tonight?', url: '/energy' };
        break;
      case 'qa_daily':
        payload = { title: 'Question of the Day', body: 'A new question is waiting for you both.', url: '/qa' };
        break;
      case 'newspaper':
        payload = { title: 'The Sunday Paper', body: 'The presses have stopped. The Sunday edition is ready to read!', url: '/newspaper' };
        break;
      default:
        console.log('Unrecognized scheduled type:', type);
        return new Response(JSON.stringify({ error: 'Unrecognized type' }), { status: 400 });
    }

    // Fetch all users with active spaces
    // Since this app is for 2 people per space, we can just fetch all users who have a push subscription
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('push_subscriptions')
      .select('user_id');

    if (subError) {
      throw subError;
    }

    let successCount = 0;
    const promises = subscriptions.map((sub: any) => 
      sendPushNotification(sub.user_id, type, payload, supabaseClient)
        .then(res => { if (res) successCount++; })
    );

    await Promise.all(promises);

    return new Response(JSON.stringify({ successCount, total: subscriptions.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error processing scheduled notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
