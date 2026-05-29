import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ itemId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: media, error } = await supabase
    .from("bucket_media")
    .select("*")
    .eq("bucket_item_id", params.itemId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }

  return NextResponse.json({ media: media ?? [] });
}

export async function POST(request: Request, props: { params: Promise<{ itemId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { media_type: string; url_or_content: string };
  if (!body.media_type || !body.url_or_content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Fetch the bucket item to get the space_id
  const { data: item, error: itemError } = await supabase
    .from("bucket_items")
    .select("space_id")
    .eq("id", params.itemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Bucket item not found" }, { status: 404 });
  }

  const { data: mediaItem, error: insertError } = await supabase
    .from("bucket_media")
    .insert({
      bucket_item_id: params.itemId,
      space_id: item.space_id,
      user_id: user.id,
      media_type: body.media_type,
      url_or_content: body.url_or_content,
    })
    .select("*")
    .single();

  if (insertError || !mediaItem) {
    return NextResponse.json({ error: "Failed to add media" }, { status: 500 });
  }

  return NextResponse.json({ mediaItem }, { status: 201 });
}
