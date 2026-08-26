export type EmailAccountHealth = {
  accountId: string;
  emailAddress: string;
  connectionStatus: "pending" | "connected" | "unhealthy" | "disconnected";
  lastSuccessfulSyncAt?: Date;
  watchExpiration?: Date;
};
