import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const settledParam = searchParams.get("settled");

  const { data: space } = await supabase
    .from("spaces")
    .select("id")

    .eq("is_active", true)
    .single();

  if (!space) {
    return NextResponse.json(
      { error: "No active space found" },
      { status: 404 }
    );
  }

  let query = supabase
    .from("ledger_entries")
    .select("*, rules(encrypted_text, encrypted_penalty, category)", { count: "exact" })
    .eq("space_id", space.id)
    .order("created_at", { ascending: false });

  if (settledParam === "true") {
    query = query.eq("is_settled", true);
  } else if (settledParam === "false") {
    query = query.eq("is_settled", false);
  }

  const { data: entries, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries, count });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: space } = await supabase
    .from("spaces")
    .select("id")

    .eq("is_active", true)
    .single();

  if (!space) {
    return NextResponse.json(
      { error: "No active space found" },
      { status: 404 }
    );
  }

  try {
    const { ruleId, chargedId, encryptedNote } = await request.json();

    if (!ruleId || !chargedId) {
      return NextResponse.json(
        { error: "ruleId and chargedId are required" },
        { status: 400 }
      );
    }

    const { data: rule, error: fetchError } = await supabase
      .from("rules")
      .select("status, space_id")
      .eq("id", ruleId)
      .single();

    if (fetchError || !rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    if (rule.space_id !== space.id) {
      return NextResponse.json(
        { error: "Rule does not belong to your space" },
        { status: 403 }
      );
    }

    if (rule.status !== "active") {
      return NextResponse.json(
        { error: "Charges can only be made against active rules" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase
      .from("ledger_entries")
      .insert({
        rule_id: ruleId,
        space_id: space.id,
        charger_id: user.id,
        charged_id: chargedId,
        encrypted_note: encryptedNote || null,
        is_settled: false,
      });

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
