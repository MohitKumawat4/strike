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

    // 3. Recent messages for inbox intelligence (with body content for detail drawer)
    supabase
      .from("email_messages")
      .select("id, account_id, subject, snippet, sender, body_text, body_html, received_at, processing_status")
      .order("received_at", { ascending: false })
      .limit(100),

    // 4. Processing jobs for pipeline monitoring
    supabase
      .from("processing_jobs")
      .select("id, message_id, status, stage, attempts, started_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(50),

    // 5. User preferences and thresholds
    supabase
      .from("user_settings")
      .select("importance_threshold, raw_body_retention_days, notify_on_important, notify_on_failure")
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

  // Compute important count and map AI results & summaries to messages
  const threshold = userSettings?.importance_threshold ? Number(userSettings.importance_threshold) : 0.70;
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

  const importantCount = (aiResults || []).filter(
    (r) => r.category === "important" || Number(r.importance) >= threshold
  ).length;

  return (
    <DashboardShell
      accounts={accounts || []}
      aiResults={aiResults || []}
      email={email}
      importantCount={importantCount}
      messages={enrichedMessages}
      processingJobs={processingJobs || []}
      receivedCount={receivedCount || 0}
      userSettings={userSettings || null}
    />
  );
}
