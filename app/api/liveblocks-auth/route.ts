import { Liveblocks } from "@liveblocks/node";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(request: Request) {
  // CRITICAL: Consume the request body to prevent Next.js from hanging the stream!
  // Liveblocks client sends a POST request with a body. If unconsumed, the route times out.
  try {
    await request.json();
  } catch (e) {
    // Ignore if no body is present
  }

  try {
    const supabase = await createClient();

    // getUser() validates the JWT server-side
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { data: spaces } = await supabase
      .from("spaces")
      .select("id")
      .eq("is_active", true)
      .limit(1);

    const spaceId = spaces?.[0]?.id;

    if (!spaceId) {
      return new NextResponse("Forbidden: No active space", { status: 403 });
    }

    const session = liveblocks.prepareSession(user.id, {
      userInfo: {
        id: user.id,
        name: user.user_metadata?.name ?? "User",
      },
    });

    // Wildcard: authorize base room (presence) and all feature-suffixed rooms
    session.allow(`${spaceId}*`, session.FULL_ACCESS);

    const { status, body } = await session.authorize();

    return new NextResponse(body, { status });
  } catch (err: any) {
    console.error("Liveblocks Auth Error:", err);
    return new NextResponse(err.message || "Internal Server Error", { status: 500 });
  }
}
