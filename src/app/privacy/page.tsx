import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Lock, Mail, Shield, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Strike Email Intelligence",
  description: "Privacy Policy and Google API User Data Limited Use Disclosure for Strike.",
};

export default function PrivacyPolicyPage() {
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
            <Shield size={22} />
            <span style={{ fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Privacy & Security
            </span>
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 10px 0", letterSpacing: "-0.02em" }}>
            Privacy Policy
          </h1>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.95rem" }}>
            Last updated: {lastUpdated} • Applies to Strike Web Application & Services
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
          {/* Section 1: Overview */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              1. Overview
            </h2>
            <p style={{ color: "var(--muted)", margin: 0 }}>
              Strike (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is an email intelligence and productivity platform. We respect your privacy and are committed to protecting the personal data and email information you entrust to us. This Privacy Policy explains how our application accesses, collects, uses, and protects your information when you connect your Google/Gmail account.
            </p>
          </section>

          {/* Section 2: Google API Limited Use Disclosure */}
          <section
            style={{
              marginBottom: "32px",
              background: "rgba(0, 0, 0, 0.03)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <Lock size={18} style={{ color: "var(--ink)" }} />
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0, color: "var(--ink)" }}>
                2. Google API Services User Data Policy (Limited Use)
              </h2>
            </div>
            <p style={{ color: "var(--ink)", fontWeight: 500, margin: "0 0 10px 0" }}>
              Strike&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                rel="noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
                target="_blank"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--muted)", fontSize: "0.9rem" }}>
              <li>We only request permissions strictly necessary to provide inbox summarization and triage.</li>
              <li>We do not transfer your email data to external third parties except to provide the service.</li>
              <li>We do not use or transfer your email data for serving advertisements.</li>
              <li>We do not allow humans to read your email data unless you have given explicit consent for troubleshooting or it is required by law.</li>
            </ul>
          </section>

          {/* Section 3: Information We Access & Collect */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              3. Information We Collect and Access
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: "12px" }}>
              When you connect your Gmail account to Strike via Google OAuth 2.0, we access:
            </p>
            <ul style={{ paddingLeft: "20px", color: "var(--muted)", margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>
                <strong>Account Profile:</strong> Your email address and basic profile identifier to authenticate your mailbox.
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>Email Metadata:</strong> Message ID, subject line, sender/recipient addresses, timestamps, and thread identifiers.
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>Email Content:</strong> Snippet and body text extracted specifically for AI summarization and classification.
              </li>
            </ul>
          </section>

          {/* Section 4: How We Use Your Data */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              4. How We Use Your Information
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <CheckCircle2 size={16} style={{ color: "var(--ink)", marginTop: "4px", flexShrink: 0 }} />
                <span style={{ color: "var(--muted)" }}>
                  <strong>Automated Summarization:</strong> Generating structured bullet points, key deadlines, and action items from incoming messages.
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <CheckCircle2 size={16} style={{ color: "var(--ink)", marginTop: "4px", flexShrink: 0 }} />
                <span style={{ color: "var(--muted)" }}>
                  <strong>Smart Triage & Prioritization:</strong> Assigning category tags and priority scores so you can focus on urgent communications.
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <CheckCircle2 size={16} style={{ color: "var(--ink)", marginTop: "4px", flexShrink: 0 }} />
                <span style={{ color: "var(--muted)" }}>
                  <strong>Real-Time Sync:</strong> Receiving push event notifications from Google Cloud Pub/Sub when your mailbox receives new updates.
                </span>
              </div>
            </div>
          </section>

          {/* Section 5: Data Security and Encryption */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              5. Data Security & Encryption
            </h2>
            <p style={{ color: "var(--muted)", margin: "0 0 12px 0" }}>
              We implement industry-standard cryptographic safeguards to protect your credentials and data:
            </p>
            <ul style={{ paddingLeft: "20px", color: "var(--muted)", margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>
                <strong>Encryption at Rest:</strong> All OAuth refresh tokens and sensitive tokens are encrypted using AES-256 encryption before storage.
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>Row-Level Security (RLS):</strong> Database records are strictly partitioned using PostgreSQL Row Level Security to ensure only authenticated users can access their own mailboxes.
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>HTTPS in Transit:</strong> All data transmissions between your browser, our servers, Google APIs, and AI models use TLS/SSL encryption.
              </li>
            </ul>
          </section>

          {/* Section 6: User Rights & Data Deletion */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              6. Your Rights & Data Deletion
            </h2>
            <p style={{ color: "var(--muted)", margin: "0 0 12px 0" }}>
              You maintain complete control over your connected accounts and stored information:
            </p>
            <ul style={{ paddingLeft: "20px", color: "var(--muted)", margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>
                <strong>Disconnecting an Account:</strong> You can disconnect your mailbox at any time via the <em>Accounts</em> tab in your Strike dashboard.
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>Revoking Google Access:</strong> You can revoke Strike&apos;s access immediately at any time via{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  rel="noreferrer"
                  style={{ color: "inherit", textDecoration: "underline" }}
                  target="_blank"
                >
                  Google Account Security Settings
                </a>.
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>Full Data Deletion:</strong> You may request complete erasure of all your stored message history by contacting us.
              </li>
            </ul>
          </section>

          {/* Section 7: Contact Us */}
          <section style={{ borderTop: "1px solid var(--line)", paddingTop: "24px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              7. Contact & Support
            </h2>
            <p style={{ color: "var(--muted)", margin: "0 0 12px 0" }}>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our security practices, please contact:
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
