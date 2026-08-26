import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/database/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    // Delete the account from email_accounts (cascades to related messages/jobs)
    const { error: deleteError } = await supabase
      .from("email_accounts")
      .delete()
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Account disconnected successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to disconnect account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
