import { saveUserSettings } from "@/database/user-settings";
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
            console.log(
              `📋 WhatsApp Status update: ${status.status} for msg ${status.id} (${status.recipient_id})`
            );

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

              // If Meta reports failure due to expired 24h window (code 131047 / "24 hours")
              if (dbStatus === 'failed') {
                const isWindowExpiredError = status.errors?.some(
                  (e) =>
                    e.code === 131047 ||
                    (e.message && e.message.toLowerCase().includes('24 hours'))
                );

                if (isWindowExpiredError) {
                  // 1. Find message_id and convert status to DELIVERY_PENDING
                  const { data: attempt } = await supabaseAdmin
                    .from('delivery_attempts')
                    .select('message_id')
                    .eq('provider_message_id', status.id)
                    .maybeSingle();

                  if (attempt?.message_id) {
                    await supabaseAdmin
                      .from('email_messages')
                      .update({ processing_status: 'DELIVERY_PENDING' })
                      .eq('id', attempt.message_id);
                  }

                  // 2. Mark window as closed in user_settings
                  const cleanPhone = (status.recipient_id || '').replace(/\D/g, '');
                  const { data: allSettings } = await supabaseAdmin
                    .from('user_settings')
                    .select('id, user_id, whatsapp_destination, notification_preferences')
                    .not('whatsapp_destination', 'is', null);

                  const userSetting = (allSettings || []).find((s) => {
                    const destDigits = (s.whatsapp_destination || '').replace(/\D/g, '');
                    return (
                      destDigits === cleanPhone ||
                      destDigits.endsWith(cleanPhone) ||
                      cleanPhone.endsWith(destDigits)
                    );
                  });

                  if (userSetting) {
                    await saveUserSettings(supabaseAdmin, { user_id: userSetting.user_id, notification_preferences: { window_status: 'CLOSED' } });
                  }
                }
              }
            }
          }
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

          const matchedSetting = (allSettings || []).find((s) => {
            const destDigits = (s.whatsapp_destination || '').replace(/\D/g, '');
            return (
              destDigits === cleanFromDigits ||
              destDigits.endsWith(cleanFromDigits) ||
              cleanFromDigits.endsWith(destDigits)
            );
          });

          const userId = matchedSetting?.user_id;

          // 2. Open / Refresh 24-Hour Messaging Window & Flush Stacked Emails
          if (userId) {
            const inboundText = msg.text?.body || msg.interactive?.button_reply?.title || null;
            const { openWhatsApp24hWindow, flushStackedEmailAlerts, sendWhatsAppMessage } =
              await import('@/modules/whatsapp');

            // Re-open window in database and system audit log
            await openWhatsApp24hWindow(supabaseAdmin, userId, fromPhone, inboundText);

            // Handle Interactive Button Replies (e.g. "Mark Read", "Archive", "Open Strike")
            let handledAction = false;
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
                handledAction = true;
                const msgIdPrefix = buttonId.replace(/^(read_|archive_|handled_)/, '');

                // 1. Locate message
                const { data: emailMsg } = await supabaseAdmin
                  .from('email_messages')
                  .select('id, account_id, provider_message_id')
                  .ilike('id', `${msgIdPrefix}%`)
                  .limit(1)
                  .maybeSingle();

                if (emailMsg) {
                  // 2. Update status in database
                  await supabaseAdmin
                    .from('email_messages')
                    .update({ processing_status: 'PROCESSED' })
                    .eq('id', emailMsg.id);

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

            // Flush stacked email alerts from last 24 hours
            const destinationPhone = matchedSetting.whatsapp_destination || fromPhone;
            const flushResult = await flushStackedEmailAlerts(
              supabaseAdmin,
              userId,
              destinationPhone
            );

            console.log(
              `🚀 Flushed ${flushResult.flushedCount} stacked email alert(s) for user ${userId}`
            );

            // If user sent a greeting or quick action and NO stacked emails were waiting, send reassurance
            if (flushResult.flushedCount === 0 && !handledAction) {
              const rawText = (
                msg.text?.body ||
                msg.interactive?.button_reply?.title ||
                ''
              )
                .trim()
                .toLowerCase();
              const isGreetingOrAck =
                rawText === 'hi' ||
                rawText === 'hello' ||
                rawText === 'hey' ||
                rawText === 'activate stream' ||
                rawText === 'ready for briefing' ||
                rawText === 'view inbox' ||
                msg.interactive?.button_reply?.id === 'ACTIVATE_STREAM' ||
                msg.interactive?.button_reply?.id === 'START_DAY' ||
                msg.interactive?.button_reply?.id === 'VIEW_INBOX';

              if (isGreetingOrAck) {
                const ackText = [
                  '⚡ *Strike Intelligence: Connected & Active* ⚡',
                  '',
                  'Your 24-hour priority briefing window is now *ACTIVE*.',
                  '• You are completely caught up with your inbox.',
                  '• You will receive instant AI executive summaries when high-priority emails arrive.',
                  '',
                  '🚀 _Strike Email Intelligence Dashboard_',
                ].join('\n');

                try {
                  await sendWhatsAppMessage(
                    destinationPhone,
                    'text',
                    { body: ackText },
                    { user_id: userId }
                  );
                } catch (ackErr) {
                  console.warn('Could not send window active ack message:', ackErr);
                }
              }
            }
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
