export const processingStatuses = [
  "RECEIVED",
  "PRE_FILTERED",
  "TRIAGED",
  "DISCARDED",
  "SUMMARIZING",
  "SUMMARY_READY",
  "DELIVERY_PENDING",
  "DELIVERING",
  "DELIVERED",
  "FAILED",
  "DELAYED",
] as const;

export type ProcessingStatus = (typeof processingStatuses)[number];

export type EmailAddress = {
  name?: string;
  address: string;
};
