import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds

/**
 * Validates the X-Hub-Signature-256 header sent by Meta to ensure the webhook payload
 * has not been tampered with and genuinely originates from Meta.
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const signature = signatureHeader.slice(7);
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
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
          button?: { payload: string; text: string };
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

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (verifyToken && mode === 'subscribe' && token === verifyToken) {
    console.log('✅ WhatsApp webhook verified successfully');
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  console.warn('❌ WhatsApp webhook verification failed. Token mismatch or missing mode.');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ─── POST: Incoming Messages & Status Callbacks ──────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const appSecret = process.env.META_APP_SECRET;

    // Verify Meta X-Hub-Signature-256 when META_APP_SECRET is configured
    if (!appSecret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    {
      const signatureHeader = request.headers.get('x-hub-signature-256');
      if (!verifyMetaSignature(rawBody, signatureHeader, appSecret)) {
        console.warn('❌ WhatsApp webhook signature verification failed.');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body: WhatsAppWebhookPayload = JSON.parse(rawBody);

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const { value } = change;

        // Receipts can arrive before send acknowledgement; store and reconcile atomically.
        for (const status of value.statuses || []) {
          const { error } = await supabaseAdmin.rpc("strike_delivery_receipt", {
            p_provider: status.id, p_status: status.status,
            p_at: new Date(Number(status.timestamp) * 1000).toISOString(),
            p_error: status.errors?.[0]?.code?.toString() || null,
          });
          if (error) throw error;
        }

        // 2. Process Inbound Messages and Interactive Button Replies
        const messages = value.messages || [];
        for (const msg of messages) {
          const fromPhone = msg.from;
          const cleanFromDigits = fromPhone.replace(/\D/g, '');
          const msgId = msg.id;

          console.log(`📱 Inbound WhatsApp message from ${fromPhone}, type: ${msg.type}`);

          // 1. Locate user in user_settings matching phone number
          const { data: allSettings } = await supabaseAdmin
            .from('user_settings')
            .select('id, user_id, whatsapp_destination, notification_preferences')
            .not('whatsapp_destination', 'is', null);

          const matchedSettings = (allSettings || []).filter((s) => {
            const destDigits = (s.whatsapp_destination || '').replace(/\D/g, '');
            return (
              destDigits.length > 0 && destDigits === cleanFromDigits
            );
          });

          const matchedSetting = matchedSettings.length === 1 ? matchedSettings[0] : null;
          const userId = matchedSetting?.user_id;

          // 2. Open / Refresh 24-Hour Messaging Window, Send Activation Briefing & Flush Stacked Emails
          if (userId) {
            const buttonPayload = msg.button?.payload || msg.interactive?.button_reply?.id || null;
            const inboundText = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || null;
            const { openWhatsApp24hWindow, flushStackedEmailAlerts, sendWhatsAppMessage } =
              await import('@/modules/whatsapp');
            const { runDeliveryOutbox } = await import('@/modules/whatsapp/outbox');

            // Re-open 24-hour messaging window in database and system audit log
            await openWhatsApp24hWindow(supabaseAdmin, userId, fromPhone, inboundText);

            // Detect if this is an activation button tap or greeting re-engagement
            const isActivationOrBriefing =
              buttonPayload === 'ACTIVATE_STREAM' ||
              buttonPayload === 'START_DAY' ||
              buttonPayload === 'VIEW_INBOX' ||
              buttonPayload === 'test_ack' ||
              /^(hi|hello|hey|start|activate|stream|briefing|inbox)/i.test((inboundText || '').trim());

            if (isActivationOrBriefing) {
              try {
                // Fetch emails received in the last 24 hours for this user
                const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const { data: recentEmails } = await supabaseAdmin
                  .from('email_messages')
                  .select('id, subject, snippet, received_at, sender')
                  .eq('user_id', userId)
                  .gte('received_at', since)
                  .order('received_at', { ascending: false })
                  .limit(5);

                const lines: string[] = [
                  '⚡ *Strike Stream Activated!*',
                  'Your 24-hour live messaging window is now open.',
                  '',
                ];

                if (recentEmails && recentEmails.length > 0) {
                  lines.push(`📬 *Priority Briefing (${recentEmails.length} message(s) in last 24h):*`);
                  lines.push('');
                  for (const [idx, em] of recentEmails.entries()) {
                    const senderRaw = typeof em.sender === 'object' && em.sender?.raw ? em.sender.raw : String(em.sender || 'Unknown');
                    const snippet = em.snippet || '(No preview available)';
                    lines.push(`*${idx + 1}. ${em.subject || '(No Subject)'}*`);
                    lines.push(`👤 *From:* ${senderRaw}`);
                    lines.push(`📝 ${snippet.slice(0, 160)}${snippet.length > 160 ? '...' : ''}`);
                    lines.push('');
                  }
                } else {
                  lines.push('✨ You are all caught up! No urgent emails arrived in the last 24 hours.');
                  lines.push('Strike will alert you instantly when a new important email arrives.');
                  lines.push('');
                }

                lines.push('🚀 _Strike Email Intelligence_');

                // Deliver activation briefing directly in WhatsApp
                await sendWhatsAppMessage(
                  fromPhone,
                  'text',
                  { body: lines.join('\n') },
                  { user_id: userId }
                );
              } catch (briefingErr) {
                console.error('Error sending activation briefing via WhatsApp:', briefingErr);
              }
            }

            // Handle Interactive Button Replies (e.g. "Mark Read", "Archive", "Open Strike")
            if (msg.type === 'interactive' && msg.interactive?.button_reply) {
              const buttonId = msg.interactive.button_reply.id;
              const buttonTitle = msg.interactive.button_reply.title;
              console.log(`🔘 Button tapped: "${buttonTitle}" (ID: ${buttonId})`);

              // Check for message action (read_, archive_, handled_)
              if (
                buttonId.startsWith('read_') ||
                buttonId.startsWith('archive_') ||
                buttonId.startsWith('handled_')
              ) {
                const msgIdPrefix = buttonId.replace(/^(read_|archive_|handled_)/, '');

                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msgIdPrefix)) continue;
                // 1. Locate the exact message owned by this recipient
                const { data: emailMsg } = await supabaseAdmin
                  .from('email_messages')
                  .select('id, account_id, provider_message_id')
                  .eq('id', msgIdPrefix)
                  .eq('user_id', userId)
                  .limit(1)
                  .maybeSingle();

                if (emailMsg) {
                  // 3. Perform 2-Way Sync to Gmail if account token exists
                  try {
                    const { data: account } = await supabaseAdmin
                      .from('email_accounts')
                      .select('encrypted_refresh_token')
                      .eq('id', emailMsg.account_id)
                      .single();

                    if (account?.encrypted_refresh_token && emailMsg.provider_message_id) {
                      const { modifyGmailMessage } = await import(
                        '@/modules/email/providers/gmail/gmail.client'
                      );

                      const isArchive =
                        buttonId.startsWith('archive_') || buttonId.startsWith('handled_');
                      await modifyGmailMessage(
                        account.encrypted_refresh_token,
                        emailMsg.provider_message_id,
                        {
                          removeLabelIds: isArchive ? ['UNREAD', 'INBOX'] : ['UNREAD'],
                        }
                      );
                      console.log(
                        `✅ Synced action to Gmail for message ${emailMsg.provider_message_id}`
                      );
                    }
                  } catch (gmailSyncErr) {
                    console.warn(
                      'Could not sync action to Gmail directly (may have readonly scope):',
                      gmailSyncErr
                    );
                  }

                  console.log(
                    `✅ Marked email message ${emailMsg.id} as processed via WhatsApp action`
                  );
                }
              }
            }

            // Flush stacked email alerts from last 24 hours and trigger outbox send
            const destinationPhone = matchedSetting.whatsapp_destination || fromPhone;
            const flushResult = await flushStackedEmailAlerts(
              supabaseAdmin,
              userId,
              destinationPhone
            );

            console.log(
              `🚀 Flushed ${flushResult.flushedCount} stacked email alert(s) for user ${userId}`
            );

            // Immediately drain outbox now that window is active
            await runDeliveryOutbox(supabaseAdmin, userId);
          }

          // Optional: Store inbound message in whatsapp_messages if table exists
          try {
            await supabaseAdmin.from('whatsapp_messages').insert([
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
