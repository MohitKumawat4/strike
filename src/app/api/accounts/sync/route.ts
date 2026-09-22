import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/database/supabase/server";
import { requestMailboxSync } from "@/modules/email/ingestion/coordinator";
export async function POST(request: Request) {
    try {
        const db = await createSupabaseServerClient();
        const { data: { user }, error } = await db.auth.getUser();
        if (error || !user)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const body = await request.json().catch(() => ({}));
        let query = db.from("email_accounts").select("id").eq("user_id", user.id).eq("provider", "gmail").eq("connection_status", "connected");
        if (body.accountId)
            query = query.eq("id", body.accountId);
        const { data: accounts, error: queryError } = await query;
        if (queryError)
            throw queryError;
        if (!accounts?.length)
            return NextResponse.json({ error: "No connected Gmail accounts." }, { status: 404 });
        const admin = createSupabaseAdminClient();
        for (const account of accounts)
            await requestMailboxSync(admin, account.id);
        return NextResponse.json({ success: true, message: `Sync queued for ${accounts.length} mailbox(es). Progress will appear as messages are imported.` }, { status: 202 });
    }
    catch {
        return NextResponse.json({ error: "Could not queue mailbox sync." }, { status: 503 });
    }
}
