import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find user's active space
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, users")
    .eq("is_active", true)
    .limit(1);

  const spaceId = spaces?.[0]?.id as string | undefined;

  if (!spaceId) {
    return NextResponse.json({ error: "No active space" }, { status: 403 });
  }

  // Rate limit: max 1 capture per hour per user (via notification_log)
  const isAllowed = await checkRateLimit(user.id, 'capture_ping', 60, adminClient);
  if (!isAllowed) {
    return NextResponse.json(
      { error: "A capture was already initiated in the last hour" },
      { status: 429 }
    );
  }

  // Create capture event with 60-second window
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  const { data: event, error: insertError } = await supabase
    .from("capture_events")
    .insert({
      space_id: spaceId,
      initiator_id: user.id,
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();

  if (insertError || !event) {
    return NextResponse.json(
      { error: "Failed to create capture event" },
      { status: 500 }
    );
  }

  // Phase 12 — send push notification to partner
  const space = spaces[0];
  const partnerId = space.users?.find((id: string) => id !== user.id);
  if (partnerId) {
    supabase.functions.invoke('event-notifications', {
      body: {
        userId: partnerId,
        type: 'capture_ping',
        data: {}
      }
    }).catch(e => console.error("Push notification trigger failed", e));
  }

  return NextResponse.json(
    {
      captureEventId: event.id,
      expiresAt: event.expires_at,
    },
    { status: 201 }
  );
}
