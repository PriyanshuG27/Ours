import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, props: { params: Promise<{ cardId: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("board_card_messages")
      .select("*")
      .eq("card_id", params.cardId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ cardId: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { encrypted_payload, message_type } = await request.json();

    if (!encrypted_payload || !message_type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("board_card_messages")
      .insert({
        card_id: params.cardId,
        sender_id: user.id,
        encrypted_payload,
        message_type,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
