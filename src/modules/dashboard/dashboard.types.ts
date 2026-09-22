export type DashboardMetrics = {
  received: number;
  important: number;
  discarded: number;
  delivered: number;
  failed: number;
  delayed: number;
};

export type DashboardCounts = { received: number; triaged: number; important: number; delivered: number; filtered: number; failed: number; delivery_attention: number };
