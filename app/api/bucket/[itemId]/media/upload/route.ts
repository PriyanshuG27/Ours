import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: item, error: itemError } = await supabase
    .from("bucket_items")
    .select("space_id")
    .eq("id", params.itemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Bucket item not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const mediaType = formData.get("media_type") as string | null;

  if (!file || !mediaType) {
    return NextResponse.json({ error: "Missing file or media_type" }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'webm';
  const fileName = `${item.space_id}/bucket-media-${params.itemId}-${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(fileName, file, {
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
  }

  const { data: mediaItem, error: insertError } = await supabase
    .from("bucket_media")
    .insert({
      bucket_item_id: params.itemId,
      space_id: item.space_id,
      user_id: user.id,
      media_type: mediaType,
      url_or_content: fileName,
    })
    .select("*")
    .single();

  if (insertError || !mediaItem) {
    return NextResponse.json({ error: "Failed to add media record" }, { status: 500 });
  }

  return NextResponse.json({ mediaItem }, { status: 201 });
}
