import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, props: { params: Promise<{ entryId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { entryId } = params;

    const { error } = await supabase
      .from("ledger_entries")
      .update({
        forgiveness_requested: true,
        forgiveness_requested_at: new Date().toISOString(),
      })
      .eq("id", entryId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
