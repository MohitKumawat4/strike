import { sendWhatsAppTemplate, OutboundLogContext } from './whatsapp';

/**
 * WhatsApp Template Registry & Management Module for Strike.
 * Manages custom Meta WhatsApp message templates for 24-hour window re-activation,
 * scheduled daily briefings, and automated interactive responses.
 */

export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

export type TemplateButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

export interface TemplateButton {
  readonly type: TemplateButtonType;
  readonly text: string;
  readonly payload?: string; // For QUICK_REPLY
  readonly url?: string;     // For URL
  readonly phone_number?: string; // For PHONE_NUMBER
}

export interface WhatsAppTemplateDefinition {
  readonly name: string;
  readonly category: TemplateCategory;
  readonly language: string;
  readonly description: string;
  readonly headerText?: string;
  readonly bodyText: string;
  readonly footerText?: string;
  readonly buttons: readonly TemplateButton[];
  readonly sampleVariables?: readonly string[];
}

/**
 * Predefined Custom Templates Registry
 */
export const WHATSAPP_TEMPLATES = {
  /**
   * 1. Welcome & Onboarding Template.
   * Dispatched on first number connection to deliver an app overview, activation quick-reply, and direct dashboard URL button.
   * Operates outside the 24-hour window without requiring a prior 'Hi' message from the user.
   */
  ONBOARDING_WELCOME: {
    name: 'strike_welcome_onboarding_v1',
    category: 'UTILITY' as TemplateCategory,
    language: 'en_US',
    description: 'Welcome onboarding template with app walkthrough, stream activation button, and direct dashboard link.',
    headerText: 'Welcome to Strike Intelligence',
    bodyText: 'Welcome {{1}}! ⚡ Your WhatsApp is now connected to Strike.\n\nHere is how Strike works:\n• Instant AI triage & priority scoring for new emails.\n• Executive summaries & extracted action items.\n• Interactive quick-actions directly in chat.\n\nTap below to activate your live briefing stream!',
    footerText: 'Strike AI • Instant Inbox Intelligence',
    buttons: [
      {
        type: 'QUICK_REPLY',
        text: 'Activate Stream',
        payload: 'ACTIVATE_STREAM',
      },
      {
        type: 'URL',
        text: 'Open Dashboard',
        url: 'https://strike.vercel.app/dashboard',
      },
    ],
    sampleVariables: ['Mohit'],
  },

  /**
   * 2. 24-Hour Messaging Window Re-activation & Morning Greetings Template.
   * Dispatched daily at 7:00 AM (or when 24h session has expired) to prompt user re-engagement with quick replies.
   */
  GREETINGS_24H_WINDOW: {
    name: 'strike_daily_greetings_v1',
    category: 'UTILITY' as TemplateCategory,
    language: 'en_US',
    description: 'Morning greeting and 24-hour window re-activation prompt with quick-reply buttons.',
    headerText: 'Strike Daily Intelligence',
    bodyText: 'Good morning {{1}}! ☀️ Strike has triaged your inbox and prepared your priority email briefing. Tap below to start your briefing.',
    footerText: 'Strike AI • Instant Inbox Intelligence',
    buttons: [
      {
        type: 'QUICK_REPLY',
        text: 'Ready for Briefing',
        payload: 'START_DAY',
      },
      {
        type: 'QUICK_REPLY',
        text: 'View Inbox',
        payload: 'VIEW_INBOX',
      },
    ],
    sampleVariables: ['Mohit'],
  },

  /**
   * 3. High Priority Alert Template (Ready for future expansion)
   */
  URGENT_EMAIL_ALERT: {
    name: 'strike_urgent_alert_v1',
    category: 'UTILITY' as TemplateCategory,
    language: 'en_US',
    description: 'Out-of-window urgent email alert with immediate triage action buttons.',
    headerText: 'Urgent Email Alert',
    bodyText: 'You received an urgent email from {{1}}: "{{2}}". Summary: {{3}}',
    footerText: 'Strike Priority Alert',
    buttons: [
      {
        type: 'QUICK_REPLY',
        text: 'View Summary',
        payload: 'VIEW_URGENT_SUMMARY',
      },
      {
        type: 'QUICK_REPLY',
        text: 'Mark Handled',
        payload: 'MARK_HANDLED',
      },
    ],
    sampleVariables: ['Finance Team', 'Invoice Payment Due', 'Action required before 5 PM.'],
  },
} as const;

/**
 * Returns a template definition by its key or name.
 */
export function getTemplateDefinition(templateKeyOrName: string): WhatsAppTemplateDefinition | undefined {
  if (templateKeyOrName in WHATSAPP_TEMPLATES) {
    return WHATSAPP_TEMPLATES[templateKeyOrName as keyof typeof WHATSAPP_TEMPLATES];
  }
  return Object.values(WHATSAPP_TEMPLATES).find((t) => t.name === templateKeyOrName);
}

/**
 * Formats template parameters into the Meta Graph API component structure.
 */
export function formatTemplateComponents(
  template: WhatsAppTemplateDefinition,
  bodyVariables: string[] = [],
  headerVariables?: string[]
): Array<Record<string, unknown>> {
  const components: Array<Record<string, unknown>> = [];

  // 1. Dynamic Header component (only included if template requires dynamic variable substitution)
  if (headerVariables && headerVariables.length > 0) {
    components.push({
      type: 'header',
      parameters: headerVariables.map((val) => ({
        type: 'text',
        text: val,
      })),
    });
  }

  // 2. Body variables component
  if (bodyVariables.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyVariables.map((val) => ({
        type: 'text',
        text: val,
      })),
    });
  }

  // 3. Quick-reply button payload components
  template.buttons.forEach((btn, index) => {
    if (btn.type === 'QUICK_REPLY' && btn.payload) {
      components.push({
        type: 'button',
        sub_type: 'quick_reply',
        index: String(index),
        parameters: [
          {
            type: 'payload',
            payload: btn.payload,
          },
        ],
      });
    }
  });

  return components;
}

/**
 * Sends the Welcome & Onboarding Walkthrough Template to a newly connected number.
 * Operates without requiring prior conversation / 24-hour window.
 */
export async function sendWelcomeOnboardingTemplate(
  recipientPhone: string,
  recipientName: string = 'there',
  logCtx?: OutboundLogContext
) {
  const template = WHATSAPP_TEMPLATES.ONBOARDING_WELCOME;
  const components = formatTemplateComponents(template, [recipientName]);

  return sendWhatsAppTemplate(
    recipientPhone,
    template.name,
    template.language,
    components,
    logCtx
  );
}

/**
 * High-level helper to send the 24-Hour Greetings Template.
 * Dispatches the Meta-approved greeting to re-open the user's 24-hour messaging window.
 */
export async function sendGreetings24hTemplate(
  recipientPhone: string,
  recipientName: string = 'there',
  logCtx?: OutboundLogContext
) {
  const template = WHATSAPP_TEMPLATES.GREETINGS_24H_WINDOW;
  const components = formatTemplateComponents(template, [recipientName]);

  return sendWhatsAppTemplate(
    recipientPhone,
    template.name,
    template.language,
    components,
    logCtx
  );
}

/**
 * Registers a template with Meta Graph API under your WhatsApp Business Account.
 */
export async function registerTemplateWithMeta(
  template: WhatsAppTemplateDefinition,
  customToken?: string,
  customWabaId?: string
) {
  const token = customToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = customWabaId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!token || !wabaId) {
    throw new Error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID must be configured.');
  }

  // Build Meta Graph API template creation payload
  const componentsPayload: Array<Record<string, unknown>> = [];

  if (template.headerText) {
    componentsPayload.push({
      type: 'HEADER',
      format: 'TEXT',
      text: template.headerText,
    });
  }

  componentsPayload.push({
    type: 'BODY',
    text: template.bodyText,
    ...(template.sampleVariables && template.sampleVariables.length > 0
      ? {
          example: {
            body_text: [template.sampleVariables],
          },
        }
      : {}),
  });

  if (template.footerText) {
    componentsPayload.push({
      type: 'FOOTER',
      text: template.footerText,
    });
  }

  if (template.buttons && template.buttons.length > 0) {
    componentsPayload.push({
      type: 'BUTTONS',
      buttons: template.buttons.map((btn) => {
        if (btn.type === 'QUICK_REPLY') {
          return {
            type: 'QUICK_REPLY',
            text: btn.text,
          };
        }
        if (btn.type === 'URL') {
          return {
            type: 'URL',
            text: btn.text,
            url: btn.url,
          };
        }
        return {
          type: 'PHONE_NUMBER',
          text: btn.text,
          phone_number: btn.phone_number,
        };
      }),
    });
  }

  const payload = {
    name: template.name,
    category: template.category,
    language: template.language,
    components: componentsPayload,
  };

  const response = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Meta Template Registration Error (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Fetches all registered templates from Meta Graph API.
 */
export async function listMetaTemplates(customToken?: string, customWabaId?: string) {
  const token = customToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = customWabaId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!token || !wabaId) {
    throw new Error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID must be configured.');
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Meta Template Fetch Error (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}
