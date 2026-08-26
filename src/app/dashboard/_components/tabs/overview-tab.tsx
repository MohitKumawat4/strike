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
  const metrics = useMemo(() => [
    { label: "Received", value: String(receivedCount), detail: "This period", icon: Inbox, tone: "rose", trend: "—" },
    { label: "Important", value: String(importantCount), detail: "Ready for review", icon: Sparkles, tone: "mauve", trend: "—" },
    { label: "Delivered", value: "0", detail: "WhatsApp phase 2", icon: CheckCircle2, tone: "berry", trend: "—" },
    { label: "Needs attention", value: "0", detail: "Failures or delays", icon: TriangleAlert, tone: "peach", trend: "—" },
  ], [receivedCount, importantCount]);

  /* Show last 5 recently synced emails */
  const recentMessages = messages.slice(0, 5);

  return (
    <>
      {/* Header & Command Center Title Row */}
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">YOUR COMMAND CENTER</p>
          <h1>Dashboard Overview</h1>
          <p className="dashboard-subtitle">
            Your inbox will become clearer as your connected accounts begin to flow.
          </p>
        </div>

        <div className="dashboard-toolbar">
          <button className="period-button" onClick={onPeriodChange} type="button">
            <CalendarDays size={16} />
            <span>{period}</span>
            <ChevronDown size={14} />
          </button>
          <button className="primary-button" onClick={onConnectGmail} type="button">
            <Plus size={16} />
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
                <span className="metric-trend">{metric.trend}</span>
              </div>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.detail}</span>

              {/* Flowing Wave Lines (dark mode only) */}
              <div className="card-wave-container" aria-hidden="true">
                <svg viewBox="0 0 300 80" className="card-wave-svg" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`wave-grad-${metric.tone}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      {metric.tone === "rose" && (
                        <>
                          <stop offset="0%" stopColor="#4f2475" stopOpacity="0" />
                          <stop offset="50%" stopColor="#753594" stopOpacity="0.85" />
                          <stop offset="100%" stopColor="#9b4291" stopOpacity="0.9" />
                        </>
                      )}
                      {metric.tone === "mauve" && (
                        <>
                          <stop offset="0%" stopColor="#5c1d4a" stopOpacity="0" />
                          <stop offset="50%" stopColor="#912c75" stopOpacity="0.85" />
                          <stop offset="100%" stopColor="#be3d96" stopOpacity="0.9" />
                        </>
                      )}
                      {metric.tone === "berry" && (
                        <>
                          <stop offset="0%" stopColor="#252c6b" stopOpacity="0" />
                          <stop offset="50%" stopColor="#4348a6" stopOpacity="0.85" />
                          <stop offset="100%" stopColor="#7354be" stopOpacity="0.9" />
                        </>
                      )}
                      {metric.tone === "peach" && (
                        <>
                          <stop offset="0%" stopColor="#592b1d" stopOpacity="0" />
                          <stop offset="50%" stopColor="#964326" stopOpacity="0.85" />
                          <stop offset="100%" stopColor="#c76232" stopOpacity="0.9" />
                        </>
                      )}
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
                <h2>Quiet for now</h2>
              </div>
              <span className="health-pulse" />
            </div>
            <div className="health-visual-radar">
              <svg viewBox="0 0 320 140" className="health-radar-wave-svg" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="healthWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3d1852" stopOpacity="0" />
                    <stop offset="35%" stopColor="#7a2a7a" stopOpacity="0.75" />
                    <stop offset="70%" stopColor="#9e3a89" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#62248f" stopOpacity="0" />
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
              <span><i className="legend-waiting" />Waiting for email</span>
            </div>
          </div>
          <span className="health-watermark" aria-hidden="true">✦</span>
        </article>

        {/* Start Here Focus Panel */}
        <article className="panel focus-panel" id="accounts">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">START HERE</p>
              <h2>Bring your inbox into focus</h2>
            </div>
            <span className="progress-chip">{accounts.length} account{accounts.length !== 1 ? "s" : ""} active</span>
          </div>
          <p className="panel-description">
            Connect the Gmail accounts you actually rely on. Strike will keep their processing history in one private workspace.
          </p>
          <div className="focus-steps">
            <div className="focus-step">
              <span className="step-index-badge">1</span>
              <span>
                <strong>Workspace secured</strong>
                <small>You are signed in and ready to connect</small>
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
                <strong>{accounts.length > 0 ? "Gmail Connected" : "Connect Gmail"}</strong>
                <small>
                  {accounts.length > 0
                    ? `${accounts[0].email_address} (Ready)`
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
                <strong>Review intelligence</strong>
                <small>See triage, summaries, and delivery history</small>
              </span>
              {receivedCount > 0 && <CheckCircle2 size={18} className="step-success-icon" />}
            </div>
          </div>
          <button className="secondary-button" onClick={onConnectGmail} type="button">
            <span>{accounts.length > 0 ? "Connect another account" : "Connect Gmail"}</span>
            <ArrowUpRight size={15} />
          </button>
        </article>
      </section>

      {/* Recently Synced Emails */}
      {recentMessages.length > 0 && (
        <section className="panel" style={{ marginTop: 24 }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">RECENTLY SYNCED</p>
              <h2>Latest emails</h2>
            </div>
          </div>
          <div className="messages-list">
            {recentMessages.map((msg) => (
              <div className="message-row" key={msg.id}>
                <div className="message-sender">{msg.sender?.raw || "Unknown"}</div>
                <div className="message-subject">{msg.subject}</div>
                <div className="message-date">
                  {msg.received_at ? new Date(msg.received_at).toLocaleDateString() : "—"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
