import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/database/supabase/server";
import { performInitialSync } from "@/modules/email/ingestion/initial-sync";

/**
 * On-demand manual mailbox sync endpoint.
 * Triggered by the user clicking "Sync" or "Sync All" from the Dashboard.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const accountId = body.accountId as string | undefined;

    // Fetch user's connected Gmail accounts
    let query = supabase
      .from("email_accounts")
      .select("id, user_id, email_address, encrypted_refresh_token, history_id, connection_status")
      .eq("user_id", user.id)
      .eq("provider", "gmail");

    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: dbError } = await query;

    if (dbError || !accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: "No active connected Gmail accounts found to sync." },
        { status: 404 }
      );
    }

    const syncResults = [];

    for (const account of accounts) {
      try {
        const res = await performInitialSync(supabase, {
          accountId: account.id,
          userId: account.user_id,
          encryptedRefreshToken: account.encrypted_refresh_token,
          maxMessages: 25,
        });

        syncResults.push({
          email: account.email_address,
          synced: res.syncedCount,
        });
      } catch (accountErr) {
        console.error(`Sync error for ${account.email_address}:`, accountErr);
        syncResults.push({
          email: account.email_address,
          error: accountErr instanceof Error ? accountErr.message : "Sync failed",
        });
      }
    }

    // Trigger background pipeline batch processor for new messages
    try {
      const { runProcessingBatch } = await import("@/modules/processing/pipeline");
      const { createSupabaseAdminClient } = await import("@/database/supabase/server");
      const supabaseAdmin = createSupabaseAdminClient();
      await runProcessingBatch(supabaseAdmin, 20);
    } catch (procErr) {
      console.warn("Background processing runner warning:", procErr);
    }

    return NextResponse.json({
      success: true,
      results: syncResults,
      message: `Synced ${syncResults.reduce((acc, r) => acc + (r.synced || 0), 0)} messages across ${accounts.length} mailbox(es).`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error during manual sync";
    console.error("Manual sync route error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
