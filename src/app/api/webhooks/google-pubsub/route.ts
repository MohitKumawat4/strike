import { NextResponse } from "next/server";
import { verifyPubSubRequest } from "@/common/security/integration-auth";
import { createSupabaseAdminClient } from "@/database/supabase/server";
import { requestMailboxSync } from "@/modules/email/ingestion/coordinator";
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
        const { data: accounts, error } = await db.from("email_accounts").select("id").eq("provider", "gmail").eq("email_address", email).eq("connection_status", "connected");
        if (error)
            throw error;
        for (const account of accounts || [])
            await requestMailboxSync(db, account.id);
        return NextResponse.json({ status: "queued", accounts: accounts?.length || 0 });
    }
    catch {
        return NextResponse.json({ error: "Could not persist sync request" }, { status: 503 });
    }
}
