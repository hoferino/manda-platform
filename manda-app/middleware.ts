/**
 * Next.js Root Middleware
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #6)
 *
 * Handles:
 * - Session refresh via Supabase
 * - Organization context validation for API routes
 * - Redirect unauthenticated users to login
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/auth", "/api/auth", "/login", "/signup"];

// Routes that require auth but don't need organization context
const ORG_EXEMPT_ROUTES = ["/api/organizations", "/api/user/organizations"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Skip auth check for public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return supabaseResponse;
  }

  // Handle unauthenticated users
  if (!user && pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Skip org check for org management routes
  if (ORG_EXEMPT_ROUTES.some((route) => pathname.startsWith(route))) {
    return supabaseResponse;
  }

  // Require org header for API routes
  if (pathname.startsWith("/api")) {
    const orgId = request.headers.get("x-organization-id");

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing x-organization-id header" },
        { status: 400 }
      );
    }

    // Verify membership (RLS handles actual data filtering)
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static file extensions (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
