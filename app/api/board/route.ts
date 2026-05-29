import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BoardColumn } from "@/types/app.types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // First check if user is in a space
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id")

    .eq("is_active", true)
    .limit(1);

  const spaceId = spaces?.[0]?.id;
  if (!spaceId) {
    return NextResponse.json({ error: "No active space found" }, { status: 403 });
  }

  // Get cards for the space, sorted by column and then position
  const { data: cards, error } = await supabase
    .from("board_cards")
    .select("*")
    .eq("space_id", spaceId)
    .order("column", { ascending: true })
    .order("position", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cards });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { encryptedText, column, moodTag } = await req.json();

  if (!encryptedText) {
    return NextResponse.json({ error: "Missing encrypted text" }, { status: 400 });
  }

  const boardColumn = column || BoardColumn.ON_MY_MIND;

  // First check space
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id")

    .eq("is_active", true)
    .limit(1);

  const spaceId = spaces?.[0]?.id;
  if (!spaceId) {
    return NextResponse.json({ error: "No active space found" }, { status: 403 });
  }

  // Check how many active cards the user has (not resolved)
  const { count, error: countError } = await supabase
    .from("board_cards")
    .select("*", { count: "exact", head: true })
    .eq("space_id", spaceId)
    .eq("author_id", user.id)
    .neq("column", BoardColumn.RESOLVED);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (count !== null && count >= 20) {
    return NextResponse.json({ error: "You cannot have more than 20 active cards." }, { status: 400 });
  }

  // Find max position in the destination column
  const { data: maxPosCard } = await supabase
    .from("board_cards")
    .select("position")
    .eq("space_id", spaceId)
    .eq("column", boardColumn)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = maxPosCard?.[0] ? maxPosCard[0].position + 1000 : 1000;

  // Insert new card
  const { data: newCard, error: insertError } = await supabase
    .from("board_cards")
    .insert({
      space_id: spaceId,
      author_id: user.id,
      encrypted_text: encryptedText,
      column: boardColumn,
      position: nextPosition,
      mood_tag: moodTag || null,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ card: newCard });
}
