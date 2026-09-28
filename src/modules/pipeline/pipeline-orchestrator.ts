/* ═══════════════════════════════════════════════════════════════════════════
 * Pipeline Orchestrator — Chain-of-Responsibility Checkpoint Runner
 *
 * Maintains an ordered registry of checkpoints and guarantees forward flow.
 * When a checkpoint is disabled (canExecute returns false) or throws an error,
 * the orchestrator logs a bypass telemetry entry and advances the payload
 * to the next active checkpoint in the chain.
 *
 * Design principles:
 * - Any checkpoint can be toggled off without breaking the pipeline
 * - A missing or failed checkpoint never blocks downstream execution
 * - All bypass events are recorded for the administrative error log page
 * ═══════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logLayerError } from "@/common/logging/layer-logger";
import { getPipelineControls } from "@/common/pipeline-controls";
import type {
  IPipelineCheckpoint,
  PipelineContext,
  CheckpointExecutionResult,
  EmailMessageRecord,
  UserSettingsRecord,
  BypassLogEntry,
} from "./pipeline.types";

// Import all checkpoint implementations
import { FiltrationCheckpoint } from "./checkpoints/filtration.checkpoint";
import { AiTriageCheckpoint } from "./checkpoints/ai-triage.checkpoint";
import { AiSummaryCheckpoint } from "./checkpoints/ai-summary.checkpoint";
import { DeliveryCheckpoint } from "./checkpoints/delivery.checkpoint";

/* ── Checkpoint registry (order matters — this defines the pipeline flow) ── */
const CHECKPOINT_REGISTRY: IPipelineCheckpoint[] = [
  new FiltrationCheckpoint(),
  new AiTriageCheckpoint(),
  new AiSummaryCheckpoint(),
  new DeliveryCheckpoint(),
];

/* ═══════════════════════════════════════════════════════════════════════════
 * The Pipeline Orchestrator starts here
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Builds the initial PipelineContext from a raw email message record
 * and the user's settings fetched from the database.
 */
function buildContext(
  message: EmailMessageRecord,
  settings: UserSettingsRecord | null,
): PipelineContext {
  return {
    message,
    settings,
    controls: getPipelineControls(settings?.notification_preferences),
    status: message.processing_status || "RECEIVED",
    bypassLog: [],
  };
}

/**
 * Records a bypass event both in-memory (on the context) and persists
 * it to the error_logs table via the centralized layer logger.
 */
async function recordBypass(
  context: PipelineContext,
  checkpoint: IPipelineCheckpoint,
  reason: string,
  severity: "info" | "warning",
  db: SupabaseClient,
): Promise<void> {
  // 1. Add to the in-memory bypass log
  const entry: BypassLogEntry = {
    checkpointId: checkpoint.id,
    reason,
    severity,
    timestamp: new Date().toISOString(),
  };
  context.bypassLog.push(entry);

  // 2. Persist to error_logs table via the centralized logger
  const errorCode = severity === "info"
    ? "CHECKPOINT_BYPASSED"
    : "STAGE_RECOVERED_AND_BYPASSED";

  await logLayerError({
    layer: checkpoint.logLayer,
    severity,
    errorCode,
    errorMessage: `${checkpoint.name} ${severity === "info" ? "skipped" : "failed and bypassed"}: ${reason}; payload forwarded to next active checkpoint.`,
    userId: context.message.user_id,
    messageId: context.message.id,
    technicalDetails: {
      checkpointId: checkpoint.id,
      bypassReason: reason,
      currentStatus: context.status,
    },
    supabaseClient: db,
  });
}

/**
 * Applies the result of a checkpoint execution to the shared pipeline context.
 * Enriches the context with AI results, summaries, and delivery payloads
 * as each checkpoint produces them.
 */
function applyResultToContext(
  context: PipelineContext,
  result: CheckpointExecutionResult,
): void {
  // Update the processing status
  context.status = result.messageStatus;

  // Capture AI triage output
  if (result.ai) {
    context.aiTriageResult = result.ai;
  }

  // Capture AI summary output
  if (result.summary) {
    context.aiSummaryResult = result.summary;
  }

  // Capture delivery payload
  if (result.delivery) {
    context.deliveryPayload = result.delivery;
  }
}

/* ── Aggregated result returned from a complete pipeline run ── */
export interface PipelineRunResult {
  /** Whether the pipeline completed without fatal errors */
  success: boolean;
  /** Final processing status of the email */
  messageStatus: string;
  /** Error message if the pipeline terminated due to a fatal error */
  error?: string;
  /** AI triage output (if produced) */
  ai?: Record<string, unknown>;
  /** AI summary output (if produced) */
  summary?: Record<string, unknown>;
  /** Outbound delivery payload (if produced) */
  delivery?: { destination: string; payload: Record<string, unknown> };
  /** Metadata from the last executed checkpoint */
  metadata?: Record<string, unknown>;
  /** Retained for backwards compatibility with processSingleJob */
  nextStage?: string | null;
  /** Full log of all bypassed checkpoints during this run */
  bypassLog: BypassLogEntry[];
}

/**
 * Runs the full pipeline: iterates through all registered checkpoints
 * in order, executing each that is enabled, bypassing those that aren't,
 * and recovering gracefully from checkpoint failures.
 *
 * @param db - Supabase client for database operations
 * @param message - The email message record to process
 * @param settings - User settings (nullable)
 * @returns Aggregated pipeline result
 */
export async function runPipeline(
  db: SupabaseClient,
  message: EmailMessageRecord,
  settings: UserSettingsRecord | null,
): Promise<PipelineRunResult> {
  const context = buildContext(message, settings);

  for (const checkpoint of CHECKPOINT_REGISTRY) {
    /* ── Check if checkpoint should execute ── */
    if (!checkpoint.canExecute(context)) {
      // Intentionally bypassed — log as info-level telemetry
      await recordBypass(
        context,
        checkpoint,
        `${checkpoint.name} disabled by pipeline controls or conditions not met`,
        "info",
        db,
      );
      continue;
    }

    /* ── Execute the checkpoint ── */
    try {
      const result = await checkpoint.execute(context, db);

      if (!result.success) {
        // Checkpoint returned a failure result — bypass with warning
        await recordBypass(
          context,
          checkpoint,
          result.error || `${checkpoint.name} returned failure`,
          "warning",
          db,
        );
        continue;
      }

      // Apply successful result to context
      applyResultToContext(context, result);

      // Record AI telemetry if token usage is present (Phase 3)
      if (result.ai?.inputTokens !== undefined) {
        const { recordAiTelemetry } = await import("@/modules/ai/token-metrics");
        await recordAiTelemetry(db, {
          userId: context.message.user_id,
          messageId: context.message.id,
          model: (result.ai.model as string) || "unknown",
          task: "triage",
          inputTokens: (result.ai.inputTokens as number) || 0,
          outputTokens: (result.ai.outputTokens as number) || 0,
        });
      }

      if (result.summary?.inputTokens !== undefined) {
        const { recordAiTelemetry } = await import("@/modules/ai/token-metrics");
        await recordAiTelemetry(db, {
          userId: context.message.user_id,
          messageId: context.message.id,
          model: (result.summary.model as string) || "unknown",
          task: "summarization",
          inputTokens: (result.summary.inputTokens as number) || 0,
          outputTokens: (result.summary.outputTokens as number) || 0,
        });
      }

      // Check for terminal conditions:
      // - DISCARDED: email was filtered out, pipeline stops
      // - not_important_enough: email doesn't warrant further processing
      if (result.messageStatus === "DISCARDED") {
        await recordBypass(
          context,
          checkpoint,
          `Dropped by heuristic rules: ${result.metadata?.reason || "Unknown reason"}`,
          "info",
          db
        );
        return {
          success: true,
          messageStatus: context.status,
          metadata: result.metadata,
          nextStage: null,
          bypassLog: context.bypassLog,
        };
      }

      // If triage determined the email is not important enough, skip remaining
      if (result.metadata?.reason === "not_important_enough") {
        return {
          success: true,
          messageStatus: context.status,
          ai: context.aiTriageResult,
          summary: context.aiSummaryResult,
          metadata: result.metadata,
          nextStage: null,
          bypassLog: context.bypassLog,
        };
      }
    } catch (err) {
      // Checkpoint threw an exception — recover gracefully
      const errorMessage = err instanceof Error ? err.message : String(err);
      await recordBypass(
        context,
        checkpoint,
        `Runtime error: ${errorMessage}`,
        "warning",
        db,
      );
      // Continue to next checkpoint instead of terminating the pipeline
      continue;
    }
  }

  /* ── Pipeline completed — return aggregated result ── */
  return {
    success: true,
    messageStatus: context.status,
    ai: context.aiTriageResult,
    summary: context.aiSummaryResult,
    delivery: context.deliveryPayload,
    nextStage: null,
    bypassLog: context.bypassLog,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * The Pipeline Orchestrator ends here
 * ═══════════════════════════════════════════════════════════════════════════ */
