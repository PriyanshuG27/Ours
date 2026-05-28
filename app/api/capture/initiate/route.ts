import { createClient } from "@/lib/supabase/server";
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
    .select("id")
    .eq("is_active", true)
    .limit(1);

  const spaceId = spaces?.[0]?.id as string | undefined;

  if (!spaceId) {
    return NextResponse.json({ error: "No active space" }, { status: 403 });
  }

  // Rate limit: removed for testing
  /*
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("capture_events")
    .select("id", { count: "exact", head: true })
    .eq("space_id", spaceId)
    .gte("created_at", oneHourAgo);

  if (count !== null && count > 0) {
    return NextResponse.json(
      { error: "A capture was already initiated in the last hour" },
      { status: 429 }
    );
  }
  */

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

  // TODO: Phase 12 — send push notification to partner

  return NextResponse.json(
    {
      captureEventId: event.id,
      expiresAt: event.expires_at,
    },
    { status: 201 }
  );
}
