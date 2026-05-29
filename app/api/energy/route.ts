import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { level, period } = await request.json();

    if (![1, 2, 3, 4, 5].includes(level) || !['morning', 'night'].includes(period)) {
      return NextResponse.json({ error: "Invalid level or period" }, { status: 400 });
    }

    const { data: spaceData, error: spaceError } = await supabase
      .from("spaces")
      .select("id")
      .contains("users", [user.id])
      .single();

    if (spaceError || !spaceData) {
      return NextResponse.json({ error: "No active space found" }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Find if already exists
    const { data: existing } = await supabase
      .from("energy_logs")
      .select("*")
      .eq("space_id", spaceData.id)
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (existing) {
      const updateData = period === 'morning' ? { morning_level: level } : { night_level: level };
      const { error: updateError } = await supabase
        .from("energy_logs")
        .update(updateData)
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      const insertData = {
        space_id: spaceData.id,
        user_id: user.id,
        date: today,
        morning_level: period === 'morning' ? level : null,
        night_level: period === 'night' ? level : null
      };
      const { error: insertError } = await supabase
        .from("energy_logs")
        .insert(insertData);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysStr = searchParams.get('days') || '7';
    let days = parseInt(daysStr, 10);
    if (isNaN(days) || days < 1) days = 7;
    if (days > 30) days = 30;

    const { data: spaceData, error: spaceError } = await supabase
      .from("spaces")
      .select("id")
      .contains("users", [user.id])
      .single();

    if (spaceError || !spaceData) {
      return NextResponse.json({ error: "No active space found" }, { status: 404 });
    }

    // Get logs for the last `days` days
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days + 1);
    const dateLimit = pastDate.toISOString().split('T')[0];

    const { data: logs, error: logsError } = await supabase
      .from("energy_logs")
      .select("*")
      .eq("space_id", spaceData.id)
      .gte("date", dateLimit)
      .order("date", { ascending: true });

    if (logsError) throw logsError;

    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
