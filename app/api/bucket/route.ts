import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

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
    .select("id")
    .eq("is_active", true)
    .limit(1);

  const spaceId = spaces?.[0]?.id as string | undefined;

  if (!spaceId) {
    return NextResponse.json({ error: "No active space" }, { status: 403 });
  }

  const { data: items, error } = await supabase
    .from("bucket_items")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch bucket items" },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: items ?? [] });
}

export async function POST(request: Request) {
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
    .select("id")
    .eq("is_active", true)
    .limit(1);

  const spaceId = spaces?.[0]?.id as string | undefined;

  if (!spaceId) {
    return NextResponse.json({ error: "No active space" }, { status: 403 });
  }

  const body = (await request.json()) as {
    encryptedTitle?: string;
    encryptedWhy?: string;
    category?: string | null;
  };

  if (!body.encryptedTitle || !body.encryptedWhy) {
    return NextResponse.json(
      { error: "Missing title or encryptedWhy" },
      { status: 400 }
    );
  }

  const { data: item, error: insertError } = await supabase
    .from("bucket_items")
    .insert({
      space_id: spaceId,
      creator_id: user.id,
      title: body.encryptedTitle,
      encrypted_why: body.encryptedWhy,
      category: body.category || null,
      status: "someday" as const,
    })
    .select("*")
    .single();

  if (insertError || !item) {
    return NextResponse.json(
      { error: "Failed to create bucket item" },
      { status: 500 }
    );
  }

  return NextResponse.json({ item }, { status: 201 });
}
