import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/common/security/integration-auth";
import { createSupabaseAdminClient } from "@/database/supabase/server";
import { runMailboxSyncPage } from "@/modules/email/ingestion/coordinator";
import { runProcessingBatch } from "@/modules/processing/pipeline";
import { runDeliveryOutbox } from "@/modules/whatsapp/outbox";
export const maxDuration = 60;
export async function GET(request: Request) {
    if (!isCronAuthorized(request))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const db = createSupabaseAdminClient();
    const results = await Promise.allSettled([runMailboxSyncPage(db), runProcessingBatch(db, 5, 1), runDeliveryOutbox(db)]);
    return NextResponse.json({ results: results.map(r => r.status === 'fulfilled' ? r.value : { error: "Worker layer failed; durable state retained" }) });
}
