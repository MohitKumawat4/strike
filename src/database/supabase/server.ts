import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/config/supabase";
import { getServerEnv } from "@/config/server-env";

/** Creates a cookie-backed client for Server Components and Route Handlers. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The Proxy refreshes sessions.
        }
      },
    },
  });
}

/**
 * Server-only client for trusted background work and webhook processing.
 * Never import this module into a Client Component.
 */
export function createSupabaseAdminClient() {
  const env = getServerEnv();
  const adminKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    adminKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
