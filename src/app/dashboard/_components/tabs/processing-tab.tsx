"use client";

import ui from "./modern-tabs.module.css";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Loader2,
  Mail,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";

import type { ConnectedAccount, EmailMessage, ProcessingJob, UserSettings } from "../dashboard-shell";
import { MessageDetailDrawer } from "../message-detail-drawer";
import { decodeHtmlEntities } from "@/common/types/domain";

type ProcessingTabProps = {
  jobs: ProcessingJob[];
  messages?: EmailMessage[];
  accounts?: ConnectedAccount[];
  userSettings?: UserSettings | null;
};

type ActivityFilter = "all" | "whatsapp" | "important" | "filtered";

export function ProcessingTab({
  jobs = [],
  messages = [],
  accounts = [],
  userSettings = null,
}: ProcessingTabProps) {
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);

  /* Pagination state */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.email_address])),
    [accounts]
  );

  /* Compute Funnel Counts */
  const threshold =
    typeof userSettings?.importance_threshold === "string"
      ? parseFloat(userSettings.importance_threshold)
      : (userSettings?.importance_threshold ?? 0.7);
  const totalReceived = messages.length;
  const hasWhatsApp = Boolean(userSettings?.whatsapp_destination);

  /* Derive live activity items with human-friendly outcomes */
  const activityItems = useMemo(() => {
    return messages.map((m) => {
      const isImportant =
        m.ai_category === "important" ||
        (typeof m.ai_importance === "number" && m.ai_importance >= threshold);

      let outcome: {
        label: string;
        color: string;
        bg: string;
        type: ActivityFilter;
      };

      if (m.processing_status === "DELIVERED") {
        outcome = {
          label: "📱 Sent to WhatsApp",
          color: "#16a34a",
          bg: "rgba(34, 197, 94, 0.12)",
          type: "whatsapp",
        };
      } else if (isImportant) {
        outcome = {
          label: hasWhatsApp ? "📱 WhatsApp Stream Active" : "⚡ Executive Brief Ready",
          color: "var(--info)",
          bg: "var(--surface-muted)",
          type: hasWhatsApp ? "whatsapp" : "important",
        };
      } else if (m.ai_category === "promotional") {
        outcome = {
          label: "🏷️ Filtered (Promotions Bucket)",
          color: "#d97706",
          bg: "rgba(217, 119, 6, 0.12)",
          type: "filtered",
        };
      } else if (m.ai_category === "spam") {
        outcome = {
          label: "🛡️ Filtered (Spam Suppressed)",
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.12)",
          type: "filtered",
        };
      } else if (m.processing_status === "RECEIVED" || m.processing_status === "pending") {
        outcome = {
          label: "⏳ Queued for AI Triage",
          color: "var(--muted)",
          bg: "var(--surface-muted)",
          type: "all",
        };
      } else {
        outcome = {
          label: "🗄️ Filtered (Normal Noise)",
          color: "var(--brand-plum)",
          bg: "var(--surface-pill)",
          type: "filtered",
        };
      }

      return {
        message: m,
        sourceEmail: accountMap.get(m.account_id) || "Connected inbox",
        outcome,
        isImportant,
      };
    });
  }, [messages, threshold, hasWhatsApp, accountMap]);

  /* Synchronized Funnel & Badge Counts */
  const triagedCount = totalReceived;
  const importantCount = activityItems.filter((item) => item.isImportant).length;
  const noiseCount = activityItems.filter((item) => item.outcome.type === "filtered").length;
  const whatsappDeliveredCount = activityItems.filter(
    (item) => item.outcome.type === "whatsapp" || (hasWhatsApp && item.isImportant)
  ).length;

  const noiseReductionPercent =
    totalReceived > 0 ? Math.round((noiseCount / totalReceived) * 100) : 0;

  /* Filter activity items */
  const filteredActivity = useMemo(() => {
    let result = [...activityItems];

    if (activityFilter === "whatsapp") {
      result = result.filter(
        (item) => item.outcome.type === "whatsapp" || (hasWhatsApp && item.isImportant)
      );
    } else if (activityFilter === "important") {
      result = result.filter((item) => item.isImportant);
    } else if (activityFilter === "filtered") {
      result = result.filter((item) => item.outcome.type === "filtered");
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.message.subject?.toLowerCase().includes(q) ||
          item.message.sender?.raw?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [activityItems, activityFilter, search, hasWhatsApp]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filteredActivity.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredActivity.length);
  const paginatedActivity = filteredActivity.slice(startIndex, endIndex);

  async function handleProcessJobs() {
    setIsProcessing(true);
    setStatusMessage("Scanning mailboxes & running AI triage…");

    try {
      const res = await fetch("/api/jobs/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 25 }),
      });
      const data = await res.json();

      if (data.status === "success") {
        setStatusMessage(`✓ Processed ${data.processed} emails (${data.succeeded} categorized)`);
        router.refresh();
      } else {
        setStatusMessage(`Error: ${data.message || "Scan failed"}`);
      }
    } catch {
      setStatusMessage("Scan failed");
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setStatusMessage(null);
      }, 3500);
    }
  }

  return (
    <div className={ui.page}>
      {/* Header */}
      <div className="dashboard-title-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <p className="eyebrow">LIVE INTELLIGENCE PIPELINE</p>
          <h1>Pipeline & AI Activity</h1>
          <p className="dashboard-subtitle">
            Real-time visibility into how Strike automatically scans, classifies, and delivers your inbox intelligence.
          </p>
        </div>

        <div className="dashboard-toolbar" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <button
            className="primary-button"
            disabled={isProcessing}
            onClick={handleProcessJobs}
            type="button"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "38px" }}
          >
            {isProcessing ? (
              <Loader2 size={15} className="spin-icon" />
            ) : (
              <RefreshCw size={15} />
            )}
            <span>{statusMessage || (isProcessing ? "Scanning…" : "Run On-Demand Scan")}</span>
          </button>
          <span style={{ fontSize: "11px", color: "var(--muted)", fontStyle: "italic" }}>
            Automated real-time push is active.
          </span>
        </div>
      </div>

      {/* 1. Live System Health Status Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {/* Gmail Push */}
        <div className="panel" style={{ padding: "14px 16px", margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>
              <Radio size={14} style={{ color: accounts.length > 0 ? "#16a34a" : "var(--muted)" }} />
              <span>GMAIL STREAM</span>
            </div>
            <span style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: accounts.length > 0 ? "#16a34a" : "#d97706",
              boxShadow: accounts.length > 0 ? "0 0 6px #16a34a" : "none",
            }} />
          </div>
          <div style={{ fontSize: "14px", fontWeight: 750, color: "var(--ink)" }}>
            {accounts.length > 0 ? "Active (Real-time)" : "No Account"}
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
            {accounts.length} connected mailbox(es)
          </div>
        </div>

        {/* AI Engine */}
        <div className="panel" style={{ padding: "14px 16px", margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>
              <Sparkles size={14} style={{ color: "var(--brand-plum)" }} />
              <span>AI TRIAGE ENGINE</span>
            </div>
            <span style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#16a34a",
              boxShadow: "0 0 6px #16a34a",
            }} />
          </div>
          <div style={{ fontSize: "14px", fontWeight: 750, color: "var(--ink)" }}>
            Online (Gemini / OpenAI)
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
            Custom VIP & priority rules applied
          </div>
        </div>

        {/* WhatsApp Delivery */}
        <div className="panel" style={{ padding: "14px 16px", margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>
              <Smartphone size={14} style={{ color: hasWhatsApp ? "#16a34a" : "var(--muted)" }} />
              <span>WHATSAPP STREAM</span>
            </div>
            <span style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: hasWhatsApp ? "#16a34a" : "var(--line)",
              boxShadow: hasWhatsApp ? "0 0 6px #16a34a" : "none",
            }} />
          </div>
          <div style={{ fontSize: "14px", fontWeight: 750, color: "var(--ink)", fontFamily: hasWhatsApp ? "var(--font-mono, monospace)" : "inherit" }}>
            {hasWhatsApp ? userSettings?.whatsapp_destination : "Not Configured"}
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
            {hasWhatsApp ? "Instant alerts & 7:00 AM briefing" : "Configure in Settings tab"}
          </div>
        </div>

        {/* Noise Reduction Rate */}
        <div className="panel" style={{ padding: "14px 16px", margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>
              <Zap size={14} style={{ color: "#d97706" }} />
              <span>NOISE FILTERED</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#d97706" }}>
              {noiseReductionPercent}%
            </span>
          </div>
          <div style={{ fontSize: "14px", fontWeight: 750, color: "var(--ink)" }}>
            {noiseCount} Emails Suppressed
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
            Clutter kept quiet to save you time
          </div>
        </div>
      </div>

      {/* 2. Human-Friendly AI Intelligence Funnel */}
      <div className="panel pipeline-panel" style={{ marginBottom: "20px" }}>
        <div className="panel-heading" style={{ marginBottom: "14px" }}>
          <div>
            <p className="eyebrow">INTELLIGENCE FUNNEL</p>
            <h2>How Strike Protects Your Attention</h2>
            <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "3px 0 0 0" }}>
              Strike continuously scans all incoming email, filters out spam & promotional noise, and only delivers executive briefs for what truly matters.
            </p>
          </div>
        </div>

        <div className={ui.pipelineStages} aria-label="Explore processing stages">
          {[
            { label: "Ingested", count: totalReceived, icon: Mail, filter: "all" as const },
            { label: "AI screened", count: triagedCount, icon: Sparkles, filter: "all" as const },
            { label: "Filtered noise", count: noiseCount, icon: Tag, filter: "filtered" as const },
            { label: "High priority", count: importantCount, icon: Flame, filter: "important" as const },
            { label: "WhatsApp stream", count: whatsappDeliveredCount, icon: Smartphone, filter: "whatsapp" as const },
          ].map((stage, index) => (
            <button key={stage.label} type="button" aria-pressed={selectedStage === index} aria-controls="processing-stage-detail"
              onClick={() => { setSelectedStage(index); setActivityFilter(stage.filter); setCurrentPage(1); }}>
              <span className={ui.stageTop}><stage.icon size={18} /><small>0{index + 1}</small></span>
              <strong>{stage.count.toLocaleString()}</strong><span>{stage.label}</span>
              <span className={ui.stageTrack}><i style={{ width: `${totalReceived ? Math.min(100, stage.count / totalReceived * 100) : 0}%` }} /></span>
            </button>
          ))}
        </div>
        <div id="processing-stage-detail" className={ui.stageDetail} aria-live="polite">
          <Sparkles size={17} />
          <p>{[
            "Every connected mailbox, in one place. The activity stream below shows your incoming email.",
            "Explore the AI category, importance score, and reasoning by opening any email in the activity stream.",
            "Routine and promotional messages stay available for review. The activity stream is now filtered to these quieter conversations.",
            `Emails marked important or scored at least ${Math.round(threshold * 100)}% are shown below. Open a message to review its brief and next steps.`,
            "This view includes priority emails routed toward WhatsApp. A configured connection does not confirm delivery; inspect a message for its recorded status.",
          ][selectedStage]}</p>
        </div>
      </div>

      {/* 3. Live Email Activity Stream (Replaces Cryptic Job ID Table) */}
      <div className="panel messages-table-panel">
        <div className="panel-heading" style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--line)" }}>
          <div>
            <p className="eyebrow">LIVE EMAIL STREAM</p>
            <h2>Live Processing Activity</h2>
            <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "2px 0 0 0" }}>
              Click any email below to inspect its detailed AI reasoning, extracted action items, and direct Gmail link.
            </p>
          </div>
        </div>

        {/* Filter Pills & Search Bar */}
        <div style={{ padding: "12px 20px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
          <div className="search-input-wrapper" style={{ minWidth: "220px", flex: 1 }}>
            <Search size={15} />
            <input
              className="search-input"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity by subject or sender…"
              type="text"
              value={search}
            />
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActivityFilter("all")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 650,
                border: activityFilter === "all" ? "1px solid var(--brand-plum)" : "1px solid var(--line)",
                background: activityFilter === "all" ? "var(--surface-pill)" : "var(--surface)",
                color: activityFilter === "all" ? "var(--brand-plum)" : "var(--muted)",
                cursor: "pointer",
              }}
            >
              All Activity ({activityItems.length})
            </button>

            <button
              type="button"
              onClick={() => setActivityFilter("whatsapp")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 650,
                border: activityFilter === "whatsapp" ? "1px solid #16a34a" : "1px solid var(--line)",
                background: activityFilter === "whatsapp" ? "rgba(34, 197, 94, 0.12)" : "var(--surface)",
                color: activityFilter === "whatsapp" ? "#16a34a" : "var(--muted)",
                cursor: "pointer",
              }}
            >
              📱 WhatsApp Delivered ({whatsappDeliveredCount})
            </button>

            <button
              type="button"
              onClick={() => setActivityFilter("important")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 650,
                border: activityFilter === "important" ? "1px solid var(--info)" : "1px solid var(--line)",
                background: activityFilter === "important" ? "var(--surface-muted)" : "var(--surface)",
                color: activityFilter === "important" ? "var(--info)" : "var(--muted)",
                cursor: "pointer",
              }}
            >
              ⚡ Important Briefs ({importantCount})
            </button>

            <button
              type="button"
              onClick={() => setActivityFilter("filtered")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 650,
                border: activityFilter === "filtered" ? "1px solid #d97706" : "1px solid var(--line)",
                background: activityFilter === "filtered" ? "rgba(217, 119, 6, 0.12)" : "var(--surface)",
                color: activityFilter === "filtered" ? "#d97706" : "var(--muted)",
                cursor: "pointer",
              }}
            >
              🗄️ Filtered Noise ({noiseCount})
            </button>
          </div>
        </div>

        {/* Desktop Table View */}
        {filteredActivity.length > 0 ? (
          <>
            <div className="messages-desktop-table-container">
              <table className="messages-table">
                <thead>
                  <tr>
                    <th>Email & Sender</th>
                    <th>To Mailbox</th>
                    <th>AI Classification</th>
                    <th>Pipeline Outcome</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedActivity.map(({ message, sourceEmail, outcome }) => {
                    return (
                      <tr
                        key={message.id}
                        className="message-table-row clickable-row"
                        onClick={() => setSelectedMessage(message)}
                        title="Click to inspect AI reasoning and full intelligence"
                      >
                        {/* Sender & Subject */}
                        <td className="msg-sender-cell" style={{ maxWidth: "260px" }}>
                          <span className="msg-sender-avatar">
                            {(decodeHtmlEntities(message.sender?.raw) || "?")[0].toUpperCase()}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                            <span className="msg-sender-text" style={{ fontWeight: 650 }}>
                              {decodeHtmlEntities(message.sender?.raw)?.split("<")[0]?.trim() || decodeHtmlEntities(message.sender?.raw) || "Unknown"}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {decodeHtmlEntities(message.subject) || "(No Subject)"}
                            </span>
                          </div>
                        </td>

                        {/* Mailbox */}
                        <td>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              padding: "2px 7px",
                              borderRadius: "6px",
                              background: "var(--surface-muted)",
                              border: "1px solid var(--line)",
                              color: "var(--muted)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Mail size={10} />
                            <span>{sourceEmail}</span>
                          </span>
                        </td>

                        {/* AI Classification Badge */}
                        <td>
                          {message.ai_category ? (
                            <span
                              className={`status-badge ${
                                message.ai_category === "important"
                                  ? "badge-success"
                                  : message.ai_category === "promotional"
                                  ? "badge-waiting"
                                  : message.ai_category === "spam"
                                  ? "badge-error"
                                  : "badge-processing"
                              }`}
                              style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                            >
                              {message.ai_category.toUpperCase()}
                              {typeof message.ai_importance === "number" && ` (${Math.round(message.ai_importance * 100)}%)`}
                            </span>
                          ) : (
                            <span className="status-badge badge-waiting" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                              PENDING
                            </span>
                          )}
                        </td>

                        {/* Pipeline Outcome Badge */}
                        <td>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 650,
                              padding: "4px 9px",
                              borderRadius: "7px",
                              background: outcome.bg,
                              color: outcome.color,
                              border: `1px solid ${outcome.color}30`,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {outcome.label}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="msg-date-cell">
                          {message.received_at
                            ? new Date(message.received_at).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="messages-mobile-card-list">
              {paginatedActivity.map(({ message, sourceEmail, outcome }) => (
                <div
                  key={message.id}
                  className="messages-mobile-card clickable-row"
                  onClick={() => setSelectedMessage(message)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="mobile-card-header">
                    <div className="mobile-card-sender">
                      <span className="mobile-card-avatar">
                        {(decodeHtmlEntities(message.sender?.raw) || "?")[0].toUpperCase()}
                      </span>
                      <span className="mobile-card-sender-text">
                        {decodeHtmlEntities(message.sender?.raw)?.split("<")[0]?.trim() || decodeHtmlEntities(message.sender?.raw) || "Unknown"}
                      </span>
                    </div>
                    <span className="mobile-card-date">
                      {message.received_at
                        ? new Date(message.received_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>

                  <div style={{ fontSize: "13px", fontWeight: 650, color: "var(--ink)", margin: "6px 0 8px 0" }}>
                    {decodeHtmlEntities(message.subject) || "(No Subject)"}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 650,
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: outcome.bg,
                        color: outcome.color,
                        border: `1px solid ${outcome.color}30`,
                      }}
                    >
                      {outcome.label}
                    </span>

                    <span style={{ fontSize: "11.5px", color: "var(--brand-plum)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      Inspect <ExternalLink size={11} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="messages-pagination-bar">
              <div className="pagination-info">
                Showing <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of <strong>{filteredActivity.length}</strong> activity events
              </div>

              <div className="pagination-controls">
                <div className="pagination-size-wrapper">
                  <span className="pagination-size-label">Per page:</span>
                  <select
                    aria-label="Activity events per page"
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
          </>
        ) : (
          <div className="panel empty-state-panel" style={{ border: "none" }}>
            <div className="empty-state">
              <ShieldCheck size={44} strokeWidth={1} />
              <h3>No activity records found</h3>
              <p>
                {messages.length === 0
                  ? "Connect your Gmail account to begin live monitoring."
                  : "No emails match your current activity filter."}
              </p>
            </div>
          </div>
        )}
      </div>

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

