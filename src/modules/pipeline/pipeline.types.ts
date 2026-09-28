/* ═══════════════════════════════════════════════════════════════════════════
 * Pipeline Types — Core abstractions for the Checkpoint / Layer Pipeline
 *
 * These interfaces define the contract that every checkpoint must implement,
 * the shared context carried through the pipeline, and the result structure
 * returned from each checkpoint execution.
 * ═══════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PipelineControls } from "@/common/pipeline-controls";
import type { ExecutionLayer } from "@/common/logging/layer-logger.types";

/* ── Checkpoint stage identifiers ── */
export type CheckpointStage = "filtration" | "triage" | "summarization" | "delivery";

/* ── Result returned by each checkpoint's execute() method ── */
export interface CheckpointExecutionResult {
  /** Whether the checkpoint executed successfully */
  success: boolean;
  /** Updated processing status for the email message (e.g. "PRE_FILTERED", "TRIAGED") */
  messageStatus: string;
  /** Optional error description if the checkpoint failed */
  error?: string;
  /** Arbitrary metadata (e.g. filter reason) */
  metadata?: Record<string, unknown>;
  /** AI triage output to persist */
  ai?: Record<string, unknown>;
  /** AI summary output to persist */
  summary?: Record<string, unknown>;
  /** Outbound delivery payload for WhatsApp/notifications */
  delivery?: { destination: string; payload: Record<string, unknown> };
}

/* ── Bypass log entry recorded when a checkpoint is skipped or fails gracefully ── */
export interface BypassLogEntry {
  /** The ID of the checkpoint that was bypassed */
  checkpointId: CheckpointStage;
  /** Human-readable explanation of why it was skipped */
  reason: string;
  /** info = intentionally disabled; warning = recovered from a failure */
  severity: "info" | "warning";
  /** ISO timestamp of when the bypass occurred */
  timestamp: string;
}

/* ── Shared context carried through the entire pipeline execution ── */
export interface PipelineContext {
  /** The email message record being processed */
  readonly message: EmailMessageRecord;
  /** User settings (nullable if not found) */
  readonly settings: UserSettingsRecord | null;
  /** Derived pipeline toggle switches (receive_emails, filter_unwanted, use_ai, send_whatsapp) */
  readonly controls: PipelineControls;

  /* -- Layer outputs populated as checkpoints execute -- */
  /** Current processing status of the message */
  status: string;
  /** AI triage results (populated by AiTriageCheckpoint) */
  aiTriageResult?: Record<string, unknown>;
  /** AI summary results (populated by AiSummaryCheckpoint) */
  aiSummaryResult?: Record<string, unknown>;
  /** Delivery payload (populated by DeliveryCheckpoint) */
  deliveryPayload?: { destination: string; payload: Record<string, unknown> };

  /* -- Execution telemetry -- */
  /** Log of all checkpoints that were bypassed during this pipeline run */
  bypassLog: BypassLogEntry[];
}

/* ── The contract every pipeline checkpoint must implement ── */
export interface IPipelineCheckpoint {
  /** Unique stage identifier for this checkpoint */
  readonly id: CheckpointStage;
  /** Human-readable name displayed in logs and telemetry */
  readonly name: string;
  /** Corresponding layer for the error logger */
  readonly logLayer: ExecutionLayer;

  /**
   * Evaluates whether this checkpoint should execute based on
   * user settings, pipeline controls, and the current context.
   * Returns false to signal the orchestrator to skip (bypass) this checkpoint.
   */
  canExecute(context: PipelineContext): boolean;

  /**
   * Executes the checkpoint's core logic and returns a result.
   * The orchestrator enriches the PipelineContext with the result
   * before advancing to the next checkpoint.
   */
  execute(context: PipelineContext, db: SupabaseClient): Promise<CheckpointExecutionResult>;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Shared record types used across checkpoints
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Shape of a row from the email_messages table */
export type EmailMessageRecord = {
  id: string;
  user_id: string;
  account_id: string;
  provider_message_id: string;
  thread_id?: string | null;
  sender: { raw?: string };
  recipients: { raw?: string }[];
  subject: string;
  snippet?: string;
  body_text?: string;
  body_html?: string;
  received_at: string;
  has_attachments: boolean;
  labels?: string[];
  processing_status: string;
};

/** Shape of a row from the user_settings table */
export type UserSettingsRecord = {
  user_id: string;
  importance_threshold?: number;
  custom_priority_rules?: Record<string, unknown> & { ignoreKeywords?: string[] };
  notification_preferences?: Record<string, unknown>;
  whatsapp_destination?: string;
  [key: string]: unknown;
};
