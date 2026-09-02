import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executeIngestionStage,
  executePreFilterStage,
  executeTriageStage,
  executeSummaryStage,
  executeDeliveryStage,
  type EmailMessageRecord,
  type StageResult,
} from "./stages";

export type ProcessingJobRecord = {
  id: string;
  message_id: string;
  stage: "ingestion" | "pre_filter" | "triage" | "summary" | "delivery";
  status: "pending" | "running" | "completed" | "failed" | "retrying";
  attempts: number;
  next_retry_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
};

const MAX_ATTEMPTS = 3;

/**
 * Claims pending or due retry jobs from the processing_jobs table.
 */
export async function claimNextJobs(
  supabase: SupabaseClient,
  limit = 10
): Promise<ProcessingJobRecord[]> {
  const now = new Date().toISOString();

  // Find candidate jobs ready for processing
  const { data: candidateJobs, error } = await supabase
    .from("processing_jobs")
    .select("*")
    .in("status", ["pending", "retrying"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !candidateJobs || candidateJobs.length === 0) {
    return [];
  }

  const claimedJobs: ProcessingJobRecord[] = [];

  // Atomically mark claimed jobs as running
  for (const job of candidateJobs) {
    const { data: claimed, error: claimError } = await supabase
      .from("processing_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .in("status", ["pending", "retrying"])
      .select("*")
      .maybeSingle();

    if (!claimError && claimed) {
      claimedJobs.push(claimed as ProcessingJobRecord);
    }
  }

  return claimedJobs;
}

/**
 * Processes a single job through its assigned stage.
 */
export async function processSingleJob(
  supabase: SupabaseClient,
  job: ProcessingJobRecord
): Promise<{ success: boolean; stage: string; nextStage?: string | null; error?: string }> {
  try {
    // 1. Fetch the corresponding email message
    const { data: message, error: msgError } = await supabase
      .from("email_messages")
      .select("*")
      .eq("id", job.message_id)
      .single();

    if (msgError || !message) {
      throw new Error(`Email message ${job.message_id} not found.`);
    }

    const messageRecord = message as EmailMessageRecord;

    // 2. Dispatch to the appropriate stage handler
    let stageResult: StageResult;

    switch (job.stage) {
      case "ingestion":
        stageResult = await executeIngestionStage(supabase, messageRecord);
        break;
      case "pre_filter":
        stageResult = await executePreFilterStage(supabase, messageRecord);
        break;
      case "triage":
        stageResult = await executeTriageStage(supabase, messageRecord);
        break;
      case "summary":
        stageResult = await executeSummaryStage(supabase, messageRecord);
        break;
      case "delivery":
        stageResult = await executeDeliveryStage(supabase, messageRecord);
        break;
      default:
        throw new Error(`Unknown processing stage: ${(job as { stage: string }).stage}`);
    }

    if (!stageResult.success) {
      throw new Error(stageResult.error || "Stage execution failed.");
    }

    // 3. Mark current job as completed
    await supabase
      .from("processing_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      })
      .eq("id", job.id);

    // 4. If a next stage is specified, queue it as pending
    if (stageResult.nextStage) {
      await supabase.from("processing_jobs").upsert(
        {
          message_id: job.message_id,
          stage: stageResult.nextStage,
          status: "pending",
          attempts: 0,
          started_at: new Date().toISOString(),
        },
        {
          onConflict: "message_id,stage",
        }
      );
    }

    return {
      success: true,
      stage: job.stage,
      nextStage: stageResult.nextStage,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Error executing job ${job.id} (stage: ${job.stage}):`, errorMessage);

    // Handle failure with retry backoff or dead-letter state
    await handleJobFailure(supabase, job, errorMessage);

    return {
      success: false,
      stage: job.stage,
      error: errorMessage,
    };
  }
}

/**
 * Handles job failures with exponential backoff and dead-letter logging.
 */
async function handleJobFailure(
  supabase: SupabaseClient,
  job: ProcessingJobRecord,
  errorMessage: string
) {
  const nextAttempt = (job.attempts || 0) + 1;
  const isFinalFailure = nextAttempt >= MAX_ATTEMPTS;

  if (isFinalFailure) {
    // Transition to permanently FAILED (Dead-letter)
    await supabase
      .from("processing_jobs")
      .update({
        status: "failed",
        attempts: nextAttempt,
        error_code: "MAX_RETRIES_EXCEEDED",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // Update message processing status to FAILED
    await supabase
      .from("email_messages")
      .update({ processing_status: "FAILED" })
      .eq("id", job.message_id);

    // Log diagnostic system event
    await logSystemEvent(supabase, {
      event_type: "processing_job_failed",
      severity: "error",
      payload: {
        job_id: job.id,
        message_id: job.message_id,
        stage: job.stage,
        attempts: nextAttempt,
        error: errorMessage,
      },
    });
  } else {
    // Compute exponential backoff delay: 2^attempt * 15 seconds (max 5 minutes)
    const delaySeconds = Math.min(300, Math.pow(2, nextAttempt) * 15);
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

    await supabase
      .from("processing_jobs")
      .update({
        status: "retrying",
        attempts: nextAttempt,
        next_retry_at: nextRetryAt,
        error_code: "STAGE_ERROR_RETRYING",
        error_message: errorMessage,
      })
      .eq("id", job.id);

    await logSystemEvent(supabase, {
      event_type: "processing_job_retry_scheduled",
      severity: "warning",
      payload: {
        job_id: job.id,
        message_id: job.message_id,
        stage: job.stage,
        next_attempt: nextAttempt,
        next_retry_at: nextRetryAt,
      },
    });
  }
}

/**
 * Records an entry in the system_events audit log.
 */
export async function logSystemEvent(
  supabase: SupabaseClient,
  event: {
    event_type: string;
    severity: "info" | "warning" | "error" | "critical";
    payload: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("system_events").insert({
      event_type: event.event_type,
      severity: event.severity,
      payload: event.payload,
    });
  } catch (logErr) {
    console.error("Failed to write system event:", logErr);
  }
}

/**
 * Runs a batch of pending jobs, draining successive pipeline stages (up to maxPasses).
 */
export async function runProcessingBatch(
  supabase: SupabaseClient,
  maxBatchSize = 10,
  maxPasses = 5
): Promise<{ processed: number; succeeded: number; failed: number }> {
  let totalProcessed = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  for (let pass = 0; pass < maxPasses; pass++) {
    const claimedJobs = await claimNextJobs(supabase, maxBatchSize);
    if (claimedJobs.length === 0) break;

    const results = await Promise.allSettled(
      claimedJobs.map((job) => processSingleJob(supabase, job))
    );

    for (const result of results) {
      totalProcessed++;
      if (result.status === "fulfilled" && result.value.success) {
        totalSucceeded++;
      } else {
        totalFailed++;
      }
    }
  }

  return {
    processed: totalProcessed,
    succeeded: totalSucceeded,
    failed: totalFailed,
  };
}
