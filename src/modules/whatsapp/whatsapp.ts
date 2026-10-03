import { getPipelineControls } from "@/common/pipeline-controls";
import { saveUserSettings } from "@/database/user-settings";
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { decodeHtmlEntities } from '@/modules/email/ingestion/email-content';
import { sendGreetings24hTemplate } from './templates';

/**
 * WhatsApp Cloud Functions (2nd Gen) Client for Strike.
 * Dispatches outbound messages via the serverless GCP Cloud Function (whatsapp-send-mohit).
 */

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function assertDeliveryEnabled(userId?: string | null) {
  if (!userId) return;
  const { data, error } = await getSupabaseService().from('user_settings').select('notification_preferences').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Could not verify WhatsApp controls.');
  if (!getPipelineControls(data?.notification_preferences).send_whatsapp) throw new Error('WHATSAPP_PAUSED');
}

function getCloudFunctionUrl(): string {
  return (
    process.env.GCP_WHATSAPP_SEND_URL ||
    'https://whatsapp-send-mohit-wqegdna3ra-uc.a.run.app'
  );
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'template';

export interface SendMessageContent {
  body?: string;
  preview_url?: boolean;
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
}

export interface OutboundLogContext {
  user_id?: string | null;
  conversation_id?: string | null;
  text_body_override?: string | null;
  media_url_override?: string | null;
  extra?: Record<string, unknown>;
}

export class WhatsAppHttpError extends Error {
  constructor(public status: number, message: string, public metaCode?: string) { super(message); }
}

/**
 * Sends a WhatsApp message (Text, Media, or Template) via the GCP Cloud Function.
 */
export async function sendWhatsAppMessage(
  recipientPhone: string,
  messageType: MessageType,
  content: SendMessageContent,
  logCtx?: OutboundLogContext
) {
  await assertDeliveryEnabled(logCtx?.user_id);
  // Normalize phone number (strip whitespace and leading +)
  const cleanPhone = recipientPhone.replace(/[\s+-]/g, '');
  const functionUrl = getCloudFunctionUrl();

  const payload: Record<string, unknown> = {
    to: cleanPhone,
    type: messageType,
  };

  if (messageType === 'text') {
    if (!content.body) {
      throw new Error('Text messages require a body.');
    }
    payload.text = content.body;
  } else if (['image', 'video', 'audio', 'document'].includes(messageType)) {
    const mediaUrl = content.link || content.id;
    if (!mediaUrl) {
      throw new Error(`Either 'link' or 'id' must be provided for media type: ${messageType}`);
    }
    payload.media_url = mediaUrl;
    if (content.caption) payload.caption = content.caption;
  }

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let metaCode: string | undefined = undefined;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.code) {
        metaCode = String(parsed.error.code);
      } else if (parsed.code) {
        metaCode = String(parsed.code);
      }
    } catch (e) {}

    console.error('❌ Cloud Function WhatsApp Send Error:', response.status, errorText);
    const { logLayerError } = await import("@/common/logging/layer-logger");
    await logLayerError({
      layer: "delivery",
      severity: "error",
      errorCode: metaCode ? `WHATSAPP_HTTP_${metaCode}` : `WHATSAPP_HTTP_${response.status}`,
      errorMessage: `WhatsApp Cloud Function failed (${response.status}): ${errorText}`,
      userId: logCtx?.user_id,
      messageId: logCtx?.extra?.message_id as string | undefined,
      technicalDetails: { operation: "send", status: response.status },
    });
    throw new WhatsAppHttpError(response.status, `WhatsApp request failed (${response.status})`, metaCode);
  }

  const result = await response.json();
  if (logCtx) {
    // Email sends are durably recorded by the delivery outbox.
  }

  return result;
}

/**
 * Sends a WhatsApp Template Message via GCP Cloud Function.
 */
export async function sendWhatsAppTemplate(
  recipientPhone: string,
  templateName: string,
  languageCode: string = 'en_US',
  components?: Array<Record<string, unknown>>,
  logCtx?: OutboundLogContext
) {
  await assertDeliveryEnabled(logCtx?.user_id);
  const cleanPhone = recipientPhone.replace(/[\s+-]/g, '');
  const functionUrl = getCloudFunctionUrl();

  const payload: Record<string, unknown> = {
    to: cleanPhone,
    type: 'template',
    template_name: templateName,
    template_language: languageCode,
    ...(components && components.length > 0 ? { template_components: components } : {}),
  };

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let metaCode: string | undefined = undefined;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.code) {
        metaCode = String(parsed.error.code);
      } else if (parsed.code) {
        metaCode = String(parsed.code);
      }
    } catch (e) {}

    console.error('❌ Cloud Function WhatsApp Template Error:', response.status, errorText);
    const { logLayerError } = await import("@/common/logging/layer-logger");
    await logLayerError({
      layer: "delivery",
      severity: "error",
      errorCode: metaCode ? `WHATSAPP_TEMPLATE_HTTP_${metaCode}` : `WHATSAPP_TEMPLATE_HTTP_${response.status}`,
      errorMessage: `WhatsApp Template dispatch failed (${response.status}): ${errorText}`,
      userId: logCtx?.user_id,
      technicalDetails: { templateName, status: response.status, recipient: cleanPhone },
    });
    throw new WhatsAppHttpError(response.status, `Cloud Function WhatsApp Template Error (${response.status}): ${errorText}`, metaCode);
  }

  const result = await response.json();
  if (logCtx) {
    // Email sends are durably recorded by the delivery outbox.
  }

  return result;
}

/**
 * Sends rich formatted text message with action options.
 */
export async function sendWhatsAppInteractiveButtons(
  recipientPhone: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  _headerText?: string,
  _footerText?: string,
  _imageUrl?: string,
  logCtx?: OutboundLogContext
) {
  // Append quick options to bodyText for rich text delivery via the Cloud Function
  const optionsText = buttons.map((b, i) => `👉 *[${i + 1}]* ${b.title}`).join('\n');
  const fullText = `${bodyText}\n\n${optionsText}`;

  return sendWhatsAppMessage(
    recipientPhone,
    'text',
    { body: fullText },
    logCtx
  );
}

/**
 * High-level Strike Email Alert Dispatcher.
 * Formats AI triage, summary, and action items, and sends via the GCP Cloud Function.
 */
export interface StrikeEmailAlertParams {
  recipientPhone: string;
  sender?: string;
  subject: string;
  summaryText: string;
  rawPreviewText?: string;
  category?: string;
  importance?: number;
  actionItems?: Array<{ action: string; deadline?: string; assignee?: string }>;
  emailMessageId: string;
  userId?: string;
  isWindowClosed?: boolean;
}

export async function sendStrikeEmailAlert(params: StrikeEmailAlertParams) {
  const isUrgent = (params.importance ?? 0) >= 0.8 || params.category?.toUpperCase() === 'URGENT';
  const headerBadge = isUrgent ? '🚨 *[URGENT EMAIL]*' : '⚡ *[IMPORTANT EMAIL]*';

  // Decode HTML entities and strip redundant prefixes
  const cleanSender = params.sender ? decodeHtmlEntities(params.sender) : undefined;
  const cleanSubject = decodeHtmlEntities(params.subject || '(No Subject)');
  let cleanSummary = decodeHtmlEntities(params.summaryText || '');
  cleanSummary = cleanSummary.replace(/^(Executive\s+summary|Summary|Brief):\s*/i, '').trim();

  // If the 24-hour user messaging window is closed, free-form text messages will fail (Meta Error 131047).
  // We must fallback to using an approved WhatsApp template to deliver the notification.
  if (params.isWindowClosed) {
    const { formatTemplateComponents, WHATSAPP_TEMPLATES } = await import('./templates');
    const template = WHATSAPP_TEMPLATES.URGENT_EMAIL_ALERT;
    
    // URGENT_EMAIL_ALERT requires exactly 3 variables: sender, subject, summary
    const components = formatTemplateComponents(template, [
      (cleanSender || 'Unknown').substring(0, 50),
      cleanSubject.substring(0, 50),
      cleanSummary.substring(0, 150) // Truncate to avoid template character limits
    ]);
    
    return sendWhatsAppTemplate(
      params.recipientPhone,
      template.name,
      template.language,
      components,
      {
        user_id: params.userId,
        extra: { message_id: params.emailMessageId },
      }
    );
  }

  const bodyLines: string[] = [
    `${headerBadge}`,
    '',
    cleanSender ? `👤 *From:* ${cleanSender}` : '',
    `📌 *Subject:* ${cleanSubject}`,
    params.category ? `🏷️ *Category:* ${params.category.toUpperCase()}` : '',
    '',
    '📝 *Summary:*',
    cleanSummary,
  ].filter(Boolean);

  if (params.actionItems && params.actionItems.length > 0) {
    bodyLines.push('');
    bodyLines.push('✅ *Action Items:*');
    for (const item of params.actionItems) {
      const cleanAction = decodeHtmlEntities(item.action);
      const cleanDue = item.deadline && item.deadline !== 'None' ? ` _(Due: ${decodeHtmlEntities(item.deadline)})_` : '';
      bodyLines.push(`• ${cleanAction}${cleanDue}`);
    }
  }

  bodyLines.push('');
  bodyLines.push('🚀 _Strike Email Intelligence_');

  const messageText = params.rawPreviewText ?? bodyLines.join('\n');

  return sendWhatsAppMessage(
    params.recipientPhone,
    'text',
    { body: messageText },
    {
      user_id: params.userId,
      text_body_override: messageText,
      extra: { message_id: params.emailMessageId },
    }
  );
}

/**
 * Re-opens or refreshes the 24-hour customer messaging window for a user upon receiving an inbound WhatsApp message.
 */
export async function openWhatsApp24hWindow(
  supabase: ReturnType<typeof getSupabaseService>,
  userId: string,
  fromPhone: string,
  inboundText?: string | null
): Promise<void> {
  try {
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('id, notification_preferences')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsError) throw settingsError;
    if (!userSettings) return;

    const existingPrefs = (userSettings.notification_preferences as Record<string, unknown>) || {};
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { error: saveError } = await saveUserSettings(supabase, { user_id: userId, notification_preferences: {
      last_inbound_at: now.toISOString(), window_status: 'OPEN', window_expires_at: expiresAt.toISOString(),
      last_inbound_text: inboundText || existingPrefs.last_inbound_text || null,
    }});
    if (saveError) throw saveError;

    // Record system audit event
    await supabase.from('system_events').insert({
      user_id: userId,
      event_type: 'WHATSAPP_WINDOW_OPENED',
      entity_type: 'user_settings',
      entity_id: userSettings.id,
      severity: 'info',
      payload: {
        from_phone: fromPhone,
        inbound_text: inboundText,
        window_expires_at: expiresAt.toISOString(),
      },
      occurred_at: now.toISOString(),
    });
  } catch (err) {
    throw err;
  }
}

/**
 * Flushes and delivers all stacked / pending high-priority email alerts from the last 24 hours to the user on WhatsApp.
 */
export async function flushStackedEmailAlerts(
  supabase: ReturnType<typeof getSupabaseService>, userId: string, recipientPhone: string,
): Promise<{ flushedCount: number; messagesDelivered: string[] }> {
  // Only flush emails that actually reached delivery. Never generate AI work from a reply.
  const { data: settings, error: settingsError } = await supabase.from('user_settings').select('notification_preferences, whatsapp_destination').eq('user_id', userId).maybeSingle();
  if (settingsError || !getPipelineControls(settings?.notification_preferences).send_whatsapp || settings?.whatsapp_destination?.replace(/\D/g, '') !== recipientPhone.replace(/\D/g, '')) return { flushedCount: 0, messagesDelivered: [] };
  // Reply handling never sends inline; scheduled workers claim the durable outbox.
  await supabase.from('delivery_outbox').update({status:'pending',error_code:null,error_message:null})
    .eq('user_id',userId).eq('status','failed').eq('error_code','131047').throwOnError();
  return { flushedCount: 0, messagesDelivered: [] };
}

/**
 * Checks all users for 24-hour windows that are about to expire (within 1 hour)
 * and sends the GREETINGS_24H_WINDOW template to prompt a reply and reset the window.
 */
export async function checkAndRenew24hWindows(db: SupabaseClient): Promise<{ processed: number; sent: number }> {
  // Find users with an OPEN window expiring in less than 1 hour (but not already expired)
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  const { data: users, error } = await db
    .from('user_settings')
    .select('user_id, whatsapp_destination, notification_preferences')
    .not('whatsapp_destination', 'is', null);

  if (error || !users) return { processed: 0, sent: 0 };

  let sent = 0;
  for (const user of users) {
    const prefs = (user.notification_preferences as Record<string, unknown>) || {};
    if (!prefs.window_expires_at || prefs.window_status !== 'OPEN') continue;

    const expiresAt = new Date(prefs.window_expires_at as string);
    // If it expires within the next 1 hour, and we haven't already marked it as PROMPTED
    if (expiresAt > now && expiresAt <= oneHourFromNow) {
      try {
        await sendGreetings24hTemplate(user.whatsapp_destination, "there");
        
        // Mark as prompted so we don't spam them every minute for the last hour
        await db.from('user_settings').update({
          notification_preferences: {
            ...prefs,
            window_status: 'PROMPTED'
          }
        }).eq('user_id', user.user_id);
        
        sent++;
      } catch (err) {
        console.error(`Failed to send 24h renewal template to ${user.user_id}:`, err);
      }
    } else if (expiresAt <= now) {
      // It has fully expired, mark as closed
      await db.from('user_settings').update({
        notification_preferences: {
          ...prefs,
          window_status: 'CLOSED'
        }
      }).eq('user_id', user.user_id);
    }
  }

  return { processed: users.length, sent };
}
