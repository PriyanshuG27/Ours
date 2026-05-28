import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  const { itemId } = params;

  const body = (await request.json()) as { status?: string };

  if (!body.status) {
    return NextResponse.json(
      { error: "Missing status" },
      { status: 400 }
    );
  }

  // Validate status transition: only someday → planning is allowed via PATCH
  // (done is set automatically via the /complete endpoint)
  if (body.status !== "planning") {
    return NextResponse.json(
      { error: "Only 'planning' status is allowed via this endpoint" },
      { status: 400 }
    );
  }

  // Fetch current item (RLS ensures user is in the space)
  const { data: item, error: fetchError } = await supabase
    .from("bucket_items")
    .select("id, status")
    .eq("id", itemId)
    .single();

  if (fetchError || !item) {
    return NextResponse.json(
      { error: "Bucket item not found" },
      { status: 404 }
    );
  }

  if (item.status !== "someday") {
    return NextResponse.json(
      { error: "Can only transition from 'someday' to 'planning'" },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("bucket_items")
    .update({ status: "planning" })
    .eq("id", itemId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, status: "planning" });
}
