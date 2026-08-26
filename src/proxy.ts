import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/config/supabase";
import { refreshSupabaseSession } from "@/database/supabase/proxy";

const authRoutes = new Set(["/login", "/signup"]);

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const { response, isAuthenticated } = await refreshSupabaseSession(request);
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && authRoutes.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/login", "/signup", "/dashboard/:path*"],
};
