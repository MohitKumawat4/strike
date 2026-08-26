import type { ProcessingStage } from "@/modules/email/processing/processing-stages";

export type ProcessingJobPayload = {
  messageId: string;
  stage: ProcessingStage;
};
