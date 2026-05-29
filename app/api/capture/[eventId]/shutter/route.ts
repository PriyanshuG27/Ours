import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabase = await createClient();
  const { eventId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only update if shutter_clicked_at is null (first person to click wins)
  const { data: event, error: fetchError } = await supabase
    .from("capture_events")
    .select("shutter_clicked_at")
    .eq("id", eventId)
    .single();

  if (fetchError || !event) {
    return NextResponse.json(
      { error: "Event not found" },
      { status: 404 }
    );
  }

  if (event.shutter_clicked_at) {
    // Already clicked, just return the existing time
    return NextResponse.json({ shutterClickedAt: event.shutter_clicked_at }, { status: 200 });
  }

  // Set the shutter_clicked_at to current time
  const shutterClickedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("capture_events")
    .update({
      shutter_clicked_at: shutterClickedAt,
    })
    .eq("id", eventId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to sync shutter" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { shutterClickedAt },
    { status: 200 }
  );
}
