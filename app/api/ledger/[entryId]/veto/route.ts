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

    // We do NOT check if they have a token here to keep server simple; 
    // the UI hides the button. If we wanted strict mode, we'd check previous vetoes this month.

    const { error } = await supabase
      .from("ledger_entries")
      .update({
        is_settled: true,
        is_vetoed: true,
        settled_at: new Date().toISOString(),
      })
      .eq("id", entryId)
      // Ensure only the charged person can veto
      .eq("charged_id", user.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
