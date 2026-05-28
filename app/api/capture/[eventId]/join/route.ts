import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabase = createClient();
  const { eventId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Extend expiration by 60s
  const newExpiresAt = new Date(Date.now() + 60_000).toISOString();

  const { data: event, error: updateError } = await supabase
    .from("capture_events")
    .update({
      partner_joined: true,
      expires_at: newExpiresAt,
    })
    .eq("id", eventId)
    .select("id, expires_at")
    .single();

  if (updateError || !event) {
    return NextResponse.json(
      { error: "Failed to join capture" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      captureEventId: event.id,
      expiresAt: event.expires_at,
    },
    { status: 200 }
  );
}
