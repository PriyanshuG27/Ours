import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Database } from "@/types/database.types";

export async function DELETE(
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

  const { error: deleteError } = await supabase
    .from("bucket_items")
    .delete()
    .eq("id", params.itemId);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete bucket item" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
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

  const body = (await request.json()) as {
    status?: "someday" | "planning" | "done";
    target_date?: string | null;
    budget_cents?: number | null;
    saved_cents?: number;
    category?: string | null;
    hype_votes?: string[];
  };

  const updatePayload: Record<string, any> = {};
  if (body.status !== undefined) updatePayload.status = body.status;
  if (body.target_date !== undefined) updatePayload.target_date = body.target_date;
  if (body.budget_cents !== undefined) updatePayload.budget_cents = body.budget_cents;
  if (body.saved_cents !== undefined) updatePayload.saved_cents = body.saved_cents;
  if (body.category !== undefined) updatePayload.category = body.category;
  if (body.hype_votes !== undefined) updatePayload.hype_votes = body.hype_votes;

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("bucket_items")
    .update(updatePayload as Database["public"]["Tables"]["bucket_items"]["Update"])
    .eq("id", params.itemId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
