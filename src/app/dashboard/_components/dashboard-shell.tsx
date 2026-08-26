"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  BarChart2,
  Bell,
  CheckCircle2,
  FileText,
  Inbox,
  LayoutDashboard,
  Mail,
  Moon,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/database/supabase/browser";

/* Tab components */
import { OverviewTab } from "./tabs/overview-tab";
import { MessagesTab } from "./tabs/messages-tab";
import { AccountsTab } from "./tabs/accounts-tab";
import { ProcessingTab } from "./tabs/processing-tab";
import { AnalyticsTab } from "./tabs/analytics-tab";
import { TemplatesTab } from "./tabs/templates-tab";
import { SettingsTab } from "./tabs/settings-tab";

/* ——————————————————————————————————————————————
 * Shared types exported for use by tab components
 * —————————————————————————————————————————————— */
export type ConnectedAccount = {
  id: string;
  provider: string;
  email_address: string;
  connection_status: string;
  last_successful_sync_at: string | null;
  created_at?: string;
  granted_scopes?: string[];
  history_id?: string;
};

export type EmailMessage = {
  id: string;
  account_id: string;
  subject: string;
  snippet?: string;
  body_text?: string;
  body_html?: string;
  sender?: { raw?: string };
  received_at: string | null;
  processing_status?: string;
  ai_category?: string;
  ai_importance?: number;
  ai_reason?: string;
  summary?: {
    summary_text: string;
    extracted_items?: Array<{
      action: string;
      deadline?: string;
      assignee?: string;
    }>;
  };
};

export type ProcessingJob = {
  id: string;
  message_id: string;
  stage: string;
  status: string;
  current_stage?: string;
  attempts?: number;
  attempt_count?: number;
  started_at?: string;
  completed_at?: string;
};

export type UserSettings = {
  importance_threshold?: number;
  raw_body_retention_days?: number;
  notify_on_important?: boolean;
  notify_on_failure?: boolean;
};

/* Tab key type for the sidebar navigation */
type TabKey = "overview" | "messages" | "accounts" | "processing" | "analytics" | "templates" | "settings";

/* Sidebar navigation definition */
const NAV_ITEMS: { key: TabKey; label: string; icon: typeof Inbox; count?: boolean }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "messages", label: "Messages", icon: Inbox, count: true },
  { key: "accounts", label: "Accounts", icon: Mail },
  { key: "processing", label: "Processing", icon: ShieldCheck },
  { key: "analytics", label: "Analytics", icon: BarChart2 },
  { key: "templates", label: "Templates", icon: FileText },
  { key: "settings", label: "Settings", icon: Settings2 },
];

/* ——————————————————————————————————————————————
 * DashboardShell Props — all data is server-fetched
 * and passed down as serialized props
 * —————————————————————————————————————————————— */
type DashboardShellProps = {
  email: string;
  accounts?: ConnectedAccount[];
  receivedCount?: number;
  importantCount?: number;
  messages?: EmailMessage[];
  processingJobs?: ProcessingJob[];
  userSettings?: UserSettings | null;
  aiResults?: Array<{
    message_id: string;
    category: string;
    importance: number | string;
    confidence: number | string;
    reason: string;
  }>;
};

export function DashboardShell({
  email,
  accounts = [],
  receivedCount = 0,
  importantCount = 0,
  messages = [],
  processingJobs = [],
  userSettings = null,
}: DashboardShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme, setTheme } = useTheme();

  /* Active sidebar tab — defaults to overview */
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [period, setPeriod] = useState("Last 7 days");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Read URL status messages from OAuth redirect
  useEffect(() => {
    const errorParam = searchParams.get("error");
    const connectedParam = searchParams.get("connected");
    const accountParam = searchParams.get("account");

    if (errorParam) {
      setBanner({
        type: "error",
        text: errorParam.includes("scopes")
          ? "Google permission required: Please check the checkbox allowing Strike to view your emails when connecting."
          : errorParam,
      });
      // Clean query param without page reload
      window.history.replaceState({}, "", window.location.pathname);
    } else if (connectedParam === "true") {
      setBanner({
        type: "success",
        text: accountParam ? `✓ Successfully connected ${accountParam}!` : "✓ Mailbox connected successfully!",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  /* Navigate to Google OAuth flow */
  function handleConnectGmail() {
    window.location.href = "/api/auth/google";
  }

  /* Toggle period filter */
  function handlePeriodChange() {
    setPeriod(period === "Last 7 days" ? "This month" : "Last 7 days");
  }

  /* Derive user initials for avatar display */
  const initials = useMemo(
    () => email.slice(0, 2).toUpperCase() || "MO",
    [email],
  );

  /* Sign out handler */
  async function signOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  /* Render the active tab content */
  function renderTabContent() {
    switch (activeTab) {
      case "overview":
        return (
          <OverviewTab
            accounts={accounts}
            importantCount={importantCount}
            messages={messages}
            onConnectGmail={handleConnectGmail}
            onPeriodChange={handlePeriodChange}
            period={period}
            receivedCount={receivedCount}
          />
        );
      case "messages":
        return <MessagesTab accounts={accounts} messages={messages} />;
      case "accounts":
        return (
          <AccountsTab
            accounts={accounts}
            email={email}
            onConnectGmail={handleConnectGmail}
          />
        );
      case "processing":
        return <ProcessingTab jobs={processingJobs} />;
      case "analytics":
        return (
          <AnalyticsTab
            accounts={accounts}
            jobs={processingJobs}
            messages={messages}
          />
        );
      case "templates":
        return <TemplatesTab />;
      case "settings":
        return <SettingsTab email={email} userSettings={userSettings} />;
      default:
        return null;
    }
  }

  return (
    <div className="dashboard-app">
      {/* Left Navigation Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark"><Sparkles size={15} /></span>
          <span>strike</span>
        </div>

        <nav aria-label="Dashboard navigation" className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-item ${activeTab === item.key ? "active" : ""}`}
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {/* Show message count badge on Messages tab */}
                {item.count && (
                  <span className="nav-count">{receivedCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom User Indicator */}
        <div className="sidebar-footer">
          <button
            aria-label={`Signed in as ${email}. Click to sign out.`}
            className="sidebar-user-pill"
            disabled={isSigningOut}
            onClick={signOut}
            title={isSigningOut ? "Signing out…" : `Sign out (${email})`}
            type="button"
          >
            <span>{initials}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* Top Navigation Bar */}
        <header className="dashboard-header">
          <div className="mobile-brand">
            <span className="brand-mark"><Sparkles size={15} /></span>
            <span>strike</span>
          </div>

          <label className="search-box">
            <Search size={16} aria-hidden="true" />
            <input aria-label="Search email intelligence" placeholder="Search your email intelligence" />
            <kbd>⌘ K</kbd>
          </label>

          <div className="header-actions">
            <button
              aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              className="icon-button theme-toggle"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              title={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              type="button"
            >
              {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button aria-label="Notifications" className="icon-button" type="button">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <span className="header-avatar">{initials}</span>
          </div>
        </header>

        {/* Inner Dashboard Content — switches per active tab */}
        <section className="dashboard-content">
          {banner && (
            <div
              className={`dashboard-banner ${banner.type === "error" ? "banner-error" : "banner-success"}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "20px",
                background: banner.type === "error" ? "rgba(199, 98, 50, 0.15)" : "rgba(46, 120, 70, 0.15)",
                border: `1px solid ${banner.type === "error" ? "var(--peach-line)" : "#2e7846"}`,
                color: "var(--ink)",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {banner.type === "error" ? (
                  <AlertCircle size={18} style={{ color: "var(--peach-glow)", flexShrink: 0 }} />
                ) : (
                  <CheckCircle2 size={18} style={{ color: "#2e7846", flexShrink: 0 }} />
                )}
                <span>{banner.text}</span>
              </div>
              <button
                aria-label="Dismiss message"
                className="icon-button"
                onClick={() => setBanner(null)}
                style={{ width: 24, height: 24 }}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {renderTabContent()}
        </section>
      </main>
    </div>
  );
}
