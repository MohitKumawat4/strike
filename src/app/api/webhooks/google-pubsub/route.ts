import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/database/supabase/server";
import { processHistorySync } from "@/modules/email/ingestion/history-sync";
import { performInitialSync } from "@/modules/email/ingestion/initial-sync";

type PubSubMessageBody = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
};

type GmailPushData = {
  emailAddress?: string;
  historyId?: string;
};

/**
 * Webhook handler for Google Cloud Pub/Sub push subscriptions.
 *
 * Google sends an HTTP POST with a base64-encoded JSON message payload whenever
 * a registered Gmail account receives or modifies messages.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PubSubMessageBody;

    // Validate Pub/Sub payload structure
    if (!body.message?.data) {
      console.warn("Received empty or invalid Google Pub/Sub push payload.");
      // Return 200 to acknowledge and prevent endless retries for bad payloads
      return NextResponse.json({ status: "ignored", reason: "missing message.data" }, { status: 200 });
    }

    // 1. Decode base64 payload
    const decodedString = Buffer.from(body.message.data, "base64").toString("utf-8");
    let pushData: GmailPushData;

    try {
      pushData = JSON.parse(decodedString) as GmailPushData;
    } catch {
      console.warn("Failed to parse decoded Pub/Sub data JSON:", decodedString);
      return NextResponse.json({ status: "ignored", reason: "invalid json" }, { status: 200 });
    }

    const { emailAddress, historyId } = pushData;

    if (!emailAddress) {
      console.warn("Pub/Sub message missing emailAddress:", pushData);
      return NextResponse.json({ status: "ignored", reason: "missing emailAddress" }, { status: 200 });
    }

    // 2. Fetch the corresponding connected account from Supabase using Admin client
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: account, error: accountError } = await supabaseAdmin
      .from("email_accounts")
      .select("id, user_id, email_address, encrypted_refresh_token, history_id, connection_status")
      .eq("provider", "gmail")
      .eq("email_address", emailAddress)
      .single();

    if (accountError || !account) {
      console.warn(`No active account found for email: ${emailAddress}`);
      return NextResponse.json({ status: "ignored", reason: "account not found" }, { status: 200 });
    }

    if (account.connection_status !== "connected") {
      console.warn(`Account ${emailAddress} is not in connected state: ${account.connection_status}`);
      return NextResponse.json({ status: "ignored", reason: "account disconnected" }, { status: 200 });
    }

    // 3. Process incremental history sync
    const startHistoryId = account.history_id;

    if (startHistoryId) {
      // Incremental sync from last known historyId
      await processHistorySync(supabaseAdmin, {
        accountId: account.id,
        userId: account.user_id,
        encryptedRefreshToken: account.encrypted_refresh_token,
        startHistoryId,
      });
    } else {
      // If no history_id exists yet, run a bounded initial sync
      await performInitialSync(supabaseAdmin, {
        accountId: account.id,
        userId: account.user_id,
        encryptedRefreshToken: account.encrypted_refresh_token,
        maxMessages: 20,
      });

      // Update history_id if provided in push
      if (historyId) {
        await supabaseAdmin
          .from("email_accounts")
          .update({ history_id: historyId, last_successful_sync_at: new Date().toISOString() })
          .eq("id", account.id);
      }
    }

    // 4. Trigger processing pipeline for any newly queued jobs
    try {
      const { runProcessingBatch } = await import("@/modules/processing/pipeline");
      await runProcessingBatch(supabaseAdmin, 10);
    } catch (procErr) {
      console.error("Non-fatal error running processing batch after push:", procErr);
    }

    // Acknowledge receipt to Google Cloud Pub/Sub
    return NextResponse.json({ status: "success", email: emailAddress }, { status: 200 });
  } catch (error) {
    console.error("Error processing Google Pub/Sub push webhook:", error);
    // Return 200 to acknowledge and prevent poison-pill retry loops
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Internal error" },
      { status: 200 }
    );
  }
}
