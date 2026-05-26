import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { inviteCode: string };
  const code = body.inviteCode?.trim().toUpperCase();

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
  }

  // Find the space by invite code
  // Note: RLS won't restrict SELECT here because the joining user isn't in `users` yet.
  // We use .maybeSingle() so it returns null instead of erroring on no match.
  // The RLS policy for SELECT requires auth.uid() = ANY(users), so we need to bypass
  // RLS for this lookup. Since we can't use the admin client here (it would skip all
  // security), we query with a filter that returns the space only if it's joinable.
  //
  // IMPORTANT: The RLS SELECT policy will block this query because the joining user
  // is not yet in the users array. We need to use an RPC call or restructure.
  // For now, we'll attempt the update directly — the UPDATE RLS policy allows it
  // when array_length(users, 1) = 1 AND auth.uid() != users[1].

  // First, try to find and update in one step via the UPDATE policy
  const displayName = user.user_metadata?.name ?? user.email ?? "User";

  // We use the Supabase RPC or a direct update filtered by invite_code.
  // The UPDATE policy allows: array_length(users, 1) = 1 AND auth.uid() != users[1]
  const { data: space, error: updateError } = await supabase.rpc("join_space", {
    p_invite_code: code,
    p_user_id: user.id,
    p_user_name: displayName,
  });

  if (updateError) {
    // Parse known error messages from the RPC function
    const msg = updateError.message;

    if (msg.includes("not found")) {
      return NextResponse.json(
        { error: "Invite code not found" },
        { status: 404 },
      );
    }
    if (msg.includes("already full")) {
      return NextResponse.json(
        { error: "Space is already full" },
        { status: 409 },
      );
    }
    if (msg.includes("already a member")) {
      return NextResponse.json(
        { error: "Already a member of this space" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to join space" },
      { status: 500 },
    );
  }

  return NextResponse.json({ spaceId: space });
}
