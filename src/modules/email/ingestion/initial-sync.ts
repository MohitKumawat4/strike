import { google } from "googleapis";
import { getGoogleOAuthClient } from "@/modules/email/providers/gmail/gmail.client";
import { decryptToken } from "@/common/crypto/encryption";
import type { SupabaseClient } from "@supabase/supabase-js";

type SyncAccountParams = {
  accountId: string;
  userId: string;
  encryptedRefreshToken: string;
  maxMessages?: number;
};

/**
 * Recursively extracts plain text body from a Gmail payload part tree.
 */
function extractBodyText(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
      if (part.parts) {
        const nested = extractBodyText(part);
        if (nested) return nested;
      }
    }
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  return "";
}

/**
 * Performs a bounded sync for a connected Gmail account:
 * 1. Authorizes a Gmail client using the decrypted refresh token.
 * 2. Fetches recent messages from INBOX.
 * 3. Extracts headers, sender, subject, date, body, and snippets.
 * 4. Persists the normalized emails into `email_messages` and queues processing jobs.
 */
export async function performInitialSync(
  supabase: SupabaseClient,
  { accountId, userId, encryptedRefreshToken, maxMessages = 20 }: SyncAccountParams
) {
  const refreshToken = decryptToken(encryptedRefreshToken);
  const oauth2Client = getGoogleOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // 1. List message IDs from INBOX
  const listResponse = await gmail.users.messages.list({
    userId: "me",
    maxResults: maxMessages,
  });

  const messageList = listResponse.data.messages || [];
  if (messageList.length === 0) {
    return { syncedCount: 0 };
  }

  let syncedCount = 0;

  // 2. Fetch and parse each message
  for (const item of messageList) {
    if (!item.id) continue;

    try {
      const msgResponse = await gmail.users.messages.get({
        userId: "me",
        id: item.id,
        format: "full",
      });

      const message = msgResponse.data;
      if (!message || !message.id) continue;

      const headers = message.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

      const subject = getHeader("Subject") || "(No Subject)";
      const fromHeader = getHeader("From") || "Unknown Sender";
      const toHeader = getHeader("To") || "";
      const dateHeader = getHeader("Date");
      const receivedAt = dateHeader ? new Date(dateHeader) : new Date();

      // Extract body text & snippet
      const snippet = message.snippet || "";
      const bodyText = extractBodyText(message.payload) || snippet;

      // Deduplication key
      const dedupeKey = `gmail:${accountId}:${message.id}`;

      // Insert or update message into database
      const { data: insertedMsg, error: insertError } = await supabase
        .from("email_messages")
        .upsert(
          {
            account_id: accountId,
            user_id: userId,
            provider_message_id: message.id,
            thread_id: message.threadId || null,
            sender: { raw: fromHeader },
            recipients: [{ raw: toHeader }],
            subject,
            snippet,
            body_text: bodyText,
            received_at: receivedAt.toISOString(),
            ingested_at: new Date().toISOString(),
            dedupe_key: dedupeKey,
            has_attachments: Boolean(
              message.payload?.parts?.some((part) => part.filename && part.filename.length > 0)
            ),
            processing_status: "RECEIVED",
          },
          {
            onConflict: "account_id,provider_message_id",
          }
        )
        .select("id")
        .single();

      if (!insertError && insertedMsg) {
        syncedCount++;

        // Queue pending ingestion job for the AI pipeline
        await supabase.from("processing_jobs").upsert(
          {
            message_id: insertedMsg.id,
            stage: "ingestion",
            status: "pending",
            attempts: 0,
            started_at: new Date().toISOString(),
          },
          {
            onConflict: "message_id,stage",
            ignoreDuplicates: true,
          }
        );
      }
    } catch (err) {
      console.error(`Failed to sync message ${item.id}:`, err);
    }
  }

  // Update last successful sync timestamp on the account
  await supabase
    .from("email_accounts")
    .update({
      last_successful_sync_at: new Date().toISOString(),
      connection_status: "connected",
    })
    .eq("id", accountId);

  return { syncedCount };
}
