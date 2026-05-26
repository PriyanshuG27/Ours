import { Liveblocks } from "@liveblocks/node";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST() {
  const supabase = createClient();

  // getUser() validates the JWT server-side — getSession() does not
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

  session.allow(spaceId, session.FULL_ACCESS);

  const { status, body } = await session.authorize();

  return new NextResponse(body, { status });
}
