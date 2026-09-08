"use client";

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
  AlertCircle,
  RefreshCw,
  Mail,
  Sparkles,
  Calendar,
  Flame,
  FileText,
  Tag,
  ShieldAlert,
  Zap,
  CheckCircle2,
} from "lucide-react";

import type { ConnectedAccount, EmailMessage } from "../dashboard-shell";
import { MessageDetailDrawer } from "../message-detail-drawer";

type MessagesTabProps = {
  messages: EmailMessage[];
  accounts: ConnectedAccount[];
};

type TimeRange = "today" | "week" | "month" | "all";
type CategoryFilter = "all" | "important" | "normal" | "promotional" | "spam" | "action_items";

/* Processing status badge color mapping */
const STATUS_COLORS: Record<string, string> = {
  pending: "badge-waiting",
  processing: "badge-processing",
  completed: "badge-success",
  failed: "badge-error",
};

export function MessagesTab({ messages, accounts }: MessagesTabProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLabel, setSyncLabel] = useState<string | null>(null);

  /* Pagination state */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 whenever search, filter, time range, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, accountFilter, timeRange, categoryFilter, sortOrder]);

  async function handleSync() {
    setIsSyncing(true);
    setSyncLabel("Syncing…");
    try {
      const res = await fetch("/api/accounts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: accountFilter !== "all" ? accountFilter : undefined }),
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
    [accounts]
  );

  /* Filter messages by time range helper */
  function isWithinTimeRange(receivedAtStr: string | null, range: TimeRange): boolean {
    if (range === "all" || !receivedAtStr) return true;
    const msgDate = new Date(receivedAtStr).getTime();
    const now = Date.now();
    const diffMs = now - msgDate;

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

  /* Messages filtered by account & time range for bucket counting */
  const timeScopedMessages = useMemo(() => {
    return messages.filter((m) => {
      if (accountFilter !== "all" && m.account_id !== accountFilter) return false;
      return isWithinTimeRange(m.received_at, timeRange);
    });
  }, [messages, accountFilter, timeRange]);

  /* Dynamic bucket counters for the active time range */
  const bucketCounts = useMemo(() => {
    let important = 0;
    let normal = 0;
    let promotional = 0;
    let spam = 0;
    let actionItems = 0;

    for (const m of timeScopedMessages) {
      const cat = m.ai_category?.toLowerCase();
      if (cat === "important" || (typeof m.ai_importance === "number" && m.ai_importance >= 0.7)) {
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
          m.sender?.raw?.toLowerCase().includes(q)
      );
    }

    // Filter by category bucket
    if (categoryFilter !== "all") {
      if (categoryFilter === "important") {
        result = result.filter(
          (m) => m.ai_category === "important" || (typeof m.ai_importance === "number" && m.ai_importance >= 0.7)
        );
      } else if (categoryFilter === "promotional") {
        result = result.filter((m) => m.ai_category === "promotional");
      } else if (categoryFilter === "spam") {
        result = result.filter((m) => m.ai_category === "spam");
      } else if (categoryFilter === "normal") {
        result = result.filter(
          (m) =>
            !m.ai_category ||
            (m.ai_category === "normal" && (!m.ai_importance || m.ai_importance < 0.7))
        );
      } else if (categoryFilter === "action_items") {
        result = result.filter(
          (m) => m.summary?.extracted_items && m.summary.extracted_items.length > 0
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
    <>
      {/* Header */}
      <div className="dashboard-title-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <p className="eyebrow">INBOX INTELLIGENCE</p>
          <h1>Messages & Buckets</h1>
          <p className="dashboard-subtitle">
            Inspect AI classified emails across your mailboxes. Filter by time window and intelligence buckets.
          </p>
        </div>

        <div className="dashboard-toolbar" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
                onClick={() => setTimeRange(tr)}
                style={{
                  padding: "6px 12px",
                  fontSize: "12.5px",
                  fontWeight: 650,
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: timeRange === tr ? "var(--brand-plum)" : "transparent",
                  color: timeRange === tr ? "#ffffff" : "var(--muted)",
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

      {/* Category Bucket Pills */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          overflowX: "auto",
          paddingBottom: "4px",
          scrollbarWidth: "none",
        }}
      >
        {/* All Pill */}
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 650,
            border: categoryFilter === "all" ? "1px solid var(--brand-plum)" : "1px solid var(--line)",
            background: categoryFilter === "all" ? "var(--surface-pill)" : "var(--surface)",
            color: categoryFilter === "all" ? "var(--brand-plum)" : "var(--ink)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <Inbox size={14} />
          <span>All Messages</span>
          <span
            style={{
              fontSize: "11px",
              padding: "1px 7px",
              borderRadius: "999px",
              background: categoryFilter === "all" ? "var(--brand-plum)" : "var(--surface-muted)",
              color: categoryFilter === "all" ? "#fff" : "var(--muted)",
              fontWeight: 700,
            }}
          >
            {bucketCounts.total}
          </span>
        </button>

        {/* Important Pill */}
        <button
          type="button"
          onClick={() => setCategoryFilter("important")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 650,
            border: categoryFilter === "important" ? "1px solid #16a34a" : "1px solid var(--line)",
            background: categoryFilter === "important" ? "rgba(34, 197, 94, 0.12)" : "var(--surface)",
            color: categoryFilter === "important" ? "#16a34a" : "var(--ink)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <Flame size={14} style={{ color: "#16a34a" }} />
          <span>Important</span>
          <span
            style={{
              fontSize: "11px",
              padding: "1px 7px",
              borderRadius: "999px",
              background: categoryFilter === "important" ? "#16a34a" : "rgba(34, 197, 94, 0.15)",
              color: categoryFilter === "important" ? "#fff" : "#16a34a",
              fontWeight: 700,
            }}
          >
            {bucketCounts.important}
          </span>
        </button>

        {/* Normal Pill */}
        <button
          type="button"
          onClick={() => setCategoryFilter("normal")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 650,
            border: categoryFilter === "normal" ? "1px solid var(--brand-plum)" : "1px solid var(--line)",
            background: categoryFilter === "normal" ? "var(--surface-pill)" : "var(--surface)",
            color: categoryFilter === "normal" ? "var(--brand-plum)" : "var(--ink)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <FileText size={14} />
          <span>Normal</span>
          <span
            style={{
              fontSize: "11px",
              padding: "1px 7px",
              borderRadius: "999px",
              background: categoryFilter === "normal" ? "var(--brand-plum)" : "var(--surface-muted)",
              color: categoryFilter === "normal" ? "#fff" : "var(--muted)",
              fontWeight: 700,
            }}
          >
            {bucketCounts.normal}
          </span>
        </button>

        {/* Promotional Pill */}
        <button
          type="button"
          onClick={() => setCategoryFilter("promotional")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 650,
            border: categoryFilter === "promotional" ? "1px solid #d97706" : "1px solid var(--line)",
            background: categoryFilter === "promotional" ? "rgba(217, 119, 6, 0.12)" : "var(--surface)",
            color: categoryFilter === "promotional" ? "#d97706" : "var(--ink)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <Tag size={14} style={{ color: "#d97706" }} />
          <span>Promotional</span>
          <span
            style={{
              fontSize: "11px",
              padding: "1px 7px",
              borderRadius: "999px",
              background: categoryFilter === "promotional" ? "#d97706" : "rgba(217, 119, 6, 0.15)",
              color: categoryFilter === "promotional" ? "#fff" : "#d97706",
              fontWeight: 700,
            }}
          >
            {bucketCounts.promotional}
          </span>
        </button>

        {/* Spam Pill */}
        <button
          type="button"
          onClick={() => setCategoryFilter("spam")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 650,
            border: categoryFilter === "spam" ? "1px solid #ef4444" : "1px solid var(--line)",
            background: categoryFilter === "spam" ? "rgba(239, 68, 68, 0.12)" : "var(--surface)",
            color: categoryFilter === "spam" ? "#ef4444" : "var(--ink)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <ShieldAlert size={14} style={{ color: "#ef4444" }} />
          <span>Spam</span>
          <span
            style={{
              fontSize: "11px",
              padding: "1px 7px",
              borderRadius: "999px",
              background: categoryFilter === "spam" ? "#ef4444" : "rgba(239, 68, 68, 0.15)",
              color: categoryFilter === "spam" ? "#fff" : "#ef4444",
              fontWeight: 700,
            }}
          >
            {bucketCounts.spam}
          </span>
        </button>

        {/* Action Items Pill */}
        <button
          type="button"
          onClick={() => setCategoryFilter("action_items")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 650,
            border: categoryFilter === "action_items" ? "1px solid #8b5cf6" : "1px solid var(--line)",
            background: categoryFilter === "action_items" ? "rgba(139, 92, 246, 0.12)" : "var(--surface)",
            color: categoryFilter === "action_items" ? "#8b5cf6" : "var(--ink)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <Zap size={14} style={{ color: "#8b5cf6" }} />
          <span>Action Items</span>
          <span
            style={{
              fontSize: "11px",
              padding: "1px 7px",
              borderRadius: "999px",
              background: categoryFilter === "action_items" ? "#8b5cf6" : "rgba(139, 92, 246, 0.15)",
              color: categoryFilter === "action_items" ? "#fff" : "#8b5cf6",
              fontWeight: 700,
            }}
          >
            {bucketCounts.actionItems}
          </span>
        </button>
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
            Showing <strong>{filteredMessages.length}</strong> of <strong>{bucketCounts.total}</strong> emails for <strong>{timeRangeLabels[timeRange]}</strong>
            {categoryFilter !== "all" && (
              <span style={{ color: "var(--muted)" }}> (filtered by <strong>{categoryFilter}</strong>)</span>
            )}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--muted)" }}>
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject or sender…"
            type="text"
            value={search}
          />
        </div>

        <div className="messages-filters">
          {/* Account Filter */}
          <div className="filter-select-wrapper">
            <select
              className="filter-select"
              onChange={(e) => setAccountFilter(e.target.value)}
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
            onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
            type="button"
          >
            <span>{sortOrder === "newest" ? "Newest first" : "Oldest first"}</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Messages Table & Mobile Expandable Cards */}
      {filteredMessages.length > 0 ? (
        <div className="panel messages-table-panel">
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
                  const sourceEmail = accountMap.get(msg.account_id) || "Connected inbox";

                  return (
                    <tr 
                      key={msg.id} 
                      className="message-table-row clickable-row"
                      onClick={() => setSelectedMessage(msg)}
                      title="Click to view message intelligence"
                    >
                      <td className="msg-sender-cell">
                        <span className="msg-sender-avatar">
                          {(msg.sender?.raw || "?")[0].toUpperCase()}
                        </span>
                        <span className="msg-sender-text">
                          {msg.sender?.raw || "Unknown"}
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span>{msg.subject || "(No subject)"}</span>
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
                              {typeof msg.ai_importance === "number" && ` (${Math.round(msg.ai_importance * 100)}%)`}
                            </span>
                          )}
                        </div>
                        {msg.snippet && (
                          <small className="msg-snippet">{msg.snippet}</small>
                        )}
                      </td>
                      <td className="msg-date-cell">
                        {msg.received_at
                          ? new Date(msg.received_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td>
                        <span className={`status-badge ${STATUS_COLORS[msg.processing_status || "pending"] || "badge-waiting"}`}>
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
              const sourceEmail = accountMap.get(msg.account_id) || "Connected inbox";
              const isExpanded = expandedMessageId === msg.id;

              return (
                <article
                  key={msg.id}
                  className={`messages-mobile-card ${isExpanded ? "is-expanded" : ""}`}
                  onClick={() => setExpandedMessageId(isExpanded ? null : msg.id)}
                >
                  <div className="mobile-card-header">
                    <div className="mobile-card-sender">
                      <span className="mobile-card-avatar">
                        {(msg.sender?.raw || "?")[0].toUpperCase()}
                      </span>
                      <span className="mobile-card-sender-text">
                        {msg.sender?.raw?.split("<")[0]?.trim() || msg.sender?.raw || "Unknown Sender"}
                      </span>
                    </div>
                    <div className="mobile-card-meta">
                      <span className="mobile-card-date">
                        {msg.received_at
                          ? new Date(msg.received_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </span>
                      <span className="mobile-card-expand-icon">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </div>
                  </div>

                  <div className="mobile-card-subject-row">
                    <span className="mobile-card-subject">
                      {msg.subject || "(No subject)"}
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
                    <div className="mobile-card-expanded-content" onClick={(e) => e.stopPropagation()}>
                      <div className="mobile-card-mailbox">
                        <Mail size={12} />
                        <span>To: <strong>{sourceEmail}</strong></span>
                      </div>

                      {msg.snippet && (
                        <div className="mobile-card-snippet">
                          <strong>Snippet:</strong> {msg.snippet}
                        </div>
                      )}

                      {msg.ai_reason && (
                        <div className="mobile-card-ai-box">
                          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--brand-plum)", fontWeight: 700 }}>
                            <Sparkles size={13} />
                            <span>AI Intelligence Analysis</span>
                          </div>
                          <p style={{ margin: 0, color: "var(--ink)", lineHeight: 1.4 }}>{msg.ai_reason}</p>
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

          {/* Pagination Footer Controls */}
          <div className="messages-pagination-bar">
            <div className="pagination-info">
              Showing <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of <strong>{filteredMessages.length}</strong> messages
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
                  Page <strong>{validCurrentPage}</strong> of <strong>{totalPages}</strong>
                </span>
                <button
                  aria-label="Next page"
                  className="pagination-btn"
                  disabled={validCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
            <h3>No messages yet</h3>
            <p>
              {messages.length === 0
                ? "Connect a Gmail account to start syncing your inbox."
                : "No messages match your current filters."}
            </p>
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
    </>
  );
}
