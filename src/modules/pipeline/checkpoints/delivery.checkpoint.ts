/* ══════ The Checkpoint feature starts here ══════ */
/* ═══════════════════════════════════════════════════════════════════════════
 * Delivery Checkpoint — Sends notifications for important emails
 *
 * Prepares the outbound delivery payload for WhatsApp or other
 * notification channels. Checks destination configuration, delivery
 * windows, and compiles the message from AI summary or raw preview.
 * Bypassed when send_whatsapp is disabled or no destination is configured.
 * ═══════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IPipelineCheckpoint,
  PipelineContext,
  CheckpointExecutionResult,
} from "../pipeline.types";
import type { ExecutionLayer } from "@/common/logging/layer-logger.types";
import { afterResume } from "@/common/pipeline-controls";
import { formatEmailPreview } from "@/modules/email/email-preview";

export class DeliveryCheckpoint implements IPipelineCheckpoint {
  readonly id = "delivery" as const;
  readonly name = "Outbound Delivery System";
  readonly logLayer: ExecutionLayer = "delivery";

  /**
   * Bypassed when:
   * - WhatsApp delivery is disabled in pipeline controls
   * - User has explicitly disabled notify_on_important
   * - No WhatsApp destination phone number is configured
   */
  canExecute(context: PipelineContext): boolean {
    const { controls, settings } = context;
    const prefs = settings?.notification_preferences || {};

    // WhatsApp toggled off
    if (!controls.send_whatsapp) return false;

    // User opted out of important notifications
    if ((prefs as Record<string, unknown>).notify_on_important === false) return false;

    // No destination configured
    if (!settings?.whatsapp_destination) return false;

    return true;
  }

  /**
   * Compiles the delivery payload from AI summary or raw email preview,
   * validates the delivery window, and returns the outbound payload.
   */
  async execute(
    context: PipelineContext,
    db: SupabaseClient,
  ): Promise<CheckpointExecutionResult> {
    const { message, settings } = context;
    const prefs = settings?.notification_preferences || {};

    // Validate delivery time window
    const age = Date.now() - Date.parse(message.received_at);
    if (
      !Number.isFinite(age) ||
      age < 0 ||
      age > 86_400_000 ||
      !afterResume(message.received_at, (prefs as Record<string, unknown>).deliver_after)
    ) {
      return {
        success: true,
        messageStatus: message.processing_status,
        metadata: { reason: "outside_delivery_window" },
      };
    }

    // Fetch the persisted summary and AI triage from the database
    const { data: summary, error: summaryErr } = await db
      .from("summaries")
      .select("summary_text,extracted_items")
      .eq("message_id", message.id)
      .maybeSingle();
    if (summaryErr) throw summaryErr;

    const { data: ai, error: aiErr } = await db
      .from("ai_results")
      .select("category,importance")
      .eq("message_id", message.id)
      .maybeSingle();
    if (aiErr) throw aiErr;

    // Determine whether to use AI summary text or raw email preview
    const useRawPreview = !context.controls.use_ai || !summary?.summary_text;
    const items = summary?.extracted_items;

    return {
      success: true,
      messageStatus: "DELIVERY_PENDING",
      delivery: {
        destination: settings!.whatsapp_destination!,
        payload: {
          recipientPhone: settings!.whatsapp_destination,
          sender: message.sender?.raw,
          subject: message.subject,
          summaryText: useRawPreview
            ? formatEmailPreview(message)
            : summary.summary_text,
          rawPreviewText: useRawPreview
            ? formatEmailPreview(message)
            : undefined,
          category: ai?.category,
          importance: ai?.importance,
          actionItems: Array.isArray(items)
            ? items
            : (items as Record<string, unknown>)?.action_items || [],
          emailMessageId: message.id,
          userId: message.user_id,
          gmailLabels: message.labels,
        },
      },
    };
  }
}
/* ══════ The Checkpoint feature ends here ══════ */
