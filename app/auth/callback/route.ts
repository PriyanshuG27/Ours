import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = new URL("/login", request.url);

  if (!code) {
    next.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(next);
  }

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    next.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(next);
  }

  // Check if user already has a space
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    next.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(next);
  }

  const { data: spaces } = await supabase
    .from("spaces")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  const hasSpace = spaces && spaces.length > 0;
  const destination = new URL(hasSpace ? "/home" : "/setup", request.url);

  // We need to forward the cookies set during exchangeCodeForSession
  const redirectResponse = NextResponse.redirect(destination);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return redirectResponse;
}
