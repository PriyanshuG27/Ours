import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

import { Database } from "@/types/database.types";

export async function PATCH(
  request: Request,
  { params }: { params: { itemId: string; todoId: string } }
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { is_completed?: boolean; assigned_to?: string | null };
  if (body.is_completed === undefined && body.assigned_to === undefined) {
    return NextResponse.json({ error: "Missing update fields" }, { status: 400 });
  }

  const payload: Record<string, any> = {};
  if (body.is_completed !== undefined) payload.is_completed = body.is_completed;
  if (body.assigned_to !== undefined) payload.assigned_to = body.assigned_to;

  const { error: updateError } = await supabase
    .from("bucket_todos")
    .update(payload as Database["public"]["Tables"]["bucket_todos"]["Update"])
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
