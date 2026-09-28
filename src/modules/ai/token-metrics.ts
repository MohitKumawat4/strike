/* ═══════════════════════════════════════════════════════════════════════════
 * AI Token Metrics & Financial Telemetry
 *
 * Calculates the financial cost of AI invocations based on token usage.
 * Supports dual-currency reporting (USD and INR) for dashboard analytics.
 * ═══════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

// Constants for cost calculation
export const USD_TO_INR_EXCHANGE_RATE = 87;

// Gemini 1.5/2.0 Flash Pricing (as of 2026)
export const PRICING_USD_PER_1M_INPUT_TOKENS = 0.075;
export const PRICING_USD_PER_1M_OUTPUT_TOKENS = 0.30;

export interface TokenCost {
  costUsd: number;
  costInr: number;
}

/**
 * Calculates the financial cost of an AI invocation based on input/output tokens.
 */
export function calculateTokenCost(
  inputTokens: number = 0,
  outputTokens: number = 0,
): TokenCost {
  const inputCostUsd = (inputTokens / 1_000_000) * PRICING_USD_PER_1M_INPUT_TOKENS;
  const outputCostUsd = (outputTokens / 1_000_000) * PRICING_USD_PER_1M_OUTPUT_TOKENS;
  
  const totalCostUsd = inputCostUsd + outputCostUsd;
  
  return {
    costUsd: Number(totalCostUsd.toFixed(6)),
    costInr: Number((totalCostUsd * USD_TO_INR_EXCHANGE_RATE).toFixed(4)),
  };
}

/**
 * Persists an AI telemetry record to the `ai_telemetry` table.
 */
export async function recordAiTelemetry(
  db: SupabaseClient,
  params: {
    userId: string;
    messageId: string;
    jobId?: string;
    model: string;
    task: "triage" | "summarization";
    inputTokens: number;
    outputTokens: number;
  }
): Promise<void> {
  const { costUsd, costInr } = calculateTokenCost(params.inputTokens, params.outputTokens);

  const { error } = await db.from("ai_telemetry").insert({
    user_id: params.userId,
    message_id: params.messageId,
    job_id: params.jobId,
    model: params.model,
    task: params.task,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_usd: costUsd,
    cost_inr: costInr,
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("Failed to record AI telemetry:", error);
  }
}
