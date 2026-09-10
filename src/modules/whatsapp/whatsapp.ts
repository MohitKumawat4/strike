import { createClient } from '@supabase/supabase-js';
import { decodeHtmlEntities } from '@/modules/email/ingestion/initial-sync';

/**
 * WhatsApp Cloud Functions (2nd Gen) Client for Strike.
 * Dispatches outbound messages via the serverless GCP Cloud Function (whatsapp-send-mohit).
 */

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
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

/**
 * Logs message delivery attempt to Supabase for auditability.
 */
async function logDeliveryAttempt(
  result: Record<string, unknown>,
  recipientPhone: string,
  logCtx?: OutboundLogContext
): Promise<void> {
  if (!logCtx) return;
  try {
    const supabaseService = getSupabaseService();
    const metaResponse = (result?.meta_response as Record<string, unknown>) || {};
    const messages = (metaResponse?.messages as Array<{ id: string }>) || [];
    const waId = messages[0]?.id || `out_${Date.now()}`;

    const emailMsgId = logCtx.extra?.message_id as string | undefined;
    if (emailMsgId) {
      await supabaseService.from('delivery_attempts').insert([
        {
          message_id: emailMsgId,
          channel: 'whatsapp',
          provider_message_id: waId,
          idempotency_key: `wa_${emailMsgId}_${Date.now()}`,
          status: 'sending',
          attempt_no: 1,
          sent_at: new Date().toISOString(),
        },
      ]);
    }
  } catch (err) {
    console.error('Failed to log delivery attempt in Supabase:', err);
  }
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Cloud Function WhatsApp Send Error:', response.status, errorText);
    const { logLayerError } = await import("@/common/logging/layer-logger");
    await logLayerError({
      layer: "delivery",
      severity: "error",
      errorCode: `WHATSAPP_HTTP_${response.status}`,
      errorMessage: `WhatsApp Cloud Function failed (${response.status}): ${errorText}`,
      userId: logCtx?.user_id,
      messageId: logCtx?.extra?.message_id as string | undefined,
      technicalDetails: { status: response.status, recipient: cleanPhone, payload },
    });
    throw new Error(`Cloud Function WhatsApp Send Error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  if (logCtx) {
    void logDeliveryAttempt(result, cleanPhone, logCtx);
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Cloud Function WhatsApp Template Error:', response.status, errorText);
    const { logLayerError } = await import("@/common/logging/layer-logger");
    await logLayerError({
      layer: "delivery",
      severity: "error",
      errorCode: `WHATSAPP_TEMPLATE_HTTP_${response.status}`,
      errorMessage: `WhatsApp Template dispatch failed (${response.status}): ${errorText}`,
      userId: logCtx?.user_id,
      technicalDetails: { templateName, status: response.status, recipient: cleanPhone },
    });
    throw new Error(`Cloud Function WhatsApp Template Error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  if (logCtx) {
    void logDeliveryAttempt(result, cleanPhone, logCtx);
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
  category?: string;
  importance?: number;
  actionItems?: Array<{ action: string; deadline?: string; assignee?: string }>;
  emailMessageId: string;
  userId?: string;
}

export async function sendStrikeEmailAlert(params: StrikeEmailAlertParams) {
  const isUrgent = (params.importance ?? 0) >= 0.8 || params.category?.toUpperCase() === 'URGENT';
  const headerBadge = isUrgent ? '🚨 *[URGENT EMAIL]*' : '⚡ *[IMPORTANT EMAIL]*';

  // Decode HTML entities and strip redundant prefixes
  const cleanSender = params.sender ? decodeHtmlEntities(params.sender) : undefined;
  const cleanSubject = decodeHtmlEntities(params.subject || '(No Subject)');
  let cleanSummary = decodeHtmlEntities(params.summaryText || '');
  cleanSummary = cleanSummary.replace(/^(Executive\s+summary|Summary|Brief):\s*/i, '').trim();

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

  const messageText = bodyLines.join('\n');

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
