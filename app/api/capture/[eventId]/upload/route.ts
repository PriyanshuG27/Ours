import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: Request, props: { params: Promise<{ eventId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = params;

  // Fetch the capture event (RLS ensures user is in the space)
  const { data: event, error: fetchError } = await supabase
    .from("capture_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (fetchError || !event) {
    return NextResponse.json(
      { error: "Capture event not found" },
      { status: 404 }
    );
  }

  // Server-side expiry check — reject late uploads
  if (new Date(event.expires_at as string) < new Date()) {
    return NextResponse.json(
      { error: "Capture window has expired" },
      { status: 410 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const spaceId = event.space_id as string;

  // Determine if uploader is initiator (photo_a) or partner (photo_b)
  const isInitiator = user.id === event.initiator_id;
  const slot = isInitiator ? "photo_a_url" : "photo_b_url";

  // Check if this user already uploaded
  if (isInitiator && event.photo_a_url) {
    return NextResponse.json(
      { error: "You already submitted your photo" },
      { status: 409 }
    );
  }
  if (!isInitiator && event.photo_b_url) {
    return NextResponse.json(
      { error: "You already submitted your photo" },
      { status: 409 }
    );
  }

  // Upload to Supabase Storage
  const fileName = `${spaceId}/capture-${eventId}-${isInitiator ? "a" : "b"}-${randomUUID()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(fileName, file, {
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed: " + uploadError.message },
      { status: 500 }
    );
  }

  // Update capture event with the photo URL
  // We use .select() to get the row AFTER our update to prevent race conditions
  const { data: updatedEvent, error: updateError } = isInitiator
    ? await supabase
        .from("capture_events")
        .update({
          photo_a_url: fileName,
          ...(event.photo_b_url ? { is_paired: true } : {}),
        })
        .eq("id", eventId)
        .select()
        .single()
    : await supabase
        .from("capture_events")
        .update({
          photo_b_url: fileName,
          ...(event.photo_a_url ? { is_paired: true } : {}),
        })
        .eq("id", eventId)
        .select()
        .single();

  if (updateError || !updatedEvent) {
    return NextResponse.json(
      { error: "Failed to update capture event" },
      { status: 500 }
    );
  }

  const isPartnerJoined = updatedEvent.partner_joined as boolean;
  const hasBothPhotos = !!(updatedEvent.photo_a_url && updatedEvent.photo_b_url);

  // If partner joined, we only insert the feed event when BOTH photos are uploaded
  if (isPartnerJoined) {
    if (hasBothPhotos) {
      // Both photos are uploaded! Insert a single combined feed event
      // To prevent race conditions where BOTH updates trigger the insert,
      // we only let the INITIATOR create the feed event (if they uploaded second),
      // OR the PARTNER create it (if they uploaded second).
      // Wait, PostgreSQL UPDATE locks the row, so the second one to finish will see both photos.
      
      await supabase.from("feed_events").insert({
        space_id: spaceId,
        author_id: updatedEvent.initiator_id as string, // initiator owns the combined event
        type: "capture" as const,
        media_url: updatedEvent.photo_a_url as string, // Store photo A in main URL
        is_pinned: true,
        metadata: {
          captureEventId: eventId,
          isPaired: true,
          photo_b_url: updatedEvent.photo_b_url, // Store photo B in metadata
        },
      });
    }
  } else {
    // Solo capture: insert feed event immediately
    await supabase.from("feed_events").insert({
      space_id: spaceId,
      author_id: user.id,
      type: "capture" as const,
      media_url: fileName,
      is_pinned: true,
      metadata: {
        captureEventId: eventId,
        isPaired: false,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
