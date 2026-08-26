import type {
  DeliveryChannel,
  DeliveryAttemptResult,
  SummaryPayload,
} from "@/modules/whatsapp/provider/delivery-channel";

/** MVP adapter: records an intended delivery without contacting Meta. */
export class NoopDeliveryChannel implements DeliveryChannel {
  async sendSummary(_payload: SummaryPayload): Promise<DeliveryAttemptResult> {
    void _payload;
    return { status: "skipped" };
  }
}
