import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/config/supabase";
import { createSupabaseServerClient } from "@/database/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/login", request.url);

  if (!isSupabaseConfigured()) {
    redirectUrl.searchParams.set("error", "Supabase is not configured yet.");
    return NextResponse.redirect(redirectUrl);
  }

  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    redirectUrl.searchParams.set("error", "Your confirmation link is incomplete.");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirectUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
