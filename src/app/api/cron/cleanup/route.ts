import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/database/supabase/server";

export const runtime = "nodejs";

/**
 * Automated Data Retention & Privacy Cleanup Cron Endpoint.
 *
 * Runs daily (declared in vercel.json) to enforce each user's raw body data
 * retention preferences (raw_body_retention_days, default 30 days).
 *
 * Purges heavy body_text and body_html payloads for expired messages while
 * preserving essential metadata, AI classifications, and executive summaries.
 */
export async function GET(req: NextRequest) {
  return handleDataRetentionCleanup(req);
}

export async function POST(req: NextRequest) {
  return handleDataRetentionCleanup(req);
}

async function handleDataRetentionCleanup(req: NextRequest) {
  try {
    // Optional CRON_SECRET security check
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { status: "unauthorized", message: "Invalid or missing CRON_SECRET authorization." },
        { status: 401 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();

    // 1. Fetch user settings for retention policies
    const { data: userSettingsList, error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .select("user_id, raw_body_retention_days");

    if (settingsError) {
      console.error("Failed to query user_settings for cleanup cron:", settingsError);
      return NextResponse.json(
        { status: "error", message: settingsError.message },
        { status: 500 }
      );
    }

    let totalCleansed = 0;
    const userSummary: Array<{ userId: string; retentionDays: number; cleansedCount: number }> = [];

    // 2. Process each user's configured retention window
    const settingsMap = new Map<string, number>();
    for (const setting of userSettingsList || []) {
      const days = setting.raw_body_retention_days && setting.raw_body_retention_days > 0
        ? setting.raw_body_retention_days
        : 30;
      settingsMap.set(setting.user_id, days);
    }

    // Also handle default 30 days for any messages whose user doesn't have custom settings
    const defaultRetentionDays = 30;
    const now = Date.now();

    for (const [userId, days] of settingsMap.entries()) {
      const cutoffDate = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

      // Nullify raw body payloads for emails older than cutoff
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("email_messages")
        .update({
          body_text: null,
          body_html: null,
        })
        .eq("user_id", userId)
        .lt("received_at", cutoffDate)
        .or("body_text.not.is.null,body_html.not.is.null")
        .select("id");

      if (!updateError && updated) {
        const count = updated.length;
        totalCleansed += count;
        if (count > 0) {
          userSummary.push({ userId, retentionDays: days, cleansedCount: count });
        }
      }
    }

    // Cleanse messages for any users without explicit user_settings (fallback 30 days)
    const defaultCutoff = new Date(now - defaultRetentionDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: defaultUpdated } = await supabaseAdmin
      .from("email_messages")
      .update({
        body_text: null,
        body_html: null,
      })
      .lt("received_at", defaultCutoff)
      .or("body_text.not.is.null,body_html.not.is.null")
      .select("id");

    if (defaultUpdated && defaultUpdated.length > 0) {
      totalCleansed += defaultUpdated.length;
    }

    // 3. Record audit event in system_events
    try {
      await supabaseAdmin.from("system_events").insert({
        event_type: "privacy_data_retention_cleanup",
        severity: "info",
        payload: {
          total_cleansed: totalCleansed,
          details: userSummary,
          executed_at: new Date().toISOString(),
        },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      status: "success",
      totalCleansed,
      details: userSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Data retention cleanup cron execution error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Internal server error during cleanup cron",
      },
      { status: 500 }
    );
  }
}
