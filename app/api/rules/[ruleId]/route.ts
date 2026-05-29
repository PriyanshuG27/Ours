import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, props: { params: Promise<{ ruleId: string }> }) {
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
    const { status } = await request.json();
    const { ruleId } = params;

    if (!["active", "retired"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data: rule, error: fetchError } = await supabase
      .from("rules")
      .select("author_id, status")
      .eq("id", ruleId)
      .single();

    if (fetchError || !rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    if (status === "active" && rule.author_id === user.id) {
      return NextResponse.json(
        { error: "Cannot accept your own rule" },
        { status: 403 }
      );
    }

    const updates: any = { status };
    if (status === "active") {
      updates.accepted_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("rules")
      .update(updates)
      .eq("id", ruleId);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ ruleId: string }> }) {
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
    const { ruleId } = params;

    const { error } = await supabase
      .from("rules")
      .update({ status: "retired" })
      .eq("id", ruleId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
