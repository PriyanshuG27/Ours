import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user already has an active space
  const { data: existingSpaces } = await supabase
    .from("spaces")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  if (existingSpaces && existingSpaces.length > 0) {
    return NextResponse.json(
      { error: "User already has an active space" },
      { status: 409 },
    );
  }

  const body = (await request.json()) as { spaceName: string | null };
  const inviteCode = generateInviteCode();
  const displayName = user.user_metadata?.name ?? user.email ?? "User";

  const { data: space, error: insertError } = await supabase
    .from("spaces")
    .insert({
      invite_code: inviteCode,
      users: [user.id],
      user_names: [displayName],
      space_name: body.spaceName ?? null,
      is_active: true,
    })
    .select("id, invite_code")
    .single();

  if (insertError) {
    // invite_code collision — extremely rare but handle gracefully
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Please try again" }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to create space" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    spaceId: space.id,
    inviteCode: space.invite_code,
  });
}
