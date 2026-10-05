import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/common/security/integration-auth";
import { createSupabaseAdminClient } from "@/database/supabase/server";
import { runMailboxSyncPage } from "@/modules/email/ingestion/coordinator";
import { runProcessingBatch } from "@/modules/processing/pipeline";
import { runDeliveryOutbox } from "@/modules/whatsapp/outbox";
import { checkAndRenew24hWindows } from "@/modules/whatsapp/whatsapp";

export const maxDuration = 60;

export async function GET(request: Request) {
    if (!isCronAuthorized(request))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const db = createSupabaseAdminClient();
    
    // Fallback: force a sync request for all connected accounts in case Pub/Sub push failed
    const { data: accounts } = await db.from("email_accounts").select("id").eq("connection_status", "connected");
    for (const account of accounts || []) {
        await db.rpc("strike_request_sync", { p_account: account.id });
    }

    const results = [];
    try {
        results.push(await runMailboxSyncPage(db));
        results.push(await runProcessingBatch(db, 15, 2));
        results.push(await runDeliveryOutbox(db));
        results.push(await checkAndRenew24hWindows(db));
    } catch (e) {
        console.error("Worker pipeline error:", e);
    }
    
    return NextResponse.json({ results });
}
