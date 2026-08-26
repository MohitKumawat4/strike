export const processingStages = [
  "ingestion",
  "pre_filter",
  "triage",
  "summary",
  "delivery",
] as const;

export type ProcessingStage = (typeof processingStages)[number];
