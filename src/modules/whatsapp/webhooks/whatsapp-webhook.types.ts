export type WhatsAppWebhookEvent = {
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  occurredAt: Date;
};
