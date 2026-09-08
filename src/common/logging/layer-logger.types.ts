import type { SupabaseClient } from "@supabase/supabase-js";

export type ExecutionLayer =
  | "ingestion"
  | "filtration"
  | "triage"
  | "summarization"
  | "delivery"
  | "system";

export type ErrorSeverity = "critical" | "error" | "warning" | "info";

export interface LayerErrorRecord {
  id: string;
  user_id: string | null;
  layer: ExecutionLayer;
  severity: ErrorSeverity;
  error_code: string;
  error_message: string;
  stack_trace: string | null;
  technical_details: Record<string, unknown>;
  context: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface LogLayerErrorParams {
  layer: ExecutionLayer;
  severity?: ErrorSeverity;
  errorCode: string;
  errorMessage?: string;
  error?: unknown;
  userId?: string | null;
  accountId?: string | null;
  messageId?: string | null;
  jobId?: string | null;
  technicalDetails?: Record<string, unknown>;
  context?: Record<string, unknown>;
  supabaseClient?: SupabaseClient;
}

/**
 * Maps layer identifiers to human-readable developer titles.
 */
export const LAYER_TITLES: Record<ExecutionLayer, string> = {
  ingestion: "Layer 1: Ingestion & Retrieval",
  filtration: "Layer 2: Pre-Filter & Noise Reduction",
  triage: "Layer 3: AI Triage & Priority Scoring",
  summarization: "Layer 4: AI Summarization & Action Items",
  delivery: "Layer 5: Outbound Delivery System",
  system: "Layer 6: System & Infrastructure",
};
