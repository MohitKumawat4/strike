"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/app/theme-provider";
import {
  AlertCircle,
  BarChart2,
  Bell,
  CheckCircle2,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Moon,
  Search,
  Settings2,
  Shield,
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
  recipients?: Array<{ raw?: string }>;
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
  whatsapp_destination?: string | null;
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

/* Quick items for mobile bottom bar */
const MOBILE_BOTTOM_ITEMS: { key: TabKey; label: string; icon: typeof Inbox; count?: boolean }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "messages", label: "Messages", icon: Inbox, count: true },
  { key: "accounts", label: "Accounts", icon: Mail },
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Read URL status messages from OAuth redirect
  useEffect(() => {
    const errorParam = searchParams.get("error");
    const successParam = searchParams.get("success");

    if (errorParam === "google_oauth_denied") {
      setBanner({
        type: "error",
        text: "Google sign-in was canceled or access was denied. Please retry if you wish to connect your account.",
      });
    } else if (errorParam === "google_auth_failed") {
      setBanner({
        type: "error",
        text: "Authentication with Google failed. Please check your credentials and try again.",
      });
    } else if (successParam === "account_connected") {
      setBanner({
        type: "success",
        text: "Gmail account successfully connected and monitoring enabled.",
      });
    }
  }, [searchParams]);

  // Connect Gmail Action Trigger
  function handleConnectGmail() {
    window.location.href = "/api/auth/google/login";
  }

  // Time period filter handler
  function handlePeriodChange() {
    setPeriod((prev) => (prev === "Last 7 days" ? "This month" : "Last 7 days"));
  }

  /* Derive user initials for avatar display */
  const initials = useMemo(() => {
    if (!email) return "ST";
    const parts = email.split("@")[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  }, [email]);

  /* Sign out handler */
  async function signOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function handleTabSelect(key: TabKey) {
    setActiveTab(key);
    setIsMobileNavOpen(false);
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
      {/* =========================================================================
          DESKTOP SIDEBAR
          ========================================================================= */}
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
                onClick={() => handleTabSelect(item.key)}
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

        {/* Bottom User Indicator & Legal Links */}
        <div className="sidebar-footer">
          <div
            className="sidebar-legal-links"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              width: "100%",
              marginBottom: "12px",
              borderTop: "1px solid var(--line)",
              paddingTop: "12px",
            }}
          >
            <Link
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                fontSize: "0.76rem",
                color: "var(--muted)",
                textDecoration: "none",
                borderRadius: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <Shield size={13} style={{ flexShrink: 0 }} />
              <span>Privacy Policy</span>
            </Link>
            <Link
              href="/terms"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                fontSize: "0.76rem",
                color: "var(--muted)",
                textDecoration: "none",
                borderRadius: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <FileText size={13} style={{ flexShrink: 0 }} />
              <span>Terms of Service</span>
            </Link>
          </div>

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

      {/* =========================================================================
          MOBILE SLIDE-OVER NAVIGATION DRAWER
          ========================================================================= */}
      {isMobileNavOpen && (
        <div className="mobile-nav-overlay" onClick={() => setIsMobileNavOpen(false)}>
          <div className="mobile-nav-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--line)]">
              <div className="flex items-center gap-2 font-extrabold text-lg text-[var(--ink)]">
                <div className="w-7 h-7 rounded-lg bg-[var(--brand-plum)] text-white flex items-center justify-center text-xs">
                  <Sparkles size={14} />
                </div>
                <span>strike</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="w-8 h-8 rounded-lg border border-[var(--line)] flex items-center justify-center text-[var(--muted)]"
                aria-label="Close drawer"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="space-y-1 flex-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleTabSelect(item.key)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold transition-colors ${
                      isActive
                        ? "bg-[var(--surface-pill)] text-[var(--brand-plum)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                    {item.count && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--line)] text-[var(--ink)]">
                        {receivedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 mt-4 border-t border-[var(--line)] space-y-3">
              <div className="flex flex-col gap-1 text-xs text-[var(--muted)] font-semibold">
                <Link href="/privacy" className="py-1 hover:text-[var(--ink)]">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="py-1 hover:text-[var(--ink)]">
                  Terms of Service
                </Link>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-[var(--surface-pill)] text-[var(--brand-plum)] flex items-center justify-center font-bold text-xs">
                    {initials}
                  </span>
                  <div className="text-xs font-bold text-[var(--ink)] truncate max-w-[140px]">
                    {email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  disabled={isSigningOut}
                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MAIN CONTENT AREA & TOP HEADER
          ========================================================================= */}
      <main className="dashboard-main">
        {/* Top Navigation Bar */}
        <header className="dashboard-header">
          {/* Mobile Hamburger Button + Brand */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden w-8 h-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] flex items-center justify-center text-[var(--ink)]"
              aria-label="Open navigation drawer"
            >
              <Menu size={17} />
            </button>
            <div className="mobile-brand">
              <span className="brand-mark"><Sparkles size={14} /></span>
              <span>strike</span>
            </div>
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

      {/* =========================================================================
          MOBILE QUICK BOTTOM NAVIGATION BAR
          ========================================================================= */}
      <nav aria-label="Mobile navigation" className="mobile-bottom-nav md:hidden">
        {MOBILE_BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleTabSelect(item.key)}
              className={`mobile-bottom-nav-item ${isActive ? "active" : ""}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.count && receivedCount > 0 && (
                <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-[var(--brand-plum)]" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
