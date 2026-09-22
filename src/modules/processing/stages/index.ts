import type { SupabaseClient } from "@supabase/supabase-js";
import { getPipelineControls, afterResume } from "@/common/pipeline-controls";
import { preFilterEmail } from "@/modules/email/rules/pre-filter";
import { formatEmailPreview } from "@/modules/email/email-preview";
export type EmailMessageRecord = {
    id: string;
    user_id: string;
    account_id: string;
    provider_message_id: string;
    thread_id?: string | null;
    sender: {
        raw?: string;
    };
    recipients: {
        raw?: string;
    }[];
    subject: string;
    snippet?: string;
    body_text?: string;
    body_html?: string;
    received_at: string;
    has_attachments: boolean;
    labels?: string[];
    processing_status: string;
};
export type StageResult = {
    success: boolean;
    nextStage?: "pre_filter" | "triage" | "summary" | "delivery" | null;
    messageStatus?: string;
    error?: string;
    metadata?: Record<string, unknown>;
    ai?: Record<string, unknown>;
    summary?: Record<string, unknown>;
    delivery?: {
        destination: string;
        payload: Record<string, unknown>;
    };
};
async function settings(db: SupabaseClient, userId: string) {
    const { data, error } = await db.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
    if (error)
        throw error;
    return data;
}
const done = (messageStatus: string, nextStage: StageResult["nextStage"], reason?: string): StageResult => ({ success: true, messageStatus, nextStage, metadata: reason ? { reason } : undefined });
/** Handlers compute results. Only the fenced finish RPC writes stage outputs. */
export async function executeIngestionStage(_db: SupabaseClient, m: EmailMessageRecord): Promise<StageResult> {
    if (!m.subject && !m.snippet && !m.body_text && !m.body_html && !m.has_attachments)
        throw new Error("EMPTY_EMAIL_PAYLOAD");
    return done("RECEIVED", "pre_filter");
}
export async function executePreFilterStage(db: SupabaseClient, m: EmailMessageRecord): Promise<StageResult> {
    const s = await settings(db, m.user_id);
    const c = getPipelineControls(s?.notification_preferences);
    if (!c.filter_unwanted)
        return done("PRE_FILTERED", "triage", "disabled");
    const decision = preFilterEmail({ subject: m.subject, sender: m.sender?.raw, labels: m.labels, ignoreKeywords: s?.custom_priority_rules?.ignoreKeywords });
    if (!decision.shouldTriage)
        return done("DISCARDED", null, decision.reason);
    return done("PRE_FILTERED", "triage");
}
export async function executeTriageStage(db: SupabaseClient, m: EmailMessageRecord): Promise<StageResult> {
    const s = await settings(db, m.user_id);
    const c = getPipelineControls(s?.notification_preferences);
    if (Date.now() - Date.parse(m.received_at) > 86400000)
        return done("PRE_FILTERED", null, "historical_ai_not_run");
    if (!c.use_ai)
        return done("PRE_FILTERED", "delivery", "disabled");
    const { triageEmailWithAi } = await import("@/modules/ai/prompts/triage");
    const result = await triageEmailWithAi({ subject: m.subject, sender: m.sender?.raw || "Unknown", recipient: m.recipients?.[0]?.raw, snippet: m.snippet, bodyText: m.body_text, userCustomRules: s?.custom_priority_rules });
    const ai = { ...result.result, model: result.model, prompt_version: result.promptVersion };
    const important = result.result.category === "important" || result.result.importance >= Number(s?.importance_threshold ?? 0.7);
    const summary = result.result.summary_text ? { summary_text: result.result.summary_text, extracted_items: result.result.extracted_items || [], model: result.model, prompt_version: result.promptVersion } : undefined;
    return { ...done(summary ? "SUMMARY_READY" : "TRIAGED", important ? (summary ? "delivery" : "summary") : null), ai, summary };
}
export async function executeSummaryStage(db: SupabaseClient, m: EmailMessageRecord): Promise<StageResult> {
    const s = await settings(db, m.user_id);
    if (!getPipelineControls(s?.notification_preferences).use_ai)
        return done(m.processing_status, "delivery", "disabled");
    const { summarizeEmailWithAi } = await import("@/modules/ai/prompts/summary");
    const result = await summarizeEmailWithAi({ subject: m.subject, sender: m.sender?.raw || "Unknown", recipient: m.recipients?.[0]?.raw, snippet: m.snippet, bodyText: m.body_text });
    return { ...done("SUMMARY_READY", "delivery"), summary: { ...result.result, model: result.model, prompt_version: result.promptVersion } };
}
export async function executeDeliveryStage(db: SupabaseClient, m: EmailMessageRecord): Promise<StageResult> {
    const s = await settings(db, m.user_id);
    const prefs = s?.notification_preferences || {};
    const c = getPipelineControls(prefs);
    if (!c.send_whatsapp || prefs.notify_on_important === false)
        return done(m.processing_status, null, "disabled");
    if (!s?.whatsapp_destination)
        return done(m.processing_status, null, "destination_missing");
    const age = Date.now() - Date.parse(m.received_at);
    if (!Number.isFinite(age) || age < 0 || age > 86400000 || !afterResume(m.received_at, prefs.deliver_after))
        return done(m.processing_status, null, "outside_delivery_window");
    const { data: summary, error } = await db.from("summaries").select("summary_text,extracted_items").eq("message_id", m.id).maybeSingle();
    if (error)
        throw error;
    const { data: ai, error: aiError } = await db.from("ai_results").select("category,importance").eq("message_id", m.id).maybeSingle();
    if (aiError)
        throw aiError;
    const preview = !c.use_ai || !summary?.summary_text;
    const items = summary?.extracted_items;
    return { ...done("DELIVERY_PENDING", null), delivery: { destination: s.whatsapp_destination, payload: {
                recipientPhone: s.whatsapp_destination, sender: m.sender?.raw, subject: m.subject, summaryText: preview ? formatEmailPreview(m) : summary.summary_text,
                rawPreviewText: preview ? formatEmailPreview(m) : undefined, category: ai?.category, importance: ai?.importance,
                actionItems: Array.isArray(items) ? items : items?.action_items || [], emailMessageId: m.id, userId: m.user_id,
            } } };
}
