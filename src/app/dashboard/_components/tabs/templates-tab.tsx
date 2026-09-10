"use client";

import ui from "./modern-tabs.module.css";

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

  const [inspectorView, setInspectorView] = useState<"instructions" | "schema" | "both">("both");
  const [copyStatus, setCopyStatus] = useState("");
  const [previewName, setPreviewName] = useState("Alex");
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

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(inspectorView === "instructions" ? current.promptText : inspectorView === "schema" ? current.outputSchema : `${current.promptText}\n\n${current.outputSchema}`);
      setCopyStatus("Copied to clipboard");
    } catch { setCopyStatus("Could not copy. Select the text below to copy it manually."); }
  }

  const templateNavigation = [
    { key: "triage", label: "Email triage", note: "Classification & scoring", icon: Sparkles },
    { key: "summary", label: "Executive summary", note: "Briefs & action items", icon: FileText },
    { key: "heuristic", label: "Rule engine", note: "Deterministic fallback", icon: Zap },
    { key: "whatsapp_greetings", label: "WhatsApp greetings", note: "Morning briefing template", icon: MessageSquare },
  ] as const;

  return (
    <div className={ui.page}>
      <div className="dashboard-title-row"><div><p className="eyebrow">INTELLIGENCE ENGINE</p><h1>Behind every brief.</h1><p className="dashboard-subtitle">Explore the prompts, rules, and message templates that shape your inbox.</p></div><span className={ui.tag}><Code2 size={14} /> Template library</span></div>
      <div className={ui.inspectorLayout}>
        <nav className={ui.templateNav} aria-label="Choose a template">
          <p className={ui.overline}>THE COLLECTION / 04</p>
          {templateNavigation.map((item) => <button type="button" key={item.key} aria-pressed={activeTemplate === item.key} aria-controls="template-inspector" onClick={() => { setActiveTemplate(item.key); setCopyStatus(""); }}><item.icon size={19} /><span><strong>{item.label}</strong><small>{item.note}</small></span><span className={ui.navArrow}>↗</span></button>)}
          <div className={ui.inspectorNote}><Shield size={19} /><p>Understand the instructions behind every classification. Inspect or copy a template to take a closer look.</p></div>
        </nav>
        <section className={ui.inspector} id="template-inspector" aria-label={current.title}>
          <header className={ui.inspectorHeader}><div><span className={ui.overline}>{current.version}</span><h2>{current.title}</h2><p>{current.description}</p></div><Code2 size={25} /></header>
          <div className={ui.inspectorToolbar}>
            <div className={ui.segmented} aria-label="Template content">
              {([ ["instructions", "Instructions"], ["schema", "Output schema"], ["both", "Both"] ] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={inspectorView === value} onClick={() => { setInspectorView(value); setCopyStatus(""); }}>{label}</button>)}
            </div>
            <button className={ui.quietButton} type="button" onClick={copyTemplate}>{copyStatus === "Copied to clipboard" ? <CheckCircle2 size={14} /> : <FileText size={14} />} Copy {inspectorView === "both" ? "template" : inspectorView}</button>
          </div>
          <span className={ui.copyStatus} role="status">{copyStatus}</span>
          <div className={ui.codeSections}>
            {inspectorView !== "schema" && <section><h3><Code2 size={14} /> System instructions</h3><pre tabIndex={0}>{current.promptText}</pre></section>}
            {inspectorView !== "instructions" && <section><h3><Tag size={14} /> Output schema</h3><pre tabIndex={0}>{current.outputSchema}</pre></section>}
          </div>
          {activeTemplate === "whatsapp_greetings" && <div className={ui.templatePreview}><div><span className={ui.overline}>PERSONALIZE THE PREVIEW</span><label>Display name<input value={previewName} maxLength={60} onChange={(event) => setPreviewName(event.target.value)} placeholder="Your name" /></label><small>Illustrative preview · no message is sent</small></div><pre>{current.promptText.replaceAll("{{1}}", previewName || "Your name")}</pre></div>}
        </section>
      </div>
    </div>
  );
}
