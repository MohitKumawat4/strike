import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ExecutionLayer,
  type ErrorSeverity,
  type LayerErrorRecord,
  type LogLayerErrorParams,
  LAYER_TITLES,
} from "./layer-logger.types";

export * from "./layer-logger.types";

/**
 * Standardized Centralized Layer Logger for Strike.
 * Records structured error logs to the Supabase `error_logs` table,
 * captures stack traces and execution context, and formats developer console output.
 */
export async function logLayerError(params: LogLayerErrorParams): Promise<string | null> {
  const {
    layer,
    severity = "error",
    errorCode,
    error,
    userId = null,
    accountId = null,
    messageId = null,
    jobId = null,
    technicalDetails = {},
    context = {},
    supabaseClient,
  } = params;

  // 1. Extract error message and stack trace
  let resolvedMessage = params.errorMessage || "Unknown execution error occurred.";
  let stackTrace: string | null = null;

  if (error instanceof Error) {
    if (!params.errorMessage) {
      resolvedMessage = error.message;
    }
    stackTrace = error.stack || null;
  } else if (typeof error === "string") {
    if (!params.errorMessage) {
      resolvedMessage = error;
    }
  } else if (error && typeof error === "object") {
    try {
      const stringified = JSON.stringify(error);
      if (!params.errorMessage) {
        resolvedMessage = stringified;
      }
    } catch {
      // Ignore stringify error
    }
  }

  // 2. Build merged context payload
  const enrichedContext: Record<string, unknown> = {
    ...context,
    ...(accountId ? { account_id: accountId } : {}),
    ...(messageId ? { message_id: messageId } : {}),
    ...(jobId ? { job_id: jobId } : {}),
  };

  // 3. Print structured developer log to console
  const badge = `[LAYER: ${layer.toUpperCase()}] [${severity.toUpperCase()}] [${errorCode}]`;
  if (severity === "critical" || severity === "error") {
    console.error(`🚨 ${badge}: ${resolvedMessage}`);
  } else if (severity === "warning") {
    console.warn(`⚠️ ${badge}: ${resolvedMessage}`);
  } else {
    console.log(`ℹ️ ${badge}: ${resolvedMessage}`);
  }

  // 4. Asynchronously persist to Supabase error_logs table
  try {
    let db = supabaseClient;
    if (!db) {
      const { createSupabaseAdminClient } = await import("@/database/supabase/server");
      db = createSupabaseAdminClient();
    }

    const { data, error: insertError } = await db
      .from("error_logs")
      .insert({
        user_id: userId,
        layer,
        severity,
        error_code: errorCode,
        error_message: resolvedMessage,
        stack_trace: stackTrace,
        technical_details: technicalDetails,
        context: enrichedContext,
        occurred_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.warn("Failed to write error log to Supabase error_logs:", insertError.message);
      return null;
    }

    return data?.id || null;
  } catch (dbErr) {
    console.warn("Error recording logLayerError to database:", dbErr);
    return null;
  }
}

/**
 * Query helper to retrieve error logs with filtering, sorting, and pagination.
 */
export async function fetchLayerErrors(
  db: SupabaseClient,
  options: {
    userId?: string;
    layer?: ExecutionLayer | "all";
    severity?: ErrorSeverity | "all";
    search?: string;
    timeRange?: "today" | "24h" | "7d" | "30d" | "all";
    sort?: "newest" | "oldest" | "severity";
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ logs: LayerErrorRecord[]; totalCount: number }> {
  const {
    userId,
    layer = "all",
    severity = "all",
    search = "",
    timeRange = "all",
    sort = "newest",
    limit = 50,
    offset = 0,
  } = options;

  let query = db.from("error_logs").select("*", { count: "exact" });

  if (userId) {
    query = query.or(`user_id.eq.${userId},user_id.is.null`);
  }

  if (layer && layer !== "all") {
    query = query.eq("layer", layer);
  }

  if (severity && severity !== "all") {
    query = query.eq("severity", severity);
  }

  // Time range filtering
  const now = Date.now();
  if (timeRange === "today") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    query = query.gte("occurred_at", startOfToday.toISOString());
  } else if (timeRange === "24h") {
    const cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("occurred_at", cutoff);
  } else if (timeRange === "7d") {
    const cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("occurred_at", cutoff);
  } else if (timeRange === "30d") {
    const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("occurred_at", cutoff);
  }

  // Search filter
  if (search.trim()) {
    const q = search.trim();
    query = query.or(
      `error_code.ilike.%${q}%,error_message.ilike.%${q}%,layer.ilike.%${q}%`
    );
  }

  // Sorting
  if (sort === "oldest") {
    query = query.order("occurred_at", { ascending: true });
  } else {
    query = query.order("occurred_at", { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error("fetchLayerErrors query error:", error);
    return { logs: [], totalCount: 0 };
  }

  return {
    logs: (data as LayerErrorRecord[]) || [],
    totalCount: count || 0,
  };
}
