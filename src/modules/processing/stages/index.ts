import type { SupabaseClient } from "@supabase/supabase-js";

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
    return {
      success: false,
      error: "Message payload is empty (missing subject, snippet, and body).",
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
 * Runs deterministic heuristics (bounce detection, automated notifications, unsubscribe checks).
 * If email is deemed noise, marks as DISCARDED; otherwise queues for AI triage.
 */
export async function executePreFilterStage(
  supabase: SupabaseClient,
  message: EmailMessageRecord
): Promise<StageResult> {
  const sender = (message.sender?.raw || "").toLowerCase();
  const subject = (message.subject || "").toLowerCase();
  const snippet = (message.snippet || "").toLowerCase();

  // Heuristic patterns for automated discard / non-actionable email
  const isAutomatedNoise =
    sender.includes("no-reply") ||
    sender.includes("noreply") ||
    sender.includes("mailer-daemon") ||
    sender.includes("notifications@") ||
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
}

/**
 * 3. Triage Stage Handler (AI Classification)
 * Evaluates urgency, category, and importance score using Gemini / OpenAI.
 */
export async function executeTriageStage(
  supabase: SupabaseClient,
  message: EmailMessageRecord
): Promise<StageResult> {
  const { triageEmailWithAi } = await import("@/modules/ai/prompts/triage");

  const aiTriage = await triageEmailWithAi({
    subject: message.subject,
    sender: message.sender?.raw || "Unknown",
    recipient: message.recipients?.[0]?.raw,
    snippet: message.snippet,
    bodyText: message.body_text,
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

  // Fetch user threshold preference if configured
  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("importance_threshold")
    .eq("user_id", message.user_id)
    .maybeSingle();

  const threshold = userSettings?.importance_threshold ? Number(userSettings.importance_threshold) : 0.70;
  const isHighImportance = aiTriage.result.importance >= threshold || aiTriage.result.category === "important";

  // If high importance, advance to summary stage; otherwise complete at TRIAGED
  if (isHighImportance) {
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

  await supabase
    .from("email_messages")
    .update({ processing_status: "TRIAGED" })
    .eq("id", message.id);

  return {
    success: true,
    nextStage: null,
    messageStatus: "TRIAGED",
  };
}

/**
 * 4. Summary Stage Handler (AI Smart Summary & Action Items)
 * Generates an executive summary and extracted action items using Gemini / OpenAI.
 */
export async function executeSummaryStage(
  supabase: SupabaseClient,
  message: EmailMessageRecord
): Promise<StageResult> {
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
    try {
      const { sendStrikeEmailAlert } = await import("@/modules/whatsapp");
      await sendStrikeEmailAlert({
        recipientPhone: destinationPhone,
        sender: message.sender?.raw,
        subject: message.subject,
        summaryText: summaryRecord.summary_text,
        category: triageRecord?.category,
        importance: triageRecord?.importance,
        actionItems: (summaryRecord.extracted_items as Record<string, unknown>)?.action_items as Array<{ action: string; deadline?: string; assignee?: string }> || [],
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
    }
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

