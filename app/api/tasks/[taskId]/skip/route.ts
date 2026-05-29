import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const body = await request.json();
    const { reason, useFreeze } = body;

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

    if (!task.is_coop && task.owner_id !== user.id) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check no existing pending skip for this task
    const { data: existingPending, error: pendingError } = await supabase
      .from("skip_requests")
      .select("id")
      .eq("task_id", taskId)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingError) throw pendingError;
    if (existingPending && !useFreeze) {
      return NextResponse.json(
        { error: "A pending skip request already exists for this task" },
        { status: 409 }
      );
    }

    // Check monthly skip count
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlySkipCount, error: countError } = await supabase
      .from("skip_requests")
      .select("*", { count: "exact", head: true })
      .eq("task_id", taskId)
      .eq("requester_id", user.id)
      .gte("created_at", startOfMonth.toISOString());

    if (countError) throw countError;
    if (monthlySkipCount !== null && monthlySkipCount >= 3) {
      return NextResponse.json(
        { error: "Monthly skip limit (3) reached for this task" },
        { status: 429 }
      );
    }

    let status: "pending" | "approved" | "denied" = "pending";
    let resolved_at = null;
    let resolved_by = null;

    if (useFreeze) {
      if ((task.streak_freezes || 0) <= 0) {
        return NextResponse.json({ error: "No Streak Freezes available" }, { status: 400 });
      }

      // Deduct freeze
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ streak_freezes: (task.streak_freezes || 0) - 1 })
        .eq("id", taskId);

      if (updateError) throw updateError;

      status = "approved";
      resolved_at = new Date().toISOString();
      resolved_by = user.id;
    }

    // Insert skip_request
    const { data: skipRequest, error: insertError } = await supabase
      .from("skip_requests")
      .insert({
        task_id: taskId,
        requester_id: user.id,
        reason: reason?.trim() || null,
        status,
        resolved_at,
        resolved_by,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log to feed if freeze used
    if (useFreeze) {
      await supabase.from("feed_events").insert({
        space_id: task.space_id,
        author_id: user.id,
        type: "note",
        metadata: {
          isFreeze: true,
          taskTitle: task.title,
        },
      });
    } else {
      // Notify partner of the skip request
      const partnerId = space.users.find((id: string) => id !== user.id);
      if (partnerId) {
        supabase.functions.invoke('event-notifications', {
          body: {
            userId: partnerId,
            type: 'streak_skip_request',
            data: {}
          }
        }).catch(() => {});
      }
    }

    return NextResponse.json({ skipRequestId: skipRequest.id, status }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
