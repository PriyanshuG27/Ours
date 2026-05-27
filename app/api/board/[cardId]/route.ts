import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BoardColumn } from "@/types/app.types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cardId } = await params;
  if (!cardId) {
    return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  }

  const body = await req.json();
  const { column, position, resolvedAt } = body;

  const updates: any = {};
  if (column !== undefined) updates.column = column;
  if (position !== undefined) updates.position = position;
  if (resolvedAt !== undefined) updates.resolved_at = resolvedAt;
  else if (column === BoardColumn.RESOLVED) updates.resolved_at = new Date().toISOString();

  // The RLS policy ensures users can only update cards in their space
  const { data: updatedCard, error } = await supabase
    .from("board_cards")
    .update(updates)
    .eq("id", cardId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ card: updatedCard });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cardId } = await params;
  if (!cardId) {
    return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  }

  // Delete card. RLS ensures only the author can delete it.
  const { error } = await supabase
    .from("board_cards")
    .delete()
    .eq("id", cardId)
    .eq("author_id", user.id); // Double check for safety, though RLS does this

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
