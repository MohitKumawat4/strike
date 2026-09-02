"use client";

import { useMemo } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Inbox,
  Plus,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";

import type { ConnectedAccount, EmailMessage } from "../dashboard-shell";

type OverviewTabProps = {
  accounts: ConnectedAccount[];
  receivedCount: number;
  importantCount?: number;
  messages: EmailMessage[];
  period: string;
  onPeriodChange: () => void;
  onConnectGmail: () => void;
};

export function OverviewTab({
  accounts,
  receivedCount,
  importantCount = 0,
  messages,
  period,
  onPeriodChange,
  onConnectGmail,
}: OverviewTabProps) {
  /* Dynamic metrics driven by real data */
  const metrics = useMemo(
    () => [
      {
        label: "Received",
        value: String(receivedCount),
        detail: "Across connected mailboxes",
        icon: Inbox,
        tone: "teal",
        trend: "Live",
      },
      {
        label: "Important",
        value: String(importantCount),
        detail: "Triaged by AI engine",
        icon: Sparkles,
        tone: "mint",
        trend: "Priority",
      },
      {
        label: "Delivered",
        value: "0",
        detail: "WhatsApp Phase 2",
        icon: Zap,
        tone: "sky",
        trend: "Queue",
      },
      {
        label: "Needs attention",
        value: "0",
        detail: "Zero failures or delays",
        icon: TriangleAlert,
        tone: "amber",
        trend: "Healthy",
      },
    ],
    [receivedCount, importantCount]
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

      {/* Metric Cards Row */}
      <section aria-label="Email metrics" className="metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" key={metric.label}>
              <div className="metric-top">
                <span className={`metric-icon ${metric.tone}`}>
                  <Icon size={18} />
                </span>
                <span className="metric-trend-chip">{metric.trend}</span>
              </div>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.detail}</span>

              {/* Flowing Wave Lines */}
              <div className="card-wave-container" aria-hidden="true">
                <svg viewBox="0 0 300 80" className="card-wave-svg" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`wave-grad-${metric.tone}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#502d55" stopOpacity="0" />
                      <stop offset="50%" stopColor="#935073" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#f6dbc0" stopOpacity="0.95" />
                    </linearGradient>
                  </defs>
                  <path d="M0 65 Q 75 35, 150 55 T 300 20" fill="none" stroke={`url(#wave-grad-${metric.tone})`} strokeWidth="1.8" />
                  <path d="M0 72 Q 80 48, 160 62 T 300 30" fill="none" stroke={`url(#wave-grad-${metric.tone})`} strokeWidth="1.2" opacity="0.6" />
                  <path d="M0 78 Q 85 58, 170 68 T 300 42" fill="none" stroke={`url(#wave-grad-${metric.tone})`} strokeWidth="1" opacity="0.4" />
                </svg>
              </div>
            </article>
          );
        })}
      </section>

      {/* Two-Column Grid: Health + Start Here */}
      <section className="dashboard-grid">
        {/* Processing Health Radar */}
        <article className="panel health-panel" id="health">
          <div>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">PROCESSING HEALTH</p>
                <h2>Pipeline Active & Clear</h2>
              </div>
              <span className="health-pulse" />
            </div>
            <div className="health-visual-radar">
              <svg viewBox="0 0 320 140" className="health-radar-wave-svg" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="healthWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#281436" stopOpacity="0" />
                    <stop offset="35%" stopColor="#502d55" stopOpacity="0.8" />
                    <stop offset="70%" stopColor="#935073" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#f6dbc0" stopOpacity="0.95" />
                  </linearGradient>
                </defs>
                <path d="M0 95 Q 80 35, 160 75 T 320 45" fill="none" stroke="url(#healthWaveGrad)" strokeWidth="1.8" />
                <path d="M0 108 Q 90 48, 170 86 T 320 58" fill="none" stroke="url(#healthWaveGrad)" strokeWidth="1.2" opacity="0.6" />
                <path d="M0 120 Q 100 62, 180 96 T 320 72" fill="none" stroke="url(#healthWaveGrad)" strokeWidth="1" opacity="0.35" />
              </svg>
              <div className="health-radar-container">
                <div className="radar-ring radar-ring-outer" />
                <div className="radar-ring radar-ring-middle" />
                <div className="radar-ring radar-ring-inner">
                  <Clock3 size={18} className="gauge-icon" />
                  <strong>0 min</strong>
                  <span>avg. latency</span>
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="health-legend">
              <span><i className="legend-ready" />Ready</span>
              <span><i className="legend-waiting" />Real-Time Ingestion</span>
            </div>
          </div>
          <span className="health-watermark" aria-hidden="true">✦</span>
        </article>

        {/* Start Here Focus Panel */}
        <article className="panel focus-panel" id="accounts">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">INBOX CONNECTIVITY</p>
              <h2>Connected Mailboxes</h2>
            </div>
            <span className="progress-chip">{accounts.length} account{accounts.length !== 1 ? "s" : ""} active</span>
          </div>
          <p className="panel-description">
            Connect the Gmail inboxes you rely on. Strike analyzes, scores, and summarizes your email stream.
          </p>
          <div className="focus-steps">
            <div className="focus-step">
              <span className="step-index-badge">1</span>
              <span>
                <strong>Workspace secured</strong>
                <small>Authenticated with Supabase RLS</small>
              </span>
              <CheckCircle2 size={18} className="step-success-icon" />
            </div>
            <div
              className="focus-step"
              onClick={accounts.length === 0 ? onConnectGmail : undefined}
              style={accounts.length === 0 ? { cursor: "pointer" } : undefined}
            >
              <span className="step-index-badge">2</span>
              <span>
                <strong>{accounts.length > 0 ? "Inboxes Synchronized" : "Connect Gmail"}</strong>
                <small>
                  {accounts.length > 0
                    ? `${accounts[0].email_address} (+${accounts.length - 1} more)`
                    : "Grant read-only access to your first inbox"}
                </small>
              </span>
              {accounts.length > 0 ? (
                <CheckCircle2 size={18} className="step-success-icon" />
              ) : (
                <ArrowUpRight size={17} className="step-arrow" />
              )}
            </div>
            <div className="focus-step">
              <span className="step-index-badge">3</span>
              <span>
                <strong>AI Intelligence Active</strong>
                <small>Triage & summaries generated for 40 messages</small>
              </span>
              {receivedCount > 0 && <CheckCircle2 size={18} className="step-success-icon" />}
            </div>
          </div>
          <button className="secondary-button" onClick={onConnectGmail} type="button">
            <span>Connect another account</span>
            <ArrowUpRight size={14} />
          </button>
        </article>
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
