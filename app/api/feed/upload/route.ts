import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const supabase = await createClient();

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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  // Caption is E2EE ciphertext — encrypted client-side before upload.
  // Server stores it as-is; never sees plaintext.
  const caption = formData.get("caption") as string | null;
  const type = formData.get("type") as string | null;

  if (!type) {
    return NextResponse.json({ error: "Missing type" }, { status: 400 });
  }

  const validTypes = [
    "photo",
    "note",
    "task_done",
    "mood",
    "watch_session",
    "focus_session",
    "capture",
  ] as const;

  if (!validTypes.includes(type as (typeof validTypes)[number])) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  // Photo daily limit: 5 per person per day
  if (type === "photo") {
    const oneDayAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const { count } = await supabase
      .from("feed_events")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id)
      .eq("type", "photo")
      .gte("created_at", oneDayAgo);

    if (count !== null && count >= 5) {
      return NextResponse.json(
        { error: "Daily photo limit reached (5 per day)" },
        { status: 429 }
      );
    }
  }

  let mediaUrl: string | null = null;

  // Upload file to Supabase Storage: media/{spaceId}/{timestamp}-{uuid}.webp
  if (file && (type === "photo" || type === "capture")) {
    const fileName = `${spaceId}/${Date.now()}-${randomUUID()}.webp`;

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

    mediaUrl = fileName;
  }

  // Caption is already E2EE ciphertext from the client — store as-is
  const { data: event, error: insertError } = await supabase
    .from("feed_events")
    .insert({
      space_id: spaceId,
      author_id: user.id,
      type: type as (typeof validTypes)[number],
      media_url: mediaUrl,
      encrypted_caption: caption,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { eventId: event.id, mediaUrl },
    { status: 201 }
  );
}
