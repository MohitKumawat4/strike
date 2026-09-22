import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/database/supabase/server";
import { runProcessingBatch } from "@/modules/processing/pipeline";

/**
 * Worker execution endpoint to process pending email jobs.
 *
 * Can be called on-demand from the UI, by webhooks after ingestion,
 * or scheduled via recurring cron tasks.
 */
export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const isCron = Boolean(cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`);
    let userId: string | undefined;
    if (!isCron) {
      const supabase = await createSupabaseServerClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = user.id;
    }
    const body = await req.json().catch(() => ({}));
    const batchSize = Number.isInteger(body.batchSize) ? Math.max(1, Math.min(25, body.batchSize)) : 10;

    const supabaseAdmin = createSupabaseAdminClient();
    const result = await runProcessingBatch(supabaseAdmin, batchSize, 1, userId);

    return NextResponse.json({
      status: "success",
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Job processing worker error:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return POST(req);
}
