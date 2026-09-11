import { getPipelineControls } from "@/common/pipeline-controls";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/config/supabase";
import { createSupabaseServerClient } from "@/database/supabase/server";

import { DashboardSetup } from "./_components/dashboard-setup";
import { DashboardShell } from "./_components/dashboard-shell";

/**
 * Dashboard Server Page
 *
 * Fetches all required data from Supabase and passes it
 * as serialized props to the client-side DashboardShell.
 */
export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return <DashboardSetup />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const email = user.email || "You";

  // Execute independent database queries in parallel to eliminate waterfalls
  const [
    { data: accounts },
    { count: receivedCount },
    { data: messages },
    { data: processingJobs },
    { data: userSettings },
    { data: aiResults },
    { data: summaries },
  ] = await Promise.all([
    // 1. Connected accounts
    supabase
      .from("email_accounts")
      .select("id, provider, email_address, connection_status, last_successful_sync_at, created_at, granted_scopes, history_id")
      .order("created_at", { ascending: false }),

    // 2. Total received message count
    supabase
      .from("email_messages")
      .select("*", { count: "exact", head: true }),

    // 3. Messages for inbox intelligence (with body content for detail drawer)
    supabase
      .from("email_messages")
      .select("id, account_id, provider_message_id, thread_id, subject, snippet, sender, body_text, body_html, received_at, processing_status")
      .order("received_at", { ascending: false })
      .limit(1000),

    // 4. Processing jobs for pipeline monitoring
    supabase
      .from("processing_jobs")
      .select("id, message_id, status, stage, attempts, started_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(100),

    // 5. User preferences and thresholds
    supabase
      .from("user_settings")
      .select("importance_threshold, raw_body_retention_days, notification_preferences, whatsapp_destination, custom_priority_rules")
      .maybeSingle(),

    // 6. AI intelligence classification results
    supabase
      .from("ai_results")
      .select("message_id, category, importance, confidence, reason"),

    // 7. AI executive summaries and action items
    supabase
      .from("summaries")
      .select("message_id, summary_text, extracted_items"),
  ]);

  // Map user settings with notification preferences and custom AI priority rules
  const mappedUserSettings = userSettings
    ? {
        pipeline: getPipelineControls(userSettings.notification_preferences),
        whatsapp_destination: userSettings.whatsapp_destination,
        importance_threshold: userSettings.importance_threshold ? Number(userSettings.importance_threshold) : 0.70,
        raw_body_retention_days: userSettings.raw_body_retention_days ? Number(userSettings.raw_body_retention_days) : 30,
        notify_on_important: (userSettings.notification_preferences as { notify_on_important?: boolean } | null)?.notify_on_important ?? true,
        notify_on_failure: (userSettings.notification_preferences as { notify_on_failure?: boolean } | null)?.notify_on_failure ?? true,
        disable_processing: Boolean((userSettings.notification_preferences as { disable_processing?: boolean } | null)?.disable_processing),
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

  // Compute important count and map AI results & summaries to messages
  const threshold = mappedUserSettings?.importance_threshold ? Number(mappedUserSettings.importance_threshold) : 0.70;
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

  // Calculate important count from enriched messages so Overview tab and Messages tab numbers are 100% aligned
  const importantCount = enrichedMessages.filter(
    (m) => m.ai_category?.toLowerCase() === "important" || (typeof m.ai_importance === "number" && m.ai_importance >= threshold)
  ).length;

  return (
    <DashboardShell
      accounts={accounts || []}
      aiResults={aiResults || []}
      email={email}
      importantCount={importantCount}
      messages={enrichedMessages}
      processingJobs={processingJobs || []}
      receivedCount={receivedCount || enrichedMessages.length}
      userSettings={mappedUserSettings}
    />
  );
}
