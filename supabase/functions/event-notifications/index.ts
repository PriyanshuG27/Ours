import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendPushNotification } from '../_shared/push.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get request body
    const body = await req.json();
    const { userId, type, data } = body;

    if (!userId || !type) {
      return new Response(JSON.stringify({ error: 'Missing userId or type' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Determine payload based on type
    let payload = { title: 'New Notification', body: 'You have a new update.', url: '/' };
    
    switch (type) {
      case 'streak_skip_request':
        payload = { title: 'Streak Skip Request', body: 'Your partner requested to skip a task. Approve or deny?', url: '/streaks' };
        break;
      case 'capture_ping':
        payload = { title: 'Time to Sync!', body: 'Your partner initiated a coordinated capture.', url: '/capture' };
        break;
      case 'focus_invite':
        payload = { title: 'Focus Session', body: 'Your partner invited you to a focus session.', url: '/focus' };
        break;
      case 'watch_invite':
        payload = { title: 'Watch Room', body: 'Your partner invited you to watch something together.', url: '/watch' };
        break;
      case 'watch_pause':
        payload = { title: 'Watch Room Paused', body: 'Your partner paused the video.', url: '/watch' };
        break;
      default:
        if (data && data.title && data.body) {
          payload = { title: data.title, body: data.body, url: data.url || '/' };
        }
    }

    const success = await sendPushNotification(userId, type, payload, supabaseClient);

    return new Response(JSON.stringify({ success }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error processing event notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
