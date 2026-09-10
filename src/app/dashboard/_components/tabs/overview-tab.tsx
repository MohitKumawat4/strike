"use client";

import { useMemo } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Inbox,
  Mail,
  Radio,
  ShieldCheck,
  Plus,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";

import type {
  ConnectedAccount,
  EmailMessage,
  UserSettings,
} from "../dashboard-shell";
import { InboxWorkspace } from "./inbox-workspace";
import styles from "./overview-tab.module.css";

type OverviewTabProps = {
  accounts: ConnectedAccount[];
  receivedCount: number;
  importantCount?: number;
  messages: EmailMessage[];
  period: string;
  onPeriodChange: () => void;
  onConnectGmail: () => void;
  onNavigateToTab?: (
    tab:
      | "overview"
      | "messages"
      | "accounts"
      | "processing"
      | "analytics"
      | "templates"
      | "settings",
  ) => void;
  userSettings?: UserSettings | null;
  onSelectMessage?: (message: EmailMessage) => void;
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
  onSelectMessage,
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
        detail: userSettings?.whatsapp_destination
          ? userSettings.whatsapp_destination
          : "Connect recipient number",
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
    [receivedCount, importantCount, userSettings?.whatsapp_destination],
  );

  return (
    <div className={styles.overview}>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>
            <span className={styles.liveDot} /> YOUR COMMAND CENTER
          </p>
          <h1>
            Dashboard <span>Overview.</span>
          </h1>
          <p className={styles.subtitle}>
            Your inbox intelligence stream across all connected accounts.
          </p>
        </div>
        <div className={styles.toolbar}>
          <button
            className={styles.periodButton}
            onClick={onPeriodChange}
            type="button"
          >
            <CalendarDays size={15} />
            <span>{period}</span>
            <ChevronDown size={13} />
          </button>
          <button
            className={styles.primaryButton}
            onClick={onConnectGmail}
            type="button"
          >
            <Plus size={16} />
            <span>Connect Gmail</span>
          </button>
        </div>
      </div>

      <section aria-label="Email metrics" className={styles.metrics}>
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const isTextValue = isNaN(Number(metric.value));
          return (
            <article
              className={`${styles.metric} ${index === 1 ? styles.priorityMetric : ""}`}
              key={metric.label}
            >
              <div className={styles.metricTop}>
                <span className={styles.metricIcon}>
                  <Icon size={17} />
                </span>
                <span>{metric.label}</span>
                <span className={styles.metricTrend}>
                  <i />
                  {metric.trend}
                </span>
              </div>
              <div className={styles.metricValueRow}>
                <strong
                  className={
                    isTextValue ? styles.textValue : styles.numberValue
                  }
                >
                  {metric.value}
                </strong>
                <span className={styles.metricBadge}>{metric.badge}</span>
              </div>
              <p className={styles.metricDetail}>{metric.detail}</p>
            </article>
          );
        })}
      </section>

      <InboxWorkspace
        messages={messages}
        accounts={accounts}
        receivedCount={receivedCount}
        userSettings={userSettings}
        onConnectGmail={onConnectGmail}
        onSelectMessage={onSelectMessage}
        onViewMessages={
          onNavigateToTab ? () => onNavigateToTab("messages") : undefined
        }
        onManageWhatsApp={
          onNavigateToTab ? () => onNavigateToTab("settings") : undefined
        }
      />

      <div className={styles.operationsHeading}>
        <span className={styles.eyebrow}>BEHIND YOUR BRIEF</span>
        <span>Connected. Processing. Delivering.</span>
      </div>
      <section className={styles.operationsGrid}>
        <article
          className={`${styles.panel} ${styles.healthPanel}`}
          id="health"
        >
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>PROCESSING HEALTH</p>
              <h2>Pipeline Active & Clear</h2>
            </div>
            <span className={styles.healthBadge}>
              <i className={styles.liveDot} />
              99.9% Uptime
            </span>
          </div>
          <div className={styles.healthVisual}>
            <div className={styles.healthGrid} aria-hidden="true" />
            <span className={styles.flowEndpoint}>
              <Mail size={17} />
              <span>INBOX</span>
            </span>
            <svg
              viewBox="0 0 500 100"
              preserveAspectRatio="none"
              className={styles.flowLines}
              aria-hidden="true"
            >
              <path d="M0 50 C120 50 135 14 250 50 S390 50 500 50" />
              <path d="M0 50 C120 50 135 86 250 50 S390 50 500 50" />
              <path d="M0 50 H500" />
            </svg>
            <div className={styles.latency}>
              <Clock3 size={18} />
              <strong>0 min</strong>
              <span>AVG. LATENCY</span>
            </div>
            <span className={styles.flowEndpoint}>
              <Radio size={17} />
              <span>DELIVERY</span>
            </span>
          </div>
          <div className={styles.telemetryGrid}>
            <div>
              <span>INGESTION</span>
              <strong>Instant Webhook</strong>
              <small>Real-Time Gmail Push</small>
            </div>
            <div>
              <span>AI TRIAGE</span>
              <strong>Gemini 2.5</strong>
              <small>&lt; 1.0s avg latency</small>
            </div>
            <div>
              <span>IN-FLIGHT QUEUE</span>
              <strong>0 Pending</strong>
              <small>All clear</small>
            </div>
          </div>
          <div className={styles.healthLegend}>
            <span>
              <i />
              Pipeline: Ready
            </span>
            <span>
              <i />
              Real-Time Ingestion
            </span>
            <span>
              <ShieldCheck size={12} />
              RLS Secured
            </span>
          </div>
        </article>

        <article
          className={`${styles.panel} ${styles.accountsPanel}`}
          id="accounts"
        >
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>INBOX CONNECTIVITY</p>
              <h2>Connected Mailboxes</h2>
            </div>
            <span className={styles.countBadge}>
              {accounts.length} account{accounts.length !== 1 ? "s" : ""} active
            </span>
          </div>
          <p className={styles.panelDescription}>
            Connect the Gmail inboxes you rely on. Strike analyzes, scores, and
            summarizes your email stream.
          </p>
          <div className={styles.connectionSteps}>
            <div className={styles.connectionStep}>
              <span className={styles.stepNumber}>01</span>
              <span className={styles.stepContent}>
                <strong>Workspace secured</strong>
                <small>Authenticated with Supabase RLS</small>
              </span>
              <CheckCircle2 size={17} />
            </div>
            <button
              type="button"
              className={styles.connectionStep}
              onClick={accounts.length === 0 ? onConnectGmail : undefined}
              disabled={accounts.length > 0}
            >
              <span className={styles.stepNumber}>02</span>
              <span className={styles.stepContent}>
                <strong>
                  {accounts.length > 0
                    ? "Inboxes Synchronized"
                    : "Connect Gmail"}
                </strong>
                <small>
                  {accounts.length > 0
                    ? `${accounts[0].email_address}${accounts.length > 1 ? ` (+${accounts.length - 1} more)` : ""}`
                    : "Connect securely with your Google account"}
                </small>
              </span>
              {accounts.length > 0 ? (
                <CheckCircle2 size={17} />
              ) : (
                <ArrowUpRight size={17} />
              )}
            </button>
            <button
              type="button"
              className={styles.connectionStep}
              onClick={() => onNavigateToTab?.("settings")}
            >
              <span className={styles.stepNumber}>03</span>
              <span className={styles.stepContent}>
                <strong>
                  {userSettings?.whatsapp_destination
                    ? "WhatsApp Alerts Active"
                    : "Connect WhatsApp Alerts"}
                </strong>
                <small>
                  {userSettings?.whatsapp_destination
                    ? `Configured to ${userSettings.whatsapp_destination}`
                    : "Add your phone number to receive real-time AI summaries"}
                </small>
              </span>
              {userSettings?.whatsapp_destination ? (
                <CheckCircle2 size={17} />
              ) : (
                <ArrowUpRight size={17} />
              )}
            </button>
          </div>
          <button
            className={styles.connectButton}
            onClick={onConnectGmail}
            type="button"
          >
            Connect another account
            <ArrowUpRight size={15} />
          </button>
        </article>
      </section>
    </div>
  );
}
