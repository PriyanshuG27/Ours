import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getDayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff =
    date.getTime() -
    start.getTime() +
    (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: spaceData, error: spaceError } = await supabase
      .from("spaces")
      .select("id, users")
      .contains("users", [user.id])
      .single();

    if (spaceError || !spaceData) {
      return NextResponse.json(
        { error: "No active space found" },
        { status: 404 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    // 1. Try to get dynamic question
    let question = null;
    const { data: dynamicQuestion } = await supabase
      .from("dynamic_questions")
      .select("id, question_text")
      .eq("space_id", spaceData.id)
      .eq("date", today)
      .single();

    if (dynamicQuestion) {
      question = dynamicQuestion;
    } else {
      // 2. Fallback to static question
      const { count } = await supabase
        .from("questions")
        .select("*", { count: "exact", head: true });

      if (count && count > 0) {
        const dayOfYear = getDayOfYear();
        const displayOrder = (dayOfYear % count) + 1;

        const { data: fallbackQuestion } = await supabase
          .from("questions")
          .select("id, question_text")
          .eq("display_order", displayOrder)
          .single();

        question = fallbackQuestion;
      }
    }

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // 3. Get responses for today
    const { data: responses, error: rError } = await supabase
      .from("question_responses")
      .select("*")
      .eq("space_id", spaceData.id)
      .eq("date", today);

    if (rError) {
      return NextResponse.json(
        { error: "Failed to load responses" },
        { status: 500 }
      );
    }

    const hasUserAnswered = responses.some((r) => r.user_id === user.id);
    const hasPartnerAnswered = responses.some((r) => r.user_id !== user.id);
    const expectedResponsesCount = spaceData.users.length;
    const bothAnswered = responses.length === expectedResponsesCount;

    let answers = null;
    if (bothAnswered) {
      answers = {
        mine: responses.find((r) => r.user_id === user.id)?.encrypted_answer || null,
        theirs: responses.find((r) => r.user_id !== user.id)?.encrypted_answer || null,
      };
    }

    return NextResponse.json({
      question,
      hasUserAnswered,
      hasPartnerAnswered,
      answers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
