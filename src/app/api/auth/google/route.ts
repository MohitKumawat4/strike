import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/database/supabase/server";
import { getGoogleAuthUrl } from "@/modules/email/providers/gmail/gmail.client";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Ensure user is signed into Strike before connecting an account
  if (authError || !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Please sign in to Strike before connecting a Gmail account.");
    return NextResponse.redirect(loginUrl);
  }

  // Generate a cryptographically secure random state to protect against CSRF
  const state = crypto.randomBytes(32).toString("hex");

  // Store state in a secure, HTTP-only cookie with short expiration (10 minutes)
  const cookieStore = await cookies();
  cookieStore.set("oauth_google_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  const authUrl = getGoogleAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
