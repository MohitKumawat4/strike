import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/database/supabase/server";
import { performInitialSync } from "@/modules/email/ingestion/initial-sync";

/**
 * On-demand manual mailbox sync endpoint.
 * Triggered by the user clicking "Sync" or "Sync All" from the Dashboard.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const accountId = body.accountId as string | undefined;

    // Fetch user's connected Gmail accounts
    let query = supabase
      .from("email_accounts")
      .select("id, user_id, email_address, encrypted_refresh_token, history_id, connection_status")
      .eq("user_id", user.id)
      .eq("provider", "gmail");

    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: dbError } = await query;

    if (dbError || !accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: "No active connected Gmail accounts found to sync." },
        { status: 404 }
      );
    }

    // Fetch user settings for WhatsApp destination and preferences
    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("whatsapp_destination, notification_preferences")
      .eq("user_id", user.id)
      .maybeSingle();

    const syncResults = [];
    const allHistoricalMessages: Array<{
      id: string;
      subject: string;
      sender: string;
      received_at: string;
      snippet?: string;
    }> = [];
    let totalTodayCount = 0;

    for (const account of accounts) {
      try {
        const res = await performInitialSync(supabase, {
          accountId: account.id,
          userId: account.user_id,
          encryptedRefreshToken: account.encrypted_refresh_token,
          maxMessages: 100,
        });

        totalTodayCount += res.todayCount;
        allHistoricalMessages.push(...res.historicalMessages);

        syncResults.push({
          email: account.email_address,
          synced: res.syncedCount,
          today: res.todayCount,
          historical: res.historicalCount,
        });
      } catch (accountErr) {
        console.error(`Sync error for ${account.email_address}:`, accountErr);
        syncResults.push({
          email: account.email_address,
          error: accountErr instanceof Error ? accountErr.message : "Sync failed",
        });
      }
    }

    // Trigger background pipeline batch processor for today's new messages
    if (totalTodayCount > 0) {
      try {
        const { runProcessingBatch } = await import("@/modules/processing/pipeline");
        const { createSupabaseAdminClient } = await import("@/database/supabase/server");
        const supabaseAdmin = createSupabaseAdminClient();
        await runProcessingBatch(supabaseAdmin, Math.min(totalTodayCount + 5, 25));
      } catch (procErr) {
        console.warn("Background processing runner warning:", procErr);
      }
    }

    // Send WhatsApp Catch-up Digest for missed offline gap days (if WhatsApp is configured)
    const destinationPhone = userSettings?.whatsapp_destination;
    const notifyEnabled = (userSettings?.notification_preferences as { notify_on_important?: boolean } | null)?.notify_on_important !== false;

    if (destinationPhone && notifyEnabled && allHistoricalMessages.length > 0) {
      try {
        const { sendWhatsAppMessage } = await import("@/modules/whatsapp/whatsapp");

        // Compute oldest email timestamp in the historical batch
        const timestamps = allHistoricalMessages
          .map((m) => new Date(m.received_at).getTime())
          .filter((t) => !isNaN(t));

        const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
        const gapDays = Math.max(1, Math.ceil((Date.now() - oldestTimestamp) / (1000 * 60 * 60 * 24)));

        let digestBody = "";

        if (gapDays >= 7) {
          // Weekly / multi-week digest format
          const weeksCount = Math.max(1, Math.round(gapDays / 7));
          const oldestStr = new Date(oldestTimestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const nowStr = new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          digestBody = [
            `📅 *Strike Catch-up Digest*`,
            `Synced *${allHistoricalMessages.length}* historical emails over the past *${weeksCount} week(s)* (${oldestStr} – ${nowStr}).`,
            ``,
            `• *Historical Emails Synced*: ${allHistoricalMessages.length}`,
            `• *Today's Incoming Emails*: ${totalTodayCount}`,
            ``,
            `📊 _All historical messages have been indexed to your Strike Dashboard._`,
          ].join("\n");
        } else {
          // 1 to 6 days daily digest format
          const dayGroups: Record<string, number> = {};
          for (const msg of allHistoricalMessages) {
            const dateStr = new Date(msg.received_at).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            dayGroups[dateStr] = (dayGroups[dateStr] || 0) + 1;
          }

          const breakdownLines = Object.entries(dayGroups)
            .map(([day, count]) => `• *${day}*: ${count} emails`)
            .join("\n");

          digestBody = [
            `📅 *Strike Catch-up Digest*`,
            `Synced *${allHistoricalMessages.length}* emails across *${gapDays} missed day(s)* while Strike was offline:`,
            ``,
            breakdownLines,
            ``,
            `📊 _All historical messages are available in your Strike Dashboard._`,
          ].join("\n");
        }

        await sendWhatsAppMessage(destinationPhone, "text", { body: digestBody });
      } catch (waErr) {
        console.warn("Failed to send WhatsApp catch-up digest during sync:", waErr);
      }
    }

    const totalSynced = syncResults.reduce((acc, r) => acc + (r.synced || 0), 0);

    return NextResponse.json({
      success: true,
      results: syncResults,
      message: `Synced ${totalSynced} messages (${totalTodayCount} today, ${allHistoricalMessages.length} historical) across ${accounts.length} mailbox(es).`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error during manual sync";
    console.error("Manual sync route error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
