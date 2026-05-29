import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionId, encryptedAnswer } = await request.json();

    if (!questionId || !encryptedAnswer) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: spaceData, error: spaceError } = await supabase
      .from("spaces")
      .select("id")
      .contains("users", [user.id])
      .single();

    if (spaceError || !spaceData) {
      return NextResponse.json(
        { error: "No active space found" },
        { status: 404 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    // Find if already exists
    const { data: existing } = await supabase
      .from("question_responses")
      .select("id")
      .eq("space_id", spaceData.id)
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (existing) {
      // Update
      const { error: updateError } = await supabase
        .from("question_responses")
        .update({
          question_id: questionId,
          encrypted_answer: encryptedAnswer,
        })
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      // Insert
      const { error: insertError } = await supabase
        .from("question_responses")
        .insert({
          space_id: spaceData.id,
          user_id: user.id,
          question_id: questionId,
          date: today,
          encrypted_answer: encryptedAnswer,
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
