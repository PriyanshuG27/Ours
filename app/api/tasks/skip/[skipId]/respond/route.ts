import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: { skipId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { skipId } = params;
    const body = await request.json();
    const { decision } = body;

    if (decision !== "approved" && decision !== "denied") {
      return NextResponse.json(
        { error: "Decision must be 'approved' or 'denied'" },
        { status: 400 }
      );
    }

    // Verify skip exists, is pending, and get task info
    const { data: skipRequest, error: skipError } = await supabase
      .from("skip_requests")
      .select("*, tasks(*)")
      .eq("id", skipId)
      .single();

    if (skipError || !skipRequest) {
      return NextResponse.json(
        { error: "Skip request not found" },
        { status: 404 }
      );
    }

    if (skipRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Skip request is no longer pending" },
        { status: 400 }
      );
    }

    // Verify current user is NOT the requester (partner only)
    if (skipRequest.requester_id === user.id) {
      return NextResponse.json(
        { error: "You cannot respond to your own skip request" },
        { status: 403 }
      );
    }

    // Since RLS checks space membership on update, we don't strictly need to fetch space manually,
    // but the policy for update is just EXISTS(spaces where id = task.space_id AND user in users)
    
    // Update skip_request
    const { error: updateError } = await supabase
      .from("skip_requests")
      .update({
        status: decision,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", skipId);

    if (updateError) throw updateError;

    // If denied: streak breaks — update task streak_count = 0
    if (decision === "denied") {
      const { error: taskUpdateError } = await supabase
        .from("tasks")
        .update({ streak_count: 0 })
        .eq("id", skipRequest.task_id);

      if (taskUpdateError) throw taskUpdateError;
    }

    return NextResponse.json({ decision }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/tasks/skip/[skipId]/respond error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
