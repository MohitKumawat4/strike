/* ══════ The Checkpoint feature starts here ══════ */
/* ═══════════════════════════════════════════════════════════════════════════
 * Filtration Checkpoint — Pre-filters noise, spam, and unwanted emails
 *
 * Evaluates sender patterns, subject keywords, and label-based rules
 * to discard emails that don't warrant AI processing or delivery.
 * Can be bypassed if the user has disabled filter_unwanted in pipeline controls.
 * ═══════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IPipelineCheckpoint,
  PipelineContext,
  CheckpointExecutionResult,
} from "../pipeline.types";
import type { ExecutionLayer } from "@/common/logging/layer-logger.types";
import { preFilterEmail } from "@/modules/email/rules/pre-filter";

export class FiltrationCheckpoint implements IPipelineCheckpoint {
  readonly id = "filtration" as const;
  readonly name = "Pre-Filter & Noise Reduction";
  readonly logLayer: ExecutionLayer = "filtration";

  /**
   * Returns false (bypassed) when the user has toggled off filter_unwanted.
   * This causes the orchestrator to skip filtration and forward
   * the payload directly to the next active checkpoint.
   */
  canExecute(context: PipelineContext): boolean {
    return context.controls.filter_unwanted;
  }

  /**
   * Runs the deterministic pre-filter rules against the email.
   * If the email is discarded, messageStatus is set to "DISCARDED"
   * and the pipeline terminates (no further checkpoints run).
   */
  async execute(
    context: PipelineContext,
    _db: SupabaseClient,
  ): Promise<CheckpointExecutionResult> {
    const { message, settings } = context;

    // Run the deterministic pre-filter logic
    const decision = preFilterEmail({
      subject: message.subject,
      sender: message.sender?.raw,
      labels: message.labels,
      ignoreKeywords: settings?.custom_priority_rules?.ignoreKeywords,
    });

    // Email discarded — pipeline stops here
    if (!decision.shouldTriage) {
      return {
        success: true,
        messageStatus: "DISCARDED",
        metadata: { reason: decision.reason },
      };
    }

    // Email passed filtration — continue to next checkpoint
    return {
      success: true,
      messageStatus: "PRE_FILTERED",
    };
  }
}
/* ══════ The Checkpoint feature ends here ══════ */
