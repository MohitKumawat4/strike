import { NextResponse } from "next/server";
import { getServerEnv } from "@/config/server-env";
import { createSupabaseAdminClient } from "@/database/supabase/server";

export async function GET() {
  const startTime = Date.now();
  const env = getServerEnv();

  const healthReport: {
    status: "healthy" | "degraded" | "unhealthy";
    uptimeSeconds: number;
    timestamp: string;
    services: {
      database: { status: "connected" | "error"; latencyMs?: number; error?: string };
      aiEngine: { provider: string; configured: boolean };
      googlePubSub: { configured: boolean; topic?: string };
      googleOAuth: { configured: boolean; clientId?: string };
      encryption: { status: "valid" | "invalid" };
      jobQueue: { pendingCount?: number; status: "healthy" | "error" };
    };
  } = {
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: { status: "error" },
      aiEngine: {
        provider: env.GEMINI_API_KEY
          ? "google-gemini (gemini-1.5-flash)"
          : env.OPENAI_API_KEY
          ? "openai (gpt-4o-mini)"
          : "heuristic-fallback",
        configured: Boolean(env.GEMINI_API_KEY || env.OPENAI_API_KEY),
      },
      googlePubSub: {
        configured: Boolean(env.GOOGLE_PUBSUB_TOPIC),
        topic: env.GOOGLE_PUBSUB_TOPIC ? env.GOOGLE_PUBSUB_TOPIC.split("/").pop() : undefined,
      },
      googleOAuth: {
        configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        clientId: env.GOOGLE_CLIENT_ID ? `${env.GOOGLE_CLIENT_ID.slice(0, 8)}...` : undefined,
      },
      encryption: {
        status: env.ENCRYPTION_KEY && env.ENCRYPTION_KEY.length >= 32 ? "valid" : "invalid",
      },
      jobQueue: { status: "healthy" },
    },
  };

  try {
    const supabase = createSupabaseAdminClient();
    const dbStart = Date.now();

    // Check database connection and job queue count in parallel
    const [dbCheck, jobsCheck] = await Promise.all([
      supabase.from("email_accounts").select("id", { count: "exact", head: true }),
      supabase.from("processing_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const dbLatency = Date.now() - dbStart;

    if (dbCheck.error) {
      healthReport.services.database = {
        status: "error",
        error: dbCheck.error.message,
      };
      healthReport.status = "degraded";
    } else {
      healthReport.services.database = {
        status: "connected",
        latencyMs: dbLatency,
      };
    }

    healthReport.services.jobQueue.pendingCount = jobsCheck.count || 0;
  } catch (err: unknown) {
    healthReport.services.database = {
      status: "error",
      error: err instanceof Error ? err.message : "Database connection failed",
    };
    healthReport.status = "degraded";
  }

  const statusCode = healthReport.status === "healthy" ? 200 : 200; // Return 200 with degraded details for observability

  return NextResponse.json(healthReport, { status: statusCode });
}
