"use client";
import type { PipelineControls } from "@/common/pipeline-controls";

import Link from "next/link";
import localFont from "next/font/local";
import { DashboardBrand } from "./dashboard-brand";
import styles from "./dashboard-shell.module.css";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/app/theme-provider";
import {
  AlertCircle,
  ArrowRight,
  BarChart2,
  Bell,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileText,
  Flame,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Moon,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  X,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/database/supabase/browser";
import { MessageDetailDrawer } from "./message-detail-drawer";

/* Tab components */
import { OverviewTab } from "./tabs/overview-tab";
import { MessagesTab } from "./tabs/messages-tab";
import { AccountsTab } from "./tabs/accounts-tab";
import { ProcessingTab } from "./tabs/processing-tab";
import { AnalyticsTab } from "./tabs/analytics-tab";
import { TemplatesTab } from "./tabs/templates-tab";
import { SettingsTab } from "./tabs/settings-tab";
import { ErrorLogsTab } from "./tabs/error-logs-tab";

const dashboardFont = localFont({ src: "../../_fonts/geist-latin.woff2", display: "swap", variable: "--font-dashboard" });

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
  provider_message_id?: string;
  thread_id?: string | null;
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

export type CustomPriorityRules = {
  instructions?: string;
  vipSenders?: string[];
  ignoreKeywords?: string[];
};

export type UserSettings = {
  pipeline?: PipelineControls;
  importance_threshold?: number;
  raw_body_retention_days?: number;
  notify_on_important?: boolean;
  notify_on_failure?: boolean;
  whatsapp_destination?: string | null;
  custom_priority_rules?: CustomPriorityRules;
  disable_processing?: boolean;
};

/* Tab key type for the sidebar navigation */
type TabKey = "overview" | "messages" | "accounts" | "processing" | "analytics" | "templates" | "settings" | "error_logs";

/* Sidebar navigation definition — used on desktop sidebar and mobile hamburger drawer */
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
 * Global Search Modal / Command Palette Component
 * —————————————————————————————————————————————— */
type GlobalSearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  messages: EmailMessage[];
  accounts: ConnectedAccount[];
  onNavigateToTab: (tabKey: TabKey) => void;
  onSelectMessage: (msg: EmailMessage) => void;
  onConnectGmail: () => void;
  onToggleTheme: () => void;
  currentTheme: string;
};

type TabSearchResult = {
  id: string;
  type: "tab";
  tabKey: TabKey;
  title: string;
  subtitle: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

type PageSearchResult = {
  id: string;
  type: "page";
  url: string;
  title: string;
  subtitle: string;
  icon: typeof Compass;
};

type ActionSearchResult = {
  id: string;
  type: "action";
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  action: () => void;
};

type EmailSearchResult = {
  id: string;
  type: "email";
  message: EmailMessage;
  title: string;
  sender: string;
  date: string;
  category?: string;
  importance?: number;
  mailbox: string;
};

type SearchResultItem =
  | TabSearchResult
  | PageSearchResult
  | ActionSearchResult
  | EmailSearchResult;

const NAVIGATION_TABS_LIST: Array<{
  key: TabKey;
  title: string;
  subtitle: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "overview", title: "Overview Dashboard", subtitle: "Command center metrics & processing health", icon: LayoutDashboard },
  { key: "messages", title: "Messages & Buckets", subtitle: "Inbox intelligence, time windows & category filters", icon: Inbox },
  { key: "accounts", title: "Connected Mailboxes", subtitle: "Manage Gmail OAuth connections & sync status", icon: Mail },
  { key: "processing", title: "Live AI Activity & Pipeline", subtitle: "Real-time email triage stream & system health", icon: ShieldCheck },
  { key: "analytics", title: "Analytics & Performance", subtitle: "Email volume breakdown & AI classification trends", icon: BarChart2 },
  { key: "templates", title: "WhatsApp Templates", subtitle: "Manage outbound notification & briefing templates", icon: FileText },
  { key: "settings", title: "Settings & AI Priority Rules", subtitle: "Custom triage rules, VIP senders & WhatsApp setup", icon: Settings2 },
];

const STATIC_PAGES_LIST = [
  { url: "/privacy", title: "Privacy Policy", subtitle: "Data protection and Google user data privacy", icon: Compass },
  { url: "/terms", title: "Terms of Service", subtitle: "Strike service terms and acceptable use", icon: Compass },
  { url: "/", title: "Strike Home Landing", subtitle: "Public home and features showcase", icon: Compass },
];

function GlobalSearchModal({
  isOpen,
  onClose,
  messages,
  accounts,
  onNavigateToTab,
  onSelectMessage,
  onConnectGmail,
  onToggleTheme,
  currentTheme,
}: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.email_address])),
    [accounts]
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1. Navigation Tabs
    const matchedTabs: TabSearchResult[] = NAVIGATION_TABS_LIST.filter((tab) => {
      if (!q) return true;
      return tab.title.toLowerCase().includes(q) || tab.subtitle.toLowerCase().includes(q) || tab.key.includes(q);
    }).map((tab) => ({
      id: `tab-${tab.key}`,
      type: "tab" as const,
      tabKey: tab.key,
      title: tab.title,
      subtitle: tab.subtitle,
      icon: tab.icon,
      badge: tab.key === "messages" && messages.length > 0 ? `${messages.length}` : undefined,
    }));

    // 2. Static Pages
    const matchedPages: PageSearchResult[] = STATIC_PAGES_LIST.filter((page) => {
      if (!q) return false;
      return page.title.toLowerCase().includes(q) || page.subtitle.toLowerCase().includes(q) || page.url.includes(q);
    }).map((page) => ({
      id: `page-${page.url}`,
      type: "page" as const,
      url: page.url,
      title: page.title,
      subtitle: page.subtitle,
      icon: page.icon,
    }));

    // 3. Quick Actions
    const quickActions: ActionSearchResult[] = [
      {
        id: "action-connect",
        type: "action" as const,
        title: "Connect New Gmail Account",
        subtitle: "Authorize Google OAuth inbox access",
        icon: Plus,
        action: onConnectGmail,
      },
      {
        id: "action-theme",
        type: "action" as const,
        title: currentTheme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme",
        subtitle: "Toggle dashboard interface color scheme",
        icon: currentTheme === "dark" ? Sun : Moon,
        action: onToggleTheme,
      },
      {
        id: "action-priority-rules",
        type: "action" as const,
        title: "Configure Custom AI Priority Rules",
        subtitle: "Set VIP senders & ignore keywords in Settings",
        icon: Sparkles,
        action: () => onNavigateToTab("settings"),
      },
    ].filter((action) => {
      if (!q) return true;
      return action.title.toLowerCase().includes(q) || action.subtitle.toLowerCase().includes(q);
    });

    // 4. Matching Emails (auto-suggests after 3 letters or 2+)
    let matchedEmails: EmailSearchResult[] = [];
    if (q.length >= 2) {
      matchedEmails = messages
        .filter((msg) => {
          const subject = msg.subject?.toLowerCase() || "";
          const sender = msg.sender?.raw?.toLowerCase() || "";
          const snippet = msg.snippet?.toLowerCase() || "";
          const category = msg.ai_category?.toLowerCase() || "";
          const reason = msg.ai_reason?.toLowerCase() || "";
          const actionItems = (msg.summary?.extracted_items || []).map((i) => i.action.toLowerCase()).join(" ");

          return (
            subject.includes(q) ||
            sender.includes(q) ||
            snippet.includes(q) ||
            category.includes(q) ||
            reason.includes(q) ||
            actionItems.includes(q)
          );
        })
        .slice(0, 8)
        .map((msg) => ({
          id: `email-${msg.id}`,
          type: "email" as const,
          message: msg,
          title: msg.subject || "(No Subject)",
          sender: msg.sender?.raw?.split("<")[0]?.trim() || msg.sender?.raw || "Unknown Sender",
          date: msg.received_at
            ? new Date(msg.received_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "—",
          category: msg.ai_category,
          importance: msg.ai_importance,
          mailbox: accountMap.get(msg.account_id) || "Connected inbox",
        }));
    }

    return {
      tabs: matchedTabs,
      pages: matchedPages,
      actions: quickActions,
      emails: matchedEmails,
      allFlat: [...matchedTabs, ...matchedPages, ...quickActions, ...matchedEmails] as SearchResultItem[],
    };
  }, [query, messages, currentTheme, accountMap, onConnectGmail, onToggleTheme, onNavigateToTab]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.allFlat.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.allFlat.length) % Math.max(1, results.allFlat.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = results.allFlat[selectedIndex];
        if (selected) {
          handleExecuteItem(selected);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, results.allFlat]);

  function handleExecuteItem(item: SearchResultItem) {
    if (item.type === "tab") {
      onNavigateToTab(item.tabKey);
      onClose();
    } else if (item.type === "page") {
      router.push(item.url);
      onClose();
    } else if (item.type === "action") {
      item.action();
      onClose();
    } else if (item.type === "email") {
      onSelectMessage(item.message);
      onClose();
    }
  }

  if (!isOpen) return null;

  let flatCounter = 0;

  return (
    <div className="global-search-backdrop" onClick={onClose}>
      <div className="global-search-modal" onClick={(e) => e.stopPropagation()}>
        {/* Search Header */}
        <div className="global-search-header">
          <Search size={18} className="global-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder="Search tabs, emails, VIP rules (type 3 letters for auto-suggestions)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="global-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear query"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="global-search-kbd">ESC</kbd>
        </div>

        {/* Results Body */}
        <div className="global-search-body">
          {query.length > 0 && query.length < 3 && (
            <div className="global-search-hint">
              <Sparkles size={13} />
              <span>Type at least 3 letters for instant deep inbox search & email suggestions</span>
            </div>
          )}

          {/* 1. Emails */}
          {results.emails.length > 0 && (
            <div className="global-search-section">
              <div className="global-search-section-title">
                <span>INBOX EMAILS & INTELLIGENCE</span>
                <span className="global-search-section-count">{results.emails.length} matches</span>
              </div>
              {results.emails.map((item) => {
                const currentIndex = flatCounter++;
                const isSelected = selectedIndex === currentIndex;
                const msg = item.message;

                return (
                  <div
                    key={item.id}
                    className={`global-search-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleExecuteItem(item)}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                  >
                    <div className="global-search-item-avatar">
                      {(item.sender || "?")[0].toUpperCase()}
                    </div>
                    <div className="global-search-item-info">
                      <div className="global-search-item-top">
                        <span className="global-search-item-sender">{item.sender}</span>
                        <span className="global-search-item-date">{item.date}</span>
                      </div>
                      <div className="global-search-item-subject">
                        {item.title}
                      </div>
                      {msg.snippet && (
                        <div className="global-search-item-snippet">
                          {msg.snippet}
                        </div>
                      )}
                    </div>

                    <div className="global-search-item-badge-wrap">
                      {item.category && (
                        <span
                          className={`status-badge ${
                            item.category === "important"
                              ? "badge-success"
                              : item.category === "promotional"
                              ? "badge-waiting"
                              : item.category === "spam"
                              ? "badge-error"
                              : "badge-processing"
                          }`}
                          style={{ fontSize: "10.5px", padding: "1px 6px" }}
                        >
                          {item.category}
                        </span>
                      )}
                      <ArrowRight size={14} className="global-search-item-arrow" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. Tabs */}
          {results.tabs.length > 0 && (
            <div className="global-search-section">
              <div className="global-search-section-title">
                <span>NAVIGATION TABS</span>
              </div>
              {results.tabs.map((item) => {
                const currentIndex = flatCounter++;
                const isSelected = selectedIndex === currentIndex;
                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    className={`global-search-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleExecuteItem(item)}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                  >
                    <div className="global-search-item-icon-box">
                      <Icon size={16} />
                    </div>
                    <div className="global-search-item-info">
                      <div className="global-search-item-title">{item.title}</div>
                      <div className="global-search-item-subtitle">{item.subtitle}</div>
                    </div>
                    {item.badge && (
                      <span className="global-search-item-count">{item.badge}</span>
                    )}
                    <ArrowRight size={14} className="global-search-item-arrow" />
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. Pages */}
          {results.pages.length > 0 && (
            <div className="global-search-section">
              <div className="global-search-section-title">
                <span>PAGES</span>
              </div>
              {results.pages.map((item) => {
                const currentIndex = flatCounter++;
                const isSelected = selectedIndex === currentIndex;
                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    className={`global-search-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleExecuteItem(item)}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                  >
                    <div className="global-search-item-icon-box">
                      <Icon size={16} />
                    </div>
                    <div className="global-search-item-info">
                      <div className="global-search-item-title">{item.title}</div>
                      <div className="global-search-item-subtitle">{item.subtitle}</div>
                    </div>
                    <ExternalLink size={13} className="global-search-item-arrow" />
                  </div>
                );
              })}
            </div>
          )}

          {/* 4. Quick Actions */}
          {results.actions.length > 0 && (
            <div className="global-search-section">
              <div className="global-search-section-title">
                <span>QUICK ACTIONS</span>
              </div>
              {results.actions.map((item) => {
                const currentIndex = flatCounter++;
                const isSelected = selectedIndex === currentIndex;
                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    className={`global-search-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleExecuteItem(item)}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                  >
                    <div className="global-search-item-icon-box" style={{ background: "rgba(80, 45, 85, 0.08)", color: "var(--brand-plum)" }}>
                      <Icon size={16} />
                    </div>
                    <div className="global-search-item-info">
                      <div className="global-search-item-title">{item.title}</div>
                      <div className="global-search-item-subtitle">{item.subtitle}</div>
                    </div>
                    <ArrowRight size={14} className="global-search-item-arrow" />
                  </div>
                );
              })}
            </div>
          )}

          {results.allFlat.length === 0 && (
            <div className="global-search-empty">
              <Search size={32} strokeWidth={1.5} />
              <p>No results found for &ldquo;{query}&rdquo;</p>
              <small>Try searching for a tab name, sender email, or keyword.</small>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="global-search-footer">
          <div className="global-search-footer-hint">
            <span>Navigate</span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
          </div>
          <div className="global-search-footer-hint">
            <span>Select</span>
            <kbd>↵</kbd>
          </div>
          <div className="global-search-footer-hint">
            <span>Close</span>
            <kbd>ESC</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  initialTab?: TabKey;
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
  initialTab = "overview",
}: DashboardShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme, setTheme } = useTheme();

  /* Active sidebar tab — defaults to initialTab */
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [period, setPeriod] = useState("Last 7 days");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const mobileNavToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = mobileNavRef.current;
    const toggle = mobileNavToggleRef.current;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setIsMobileNavOpen(false); }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const breakpoint = window.matchMedia("(min-width: 769px)");
    const onBreakpoint = () => { if (breakpoint.matches) setIsMobileNavOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    breakpoint.addEventListener("change", onBreakpoint);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      breakpoint.removeEventListener("change", onBreakpoint);
      toggle?.focus();
    };
  }, [isMobileNavOpen]);

  /* Global Search State & Selected Email Drawer */
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedGlobalMessage, setSelectedGlobalMessage] = useState<EmailMessage | null>(null);

  const [currentUserSettings, setCurrentUserSettings] = useState<UserSettings | null>(userSettings);

  useEffect(() => {
    setCurrentUserSettings(userSettings);
  }, [userSettings]);

  // Global Keyboard Shortcut: ⌘ K or Ctrl K to open search
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

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

  // Silent background delta sync: automatically pulls newly arrived emails from Gmail API
  const isBackgroundSyncingRef = useRef(false);

  const triggerBackgroundSync = useCallback(async () => {
    if (isBackgroundSyncingRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    isBackgroundSyncingRef.current = true;
    try {
      const res = await fetch("/api/accounts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        const hasNew = data?.results?.some(
          (r: { synced?: number; today?: number }) => (r.synced ?? 0) > 0 || (r.today ?? 0) > 0
        );
        if (hasNew) {
          router.refresh();
        }
      }
    } catch (err) {
      console.debug("Silent background sync non-fatal error:", err);
    } finally {
      isBackgroundSyncingRef.current = false;
    }
  }, [router]);

  // Supabase Realtime & Continuous Background Sync
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("strike-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_messages" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "processing_jobs" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_accounts" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    // 1. Initial background sync 1.5s after dashboard load
    const initialTimer = setTimeout(() => {
      void triggerBackgroundSync();
    }, 1500);

    // 2. Periodic background delta sync every 45 seconds when active
    const syncInterval = setInterval(() => {
      void triggerBackgroundSync();
    }, 45000);

    // 3. Sync immediately when user switches back to the tab
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void triggerBackgroundSync();
        router.refresh();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(syncInterval);
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      void supabase.removeChannel(channel);
    };
  }, [router, triggerBackgroundSync]);

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
            onNavigateToTab={handleTabSelect}
            onPeriodChange={handlePeriodChange}
            period={period}
            receivedCount={receivedCount}
            onSelectMessage={setSelectedGlobalMessage}
            userSettings={currentUserSettings}
          />
        );
      case "messages":
        return <MessagesTab accounts={accounts} messages={messages} userSettings={currentUserSettings} onConnectGmail={handleConnectGmail} onManageWhatsApp={() => handleTabSelect("settings")} />;
      case "accounts":
        return (
          <AccountsTab
            accounts={accounts}
            email={email}
            onConnectGmail={handleConnectGmail}
          />
        );
      case "processing":
        return (
          <ProcessingTab
            onUpdateUserSettings={(updates) => setCurrentUserSettings((previous) => ({ ...previous, ...updates }))}
            accounts={accounts}
            jobs={processingJobs}
            messages={messages}
            userSettings={currentUserSettings}
          />
        );
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
      case "error_logs":
        return <ErrorLogsTab />;
      case "settings":
        return (
          <SettingsTab
            onOpenProcessing={() => handleTabSelect("processing")}
            email={email}
            userSettings={currentUserSettings}
            onUpdateUserSettings={(updates) => setCurrentUserSettings((previous) => ({ ...previous, ...updates }))}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className={`dashboard-app ${styles.shell} ${dashboardFont.variable}`}>
      {/* =========================================================================
          UNIFIED FULL-WIDTH STICKY TOP NAVBAR (CONNECTED TO STRIKE LOGO)
          ========================================================================= */}
      <header className="dashboard-header">
        {/* Left: Strike Brand Lockup & Mobile Toggle */}
        <div className="header-left">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="mobile-nav-toggle"
            ref={mobileNavToggleRef}
            aria-expanded={isMobileNavOpen}
            aria-controls="dashboard-mobile-navigation"
            aria-label="Open navigation drawer"
          >
            <Menu size={18} />
          </button>

          <div className={styles.mobileBrand}><DashboardBrand /></div>
          <div className={styles.breadcrumb}><span>Workspace</span><span>/</span><strong>{NAV_ITEMS.find((item) => item.key === activeTab)?.label ?? "Error logs"}</strong></div>
        </div>

        {/* Center: Global Search Bar & Command Palette */}
        <div className="header-center">
          <button
            type="button"
            className="search-box"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search email intelligence, tabs, and commands"
          >
            <Search size={15} aria-hidden="true" />
            <span className="search-placeholder">
              Search tabs, emails, VIP rules…
            </span>
            <kbd className="search-kbd">⌘ K</kbd>
          </button>
        </div>

        {/* Right: Actions */}
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
          <span className="header-avatar" title={email}>{initials}</span>
        </div>
      </header>

      {/* =========================================================================
          DASHBOARD BODY (SIDEBAR + MAIN CONTENT AREA)
          ========================================================================= */}
      <div className="dashboard-body">
        {/* Desktop Sidebar Navigation */}
        <aside className={`dashboard-sidebar ${styles.sidebarSurface}`}>
          <div className={styles.sidebarIntro}>
            <DashboardBrand />
            <div className={styles.workspaceIdentity}><span>{initials}</span><div><strong>Your workspace</strong><small>Personal email intelligence</small></div></div>
          </div>
          <p className={styles.navLabel}>YOUR DAILY SPACE</p>
          <nav aria-label="Dashboard navigation" className="sidebar-nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={`nav-item ${activeTab === item.key ? "active" : ""}`}
                  aria-current={activeTab === item.key ? "page" : undefined}
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

          {/* Sidebar Footer with Legal & User Profile */}
          <div className={styles.sidebarConnection}><Mail size={16} /><div><strong>{accounts.length} connected mailbox{accounts.length !== 1 ? "es" : ""}</strong><small>Your inbox, in the loop.</small></div><span /></div>
          <div className="sidebar-footer">
            <div className="sidebar-legal">
              <Link href="/privacy" className="sidebar-legal-link">Privacy</Link>
              <span className="sidebar-legal-dot">•</span>
              <Link href="/terms" className="sidebar-legal-link">Terms</Link>
            </div>
            <div className="sidebar-user-row">
              <span className="sidebar-user-avatar">{initials}</span>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{email ? email.split("@")[0] : "User"}</span>
                <span className="sidebar-user-email">{email}</span>
              </div>
              <button
                type="button"
                onClick={signOut}
                disabled={isSigningOut}
                className="sidebar-signout-btn"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile navigation retains the same destinations and account actions. */}
        {isMobileNavOpen && (
          <div className="mobile-nav-overlay" onClick={() => setIsMobileNavOpen(false)}>
            <div id="dashboard-mobile-navigation" ref={mobileNavRef} role="dialog" aria-modal="true" aria-label="Dashboard navigation" className={`mobile-nav-drawer ${styles.sidebarSurface}`} onClick={(e) => e.stopPropagation()}>
              <div className={styles.mobileDrawerHeading}><DashboardBrand /><button type="button" onClick={() => setIsMobileNavOpen(false)} className="icon-button" aria-label="Close drawer"><X size={20} /></button></div>
              <div className={styles.workspaceIdentity}><span>{initials}</span><div><strong>Your workspace</strong><small>Personal email intelligence</small></div></div>
              <p className={styles.navLabel}>YOUR DAILY SPACE</p>
              <nav className="sidebar-nav" aria-label="Mobile dashboard navigation">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return <button key={item.key} type="button" onClick={() => handleTabSelect(item.key)} className={`nav-item ${isActive ? "active" : ""}`} aria-current={isActive ? "page" : undefined}><Icon size={18} /><span>{item.label}</span>{item.count && <span className="nav-count">{receivedCount}</span>}</button>;
                })}
              </nav>
              <div className="sidebar-footer">
                <div className="sidebar-legal"><Link href="/privacy" className="sidebar-legal-link">Privacy Policy</Link><span className="sidebar-legal-dot">·</span><Link href="/terms" className="sidebar-legal-link">Terms of Service</Link></div>
                <div className="sidebar-user-row"><span className="sidebar-user-avatar">{initials}</span><div className="sidebar-user-info"><span className="sidebar-user-name">{email ? email.split("@")[0] : "User"}</span><span className="sidebar-user-email">{email}</span></div><button type="button" onClick={signOut} disabled={isSigningOut} className="sidebar-signout-btn" title="Sign out" aria-label="Sign out"><LogOut size={16} /></button></div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="dashboard-main">
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

          {/* Dashboard Footer with Privacy and Terms Links */}
          <footer className="dashboard-footer">
            <span className="dashboard-footer-copy">
              © {new Date().getFullYear()} Strike. All rights reserved.
            </span>
            <div className="dashboard-footer-links">
              <Link className="dashboard-footer-link" href="/privacy">
                Privacy Policy
              </Link>
              <span className="dashboard-footer-divider">•</span>
              <Link className="dashboard-footer-link" href="/terms">
                Terms of Service
              </Link>
            </div>
          </footer>
        </section>
      </main>
    </div>

      {/* Global Search & Command Palette Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        messages={messages}
        accounts={accounts}
        onNavigateToTab={handleTabSelect}
        onSelectMessage={(msg) => {
          setSelectedGlobalMessage(msg);
        }}
        onConnectGmail={handleConnectGmail}
        onToggleTheme={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        currentTheme={resolvedTheme || "light"}
      />

      {/* Global Selected Message Detail Drawer */}
      {selectedGlobalMessage && (
        <MessageDetailDrawer
          accounts={accounts}
          message={selectedGlobalMessage}
          onClose={() => setSelectedGlobalMessage(null)}
        />
      )}
    </div>
  );
}
