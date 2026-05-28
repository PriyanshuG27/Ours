import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { itemId: string; todoId: string } }
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { is_completed?: boolean };
  if (body.is_completed === undefined) {
    return NextResponse.json({ error: "Missing is_completed" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("bucket_todos")
    .update({ is_completed: body.is_completed })
    .eq("id", params.todoId)
    .eq("bucket_item_id", params.itemId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update todo" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: { itemId: string; todoId: string } }
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: deleteError } = await supabase
    .from("bucket_todos")
    .delete()
    .eq("id", params.todoId)
    .eq("bucket_item_id", params.itemId);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete todo" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
