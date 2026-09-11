"use client";

import ui from "./modern-tabs.module.css";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bug,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  Flame,
  Info,
  Layers,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  X,
  Zap,
} from "lucide-react";

import {
  type ExecutionLayer,
  type ErrorSeverity,
  type LayerErrorRecord,
  LAYER_TITLES,
} from "@/common/logging/layer-logger.types";

const LAYER_CONFIG: Record<
  ExecutionLayer,
  { label: string; number: number; icon: typeof Layers; color: string; bg: string }
> = {
  ingestion: {
    label: "1. Ingestion",
    number: 1,
    icon: Mail,
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.12)",
  },
  filtration: {
    label: "2. Filtration",
    number: 2,
    icon: Filter,
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.12)",
  },
  triage: {
    label: "3. AI Triage",
    number: 3,
    icon: Sparkles,
    color: "#9333ea",
    bg: "rgba(147, 51, 234, 0.12)",
  },
  summarization: {
    label: "4. Summarization",
    number: 4,
    icon: Zap,
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
  },
  delivery: {
    label: "5. Delivery System",
    number: 5,
    icon: Smartphone,
    color: "#16a34a",
    bg: "rgba(34, 197, 94, 0.12)",
  },
  system: {
    label: "6. System & Crons",
    number: 6,
    icon: Terminal,
    color: "#64748b",
    bg: "rgba(100, 116, 139, 0.12)",
  },
};

type TimeRange = "today" | "24h" | "7d" | "30d" | "all";
type SortOption = "newest" | "oldest" | "severity";

export function ErrorLogsTab() {
  const [logs, setLogs] = useState<LayerErrorRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /* Filter states */
  const [selectedLayer, setSelectedLayer] = useState<ExecutionLayer | "all">("all");
  const [selectedSeverity, setSelectedSeverity] = useState<ErrorSeverity | "all">("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [sortOrder, setSortOrder] = useState<SortOption>("newest");
  const [search, setSearch] = useState("");

  /* Pagination */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  /* Detail inspection drawer */
  const [selectedLog, setSelectedLog] = useState<LayerErrorRecord | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  /* Simulation modal */
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedStatus, setSimulatedStatus] = useState<string | null>(null);

  async function loadLogs(showSpinner = true) {
    if (showSpinner) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (selectedLayer !== "all") params.set("layer", selectedLayer);
      if (selectedSeverity !== "all") params.set("severity", selectedSeverity);
      if (timeRange !== "all") params.set("timeRange", timeRange);
      if (sortOrder !== "newest") params.set("sort", sortOrder);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", String(pageSize));
      params.set("offset", String((currentPage - 1) * pageSize));

      const res = await fetch(`/api/error-logs?${params.toString()}`);
      const data = await res.json();

      if (data.status === "success") {
        setLogs(data.logs || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch error logs:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadLogs(true);
  }, [selectedLayer, selectedSeverity, timeRange, sortOrder, currentPage, pageSize]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLogs(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  /* Calculate summary stats */
  const stats = useMemo(() => {
    const total = totalCount;
    const criticalCount = logs.filter((l) => l.severity === "critical").length;
    const errorsCount = logs.filter((l) => l.severity === "error").length;

    // Determine layer with most errors
    const layerCounts: Record<string, number> = {};
    for (const log of logs) {
      layerCounts[log.layer] = (layerCounts[log.layer] || 0) + 1;
    }
    let topLayer = "None";
    let maxCount = 0;
    for (const [layer, count] of Object.entries(layerCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topLayer = LAYER_CONFIG[layer as ExecutionLayer]?.label || layer;
      }
    }

    return {
      total,
      criticalCount,
      errorsCount,
      topLayer,
    };
  }, [logs, totalCount]);

  function handleCopy(text: string, fieldKey: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function handleSimulateError(layer: ExecutionLayer, severity: ErrorSeverity = "error") {
    setIsSimulating(true);
    setSimulatedStatus(`Simulating failure in ${layer}...`);

    try {
      const mockMessages: Record<ExecutionLayer, { code: string; msg: string; details: Record<string, unknown> }> = {
        ingestion: {
          code: "GMAIL_AUTH_TOKEN_EXPIRED",
          msg: "Gmail OAuth access token failed to refresh with Google authorization server (invalid_grant).",
          details: { provider: "gmail", scope: "gmail.readonly", responseStatus: 400 },
        },
        filtration: {
          code: "HEURISTIC_EVALUATION_TIMEOUT",
          msg: "MIME tree parsing timed out during deterministic bounce/daemon evaluation.",
          details: { mimeType: "multipart/report", sizeBytes: 204850 },
        },
        triage: {
          code: "AI_GEMINI_RATE_LIMIT_429",
          msg: "Google Generative AI API returned 429 Quota Exceeded (Resource exhausted for gemini-2.0-flash).",
          details: { model: "gemini-2.0-flash", retryAfterSeconds: 30, promptTokens: 640 },
        },
        summarization: {
          code: "SUMMARY_JSON_PARSE_ERROR",
          msg: "AI executive summarization output failed schema JSON parsing (unterminated string literal).",
          details: { rawOutputPreview: '{"summary_text": "Executive brief...', length: 120 },
        },
        delivery: {
          code: "META_24H_SESSION_EXPIRED",
          msg: "WhatsApp Cloud Function rejected message dispatch: 24-hour customer messaging window is closed.",
          details: { recipientPhone: "+919772777565", metaErrorCode: 131047, templateFallbackAvailable: true },
        },
        system: {
          code: "WATCH_RENEWAL_CRON_FAILED",
          msg: "Google Cloud Pub/Sub topic subscription renewal returned 404 (Topic not found).",
          details: { topic: "projects/strike-prod/topics/gmail-push", durationMs: 145 },
        },
      };

      const mock = mockMessages[layer];

      const res = await fetch("/api/error-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layer,
          severity,
          errorCode: mock.code,
          errorMessage: mock.msg,
          technicalDetails: mock.details,
          context: { source: "Developer Simulation", simulatedAt: new Date().toISOString() },
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setSimulatedStatus(`✓ Created test log in ${layer}`);
        await loadLogs(false);
      }
    } catch {
      setSimulatedStatus("Simulation failed");
    } finally {
      setIsSimulating(false);
      setTimeout(() => setSimulatedStatus(null), 3000);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className={ui.page}>
      {/* Header Row */}
      <div className="dashboard-title-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="eyebrow" style={{ color: "#ef4444", fontWeight: 700 }}>
              PLATFORM RELIABILITY & DEBUGGING
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "999px",
                background: totalCount > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(34, 197, 94, 0.12)",
                color: totalCount > 0 ? "#ef4444" : "#16a34a",
              }}
            >
              {totalCount > 0 ? `${totalCount} Tracked Event${totalCount !== 1 ? "s" : ""}` : "All Layers Clean"}
            </span>
          </div>
          <h1>Layer Error Logs</h1>
          <p className="dashboard-subtitle">
            Centralized failure tracking and telemetry partitioned across Strike execution layers.
          </p>
        </div>

        <div className="dashboard-toolbar" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Refresh button */}
          <button
            className="secondary-button"
            disabled={isRefreshing}
            onClick={() => loadLogs(false)}
            type="button"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "38px" }}
          >
            <RefreshCw size={15} className={isRefreshing ? "spin-icon" : ""} />
            <span>{isRefreshing ? "Refreshing…" : "Refresh"}</span>
          </button>

          {/* Test Error Simulator Dropdown */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              className="primary-button"
              disabled={isSimulating}
              onClick={() => handleSimulateError("delivery", "error")}
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "38px",
                background: "#000000",
                color: "#ffffff",
              }}
              title="Click to generate a test error log in the Delivery layer"
            >
              <Bug size={15} />
              <span>{simulatedStatus || (isSimulating ? "Simulating…" : "Test Layer Log")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div className="panel" style={{ padding: "14px 16px", margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>TOTAL LOGGED EVENTS</span>
            <AlertCircle size={16} style={{ color: "var(--brand-plum)" }} />
          </div>
          <div style={{ fontSize: "20px", fontWeight: 750, color: "var(--ink)" }}>{totalCount}</div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
            Across all 6 execution layers
          </div>
        </div>

        <div className="panel" style={{ padding: "14px 16px", margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444" }}>CRITICAL FAILURES</span>
            <Flame size={16} style={{ color: "#ef4444" }} />
          </div>
          <div style={{ fontSize: "20px", fontWeight: 750, color: "#ef4444" }}>{stats.criticalCount}</div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
            Exceeded maximum retry threshold
          </div>
        </div>

        <div className="panel" style={{ padding: "14px 16px", margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#d97706" }}>STANDARD ERRORS</span>
            <AlertTriangle size={16} style={{ color: "#d97706" }} />
          </div>
          <div style={{ fontSize: "20px", fontWeight: 750, color: "#d97706" }}>{stats.errorsCount}</div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
            Handled with backoff or fallback
          </div>
        </div>

        <div className="panel" style={{ padding: "14px 16px", margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>MOST ACTIVE LAYER</span>
            <Layers size={16} style={{ color: "var(--brand-plum)" }} />
          </div>
          <div style={{ fontSize: "15px", fontWeight: 750, color: "var(--ink)" }}>{stats.topLayer}</div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
            Dominant source of failure events
          </div>
        </div>
      </div>

      {/* Layer Navigation Tabs */}
      <div className="panel" style={{ padding: "12px 16px", marginBottom: "16px", margin: "0 0 16px 0" }}>
        <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Filter by Execution Layer
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setSelectedLayer("all");
              setCurrentPage(1);
            }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: 650,
              border: selectedLayer === "all" ? "1.5px solid var(--brand-plum)" : "1px solid var(--line)",
              background: selectedLayer === "all" ? "var(--surface-pill)" : "var(--surface)",
              color: selectedLayer === "all" ? "var(--brand-plum)" : "var(--muted)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Layers size={14} />
            <span>All Layers</span>
          </button>

          {(Object.keys(LAYER_CONFIG) as ExecutionLayer[]).map((layerKey) => {
            const config = LAYER_CONFIG[layerKey];
            const Icon = config.icon;
            const isSelected = selectedLayer === layerKey;

            return (
              <button
                key={layerKey}
                type="button"
                onClick={() => {
                  setSelectedLayer(layerKey);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: 650,
                  border: isSelected ? `1.5px solid ${config.color}` : "1px solid var(--line)",
                  background: isSelected ? config.bg : "var(--surface)",
                  color: isSelected ? config.color : "var(--muted)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Icon size={14} />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table & Filter Controls Panel */}
      <div className="panel messages-table-panel">
        {/* Controls Bar */}
        <div
          style={{
            padding: "12px 20px",
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {/* Search Box */}
          <div className="search-input-wrapper" style={{ minWidth: "240px", flex: 1 }}>
            <Search size={15} />
            <input
              className="search-input"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search error codes, messages, stack traces…"
              type="text"
              value={search}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Severity Filter */}
          <select
            aria-label="Filter by Severity"
            className="pagination-select"
            onChange={(e) => {
              setSelectedSeverity(e.target.value as ErrorSeverity | "all");
              setCurrentPage(1);
            }}
            value={selectedSeverity}
            style={{ height: "36px", padding: "0 10px", borderRadius: "8px", fontSize: "12.5px" }}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          {/* Time Range Filter */}
          <select
            aria-label="Filter by Time Range"
            className="pagination-select"
            onChange={(e) => {
              setTimeRange(e.target.value as TimeRange);
              setCurrentPage(1);
            }}
            value={timeRange}
            style={{ height: "36px", padding: "0 10px", borderRadius: "8px", fontSize: "12.5px" }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="24h">Past 24 Hours</option>
            <option value="7d">Past 7 Days</option>
            <option value="30d">Past 30 Days</option>
          </select>

          {/* Sorting */}
          <select
            aria-label="Sort Order"
            className="pagination-select"
            onChange={(e) => {
              setSortOrder(e.target.value as SortOption);
              setCurrentPage(1);
            }}
            value={sortOrder}
            style={{ height: "36px", padding: "0 10px", borderRadius: "8px", fontSize: "12.5px" }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <Loader2 size={26} className="spin-icon" style={{ color: "var(--brand-plum)" }} />
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>Loading layer telemetry records…</span>
          </div>
        ) : logs.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="messages-desktop-table-container">
              <table className="messages-table">
                <thead>
                  <tr>
                    <th>Execution Layer</th>
                    <th>Severity</th>
                    <th>Error Code & Description</th>
                    <th>Context</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const layerCfg = LAYER_CONFIG[log.layer] || LAYER_CONFIG.system;
                    const LayerIcon = layerCfg.icon;

                    return (
                      <tr
                        key={log.id}
                        className="message-table-row clickable-row"
                        onClick={() => setSelectedLog(log)}
                        title="Click to inspect raw stack trace, parameters, and debug details"
                      >
                        {/* Layer Badge */}
                        <td>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 650,
                              padding: "4px 9px",
                              borderRadius: "7px",
                              background: layerCfg.bg,
                              color: layerCfg.color,
                              border: `1px solid ${layerCfg.color}30`,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <LayerIcon size={12} />
                            <span>{layerCfg.label}</span>
                          </span>
                        </td>

                        {/* Severity */}
                        <td>
                          <span
                            className={`status-badge ${
                              log.severity === "critical"
                                ? "badge-error"
                                : log.severity === "error"
                                ? "badge-error"
                                : log.severity === "warning"
                                ? "badge-waiting"
                                : "badge-processing"
                            }`}
                            style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                          >
                            {log.severity.toUpperCase()}
                          </span>
                        </td>

                        {/* Error Code & Message */}
                        <td style={{ maxWidth: "340px" }}>
                          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono, monospace)",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "var(--ink)",
                              }}
                            >
                              {log.error_code}
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                marginTop: "1px",
                              }}
                            >
                              {log.error_message}
                            </span>
                          </div>
                        </td>

                        {/* Context Tag */}
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
                              fontFamily: "var(--font-mono, monospace)",
                            }}
                          >
                            {log.context?.message_id
                              ? `msg: ${String(log.context.message_id).slice(0, 8)}…`
                              : log.context?.job_id
                              ? `job: ${String(log.context.job_id).slice(0, 8)}…`
                              : log.user_id
                              ? `usr: ${log.user_id.slice(0, 8)}…`
                              : "system"}
                          </span>
                        </td>

                        {/* Occurred At */}
                        <td className="msg-date-cell">
                          {log.occurred_at
                            ? new Date(log.occurred_at).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
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
              {logs.map((log) => {
                const layerCfg = LAYER_CONFIG[log.layer] || LAYER_CONFIG.system;
                const LayerIcon = layerCfg.icon;

                return (
                  <div
                    key={log.id}
                    className="messages-mobile-card clickable-row"
                    onClick={() => setSelectedLog(log)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="mobile-card-header">
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 650,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: layerCfg.bg,
                          color: layerCfg.color,
                          border: `1px solid ${layerCfg.color}30`,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <LayerIcon size={12} />
                        <span>{layerCfg.label}</span>
                      </span>

                      <span className="mobile-card-date">
                        {log.occurred_at
                          ? new Date(log.occurred_at).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", margin: "6px 0 3px 0", fontFamily: "var(--font-mono, monospace)" }}>
                      {log.error_code}
                    </div>

                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 8px 0", lineHeight: 1.4 }}>
                      {log.error_message}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        className={`status-badge ${
                          log.severity === "critical"
                            ? "badge-error"
                            : log.severity === "error"
                            ? "badge-error"
                            : "badge-waiting"
                        }`}
                        style={{ fontSize: "0.68rem" }}
                      >
                        {log.severity.toUpperCase()}
                      </span>

                      <span style={{ fontSize: "11.5px", color: "var(--brand-plum)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        Inspect Details <ExternalLink size={11} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="messages-pagination-bar">
              <div className="pagination-info">
                Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>–
                <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> of{" "}
                <strong>{totalCount}</strong> error logs
              </div>

              <div className="pagination-controls">
                <div className="pagination-size-wrapper">
                  <span className="pagination-size-label">Per page:</span>
                  <select
                    aria-label="Error logs per page"
                    className="pagination-select"
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    value={pageSize}
                  >
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="pagination-buttons">
                  <button
                    aria-label="Previous page"
                    className="pagination-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    type="button"
                  >
                    <ChevronLeft size={15} />
                    <span>Prev</span>
                  </button>
                  <span className="pagination-page-indicator">
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>
                  <button
                    aria-label="Next page"
                    className="pagination-btn"
                    disabled={currentPage >= totalPages}
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
          <div className="panel empty-state-panel" style={{ border: "none", padding: "60px 20px" }}>
            <div className="empty-state">
              <ShieldCheck size={48} strokeWidth={1} style={{ color: "#16a34a" }} />
              <h3>No errors recorded</h3>
              <p>
                {selectedLayer !== "all"
                  ? `No errors detected in ${LAYER_TITLES[selectedLayer]}.`
                  : "All pipeline stages and layers are currently operating normally."}
              </p>
              <button
                className="secondary-button"
                onClick={() => handleSimulateError("delivery", "error")}
                type="button"
                style={{ marginTop: "12px" }}
              >
                <Bug size={14} />
                <span>Simulate Test Failure</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Interactive Detail Inspection Drawer ─── */}
      {selectedLog && (
        <div
          className="drawer-overlay"
          onClick={() => setSelectedLog(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(3px)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            className="drawer-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "600px",
              background: "var(--surface)",
              height: "100%",
              overflowY: "auto",
              boxShadow: "-8px 0 24px rgba(0, 0, 0, 0.15)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      background: LAYER_CONFIG[selectedLog.layer]?.bg,
                      color: LAYER_CONFIG[selectedLog.layer]?.color,
                    }}
                  >
                    {LAYER_TITLES[selectedLog.layer]}
                  </span>
                  <span
                    className={`status-badge ${
                      selectedLog.severity === "critical"
                        ? "badge-error"
                        : selectedLog.severity === "error"
                        ? "badge-error"
                        : "badge-waiting"
                    }`}
                    style={{ fontSize: "0.7rem" }}
                  >
                    {selectedLog.severity.toUpperCase()}
                  </span>
                </div>
                <h2 style={{ fontSize: "16px", fontWeight: 750, color: "var(--ink)", margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
                  {selectedLog.error_code}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{
                  background: "var(--surface-muted)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "6px",
                  cursor: "pointer",
                  color: "var(--muted)",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
              {/* Message Banner */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "var(--ink)",
                  fontSize: "13.5px",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, color: "#ef4444", marginBottom: "4px" }}>Error Description:</div>
                {selectedLog.error_message}
              </div>

              {/* Event Metadata Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  padding: "14px",
                  borderRadius: "10px",
                  background: "var(--surface-muted)",
                  border: "1px solid var(--line)",
                  fontSize: "12.5px",
                }}
              >
                <div>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: "11px", fontWeight: 600 }}>
                    TIMESTAMP
                  </span>
                  <strong style={{ color: "var(--ink)" }}>
                    {new Date(selectedLog.occurred_at).toLocaleString()}
                  </strong>
                </div>

                <div>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: "11px", fontWeight: 600 }}>
                    LOG ID
                  </span>
                  <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--ink)" }}>
                    {selectedLog.id.slice(0, 12)}…
                  </span>
                </div>

                {Boolean(selectedLog.context?.message_id) && (
                  <div style={{ gridColumn: "span 2" }}>
                    <span style={{ color: "var(--muted)", display: "block", fontSize: "11px", fontWeight: 600 }}>
                      ASSOCIATED EMAIL MESSAGE ID
                    </span>
                    <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--ink)" }}>
                      {String(selectedLog.context.message_id)}
                    </span>
                  </div>
                )}
              </div>

              {/* Technical Details JSON */}
              {selectedLog.technical_details && Object.keys(selectedLog.technical_details).length > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                      Technical Details & API Response
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(JSON.stringify(selectedLog.technical_details, null, 2), "details")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "11.5px",
                        color: "var(--brand-plum)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 600,
                      }}
                    >
                      {copiedField === "details" ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === "details" ? "Copied" : "Copy JSON"}</span>
                    </button>
                  </div>
                  <pre
                    style={{
                      background: "#0f172a",
                      color: "#f8fafc",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontFamily: "var(--font-mono, monospace)",
                      overflowX: "auto",
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(selectedLog.technical_details, null, 2)}
                  </pre>
                </div>
              )}

              {/* Full Stack Trace */}
              {selectedLog.stack_trace && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                      Execution Stack Trace
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedLog.stack_trace || "", "stack")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "11.5px",
                        color: "var(--brand-plum)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 600,
                      }}
                    >
                      {copiedField === "stack" ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === "stack" ? "Copied" : "Copy Stack"}</span>
                    </button>
                  </div>
                  <pre
                    style={{
                      background: "#0f172a",
                      color: "#fca5a5",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      fontSize: "11.5px",
                      fontFamily: "var(--font-mono, monospace)",
                      overflowX: "auto",
                      maxHeight: "240px",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {selectedLog.stack_trace}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
