import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  _request: Request,
  { params }: { params: { eventId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = params;

  // Fetch the current event (RLS ensures user is in the space)
  const { data: event, error: fetchError } = await supabase
    .from("feed_events")
    .select("id, is_pinned")
    .eq("id", eventId)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const newPinned = !event.is_pinned;

  const { error: updateError } = await supabase
    .from("feed_events")
    .update({ is_pinned: newPinned })
    .eq("id", eventId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update pin" },
      { status: 500 }
    );
  }

  return NextResponse.json({ isPinned: newPinned });
}
