/* ═══════════════════════════════════════════════════════════════════════════
 * Dashboard Feature Registry
 *
 * Implements the "comment this feature" OOP standard. This registry controls
 * the visibility and rendering of high-level dashboard features. If a feature
 * is disabled here, it entirely disappears from the dashboard navigation
 * and UI without causing layout shifts or runtime errors.
 * ═══════════════════════════════════════════════════════════════════════════ */

export type DashboardFeatureId =
  | "overview"
  | "processing"
  | "error_logs"
  | "pipeline_controls";

export interface DashboardFeature {
  id: DashboardFeatureId;
  enabled: boolean;
  name: string;
  description: string;
}

/**
 * Master toggle registry for dashboard features.
 * Setting `enabled: false` will gracefully remove the feature.
 */
export const FEATURE_REGISTRY: Record<DashboardFeatureId, DashboardFeature> = {
  overview: {
    id: "overview",
    enabled: true,
    name: "Overview",
    description: "High-level metrics and system health.",
  },
  processing: {
    id: "processing",
    enabled: true,
    name: "Processing Jobs",
    description: "Live view of email processing pipeline.",
  },
  error_logs: {
    id: "error_logs",
    enabled: true,
    name: "Error Logs",
    description: "Administrative telemetry and debugging (PIN protected).",
  },
  pipeline_controls: {
    id: "pipeline_controls",
    enabled: true,
    name: "Pipeline Controls",
    description: "User toggles for AI and delivery subsystems.",
  },
};

/**
 * Helper to check if a feature is currently enabled.
 */
export function isFeatureEnabled(featureId: DashboardFeatureId): boolean {
  return FEATURE_REGISTRY[featureId]?.enabled === true;
}

/**
 * Returns an array of only the enabled features for rendering navigation tabs.
 */
export function getEnabledFeatures(): DashboardFeature[] {
  return Object.values(FEATURE_REGISTRY).filter((f) => f.enabled);
}
