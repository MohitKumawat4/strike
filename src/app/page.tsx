"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/database/supabase/browser";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Flame,
  Globe,
  Inbox,
  Layers,
  LayoutDashboard,
  Lock,
  Mail,
  Menu,
  MessageSquare,
  Pause,
  Play,
  Quote,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  User,
  Users,
  Volume2,
  X,
  Zap,
} from "lucide-react";

/* =========================================================================
   TYPES & SAMPLE DATA FOR THE INTERACTIVE LIVE SIMULATOR
   ========================================================================= */

interface SampleEmail {
  id: string;
  sender: string;
  senderEmail: string;
  avatar: string;
  subject: string;
  snippet: string;
  category: "LEGAL & FINANCE" | "CRITICAL OPERATIONS" | "TEAM & PLANNING" | "NEWSLETTER & NOISE";
  urgencyScore: number;
  isUrgent: boolean;
  summary: string;
  actionItems: Array<{ action: string; deadline?: string }>;
  latency: string;
  status: "delivered" | "filtered";
  timestamp: string;
}

const SAMPLE_EMAILS: SampleEmail[] = [
  {
    id: "email-1",
    sender: "Jennifer Sterling",
    senderEmail: "j.sterling@meridian-ventures.com",
    avatar: "JS",
    subject: "Revised Series A Term Sheet & Closing Signature Due",
    snippet:
      "Following up on our partner meeting yesterday, the investment committee has signed off on the revised syndicate allocations. We need your review of clause 4.2 and all legal signatures by 10:00 AM tomorrow...",
    category: "LEGAL & FINANCE",
    urgencyScore: 0.96,
    isUrgent: true,
    summary:
      "Jennifer submitted updated Series A syndicate documentation with adjusted pro-rata allocations. Signature is mandatory before board ratification tomorrow morning.",
    actionItems: [
      { action: "Review clause 4.2 board seat designation" },
      { action: "Execute DocuSign legal agreement", deadline: "Tomorrow 10:00 AM" },
    ],
    latency: "142ms",
    status: "delivered",
    timestamp: "2 mins ago",
  },
  {
    id: "email-2",
    sender: "David Chen (General Counsel)",
    senderEmail: "d.chen@enterprise-law.com",
    avatar: "DC",
    subject: "Urgent: Final Review & Regulatory Filing Deadline",
    snippet:
      "The board and regulatory committee need the finalized compliance schedules signed off before the 3:00 PM market close today. Delaying past the window risks significant filing penalties...",
    category: "CRITICAL OPERATIONS",
    urgencyScore: 0.94,
    isUrgent: true,
    summary:
      "David requires immediate executive sign-off on the regulatory compliance schedules before today's 3:00 PM market window.",
    actionItems: [
      { action: "Review schedule 2A compliance disclosures" },
      { action: "Execute authorized signatory approval", deadline: "Today 3:00 PM" },
    ],
    latency: "118ms",
    status: "delivered",
    timestamp: "8 mins ago",
  },
  {
    id: "email-3",
    sender: "Marcus Vance (COO)",
    senderEmail: "marcus@company.internal",
    avatar: "MV",
    subject: "Q4 Headcount Budget Planning & Leadership Offsite",
    snippet:
      "Hey team, attaching the preliminary budget model for next quarter. Please review the headcount estimates and cast your vote on the two proposed offsite dates by Friday afternoon...",
    category: "TEAM & PLANNING",
    urgencyScore: 0.74,
    isUrgent: false,
    summary:
      "Marcus shared preliminary Q4 headcount budgets and requested team review along with location votes for the upcoming executive offsite.",
    actionItems: [
      { action: "Review headcount allocations worksheet" },
      { action: "Submit vote for offsite location", deadline: "Friday 5:00 PM" },
    ],
    latency: "165ms",
    status: "delivered",
    timestamp: "35 mins ago",
  },
  {
    id: "email-4",
    sender: "Cloud SaaS Weekly",
    senderEmail: "digest@saasweekly.news",
    avatar: "CS",
    subject: "Top 10 Growth Strategies For B2B Founders in 2026",
    snippet:
      "Check out this week's curated roundup of B2B marketing strategies, customer retention benchmarks, and industry trends from top hyper-growth founders...",
    category: "NEWSLETTER & NOISE",
    urgencyScore: 0.12,
    isUrgent: false,
    summary: "Standard weekly marketing newsletter containing industry articles and growth benchmarks.",
    actionItems: [],
    latency: "84ms",
    status: "filtered",
    timestamp: "1 hour ago",
  },
];

/* Pipeline Step Definition */
interface PipelineStep {
  number: string;
  title: string;
  badge: string;
  description: string;
  techStack: string;
  detail: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    number: "01",
    title: "Secure Inbox Connection",
    badge: "1-Click Setup",
    description: "Connect your Gmail securely in seconds. Strike listens for incoming priority mail in real time without battery drain.",
    techStack: "Google Authorized Security • Privacy-First Sync",
    detail: "Zero desktop software to install. Real-time mailbox synchronization with instant updates.",
  },
  {
    number: "02",
    title: "Smart Urgency Scoring",
    badge: "AI Prioritization",
    description: "Multi-layered reasoning evaluates sender importance, impending deadlines, financial contracts, and business stakes.",
    techStack: "Real-Time Context Reasoning • Priority Scale",
    detail: "Silences 88% of routine marketing noise, promotional blasts, and non-actionable emails automatically.",
  },
  {
    number: "03",
    title: "Executive Synthesis & Voice",
    badge: "AI Summarizer",
    description: "Extracts concise 2-sentence executive briefs, hard deadlines, and required action items into text and voice memos.",
    techStack: "Executive Summary Engine • Voice Note Synthesis",
    detail: "Transforms long email threads into 15-second digestible audio briefs for when you are on the move.",
  },
  {
    number: "04",
    title: "Direct WhatsApp Delivery",
    badge: "Instant Alert",
    description: "Instant delivery with interactive action buttons allowing you to triage emails straight from your WhatsApp chat.",
    techStack: "Direct WhatsApp Delivery • 2-Way Gmail Sync",
    detail: "Mark as read, take action, or open the email with a single tap directly inside WhatsApp.",
  },
];

/* =========================================================================
   LANDING PAGE COMPONENT (STITCH MCP VIOLET DUSK DESIGN SYSTEM)
   ========================================================================= */

export default function LandingPage() {
  const [selectedEmail, setSelectedEmail] = useState<SampleEmail>(SAMPLE_EMAILS[0]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Active user authentication state
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Fetch and subscribe to authentication state
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Check initial session
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        setCurrentUser(user);
        setIsLoadingUser(false);
      })
      .catch(() => {
        setIsLoadingUser(false);
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      setIsLoadingUser(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Audio simulation timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlayingAudio) {
      timer = setTimeout(() => {
        setIsPlayingAudio(false);
      }, 6000);
    }
    return () => clearTimeout(timer);
  }, [isPlayingAudio]);

  const handleQuickAction = (actionName: string) => {
    setActionFeedback(actionName);
    setTimeout(() => setActionFeedback(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#0f0817] text-[#f8f4e9] antialiased selection:bg-[#935073]/40 selection:text-[#f6dbc0] overflow-x-hidden font-sans">
      {/* Ambient Background Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-radial from-[#502d55]/35 to-transparent blur-[120px]" />
        <div className="absolute top-[30%] right-[-5%] w-[700px] h-[700px] rounded-full bg-radial from-[#935073]/25 to-transparent blur-[140px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[800px] h-[800px] rounded-full bg-radial from-[#502d55]/25 to-transparent blur-[160px]" />
      </div>

      {/* =========================================================================
          1. FLOATING GLASSMORPHIC NAVIGATION BAR
          ========================================================================= */}
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="backdrop-blur-xl bg-[#1a0f26]/85 border border-[#f6dbc0]/15 rounded-full px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all duration-200">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#935073] to-[#502d55] text-white flex items-center justify-center shadow-[0_0_16px_rgba(147,80,115,0.5)] group-hover:scale-105 transition-transform duration-200">
              <Sparkles size={16} className="text-[#f6dbc0]" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight leading-none text-white">
                strike
              </span>
              <span className="text-[9px] uppercase font-mono tracking-widest text-[#f6dbc0]/70 mt-0.5">
                AI Intelligence
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#baa5b7]">
            <a href="#simulator" className="hover:text-[#f6dbc0] transition-colors">
              Live Simulator
            </a>
            <a href="#telemetry" className="hover:text-[#f6dbc0] transition-colors">
              Performance
            </a>
            <a href="#features" className="hover:text-[#f6dbc0] transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#f6dbc0] transition-colors">
              How It Works
            </a>
            <a href="#security" className="hover:text-[#f6dbc0] transition-colors">
              Security &amp; Privacy
            </a>
          </nav>

          {/* Desktop Dynamic Auth Controls */}
          {isLoadingUser ? (
            <div className="hidden md:flex items-center gap-2">
              <div className="w-24 h-8 rounded-full bg-[#241535]/60 animate-pulse" />
            </div>
          ) : currentUser ? (
            <div className="hidden md:flex items-center gap-2.5">
              <Link
                href="/dashboard"
                className="h-9 px-4 rounded-full font-bold text-xs inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#935073] to-[#502d55] text-[#f6dbc0] shadow-[0_0_20px_rgba(147,80,115,0.35)] hover:shadow-[0_0_28px_rgba(147,80,115,0.55)] hover:scale-[1.02] transition-all border border-[#f6dbc0]/20"
              >
                <LayoutDashboard size={14} />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/dashboard"
                title={currentUser.email ?? "Go to Dashboard"}
                className="w-9 h-9 rounded-full bg-[#241535] border border-[#f6dbc0]/20 hover:border-[#f6dbc0]/50 flex items-center justify-center text-[#f6dbc0] transition-all shadow-md hover:scale-105"
              >
                {currentUser.email ? (
                  <span className="text-xs font-bold uppercase">
                    {currentUser.email.charAt(0)}
                  </span>
                ) : (
                  <User size={15} />
                )}
              </Link>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="text-xs font-semibold text-[#baa5b7] hover:text-white px-3 py-1.5 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="h-9 px-4 rounded-full font-bold text-xs inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#935073] to-[#502d55] text-[#f6dbc0] shadow-[0_0_20px_rgba(147,80,115,0.35)] hover:shadow-[0_0_28px_rgba(147,80,115,0.55)] hover:scale-[1.02] transition-all border border-[#f6dbc0]/20"
              >
                <span>Get Started Free</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {/* Mobile Menu Trigger */}
          <div className="flex md:hidden items-center gap-2">
            {currentUser ? (
              <Link
                href="/dashboard"
                className="h-8 px-3 rounded-full font-bold text-xs inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#935073] to-[#502d55] text-[#f6dbc0]"
              >
                <LayoutDashboard size={13} />
                <span>Dashboard</span>
              </Link>
            ) : (
              <Link
                href="/signup"
                className="h-8 px-3 rounded-full font-bold text-xs inline-flex items-center justify-center bg-gradient-to-r from-[#935073] to-[#502d55] text-[#f6dbc0]"
              >
                Start Free
              </Link>
            )}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-8 h-8 rounded-full border border-[#f6dbc0]/15 bg-[#241535] flex items-center justify-center text-white"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="md:hidden mt-2 border border-[#f6dbc0]/15 bg-[#1a0f26]/95 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl space-y-3"
            >
              <div className="flex flex-col space-y-2 text-sm font-semibold text-[#baa5b7]">
                <a
                  href="#simulator"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-[#241535] hover:text-[#f6dbc0]"
                >
                  Live Simulator
                </a>
                <a
                  href="#telemetry"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-[#241535] hover:text-[#f6dbc0]"
                >
                  Performance
                </a>
                <a
                  href="#features"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-[#241535] hover:text-[#f6dbc0]"
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-[#241535] hover:text-[#f6dbc0]"
                >
                  How It Works
                </a>
                <a
                  href="#security"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-[#241535] hover:text-[#f6dbc0]"
                >
                  Security &amp; Privacy
                </a>
              </div>

              {/* Mobile Auth Bottom Section */}
              {currentUser ? (
                <div className="pt-2 border-t border-[#f6dbc0]/10 space-y-2">
                  <div className="p-2.5 rounded-xl bg-[#241535] border border-[#f6dbc0]/15 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#935073] to-[#502d55] text-white flex items-center justify-center font-bold text-xs">
                      {currentUser.email ? currentUser.email.charAt(0).toUpperCase() : <User size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{currentUser.email}</div>
                      <div className="text-[10px] text-emerald-400 font-mono">Signed In</div>
                    </div>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full py-2.5 text-center text-xs font-bold rounded-full bg-gradient-to-r from-[#935073] to-[#502d55] text-[#f6dbc0] flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <LayoutDashboard size={14} />
                    <span>Go to Dashboard</span>
                  </Link>
                </div>
              ) : (
                <div className="pt-2 border-t border-[#f6dbc0]/10 flex items-center gap-2">
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-1/2 py-2 text-center text-xs font-semibold rounded-full border border-[#f6dbc0]/15 bg-[#241535] text-white"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-1/2 py-2 text-center text-xs font-bold rounded-full bg-gradient-to-r from-[#935073] to-[#502d55] text-[#f6dbc0]"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* =========================================================================
          2. HERO SECTION WITH GRADIENT DISPLAY TYPOGRAPHY
          ========================================================================= */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center z-10">
        {/* Top Status Indicator */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#f6dbc0]/20 bg-[#241535]/80 backdrop-blur-md text-xs font-medium text-[#f6dbc0] shadow-[0_0_16px_rgba(246,219,192,0.1)] mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span>Strike AI: Smart Email Prioritization + Voice Briefs</span>
          <ArrowUpRight size={13} className="text-[#f6dbc0]/70" />
        </motion.div>

        {/* Display Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] text-white max-w-4xl mx-auto"
        >
          Your Executive Inbox. <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-[#f6dbc0] via-[#baa5b7] to-[#935073] bg-clip-text text-transparent">
            Delivered to WhatsApp in Instant Voice &amp; Briefs.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-lg text-[#baa5b7] max-w-2xl mx-auto leading-relaxed"
        >
          Never miss critical deals, urgent legal sign-offs, or client escalations again.
          Strike filters out the ambient noise and delivers actionable executive briefs straight to WhatsApp in seconds.
        </motion.p>

        {/* Primary CTA Buttons (Dynamic based on currentUser) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          {currentUser ? (
            <Link
              href="/dashboard"
              className="w-full sm:w-auto h-12 px-8 rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#935073] to-[#502d55] text-[#f6dbc0] shadow-[0_0_30px_rgba(147,80,115,0.45)] hover:shadow-[0_0_40px_rgba(147,80,115,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all border border-[#f6dbc0]/30"
            >
              <LayoutDashboard size={16} />
              <span>Go to Dashboard</span>
              <ArrowRight size={15} />
            </Link>
          ) : (
            <Link
              href="/signup"
              className="w-full sm:w-auto h-12 px-8 rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#935073] to-[#502d55] text-[#f6dbc0] shadow-[0_0_30px_rgba(147,80,115,0.45)] hover:shadow-[0_0_40px_rgba(147,80,115,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all border border-[#f6dbc0]/30"
            >
              <Sparkles size={16} />
              <span>Connect Gmail Free</span>
              <ArrowRight size={15} />
            </Link>
          )}

          <a
            href="#simulator"
            className="w-full sm:w-auto h-12 px-7 rounded-full font-semibold text-sm inline-flex items-center justify-center gap-2 border border-[#f6dbc0]/15 bg-[#241535]/60 hover:bg-[#241535] text-[#f8f4e9] backdrop-blur-md hover:border-[#f6dbc0]/30 transition-all"
          >
            <Play size={14} className="text-[#f6dbc0]" />
            <span>Try Interactive Simulator</span>
          </a>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-[#baa5b7]/90 font-medium"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Official Google Limited-Use Security</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#f6dbc0]" />
            <span>Instant Real-Time Sync</span>
          </div>
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-[#baa5b7]" />
            <span>Zero Data Selling or Advertising</span>
          </div>
        </motion.div>
      </section>

      {/* =========================================================================
          3. INTERACTIVE SPLIT-SCREEN LIVE SIMULATOR
          ========================================================================= */}
      <section id="simulator" className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#241535] border border-[#f6dbc0]/15 text-[#f6dbc0] text-xs font-semibold uppercase tracking-wider">
            <Radio size={13} className="text-emerald-400 animate-pulse" />
            <span>Live Interactive Triage Simulator</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Select an incoming email to see Strike triage it in real-time
          </h2>
          <p className="text-sm text-[#baa5b7] leading-relaxed">
            Click any email in the queue. Observe how Strike extracts urgency, synthesizes voice summaries, and formats actionable WhatsApp alerts on the right.
          </p>
        </div>

        {/* Simulator Grid Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#1a0f26]/90 border border-[#f6dbc0]/15 rounded-3xl p-4 sm:p-7 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          {/* Left Column: Email Queue */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-2 pb-2 border-b border-[#f6dbc0]/10 text-xs font-mono text-[#baa5b7]">
              <div className="flex items-center gap-2">
                <Inbox size={14} className="text-[#f6dbc0]" />
                <span className="font-bold text-white uppercase tracking-wider">Incoming Mail Queue</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#241535] border border-[#f6dbc0]/10 text-[11px] text-[#f6dbc0]">
                4 Live Examples
              </span>
            </div>

            <div className="space-y-2.5">
              {SAMPLE_EMAILS.map((email) => {
                const isSelected = selectedEmail.id === email.id;
                return (
                  <button
                    key={email.id}
                    type="button"
                    onClick={() => {
                      setSelectedEmail(email);
                      setIsPlayingAudio(false);
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 border relative group cursor-pointer ${
                      isSelected
                        ? "bg-[#241535] border-[#f6dbc0]/40 shadow-[0_0_20px_rgba(147,80,115,0.25)]"
                        : "bg-[#140b20]/60 border-[#f6dbc0]/10 hover:border-[#f6dbc0]/20 hover:bg-[#1f122e]/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                            email.isUrgent
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : email.status === "filtered"
                              ? "bg-neutral-800 text-neutral-400 border border-neutral-700"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {email.avatar}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-[190px]">
                            {email.sender}
                          </div>
                          <div className="text-[10px] text-[#baa5b7] font-mono">{email.timestamp}</div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          email.isUrgent
                            ? "bg-rose-500/25 text-rose-300 border border-rose-500/30"
                            : email.status === "filtered"
                            ? "bg-neutral-800 text-neutral-400"
                            : "bg-amber-500/25 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {email.category}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-neutral-200 line-clamp-1 mb-1">
                      {email.subject}
                    </div>
                    <div className="text-[11px] text-[#baa5b7] line-clamp-2 leading-relaxed">
                      {email.snippet}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#f6dbc0]/10 flex items-center justify-between text-[10px] font-mono text-[#baa5b7]">
                      <span className="flex items-center gap-1">
                        <span>Urgency Score:</span>
                        <strong className={email.isUrgent ? "text-rose-400" : "text-amber-400"}>
                          {email.urgencyScore}
                        </strong>
                      </span>
                      <span className="text-emerald-400 font-semibold">{email.latency}</span>
                    </div>

                    {isSelected && (
                      <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-[#f6dbc0] rotate-45 hidden lg:block rounded-xs shadow-[0_0_10px_#f6dbc0]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: WhatsApp Live Device Simulation */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div className="bg-[#0b141a] rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white font-sans shadow-2xl border border-neutral-800 relative h-full flex flex-col justify-between">
              <div>
                {/* WhatsApp Device Top Bar */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800 text-[11px] text-neutral-400 font-mono">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#935073] to-[#502d55] text-white flex items-center justify-center font-bold text-xs shadow-md">
                      <Zap size={14} className="text-[#f6dbc0]" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-neutral-100 flex items-center gap-1.5">
                        <span>Strike Instant Alerts</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <div className="text-[10px] text-neutral-400">Direct WhatsApp Delivery</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-[#1f2c34] text-[10px] text-emerald-400 font-mono border border-emerald-500/20">
                      ⚡ {selectedEmail.latency}
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
                      className="mb-3 p-2.5 rounded-xl bg-emerald-600/90 text-white text-xs font-semibold flex items-center justify-between shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCheck size={15} />
                        <span>Action synced: {actionFeedback}</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-80">Updated in Gmail ✓</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Message Bubble Content */}
                {selectedEmail.status === "filtered" ? (
                  <div className="p-8 my-auto text-center space-y-3 bg-[#182229] rounded-2xl border border-neutral-800">
                    <div className="w-12 h-12 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto border border-neutral-700">
                      <Filter size={20} />
                    </div>
                    <h4 className="text-sm font-bold text-neutral-200">
                      Filtered Out (Zero Noise Mode)
                    </h4>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                      Classified as promotional newsletter with urgency score <strong>{selectedEmail.urgencyScore}</strong>. Strike skipped dispatching a WhatsApp alert to keep your phone quiet and distraction-free.
                    </p>
                  </div>
                ) : (
                  <motion.div
                    key={selectedEmail.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="bg-[#1f2c34] rounded-2xl p-4 sm:p-5 border border-neutral-700/70 max-w-xl ml-auto space-y-3 shadow-lg"
                  >
                    {/* Urgency Badge & Score */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                          selectedEmail.isUrgent
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {selectedEmail.isUrgent ? <Flame size={12} /> : <Zap size={12} />}
                        {selectedEmail.isUrgent ? "URGENT EMAIL DETECTED" : "IMPORTANT EMAIL"}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Urgency: {selectedEmail.urgencyScore} / 1.0
                      </span>
                    </div>

                    {/* Meta Data */}
                    <div className="text-xs text-neutral-300 space-y-0.5 font-mono bg-[#182229] p-2.5 rounded-xl border border-neutral-800">
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

                    {/* AI Executive Summary */}
                    <div className="pt-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
                        <Bot size={13} />
                        <span>AI Executive Summary</span>
                      </div>
                      <p className="text-xs text-neutral-200 leading-relaxed font-sans">
                        {selectedEmail.summary}
                      </p>
                    </div>

                    {/* Action Items */}
                    {selectedEmail.actionItems.length > 0 && (
                      <div className="pt-2 border-t border-neutral-700/60">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1.5">
                          <CheckCircle2 size={13} />
                          <span>Action Items &amp; Deadlines</span>
                        </div>
                        <ul className="text-xs text-neutral-200 space-y-1 font-sans">
                          {selectedEmail.actionItems.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 bg-[#182229]/60 p-1.5 rounded-lg">
                              <span className="text-amber-400 font-bold">•</span>
                              <span>
                                {item.action}{" "}
                                {item.deadline && (
                                  <strong className="text-amber-300 font-semibold bg-amber-950/40 px-1.5 py-0.5 rounded text-[11px] ml-1">
                                    {item.deadline}
                                  </strong>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Simulated Voice Note Player */}
                    <div className="pt-2 border-t border-neutral-700/60">
                      <div className="bg-[#182229] p-2.5 rounded-xl flex items-center gap-3 border border-neutral-800">
                        <button
                          type="button"
                          onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                          className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black flex items-center justify-center transition-all cursor-pointer shadow-md flex-shrink-0"
                          title="Play Voice Brief"
                        >
                          {isPlayingAudio ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                        </button>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <Volume2 size={11} />
                              <span>{isPlayingAudio ? "Playing Voice Brief..." : "AI Executive Voice Note"}</span>
                            </span>
                            <span>{isPlayingAudio ? "0:04 / 0:14" : "0:14"}</span>
                          </div>
                          {/* Animated Waveform Visualizer */}
                          <div className="flex items-center gap-0.5 h-4">
                            {[40, 70, 90, 30, 80, 100, 60, 45, 90, 75, 40, 85, 95, 60, 30, 70, 80, 50, 65, 85].map((h, i) => (
                              <div
                                key={i}
                                className={`flex-1 rounded-full transition-all duration-200 ${
                                  isPlayingAudio
                                    ? "bg-emerald-400 animate-pulse"
                                    : "bg-neutral-600"
                                }`}
                                style={{
                                  height: isPlayingAudio ? `${Math.max(20, (h * (i % 3 + 1)) % 100)}%` : `${h}%`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Clickable Interactive WhatsApp Buttons */}
                    <div className="pt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickAction("Marked Read in Gmail ✓")}
                        className="w-full py-2 px-3 rounded-xl bg-[#2a3942] hover:bg-[#344652] active:scale-95 text-xs font-bold text-neutral-100 transition-all border border-neutral-600 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Check size={13} />
                        <span>Mark Read</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAction("Launched Thread in Strike ⚡")}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#935073] to-[#502d55] hover:opacity-90 active:scale-95 text-xs font-bold text-[#f6dbc0] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md border border-[#f6dbc0]/20"
                      >
                        <span>Open in Strike</span>
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-800/80 text-center text-[10px] text-neutral-400 flex items-center justify-center gap-1.5 font-mono">
                <Sparkles size={12} className="text-[#f6dbc0]" />
                <span>Interactive Simulator: Click the WhatsApp buttons above to test live actions</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. LIVE TELEMETRY / PERFORMANCE BAR
          ========================================================================= */}
      <section id="telemetry" className="py-8 border-y border-[#f6dbc0]/10 bg-[#140b20]/60 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono flex items-center justify-center gap-1.5">
                <Activity size={18} className="text-emerald-400" />
                <span>99.98%</span>
              </div>
              <p className="text-xs text-[#baa5b7]">Uptime Reliability</p>
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#f6dbc0] font-mono flex items-center justify-center gap-1.5">
                <Clock3 size={18} className="text-[#f6dbc0]" />
                <span>&lt;1.2s</span>
              </div>
              <p className="text-xs text-[#baa5b7]">Average Alert Speed</p>
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono flex items-center justify-center gap-1.5">
                <Shield size={18} className="text-emerald-400" />
                <span>256-bit</span>
              </div>
              <p className="text-xs text-[#baa5b7]">Bank-Grade Data Encryption</p>
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#f6dbc0] font-mono flex items-center justify-center gap-1.5">
                <Zap size={18} className="text-[#935073]" />
                <span>0</span>
              </div>
              <p className="text-xs text-[#baa5b7]">Battery Drain (Smart Push Sync)</p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. 5-CELL FEATURE BENTO GRID
          ========================================================================= */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#241535] border border-[#f6dbc0]/15 text-[#f6dbc0] text-xs font-semibold uppercase tracking-wider">
            <Layers size={13} />
            <span>Product Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Engineered for high-performing executives and leaders
          </h2>
          <p className="text-sm text-[#baa5b7] leading-relaxed">
            Every feature is purpose-built to eliminate context switching and keep you focused on decisions that matter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Cell 1: 3-Tier Neural Urgency Engine (Spans 2 cols on md) */}
          <div className="md:col-span-2 rounded-3xl p-6 sm:p-8 bg-[#1a0f26]/90 border border-[#f6dbc0]/15 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col justify-between group hover:border-[#f6dbc0]/30 transition-all">
            <div className="space-y-3 z-10">
              <div className="w-10 h-10 rounded-2xl bg-[#241535] border border-[#f6dbc0]/20 flex items-center justify-center text-[#f6dbc0]">
                <Flame size={20} />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Smart Urgency Engine
              </h3>
              <p className="text-xs sm:text-sm text-[#baa5b7] max-w-lg leading-relaxed">
                Strike scores incoming emails from 0.0 to 1.0 based on sender priority, impending deadlines, financial contracts, and business impact.
              </p>
            </div>

            {/* Visual Urgency Score Cards */}
            <div className="mt-6 grid grid-cols-3 gap-3 z-10">
              <div className="p-3 rounded-2xl bg-[#241535] border border-rose-500/30 text-center space-y-1">
                <div className="text-[10px] font-bold text-rose-400 uppercase">Urgent (0.8+)</div>
                <div className="text-xs font-bold text-white">Instant WhatsApp + Voice</div>
              </div>
              <div className="p-3 rounded-2xl bg-[#241535] border border-amber-500/30 text-center space-y-1">
                <div className="text-[10px] font-bold text-amber-400 uppercase">Normal (0.4+)</div>
                <div className="text-xs font-bold text-white">Executive Text Summary</div>
              </div>
              <div className="p-3 rounded-2xl bg-[#241535] border border-neutral-700 text-center space-y-1">
                <div className="text-[10px] font-bold text-neutral-400 uppercase">Filtered (&lt;0.4)</div>
                <div className="text-xs font-bold text-white">Zero Noise &amp; Silenced</div>
              </div>
            </div>

            <div className="absolute top-0 right-0 w-64 h-64 bg-radial from-[#935073]/20 to-transparent blur-3xl pointer-events-none" />
          </div>

          {/* Cell 2: WhatsApp Voice Briefs */}
          <div className="rounded-3xl p-6 sm:p-8 bg-[#1a0f26]/90 border border-[#f6dbc0]/15 shadow-xl backdrop-blur-xl flex flex-col justify-between group hover:border-[#f6dbc0]/30 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#241535] border border-[#f6dbc0]/20 flex items-center justify-center text-[#f6dbc0]">
                <Volume2 size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">WhatsApp Voice Briefs</h3>
              <p className="text-xs text-[#baa5b7] leading-relaxed">
                Driving or between meetings? Listen to an ultra-realistic 15-second voice memo summarizing your latest urgent thread.
              </p>
            </div>

            <div className="mt-6 p-3 rounded-2xl bg-[#241535] border border-[#f6dbc0]/15 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-xs">
                <Play size={12} className="ml-0.5" />
              </div>
              <div className="text-[11px] font-mono text-[#baa5b7] truncate">
                brief_series_a_closing.mp3
              </div>
            </div>
          </div>

          {/* Cell 3: 1-Click Interactive Remote Actions */}
          <div className="rounded-3xl p-6 sm:p-8 bg-[#1a0f26]/90 border border-[#f6dbc0]/15 shadow-xl backdrop-blur-xl flex flex-col justify-between group hover:border-[#f6dbc0]/30 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#241535] border border-[#f6dbc0]/20 flex items-center justify-center text-[#f6dbc0]">
                <Smartphone size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">1-Click Quick Actions</h3>
              <p className="text-xs text-[#baa5b7] leading-relaxed">
                Execute actions straight from WhatsApp chat without opening your inbox. Mark read or view full details instantly.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-semibold">
              <div className="flex-1 py-1.5 text-center rounded-xl bg-[#241535] border border-[#f6dbc0]/15 text-[#f6dbc0]">
                Mark Read
              </div>
              <div className="flex-1 py-1.5 text-center rounded-xl bg-[#935073]/40 border border-[#f6dbc0]/20 text-white">
                Open Email
              </div>
            </div>
          </div>

          {/* Cell 4: Zero-Noise Filter */}
          <div className="rounded-3xl p-6 sm:p-8 bg-[#1a0f26]/90 border border-[#f6dbc0]/15 shadow-xl backdrop-blur-xl flex flex-col justify-between group hover:border-[#f6dbc0]/30 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#241535] border border-[#f6dbc0]/20 flex items-center justify-center text-[#f6dbc0]">
                <Filter size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">Zero-Noise Filter</h3>
              <p className="text-xs text-[#baa5b7] leading-relaxed">
                Newsletters, marketing blasts, and routine receipts stay safely organized in Gmail without buzzing your phone.
              </p>
            </div>

            <div className="mt-6 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20 text-center">
              ✓ 88% ambient noise reduction
            </div>
          </div>

          {/* Cell 5: Instant Real-Time Push Sync */}
          <div className="rounded-3xl p-6 sm:p-8 bg-[#1a0f26]/90 border border-[#f6dbc0]/15 shadow-xl backdrop-blur-xl flex flex-col justify-between group hover:border-[#f6dbc0]/30 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#241535] border border-[#f6dbc0]/20 flex items-center justify-center text-[#f6dbc0]">
                <Zap size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">Instant Cloud Delivery</h3>
              <p className="text-xs text-[#baa5b7] leading-relaxed">
                Real-time inbox intelligence that notifies you the moment a critical message arrives without draining battery.
              </p>
            </div>

            <div className="mt-6 text-[11px] font-mono text-[#f6dbc0] bg-[#241535] p-2.5 rounded-xl border border-[#f6dbc0]/15 text-center">
              ⚡ Instant notification speed
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. INTERACTIVE 4-STEP PIPELINE FLOW
          ========================================================================= */}
      <section id="how-it-works" className="py-16 sm:py-24 border-t border-[#f6dbc0]/10 bg-[#140b20]/40 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#241535] border border-[#f6dbc0]/15 text-[#f6dbc0] text-xs font-semibold uppercase tracking-wider">
              <Bot size={13} />
              <span>How It Works</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Simple, Automated, and Fast
            </h2>
            <p className="text-sm text-[#baa5b7] leading-relaxed">
              Explore how Strike transforms raw email overload into calm, actionable WhatsApp briefs.
            </p>
          </div>

          {/* Interactive Step Switcher */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {PIPELINE_STEPS.map((step, idx) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                  activeStep === idx
                    ? "bg-[#241535] border-[#f6dbc0] shadow-[0_0_20px_rgba(246,219,192,0.15)]"
                    : "bg-[#1a0f26]/60 border-[#f6dbc0]/10 hover:border-[#f6dbc0]/25"
                }`}
              >
                <div className="text-xs font-mono font-bold text-[#f6dbc0] mb-1">
                  {step.number}
                </div>
                <div className="text-xs font-bold text-white line-clamp-1">{step.title}</div>
              </button>
            ))}
          </div>

          {/* Active Step Detailed Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="p-6 sm:p-10 rounded-3xl bg-[#1a0f26]/95 border border-[#f6dbc0]/20 shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <span className="text-xs font-mono font-bold text-[#f6dbc0] uppercase tracking-wider">
                    Step {PIPELINE_STEPS[activeStep].number}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                    {PIPELINE_STEPS[activeStep].title}
                  </h3>
                </div>
                <span className="px-3.5 py-1.5 rounded-full bg-[#241535] border border-[#f6dbc0]/20 text-xs font-mono text-[#f6dbc0]">
                  {PIPELINE_STEPS[activeStep].badge}
                </span>
              </div>

              <p className="text-base text-neutral-200 leading-relaxed max-w-3xl mb-6">
                {PIPELINE_STEPS[activeStep].description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-[#f6dbc0]/10 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#241535]/80 border border-[#f6dbc0]/10 space-y-1">
                  <div className="font-bold text-[#f6dbc0] uppercase text-[10px] tracking-wider">
                    Security &amp; Standards
                  </div>
                  <div className="text-neutral-300 font-mono">
                    {PIPELINE_STEPS[activeStep].techStack}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#241535]/80 border border-[#f6dbc0]/10 space-y-1">
                  <div className="font-bold text-emerald-400 uppercase text-[10px] tracking-wider">
                    Key Benefit
                  </div>
                  <div className="text-neutral-300 font-mono">
                    {PIPELINE_STEPS[activeStep].detail}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* =========================================================================
          7. BANK-GRADE SECURITY & PRIVACY SECTION
          ========================================================================= */}
      <section id="security" className="py-16 sm:py-24 border-t border-[#f6dbc0]/10 bg-[#0f0817] relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#241535] border border-[#f6dbc0]/15 text-[#f6dbc0] text-xs font-semibold uppercase tracking-wider mb-2">
                <Lock size={12} />
                <span>Zero-Trust Data Protection</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Google API Services User Data Policy (Limited Use)
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#241535] border border-[#f6dbc0]/20 text-[#f6dbc0] flex items-center justify-center flex-shrink-0 shadow-lg">
              <ShieldCheck size={24} className="text-emerald-400" />
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#baa5b7] leading-relaxed">
            Strike&apos;s use and transfer to any other app of information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="text-[#f6dbc0] font-bold underline hover:opacity-80"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-neutral-200">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#1a0f26]/80 border border-[#f6dbc0]/15">
              <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>We only request permissions strictly necessary to summarize and triage your mail.</span>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#1a0f26]/80 border border-[#f6dbc0]/15">
              <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>We never sell, rent, or transfer email data to third-party ad networks or brokers.</span>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#1a0f26]/80 border border-[#f6dbc0]/15">
              <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>No human reads private inbox contents unless you explicitly open an opt-in support ticket.</span>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#1a0f26]/80 border border-[#f6dbc0]/15">
              <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Disconnect Gmail and purge your stored metadata with 1 click at any time.</span>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <Link
              href="/privacy"
              className="text-xs font-bold text-[#f6dbc0] hover:underline inline-flex items-center gap-1"
            >
              <span>Read Full Privacy Policy</span>
              <ChevronRight size={13} />
            </Link>
            <span className="text-[#f6dbc0]/30">•</span>
            <Link
              href="/terms"
              className="text-xs font-bold text-[#f6dbc0] hover:underline inline-flex items-center gap-1"
            >
              <span>Terms of Service</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. EXECUTIVE TESTIMONIALS
          ========================================================================= */}
      <section className="py-16 sm:py-20 border-t border-[#f6dbc0]/10 bg-[#0f0817] relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#241535] border border-[#f6dbc0]/15 text-[#f6dbc0] text-xs font-semibold uppercase tracking-wider">
              <Quote size={12} />
              <span>What Leaders Say</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Trusted by operators who value time
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-[#1a0f26]/80 border border-[#f6dbc0]/15 space-y-4 shadow-lg">
              <div className="flex text-amber-400 gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} fill="currentColor" />
                ))}
              </div>
              <p className="text-xs text-neutral-200 leading-relaxed italic">
                &ldquo;Strike saved my fund&apos;s allocation during a $12M bridge round. The closing term sheet came in while I was on a flight; the WhatsApp alert gave me the immediate summary to approve via satellite WiFi.&rdquo;
              </p>
              <div className="pt-2 border-t border-[#f6dbc0]/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#241535] border border-[#f6dbc0]/20 flex items-center justify-center font-bold text-xs text-[#f6dbc0]">
                  EK
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Elena Rostova</div>
                  <div className="text-[10px] text-[#baa5b7]">General Partner, Apex Capital</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#1a0f26]/80 border border-[#f6dbc0]/15 space-y-4 shadow-lg">
              <div className="flex text-amber-400 gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} fill="currentColor" />
                ))}
              </div>
              <p className="text-xs text-neutral-200 leading-relaxed italic">
                &ldquo;I used to open Gmail 80 times a day. Now my phone stays face down. If something genuinely breaks or a customer escalates, Strike pings my WhatsApp in 2 seconds. The voice memo feature is magical.&rdquo;
              </p>
              <div className="pt-2 border-t border-[#f6dbc0]/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#241535] border border-[#f6dbc0]/20 flex items-center justify-center font-bold text-xs text-[#f6dbc0]">
                  DK
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Devon Kelly</div>
                  <div className="text-[10px] text-[#baa5b7]">Founder &amp; CTO, HyperFlow</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#1a0f26]/80 border border-[#f6dbc0]/15 space-y-4 shadow-lg">
              <div className="flex text-amber-400 gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} fill="currentColor" />
                ))}
              </div>
              <p className="text-xs text-neutral-200 leading-relaxed italic">
                &ldquo;The 1-click &apos;Mark Read&apos; button directly inside WhatsApp is pure gold. It syncs right back with Google Gmail. Strike pays for itself every single morning.&rdquo;
              </p>
              <div className="pt-2 border-t border-[#f6dbc0]/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#241535] border border-[#f6dbc0]/20 flex items-center justify-center font-bold text-xs text-[#f6dbc0]">
                  AS
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Aiden Shah</div>
                  <div className="text-[10px] text-[#baa5b7]">VP Operations, ScaleBridge</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          9. FINAL CONVERSION BANNER & FOOTER
          ========================================================================= */}
      <section className="py-20 border-t border-[#f6dbc0]/10 bg-gradient-to-b from-[#140b20] to-[#0f0817] text-center relative z-10">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#241535] border border-[#f6dbc0]/20 text-[#f6dbc0] text-xs font-bold uppercase tracking-wider">
            <Sparkles size={12} />
            <span>Reclaim Your Executive Focus</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Stop checking your inbox every 5 minutes.
          </h2>

          <p className="text-sm sm:text-base text-[#baa5b7] leading-relaxed max-w-xl mx-auto">
            Let Strike summarize, classify, and notify you of only what requires your urgent attention — delivered directly to WhatsApp.
          </p>

          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            {currentUser ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto h-12 px-8 rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#935073] to-[#502d55] text-[#f6dbc0] shadow-[0_0_30px_rgba(147,80,115,0.4)] hover:scale-[1.02] transition-all border border-[#f6dbc0]/30"
              >
                <LayoutDashboard size={15} />
                <span>Go to Your Dashboard</span>
                <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="w-full sm:w-auto h-12 px-8 rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#935073] to-[#502d55] text-[#f6dbc0] shadow-[0_0_30px_rgba(147,80,115,0.4)] hover:scale-[1.02] transition-all border border-[#f6dbc0]/30"
                >
                  <span>Get Started Free</span>
                  <ArrowRight size={15} />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto h-12 px-7 rounded-full font-semibold text-sm inline-flex items-center justify-center gap-2 border border-[#f6dbc0]/15 bg-[#241535]/80 hover:bg-[#241535] text-white transition-colors"
                >
                  <span>Sign In</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0b0512] border-t border-[#f6dbc0]/10 py-10 text-xs text-[#baa5b7] relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-85 transition-opacity" title="Strike Home">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#935073] to-[#502d55] text-white flex items-center justify-center text-xs font-bold shadow-md">
                <Sparkles size={13} className="text-[#f6dbc0]" />
              </div>
              <span className="font-extrabold text-base text-white">strike</span>
            </Link>
            <span className="text-[#baa5b7]/50">© 2026 Strike Intelligence. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 font-semibold">
            <Link href="/privacy" className="hover:text-[#f6dbc0] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-[#f6dbc0] transition-colors">
              Terms of Service
            </Link>
            <Link href="/login" className="hover:text-[#f6dbc0] transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-[#f6dbc0] transition-colors">
              Sign Up
            </Link>
            <Link href="/dashboard" className="hover:text-[#f6dbc0] transition-colors">
              Dashboard
            </Link>
            <a
              href="mailto:mohitkumawatwork@gmail.com"
              className="hover:text-[#f6dbc0] transition-colors inline-flex items-center gap-1.5"
            >
              <Mail size={13} />
              <span>Contact Support</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
