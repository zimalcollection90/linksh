import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  try {
    // Create an unmodified response
    let response = NextResponse.next({
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
            return request.cookies.getAll().map(({ name, value }) => ({
              name,
              value,
            }));
          },
          setAll(cookiesToSet) {
            // First update cookies on the request
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
            // Re-create the next response once with updated request headers
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            // Apply all cookies to the response object
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Refresh session if expired - required for Server Components
    const { data: { user }, error } = await supabase.auth.getUser();

    // protected routes redirect
    if (request.nextUrl.pathname.startsWith("/dashboard") && error) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    if (user) {
      // 1. Redirection policy: if already logged in, redirect away from landing/auth pages to /dashboard
      const authRoutes = ["/sign-in", "/sign-up"];
      const isLandingPage = request.nextUrl.pathname === "/";
      if (isLandingPage || authRoutes.includes(request.nextUrl.pathname)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      // 2. Fetch the user's role from the database
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      
      const role = profile?.role;
      
      // Determine session duration (maxAge) based on user's role:
      // - Admin/Super Admin: 2 days (172800 seconds)
      // - Member: 1 week (604800 seconds)
      // - Others: 30 days (2592000 seconds)
      let maxAge = 30 * 24 * 60 * 60; // Default: 30 days
      if (role === "admin" || role === "super_admin") {
        maxAge = 2 * 24 * 60 * 60; // 2 days
      } else if (role === "member") {
        maxAge = 7 * 24 * 60 * 60; // 1 week
      }

      // 3. Enforce the calculated maxAge on all Supabase auth cookies on the response
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.startsWith("sb-")) {
          response.cookies.set(cookie.name, cookie.value, {
            path: "/",
            sameSite: "lax",
            secure: true,
            maxAge,
          });
        }
      });
    }

    return response;
  } catch (e) {
    // If you are here, a Supabase client could not be created!
    // This is likely because you have not set up environment variables.
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};

