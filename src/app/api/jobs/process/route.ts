import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/database/supabase/server";
import { runProcessingBatch } from "@/modules/processing/pipeline";

/**
 * Worker execution endpoint to process pending email jobs.
 *
 * Can be called on-demand from the UI, by webhooks after ingestion,
 * or scheduled via recurring cron tasks.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = typeof body.batchSize === "number" ? Math.min(25, body.batchSize) : 10;

    const supabaseAdmin = createSupabaseAdminClient();
    const result = await runProcessingBatch(supabaseAdmin, batchSize);

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
  return POST(req);
}
