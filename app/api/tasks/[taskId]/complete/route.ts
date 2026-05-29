import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MoodTag } from "@/types/app.types";
import { randomUUID } from "crypto";

export async function POST(request: Request, props: { params: Promise<{ taskId: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = params;
    const formData = await request.formData();
    const moodTag = formData.get("moodTag") as string;
    const file = formData.get("file") as File | null;

    if (!moodTag || !["easy", "struggled", "forced", "proud"].includes(moodTag)) {
      return NextResponse.json({ error: "Invalid moodTag" }, { status: 400 });
    }

    // Verify task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Verify space membership
    const { data: space } = await supabase
      .from("spaces")
      .select("users")
      .eq("id", task.space_id)
      .single();

    if (!space || !space.users.includes(user.id)) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if THIS user already completed it today
    const oneDayAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    const { count: userCompletionsToday } = await supabase
      .from("task_completions")
      .select("*", { count: "exact", head: true })
      .eq("task_id", taskId)
      .eq("completed_by", user.id)
      .gte("completed_at", oneDayAgo);

    if (userCompletionsToday && userCompletionsToday > 0) {
      return NextResponse.json(
        { error: "Already completed today" },
        { status: 409 }
      );
    }

    let photoPath: string | null = null;
    if (file) {
      const fileName = `${task.space_id}/${Date.now()}-${randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(fileName, file, { contentType: "image/webp", upsert: false });
      
      if (!uploadError) {
        photoPath = fileName;
      }
    }

    let newStreakCount = task.streak_count || 0;
    let newPartnerStreak = task.partner_streak_count || 0;
    let newSharedStreak = task.shared_streak_count || 0;
    let newPhotoProofs = task.photo_proofs_count || 0;
    let newFreezes = task.streak_freezes || 0;

    if (photoPath) {
      newPhotoProofs++;
      if (newPhotoProofs >= 5) {
        newFreezes++;
        newPhotoProofs = 0;
      }
    }

    const isOwner = task.owner_id === user.id;

    if (task.is_coop) {
       // Co-op logic
       if (isOwner) {
         newStreakCount++;
       } else {
         newPartnerStreak++;
       }

       // Did the OTHER user complete it today?
       const { count: partnerCompletionsToday } = await supabase
         .from("task_completions")
         .select("*", { count: "exact", head: true })
         .eq("task_id", taskId)
         .neq("completed_by", user.id)
         .gte("completed_at", oneDayAgo);

       if (partnerCompletionsToday && partnerCompletionsToday > 0) {
         newSharedStreak++;
       }
    } else {
       // Personal logic
       newStreakCount++;
    }

    // 1. Update tasks
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        streak_count: newStreakCount,
        partner_streak_count: newPartnerStreak,
        shared_streak_count: newSharedStreak,
        photo_proofs_count: newPhotoProofs,
        streak_freezes: newFreezes,
        last_completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) throw updateError;

    // 2. Insert task_completion
    const { data: insertedCompletion, error: completionError } = await supabase
      .from("task_completions")
      .insert({
        task_id: taskId,
        completed_by: user.id,
        mood_tag: moodTag as MoodTag,
        streak_at_completion: task.is_coop ? newSharedStreak : newStreakCount,
        photo_path: photoPath,
      })
      .select("id")
      .single();

    if (completionError) throw completionError;

    // 3. Insert feed_event for all completions
    await supabase.from("feed_events").insert({
      space_id: task.space_id,
      author_id: user.id,
      type: "task_done",
      media_url: photoPath,
      metadata: {
        taskTitle: task.title,
        moodTag,
        streakCount: task.is_coop ? newSharedStreak : newStreakCount,
        completionId: insertedCompletion.id,
      },
    });

    return NextResponse.json(
      { 
        streakCount: newStreakCount, 
        partnerStreakCount: newPartnerStreak,
        sharedStreakCount: newSharedStreak,
        photoProofsCount: newPhotoProofs,
        streakFreezes: newFreezes,
        moodTag 
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
