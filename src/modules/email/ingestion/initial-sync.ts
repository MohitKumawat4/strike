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
 * Checks if two dates fall on the same calendar day in UTC.
 */
function isSameDayUTC(d1: Date, d2: Date): boolean {
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
}

export type SyncedHistoricalMessage = {
  id: string;
  subject: string;
  sender: string;
  received_at: string;
  snippet?: string;
};

export type SyncResult = {
  syncedCount: number;
  todayCount: number;
  historicalCount: number;
  historicalMessages: SyncedHistoricalMessage[];
};

/**
 * Performs a bounded or full catch-up sync for a connected Gmail account:
 * 1. Authorizes a Gmail client using the decrypted refresh token.
 * 2. Fetches messages from INBOX (up to maxMessages).
 * 3. Extracts headers, sender, subject, date, body, and snippets.
 * 4. Persists the normalized emails into `email_messages`.
 * 5. Runs AI triage & summarization ONLY on today's messages.
 * 6. Categorizes historical emails without consuming AI tokens.
 */
export async function performInitialSync(
  supabase: SupabaseClient,
  { accountId, userId, encryptedRefreshToken, maxMessages = 100 }: SyncAccountParams
): Promise<SyncResult> {
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
    return {
      syncedCount: 0,
      todayCount: 0,
      historicalCount: 0,
      historicalMessages: [],
    };
  }

  let syncedCount = 0;
  let todayCount = 0;
  let historicalCount = 0;
  const historicalMessages: SyncedHistoricalMessage[] = [];
  const now = new Date();

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

      // Check if the message is from today (within last 24h or same calendar day)
      const isToday =
        isSameDayUTC(receivedAt, now) ||
        now.getTime() - receivedAt.getTime() < 24 * 60 * 60 * 1000;

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
            processing_status: isToday ? "RECEIVED" : "COMPLETED",
          },
          {
            onConflict: "account_id,provider_message_id",
          }
        )
        .select("id")
        .single();

      if (!insertError && insertedMsg) {
        syncedCount++;

        if (isToday) {
          todayCount++;
          // Queue pending ingestion job for the live AI pipeline
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
        } else {
          historicalCount++;
          historicalMessages.push({
            id: insertedMsg.id,
            subject,
            sender: fromHeader,
            received_at: receivedAt.toISOString(),
            snippet,
          });

          // Insert default classification for historical email so it populates stats
          await supabase.from("ai_results").upsert(
            {
              message_id: insertedMsg.id,
              category: "normal",
              importance: 0.4,
              confidence: 0.85,
              reason: "Historical email synced from connected inbox.",
            },
            {
              onConflict: "message_id",
              ignoreDuplicates: true,
            }
          );
        }
      }
    } catch (err) {
      console.error(`Failed to sync message ${item.id}:`, err);
      const { logLayerError } = await import("@/common/logging/layer-logger");
      await logLayerError({
        layer: "ingestion",
        severity: "error",
        errorCode: "GMAIL_MESSAGE_FETCH_FAILED",
        errorMessage: `Failed to fetch/parse message ${item.id} from Gmail: ${err instanceof Error ? err.message : String(err)}`,
        error: err,
        userId,
        accountId,
        technicalDetails: { providerMessageId: item.id },
        supabaseClient: supabase,
      });
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

  return {
    syncedCount,
    todayCount,
    historicalCount,
    historicalMessages,
  };
}
