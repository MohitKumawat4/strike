import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/config/supabase";
import { createSupabaseServerClient } from "@/database/supabase/server";

import { DashboardSetup } from "../_components/dashboard-setup";
import { DashboardShell } from "../_components/dashboard-shell";

export const metadata = {
  title: "Layer Error Logs — Strike Intelligence",
  description: "Platform-wide error logs, layer failure telemetry, and debugging command center.",
};

/**
 * Dedicated Server Page for /dashboard/error-logs
 *
 * Renders the Strike dashboard shell with the Error Logs tab active by default.
 */
export default async function ErrorLogsPage() {
  if (!isSupabaseConfigured()) {
    return <DashboardSetup />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const email = user.email || "You";

  // Fetch essential dashboard datasets in parallel
  const [
    { data: accounts },
    { count: receivedCount },
    { data: messages },
    { data: processingJobs },
    { data: userSettings },
    { data: aiResults },
    { data: summaries },
  ] = await Promise.all([
    supabase
      .from("email_accounts")
      .select("id, provider, email_address, connection_status, last_successful_sync_at, created_at, granted_scopes, history_id")
      .order("created_at", { ascending: false }),
    supabase.from("email_messages").select("*", { count: "exact", head: true }),
    supabase
      .from("email_messages")
      .select("id, account_id, provider_message_id, thread_id, subject, snippet, sender, body_text, body_html, received_at, processing_status")
      .order("received_at", { ascending: false })
      .limit(1000),
    supabase
      .from("processing_jobs")
      .select("id, message_id, status, stage, attempts, started_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("user_settings")
      .select("importance_threshold, raw_body_retention_days, notification_preferences, whatsapp_destination, custom_priority_rules")
      .maybeSingle(),
    supabase.from("ai_results").select("message_id, category, importance, confidence, reason"),
    supabase.from("summaries").select("message_id, summary_text, extracted_items"),
  ]);

  const mappedUserSettings = userSettings
    ? {
        whatsapp_destination: userSettings.whatsapp_destination,
        importance_threshold: userSettings.importance_threshold ? Number(userSettings.importance_threshold) : 0.7,
        raw_body_retention_days: userSettings.raw_body_retention_days ? Number(userSettings.raw_body_retention_days) : 30,
        notify_on_important: (userSettings.notification_preferences as { notify_on_important?: boolean } | null)?.notify_on_important ?? true,
        notify_on_failure: (userSettings.notification_preferences as { notify_on_failure?: boolean } | null)?.notify_on_failure ?? true,
        custom_priority_rules: (userSettings.custom_priority_rules as {
          instructions?: string;
          vipSenders?: string[];
          ignoreKeywords?: string[];
        }) || {
          instructions: "",
          vipSenders: [],
          ignoreKeywords: [],
        },
      }
    : null;

  const threshold = mappedUserSettings?.importance_threshold ? Number(mappedUserSettings.importance_threshold) : 0.7;
  const aiMap = new Map((aiResults || []).map((r) => [r.message_id, r]));
  const summaryMap = new Map((summaries || []).map((s) => [s.message_id, s]));

  const enrichedMessages = (messages || []).map((msg) => {
    const ai = aiMap.get(msg.id);
    const summary = summaryMap.get(msg.id);
    return {
      ...msg,
      ai_category: ai?.category,
      ai_importance: ai?.importance ? Number(ai.importance) : undefined,
      ai_reason: ai?.reason,
      summary: summary
        ? {
            summary_text: summary.summary_text,
            extracted_items: summary.extracted_items,
          }
        : undefined,
    };
  });

  const importantCount = enrichedMessages.filter(
    (m) => m.ai_category?.toLowerCase() === "important" || (typeof m.ai_importance === "number" && m.ai_importance >= threshold)
  ).length;

  return (
    <DashboardShell
      accounts={accounts || []}
      aiResults={aiResults || []}
      email={email}
      importantCount={importantCount}
      initialTab="error_logs"
      messages={enrichedMessages}
      processingJobs={processingJobs || []}
      receivedCount={receivedCount || 0}
      userSettings={mappedUserSettings}
    />
  );
}
