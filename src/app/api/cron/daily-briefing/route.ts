import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/database/supabase/server";
import { sendGreetings24hTemplate } from "@/modules/whatsapp/templates";

export const runtime = "nodejs";

/**
 * Daily Briefing & 24-Hour Messaging Window Re-Activation Cron Endpoint.
 *
 * Triggered daily (e.g. at 07:00 AM local time / via Vercel Cron or scheduler)
 * to deliver morning intelligence greetings and re-establish the WhatsApp 24-hour
 * messaging window for all active recipients.
 */
export async function GET(req: NextRequest) {
  return handleDailyBriefing(req);
}

export async function POST(req: NextRequest) {
  return handleDailyBriefing(req);
}

async function handleDailyBriefing(req: NextRequest) {
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

    // Query all users who have an active WhatsApp destination configured
    const { data: settingsList, error: queryError } = await supabaseAdmin
      .from("user_settings")
      .select("user_id, whatsapp_destination")
      .not("whatsapp_destination", "is", null);

    if (queryError) {
      console.error("Failed to query user_settings for daily briefing cron:", queryError);
      return NextResponse.json(
        { status: "error", message: queryError.message },
        { status: 500 }
      );
    }

    // Filter to valid phone strings
    const recipients = (settingsList || []).filter(
      (s) => s.whatsapp_destination && s.whatsapp_destination.trim().length > 0
    );

    if (recipients.length === 0) {
      return NextResponse.json({
        status: "success",
        dispatchedCount: 0,
        totalRecipients: 0,
        message: "No active WhatsApp recipients found.",
        timestamp: new Date().toISOString(),
      });
    }

    let dispatchedCount = 0;
    const errors: Array<{ userId: string; phone: string; error: string }> = [];

    // Dispatch greetings template to each recipient
    for (const recipient of recipients) {
      const phone = recipient.whatsapp_destination!.trim();
      try {
        await sendGreetings24hTemplate(phone, "there", {
          user_id: recipient.user_id,
        });
        dispatchedCount += 1;
      } catch (dispatchErr) {
        const errMsg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
        console.error(`Daily greeting dispatch failed for user ${recipient.user_id} (${phone}):`, errMsg);
        errors.push({
          userId: recipient.user_id,
          phone,
          error: errMsg,
        });
      }
    }

    return NextResponse.json({
      status: "success",
      dispatchedCount,
      totalRecipients: recipients.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Daily briefing cron execution error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Internal server error during daily briefing cron",
      },
      { status: 500 }
    );
  }
}
