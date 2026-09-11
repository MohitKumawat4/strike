import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/database/supabase/server";
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
  const { error } = await saveUserSettings(supabase, {
    user_id: user.id,
    notification_preferences: { pipeline: parsed.data },
  });
  if (error)
    return NextResponse.json(
      { error: "Could not save controls. Please try again." },
      { status: 500 },
    );
  return NextResponse.json({ pipeline: parsed.data });
}
