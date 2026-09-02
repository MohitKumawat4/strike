import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, Mail, Shield, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — Strike Email Intelligence",
  description: "Terms of Service and conditions for using the Strike Email Intelligence platform.",
};

export default function TermsOfServicePage() {
  const lastUpdated = "September 1, 2026";

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--ink)", padding: "40px 20px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Navigation Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "36px" }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--muted)",
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "1.1rem" }}>
            <span
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "#000000",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={14} />
            </span>
            <span>strike</span>
          </div>
        </div>

        {/* Hero Section */}
        <header
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            padding: "32px",
            marginBottom: "32px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--brand-plum-text)", marginBottom: "12px" }}>
            <FileText size={22} />
            <span style={{ fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Legal Agreement
            </span>
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 10px 0", letterSpacing: "-0.02em" }}>
            Terms of Service
          </h1>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.95rem" }}>
            Last updated: {lastUpdated} • Please read these terms carefully before using Strike.
          </p>
        </header>

        {/* Main Content Card */}
        <main
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            padding: "36px",
            lineHeight: 1.7,
            fontSize: "0.95rem",
          }}
        >
          {/* Section 1: Agreement */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              1. Acceptance of Terms
            </h2>
            <p style={{ color: "var(--muted)", margin: 0 }}>
              By accessing or using the Strike web application (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree with any part of these Terms, you must not access or use the Service.
            </p>
          </section>

          {/* Section 2: Description of Service */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              2. Description of Service
            </h2>
            <p style={{ color: "var(--muted)", margin: "0 0 12px 0" }}>
              Strike provides an inbox intelligence platform that connects with Google Gmail accounts to ingest, summarize, categorize, and prioritize email communications through automated workflows and artificial intelligence.
            </p>
          </section>

          {/* Section 3: User Accounts & Authentication */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              3. User Accounts and Authentication
            </h2>
            <ul style={{ paddingLeft: "20px", color: "var(--muted)", margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>
                You are responsible for maintaining the confidentiality of your account credentials.
              </li>
              <li style={{ marginBottom: "8px" }}>
                You agree to only connect email inboxes and accounts for which you have lawful access and explicit authorization.
              </li>
              <li style={{ marginBottom: "8px" }}>
                You may disconnect connected mailboxes at any time directly through the application.
              </li>
            </ul>
          </section>

          {/* Section 4: AI Assisted Summaries Disclaimer */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              4. AI-Generated Summaries Disclaimer
            </h2>
            <p style={{ color: "var(--muted)", margin: "0 0 12px 0" }}>
              Strike uses advanced artificial intelligence models to assist you with summarizing and triaging email messages. While we strive for high precision:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <CheckCircle2 size={16} style={{ color: "var(--ink)", marginTop: "4px", flexShrink: 0 }} />
                <span style={{ color: "var(--muted)" }}>
                  AI summaries are provided for informational and productivity purposes only and should not replace reading critical original messages.
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <CheckCircle2 size={16} style={{ color: "var(--ink)", marginTop: "4px", flexShrink: 0 }} />
                <span style={{ color: "var(--muted)" }}>
                  You retain full responsibility for taking action or making legal, financial, or personal decisions based on incoming emails.
                </span>
              </div>
            </div>
          </section>

          {/* Section 5: Intellectual Property */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              5. Data Ownership and Privacy
            </h2>
            <p style={{ color: "var(--muted)", margin: 0 }}>
              You retain all ownership rights to your email content, accounts, and personal data. We do not claim any ownership over your email messages. Our collection and use of your data is governed by our{" "}
              <Link href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>
                Privacy Policy
              </Link>.
            </p>
          </section>

          {/* Section 6: Termination */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              6. Termination
            </h2>
            <p style={{ color: "var(--muted)", margin: 0 }}>
              We reserve the right to suspend or terminate access to our Service at our discretion if these Terms are violated. You may cease using the Service and delete your connected accounts at any time.
            </p>
          </section>

          {/* Section 7: Contact */}
          <section style={{ borderTop: "1px solid var(--line)", paddingTop: "24px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              7. Contact Information
            </h2>
            <p style={{ color: "var(--muted)", margin: "0 0 12px 0" }}>
              For any questions regarding these Terms of Service, please contact:
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ink)", fontWeight: 500 }}>
              <Mail size={16} />
              <a href="mailto:mohitkumawatwork@gmail.com" style={{ color: "inherit", textDecoration: "none" }}>
                mohitkumawatwork@gmail.com
              </a>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
