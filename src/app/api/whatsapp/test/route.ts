import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/database/supabase/server";
import {
  sendWelcomeOnboardingTemplate,
  sendWhatsAppInteractiveButtons,
  sendWhatsAppMessage,
} from "@/modules/whatsapp";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { destinationPhone } = body;

    if (!destinationPhone || typeof destinationPhone !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid destination phone number with country code (e.g. +919876543210)" },
        { status: 400 }
      );
    }

    const cleanPhone = destinationPhone.trim();
    const displayName = user.email ? user.email.split("@")[0] : "there";

    let result;
    try {
      // 1. Primary Dispatcher: Meta Utility Template (delivers 24/7 without requiring prior 'Hi' message)
      result = await sendWelcomeOnboardingTemplate(
        cleanPhone,
        displayName,
        { user_id: user.id }
      );
    } catch (templateErr) {
      console.warn("Template delivery fallback to interactive/text:", templateErr);
      
      const messageText = [
        "⚡ *Strike WhatsApp Integration Active*",
        "",
        `Your WhatsApp number (*${cleanPhone}*) is successfully connected to Strike!`,
        "",
        "📌 *What to expect:*",
        "• Automated AI summaries for high-priority & urgent emails.",
        "• Action items and deadline extraction delivered in real-time.",
        "• Interactive quick-actions directly from WhatsApp.",
        "",
        "🚀 _Strike Email Intelligence Dashboard_",
      ].join("\n");

      try {
        result = await sendWhatsAppInteractiveButtons(
          cleanPhone,
          messageText,
          [
            { id: "test_ack", title: "Activate Stream" },
            { id: "test_dash", title: "Open Dashboard" },
          ],
          undefined,
          undefined,
          undefined,
          { user_id: user.id, text_body_override: messageText }
        );
      } catch {
        result = await sendWhatsAppMessage(
          cleanPhone,
          "text",
          { body: messageText },
          { user_id: user.id }
        );
      }
    }

    // 2. Persist verified recipient number to database
    await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        whatsapp_destination: cleanPhone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({
      success: true,
      message: "Welcome Brief dispatched directly to your WhatsApp!",
      result,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Failed to send welcome WhatsApp message:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
