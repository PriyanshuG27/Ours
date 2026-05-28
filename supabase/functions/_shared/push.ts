import webPush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const vapidPublicKey = Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@ours.app';

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendPushNotification(
  userId: string,
  type: string,
  payload: PushPayload,
  supabaseAdmin: any // Pass in the authenticated admin client
) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('Missing VAPID keys. Cannot send push notification.');
    return false;
  }

  // 1. Check Rate Limiting (60 mins for the same type)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: recentLogs, error: logError } = await supabaseAdmin
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('sent_at', oneHourAgo)
    .limit(1);

  if (logError) {
    console.error('Error checking notification log:', logError);
    return false;
  }

  if (recentLogs && recentLogs.length > 0) {
    console.log(`Rate limited: User ${userId} already received '${type}' in the last hour.`);
    return false;
  }

  // 2. Fetch Subscription
  const { data: subData, error: subError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .maybeSingle();

  if (subError) {
    console.error('Error fetching subscription:', subError);
    return false;
  }

  if (!subData || !subData.subscription) {
    console.log(`No subscription found for user ${userId}. Skipping silently.`);
    return false;
  }

  // 3. Send Notification
  try {
    await webPush.sendNotification(
      subData.subscription,
      JSON.stringify(payload)
    );

    // 4. Log Success
    await supabaseAdmin.from('notification_log').insert({
      user_id: userId,
      type: type,
    });

    console.log(`Push sent successfully to user ${userId} (type: ${type})`);
    return true;

  } catch (err: any) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // Subscription expired or unsubscribed, clean it up
      console.log(`Subscription invalid for user ${userId}. Deleting from DB.`);
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);
    } else {
      console.error('Error sending push notification:', err);
    }
    return false;
  }
}
