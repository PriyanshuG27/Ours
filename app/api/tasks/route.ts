import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Task } from "@/types/app.types";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's space_id
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

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*, completions:task_completions(*)")
      .eq("space_id", spaceData.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .order("completed_at", { foreignTable: "task_completions", ascending: false })
      .limit(30, { foreignTable: "task_completions" });

    if (tasksError) {
      throw tasksError;
    }

    const { data: skipRequests, error: skipError } = await supabase
      .from("skip_requests")
      .select("*")
      .eq("status", "pending");

    if (skipError) {
      throw skipError;
    }

    return NextResponse.json(
      { tasks: tasks as Task[], skipRequests: skipRequests || [] },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, isCoop } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: "Title must be 100 characters or less" },
        { status: 400 }
      );
    }

    // Get user's space_id
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

    const { data: newTask, error: insertError } = await supabase
      .from("tasks")
      .insert({
        space_id: spaceData.id,
        owner_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        is_coop: isCoop === true,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ task: newTask as Task }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
