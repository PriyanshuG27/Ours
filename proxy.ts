import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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
            // Update request cookies for downstream routes
            request.cookies.set(name, value);
          });
          
          // Recreate the response once with all updated headers
          supabaseResponse = NextResponse.next({
            request: { headers: request.headers },
          });
          
          // Apply all cookies to the actual response
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  // Use getUser() — never getSession() — for server-side auth verification.
  // getUser() validates the JWT against the Supabase auth server, preventing
  // spoofed JWTs from bypassing middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Allow static assets, API routes, auth callback, and the login page through
  const isPublicPath =
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path === "/login" ||
    path.startsWith("/auth/callback");

  if (isPublicPath) {
    // If they go back to /login but are already logged in, redirect them forward
    if (path === "/login" && user) {
      url.pathname = "/home";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // No user → redirect to login
  if (!user) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Check for active space (RLS ensures we only see spaces this user belongs to)
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  const hasSpace = spaces && spaces.length > 0;

  // No space and not on /setup → redirect to /setup
  if (!hasSpace && path !== "/setup") {
    url.pathname = "/setup";
    return NextResponse.redirect(url);
  }

  // Has space and on /setup → redirect to /home
  if (hasSpace && path === "/setup") {
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
