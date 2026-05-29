import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, users")
    .eq("is_active", true)
    .limit(1);

  const space = spaces?.[0];

  if (!space) {
    return NextResponse.json({ hasPartner: false, spaceId: null });
  }

  const users = space.users as string[];
  const hasPartner = users.length === 2;

  return NextResponse.json({ hasPartner, spaceId: space.id });
}
