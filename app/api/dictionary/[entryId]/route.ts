import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: { entryId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entryId } = params;

  // RLS ensures user is in the space — delete will fail silently if not authorized
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
