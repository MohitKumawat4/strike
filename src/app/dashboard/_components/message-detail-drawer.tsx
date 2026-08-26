"use client";

import { useEffect, useState } from "react";
import {
  X,
  Mail,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Calendar,
  FileText,
  Code,
  Tag,
  ArrowUpRight,
} from "lucide-react";

import type { ConnectedAccount, EmailMessage } from "./dashboard-shell";

type MessageDetailDrawerProps = {
  message: EmailMessage | null;
  accounts: ConnectedAccount[];
  onClose: () => void;
};

export function MessageDetailDrawer({
  message,
  accounts,
  onClose,
}: MessageDetailDrawerProps) {
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!message) return null;

  const connectedAccount = accounts.find((a) => a.id === message.account_id);
  const senderDisplay = message.sender?.raw || "Unknown Sender";
  const receivedFormatted = message.received_at
    ? new Date(message.received_at).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Unknown Date";

  const importanceScore = typeof message.ai_importance === "number"
    ? Math.round(message.ai_importance * 100)
    : null;

  const category = message.ai_category || "uncategorized";

  return (
    <div className="drawer-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-left">
            <span className="drawer-eyebrow">MESSAGE INTELLIGENCE</span>
            <h2>{message.subject || "(No Subject)"}</h2>
          </div>
          <button
            aria-label="Close drawer"
            className="icon-button drawer-close-btn"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="drawer-body">
          {/* Metadata Row */}
          <div className="drawer-meta-card">
            <div className="drawer-meta-item">
              <User size={15} className="drawer-meta-icon" />
              <div>
                <strong>From</strong>
                <span>{senderDisplay}</span>
              </div>
            </div>

            <div className="drawer-meta-item">
              <Calendar size={15} className="drawer-meta-icon" />
              <div>
                <strong>Date Received</strong>
                <span>{receivedFormatted}</span>
              </div>
            </div>

            {connectedAccount && (
              <div className="drawer-meta-item">
                <Mail size={15} className="drawer-meta-icon" />
                <div>
                  <strong>Mailbox</strong>
                  <span>{connectedAccount.email_address}</span>
                </div>
              </div>
            )}
          </div>

          {/* AI Intelligence Card */}
          <div className="drawer-ai-card">
            <div className="drawer-card-header">
              <div className="drawer-card-title">
                <Sparkles size={16} className="sparkle-icon" />
                <h3>AI Triage & Classification</h3>
              </div>
              <span
                className={`status-badge ${
                  category === "important"
                    ? "badge-success"
                    : category === "promotional"
                    ? "badge-waiting"
                    : category === "spam"
                    ? "badge-error"
                    : "badge-processing"
                }`}
              >
                {category}
              </span>
            </div>

            {/* Importance Gauge */}
            {importanceScore !== null && (
              <div className="drawer-gauge-row">
                <div className="gauge-label-group">
                  <span>Importance Score</span>
                  <strong>{importanceScore}%</strong>
                </div>
                <div className="drawer-gauge-track">
                  <div
                    className={`drawer-gauge-fill ${
                      importanceScore >= 70
                        ? "gauge-high"
                        : importanceScore >= 40
                        ? "gauge-medium"
                        : "gauge-low"
                    }`}
                    style={{ width: `${importanceScore}%` }}
                  />
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            {message.ai_reason && (
              <div className="drawer-reason-box">
                <p>
                  <strong>Why:</strong> {message.ai_reason}
                </p>
              </div>
            )}
          </div>

          {/* AI Executive Summary Card */}
          {message.summary && (
            <div className="drawer-summary-card">
              <div className="drawer-card-header">
                <div className="drawer-card-title">
                  <FileText size={16} />
                  <h3>Executive Summary</h3>
                </div>
              </div>
              <p className="drawer-summary-text">{message.summary.summary_text}</p>

              {/* Extracted Action Items */}
              {Array.isArray(message.summary.extracted_items) &&
                message.summary.extracted_items.length > 0 && (
                  <div className="drawer-actions-list">
                    <h4>Action Items</h4>
                    <ul>
                      {message.summary.extracted_items.map((item, idx) => (
                        <li key={idx} className="drawer-action-item">
                          <CheckCircle2 size={15} className="action-check-icon" />
                          <div className="action-item-content">
                            <strong>{item.action}</strong>
                            {item.deadline && item.deadline !== "None" && (
                              <small>Due: {item.deadline}</small>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {/* Email Body Content */}
          <div className="drawer-content-section">
            <div className="drawer-content-tabs">
              <button
                className={`drawer-tab-btn ${viewMode === "formatted" ? "active" : ""}`}
                onClick={() => setViewMode("formatted")}
                type="button"
              >
                <FileText size={14} />
                <span>Clean View</span>
              </button>
              <button
                className={`drawer-tab-btn ${viewMode === "raw" ? "active" : ""}`}
                onClick={() => setViewMode("raw")}
                type="button"
              >
                <Code size={14} />
                <span>Snippet / Raw</span>
              </button>
            </div>

            <div className="drawer-email-body">
              {viewMode === "formatted" ? (
                <div className="email-body-text">
                  {message.body_text || message.snippet || "(No content available)"}
                </div>
              ) : (
                <pre className="email-body-raw">
                  {JSON.stringify(
                    {
                      subject: message.subject,
                      sender: message.sender,
                      snippet: message.snippet,
                      received_at: message.received_at,
                      processing_status: message.processing_status,
                      ai_category: message.ai_category,
                      ai_importance: message.ai_importance,
                      ai_reason: message.ai_reason,
                    },
                    null,
                    2
                  )}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
