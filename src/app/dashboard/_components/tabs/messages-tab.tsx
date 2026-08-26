"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Search,
  ChevronDown,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Mail,
} from "lucide-react";

import type { ConnectedAccount, EmailMessage } from "../dashboard-shell";
import { MessageDetailDrawer } from "../message-detail-drawer";

type MessagesTabProps = {
  messages: EmailMessage[];
  accounts: ConnectedAccount[];
};

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
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLabel, setSyncLabel] = useState<string | null>(null);

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

  /* Filtered and sorted messages */
  const filteredMessages = useMemo(() => {
    let result = [...messages];

    // Filter by search query (subject or sender)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.subject?.toLowerCase().includes(q) ||
          m.sender?.raw?.toLowerCase().includes(q)
      );
    }

    // Filter by connected account
    if (accountFilter !== "all") {
      result = result.filter((m) => m.account_id === accountFilter);
    }

    // Sort by date
    result.sort((a, b) => {
      const dateA = new Date(a.received_at || 0).getTime();
      const dateB = new Date(b.received_at || 0).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [messages, search, accountFilter, sortOrder]);

  return (
    <>
      {/* Header */}
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">INBOX INTELLIGENCE</p>
          <h1>Messages</h1>
          <p className="dashboard-subtitle">
            All synced emails across your connected accounts. Click any message to inspect AI intelligence and executive summaries.
          </p>
        </div>
        <div className="dashboard-toolbar">
          <button
            className="period-button"
            disabled={isSyncing}
            onClick={handleSync}
            type="button"
          >
            <RefreshCw size={14} className={isSyncing ? "spin-icon" : ""} />
            <span>{syncLabel || (isSyncing ? "Syncing…" : "Sync Inbox")}</span>
          </button>
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

      {/* Messages Table */}
      {filteredMessages.length > 0 ? (
        <div className="panel messages-table-panel">
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
              {filteredMessages.map((msg) => {
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
