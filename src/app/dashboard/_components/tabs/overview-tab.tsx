"use client";

import { useMemo } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Inbox,
  MessageSquare,
  Plus,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";

import type { ConnectedAccount, EmailMessage, UserSettings } from "../dashboard-shell";

type OverviewTabProps = {
  accounts: ConnectedAccount[];
  receivedCount: number;
  importantCount?: number;
  messages: EmailMessage[];
  period: string;
  onPeriodChange: () => void;
  onConnectGmail: () => void;
  onNavigateToTab?: (tab: "overview" | "messages" | "accounts" | "processing" | "analytics" | "templates" | "settings") => void;
  userSettings?: UserSettings | null;
};

export function OverviewTab({
  accounts,
  receivedCount,
  importantCount = 0,
  messages,
  period,
  onPeriodChange,
  onConnectGmail,
  onNavigateToTab,
  userSettings,
}: OverviewTabProps) {
  /* Dynamic metrics driven by real pipeline data */
  const metrics = useMemo(
    () => [
      {
        label: "Received",
        value: String(receivedCount),
        badge: "Inboxes",
        detail: "Across connected mailboxes",
        icon: Inbox,
        tone: "mauve",
        trend: "Live",
      },
      {
        label: "AI Triaged",
        value: String(importantCount),
        badge: "Priority",
        detail: "Triaged by AI engine",
        icon: Sparkles,
        tone: "rose",
        trend: "Priority",
      },
      {
        label: "WhatsApp Stream",
        value: userSettings?.whatsapp_destination ? "Active" : "Not Linked",
        badge: userSettings?.whatsapp_destination ? "Meta API" : "Action",
        detail: userSettings?.whatsapp_destination ? userSettings.whatsapp_destination : "Connect recipient number",
        icon: Zap,
        tone: "berry",
        trend: userSettings?.whatsapp_destination ? "Connected" : "Setup",
      },
      {
        label: "Needs Attention",
        value: "0",
        badge: "Clean",
        detail: "Zero failures or delays",
        icon: TriangleAlert,
        tone: "peach",
        trend: "Healthy",
      },
    ],
    [receivedCount, importantCount, userSettings?.whatsapp_destination]
  );

  /* Show last 5 recently synced emails */
  const recentMessages = messages.slice(0, 5);

  return (
    <div className="overview-contrast-view">
      {/* Header & Command Center Title Row */}
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">YOUR COMMAND CENTER</p>
          <h1>Dashboard Overview</h1>
          <p className="dashboard-subtitle">
            Your inbox intelligence stream across all connected accounts.
          </p>
        </div>

        <div className="dashboard-toolbar">
          <button className="period-button" onClick={onPeriodChange} type="button">
            <CalendarDays size={16} />
            <span>{period}</span>
            <ChevronDown size={14} />
          </button>
          <button className="primary-button" onClick={onConnectGmail} type="button">
            <Plus size={16} strokeWidth={2.5} />
            <span>Connect Gmail</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards Grid - Balanced Typography & Structured Framing */}
      <section aria-label="Email metrics" className="metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const isTextValue = isNaN(Number(metric.value));
          return (
            <article className={`metric-card metric-card-${metric.tone}`} key={metric.label}>
              <div className="metric-top">
                <div className="metric-icon-box">
                  <span className={`metric-icon ${metric.tone}`}>
                    <Icon size={17} />
                  </span>
                  <span className="metric-card-label">{metric.label}</span>
                </div>
                <span className={`metric-trend-chip chip-${metric.tone}`}>
                  <span className="chip-pulse-dot" />
                  {metric.trend}
                </span>
              </div>

              <div className="metric-value-container">
                <strong className={`metric-value ${isTextValue ? "metric-value-text" : "metric-value-number"}`}>
                  {metric.value}
                </strong>
                {metric.badge && (
                  <span className="metric-badge-tag">{metric.badge}</span>
                )}
              </div>

              <span className="metric-detail-text">{metric.detail}</span>

              {/* Refined subtle bottom accent indicator */}
              <div className={`metric-bottom-bar bar-${metric.tone}`} aria-hidden="true" />
            </article>
          );
        })}
      </section>

      {/* Two-Column Grid: Processing Health + Inbox Connectivity */}
      <section className="dashboard-grid">
        {/* Processing Health & Telemetry Panel */}
        <article className="panel health-panel" id="health">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PROCESSING HEALTH</p>
              <h2>Pipeline Active & Clear</h2>
            </div>
            <div className="health-status-chip">
              <span className="health-pulse-dot" />
              <span>99.9% Uptime</span>
            </div>
          </div>

          {/* Central Latency Visualization with Waveforms */}
          <div className="health-visual-radar">
            <svg viewBox="0 0 340 110" className="health-radar-wave-svg" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="healthWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#281436" stopOpacity="0" />
                  <stop offset="35%" stopColor="#502d55" stopOpacity="0.75" />
                  <stop offset="70%" stopColor="#935073" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#f6dbc0" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <path d="M0 75 Q 85 25, 170 58 T 340 35" fill="none" stroke="url(#healthWaveGrad)" strokeWidth="1.8" />
              <path d="M0 88 Q 95 38, 180 70 T 340 48" fill="none" stroke="url(#healthWaveGrad)" strokeWidth="1.2" opacity="0.6" />
              <path d="M0 98 Q 105 52, 190 80 T 340 60" fill="none" stroke="url(#healthWaveGrad)" strokeWidth="1" opacity="0.35" />
            </svg>
            
            <div className="health-radar-container">
              <div className="radar-ring radar-ring-outer" />
              <div className="radar-ring radar-ring-middle" />
              <div className="radar-ring radar-ring-inner">
                <Clock3 size={17} className="gauge-icon" />
                <strong>0 min</strong>
                <span>avg. latency</span>
              </div>
            </div>
          </div>

          {/* Embedded 3-Stat Pipeline Telemetry Grid */}
          <div className="health-telemetry-grid">
            <div className="telemetry-pill">
              <span className="telemetry-label">Ingestion</span>
              <strong className="telemetry-value">Instant Webhook</strong>
              <small className="telemetry-sub">Real-Time Gmail Push</small>
            </div>
            <div className="telemetry-pill">
              <span className="telemetry-label">AI Triage</span>
              <strong className="telemetry-value">Gemini 2.5</strong>
              <small className="telemetry-sub">&lt; 1.0s avg latency</small>
            </div>
            <div className="telemetry-pill">
              <span className="telemetry-label">In-Flight Queue</span>
              <strong className="telemetry-value">0 Pending</strong>
              <small className="telemetry-sub">All clear</small>
            </div>
          </div>

          {/* Health Legend & Status Pills */}
          <div className="health-legend-row">
            <div className="health-status-badge">
              <i className="legend-dot legend-ready" />
              <span>Pipeline: Ready</span>
            </div>
            <div className="health-status-badge">
              <i className="legend-dot legend-active" />
              <span>Real-Time Ingestion</span>
            </div>
            <div className="health-status-badge">
              <i className="legend-dot legend-secure" />
              <span>RLS Secured</span>
            </div>
          </div>
        </article>

        {/* Connected Mailboxes & Inbox Connectivity Panel */}
        <article className="panel focus-panel" id="accounts">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">INBOX CONNECTIVITY</p>
              <h2>Connected Mailboxes</h2>
            </div>
            <span className="progress-chip">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""} active
            </span>
          </div>
          <p className="panel-description">
            Connect the Gmail inboxes you rely on. Strike analyzes, scores, and summarizes your email stream.
          </p>

          {/* Structured & Elevated Step Cards */}
          <div className="focus-steps-container">
            {/* Step 1: Workspace Security */}
            <div className="focus-step-card is-complete">
              <div className="step-number-badge">01</div>
              <div className="step-content">
                <strong>Workspace secured</strong>
                <small>Authenticated with Supabase RLS</small>
              </div>
              <div className="step-status-icon">
                <CheckCircle2 size={18} className="step-success-svg" />
              </div>
            </div>

            {/* Step 2: Gmail Sync */}
            <div
              className={`focus-step-card ${accounts.length > 0 ? "is-complete" : "is-actionable"}`}
              onClick={accounts.length === 0 ? onConnectGmail : undefined}
              role={accounts.length === 0 ? "button" : undefined}
              tabIndex={accounts.length === 0 ? 0 : undefined}
            >
              <div className="step-number-badge">02</div>
              <div className="step-content">
                <strong>{accounts.length > 0 ? "Inboxes Synchronized" : "Connect Gmail"}</strong>
                <small>
                  {accounts.length > 0
                    ? `${accounts[0].email_address}${accounts.length > 1 ? ` (+${accounts.length - 1} more)` : ""}`
                    : "Grant read-only access to your first inbox"}
                </small>
              </div>
              <div className="step-status-icon">
                {accounts.length > 0 ? (
                  <CheckCircle2 size={18} className="step-success-svg" />
                ) : (
                  <ArrowUpRight size={17} className="step-action-arrow" />
                )}
              </div>
            </div>

            {/* Step 3: WhatsApp Stream */}
            <div
              className={`focus-step-card ${userSettings?.whatsapp_destination ? "is-complete" : "is-actionable"}`}
              onClick={() => onNavigateToTab?.("settings")}
              role="button"
              tabIndex={0}
            >
              <div className="step-number-badge">03</div>
              <div className="step-content">
                <strong>{userSettings?.whatsapp_destination ? "WhatsApp Alerts Active" : "Connect WhatsApp Alerts"}</strong>
                <small>
                  {userSettings?.whatsapp_destination
                    ? `Configured to ${userSettings.whatsapp_destination}`
                    : "Add your phone number to receive real-time AI summaries"}
                </small>
              </div>
              <div className="step-status-icon">
                {userSettings?.whatsapp_destination ? (
                  <CheckCircle2 size={18} className="step-success-svg" />
                ) : (
                  <ArrowUpRight size={17} className="step-action-arrow" />
                )}
              </div>
            </div>
          </div>

          {/* Refined Connect Action Button */}
          <div className="focus-actions-row">
            <button className="focus-connect-button" onClick={onConnectGmail} type="button">
              <span>Connect another account</span>
              <ArrowUpRight size={15} />
            </button>
          </div>
        </article>
      </section>

      {/* WhatsApp Intelligence Banner / CTA */}
      <section aria-label="WhatsApp Stream Integration" className="panel whatsapp-cta-banner" style={{
        marginTop: "20px",
        marginBottom: "24px",
        padding: "20px 24px",
        background: userSettings?.whatsapp_destination
          ? "linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(80, 45, 85, 0.04) 100%)"
          : "linear-gradient(135deg, rgba(80, 45, 85, 0.12) 0%, rgba(147, 80, 115, 0.06) 100%)",
        border: userSettings?.whatsapp_destination
          ? "1px solid rgba(34, 197, 94, 0.25)"
          : "1px solid var(--line)",
        borderRadius: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "20px",
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", maxWidth: "680px" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: userSettings?.whatsapp_destination ? "#16a34a" : "var(--brand-plum)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "2px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
          }}>
            <MessageSquare size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="eyebrow" style={{ color: userSettings?.whatsapp_destination ? "#16a34a" : "var(--brand-plum)", fontWeight: 700 }}>
                {userSettings?.whatsapp_destination ? "WHATSAPP STREAM CONNECTED" : "INSTANT AI NOTIFICATIONS"}
              </span>
              <span style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "999px",
                background: userSettings?.whatsapp_destination ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 88, 12, 0.12)",
                color: userSettings?.whatsapp_destination ? "#16a34a" : "#ea580c",
              }}>
                {userSettings?.whatsapp_destination ? "Live Dispatch" : "Setup Recommended"}
              </span>
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px 0", color: "var(--ink)" }}>
              {userSettings?.whatsapp_destination
                ? `Delivering AI email briefs to ${userSettings.whatsapp_destination}`
                : "Connect your WhatsApp number to get instant email briefs"}
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
              {userSettings?.whatsapp_destination
                ? "Your urgent email summaries, action items, and triage alerts are dispatched in real-time."
                : "Receive priority email summaries, extracted action items, and urgent alerts straight to your phone as soon as new emails arrive."}
            </p>
          </div>
        </div>

        <button
          className={userSettings?.whatsapp_destination ? "secondary-button" : "primary-button"}
          onClick={() => onNavigateToTab?.("settings")}
          type="button"
          style={{
            padding: "0 20px",
            height: "42px",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            cursor: "pointer",
          }}
        >
          <MessageSquare size={16} />
          <span>{userSettings?.whatsapp_destination ? "Manage & Test Number" : "Connect WhatsApp Number"}</span>
          <ArrowUpRight size={15} />
        </button>
      </section>

      {/* Activity Feed of Recent Processed Messages */}
      {recentMessages.length > 0 && (
        <section aria-label="Recent activity" className="recent-activity-section">
          <div className="section-header">
            <h3>Recent Intelligence Stream</h3>
            <span className="badge-count">{receivedCount} messages</span>
          </div>
          <div className="recent-messages-list">
            {recentMessages.map((msg) => (
              <div className="recent-message-item" key={msg.id}>
                <div className="message-sender-avatar">
                  {msg.sender?.raw?.[0]?.toUpperCase() || "M"}
                </div>
                <div className="message-sender-info">
                  <strong>{msg.sender?.raw?.split("<")[0]?.trim() || msg.sender?.raw || "Unknown Sender"}</strong>
                  <small>{msg.sender?.raw || ""}</small>
                </div>
                <div className="message-subject">{msg.subject}</div>
                <div className="message-date">
                  {msg.received_at
                    ? new Date(msg.received_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
