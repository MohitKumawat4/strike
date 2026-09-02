import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string; description?: string };
          };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code: number; title: string; message: string }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

// ─── GET: Meta Webhook Verification ──────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'strike_whatsapp_verify_token_2026';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ WhatsApp webhook verified successfully');
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  console.warn('❌ WhatsApp webhook verification failed. Token mismatch or missing mode.');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ─── POST: Incoming Messages & Status Callbacks ──────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: WhatsAppWebhookPayload = await request.json();

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const { value } = change;

        // 1. Process Status Callbacks (sent, delivered, read, failed)
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            console.log(`📋 WhatsApp Status update: ${status.status} for msg ${status.id} (${status.recipient_id})`);

            if (status.id) {
              const dbStatus =
                status.status === 'delivered' || status.status === 'read'
                  ? 'delivered'
                  : status.status === 'failed'
                  ? 'failed'
                  : 'sending';

              await supabaseAdmin
                .from('delivery_attempts')
                .update({
                  status: dbStatus,
                  ...(dbStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
                  ...(dbStatus === 'failed'
                    ? {
                        failed_at: new Date().toISOString(),
                        error_code: status.errors?.[0]?.message || 'META_DELIVERY_FAILED',
                      }
                    : {}),
                })
                .eq('provider_message_id', status.id);
            }
          }
        }

        // 2. Process Inbound Messages and Interactive Button Replies
        const messages = value.messages || [];
        for (const msg of messages) {
          const fromPhone = msg.from;
          const msgId = msg.id;

          console.log(`📱 Inbound WhatsApp message from ${fromPhone}, type: ${msg.type}`);

          // Handle Interactive Button Replies (e.g. "Mark Read", "Open Strike")
          if (msg.type === 'interactive' && msg.interactive?.button_reply) {
            const buttonId = msg.interactive.button_reply.id;
            const buttonTitle = msg.interactive.button_reply.title;
            console.log(`🔘 Button tapped: "${buttonTitle}" (ID: ${buttonId})`);

            // If user clicked "Mark Read" (ID format: read_<messageIdPrefix>)
            if (buttonId.startsWith('read_')) {
              const msgIdPrefix = buttonId.replace('read_', '');
              // Find matching message in delivery_attempts or email_messages
              const { data: attempt } = await supabaseAdmin
                .from('delivery_attempts')
                .select('message_id')
                .ilike('message_id', `${msgIdPrefix}%`)
                .limit(1)
                .maybeSingle();

              if (attempt?.message_id) {
                await supabaseAdmin
                  .from('email_messages')
                  .update({ processing_status: 'PROCESSED' })
                  .eq('id', attempt.message_id);

                console.log(`✅ Marked email message ${attempt.message_id} as processed via WhatsApp action`);
              }
            }
          }

          // Optional: Store inbound message in whatsapp_messages if table exists
          try {
            await supabaseAdmin
              .from('whatsapp_messages')
              .insert([
                {
                  wa_message_id: msgId,
                  phone_number: fromPhone,
                  direction: 'inbound',
                  message_type: msg.type,
                  text_body: msg.text?.body || msg.interactive?.button_reply?.title || null,
                },
              ]);
          } catch {
            // Table may not exist yet — non-fatal
          }

        }
      }
    }

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('❌ Webhook error:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
