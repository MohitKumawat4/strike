import type { SupabaseClient } from "@supabase/supabase-js";
import { logLayerError } from "@/common/logging/layer-logger";
import { preFilterEmail } from "@/modules/email/rules/pre-filter";

export type StageResult = {
  success: boolean;
  nextStage?: "pre_filter" | "triage" | "summary" | "delivery" | null;
  messageStatus?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type EmailMessageRecord = {
  id: string;
  account_id: string;
  user_id: string;
  provider_message_id: string;
  thread_id?: string | null;
  sender: { raw?: string };
  recipients: Array<{ raw?: string }>;
  subject: string;
  snippet?: string;
  body_text?: string;
  body_html?: string;
  received_at: string;
  has_attachments: boolean;
  labels?: string[];
  processing_status: string;
};

/**
 * 1. Ingestion Stage Handler
 * Validates the email message payload and advances to pre-filtering.
 */
export async function executeIngestionStage(
  supabase: SupabaseClient,
  message: EmailMessageRecord
): Promise<StageResult> {
  // Validate that the message has essential data
  if (!message.subject && !message.snippet && !message.body_text) {
    const errorMsg = "Message payload is empty (missing subject, snippet, and body).";
    await logLayerError({
      layer: "ingestion",
      severity: "error",
      errorCode: "EMPTY_PAYLOAD",
      errorMessage: errorMsg,
      userId: message.user_id,
      accountId: message.account_id,
      messageId: message.id,
      technicalDetails: { messageRecord: message },
      supabaseClient: supabase,
    });

    return {
      success: false,
      error: errorMsg,
    };
  }

  // Update email message status to PRE_FILTERED
  await supabase
    .from("email_messages")
    .update({ processing_status: "PRE_FILTERED" })
    .eq("id", message.id);

  return {
    success: true,
    nextStage: "pre_filter",
    messageStatus: "PRE_FILTERED",
  };
}

/**
 * 2. Pre-Filter Stage Handler
 * Runs deterministic heuristics (bounce detection, automated system failure notices).
 * If email is deemed true noise (auto-reply, mailer-daemon), marks as DISCARDED;
 * otherwise advances to AI triage (including transactional, billing, security & no-reply notices).
 */
export async function executePreFilterStage(
  supabase: SupabaseClient,
  message: EmailMessageRecord
): Promise<StageResult> {
  try {
    // 1. Check if user has Ingestion-Only mode enabled
    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("notification_preferences, custom_priority_rules")
      .eq("user_id", message.user_id)
      .maybeSingle();

    const isProcessingDisabled = Boolean(
      (userSettings?.notification_preferences as Record<string, unknown>)?.disable_processing
    );

    if (isProcessingDisabled) {
      // Ingestion-only mode: Halt processing pipeline immediately after ingestion
      return {
        success: true,
        nextStage: null,
        messageStatus: "RECEIVED",
      };
    }

    const customRules = userSettings?.custom_priority_rules as
      | { instructions?: string; vipSenders?: string[]; ignoreKeywords?: string[] }
      | undefined;

    // 2. Deterministic filtration with native Gmail labels & ignore keywords (0 AI tokens)
    const filterDecision = preFilterEmail({
      subject: message.subject,
      sender: message.sender?.raw,
      labels: message.labels,
      ignoreKeywords: customRules?.ignoreKeywords,
    });

    if (!filterDecision.shouldTriage) {
      await supabase
        .from("email_messages")
        .update({ processing_status: "DISCARDED" })
        .eq("id", message.id);

      return {
        success: true,
        nextStage: null,
        messageStatus: "DISCARDED",
        metadata: { reason: filterDecision.reason },
      };
    }

    const sender = (message.sender?.raw || "").toLowerCase();
    const subject = (message.subject || "").toLowerCase();

    // True machine-generated bounce and automated out-of-office autoreplies
    const isAutomatedNoise =
      sender.includes("mailer-daemon") ||
      sender.includes("postmaster@") ||
      subject.includes("automatic reply:") ||
      subject.includes("out of office:") ||
      subject.includes("undeliverable:");

    if (isAutomatedNoise) {
      await supabase
        .from("email_messages")
        .update({ processing_status: "DISCARDED" })
        .eq("id", message.id);

      return {
        success: true,
        nextStage: null, // End of pipeline for discarded noise
        messageStatus: "DISCARDED",
        metadata: { reason: "automated_noise_prefilter" },
      };
    }

    // Passed pre-filter -> Advance to triage
    await supabase
      .from("email_messages")
      .update({ processing_status: "TRIAGED" })
      .eq("id", message.id);

    return {
      success: true,
      nextStage: "triage",
      messageStatus: "TRIAGED",
    };
  } catch (filterErr) {
    await logLayerError({
      layer: "filtration",
      severity: "error",
      errorCode: "PRE_FILTER_FAILED",
      errorMessage: "Deterministic pre-filtering failed to evaluate message.",
      error: filterErr,
      userId: message.user_id,
      accountId: message.account_id,
      messageId: message.id,
      supabaseClient: supabase,
    });

    return {
      success: false,
      error: filterErr instanceof Error ? filterErr.message : "Pre-filter stage error",
    };
  }
}

/**
 * 3. Triage Stage Handler (AI Classification & Scoring)
 * Evaluates urgency, category, and importance score using Gemini / OpenAI,
 * factoring in the user's custom priority instructions and threshold preferences.
 *
 * Conditional Pipeline Optimization:
 * Summarizes ONLY emails that are from TODAY and meet the DELIVERY criteria.
 */
export async function executeTriageStage(
  supabase: SupabaseClient,
  message: EmailMessageRecord
): Promise<StageResult> {
  try {
    const { triageEmailWithAi } = await import("@/modules/ai/prompts/triage");

    // Fetch user threshold preference, custom priority rules & ingestion-only mode
    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("importance_threshold, custom_priority_rules, notification_preferences")
      .eq("user_id", message.user_id)
      .maybeSingle();

    const isProcessingDisabled = Boolean(
      (userSettings?.notification_preferences as Record<string, unknown>)?.disable_processing
    );

    if (isProcessingDisabled) {
      return {
        success: true,
        nextStage: null,
        messageStatus: "RECEIVED",
      };
    }

    const customRules = userSettings?.custom_priority_rules as
      | { instructions?: string; vipSenders?: string[]; ignoreKeywords?: string[] }
      | undefined;

    const aiTriage = await triageEmailWithAi({
      subject: message.subject,
      sender: message.sender?.raw || "Unknown",
      recipient: message.recipients?.[0]?.raw,
      snippet: message.snippet,
      bodyText: message.body_text,
      userCustomRules: customRules,
    });

    // Upsert into ai_results table with exact schema match
    await supabase.from("ai_results").upsert(
      {
        message_id: message.id,
        category: aiTriage.result.category,
        importance: aiTriage.result.importance,
        confidence: aiTriage.result.confidence,
        reason: aiTriage.result.reason,
        model: aiTriage.model,
        prompt_version: aiTriage.promptVersion,
        input_tokens: aiTriage.inputTokens ?? null,
        output_tokens: aiTriage.outputTokens ?? null,
        triaged_at: new Date().toISOString(),
      },
      { onConflict: "message_id" }
    );

    const threshold = userSettings?.importance_threshold ? Number(userSettings.importance_threshold) : 0.70;
    const isHighImportance = aiTriage.result.importance >= threshold || aiTriage.result.category === "important";

    // Check if message is received today
    const messageDate = new Date(message.received_at);
    const now = new Date();
    const isToday =
      messageDate.getFullYear() === now.getFullYear() &&
      messageDate.getMonth() === now.getMonth() &&
      messageDate.getDate() === now.getDate();

    // Single-Pass AI Optimization: If today & high importance, save summary and advance directly to delivery
    if (isToday && isHighImportance) {
      if (aiTriage.result.summary_text) {
        await supabase.from("summaries").upsert(
          {
            message_id: message.id,
            summary_text: aiTriage.result.summary_text,
            extracted_items: aiTriage.result.extracted_items || [],
            model: aiTriage.model,
            prompt_version: aiTriage.promptVersion,
            created_at: new Date().toISOString(),
          },
          { onConflict: "message_id" }
        );

        await supabase
          .from("email_messages")
          .update({ processing_status: "SUMMARY_READY" })
          .eq("id", message.id);

        return {
          success: true,
          nextStage: "delivery", // Bypass the 2nd AI call completely!
          messageStatus: "SUMMARY_READY",
        };
      }

      await supabase
        .from("email_messages")
        .update({ processing_status: "SUMMARIZING" })
        .eq("id", message.id);

      return {
        success: true,
        nextStage: "summary",
        messageStatus: "SUMMARIZING",
      };
    }

    // For non-today or non-deliverable emails, finalize at TRIAGED (skip summary stage to conserve tokens)
    await supabase
      .from("email_messages")
      .update({ processing_status: "TRIAGED" })
      .eq("id", message.id);

    return {
      success: true,
      nextStage: null,
      messageStatus: "TRIAGED",
    };
  } catch (triageErr) {
    await logLayerError({
      layer: "triage",
      severity: "error",
      errorCode: "AI_TRIAGE_FAILED",
      errorMessage: "AI triage classification failed to score message.",
      error: triageErr,
      userId: message.user_id,
      accountId: message.account_id,
      messageId: message.id,
      technicalDetails: { subject: message.subject, sender: message.sender },
      supabaseClient: supabase,
    });

    return {
      success: false,
      error: triageErr instanceof Error ? triageErr.message : "Triage stage failure",
    };
  }
}

/**
 * 4. Summary Stage Handler (AI Smart Summary & Action Items)
 * Generates an executive summary and extracted action items using Gemini / OpenAI.
 */
export async function executeSummaryStage(
  supabase: SupabaseClient,
  message: EmailMessageRecord
): Promise<StageResult> {
  try {
    // 1. Check if user has Ingestion-Only mode active
    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("notification_preferences")
      .eq("user_id", message.user_id)
      .maybeSingle();

    const isProcessingDisabled = Boolean(
      (userSettings?.notification_preferences as Record<string, unknown>)?.disable_processing
    );

    if (isProcessingDisabled) {
      return {
        success: true,
        nextStage: null,
        messageStatus: "RECEIVED",
      };
    }

    // 2. Check if summary was already generated during the single-pass triage stage
    const { data: existingSummary } = await supabase
      .from("summaries")
      .select("id")
      .eq("message_id", message.id)
      .maybeSingle();

    if (existingSummary) {
      return {
        success: true,
        nextStage: "delivery",
        messageStatus: "SUMMARY_READY",
      };
    }

    const { summarizeEmailWithAi } = await import("@/modules/ai/prompts/summary");

    const aiSummary = await summarizeEmailWithAi({
      subject: message.subject,
      sender: message.sender?.raw || "Unknown",
      recipient: message.recipients?.[0]?.raw,
      snippet: message.snippet,
      bodyText: message.body_text,
    });

    // Upsert into summaries table with exact schema match
    await supabase.from("summaries").upsert(
      {
        message_id: message.id,
        summary_text: aiSummary.result.summary_text,
        extracted_items: aiSummary.result.extracted_items,
        model: aiSummary.model,
        prompt_version: aiSummary.promptVersion,
        created_at: new Date().toISOString(),
      },
      { onConflict: "message_id" }
    );

    await supabase
      .from("email_messages")
      .update({ processing_status: "SUMMARY_READY" })
      .eq("id", message.id);

    return {
      success: true,
      nextStage: "delivery",
      messageStatus: "SUMMARY_READY",
    };
  } catch (summaryErr) {
    await logLayerError({
      layer: "summarization",
      severity: "error",
      errorCode: "AI_SUMMARY_FAILED",
      errorMessage: "AI summarization failed to generate executive brief.",
      error: summaryErr,
      userId: message.user_id,
      accountId: message.account_id,
      messageId: message.id,
      technicalDetails: { subject: message.subject },
      supabaseClient: supabase,
    });

    return {
      success: false,
      error: summaryErr instanceof Error ? summaryErr.message : "Summary stage failure",
    };
  }
}

/**
 * 5. Delivery Stage Handler (WhatsApp & Notification Dispatch)
 * Dispatches automated AI summaries to the user's WhatsApp destination.
 */
export async function executeDeliveryStage(
  supabase: SupabaseClient,
  message: EmailMessageRecord
): Promise<StageResult> {
  // 1. Fetch user's settings and WhatsApp destination
  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("whatsapp_destination, importance_threshold, notification_preferences")
    .eq("user_id", message.user_id)
    .maybeSingle();

  const prefs = (userSettings?.notification_preferences as Record<string, unknown>) || {};
  if (prefs.disable_processing) {
    // Ingestion-only mode: do not send any WhatsApp messages
    return {
      success: true,
      nextStage: null,
      messageStatus: "INGESTED",
    };
  }

  // 2. Fetch the summary and triage results
  const { data: summaryRecord } = await supabase
    .from("summaries")
    .select("summary_text, extracted_items")
    .eq("message_id", message.id)
    .maybeSingle();

  const { data: triageRecord } = await supabase
    .from("ai_results")
    .select("category, importance")
    .eq("message_id", message.id)
    .maybeSingle();

  const destinationPhone = userSettings?.whatsapp_destination;

  // 3. Dispatch WhatsApp alert if destination is configured
  if (destinationPhone && summaryRecord?.summary_text) {
    // Proactively check if 24-hour WhatsApp messaging window is active
    const prefs = (userSettings?.notification_preferences as Record<string, unknown>) || {};
    const lastInboundAt = prefs.last_inbound_at ? new Date(prefs.last_inbound_at as string).getTime() : 0;
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const isWindowActive = lastInboundAt > 0 && Date.now() - lastInboundAt < twentyFourHoursMs;

    if (!isWindowActive) {
      // Window is closed: Do NOT send freeform text message that Meta will silently drop.
      // Instead, queue as DELIVERY_PENDING (stacked) so it will be flushed the moment user replies.
      await supabase
        .from("email_messages")
        .update({ processing_status: "DELIVERY_PENDING" })
        .eq("id", message.id);

      // Proactively send 24h Greetings / Re-engagement Template if not sent in the last 12 hours
      try {
        const lastTemplateSentAt = prefs.last_template_sent_at
          ? new Date(prefs.last_template_sent_at as string).getTime()
          : 0;
        const twelveHoursMs = 12 * 60 * 60 * 1000;

        if (Date.now() - lastTemplateSentAt > twelveHoursMs) {
          const { sendGreetings24hTemplate } = await import("@/modules/whatsapp/templates");
          await sendGreetings24hTemplate(destinationPhone, "there", { user_id: message.user_id });

          await supabase
            .from("user_settings")
            .update({
              notification_preferences: {
                ...prefs,
                last_template_sent_at: new Date().toISOString(),
                window_status: "CLOSED",
              },
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", message.user_id);
        }
      } catch (templateFallbackErr) {
        console.warn("Failed to dispatch template prompt for closed window:", templateFallbackErr);
      }

      return {
        success: true,
        nextStage: null,
        messageStatus: "DELIVERY_PENDING",
      };
    }

    try {
      const { sendStrikeEmailAlert } = await import("@/modules/whatsapp");
      const extractedActionItems = Array.isArray(summaryRecord.extracted_items)
        ? summaryRecord.extracted_items
        : (summaryRecord.extracted_items as { action_items?: Array<{ action: string; deadline?: string; assignee?: string }> })?.action_items || [];

      await sendStrikeEmailAlert({
        recipientPhone: destinationPhone,
        sender: message.sender?.raw,
        subject: message.subject,
        summaryText: summaryRecord.summary_text,
        category: triageRecord?.category,
        importance: triageRecord?.importance,
        actionItems: extractedActionItems,
        emailMessageId: message.id,
        userId: message.user_id,
      });

      await supabase
        .from("email_messages")
        .update({ processing_status: "DELIVERED" })
        .eq("id", message.id);

      return {
        success: true,
        nextStage: null,
        messageStatus: "DELIVERED",
      };
    } catch (err: unknown) {
      console.error("WhatsApp delivery error in pipeline:", err);
      const errMsg = err instanceof Error ? err.message : "WhatsApp delivery failed";

      // Detect if failure is due to 24-hour messaging window closure / Meta 131047 / HTTP 400
      const isWindowClosed =
        errMsg.includes("24 hours") ||
        errMsg.includes("131047") ||
        errMsg.includes("400");

      if (isWindowClosed) {
        // Mark message as DELIVERY_PENDING (stacked) so it will be flushed immediately once user replies
        await supabase
          .from("email_messages")
          .update({ processing_status: "DELIVERY_PENDING" })
          .eq("id", message.id);

        // Proactively send 24h Greetings / Re-engagement Template if not sent in the last 12 hours
        try {
          const userPrefs = (userSettings?.notification_preferences as Record<string, unknown>) || {};
          const lastTemplateSentAt = userPrefs.last_template_sent_at
            ? new Date(userPrefs.last_template_sent_at as string).getTime()
            : 0;
          const twelveHoursMs = 12 * 60 * 60 * 1000;

          if (Date.now() - lastTemplateSentAt > twelveHoursMs) {
            const { sendGreetings24hTemplate } = await import("@/modules/whatsapp/templates");
            await sendGreetings24hTemplate(destinationPhone, "there", { user_id: message.user_id });

            await supabase
              .from("user_settings")
              .update({
                notification_preferences: {
                  ...userPrefs,
                  last_template_sent_at: new Date().toISOString(),
                  window_status: "CLOSED",
                },
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", message.user_id);
          }
        } catch (templateFallbackErr) {
          console.warn("Failed to dispatch template prompt for closed window:", templateFallbackErr);
        }

        return {
          success: true,
          nextStage: null,
          messageStatus: "DELIVERY_PENDING",
        };
      }

      await logLayerError({
        layer: "delivery",
        severity: "error",
        errorCode: "WHATSAPP_DISPATCH_FAILED",
        errorMessage: errMsg,
        error: err,
        userId: message.user_id,
        accountId: message.account_id,
        messageId: message.id,
        technicalDetails: {
          destinationPhone,
          summarySnippet: summaryRecord.summary_text.slice(0, 100),
        },
        supabaseClient: supabase,
      });

      return {
        success: false,
        error: errMsg,
      };
    }
  } else if (!destinationPhone) {
    console.warn(`Skipping WhatsApp delivery for message ${message.id}: No whatsapp_destination configured in user_settings.`);
  }

  // If WhatsApp was skipped or not configured, finalize message status as PROCESSED
  await supabase
    .from("email_messages")
    .update({ processing_status: "PROCESSED" })
    .eq("id", message.id);

  return {
    success: true,
    nextStage: null,
    messageStatus: "PROCESSED",
  };
}


