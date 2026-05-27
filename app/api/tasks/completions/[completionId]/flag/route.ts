import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: { completionId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { completionId } = params;

    // 1. Mark completion as flagged
    const { data: completion, error: updateError } = await supabase
      .from("task_completions")
      .update({ is_flagged: true })
      .eq("id", completionId)
      .select("*, tasks(*)")
      .single();

    if (updateError || !completion) {
      return NextResponse.json({ error: updateError?.message || "Not found" }, { status: 404 });
    }

    const taskId = completion.task_id;
    const task = completion.tasks;

    // 2. Penalties
    let newPhotoProofs = task.photo_proofs_count;
    if (newPhotoProofs > 0 && completion.photo_path) {
      newPhotoProofs -= 1;
    }

    // 3. Check for 3 flags within 15 days
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const { data: recentFlags, error: flagsError } = await supabase
      .from("task_completions")
      .select("id")
      .eq("task_id", taskId)
      .eq("is_flagged", true)
      .gte("completed_at", fifteenDaysAgo.toISOString());

    if (flagsError) throw flagsError;

    let newStreak = task.streak_count;
    let newPartnerStreak = task.partner_streak_count;
    let newSharedStreak = task.shared_streak_count;

    if (recentFlags && recentFlags.length >= 3) {
      // RESET streaks because of 3 cheating offenses
      newStreak = 0;
      newPartnerStreak = 0;
      newSharedStreak = 0;
    }

    // 4. Update task with penalties
    const { error: taskUpdateError } = await supabase
      .from("tasks")
      .update({
        photo_proofs_count: newPhotoProofs,
        streak_count: newStreak,
        partner_streak_count: newPartnerStreak,
        shared_streak_count: newSharedStreak,
      })
      .eq("id", taskId);

    if (taskUpdateError) throw taskUpdateError;

    // 5. Update the feed_event metadata so the feed visually updates
    // We have to find the feed_event for this completionId
    // Supabase JSON filtering on metadata->>completionId
    const { data: feedEvent } = await supabase
      .from("feed_events")
      .select("id, metadata")
      .eq("type", "task_done")
      .contains("metadata", { completionId: completionId })
      .single();

    if (feedEvent) {
      await supabase
        .from("feed_events")
        .update({
          metadata: {
            ...feedEvent.metadata,
            isFlagged: true
          }
        })
        .eq("id", feedEvent.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Flag error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
