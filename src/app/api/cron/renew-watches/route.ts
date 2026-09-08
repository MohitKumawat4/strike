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
    // Optional CRON_SECRET security verification
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { status: "unauthorized", message: "Invalid or missing CRON_SECRET authorization." },
        { status: 401 }
      );
    }

    const pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC;
    if (!pubsubTopic) {
      return NextResponse.json(
        { status: "skipped", reason: "GOOGLE_PUBSUB_TOPIC not configured" },
        { status: 200 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const result = await renewExpiringWatches(supabaseAdmin, pubsubTopic);

    if (result.errors && result.errors.length > 0) {
      const { logLayerError } = await import("@/common/logging/layer-logger");
      await logLayerError({
        layer: "system",
        severity: "warning",
        errorCode: "GMAIL_WATCH_RENEWAL_WARNING",
        errorMessage: `Gmail push watch renewal encountered ${result.errors.length} account warning(s).`,
        technicalDetails: { errors: result.errors },
        supabaseClient: supabaseAdmin,
      });
    }

    return NextResponse.json({
      status: "success",
      renewedCount: result.renewedCount,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron watch renewal error:", error);
    const { logLayerError } = await import("@/common/logging/layer-logger");
    await logLayerError({
      layer: "system",
      severity: "error",
      errorCode: "WATCH_RENEWAL_CRON_FAILED",
      errorMessage: error instanceof Error ? error.message : "Cron watch renewal unexpected failure",
      error,
    });

    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
