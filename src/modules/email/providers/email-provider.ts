import type { EmailAddress } from "@/common/types/domain";

export type NormalizedEmail = {
  providerMessageId: string;
  threadId?: string;
  sender: EmailAddress;
  recipients: EmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt: Date;
  hasAttachments: boolean;
};

export interface EmailProvider {
  getProfile(): Promise<{ providerUserId: string; emailAddress: string }>;
  listChanges(historyId: string): Promise<{ messageIds: string[]; historyId: string }>;
  getMessage(messageId: string): Promise<NormalizedEmail>;
  startWatch(): Promise<{ historyId: string; expiration: Date }>;
  stopWatch(): Promise<void>;
}
