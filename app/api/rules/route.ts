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
  const status = searchParams.get("status");

  // RLS ensures they can only read their space's rules, but we explicitly filter
  // We can fetch the space_id first to be explicit, but RLS handles it.
  const { data: space } = await supabase
    .from("spaces")
    .select("id")

    .eq("is_active", true)
    .single();

  if (!space) {
    return NextResponse.json({ error: "No active space found" }, { status: 404 });
  }

  let query = supabase
    .from("rules")
    .select("*")
    .eq("space_id", space.id)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status as "proposed" | "active" | "retired");
  }

  const { data: rules, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rules });
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
    return NextResponse.json({ error: "No active space found" }, { status: 404 });
  }

  try {
    const { encryptedText, encryptedPenalty, category } = await request.json();

    if (!encryptedText) {
      return NextResponse.json({ error: "encryptedText is required" }, { status: 400 });
    }

    const { data: rule, error } = await supabase
      .from("rules")
      .insert({
        space_id: space.id,
        author_id: user.id,
        encrypted_text: encryptedText,
        encrypted_penalty: encryptedPenalty || null,
        category: category || "Household",
        status: "proposed",
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ ruleId: rule.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
