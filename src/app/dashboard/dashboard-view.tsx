import { getPipelineControls } from "@/common/pipeline-controls";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/config/supabase";
import { createSupabaseServerClient } from "@/database/supabase/server";
import { DashboardSetup } from "./_components/dashboard-setup";
import { DashboardShell } from "./_components/dashboard-shell";
const first = <T,>(value: T | T[] | null | undefined): T | undefined => Array.isArray(value) ? value[0] : value ?? undefined;
/** Shared read model: UI routes never fetch Gmail, and related rows match the displayed emails. */
export default async function DashboardView({ initialTab }: {
    initialTab?: "error_logs";
}) {
    if (!isSupabaseConfigured())
        return <DashboardSetup />;
    const db = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user)
        redirect("/login");
    const [accountsResult, messagesResult, settingsResult, countsResult] = await Promise.all([
        db.from("email_accounts").select("id,provider,email_address,connection_status,last_successful_sync_at,created_at,granted_scopes,history_id").order("created_at", { ascending: false }),
        db.from("email_messages").select("id,account_id,provider_message_id,thread_id,subject,snippet,sender,body_text,body_html,received_at,processing_status,ai_results(message_id,category,importance,confidence,reason),summaries(summary_text,extracted_items),delivery_outbox(status,error_code),processing_jobs(id,message_id,status,stage,attempts,started_at,completed_at,result)").order("received_at", { ascending: false }).limit(1000),
        db.from("user_settings").select("importance_threshold,raw_body_retention_days,notification_preferences,whatsapp_destination,custom_priority_rules").eq("user_id", user.id).maybeSingle(),
        db.rpc("strike_dashboard_counts"),
    ]);
    if (accountsResult.error) {
        console.error("Dashboard accounts load error:", accountsResult.error);
    }
    if (messagesResult.error) {
        console.error("Dashboard messages load error:", messagesResult.error);
    }
    const s = settingsResult.data;
    const prefs = (s?.notification_preferences || {}) as Record<string, unknown>;
    const userSettings = s ? {
        pipeline: getPipelineControls(prefs),
        whatsapp_destination: s.whatsapp_destination,
        importance_threshold: Number(s.importance_threshold ?? 0.7),
        raw_body_retention_days: Number(s.raw_body_retention_days ?? 30),
        notify_on_important: typeof prefs.notify_on_important === "boolean" ? prefs.notify_on_important : true,
        notify_on_failure: typeof prefs.notify_on_failure === "boolean" ? prefs.notify_on_failure : true,
        disable_processing: prefs.disable_processing === true,
        custom_priority_rules: s.custom_priority_rules || { instructions: "", vipSenders: [], ignoreKeywords: [] }
    } : null;
    const messages = (messagesResult.data || []).map(m => {
        const classification = first(m.ai_results);
        const ai = classification?.reason === "Historical email synced from connected inbox." ? undefined : classification;
        return { ...m, ai_category: ai?.category, ai_importance: ai?.importance == null ? undefined : Number(ai.importance), ai_reason: ai?.reason, summary: first(m.summaries), delivery_status: first(m.delivery_outbox)?.status };
    });
    const jobs = (messagesResult.data || []).flatMap(m => m.processing_jobs || []);
    const counts = countsResult.data || {
        received: messages.length,
        triaged: messages.filter(m => m.ai_category).length,
        important: messages.filter(m => m.ai_category === "important" || (m.ai_importance ?? 0) >= (userSettings?.importance_threshold ?? 0.7)).length,
        delivered: messages.filter(m => m.delivery_status === "delivered").length,
        filtered: messages.filter(m => m.processing_status === "DISCARDED").length,
        failed: 0,
        delivery_attention: 0,
    };
    return <DashboardShell initialTab={initialTab} email={user.email || "You"} accounts={accountsResult.data || []} messages={messages} processingJobs={jobs} userSettings={userSettings} counts={counts} receivedCount={counts.received} importantCount={counts.important}/>;
}
