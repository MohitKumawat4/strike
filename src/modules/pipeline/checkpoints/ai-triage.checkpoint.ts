/* ══════ The Checkpoint feature starts here ══════ */
/* ═══════════════════════════════════════════════════════════════════════════
 * AI Triage Checkpoint — Classifies emails by category, importance, and urgency
 *
 * Uses the Google Gemini or OpenAI structured JSON client to assign
 * category, importance score (0.00–1.00), confidence, and reasoning.
 * Includes inline summarization when the model provides it.
 * Bypassed when use_ai is disabled or the email is older than 24 hours.
 * ═══════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IPipelineCheckpoint,
  PipelineContext,
  CheckpointExecutionResult,
} from "../pipeline.types";
import type { ExecutionLayer } from "@/common/logging/layer-logger.types";

export class AiTriageCheckpoint implements IPipelineCheckpoint {
  readonly id = "triage" as const;
  readonly name = "AI Triage & Priority Scoring";
  readonly logLayer: ExecutionLayer = "triage";

  /**
   * Bypassed when:
   * - AI is disabled in pipeline controls (use_ai = false)
   * - The email is older than 24 hours (historical emails skip AI)
   */
  canExecute(context: PipelineContext): boolean {
    if (!context.controls.use_ai) return false;

    // Skip AI triage for historical emails older than 24 hours
    const emailAge = Date.now() - Date.parse(context.message.received_at);
    if (emailAge > 86_400_000) return false;

    return true;
  }

  /**
   * Invokes the AI triage prompt and enriches the pipeline context
   * with triage results and optional inline summary.
   */
  async execute(
    context: PipelineContext,
    _db: SupabaseClient,
  ): Promise<CheckpointExecutionResult> {
    const { message, settings } = context;

    // Dynamic import to avoid loading AI module at startup
    const { triageEmailWithAi } = await import("@/modules/ai/triage");

    const result = await triageEmailWithAi({
      subject: message.subject,
      sender: message.sender?.raw || "Unknown",
      recipient: message.recipients?.[0]?.raw,
      snippet: message.snippet,
      bodyText: message.body_text,
      userCustomRules: settings?.custom_priority_rules,
    });

    // Build the AI result payload
    const ai = {
      ...result.result,
      model: result.model,
      prompt_version: result.promptVersion,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };

    // Determine if the email is important enough for further processing
    const importanceThreshold = Number(settings?.importance_threshold ?? 0.7);
    const isImportant =
      result.result.category === "important" ||
      result.result.importance >= importanceThreshold;

    // Check if the triage response included an inline summary
    const hasSummary = Boolean(result.result.summary_text);
    const summary = hasSummary
      ? {
          summary_text: result.result.summary_text,
          extracted_items: result.result.extracted_items || [],
          model: result.model,
          prompt_version: result.promptVersion,
        }
      : undefined;

    // Determine the message status based on whether a summary was included
    const messageStatus = hasSummary ? "SUMMARY_READY" : "TRIAGED";

    return {
      success: true,
      messageStatus,
      ai,
      summary,
      // If the email isn't important, the pipeline can skip remaining checkpoints
      metadata: isImportant ? undefined : { reason: "not_important_enough" },
    };
  }
}
/* ══════ The Checkpoint feature ends here ══════ */
