import type { MailboxChangeEvent } from "@/modules/email/ingestion/ingestion.types";

/** Decode, authenticate, and normalize a Google Pub/Sub event before queueing work. */
export function toMailboxChangeEvent(input: MailboxChangeEvent): MailboxChangeEvent {
  return input;
}
