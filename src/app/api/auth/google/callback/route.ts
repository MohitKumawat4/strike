import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/database/supabase/server";
import { exchangeCodeAndFetchProfile } from "@/modules/email/providers/gmail/gmail.client";
import { encryptToken } from "@/common/crypto/encryption";
import { GMAIL_READONLY_SCOPE } from "@/modules/email/providers/gmail/gmail.constants";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const googleError = searchParams.get("error");

  const storedState = cookieStore.get("oauth_google_state")?.value;
  // Clean up state cookie
  cookieStore.delete("oauth_google_state");

  const dashboardUrl = new URL("/dashboard", request.url);

  // Handle Google rejection/error
  if (googleError) {
    dashboardUrl.searchParams.set("error", `Google connection was cancelled: ${googleError}`);
    return NextResponse.redirect(dashboardUrl);
  }

  // Verify CSRF state token
  if (!state || !storedState || state !== storedState) {
    dashboardUrl.searchParams.set("error", "OAuth security verification failed. Please try connecting again.");
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code) {
    dashboardUrl.searchParams.set("error", "Authorization code missing from Google response.");
    return NextResponse.redirect(dashboardUrl);
  }

  // Verify authenticated Strike user session
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Session expired. Please sign in again.");
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Exchange authorization code for tokens and mailbox details
    const { tokens, emailAddress, historyId } = await exchangeCodeAndFetchProfile(code);

    if (!tokens.refresh_token) {
      dashboardUrl.searchParams.set("error", "Google did not provide a refresh token. Try disconnecting and reconnecting.");
      return NextResponse.redirect(dashboardUrl);
    }

    // Encrypt the refresh token with AES-256-GCM before database persistence
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);

    const grantedScopes = tokens.scope ? tokens.scope.split(" ") : [GMAIL_READONLY_SCOPE];

    // Save connected account to PostgreSQL email_accounts table
    const { data: savedAccount, error: dbError } = await supabase
      .from("email_accounts")
      .upsert(
        {
          user_id: user.id,
          provider: "gmail",
          email_address: emailAddress,
          encrypted_refresh_token: encryptedRefreshToken,
          granted_scopes: grantedScopes,
          history_id: historyId,
          connection_status: "connected",
          last_successful_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider,email_address",
        }
      )
      .select("id")
      .single();

    if (dbError || !savedAccount) {
      console.error("Database error saving email_account:", dbError);
      dashboardUrl.searchParams.set("error", "Failed to save connected email account to database.");
      return NextResponse.redirect(dashboardUrl);
    }

    // Trigger initial mailbox sync to ingest recent emails
    try {
      const { performInitialSync } = await import("@/modules/email/ingestion/initial-sync");
      await performInitialSync(supabase, {
        accountId: savedAccount.id,
        userId: user.id,
        encryptedRefreshToken,
        maxMessages: 20,
      });
    } catch (syncErr) {
      console.error("Initial sync non-fatal error:", syncErr);
    }

    // Automatically set up Gmail Push Watch if Google Pub/Sub topic is configured
    const pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC;
    if (pubsubTopic) {
      try {
        const { setupGmailWatch } = await import("@/modules/email/providers/gmail/gmail.watch");
        const { getGoogleOAuthClient } = await import("@/modules/email/providers/gmail/gmail.client");
        const oauth2Client = getGoogleOAuthClient();
        oauth2Client.setCredentials(tokens);

        const { historyId: watchHistoryId, expiration } = await setupGmailWatch(oauth2Client, pubsubTopic);
        const expirationDate = new Date(parseInt(expiration, 10)).toISOString();

        await supabase
          .from("email_accounts")
          .update({
            history_id: watchHistoryId,
            watch_expiration: expirationDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", savedAccount.id);

        console.log(`Registered Gmail push watch for ${emailAddress} expiring at ${expirationDate}`);
      } catch (watchErr) {
        console.warn("Gmail watch subscription warning (non-fatal, manual sync remains available):", watchErr);
      }
    }

    // Successfully connected!
    dashboardUrl.searchParams.set("connected", "true");
    dashboardUrl.searchParams.set("account", emailAddress);
    return NextResponse.redirect(dashboardUrl);
  } catch (err: unknown) {
    console.error("Google OAuth callback error:", err);
    const message = err instanceof Error ? err.message : "Failed to exchange Google OAuth tokens.";
    dashboardUrl.searchParams.set("error", message);
    return NextResponse.redirect(dashboardUrl);
  }
}
