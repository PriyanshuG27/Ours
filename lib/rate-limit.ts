import { type SupabaseClient } from '@supabase/supabase-js'

/**
 * Checks whether a user has already triggered a notification of the given type
 * within the specified time window.
 *
 * Uses the `notification_log` table (Phase 12) as the single source of truth
 * for rate limiting across all ping-triggering endpoints.
 *
 * @param userId     - The user whose rate limit to check
 * @param type       - Notification type key (e.g. 'capture_ping', 'focus_invite')
 * @param windowMinutes - How far back to look (default: 60 minutes)
 * @param supabaseAdmin - An admin/service-role Supabase client (bypasses RLS)
 * @returns `true` if under the limit (OK to proceed), `false` if rate-limited
 */
export async function checkRateLimit(
  userId: string,
  type: string,
  windowMinutes: number,
  supabaseAdmin: SupabaseClient
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('sent_at', cutoff)
    .limit(1)

  if (error) {
    // If we can't verify the rate limit, fail open to avoid blocking
    // legitimate requests. Log the error for observability.
    // eslint-disable-next-line no-console
    console.error('[rate-limit] Error checking notification_log:', error)
    return true
  }

  // If any matching entry exists within the window, the user is rate-limited
  return !data || data.length === 0
}
