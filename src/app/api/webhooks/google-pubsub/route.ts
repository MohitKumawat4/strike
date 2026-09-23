import { NextResponse, after } from "next/server";
import { verifyPubSubRequest } from "@/common/security/integration-auth";
import { createSupabaseAdminClient } from "@/database/supabase/server";
import { requestMailboxSync, runMailboxSyncPage } from "@/modules/email/ingestion/coordinator";
import { runProcessingBatch } from "@/modules/processing/pipeline";
import { runDeliveryOutbox } from "@/modules/whatsapp/outbox";

export async function POST(request: Request) {
    if (!await verifyPubSubRequest(request))
        return NextResponse.json({ error: "Unauthorized push" }, { status: 401 });
    let email: string;
    try {
        const body = await request.json();
        const payload = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf8"));
        if (typeof payload.emailAddress !== "string")
            throw new Error();
        email = payload.emailAddress;
    }
    catch {
        return NextResponse.json({ status: "ignored", reason: "Invalid payload" });
    }
    try {
        const db = createSupabaseAdminClient();
        const { data: accounts, error } = await db.from("email_accounts").select("id, user_id").eq("provider", "gmail").eq("email_address", email).eq("connection_status", "connected");
        if (error)
            throw error;
        for (const account of accounts || [])
            await requestMailboxSync(db, account.id);

        // Run real-time background processing via Next.js after() without blocking the 200 response to Google Pub/Sub
        if (accounts && accounts.length > 0) {
            after(async () => {
                try {
                    // Drain the queued sync page to fetch newest Gmail messages into database
                    await runMailboxSyncPage(db);
                    // Run AI triage and summarization batch for pending messages
                    await runProcessingBatch(db, 5, 1);
                    // Deliver any pending important alerts to WhatsApp outbox
                    await runDeliveryOutbox(db);
                } catch (err) {
                    console.error("Background webhook processing error:", err);
                }
            });
        }

        return NextResponse.json({ status: "queued", accounts: accounts?.length || 0 });
    }
    catch {
        return NextResponse.json({ error: "Could not persist sync request" }, { status: 503 });
    }
}

