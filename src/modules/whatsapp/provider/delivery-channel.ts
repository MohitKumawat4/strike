export type SummaryPayload = {
  messageId: string;
  subject: string;
  summaryText: string;
  destination: string;
};

export type DeliveryAttemptResult = {
  providerMessageId?: string;
  status: "pending" | "sending" | "delivered" | "failed" | "skipped";
  errorCode?: string;
};

/** Phase 2 adapter boundary. Email processing must not depend on a live channel. */
export interface DeliveryChannel {
  sendSummary(payload: SummaryPayload): Promise<DeliveryAttemptResult>;
}
