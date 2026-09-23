import { getPipelineControls } from "@/common/pipeline-controls";
import { NextResponse, after } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/database/supabase/server";
import { saveUserSettings } from "@/database/user-settings";
const schema = z
  .object({
    receive_emails: z.boolean(),
    filter_unwanted: z.boolean(),
    use_ai: z.boolean(),
    send_whatsapp: z.boolean(),
  })
  .strict();
export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid pipeline controls." },
      { status: 400 },
    );
  let { error, preferences } = await saveUserSettings(supabase, {
    user_id: user.id,
    notification_preferences: { pipeline: parsed.data },
  });
  if (error) {
    // Retry with admin client in case cookie session is refreshing
    const admin = createSupabaseAdminClient();
    const fallback = await saveUserSettings(admin, {
      user_id: user.id,
      notification_preferences: { pipeline: parsed.data },
    });
    if (!fallback.error) {
      error = null;
      preferences = fallback.preferences;
    }
  }
  if (error)
    return NextResponse.json(
      { error: "Could not save controls. Please try again." },
      { status: 500 },
    );
  if (parsed.data.receive_emails) {
    const { requestMailboxSync, runMailboxSyncPage } = await import("@/modules/email/ingestion/coordinator");
    const { runProcessingBatch } = await import("@/modules/processing/pipeline");
    const { runDeliveryOutbox } = await import("@/modules/whatsapp/outbox");
    const admin = createSupabaseAdminClient();
    const { data: accounts, error: accountError } = await admin.from("email_accounts").select("id").eq("user_id", user.id).eq("connection_status", "connected");
    if (!accountError) for (const account of accounts || []) {
      try { await requestMailboxSync(admin, account.id); } catch { console.error("Controls saved but sync request could not be queued", account.id); }
    }
    // Schedule immediate background drain and process on resume
    after(async () => {
      try {
        await runMailboxSyncPage(admin, user.id);
        await runProcessingBatch(admin, 5, 1, user.id);
        await runDeliveryOutbox(admin, user.id);
      } catch (err) {
        console.error("Pipeline toggle post-save execution error:", err);
      }
    });
  }
  return NextResponse.json({ pipeline: getPipelineControls(preferences) });
}

