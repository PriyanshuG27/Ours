import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "20", 10),
    50
  );

  // Fetch one extra row to determine if there's a next page
  let query = supabase
    .from("feed_events")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  // Memory Wall: filter to pinned items only
  const pinned = searchParams.get("pinned");
  if (pinned === "true") {
    query = query.eq("is_pinned", true);
  } else {
    // Exclude captures from the main feed
    query = query.neq("type", "capture");
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }

  const rows = events ?? [];
  const hasMore = rows.length > limit;
  const trimmedEvents = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? trimmedEvents[trimmedEvents.length - 1]?.created_at ?? null
    : null;

  // Generate signed URLs for events with media (private bucket)
  const eventsWithUrls = await Promise.all(
    trimmedEvents.map(async (event) => {
      if (!event.media_url) return event;

      const { data } = await supabase.storage
        .from("media")
        .createSignedUrl(event.media_url as string, 3600); // 1 hour expiry

      const eventData = {
        ...event,
        media_url: data?.signedUrl ?? null,
      };

      // Also sign photo_b_url if it's a paired capture
      if ((event.metadata as any)?.photo_b_url) {
        const { data: bData } = await supabase.storage
          .from("media")
          .createSignedUrl((event.metadata as any).photo_b_url, 3600);
          
        eventData.metadata = {
          ...(eventData.metadata as any),
          photo_b_url: bData?.signedUrl ?? null,
        };
      }

      return eventData;
    })
  );

  return NextResponse.json({
    events: eventsWithUrls,
    nextCursor,
  });
}
