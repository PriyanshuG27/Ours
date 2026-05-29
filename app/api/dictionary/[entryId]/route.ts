import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, props: { params: Promise<{ entryId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entryId } = params;
  let action: string;
  try {
    const body = await request.json();
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (action === "request") {
    // 3. Race Condition Fix: Check if partner already requested delete
    const { data: currentEntry } = await supabase
      .from("dictionary_entries")
      .select("delete_requested_by")
      .eq("id", entryId)
      .single();

    if (currentEntry && currentEntry.delete_requested_by && currentEntry.delete_requested_by !== user.id) {
      // Mutual consent achieved via simultaneous clicking
      const { error: deleteError } = await supabase.from("dictionary_entries").delete().eq("id", entryId);
      if (deleteError) return NextResponse.json({ error: "Failed to mutually delete entry" }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const { error: updateError } = await supabase
      .from("dictionary_entries")
      .update({ delete_requested_by: user.id })
      .eq("id", entryId);
    if (updateError) return NextResponse.json({ error: "Failed to request delete" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } else if (action === "reject") {
    const { error: updateError } = await supabase
      .from("dictionary_entries")
      .update({ delete_requested_by: null })
      .eq("id", entryId);
    if (updateError) return NextResponse.json({ error: "Failed to reject delete" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(_request: Request, props: { params: Promise<{ entryId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entryId } = params;

  // 1. Security Flaw Fix: Prevent API-level self-approval
  const { data: entry } = await supabase
    .from("dictionary_entries")
    .select("delete_requested_by")
    .eq("id", entryId)
    .single();

  if (entry && entry.delete_requested_by === user.id) {
    return NextResponse.json({ error: "Cannot self-approve a delete request." }, { status: 403 });
  }

  // We delete it if approved. RLS protects deletion across spaces.
  const { error: deleteError } = await supabase
    .from("dictionary_entries")
    .delete()
    .eq("id", entryId);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete entry" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
