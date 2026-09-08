"use client";

import { useState } from "react";
import {
  FileText,
  Sparkles,
  Shield,
  Tag,
  CheckCircle2,
  Code2,
  Zap,
  MessageSquare,
} from "lucide-react";

/**
 * Interactive AI Templates & Prompt Inspector
 * Gives full visibility into the AI prompts and categorization rules used by Strike.
 */
export function TemplatesTab() {
  const [activeTemplate, setActiveTemplate] = useState<"triage" | "summary" | "heuristic" | "whatsapp_greetings">("triage");

  const templates = {
    triage: {
      title: "Email Triage & Scoring Prompt",
      version: "2026.08.v1",
      description: "Classifies incoming emails into 4 categories with an importance rating (0.00 - 1.00) and reasoning.",
      outputSchema: `{
  "category": "important" | "normal" | "promotional" | "spam",
  "importance": number, // 0.00 to 1.00
  "confidence": number, // 0.00 to 1.00
  "reason": string      // Concise justification
}`,
      promptText: `You are Strike AI, an elite email triage assistant.
Your task is to analyze incoming emails and classify them with high precision into one of four categories:
1. "important" — Time-sensitive, urgent requests, invoices, payments, client contracts, critical system alerts, schedule invites, or communications requiring swift action.
2. "normal" — General professional correspondence, personal discussions, standard non-urgent replies.
3. "promotional" — Marketing newsletters, product discounts, coupons, company announcements, promotional digests.
4. "spam" — Unsolicited bulk marketing, scam attempts, phishing, unwanted junk.

Output valid JSON matching the schema with explicit reasoning.`,
    },
    summary: {
      title: "Executive Summarization & Action Items",
      version: "v1.0.0",
      description: "Generates high-level summaries and extracts structured action items with assignees and deadlines.",
      outputSchema: `{
  "summary_text": "2-3 sentence executive synopsis",
  "extracted_items": [
    {
      "action": "Specific task required",
      "deadline": "Deadline date or 'None'",
      "assignee": "Person responsible or 'You'"
    }
  ]
}`,
      promptText: `You are Strike's Executive Email Summarizer.
Your goal is to extract the core essence and any actionable to-dos from this email thread.

Analyze the sender, subject, and full message content.
Extract:
1. A crisp 2-3 sentence executive summary explaining what this email is about and what is needed.
2. An array of concrete action items with explicit deadlines and assignees.`,
    },
    heuristic: {
      title: "Deterministic Rule Engine (Fallback)",
      version: "Heuristic v2.0",
      description: "Instant rule-based triage matching urgent keywords, billing triggers, newsletters, and spam signals.",
      outputSchema: `Heuristic Rule Matrix:
• Important: matches (urgent, action required, invoice, payment, billing, security alert, contract, deadline, interview, meeting scheduled)
• Promotional: matches (unsubscribe, newsletter, discount, sale, promo, % off, deals, digest)
• Spam: matches (winner, lottery, crypto gift, claim prize)
• Normal: default baseline`,
      promptText: `Pre-filtering and deterministic keyword classifier executing in <1ms without network latency:
- Automatically filters mailer-daemons and no-reply automated noise
- Routes urgent invoices and contracts to immediate high importance
- Flags promotional newsletters for digest categorization`,
    },
    whatsapp_greetings: {
      title: "WhatsApp 24-Hour Re-activation & Morning Briefing",
      version: "strike_daily_greetings_v1 (Utility)",
      description: "Meta Utility Template with quick-reply buttons that re-establishes the 24-hour messaging window upon button tap.",
      outputSchema: `Meta Cloud API Template Spec:
• Name: strike_daily_greetings_v1
• Category: UTILITY
• Language: en_US
• Quick-Reply Buttons:
  1. "Ready for Briefing" (Payload: START_DAY)
  2. "View Inbox" (Payload: VIEW_INBOX)
• Variables: {{1}} = User Display Name`,
      promptText: `Header: Strike Daily Intelligence

Body:
Good morning {{1}}! ☀️ Strike has triaged your inbox and prepared your priority email briefing. Tap below to start your briefing.

Footer: Strike AI • Instant Inbox Intelligence

Buttons:
👉 [Ready for Briefing]  👉 [View Inbox]`,
    },
  };

  const current = templates[activeTemplate];

  return (
    <>
      {/* Header */}
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">INTELLIGENCE ENGINE</p>
          <h1>AI Prompt & Message Templates</h1>
          <p className="dashboard-subtitle">
            Inspect active AI intelligence prompts and Meta WhatsApp message templates.
          </p>
        </div>
      </div>

      {/* Template Selectors */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        <article
          className={`panel ${activeTemplate === "triage" ? "account-card-expanded" : ""}`}
          onClick={() => setActiveTemplate("triage")}
          style={{ cursor: "pointer", padding: 18 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div className="account-card-icon" style={{ background: "var(--brand-plum)", color: "var(--brand-plum-text)" }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Triage & Scoring</h3>
              <small className="muted-text">Category & Urgency</small>
            </div>
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>
            4-tier categorization model assigning importance from 0.00 to 1.00.
          </p>
        </article>

        <article
          className={`panel ${activeTemplate === "summary" ? "account-card-expanded" : ""}`}
          onClick={() => setActiveTemplate("summary")}
          style={{ cursor: "pointer", padding: 18 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div className="account-card-icon" style={{ background: "var(--brand-plum)", color: "var(--brand-plum-text)" }}>
              <FileText size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Executive Summary</h3>
              <small className="muted-text">Summaries & Action Items</small>
            </div>
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>
            Extracts executive digests and structured to-do items.
          </p>
        </article>

        <article
          className={`panel ${activeTemplate === "heuristic" ? "account-card-expanded" : ""}`}
          onClick={() => setActiveTemplate("heuristic")}
          style={{ cursor: "pointer", padding: 18 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div className="account-card-icon" style={{ background: "var(--brand-plum)", color: "var(--brand-plum-text)" }}>
              <Zap size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Rule Engine</h3>
              <small className="muted-text">Instant Fallback Rules</small>
            </div>
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>
            Zero-latency deterministic rule matching for keywords and noise.
          </p>
        </article>

        <article
          className={`panel ${activeTemplate === "whatsapp_greetings" ? "account-card-expanded" : ""}`}
          onClick={() => setActiveTemplate("whatsapp_greetings")}
          style={{ cursor: "pointer", padding: 18 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div className="account-card-icon" style={{ background: "var(--brand-plum)", color: "var(--brand-plum-text)" }}>
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.95rem" }}>WhatsApp Greetings</h3>
              <small className="muted-text">24h Window Activation</small>
            </div>
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>
            Daily morning brief with quick-reply buttons to unlock 24h streaming.
          </p>
        </article>
      </div>

      {/* Active Template Inspector Panel */}
      <div className="panel" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "1.15rem" }}>{current.title}</h2>
            <p className="muted-text" style={{ margin: 0, fontSize: "0.85rem" }}>
              {current.description}
            </p>
          </div>
          <span className="status-badge badge-success" style={{ fontSize: "0.75rem" }}>
            Active ({current.version})
          </span>
        </div>

        {/* Prompt Instructions */}
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
            <Code2 size={14} /> System Instructions
          </h4>
          <pre
            style={{
              padding: 16,
              background: "var(--surface-muted)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              fontSize: "0.8rem",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              color: "var(--ink)",
              margin: 0,
              fontFamily: "monospace",
            }}
          >
            {current.promptText}
          </pre>
        </div>

        {/* Expected JSON Schema */}
        <div>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
            <Tag size={14} /> Output JSON Schema
          </h4>
          <pre
            style={{
              padding: 16,
              background: "var(--surface-muted)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              fontSize: "0.8rem",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              color: "var(--brand-plum-text)",
              margin: 0,
              fontFamily: "monospace",
            }}
          >
            {current.outputSchema}
          </pre>
        </div>
      </div>
    </>
  );
}
