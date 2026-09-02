import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/database/supabase/server";
import { sendWhatsAppMessage, sendWhatsAppInteractiveButtons } from "@/modules/whatsapp";

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

    const messageText = [
      "⚡ *Strike WhatsApp Integration Active*",
      "",
      `Your WhatsApp number (*${destinationPhone}*) is successfully connected to Strike!`,
      "",
      "📌 *What to expect:*",
      "• Automated AI summaries for high-priority & urgent emails.",
      "• Action items and deadline extraction delivered in real-time.",
      "• Interactive quick-actions directly from WhatsApp.",
      "",
      "🚀 _Strike Email Intelligence Dashboard_",
    ].join("\n");

    let result;
    try {
      result = await sendWhatsAppInteractiveButtons(
        destinationPhone,
        messageText,
        [
          { id: "test_ack", title: "Awesome!" },
          { id: "test_dash", title: "Open Strike" },
        ],
        undefined,  // headerText
        undefined,  // footerText
        undefined,  // imageUrl
        { user_id: user.id, text_body_override: messageText }
      );
    } catch {
      // Fallback to text if interactive buttons are rejected
      result = await sendWhatsAppMessage(
        destinationPhone,
        "text",
        { body: messageText },
        { user_id: user.id }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test WhatsApp notification sent successfully!",
      result,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Failed to send test WhatsApp message:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
