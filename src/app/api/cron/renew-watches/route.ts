import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/database/supabase/server";
import { renewExpiringWatches } from "@/modules/email/providers/gmail/gmail.watch";

/**
 * Cron endpoint to renew expiring Gmail push notification watches.
 *
 * Scans connected Gmail accounts with watch_expiration < 24h from now and refreshes
 * the watch subscription with Google Cloud Pub/Sub.
 */
export async function GET(req: NextRequest) {
  try {
    const pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC;
    if (!pubsubTopic) {
      return NextResponse.json(
        { status: "skipped", reason: "GOOGLE_PUBSUB_TOPIC not configured" },
        { status: 200 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const result = await renewExpiringWatches(supabaseAdmin, pubsubTopic);

    return NextResponse.json({
      status: "success",
      renewedCount: result.renewedCount,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron watch renewal error:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
