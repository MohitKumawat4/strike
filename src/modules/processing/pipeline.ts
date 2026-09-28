/* ═══════════════════════════════════════════════════════════════════════════
 * Processing Pipeline — Job Claim, Execution & Batch Runner
 *
 * This module claims jobs from the PostgreSQL-backed processing_jobs queue,
 * executes them through the Checkpoint Pipeline Orchestrator, and handles
 * retries, heartbeats, and batch processing.
 *
 * The old per-stage handler map has been replaced with the unified
 * PipelineOrchestrator that runs all checkpoints (Filtration → AI Triage
 * → AI Summary → Delivery) in a single pass with automatic bypass/recovery.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logLayerError, type ExecutionLayer } from "@/common/logging/layer-logger";
import { runPipeline } from "@/modules/pipeline/pipeline-orchestrator";
import type { EmailMessageRecord, UserSettingsRecord } from "@/modules/pipeline/pipeline.types";

// Re-export for backward compatibility (other files import from here)
export type { EmailMessageRecord } from "@/modules/pipeline/pipeline.types";

/* ═══════════════════════════════════════════════════════════════════════════
 * Processing job record type starts here
 * ═══════════════════════════════════════════════════════════════════════════ */

export type ProcessingJobRecord = {
  id: string;
  message_id: string;
  stage: "ingestion" | "pre_filter" | "triage" | "summary" | "delivery";
  status: string;
  attempts: number;
  lease_owner: string;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * Processing job record type ends here
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
 * Job claiming starts here
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Claims the next batch of available jobs from the PostgreSQL processing queue.
 * Uses the strike_claim_jobs RPC which atomically leases jobs to prevent
 * duplicate processing across concurrent workers.
 */
export async function claimNextJobs(
  db: SupabaseClient,
  limit = 5,
  userId?: string,
): Promise<ProcessingJobRecord[]> {
  const { data, error } = await db.rpc("strike_claim_jobs", {
    p_owner: randomUUID(),
    p_limit: limit,
    p_user: userId ?? null,
  });
  if (error) throw error;
  return data || [];
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Job claiming ends here
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
 * Single job processing starts here
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Processes a single claimed job through the Checkpoint Pipeline Orchestrator.
 *
 * For ingestion-stage jobs: validates the email payload (non-empty check).
 * For all other stages: runs the full checkpoint pipeline (Filtration →
 * AI Triage → AI Summary → Delivery) with automatic bypass and recovery.
 *
 * Heartbeats keep the lease alive during long-running AI operations.
 */
export async function processSingleJob(
  db: SupabaseClient,
  job: ProcessingJobRecord,
) {
  let userId: string | undefined;

  // Heartbeats are fenced by the claim token. An expired worker cannot commit outputs.
  const heartbeat = setInterval(() => {
    void db
      .from("processing_jobs")
      .update({
        lease_expires_at: new Date(Date.now() + 120_000).toISOString(),
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("lease_owner", job.lease_owner)
      .eq("status", "running")
      .gt("lease_expires_at", new Date().toISOString())
      .then(({ error }) => {
        if (error) console.error("Job heartbeat failed", job.id);
      });
  }, 30_000);

  try {
    // 1. Fetch the email message being processed
    const { data: message, error } = await db
      .from("email_messages")
      .select("*")
      .eq("id", job.message_id)
      .single();
    if (error) throw error;
    if (!message) throw new Error("MESSAGE_NOT_FOUND");

    userId = message.user_id;

    let result;

    if (job.stage === "ingestion") {
      // Ingestion is a simple validation — not part of the checkpoint pipeline
      const m = message as EmailMessageRecord;
      if (!m.subject && !m.snippet && !m.body_text && !m.body_html && !m.has_attachments) {
        throw new Error("EMPTY_EMAIL_PAYLOAD");
      }
      result = {
        success: true,
        messageStatus: "RECEIVED",
        nextStage: "pre_filter" as const,
        bypassLog: [],
      };
    } else {
      // Run the full checkpoint pipeline for all post-ingestion stages
      const { data: userSettings } = await db
        .from("user_settings")
        .select("*")
        .eq("user_id", message.user_id)
        .maybeSingle();

      result = await runPipeline(
        db,
        message as EmailMessageRecord,
        (userSettings as UserSettingsRecord) || null,
      );
    }

    if (!result.success) {
      throw new Error(result.error || "PIPELINE_FAILED");
    }

    // 2. Commit the result via the fenced finish RPC
    const { error: finishError } = await db.rpc("strike_finish_job", {
      p_job: job.id,
      p_owner: job.lease_owner,
      p_result: result,
    });
    if (finishError) throw finishError;

    return { success: true, stage: job.stage, nextStage: result.nextStage };
  } catch (err) {
    // 3. Handle job failure with exponential backoff retry
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);

    const { error: writeError } = await db
      .from("processing_jobs")
      .update({
        status: job.attempts >= 3 ? "failed" : "retrying",
        next_retry_at: new Date(
          Date.now() + Math.min(300_000, 15_000 * 2 ** job.attempts),
        ).toISOString(),
        error_code: "STAGE_FAILED",
        error_message: errorMessage,
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq("id", job.id)
      .eq("lease_owner", job.lease_owner);
    if (writeError) throw writeError;

    // Log the failure to the error_logs table
    const layer: ExecutionLayer =
      job.stage === "pre_filter"
        ? "filtration"
        : job.stage === "summary"
          ? "summarization"
          : (job.stage as ExecutionLayer);

    await logLayerError({
      layer,
      userId,
      messageId: job.message_id,
      jobId: job.id,
      errorCode: "STAGE_FAILED",
      errorMessage,
      severity: job.attempts >= 3 ? "error" : "warning",
      supabaseClient: db,
    });

    return { success: false, stage: job.stage, error: errorMessage };
  } finally {
    clearInterval(heartbeat);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Single job processing ends here
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
 * Batch processing starts here
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Runs a batch of processing jobs, claiming and executing in passes.
 * Each pass claims up to maxBatchSize jobs and processes them in parallel.
 */
export async function runProcessingBatch(
  db: SupabaseClient,
  maxBatchSize = 5,
  maxPasses = 1,
  userId?: string,
) {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (let pass = 0; pass < maxPasses; pass++) {
    const jobs = await claimNextJobs(db, maxBatchSize, userId);
    if (!jobs.length) break;

    const results = await Promise.allSettled(
      jobs.map((job) => processSingleJob(db, job)),
    );

    for (const result of results) {
      processed++;
      if (result.status === "fulfilled" && result.value.success) {
        succeeded++;
      } else {
        failed++;
      }
    }
  }

  return { processed, succeeded, failed };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Batch processing ends here
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
 * System event logging starts here
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Records a generic system event to the system_events table.
 * Used for infrastructure-level events like cron triggers and health checks.
 */
export async function logSystemEvent(
  db: SupabaseClient,
  event: {
    event_type: string;
    severity: string;
    payload: Record<string, unknown>;
  },
) {
  const { error } = await db
    .from("system_events")
    .insert({
      ...event,
      entity_type: "system",
      entity_id: randomUUID(),
    });
  if (error) console.error("System event could not be saved", error.code);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * System event logging ends here
 * ═══════════════════════════════════════════════════════════════════════════ */
