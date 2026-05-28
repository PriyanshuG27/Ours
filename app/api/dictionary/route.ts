import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();

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

  const { data: entries, error } = await supabase
    .from("dictionary_entries")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch dictionary entries" },
      { status: 500 }
    );
  }

  return NextResponse.json({ entries: entries ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();

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
    encryptedWord?: string;
    encryptedMeaning?: string;
    encryptedOrigin?: string;
  };

  if (!body.encryptedWord || !body.encryptedMeaning) {
    return NextResponse.json(
      { error: "Missing encryptedWord or encryptedMeaning" },
      { status: 400 }
    );
  }

  const { data: entry, error: insertError } = await supabase
    .from("dictionary_entries")
    .insert({
      space_id: spaceId,
      author_id: user.id,
      encrypted_word: body.encryptedWord,
      encrypted_meaning: body.encryptedMeaning,
      encrypted_origin: body.encryptedOrigin ?? null,
    })
    .select("*")
    .single();

  if (insertError || !entry) {
    return NextResponse.json(
      { error: "Failed to create dictionary entry" },
      { status: 500 }
    );
  }

  return NextResponse.json({ entry }, { status: 201 });
}
