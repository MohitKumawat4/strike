"use client";

import ui from "./modern-tabs.module.css";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Mail,
  Sparkles,
  Flame,
  FileText,
  Tag,
  ShieldAlert,
  Zap,
} from "lucide-react";

import type {
  ConnectedAccount,
  EmailMessage,
  UserSettings,
} from "../dashboard-shell";
import { MessageDetailDrawer } from "../message-detail-drawer";
import { decodeHtmlEntities } from "@/common/types/domain";

import { InboxWorkspace } from "./inbox-workspace";

type MessagesTabProps = {
  userSettings?: UserSettings | null;
  onConnectGmail: () => void;
  onManageWhatsApp: () => void;
  messages: EmailMessage[];
  accounts: ConnectedAccount[];
};

type TimeRange = "today" | "week" | "month" | "all";
type CategoryFilter =
  | "all"
  | "important"
  | "normal"
  | "promotional"
  | "spam"
  | "action_items";

/* Processing status badge color mapping */
const STATUS_COLORS: Record<string, string> = {
  pending: "badge-waiting",
  processing: "badge-processing",
  completed: "badge-success",
  failed: "badge-error",
};

/* Filter messages by time range helper */
function isWithinTimeRange(
  receivedAtStr: string | null,
  range: TimeRange,
  filterTime: number,
): boolean {
  if (range === "all" || !receivedAtStr) return true;
  const msgDate = new Date(receivedAtStr).getTime();
  const diffMs = filterTime - msgDate;
  if (!Number.isFinite(diffMs) || diffMs < 0) return false;

  if (range === "today") {
    return diffMs <= 24 * 60 * 60 * 1000;
  }
  if (range === "week") {
    return diffMs <= 7 * 24 * 60 * 60 * 1000;
  }
  if (range === "month") {
    return diffMs <= 30 * 24 * 60 * 60 * 1000;
  }
  return true;
}

export function MessagesTab({
  messages,
  accounts,
  userSettings,
  onConnectGmail,
  onManageWhatsApp,
}: MessagesTabProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"focus" | "table">("focus");
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(
    null,
  );
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(
    null,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLabel, setSyncLabel] = useState<string | null>(null);

  /* Pagination state */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [filterTime, setFilterTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setFilterTime(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleSync() {
    setIsSyncing(true);
    setSyncLabel("Syncing…");
    try {
      const res = await fetch("/api/accounts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: accountFilter !== "all" ? accountFilter : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncLabel("✓ Synced");
        router.refresh();
      } else {
        setSyncLabel("Failed");
      }
    } catch {
      setSyncLabel("Failed");
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncLabel(null);
      }, 2500);
    }
  }

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.email_address])),
    [accounts],
  );

  /* Messages filtered by account & time range for bucket counting */
  const timeScopedMessages = useMemo(() => {
    return messages.filter((m) => {
      if (accountFilter !== "all" && m.account_id !== accountFilter)
        return false;
      return isWithinTimeRange(m.received_at, timeRange, filterTime);
    });
  }, [messages, accountFilter, timeRange, filterTime]);

  /* Dynamic bucket counters for the active time range */
  const bucketCounts = useMemo(() => {
    let important = 0;
    let normal = 0;
    let promotional = 0;
    let spam = 0;
    let actionItems = 0;

    for (const m of timeScopedMessages) {
      const cat = m.ai_category?.toLowerCase();
      if (
        cat === "important" ||
        (typeof m.ai_importance === "number" && m.ai_importance >= 0.7)
      ) {
        important++;
      } else if (cat === "promotional") {
        promotional++;
      } else if (cat === "spam") {
        spam++;
      } else {
        normal++;
      }

      if (m.summary?.extracted_items && m.summary.extracted_items.length > 0) {
        actionItems++;
      }
    }

    return {
      total: timeScopedMessages.length,
      important,
      normal,
      promotional,
      spam,
      actionItems,
    };
  }, [timeScopedMessages]);

  /* Final filtered and sorted messages list */
  const filteredMessages = useMemo(() => {
    let result = [...timeScopedMessages];

    // Filter by search query (subject or sender)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.subject?.toLowerCase().includes(q) ||
          m.sender?.raw?.toLowerCase().includes(q),
      );
    }

    // Filter by category bucket
    if (categoryFilter !== "all") {
      if (categoryFilter === "important") {
        result = result.filter(
          (m) =>
            m.ai_category === "important" ||
            (typeof m.ai_importance === "number" && m.ai_importance >= 0.7),
        );
      } else if (categoryFilter === "promotional") {
        result = result.filter((m) => m.ai_category === "promotional");
      } else if (categoryFilter === "spam") {
        result = result.filter((m) => m.ai_category === "spam");
      } else if (categoryFilter === "normal") {
        result = result.filter(
          (m) =>
            !m.ai_category ||
            (m.ai_category === "normal" &&
              (!m.ai_importance || m.ai_importance < 0.7)),
        );
      } else if (categoryFilter === "action_items") {
        result = result.filter(
          (m) =>
            m.summary?.extracted_items && m.summary.extracted_items.length > 0,
        );
      }
    }

    // Sort by date
    result.sort((a, b) => {
      const dateA = new Date(a.received_at || 0).getTime();
      const dateB = new Date(b.received_at || 0).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [timeScopedMessages, search, categoryFilter, sortOrder]);

  /* Calculate pagination slice */
  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredMessages.length);
  const paginatedMessages = filteredMessages.slice(startIndex, endIndex);

  const timeRangeLabels: Record<TimeRange, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    all: "All Time",
  };

  return (
    <div className={ui.page}>
      {/* Header */}
      <div
        className="dashboard-title-row"
        style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}
      >
        <div>
          <p className="eyebrow">INBOX INTELLIGENCE</p>
          <h1>Messages & Buckets</h1>
          <p className="dashboard-subtitle">
            Inspect AI classified emails across your mailboxes. Filter by time
            window and intelligence buckets.
          </p>
        </div>

        <div
          className="dashboard-toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {/* Time Range Selector */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "3px",
              gap: "2px",
            }}
          >
            {(["today", "week", "month", "all"] as TimeRange[]).map((tr) => (
              <button
                key={tr}
                type="button"
                aria-pressed={timeRange === tr}
                onClick={() => {
                  setTimeRange(tr);
                  setCurrentPage(1);
                  setFilterTime(Date.now());
                }}
                style={{
                  padding: "6px 12px",
                  fontSize: "12.5px",
                  fontWeight: 650,
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background:
                    timeRange === tr ? "var(--brand-plum)" : "transparent",
                  color:
                    timeRange === tr
                      ? "var(--brand-plum-text)"
                      : "var(--muted)",
                }}
              >
                {timeRangeLabels[tr]}
              </button>
            ))}
          </div>

          <button
            className="period-button"
            disabled={isSyncing}
            onClick={handleSync}
            type="button"
            style={{ height: "36px" }}
          >
            <RefreshCw size={14} className={isSyncing ? "spin-icon" : ""} />
            <span>{syncLabel || (isSyncing ? "Syncing…" : "Sync All")}</span>
          </button>
        </div>
      </div>

      <div className={ui.bucketFilters} aria-label="Intelligence buckets">
        {(
          [
            {
              value: "all",
              label: "All messages",
              count: timeScopedMessages.length,
              icon: Inbox,
            },
            {
              value: "important",
              label: "Important",
              count: bucketCounts.important,
              icon: Flame,
            },
            {
              value: "normal",
              label: "Normal",
              count: bucketCounts.normal,
              icon: FileText,
            },
            {
              value: "promotional",
              label: "Promotional",
              count: bucketCounts.promotional,
              icon: Tag,
            },
            {
              value: "spam",
              label: "Spam",
              count: bucketCounts.spam,
              icon: ShieldAlert,
            },
            {
              value: "action_items",
              label: "Action items",
              count: bucketCounts.actionItems,
              icon: Zap,
            },
          ] as const
        ).map((bucket) => (
          <button
            type="button"
            key={bucket.value}
            aria-pressed={categoryFilter === bucket.value}
            onClick={() => {
              setCategoryFilter(bucket.value);
              setCurrentPage(1);
            }}
          >
            <bucket.icon size={16} />
            <span>{bucket.label}</span>
            <strong>{bucket.count}</strong>
          </button>
        ))}
      </div>

      {/* Summary Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderRadius: "10px",
          background: "var(--surface-muted)",
          border: "1px solid var(--line)",
          marginBottom: "16px",
          fontSize: "12.5px",
          color: "var(--ink)",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={14} style={{ color: "var(--brand-plum)" }} />
          <span>
            Showing <strong>{filteredMessages.length}</strong> of{" "}
            <strong>{bucketCounts.total}</strong> emails for{" "}
            <strong>{timeRangeLabels[timeRange]}</strong>
            {categoryFilter !== "all" && (
              <span style={{ color: "var(--muted)" }}>
                {" "}
                (filtered by <strong>{categoryFilter}</strong>)
              </span>
            )}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "12px",
            color: "var(--muted)",
          }}
        >
          <span>🔥 {bucketCounts.important} Important</span>
          <span>🏷️ {bucketCounts.promotional} Promo</span>
          <span>🛡️ {bucketCounts.spam} Spam</span>
          <span>⚡ {bucketCounts.actionItems} Actions</span>
        </div>
      </div>

      {/* Toolbar: Search + Filters */}
      <div className="messages-toolbar">
        <div className="search-input-wrapper">
          <Search size={16} />
          <input
            className="search-input"
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by subject or sender…"
            type="text"
            value={search}
          />
        </div>

        <div className="messages-filters">
          {/* Account Filter */}
          <div className="filter-select-wrapper">
            <select
              aria-label="Filter messages by mailbox"
              className="filter-select"
              onChange={(e) => {
                setAccountFilter(e.target.value);
                setCurrentPage(1);
              }}
              value={accountFilter}
            >
              <option value="all">All Accounts ({messages.length})</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email_address}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="filter-select-icon" />
          </div>

          {/* Sort Toggle */}
          <button
            className="period-button"
            onClick={() => {
              setSortOrder(sortOrder === "newest" ? "oldest" : "newest");
              setCurrentPage(1);
            }}
            type="button"
          >
            <span>
              {sortOrder === "newest" ? "Newest first" : "Oldest first"}
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className={ui.viewToolbar}>
        <div>
          <strong>A little more clarity.</strong>
          <span>
            Read the brief, explore the reasoning, or open the original.
          </span>
        </div>
        <div className={ui.segmented} aria-label="Message layout">
          <button
            type="button"
            aria-pressed={viewMode === "focus"}
            onClick={() => setViewMode("focus")}
          >
            <Inbox size={14} /> Focus view
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "table"}
            onClick={() => setViewMode("table")}
          >
            <FileText size={14} /> Table view
          </button>
        </div>
      </div>
      {/* Messages Table & Mobile Expandable Cards */}
      {filteredMessages.length > 0 ? (
        <div
          className={`panel messages-table-panel ${viewMode === "focus" ? ui.focusPanel : ""}`}
        >
          {viewMode === "focus" ? (
            <div className={ui.focusInbox}>
              <InboxWorkspace
                messages={paginatedMessages}
                accounts={accounts}
                receivedCount={filteredMessages.length}
                title="Your intelligence workspace"
                showFilters={false}
                visibleLimit={pageSize}
                userSettings={userSettings}
                onConnectGmail={onConnectGmail}
                onManageWhatsApp={onManageWhatsApp}
                onSelectMessage={setSelectedMessage}
              />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="messages-desktop-table-container">
                <table className="messages-table">
                  <thead>
                    <tr>
                      <th>Sender</th>
                      <th>To Mailbox</th>
                      <th>Subject & Intelligence</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMessages.map((msg) => {
                      const sourceEmail =
                        accountMap.get(msg.account_id) || "Connected inbox";

                      return (
                        <tr
                          key={msg.id}
                          className="message-table-row clickable-row"
                          onClick={() => setSelectedMessage(msg)}
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedMessage(msg);
                            }
                          }}
                          title="Click to view message intelligence"
                        >
                          <td className="msg-sender-cell">
                            <span className="msg-sender-avatar">
                              {(decodeHtmlEntities(msg.sender?.raw) ||
                                "?")[0].toUpperCase()}
                            </span>
                            <span className="msg-sender-text">
                              {decodeHtmlEntities(msg.sender?.raw) || "Unknown"}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "var(--surface-muted)",
                                border: "1px solid var(--line)",
                                color: "var(--muted)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                whiteSpace: "nowrap",
                              }}
                              title={`Received on ${sourceEmail}`}
                            >
                              <Mail size={11} />
                              <span>{sourceEmail}</span>
                            </span>
                          </td>
                          <td className="msg-subject-cell">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <span>
                                {decodeHtmlEntities(msg.subject) ||
                                  "(No subject)"}
                              </span>
                              {msg.ai_category && (
                                <span
                                  className={`status-badge ${
                                    msg.ai_category === "important"
                                      ? "badge-success"
                                      : msg.ai_category === "promotional"
                                        ? "badge-waiting"
                                        : msg.ai_category === "spam"
                                          ? "badge-error"
                                          : "badge-processing"
                                  }`}
                                  style={{
                                    fontSize: "0.65rem",
                                    padding: "1px 6px",
                                  }}
                                >
                                  {msg.ai_category}
                                  {typeof msg.ai_importance === "number" &&
                                    ` (${Math.round(msg.ai_importance * 100)}%)`}
                                </span>
                              )}
                            </div>
                            {msg.snippet && (
                              <small className="msg-snippet">
                                {decodeHtmlEntities(msg.snippet)}
                              </small>
                            )}
                          </td>
                          <td className="msg-date-cell">
                            {msg.received_at
                              ? new Date(msg.received_at).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "—"}
                          </td>
                          <td>
                            <span
                              className={`status-badge ${STATUS_COLORS[msg.processing_status || "pending"] || "badge-waiting"}`}
                            >
                              {msg.processing_status || "pending"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Vertically Expandable Cards */}
              <div className="messages-mobile-card-list">
                {paginatedMessages.map((msg) => {
                  const sourceEmail =
                    accountMap.get(msg.account_id) || "Connected inbox";
                  const isExpanded = expandedMessageId === msg.id;

                  return (
                    <article
                      key={msg.id}
                      className={`messages-mobile-card ${isExpanded ? "is-expanded" : ""}`}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          setExpandedMessageId(isExpanded ? null : msg.id);
                        }
                      }}
                      onClick={() =>
                        setExpandedMessageId(isExpanded ? null : msg.id)
                      }
                    >
                      <div className="mobile-card-header">
                        <div className="mobile-card-sender">
                          <span className="mobile-card-avatar">
                            {(decodeHtmlEntities(msg.sender?.raw) ||
                              "?")[0].toUpperCase()}
                          </span>
                          <span className="mobile-card-sender-text">
                            {decodeHtmlEntities(msg.sender?.raw)
                              ?.split("<")[0]
                              ?.trim() ||
                              decodeHtmlEntities(msg.sender?.raw) ||
                              "Unknown Sender"}
                          </span>
                        </div>
                        <div className="mobile-card-meta">
                          <span className="mobile-card-date">
                            {msg.received_at
                              ? new Date(msg.received_at).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                  },
                                )
                              : "—"}
                          </span>
                          <span className="mobile-card-expand-icon">
                            {isExpanded ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-card-subject-row">
                        <span className="mobile-card-subject">
                          {decodeHtmlEntities(msg.subject) || "(No subject)"}
                        </span>
                        {msg.ai_category && (
                          <span
                            className={`status-badge ${
                              msg.ai_category === "important"
                                ? "badge-success"
                                : msg.ai_category === "promotional"
                                  ? "badge-waiting"
                                  : msg.ai_category === "spam"
                                    ? "badge-error"
                                    : "badge-processing"
                            }`}
                            style={{ fontSize: "0.65rem", padding: "1px 6px" }}
                          >
                            {msg.ai_category}
                          </span>
                        )}
                      </div>

                      {/* Vertically expanded info panel */}
                      {isExpanded && (
                        <div
                          className="mobile-card-expanded-content"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mobile-card-mailbox">
                            <Mail size={12} />
                            <span>
                              To: <strong>{sourceEmail}</strong>
                            </span>
                          </div>

                          {msg.snippet && (
                            <div className="mobile-card-snippet">
                              <strong>Snippet:</strong>{" "}
                              {decodeHtmlEntities(msg.snippet)}
                            </div>
                          )}

                          {msg.ai_reason && (
                            <div className="mobile-card-ai-box">
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  color: "var(--brand-plum)",
                                  fontWeight: 700,
                                }}
                              >
                                <Sparkles size={13} />
                                <span>AI Intelligence Analysis</span>
                              </div>
                              <p
                                style={{
                                  margin: 0,
                                  color: "var(--ink)",
                                  lineHeight: 1.4,
                                }}
                              >
                                {msg.ai_reason}
                              </p>
                            </div>
                          )}

                          <button
                            className="mobile-card-drawer-btn"
                            onClick={() => setSelectedMessage(msg)}
                            type="button"
                          >
                            <ExternalLink size={13} />
                            <span>Open Full Message Intelligence</span>
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
          {/* Pagination Footer Controls */}
          <div className="messages-pagination-bar">
            <div className="pagination-info">
              Showing <strong>{startIndex + 1}</strong>–
              <strong>{endIndex}</strong> of{" "}
              <strong>{filteredMessages.length}</strong> messages
            </div>

            <div className="pagination-controls">
              <div className="pagination-size-wrapper">
                <span className="pagination-size-label">Per page:</span>
                <select
                  aria-label="Messages per page"
                  className="pagination-select"
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  value={pageSize}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="pagination-buttons">
                <button
                  aria-label="Previous page"
                  className="pagination-btn"
                  disabled={validCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  <ChevronLeft size={15} />
                  <span>Prev</span>
                </button>
                <span className="pagination-page-indicator">
                  Page <strong>{validCurrentPage}</strong> of{" "}
                  <strong>{totalPages}</strong>
                </span>
                <button
                  aria-label="Next page"
                  className="pagination-btn"
                  disabled={validCurrentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  type="button"
                >
                  <span>Next</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="panel empty-state-panel">
          <div className="empty-state">
            <Inbox size={48} strokeWidth={1} />
            <h3>
              {messages.length ? "No matching messages" : "No messages yet"}
            </h3>
            <p>
              {messages.length === 0
                ? "Connect a Gmail account to start syncing your inbox."
                : "No messages match your current filters."}
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (!messages.length) {
                  onConnectGmail();
                  return;
                }
                setSearch("");
                setAccountFilter("all");
                setTimeRange("all");
                setCategoryFilter("all");
                setCurrentPage(1);
              }}
            >
              {messages.length ? "Clear filters" : "Connect Gmail"}
            </button>
          </div>
        </div>
      )}

      {/* Message Intelligence Drawer */}
      {selectedMessage && (
        <MessageDetailDrawer
          accounts={accounts}
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </div>
  );
}
