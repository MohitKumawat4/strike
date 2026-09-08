import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/database/supabase/server";
import { fetchLayerErrors, logLayerError, type ExecutionLayer, type ErrorSeverity } from "@/common/logging/layer-logger";

export const runtime = "nodejs";

/**
 * GET /api/error-logs
 * Retrieves paginated, filtered, and sorted error logs for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const layer = (searchParams.get("layer") || "all") as ExecutionLayer | "all";
    const severity = (searchParams.get("severity") || "all") as ErrorSeverity | "all";
    const search = searchParams.get("search") || "";
    const timeRange = (searchParams.get("timeRange") || "all") as "today" | "24h" | "7d" | "30d" | "all";
    const sort = (searchParams.get("sort") || "newest") as "newest" | "oldest" | "severity";
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const supabaseAdmin = createSupabaseAdminClient();
    const result = await fetchLayerErrors(supabaseAdmin, {
      userId: user.id,
      layer,
      severity,
      search,
      timeRange,
      sort,
      limit,
      offset,
    });

    return NextResponse.json({
      status: "success",
      logs: result.logs,
      totalCount: result.totalCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error in GET /api/error-logs:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/error-logs
 * Allows manual log recording or trigger of a simulated test error in any specified layer.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      layer = "system",
      severity = "error",
      errorCode = "MANUAL_LOG_ENTRY",
      errorMessage = "Manual test error log generated.",
      technicalDetails = {},
      context = {},
    } = body;

    const logId = await logLayerError({
      layer,
      severity,
      errorCode,
      errorMessage,
      userId: user.id,
      technicalDetails,
      context,
    });

    return NextResponse.json({
      status: "success",
      logId,
      message: `Error recorded for ${layer} layer.`,
    });
  } catch (error) {
    console.error("Error in POST /api/error-logs:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
