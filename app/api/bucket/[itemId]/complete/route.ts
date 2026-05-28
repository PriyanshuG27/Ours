import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

type CompletionPayload = {
  user_id: string;
  photo_url: string | null;
  encrypted_note: string;
};

export async function POST(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = params;

  // Fetch the bucket item (RLS ensures user is in the space)
  const { data: item, error: fetchError } = await supabase
    .from("bucket_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (fetchError || !item) {
    return NextResponse.json(
      { error: "Bucket item not found" },
      { status: 404 }
    );
  }

  // Prevent completion if not in planning status
  if (item.status !== "planning") {
    return NextResponse.json(
      { error: "Item must be in 'planning' status to complete" },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const encryptedNote = formData.get("encryptedNote") as string | null;

  if (!encryptedNote) {
    return NextResponse.json(
      { error: "Missing encryptedNote" },
      { status: 400 }
    );
  }

  const spaceId = item.space_id as string;

  // Prevent same user from filling both completion slots
  const completionA = item.completion_a as CompletionPayload | null;
  const completionB = item.completion_b as CompletionPayload | null;

  if (completionA?.user_id === user.id || completionB?.user_id === user.id) {
    return NextResponse.json(
      { error: "You already completed this item" },
      { status: 409 }
    );
  }

  const slot = completionA === null ? "a" : "b";
  let fileName: string | null = null;

  if (file) {
    fileName = `${spaceId}/bucket-${itemId}-${slot}-${randomUUID()}.webp`;
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
  }

  // Build the completion payload
  const completion: CompletionPayload = {
    user_id: user.id,
    photo_url: fileName,
    encrypted_note: encryptedNote,
  };

  // Update the correct slot with typed update
  const { error: updateError } = slot === "a"
    ? await supabase
        .from("bucket_items")
        .update({
          completion_a: completion,
          // If partner already completed slot b, finalize
          ...(completionB !== null
            ? { status: "done" as const, completed_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", itemId)
    : await supabase
        .from("bucket_items")
        .update({
          completion_b: completion,
          // If partner already completed slot a, finalize
          ...(completionA !== null
            ? { status: "done" as const, completed_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", itemId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update bucket item" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, slot });
}
