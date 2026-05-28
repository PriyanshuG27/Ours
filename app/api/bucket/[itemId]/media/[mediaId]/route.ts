import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: { itemId: string; mediaId: string } }
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // If it's a voice note, we might want to delete it from storage, but for now we just delete the row
  const { error: deleteError } = await supabase
    .from("bucket_media")
    .delete()
    .eq("id", params.mediaId)
    .eq("bucket_item_id", params.itemId);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete media" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
