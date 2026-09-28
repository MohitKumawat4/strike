/* ══════ The Checkpoint feature starts here ══════ */
/* ═══════════════════════════════════════════════════════════════════════════
 * AI Summary Checkpoint — Generates executive summaries and action items
 *
 * Invokes the AI summarization prompt to produce a concise summary,
 * extracted action items, deadlines, and assignees for important emails.
 * Bypassed when use_ai is disabled or if the triage stage already
 * produced an inline summary.
 * ═══════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IPipelineCheckpoint,
  PipelineContext,
  CheckpointExecutionResult,
} from "../pipeline.types";
import type { ExecutionLayer } from "@/common/logging/layer-logger.types";

export class AiSummaryCheckpoint implements IPipelineCheckpoint {
  readonly id = "summarization" as const;
  readonly name = "AI Summarization & Action Items";
  readonly logLayer: ExecutionLayer = "summarization";

  /**
   * Bypassed when:
   * - AI is disabled in pipeline controls
   * - The triage checkpoint already produced an inline summary (status = SUMMARY_READY)
   */
  canExecute(context: PipelineContext): boolean {
    if (!context.controls.use_ai) return false;

    // If triage already produced a summary, skip the separate summarization step
    if (context.aiSummaryResult || context.status === "SUMMARY_READY") return false;

    return true;
  }

  /**
   * Invokes the AI summarization prompt and enriches the pipeline context
   * with the summary text and extracted action items.
   */
  async execute(
    context: PipelineContext,
    _db: SupabaseClient,
  ): Promise<CheckpointExecutionResult> {
    const { message } = context;

    // Dynamic import to avoid loading AI module at startup
    const { summarizeEmailWithAi } = await import("@/modules/ai/summary");

    const result = await summarizeEmailWithAi({
      subject: message.subject,
      sender: message.sender?.raw || "Unknown",
      recipient: message.recipients?.[0]?.raw,
      snippet: message.snippet,
      bodyText: message.body_text,
    });

    return {
      success: true,
      messageStatus: "SUMMARY_READY",
      summary: {
        ...result.result,
        model: result.model,
        prompt_version: result.promptVersion,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    };
  }
}
/* ══════ The Checkpoint feature ends here ══════ */
