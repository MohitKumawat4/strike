import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/common/crypto/encryption";
import { getGoogleOAuthClient } from "./gmail.client";

/**
 * Registers a Gmail inbox for push notifications via Google Cloud Pub/Sub.
 *
 * Calls gmail.users.watch() specifying the Pub/Sub topic name.
 * Returns the initial historyId and the watch expiration timestamp (epoch ms).
 */
export async function setupGmailWatch(
  oauth2Client: OAuth2Client,
  topicName: string
): Promise<{ historyId: string; expiration: string }> {
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const watchResponse = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "INCLUDE",
    },
  });

  const historyId = watchResponse.data.historyId;
  const expiration = watchResponse.data.expiration;

  if (!historyId || !expiration) {
    throw new Error("Gmail watch response did not return expected historyId or expiration.");
  }

  return {
    historyId,
    expiration,
  };
}

/**
 * Stops Gmail push notifications for an account (e.g. when disconnected).
 */
export async function stopGmailWatch(oauth2Client: OAuth2Client): Promise<void> {
  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.stop({ userId: "me" });
  } catch (err) {
    console.error("Error stopping Gmail watch:", err);
  }
}

/**
 * Scans email_accounts for watches expiring within the next 24 hours (or expired),
 * and renews them with Gmail.
 */
export async function renewExpiringWatches(
  supabaseAdmin: SupabaseClient,
  topicName: string
): Promise<{ renewedCount: number; errors: string[] }> {
  const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Find connected accounts with expired or soon-to-expire watch
  const { data: accounts, error } = await supabaseAdmin
    .from("email_accounts")
    .select("id, user_id, email_address, encrypted_refresh_token, watch_expiration")
    .eq("provider", "gmail")
    .eq("connection_status", "connected")
    .or(`watch_expiration.is.null,watch_expiration.lt.${threshold}`);

  if (error || !accounts || accounts.length === 0) {
    return { renewedCount: 0, errors: error ? [error.message] : [] };
  }

  let renewedCount = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      const refreshToken = decryptToken(account.encrypted_refresh_token);
      const oauth2Client = getGoogleOAuthClient();
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      const { historyId, expiration } = await setupGmailWatch(oauth2Client, topicName);

      const expirationDate = new Date(parseInt(expiration, 10)).toISOString();

      await supabaseAdmin
        .from("email_accounts")
        .update({
          history_id: historyId,
          watch_expiration: expirationDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      renewedCount++;
    } catch (err) {
      const msg = `Failed to renew watch for ${account.email_address}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  return { renewedCount, errors };
}
