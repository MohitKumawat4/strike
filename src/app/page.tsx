"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CheckCheck,
  ChevronRight,
  ExternalLink,
  Flame,
  Filter,
  Inbox,
  Lock,
  Mail,
  Menu,
  MessageSquare,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  Zap,
  Activity,
  Layers,
  ArrowDown,
} from "lucide-react";

interface SampleEmail {
  id: string;
  sender: string;
  senderEmail: string;
  avatar: string;
  subject: string;
  snippet: string;
  category: "LEGAL & FINANCE" | "CRITICAL INFRA" | "OPERATIONS" | "NEWSLETTER / PROMO";
  urgencyScore: number;
  isUrgent: boolean;
  summary: string;
  actionItems: Array<{ action: string; deadline?: string }>;
  latency: string;
  status: "delivered" | "filtered";
}

const SAMPLE_EMAILS: SampleEmail[] = [
  {
    id: "email-1",
    sender: "Jennifer Sterling",
    senderEmail: "j.sterling@meridian-ventures.com",
    avatar: "JS",
    subject: "Revised Series A Term Sheet & Closing Signature Due",
    snippet:
      "Following up on our partner meeting yesterday, the investment committee has signed off on the revised allocations. We need your review of section 4.2 and all legal signatures by 10:00 AM tomorrow...",
    category: "LEGAL & FINANCE",
    urgencyScore: 0.96,
    isUrgent: true,
    summary:
      "Jennifer submitted updated Series A syndicate documentation with adjusted pro-rata terms. Signature is mandatory before board ratification tomorrow morning.",
    actionItems: [
      { action: "Review clause 4.2 board seat designation" },
      { action: "Sign final document via DocuSign", deadline: "Tomorrow 10:00 AM" },
    ],
    latency: "164ms",
    status: "delivered",
  },
  {
    id: "email-2",
    sender: "Stripe Automated Alerts",
    senderEmail: "notifications@stripe.com",
    avatar: "ST",
    subject: "⚠️ Action Required: Webhook signature mismatch in Production",
    snippet:
      "We detected 42 failed delivery attempts to your production webhook endpoint /api/webhooks/stripe over the last 15 minutes. Signature verification returned 401 Unauthorized...",
    category: "CRITICAL INFRA",
    urgencyScore: 0.91,
    isUrgent: true,
    summary:
      "Production webhook endpoint is returning 401 Unauthorized for payment events. Live billing events are currently buffered and require signing secret rotation.",
    actionItems: [
      { action: "Verify STRIPE_WEBHOOK_SECRET in environment variables" },
      { action: "Check server logs for secret mismatches", deadline: "Immediate" },
    ],
    latency: "142ms",
    status: "delivered",
  },
  {
    id: "email-3",
    sender: "Marcus Vance (COO)",
    senderEmail: "marcus@company.internal",
    avatar: "MV",
    subject: "Q4 Budget Planning & Leadership Offsite Dates",
    snippet:
      "Hey team, attaching the preliminary budget model for next quarter. Please review the headcount estimates and vote on the two proposed offsite dates by Friday afternoon...",
    category: "OPERATIONS",
    urgencyScore: 0.74,
    isUrgent: false,
    summary:
      "Marcus shared preliminary Q4 headcount budgets and requested team feedback on leadership offsite dates.",
    actionItems: [
      { action: "Review headcount allocations tab" },
      { action: "Submit vote for offsite location", deadline: "Friday 5:00 PM" },
    ],
    latency: "188ms",
    status: "delivered",
  },
  {
    id: "email-4",
    sender: "Cloud SaaS Weekly",
    senderEmail: "digest@saasweekly.news",
    avatar: "CS",
    subject: "Top 10 Growth Hacks For B2B Founders in 2026",
    snippet:
      "Check out this week's curated roundup of B2B marketing strategies, customer retention benchmarks, and industry news from top founders...",
    category: "NEWSLETTER / PROMO",
    urgencyScore: 0.12,
    isUrgent: false,
    summary: "Standard marketing newsletter containing industry articles and growth tips.",
    actionItems: [],
    latency: "95ms",
    status: "filtered",
  },
];

export default function LandingPage() {
  const [selectedEmail, setSelectedEmail] = useState<SampleEmail>(SAMPLE_EMAILS[0]);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleQuickAction = (actionName: string) => {
    setActionFeedback(actionName);
    setTimeout(() => setActionFeedback(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] antialiased selection:bg-[var(--tint-rose-bg)] selection:text-[var(--brand-plum)]">
      {/* =========================================================================
          TOP NAVIGATION BAR (RESPONSIVE WITH MOBILE TRAY)
          ========================================================================= */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--canvas)]/90 border-b border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-[var(--brand-plum)] text-[#fffdf9] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Sparkles size={16} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg tracking-tight leading-none text-[var(--ink)]">
                strike
              </span>
              <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-widest text-[var(--eyebrow)] mt-0.5">
                Email Intelligence
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs sm:text-sm font-semibold text-[var(--muted)]">
            <a href="#simulator" className="hover:text-[var(--ink)] transition-colors">
              Live Simulator
            </a>
            <a href="#how-it-works" className="hover:text-[var(--ink)] transition-colors">
              How It Works
            </a>
            <a href="#security" className="hover:text-[var(--ink)] transition-colors">
              Security &amp; Privacy
            </a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)] px-3 py-1.5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              style={{ backgroundColor: "#000000", color: "#ffffff" }}
              className="h-10 px-5 rounded-full font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#1a1a1a] transition-transform hover:scale-102"
            >
              <span>Get Started</span>
              <ArrowRight size={14} className="text-white" />
            </Link>
          </div>

          {/* Mobile Menu Button & Quick CTA */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/signup"
              style={{ backgroundColor: "#000000", color: "#ffffff" }}
              className="h-9 px-3.5 rounded-full font-bold text-xs inline-flex items-center justify-center gap-1 shadow-xs"
            >
              <span>Start</span>
              <ArrowRight size={12} className="text-white" />
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-9 h-9 rounded-xl border border-[var(--line)] bg-[var(--surface)] flex items-center justify-center text-[var(--ink)]"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Navigation Tray */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-b border-[var(--line)] bg-[var(--canvas)]/98 backdrop-blur-lg px-4 py-4 space-y-3"
            >
              <div className="flex flex-col space-y-2 text-sm font-bold text-[var(--ink)]">
                <a
                  href="#simulator"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
                >
                  Live Simulator
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
                >
                  How It Works
                </a>
                <a
                  href="#security"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
                >
                  Security &amp; Privacy
                </a>
              </div>
              <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-3">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-1/2 py-2 text-center text-xs font-bold rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
                >
                  Sign In
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-1/2 py-2 text-center text-xs font-bold rounded-xl bg-[var(--brand-plum)] text-white"
                >
                  Dashboard
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* =========================================================================
          HERO SECTION (BALANCED CONTAINER WITH INTEGRATED 3D LIVE ARENA)
          ========================================================================= */}
      <section className="relative pt-10 pb-16 sm:pt-16 sm:pb-24 overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-radial from-[var(--tint-rose-bg)] to-transparent opacity-60 pointer-events-none blur-3xl -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Title & Subtitle */}
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--line)] shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--eyebrow)]">
                Real-Time Gmail Sync → WhatsApp Alerts
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--ink)] leading-[1.12]">
              Inbox intelligence delivered straight to{" "}
              <span className="relative inline-block text-[var(--brand-plum)] whitespace-nowrap">
                WhatsApp
                <svg
                  className="absolute left-0 -bottom-1.5 w-full h-2.5 text-[#935073] overflow-visible pointer-events-none"
                  viewBox="0 0 160 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 7C40 2.5 80 2.5 120 5.5C135 6.8 148 6 157 4"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              .
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-[var(--muted)] leading-relaxed font-normal max-w-2xl mx-auto">
              Strike ingests incoming emails in sub-seconds via Google Cloud Pub/Sub, synthesizes AI summaries &amp; urgent action items with Gemini, and delivers them right to your WhatsApp.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/signup"
                style={{ backgroundColor: "#000000", color: "#ffffff" }}
                className="h-12 px-7 rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 shadow-md hover:bg-[#1a1a1a] transition-all hover:scale-102"
              >
                <span>Connect Your Inbox</span>
                <ArrowRight size={16} className="text-white" />
              </Link>
              <Link
                href="/dashboard"
                style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--line)" }}
                className="h-12 px-6 rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 border shadow-xs hover:bg-[var(--surface-muted)] transition-colors"
              >
                <Smartphone size={16} className="text-[var(--brand-plum)]" />
                <span>Open Dashboard</span>
              </Link>
            </div>
          </div>

          {/* =========================================================================
              LIVE 3D INTERACTIVE SIMULATOR (ORGANIC DUAL-PANE DESIGN)
              ========================================================================= */}
          <div id="simulator" className="relative">
            {/* Top Interactive Banner Header */}
            <div className="flex flex-wrap items-center justify-between pb-3 mb-4 text-xs font-mono text-[var(--muted)] border-b border-[var(--line)]">
              <div className="flex items-center gap-2 font-bold text-[var(--ink)]">
                <Activity size={14} className="text-emerald-600" />
                <span>Live Triage Engine (Select an incoming email below)</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-[var(--eyebrow)]">
                <span>Google Pub/Sub Ingest: Active</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Pane: Interactive Gmail Inbox Stream */}
              <div className="lg:col-span-5 space-y-2.5">
                {SAMPLE_EMAILS.map((email) => {
                  const isSelected = selectedEmail.id === email.id;
                  return (
                    <div
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? "bg-[var(--surface)] border-[var(--brand-plum)] shadow-sm scale-[1.01]"
                          : "bg-[var(--surface)]/60 border-[var(--line)] hover:border-[var(--muted-light)] hover:bg-[var(--surface)]"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-3 bottom-3 w-1.5 bg-[var(--brand-plum)] rounded-r-full" />
                      )}

                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-extrabold ${
                              email.isUrgent
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {email.avatar}
                          </div>
                          <span className="text-xs font-bold text-[var(--ink)] truncate max-w-[170px]">
                            {email.sender}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            email.isUrgent
                              ? "bg-rose-500/15 text-rose-700"
                              : email.status === "filtered"
                              ? "bg-neutral-200 text-neutral-600"
                              : "bg-amber-500/15 text-amber-800"
                          }`}
                        >
                          {email.category}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-[var(--ink)] line-clamp-1 mb-1">
                        {email.subject}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] line-clamp-1">
                        {email.snippet}
                      </div>

                      <div className="mt-2 pt-2 border-t border-[var(--line)]/60 flex items-center justify-between text-[10px] font-mono text-[var(--muted)]">
                        <span>Urgency: {email.urgencyScore}</span>
                        <span className="text-emerald-700 font-bold">Latency: {email.latency}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Pane: 3D Floating WhatsApp Phone Device */}
              <div className="lg:col-span-7">
                <div className="bg-[#0b141a] rounded-3xl p-4 sm:p-6 text-white font-sans shadow-2xl border border-neutral-800 relative">
                  {/* WhatsApp Device Bar */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800 text-[11px] text-neutral-400 font-mono">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--brand-plum)] text-white flex items-center justify-center font-bold text-xs">
                        ⚡
                      </div>
                      <div>
                        <div className="font-bold text-xs text-neutral-100 flex items-center gap-1.5">
                          <span>Strike Alerts</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        </div>
                        <div className="text-[10px] text-neutral-400">WhatsApp Business Cloud API</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] text-emerald-400">
                        {selectedEmail.latency}
                      </span>
                      <span>11:42 AM</span>
                    </div>
                  </div>

                  {/* Feedback Toast */}
                  <AnimatePresence>
                    {actionFeedback && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mb-3 p-2.5 rounded-xl bg-emerald-600/90 text-white text-xs font-semibold flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCheck size={15} />
                          <span>Action executed: {actionFeedback}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-80">Synced with Gmail</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Message Bubble Content */}
                  {selectedEmail.status === "filtered" ? (
                    <div className="p-8 text-center space-y-3 bg-[#182229] rounded-2xl border border-neutral-800">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
                        <Filter size={18} />
                      </div>
                      <h4 className="text-sm font-bold text-neutral-200">
                        Filtered Out (Zero Noise Mode)
                      </h4>
                      <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                        Classified as promotional newsletter with urgency score {selectedEmail.urgencyScore}. Strike skipped dispatching a WhatsApp alert to keep your notifications quiet.
                      </p>
                    </div>
                  ) : (
                    <motion.div
                      key={selectedEmail.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#1f2c34] rounded-2xl p-4 border border-neutral-700/60 max-w-xl ml-auto space-y-3 shadow-lg"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                            selectedEmail.isUrgent
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {selectedEmail.isUrgent ? <Flame size={11} /> : <Zap size={11} />}
                          {selectedEmail.isUrgent ? "URGENT EMAIL" : "IMPORTANT EMAIL"}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          Score: {selectedEmail.urgencyScore}
                        </span>
                      </div>

                      <div className="text-xs text-neutral-300 space-y-0.5 font-mono">
                        <p>
                          <strong className="text-white font-sans">From:</strong> {selectedEmail.sender} &lt;{selectedEmail.senderEmail}&gt;
                        </p>
                        <p>
                          <strong className="text-white font-sans">Subject:</strong> {selectedEmail.subject}
                        </p>
                        <p>
                          <strong className="text-white font-sans">Category:</strong> {selectedEmail.category}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-neutral-700/60">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-0.5 flex items-center gap-1.5">
                          <Bot size={11} />
                          <span>AI Executive Summary</span>
                        </div>
                        <p className="text-xs text-neutral-200 leading-relaxed font-sans">
                          {selectedEmail.summary}
                        </p>
                      </div>

                      {selectedEmail.actionItems.length > 0 && (
                        <div className="pt-2 border-t border-neutral-700/60">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-0.5 flex items-center gap-1.5">
                            <CheckCircle2 size={11} />
                            <span>Action Items</span>
                          </div>
                          <ul className="text-xs text-neutral-200 space-y-0.5 font-sans">
                            {selectedEmail.actionItems.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-amber-400">•</span>
                                <span>
                                  {item.action}{" "}
                                  {item.deadline && (
                                    <em className="text-amber-300 font-medium">({item.deadline})</em>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Clickable Interactive WhatsApp Buttons */}
                      <div className="pt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuickAction("Marked Read in Gmail ✓")}
                          className="w-full py-1.5 px-3 rounded-lg bg-[#2a3942] hover:bg-[#344652] active:scale-95 text-xs font-bold text-neutral-100 transition-all border border-neutral-600 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Check size={12} />
                          <span>Mark Read</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAction("Launched Thread in Strike ⚡")}
                          className="w-full py-1.5 px-3 rounded-lg bg-[var(--brand-plum)] hover:bg-[#683b6f] active:scale-95 text-xs font-bold text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Open in Strike</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="mt-3 pt-2.5 border-t border-neutral-800 text-center text-[10px] text-neutral-400 flex items-center justify-center gap-1.5">
                    <Sparkles size={12} className="text-amber-400" />
                    <span>Click the WhatsApp buttons above to test live interactive triggers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          HOW IT WORKS (HORIZONTAL FLOW TIMELINE - NO REPETITIVE CARDS)
          ========================================================================= */}
      <section id="how-it-works" className="py-16 sm:py-20 border-t border-[var(--line)] bg-[var(--canvas)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <div className="eyebrow">Setup in Under 2 Minutes</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
              From inbox clutter to clarity
            </h2>
            <p className="text-xs sm:text-base text-[var(--muted)] leading-relaxed">
              Strike works seamlessly in the background without requiring desktop apps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[var(--brand-plum)] text-white flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="text-base font-bold text-[var(--ink)]">Connect Gmail Account</h3>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed pl-11">
                Authorize read-only mailbox sync via Google OAuth 2.0 with limited-use compliance in 1 click.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[var(--brand-plum)] text-white flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="text-base font-bold text-[var(--ink)]">Set WhatsApp Number</h3>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed pl-11">
                Enter your phone number in Settings and receive an instant live test alert via Meta Cloud API.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[var(--brand-plum)] text-white flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h3 className="text-base font-bold text-[var(--ink)]">Get Actionable Alerts</h3>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed pl-11">
                Receive prioritized summaries and action deadlines on WhatsApp while Strike filters out the noise.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECURITY & GOOGLE COMPLIANCE SECTION
          ========================================================================= */}
      <section id="security" className="py-16 sm:py-20 border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="eyebrow">Trust &amp; Security</div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)]">
                Google API Services User Data Policy (Limited Use)
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--canvas)] border border-[var(--line)] text-[var(--brand-plum)] flex items-center justify-center flex-shrink-0">
              <Lock size={18} />
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            Strike&apos;s use and transfer to any other app of information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--brand-plum)] font-bold underline hover:opacity-80"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[var(--ink)] font-semibold">
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[var(--canvas)] border border-[var(--line)]">
              <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>We only request permissions strictly required to summarize and triage mail.</span>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[var(--canvas)] border border-[var(--line)]">
              <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>We do not transfer or sell email data to advertisers or third parties.</span>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[var(--canvas)] border border-[var(--line)]">
              <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>No humans read private emails unless explicitly requested for technical support.</span>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--canvas)] border border-[var(--line)]">
              <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>You can disconnect and wipe all account data with 1 click at any time.</span>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <Link
              href="/privacy"
              className="text-xs font-bold text-[var(--brand-plum)] hover:underline inline-flex items-center gap-1"
            >
              <span>Read Full Privacy Policy</span>
              <ChevronRight size={13} />
            </Link>
            <span className="text-[var(--line)]">•</span>
            <Link
              href="/terms"
              className="text-xs font-bold text-[var(--brand-plum)] hover:underline inline-flex items-center gap-1"
            >
              <span>Terms of Service</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FINAL CTA (CLEAN HEADLINE & ACTION)
          ========================================================================= */}
      <section className="py-16 sm:py-20 border-t border-[var(--line)] bg-[var(--canvas)] text-center">
        <div className="max-w-2xl mx-auto px-4 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--tint-rose-bg)] text-[var(--tint-rose-icon)] text-[11px] font-extrabold uppercase tracking-wider">
            <Sparkles size={12} />
            <span>Reclaim Your Focus</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
            Stop checking your inbox every 5 minutes.
          </h2>

          <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            Let Strike summarize, classify, and notify you of only what requires your urgent attention — delivered directly to WhatsApp.
          </p>

          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              style={{ backgroundColor: "#000000", color: "#ffffff" }}
              className="h-11 px-7 rounded-full font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm hover:bg-[#1a1a1a] transition-transform hover:scale-102"
            >
              <span>Get Started Free</span>
              <ArrowRight size={14} className="text-white" />
            </Link>
            <Link
              href="/login"
              style={{ backgroundColor: "var(--surface)", color: "var(--ink)", borderColor: "var(--line)" }}
              className="h-11 px-6 rounded-full font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 border shadow-xs hover:bg-[var(--surface-muted)] transition-colors"
            >
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER
          ========================================================================= */}
      <footer className="bg-[var(--canvas)] border-t border-[var(--line)] py-8 text-xs text-[var(--muted)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[var(--brand-plum)] text-white flex items-center justify-center text-xs font-bold">
              <Sparkles size={12} />
            </div>
            <span className="font-extrabold text-sm text-[var(--ink)]">strike</span>
            <span className="text-[var(--muted-light)]">© 2026 Strike. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 font-semibold">
            <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-[var(--ink)] transition-colors">
              Terms of Service
            </Link>
            <Link href="/login" className="hover:text-[var(--ink)] transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-[var(--ink)] transition-colors">
              Sign Up
            </Link>
            <Link href="/dashboard" className="hover:text-[var(--ink)] transition-colors">
              Dashboard
            </Link>
            <a
              href="mailto:mohitkumawatwork@gmail.com"
              className="hover:text-[var(--ink)] transition-colors inline-flex items-center gap-1"
            >
              <Mail size={12} />
              <span>Contact Support</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

