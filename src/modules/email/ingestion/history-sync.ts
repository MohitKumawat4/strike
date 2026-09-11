import { getPipelineControls, afterResume } from "@/common/pipeline-controls";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/common/crypto/encryption";
import { getGoogleOAuthClient } from "@/modules/email/providers/gmail/gmail.client";
import { performInitialSync, extractCleanEmailContent, decodeHtmlEntities } from "./initial-sync";

type HistorySyncParams = {
  accountId: string;
  userId: string;
  encryptedRefreshToken: string;
  startHistoryId: string;
};

type HistorySyncResult = {
  syncedCount: number;
  latestHistoryId: string | null;
  fellBackToInitialSync?: boolean;
};

/**
 * Performs incremental history sync using Gmail History API:
 * 1. Queries gmail.users.history.list starting from startHistoryId.
 * 2. Collects all newly added messages (messagesAdded).
 * 3. Fetches the full message payload and inserts into email_messages.
 * 4. Queues pending jobs in processing_jobs for the AI pipeline.
 * 5. Updates account history_id to latest.
 */
export async function processHistorySync(
  supabase: SupabaseClient,
  { accountId, userId, encryptedRefreshToken, startHistoryId }: HistorySyncParams
): Promise<HistorySyncResult> {
  const { data: userSettings, error: settingsError } = await supabase.from("user_settings").select("notification_preferences").eq("user_id", userId).maybeSingle();
  if (settingsError) throw settingsError;
  const prefs = (userSettings?.notification_preferences ?? {}) as Record<string, unknown>;
  if (!getPipelineControls(prefs).receive_emails) return { syncedCount: 0, latestHistoryId: startHistoryId };
  const refreshToken = decryptToken(encryptedRefreshToken);
  const oauth2Client = getGoogleOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  let historyRecords;
  let latestHistoryId = startHistoryId;

  try {
    const historyResponse = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
    });

    historyRecords = historyResponse.data.history || [];
    latestHistoryId = historyResponse.data.historyId || startHistoryId;
  } catch (err: unknown) {
    // If startHistoryId is too old (HTTP 404), fallback to initial sync
    const isHistoryExpired =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 404;

    if (isHistoryExpired) {
      console.warn(
        `History ID ${startHistoryId} is expired or invalid for account ${accountId}. Falling back to bounded initial sync.`
      );
      const initialSyncResult = await performInitialSync(supabase, {
        accountId,
        userId,
        encryptedRefreshToken,
        maxMessages: 20,
      });

      return {
        syncedCount: initialSyncResult.syncedCount,
        latestHistoryId: null,
        fellBackToInitialSync: true,
      };
    }

    throw err;
  }

  // Collect unique new message IDs
  const newMessageIds = new Set<string>();
  for (const record of historyRecords) {
    if (record.messagesAdded) {
      for (const item of record.messagesAdded) {
        if (item.message?.id) {
          newMessageIds.add(item.message.id);
        }
      }
    }
  }

  if (newMessageIds.size === 0) {
    // Update latest history ID even if no messages were added
    if (latestHistoryId !== startHistoryId) {
      await supabase
        .from("email_accounts")
        .update({
          history_id: latestHistoryId,
          last_successful_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);
    }

    return { syncedCount: 0, latestHistoryId };
  }

  let syncedCount = 0;

  // Ingest each new email
  for (const messageId of newMessageIds) {
    try {
      const msgResponse = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      const message = msgResponse.data;
      if (!message || !message.id) continue;

      // Extract native Gmail label IDs (e.g. INBOX, CATEGORY_PROMOTIONS, CATEGORY_SOCIAL, IMPORTANT)
      const labelIds = Array.isArray(message.labelIds) ? message.labelIds : [];

      const headers = message.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

      const rawSubject = getHeader("Subject") || "(No Subject)";
      const rawSender = getHeader("From") || "Unknown Sender";
      const toHeader = getHeader("To") || "";
      const dateHeader = getHeader("Date");
      const receivedAt = new Date(Number(message.internalDate) || Date.parse(dateHeader) || Date.now());
      if (!afterResume(receivedAt.toISOString(), prefs.receive_after)) continue;

      // Decode HTML entities
      const subject = decodeHtmlEntities(rawSubject);
      const fromHeader = decodeHtmlEntities(rawSender);
      const rawSnippet = message.snippet || "";
      const snippet = decodeHtmlEntities(rawSnippet);

      // Extract clean readable body text & raw HTML
      const { bodyText, bodyHtml } = extractCleanEmailContent(message.payload, snippet);

      const dedupeKey = `gmail:${accountId}:${message.id}`;

      // Insert into email_messages
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
            body_html: bodyHtml || null,
            received_at: receivedAt.toISOString(),
            ingested_at: new Date().toISOString(),
            dedupe_key: dedupeKey,
            has_attachments: Boolean(
              message.payload?.parts?.some((part) => part.filename && part.filename.length > 0)
            ),
            labels: labelIds,
            processing_status: "RECEIVED",
          },
          {
            onConflict: "account_id,provider_message_id",
            ignoreDuplicates: true,
          }
        )
        .select("id")
        .maybeSingle();

      if (!insertError && insertedMsg) {
        syncedCount++;

        // The shared stage handlers decide which layers to run.
        {
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
      }
    } catch (err) {
      console.error(`Failed to ingest message ${messageId} via history sync:`, err);
      const { logLayerError } = await import("@/common/logging/layer-logger");
      await logLayerError({
        layer: "ingestion",
        severity: "error",
        errorCode: "HISTORY_MESSAGE_INGEST_FAILED",
        errorMessage: `Failed to ingest message ${messageId} via history sync: ${err instanceof Error ? err.message : String(err)}`,
        error: err,
        userId,
        accountId,
        technicalDetails: { providerMessageId: messageId, startHistoryId },
        supabaseClient: supabase,
      });
    }
  }

  // Update account history_id & sync timestamp
  await supabase
    .from("email_accounts")
    .update({
      history_id: latestHistoryId,
      last_successful_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  return {
    syncedCount,
    latestHistoryId,
  };
}
