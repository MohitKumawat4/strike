import { createClient } from '@supabase/supabase-js';

/**
 * WhatsApp Cloud API (Outbound) Engine for Strike.
 * Fully native Next.js/TypeScript implementation for Meta Graph API v25.0.
 */

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const API_VERSION = 'v25.0';

// Module-level dynamic env accessors for backwards-compatible send functions
function getAccessToken(): string {
  return process.env.WHATSAPP_ACCESS_TOKEN || '';
}
function getPhoneNumberId(): string {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || '';
}
// Keep legacy const references as function calls so existing code compiles
const WHATSAPP_ACCESS_TOKEN = (() => process.env.WHATSAPP_ACCESS_TOKEN)();
const WHATSAPP_PHONE_NUMBER_ID = (() => process.env.WHATSAPP_PHONE_NUMBER_ID)();
void WHATSAPP_ACCESS_TOKEN;
void WHATSAPP_PHONE_NUMBER_ID;

export interface OutboundLogContext {
  user_id?: string | null;
  conversation_id?: string | null;
  /** Human-readable text override for interactive messages */
  text_body_override?: string | null;
  /** Media URL override */
  media_url_override?: string | null;
  /** Extra fields merged into the DB row (debug_info, credits_charged, intent, etc.) */
  extra?: Record<string, unknown>;
}

async function logOutbound(
  result: Record<string, unknown>,
  recipientPhone: string,
  messageType: string,
  defaultTextBody: string | null,
  defaultMediaUrl: string | null,
  logCtx: OutboundLogContext,
): Promise<void> {
  try {
    const supabaseService = getSupabaseService();
    const waId = (result?.messages as Array<{ id: string }>)?.[0]?.id || `out_${Date.now()}`;

    // 1. Log to delivery_attempts if an email message_id was provided
    const emailMsgId = logCtx.extra?.message_id as string | undefined;
    if (emailMsgId) {
      await supabaseService.from('delivery_attempts').insert([{
        message_id: emailMsgId,
        channel: 'whatsapp',
        provider_message_id: waId,
        idempotency_key: `wa_${emailMsgId}_${Date.now()}`,
        status: 'sending',
        attempt_no: 1,
        sent_at: new Date().toISOString(),
      }]);
    }

    // 2. Safe log to whatsapp_messages table if configured
    try {
      await supabaseService.from('whatsapp_messages').insert([{
        wa_message_id: waId,
        phone_number: recipientPhone,
        user_id: logCtx.user_id ?? null,
        direction: 'outbound',
        message_type: messageType,
        text_body: logCtx.text_body_override !== undefined ? logCtx.text_body_override : defaultTextBody,
        media_url: logCtx.media_url_override !== undefined ? logCtx.media_url_override : defaultMediaUrl,
        conversation_id: logCtx.conversation_id ?? null,
        n8n_forwarded: false,
        ...(logCtx.extra ?? {}),
      }]);
    } catch {
      // Table may not exist yet — non-fatal
    }
  } catch (err) {
    console.error('Failed to log outbound WhatsApp message:', err);
  }
}

async function compressAndUploadImage(imageUrl: string): Promise<string> {
  try {
    console.log(`🔄 Reactively compressing image for WhatsApp: ${imageUrl}`);
    const response = await fetch(imageUrl);
    if (!response.ok) return imageUrl;
    
    const buffer = await response.arrayBuffer();
    
    // Dynamic import to prevent bundling issues in non-Node environments
    const sharp = (await import('sharp')).default;
    
    const compressedBuffer = await sharp(Buffer.from(buffer))
      .jpeg({ quality: 80, mozjpeg: true })
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .toBuffer();
      
    const filename = `wa_retry_comp_${Date.now()}.jpg`;
    const svc = getSupabaseService();
    const { error } = await svc.storage
      .from('generated-designs')
      .upload(`compressed/${filename}`, compressedBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });
      
    if (error) throw error;
    
    const { data } = await svc.storage
      .from('generated-designs')
      .createSignedUrl(`compressed/${filename}`, 3600 * 24 * 7); // 7 days
      
    return data?.signedUrl || imageUrl;
  } catch (err) {
    console.error('❌ Failed to compress/upload image for WhatsApp retry:', err);
    return imageUrl;
  }
}

/**
 * Executes a request to the WhatsApp API.
 * If it fails due to media size limits (error 131053), it attempts to
 * reactively compress all image links in the payload and retries once.
 */
async function executeWhatsAppRequest(payload: any) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp environment variables (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN) are not configured.');
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
  
  const performRequest = async (currentPayload: any) => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(currentPayload),
    });
  };

  // Find and compress all image links in the payload
  const processLinks = async (obj: any, proactive: boolean = false) => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      if (key === 'link' && typeof obj[key] === 'string' && obj[key].startsWith('http')) {
        const isVideo = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(obj[key]);
        if (isVideo) {
          if (proactive) {
            try {
              const headRes = await fetch(obj[key], { method: 'HEAD' });
              const size = parseInt(headRes.headers.get('content-length') || '0', 10);
              const WA_VIDEO_LIMIT = 16 * 1024 * 1024; // 16MB WhatsApp video limit
              if (size > WA_VIDEO_LIMIT) {
                console.warn(`⚠️ Video size ${size} bytes (${(size / 1024 / 1024).toFixed(1)}MB) exceeds WhatsApp 16MB limit. Sending anyway — WhatsApp may reject it.`);
              } else {
                console.log(`✅ Video size ${size} bytes (${(size / 1024 / 1024).toFixed(1)}MB) — within WhatsApp 16MB limit.`);
              }
            } catch (e) {
              console.warn('Failed to HEAD video size, sending anyway:', e);
            }
          }
          continue;
        }
        let shouldCompress = !proactive;
        if (proactive) {
          try {
            const headRes = await fetch(obj[key], { method: 'HEAD' });
            const size = parseInt(headRes.headers.get('content-length') || '0', 10);
            if (size > 4.5 * 1024 * 1024) { // Proactively compress if > 4.5MB
              console.log(`⚠️ Image size ${size} exceeds 4.5MB limit. Proactively compressing...`);
              shouldCompress = true;
            }
          } catch (e) {
            console.warn('Failed to HEAD image size, will try sending anyway:', e);
          }
        }

        if (shouldCompress) {
          obj[key] = await compressAndUploadImage(obj[key]);
        }
      } else {
        await processLinks(obj[key], proactive);
      }
    }
  };

  // Proactively check image sizes before sending
  const payloadCopy = JSON.parse(JSON.stringify(payload));
  await processLinks(payloadCopy, true);

  let response = await performRequest(payloadCopy);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorCode = errorData.error?.code || errorData.code;
    
    // Check for "Media upload error" / size limit (131053)
    if (errorCode === 131053) {
      console.warn('⚠️ WhatsApp size limit hit (131053). Reactively compressing images and retrying...');
      
      // Deep clone payload to avoid mutating original
      const newPayload = JSON.parse(JSON.stringify(payload));
      
      // Fallback: force compression on all links
      await processLinks(newPayload, false);
      console.log('🔄 Retrying WhatsApp request with compressed images...');
      response = await performRequest(newPayload);
    }
    
    if (!response.ok) {
      const finalErrorText = await response.text();
      console.error('❌ WhatsApp API Final Error:', response.status, finalErrorText);
      throw new Error(`WhatsApp API Error: ${finalErrorText}`);
    }
  }

  return response.json();
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document';

export interface SendMessageContent {
  body?: string;
  preview_url?: boolean;
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
}

/**
 * Sends a standard WhatsApp message (Text or Media).
 * Equivalent to the old `whatsapp_send_message` Python function.
 */
export async function sendWhatsAppMessage(
  recipientPhone: string,
  messageType: MessageType,
  content: SendMessageContent,
  logCtx?: OutboundLogContext
) {
  if (!getAccessToken() || !getPhoneNumberId()) {
    throw new Error('WhatsApp environment variables are not configured properly.');
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${getPhoneNumberId()}/messages`;

  // Base payload
  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: messageType,
  };

  // Construct type-specific payload
  if (messageType === 'text') {
    if (!content.body) throw new Error('Text messages require a body.');
    payload.text = {
      body: content.body,
      preview_url: content.preview_url || false,
    };
  } else if (['image', 'video', 'audio', 'document'].includes(messageType)) {
    const mediaObject: any = {};

    if (content.id) {
      mediaObject.id = content.id;
    } else if (content.link) {
      mediaObject.link = content.link;
    } else {
      throw new Error(`Either 'id' or 'link' must be provided for ${messageType}`);
    }

    if (content.caption && ['image', 'video', 'document'].includes(messageType)) {
      mediaObject.caption = content.caption;
    }

    if (content.filename && messageType === 'document') {
      mediaObject.filename = content.filename;
    }

    payload[messageType] = mediaObject;
  } else {
    throw new Error(`Unsupported message_type: ${messageType}`);
  }

  const result = await executeWhatsAppRequest(payload);
  if (logCtx) void logOutbound(result, recipientPhone, messageType, content.body || content.caption || null, content.link || null, logCtx);
  return result;
}

/**
 * Sends a WhatsApp Interactive Reply-Button message.
 * Supports up to 3 quick-reply buttons (WhatsApp limit).
 * Used to send suggestion chips from the chat-agent.
 */
export async function sendWhatsAppInteractiveButtons(
  recipientPhone: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  headerText?: string,
  footerText?: string,
  imageUrl?: string,
  logCtx?: OutboundLogContext
) {
  if (!getAccessToken() || !getPhoneNumberId()) {
    throw new Error('WhatsApp environment variables are not configured properly.');
  }

  if (buttons.length === 0 || buttons.length > 3) {
    throw new Error(`Interactive buttons require 1-3 buttons, got ${buttons.length}`);
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${getPhoneNumberId()}/messages`;

  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: buttons.map((btn) => ({
        type: 'reply',
        reply: {
          id: btn.id,
          title: btn.title.substring(0, 20), // WhatsApp enforces 20 char limit on button titles
        },
      })),
    },
  };

  if (imageUrl) {
    interactive.header = { type: 'image', image: { link: imageUrl } };
  } else if (headerText) {
    interactive.header = { type: 'text', text: headerText };
  }

  if (footerText) {
    interactive.footer = { text: footerText };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'interactive',
    interactive,
  };

  const result = await executeWhatsAppRequest(payload);
  if (logCtx) void logOutbound(result, recipientPhone, 'interactive', bodyText || null, null, logCtx);
  return result;
}

/**
 * Sends a WhatsApp Interactive List message.
 * Supports up to 10 rows across sections (WhatsApp limit).
 * Used when there are more than 3 suggestion chips.
 */
export async function sendWhatsAppInteractiveList(
  recipientPhone: string,
  bodyText: string,
  rows: Array<{ id: string; title: string; description?: string }>,
  buttonLabel: string = 'Choose an option',
  sectionTitle: string = 'Options',
  headerText?: string,
  footerText?: string,
  logCtx?: OutboundLogContext
) {
  if (!getAccessToken() || !getPhoneNumberId()) {
    throw new Error('WhatsApp environment variables are not configured properly.');
  }

  if (rows.length === 0 || rows.length > 10) {
    throw new Error(`Interactive list requires 1-10 rows, got ${rows.length}`);
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${getPhoneNumberId()}/messages`;

  const interactive: Record<string, unknown> = {
    type: 'list',
    body: { text: bodyText },
    action: {
      button: buttonLabel.substring(0, 20), // WhatsApp enforces 20 char limit
      sections: [
        {
          title: sectionTitle.substring(0, 24), // WhatsApp enforces 24 char limit on section titles
          rows: rows.map((row) => ({
            id: row.id.substring(0, 200), // WhatsApp enforces 200 char limit on row IDs
            title: row.title.substring(0, 24), // WhatsApp enforces 24 char limit on row titles
            ...(row.description ? { description: row.description.substring(0, 72) } : {}), // 72 char limit
          })),
        },
      ],
    },
  };

  if (headerText) {
    interactive.header = { type: 'text', text: headerText };
  }

  if (footerText) {
    interactive.footer = { text: footerText };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'interactive',
    interactive,
  };

  const result = await executeWhatsAppRequest(payload);
  if (logCtx) void logOutbound(result, recipientPhone, 'interactive', bodyText || null, null, logCtx);
  return result;
}

/** Header config for CTA URL button messages */
export interface CtaUrlHeader {
  type: 'text' | 'image' | 'video' | 'document';
  /** Text content (for type: 'text', max 60 chars) */
  text?: string;
  /** Media URL (for type: 'image' | 'video' | 'document') */
  link?: string;
}

/**
 * Sends a WhatsApp Interactive CTA URL Button message.
 * Maps a URL to a clean button so users don't see raw URLs.
 * Supports optional image/video/document/text headers and footer.
 */
export async function sendWhatsAppCtaUrlButton(
  recipientPhone: string,
  bodyText: string,
  buttonLabel: string,
  buttonUrl: string,
  header?: CtaUrlHeader,
  footerText?: string,
  logCtx?: OutboundLogContext
) {
  if (!getAccessToken() || !getPhoneNumberId()) {
    throw new Error('WhatsApp environment variables are not configured properly.');
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${getPhoneNumberId()}/messages`;

  const interactive: Record<string, unknown> = {
    type: 'cta_url',
    body: { text: bodyText.substring(0, 1024) },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: buttonLabel.substring(0, 20),
        url: buttonUrl,
      },
    },
  };

  // Optional header (text, image, video, or document)
  if (header) {
    if (header.type === 'text' && header.text) {
      interactive.header = { type: 'text', text: header.text.substring(0, 60) };
    } else if (header.link && ['image', 'video', 'document'].includes(header.type)) {
      interactive.header = {
        type: header.type,
        [header.type]: { link: header.link },
      };
    }
  }

  // Optional footer (max 60 chars)
  if (footerText) {
    interactive.footer = { text: footerText.substring(0, 60) };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'interactive',
    interactive,
  };

  const result = await executeWhatsAppRequest(payload);
  if (logCtx) {
    // Merge button_label into debug_info so the admin chat can render CTA buttons properly
    const mergedExtra: Record<string, unknown> = {
      ...(logCtx.extra ?? {}),
      debug_info: {
        button_label: buttonLabel,
        ...((logCtx.extra?.debug_info as Record<string, unknown>) ?? {}),
      },
    };
    void logOutbound(result, recipientPhone, 'cta_url', bodyText || null, buttonUrl || null, {
      ...logCtx,
      extra: mergedExtra,
    });
  }
  return result;
}

/** A single card in an interactive media carousel */
export interface InteractiveCarouselCard {
  /** Image or video URL for the card header */
  mediaUrl: string;
  /** Header media type */
  mediaType: 'image' | 'video';
  /** Optional body text for the card (max 160 chars) */
  bodyText?: string;
  /** URL button config — mutually exclusive with quickReplyButtons */
  urlButton?: { label: string; url: string };
  /** Quick-reply button configs — mutually exclusive with urlButton */
  quickReplyButtons?: Array<{ id: string; title: string }>;
}

/**
 * Sends a WhatsApp Interactive Media Carousel message.
 * Supports 2-10 cards, each with an image/video header, optional body text,
 * and either a URL button or quick-reply buttons.
 *
 * NOTE: This is different from `sendWhatsAppCarousel` which uses template messages.
 * This uses the interactive message type for dynamic, non-template carousels.
 */
export async function sendWhatsAppInteractiveCarousel(
  recipientPhone: string,
  bodyText: string,
  cards: InteractiveCarouselCard[],
  logCtx?: OutboundLogContext
) {
  if (!getAccessToken() || !getPhoneNumberId()) {
    throw new Error('WhatsApp environment variables are not configured properly.');
  }

  if (cards.length < 2 || cards.length > 10) {
    throw new Error(`Interactive carousel requires 2-10 cards, got ${cards.length}`);
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${getPhoneNumberId()}/messages`;

  const carouselCards = cards.map((card, index) => {
    const cardObj: Record<string, unknown> = {
      card_index: index,
      type: 'cta_url',
      header: {
        type: card.mediaType,
        [card.mediaType]: {
          link: card.mediaUrl,
        },
      },
    };

    // Optional card body text (max 160 chars)
    if (card.bodyText) {
      cardObj.body = { text: card.bodyText.substring(0, 160) };
    }

    // Action: either URL button or quick-reply buttons
    if (card.urlButton) {
      cardObj.action = {
        name: 'cta_url',
        parameters: {
          display_text: card.urlButton.label.substring(0, 20),
          url: card.urlButton.url,
        },
      };
    } else if (card.quickReplyButtons && card.quickReplyButtons.length > 0) {
      cardObj.action = {
        buttons: card.quickReplyButtons.map((btn) => ({
          type: 'quick_reply',
          quick_reply: {
            id: btn.id.substring(0, 20),
            title: btn.title.substring(0, 20),
          },
        })),
      };
    }

    return cardObj;
  });

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'interactive',
    interactive: {
      type: 'carousel',
      body: { text: bodyText.substring(0, 1024) },
      action: {
        cards: carouselCards,
      },
    },
  };

  const result = await executeWhatsAppRequest(payload);
  if (logCtx) void logOutbound(result, recipientPhone, 'interactive', bodyText || null, null, logCtx);
  return result;
}

/**
 * Helper to construct a single parameter object for template components.
 */
function constructComponentParameter(typeStr: string, content: string | number) {
  const param: any = { type: typeStr };

  if (typeStr === 'text') {
    param.text = String(content);
  } else if (typeStr === 'payload') {
    param.payload = String(content);
  } else if (['image', 'video', 'document'].includes(typeStr)) {
    const contentStr = String(content);
    if (contentStr.startsWith('http')) {
      param[typeStr] = { link: contentStr };
    } else {
      param[typeStr] = { id: contentStr };
    }
  }

  return param;
}

export interface TemplateButtonPayload {
  type?: 'quick_reply' | 'url' | 'copy_code';
  index?: number;
  value: string;
}

/**
 * Sends a WhatsApp Template Message.
 * Equivalent to the old `whatsapp_cloud_api_v1` Python function.
 */
export async function sendWhatsAppTemplate(
  recipientPhone: string,
  templateName: string,
  languageCode: string = 'en_US',
  headerType?: 'text' | 'image' | 'video' | 'document',
  headerContent?: string,
  bodyParameters?: string[],
  buttonPayloads?: TemplateButtonPayload[],
  logCtx?: OutboundLogContext
) {
  if (!getAccessToken() || !getPhoneNumberId()) {
    throw new Error('WhatsApp environment variables are not configured properly.');
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${getPhoneNumberId()}/messages`;

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components: [],
    },
  };

  const components: any[] = [];

  // 1. Header
  if (headerType && headerContent) {
    components.push({
      type: 'header',
      parameters: [constructComponentParameter(headerType, headerContent)],
    });
  }

  // 2. Body
  if (bodyParameters && bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParameters.map((param) => constructComponentParameter('text', param)),
    });
  }

  // 3. Buttons
  if (buttonPayloads && buttonPayloads.length > 0) {
    buttonPayloads.forEach((btn) => {
      const btnType = btn.type || 'quick_reply';
      const btnIndex = btn.index || 0;
      const btnValue = btn.value;

      const buttonComponent: any = {
        type: 'button',
        sub_type: btnType,
        index: String(btnIndex),
        parameters: [],
      };

      if (btnType === 'quick_reply') {
        buttonComponent.parameters.push(constructComponentParameter('payload', btnValue));
      } else if (btnType === 'url') {
        buttonComponent.parameters.push(constructComponentParameter('text', btnValue));
      } else if (btnType === 'copy_code') {
        buttonComponent.parameters.push({
          type: 'text',
          text: String(btnValue),
        });
      }

      components.push(buttonComponent);
    });
  }

  if (components.length > 0) {
    payload.template.components = components;
  }

  const result = await executeWhatsAppRequest(payload);
  if (logCtx) void logOutbound(result, recipientPhone, 'template', templateName || null, null, logCtx);
  return { ...result, image_was_compressed: false };
}

export interface CarouselCard {
  image_url: string;
  action_url_suffix: string; // Used for "url" buttons usually
}

/**
 * Sends a WhatsApp Carousel Template message.
 * Equivalent to `send_whatsapp_carousel` Python function.
 */
export async function sendWhatsAppCarousel(
  recipientPhone: string,
  bodyText: string,
  cards: CarouselCard[],
  customTemplateName?: string,
  logCtx?: OutboundLogContext
) {
  if (!getAccessToken() || !getPhoneNumberId()) {
    throw new Error('WhatsApp environment variables are not configured properly.');
  }

  const SUPPORTED_CARD_COUNTS = [3, 4, 5, 10];
  const cardCount = cards.length;

  if (!SUPPORTED_CARD_COUNTS.includes(cardCount)) {
    throw new Error(`Invalid card count: ${cardCount}. Supported counts are: ${SUPPORTED_CARD_COUNTS}.`);
  }

  let templateName = customTemplateName;
  if (!templateName) {
    templateName = cardCount === 4 ? 'download_carousel_v2' : `carousel_cards_${cardCount}_v1`;
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${getPhoneNumberId()}/messages`;

  const components: any[] = [
    {
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: bodyText,
        },
      ],
    },
  ];

  const carouselCards = cards.map((card, index) => {
    return {
      card_index: index,
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: { link: card.image_url },
            },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: 0,
          parameters: [
            {
              type: 'text',
              text: card.action_url_suffix,
            },
          ],
        },
      ],
    };
  });

  components.push({
    type: 'carousel',
    cards: carouselCards,
  });

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en_US' },
      components: components,
    },
  };

  const result = await executeWhatsAppRequest(payload);
  if (logCtx) void logOutbound(result, recipientPhone, 'template', bodyText || null, null, logCtx);
  return {
    ...result,
    processing_info: {
      template_used: templateName,
      images_processed: cardCount,
      images_compressed: 0,
    },
  };
}

/**
 * Marks a WhatsApp message as read.
 */
export async function markMessageAsRead(messageId: string) {
  if (!getAccessToken() || !getPhoneNumberId()) {
    throw new Error('WhatsApp environment variables are not configured properly.');
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${getPhoneNumberId()}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ WhatsApp API Error (Mark as Read):', response.status, errorText);
    throw new Error(`WhatsApp API Error: ${errorText}`);
  }

  return response.json();
}

/**
 * Sends a typing indicator to a WhatsApp chat based on the provided JSON structure.
 * Note: The curl provided combined status="read" with typing_indicator. We expose this 
 * separately here, but also permit sending it alongside a message_id if required by the API.
 */
export async function sendTypingIndicator(messageId: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp environment variables are not configured properly.');
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
    typing_indicator: {
      type: 'text',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ WhatsApp API Error (Typing Indicator):', response.status, errorText);
    throw new Error(`WhatsApp API Error: ${errorText}`);
  }

  return response.json();
}

/**
 * High-level Strike Email Alert Dispatcher.
 * Formats AI triage, summary, and action items, and sends via WhatsApp Cloud API.
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

  const bodyLines: string[] = [
    `${headerBadge}`,
    '',
    params.sender ? `👤 *From:* ${params.sender}` : '',
    `📌 *Subject:* ${params.subject}`,
    params.category ? `🏷️ *Category:* ${params.category.toUpperCase()}` : '',
    '',
    '📝 *Summary:*',
    params.summaryText,
  ].filter(Boolean);

  if (params.actionItems && params.actionItems.length > 0) {
    bodyLines.push('');
    bodyLines.push('✅ *Action Items:*');
    for (const item of params.actionItems) {
      const due = item.deadline ? ` _(Due: ${item.deadline})_` : '';
      bodyLines.push(`• ${item.action}${due}`);
    }
  }

  const messageText = bodyLines.join('\n');

  // Try sending interactive quick-reply buttons
  try {
    return await sendWhatsAppInteractiveButtons(
      params.recipientPhone,
      messageText,
      [
        { id: `read_${params.emailMessageId.slice(0, 16)}`, title: 'Mark Read' },
        { id: `dash_${params.emailMessageId.slice(0, 16)}`, title: 'Open Strike' },
      ],
      undefined, // headerText
      undefined, // footerText
      undefined, // imageUrl
      {
        user_id: params.userId,
        text_body_override: messageText,
        extra: { message_id: params.emailMessageId },
      }
    );
  } catch {
    // Fallback to standard text message if interactive buttons are rejected (e.g. outside window)
    return await sendWhatsAppMessage(
      params.recipientPhone,
      'text',
      { body: messageText },
      {
        user_id: params.userId,
        extra: { message_id: params.emailMessageId },
      }
    );
  }
}

