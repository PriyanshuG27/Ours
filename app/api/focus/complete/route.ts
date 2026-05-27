import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { taskLabel, durationSeconds, sessionId } = body as {
      taskLabel: unknown;
      durationSeconds: unknown;
      sessionId: unknown;
    };

    if (
      typeof taskLabel !== "string" ||
      !taskLabel ||
      typeof durationSeconds !== "number" ||
      typeof sessionId !== "string" ||
      !sessionId
    ) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { data: spaceData, error: spaceError } = await supabase
      .from("spaces")
      .select("id")
      .contains("users", [user.id])
      .single();

    if (spaceError || !spaceData) {
      return NextResponse.json(
        { error: "No active space found" },
        { status: 404 },
      );
    }

    // Idempotency: check if this sessionId was already logged.
    // Prevents duplicate feed_events when both users tap "Done" simultaneously.
    const { data: existing } = await supabase
      .from("feed_events")
      .select("id")
      .eq("space_id", spaceData.id)
      .eq("type", "focus_session")
      .contains("metadata", { sessionId })
      .limit(1);

    if (existing && existing.length > 0) {
      // Already logged — return success without inserting again
      return NextResponse.json({ ok: true, deduplicated: true });
    }

    const { error: insertError } = await supabase.from("feed_events").insert({
      space_id: spaceData.id,
      author_id: user.id,
      type: "focus_session",
      metadata: { taskLabel, durationSeconds, sessionId },
    });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/focus/complete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
