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

  const { data: todos, error } = await supabase
    .from("bucket_todos")
    .select("*")
    .eq("bucket_item_id", params.itemId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch todos" }, { status: 500 });
  }

  return NextResponse.json({ todos: todos ?? [] });
}

export async function POST(request: Request, props: { params: Promise<{ itemId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { encryptedText?: string };
  if (!body.encryptedText) {
    return NextResponse.json({ error: "Missing encryptedText" }, { status: 400 });
  }

  // Fetch the bucket item to get the space_id (RLS ensures user is in space)
  const { data: item, error: itemError } = await supabase
    .from("bucket_items")
    .select("space_id")
    .eq("id", params.itemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Bucket item not found" }, { status: 404 });
  }

  const { data: todo, error: insertError } = await supabase
    .from("bucket_todos")
    .insert({
      bucket_item_id: params.itemId,
      space_id: item.space_id,
      creator_id: user.id,
      encrypted_text: body.encryptedText,
    })
    .select("*")
    .single();

  if (insertError || !todo) {
    return NextResponse.json({ error: "Failed to add todo" }, { status: 500 });
  }

  return NextResponse.json({ todo }, { status: 201 });
}
