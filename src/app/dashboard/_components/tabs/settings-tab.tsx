"use client";

import ui from "./modern-tabs.module.css";

import { useEffect, useState } from "react";
import { useTheme } from "@/app/theme-provider";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  PowerOff,
  Send,
  Settings2,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";

import { ConfirmModal } from "../confirm-modal";
import { createSupabaseBrowserClient } from "@/database/supabase/browser";
import type { UserSettings } from "../dashboard-shell";

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)", flag: "🇮🇳" },
  { code: "+1", label: "US / Canada (+1)", flag: "🇺🇸" },
  { code: "+44", label: "UK (+44)", flag: "🇬🇧" },
  { code: "+971", label: "UAE (+971)", flag: "🇦🇪" },
  { code: "+65", label: "Singapore (+65)", flag: "🇸🇬" },
  { code: "+49", label: "Germany (+49)", flag: "🇩🇪" },
  { code: "+61", label: "Australia (+61)", flag: "🇦🇺" },
  { code: "+33", label: "France (+33)", flag: "🇫🇷" },
  { code: "+81", label: "Japan (+81)", flag: "🇯🇵" },
  { code: "+55", label: "Brazil (+55)", flag: "🇧🇷" },
  { code: "+966", label: "Saudi Arabia (+966)", flag: "🇸🇦" },
  { code: "+27", label: "South Africa (+27)", flag: "🇿🇦" },
  { code: "+86", label: "China (+86)", flag: "🇨🇳" },
  { code: "+82", label: "South Korea (+82)", flag: "🇰🇷" },
  { code: "+39", label: "Italy (+39)", flag: "🇮🇹" },
  { code: "+34", label: "Spain (+34)", flag: "🇪🇸" },
  { code: "+31", label: "Netherlands (+31)", flag: "🇳🇱" },
  { code: "+41", label: "Switzerland (+41)", flag: "🇨🇭" },
  { code: "+46", label: "Sweden (+46)", flag: "🇸🇪" },
  { code: "+62", label: "Indonesia (+62)", flag: "🇮🇩" },
  { code: "+60", label: "Malaysia (+60)", flag: "🇲🇾" },
  { code: "+63", label: "Philippines (+63)", flag: "🇵🇭" },
  { code: "+64", label: "New Zealand (+64)", flag: "🇳🇿" },
  { code: "+52", label: "Mexico (+52)", flag: "🇲🇽" },
  { code: "+234", label: "Nigeria (+234)", flag: "🇳🇬" },
  { code: "+254", label: "Kenya (+254)", flag: "🇰🇪" },
  { code: "+20", label: "Egypt (+20)", flag: "🇪🇬" },
  { code: "+92", label: "Pakistan (+92)", flag: "🇵🇰" },
  { code: "+880", label: "Bangladesh (+880)", flag: "🇧🇩" },
  { code: "+94", label: "Sri Lanka (+94)", flag: "🇱🇰" },
  { code: "+977", label: "Nepal (+977)", flag: "🇳🇵" },
];

function parseInitialPhone(raw: string | null | undefined): { code: string; number: string } {
  if (!raw) return { code: "+91", number: "" };
  const cleaned = raw.trim();
  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;

  // Sort country codes by descending code length to match longest prefix first (+971 before +9)
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  const matched = sorted.find((c) => withPlus.startsWith(c.code));
  if (matched) {
    return {
      code: matched.code,
      number: withPlus.slice(matched.code.length).replace(/\D/g, ""),
    };
  }

  const match = withPlus.match(/^(\+\d{1,4})(\d+)$/);
  if (match) {
    return { code: match[1], number: match[2] };
  }
  return { code: "+91", number: cleaned.replace(/\D/g, "") };
}

type SettingsTabProps = {
  email: string;
  userSettings: UserSettings | null;
  onUpdateUserSettings?: (settings: UserSettings) => void;
};

export function SettingsTab({ email, userSettings, onUpdateUserSettings }: SettingsTabProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  /* Parse existing phone into country code and local number */
  const initialPhone = parseInitialPhone(userSettings?.whatsapp_destination);
  const [countryCode, setCountryCode] = useState(initialPhone.code);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.number);
  const [savedDestination, setSavedDestination] = useState<string | null>(
    userSettings?.whatsapp_destination ?? null
  );

  const [importanceThreshold, setImportanceThreshold] = useState(
    userSettings?.importance_threshold ?? 0.5
  );
  const [retentionDays, setRetentionDays] = useState(
    userSettings?.raw_body_retention_days ?? 30
  );
  const [notifyImportant, setNotifyImportant] = useState(
    userSettings?.notify_on_important ?? true
  );
  const [notifyFailures, setNotifyFailures] = useState(
    userSettings?.notify_on_failure ?? true
  );
  const [disableProcessing, setDisableProcessing] = useState(
    userSettings?.disable_processing ?? false
  );
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingProcessingState, setPendingProcessingState] = useState<boolean | null>(null);
  const [isTogglingProcessing, setIsTogglingProcessing] = useState(false);

  /* Custom AI Priority Rules State */
  const [customInstructions, setCustomInstructions] = useState(
    userSettings?.custom_priority_rules?.instructions ?? ""
  );
  const [vipSenders, setVipSenders] = useState<string[]>(
    userSettings?.custom_priority_rules?.vipSenders ?? []
  );
  const [ignoreKeywords, setIgnoreKeywords] = useState<string[]>(
    userSettings?.custom_priority_rules?.ignoreKeywords ?? []
  );
  const [vipInput, setVipInput] = useState("");
  const [ignoreInput, setIgnoreInput] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  /* Test WhatsApp delivery state */
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  /* Derived full international E.164 phone string */
  const fullWhatsappDestination = phoneNumber.trim() ? `${countryCode}${phoneNumber.trim()}` : "";

  /* Sync state whenever userSettings prop updates from server */
  useEffect(() => {
    if (userSettings) {
      setSavedDestination(userSettings.whatsapp_destination ?? null);
      const parsed = parseInitialPhone(userSettings.whatsapp_destination);
      setCountryCode(parsed.code);
      setPhoneNumber(parsed.number);
      if (userSettings.importance_threshold !== undefined) {
        setImportanceThreshold(userSettings.importance_threshold);
      }
      if (userSettings.raw_body_retention_days !== undefined) {
        setRetentionDays(userSettings.raw_body_retention_days);
      }
      if (userSettings.notify_on_important !== undefined) {
        setNotifyImportant(userSettings.notify_on_important);
      }
      if (userSettings.notify_on_failure !== undefined) {
        setNotifyFailures(userSettings.notify_on_failure);
      }
      if (userSettings.disable_processing !== undefined) {
        setDisableProcessing(userSettings.disable_processing);
      }
      if (userSettings.custom_priority_rules) {
        setCustomInstructions(userSettings.custom_priority_rules.instructions ?? "");
        setVipSenders(userSettings.custom_priority_rules.vipSenders ?? []);
        setIgnoreKeywords(userSettings.custom_priority_rules.ignoreKeywords ?? []);
      }
    }
  }, [userSettings]);

  function handleAddVipSender() {
    const trimmed = vipInput.trim().toLowerCase().replace(/^@/, "");
    if (!trimmed) return;
    if (!vipSenders.includes(trimmed)) {
      setVipSenders([...vipSenders, trimmed]);
    }
    setVipInput("");
  }

  function handleRemoveVipSender(target: string) {
    setVipSenders(vipSenders.filter((s) => s !== target));
  }

  function handleAddIgnoreKeyword() {
    const trimmed = ignoreInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!ignoreKeywords.includes(trimmed)) {
      setIgnoreKeywords([...ignoreKeywords, trimmed]);
    }
    setIgnoreInput("");
  }

  function handleRemoveIgnoreKeyword(target: string) {
    setIgnoreKeywords(ignoreKeywords.filter((k) => k !== target));
  }

  /* Sign out handler */
  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  /* Disconnect WhatsApp recipient */
  async function handleDisconnectWhatsApp() {
    setIsDisconnecting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("user_settings").upsert(
          {
            user_id: user.id,
            whatsapp_destination: null,
            importance_threshold: importanceThreshold,
            raw_body_retention_days: retentionDays,
            notification_preferences: {
              notify_on_important: notifyImportant,
              notify_on_failure: notifyFailures,
              disable_processing: disableProcessing,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }

      setSavedDestination(null);
      setPhoneNumber("");
      setTestResult(null);

      onUpdateUserSettings?.({
        importance_threshold: importanceThreshold,
        raw_body_retention_days: retentionDays,
        notify_on_important: notifyImportant,
        notify_on_failure: notifyFailures,
        whatsapp_destination: null,
        disable_processing: disableProcessing,
      });

      router.refresh();
    } catch (err) {
      console.error("Failed to disconnect WhatsApp:", err);
    } finally {
      setIsDisconnecting(false);
    }
  }

  /* Trigger confirmation dialog when user interacts with Ingestion-Only toggle */
  function handlePromptToggleProcessing(targetState: boolean) {
    setPendingProcessingState(targetState);
    setIsConfirmModalOpen(true);
  }

  /* Apply Ingestion-Only mode toggle after explicit user confirmation */
  async function handleConfirmToggleProcessing() {
    if (pendingProcessingState === null) return;
    setIsTogglingProcessing(true);
    const targetState = pendingProcessingState;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const rulesObj = {
          instructions: customInstructions.trim(),
          vipSenders,
          ignoreKeywords,
        };

        await supabase.from("user_settings").upsert(
          {
            user_id: user.id,
            whatsapp_destination: fullWhatsappDestination || null,
            importance_threshold: importanceThreshold,
            raw_body_retention_days: retentionDays,
            notification_preferences: {
              notify_on_important: notifyImportant,
              notify_on_failure: notifyFailures,
              disable_processing: targetState,
            },
            custom_priority_rules: rulesObj,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }

      setDisableProcessing(targetState);
      onUpdateUserSettings?.({
        importance_threshold: importanceThreshold,
        raw_body_retention_days: retentionDays,
        notify_on_important: notifyImportant,
        notify_on_failure: notifyFailures,
        whatsapp_destination: fullWhatsappDestination || null,
        custom_priority_rules: {
          instructions: customInstructions.trim(),
          vipSenders,
          ignoreKeywords,
        },
        disable_processing: targetState,
      });

      setIsConfirmModalOpen(false);
      setPendingProcessingState(null);
      router.refresh();
    } catch (err) {
      console.error("Failed to toggle ingestion-only mode:", err);
    } finally {
      setIsTogglingProcessing(false);
    }
  }

  /* Send Test WhatsApp Notification & Auto-Persist on Success */
  async function handleTestWhatsApp() {
    if (!phoneNumber.trim()) {
      setTestResult({ success: false, message: "Please enter your WhatsApp phone number first." });
      return;
    }

    setIsTestingWhatsApp(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationPhone: fullWhatsappDestination }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTestResult({ success: false, message: data.error || "Failed to send test message." });
      } else {
        setTestResult({ success: true, message: `Test alert sent to ${fullWhatsappDestination}!` });

        // Auto-save destination to Supabase so it immediately persists on refresh
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const rulesObj = {
            instructions: customInstructions.trim(),
            vipSenders,
            ignoreKeywords,
          };

          await supabase.from("user_settings").upsert(
            {
              user_id: user.id,
              whatsapp_destination: fullWhatsappDestination,
              importance_threshold: importanceThreshold,
              raw_body_retention_days: retentionDays,
              notification_preferences: {
                notify_on_important: notifyImportant,
                notify_on_failure: notifyFailures,
                disable_processing: disableProcessing,
              },
              custom_priority_rules: rulesObj,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

          setSavedDestination(fullWhatsappDestination);
          onUpdateUserSettings?.({
            importance_threshold: importanceThreshold,
            raw_body_retention_days: retentionDays,
            notify_on_important: notifyImportant,
            notify_on_failure: notifyFailures,
            whatsapp_destination: fullWhatsappDestination,
            custom_priority_rules: rulesObj,
            disable_processing: disableProcessing,
          });
          router.refresh();
        }
      }
    } catch (err: unknown) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setIsTestingWhatsApp(false);
    }
  }

  /* Save settings to user_settings table */
  async function handleSave() {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const rulesObj = {
        instructions: customInstructions.trim(),
        vipSenders,
        ignoreKeywords,
      };

      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          whatsapp_destination: fullWhatsappDestination || null,
          importance_threshold: importanceThreshold,
          raw_body_retention_days: retentionDays,
          notification_preferences: {
            notify_on_important: notifyImportant,
            notify_on_failure: notifyFailures,
            disable_processing: disableProcessing,
          },
          custom_priority_rules: rulesObj,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.error("Failed to save settings:", error);
        return;
      }

      setSavedDestination(fullWhatsappDestination || null);
      onUpdateUserSettings?.({
        importance_threshold: importanceThreshold,
        raw_body_retention_days: retentionDays,
        notify_on_important: notifyImportant,
        notify_on_failure: notifyFailures,
        whatsapp_destination: fullWhatsappDestination || null,
        custom_priority_rules: rulesObj,
        disable_processing: disableProcessing,
      });

      setSaveSuccess(true);
      router.refresh();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsSaving(false);
    }
  }

  /* User initials for avatar */
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className={ui.page}>
      {/* Header */}
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">PREFERENCES</p>
          <h1>Settings</h1>
          <p className="dashboard-subtitle">
            Manage your account, appearance, and notification preferences.
          </p>
        </div>
      </div>

      <nav className={ui.sectionNav} aria-label="Settings sections">
        {[
          ["settings-profile", "Profile"],
          ["settings-appearance", "Appearance"],
          ["settings-ingestion-only", "Ingestion Mode"],
          ["settings-preferences", "Processing"],
          ["settings-rules", "AI rules"],
          ["whatsapp-settings", "WhatsApp"],
          ["settings-notifications", "Notifications"],
        ].map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav>
      {/* Profile Card */}
      <div className="panel settings-section" id="settings-profile">
        <div className="settings-section-header">
          <User size={18} />
          <h2>Profile</h2>
        </div>
        <div className="profile-card-content">
          <div className="profile-avatar-large">{initials}</div>
          <div className="profile-info">
            <h3>{email}</h3>
            <p className="muted-text">Signed in via Supabase Auth</p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="panel settings-section" id="settings-appearance">
        <div className="settings-section-header">
          <Sun size={18} />
          <h2>Appearance</h2>
        </div>
        <div className="settings-row">
          <div className="settings-row-label">
            <strong>Theme</strong>
            <span>Choose between light and dark mode</span>
          </div>
          <div className="theme-toggle-group">
            <button
              aria-pressed={resolvedTheme === "light"}
              className={`theme-toggle-btn ${resolvedTheme === "light" ? "theme-toggle-active" : ""}`}
              onClick={() => setTheme("light")}
              type="button"
            >
              <Sun size={16} />
              Light
            </button>
            <button
              aria-pressed={resolvedTheme === "dark"}
              className={`theme-toggle-btn ${resolvedTheme === "dark" ? "theme-toggle-active" : ""}`}
              onClick={() => setTheme("dark")}
              type="button"
            >
              <Moon size={16} />
              Dark
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Section: Ingestion-Only Mode (Kill Switch) */}
      <div className="panel settings-section" id="settings-ingestion-only">
        <div className="settings-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <PowerOff size={18} />
            <h2>Ingestion-Only Mode</h2>
          </div>
          <span style={{
            fontSize: "11.5px",
            fontWeight: 650,
            padding: "3px 10px",
            borderRadius: "999px",
            background: disableProcessing ? "rgba(234, 179, 8, 0.12)" : "rgba(34, 197, 94, 0.12)",
            color: disableProcessing ? "#ca8a04" : "#16a34a",
            border: `1px solid ${disableProcessing ? "rgba(234, 179, 8, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
          }}>
            {disableProcessing ? "Ingestion-Only Active (AI & WhatsApp Paused)" : "Pipeline Active (AI & WhatsApp Live)"}
          </span>
        </div>

        <div className="settings-row" style={{ alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
          <div className="settings-row-label" style={{ maxWidth: "480px" }}>
            <strong>Pause AI Processing & WhatsApp Delivery</strong>
            <span>
              When enabled, Strike strictly ingests and stores incoming emails in your dashboard. Email filtration, noise reduction, AI summarization, and WhatsApp notifications are completely halted.
            </span>
          </div>
          <label className="settings-toggle" style={{ marginLeft: "auto" }}>
            <input
              aria-label="Toggle Ingestion-Only Mode"
              checked={disableProcessing}
              onChange={() => handlePromptToggleProcessing(!disableProcessing)}
              type="checkbox"
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        {/* Informational Callout */}
        <div style={{
          marginTop: "14px",
          padding: "14px 16px",
          borderRadius: "10px",
          background: disableProcessing ? "rgba(234, 179, 8, 0.08)" : "var(--surface-muted)",
          border: "1px solid var(--line)",
          fontSize: "12.5px",
          color: "var(--ink)",
          lineHeight: 1.55,
        }}>
          {disableProcessing ? (
            <div>
              <strong style={{ color: "#ca8a04" }}>⚡ Ingestion-Only Mode is currently ON:</strong>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)" }}>
                Incoming emails will be stored for dashboard viewing, but Gemini AI triage, executive summarization, and WhatsApp delivery are disabled. No WhatsApp messages will be sent to your phone.
              </p>
            </div>
          ) : (
            <div>
              <strong style={{ color: "var(--brand-plum)" }}>ℹ️ Normal Pipeline Operation:</strong>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)" }}>
                Incoming emails pass through noise reduction and single-pass AI triage. High-importance emails generate executive summaries and are dispatched to your WhatsApp in real time.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Processing Preferences */}
      <div className="panel settings-section" id="settings-preferences">
        <div className="settings-section-header">
          <Settings2 size={18} />
          <h2>Processing Preferences</h2>
        </div>

        {/* Importance Threshold Slider */}
        <div className="settings-row">
          <div className="settings-row-label">
            <strong>Importance threshold</strong>
            <span>Emails scored above this will be flagged as important</span>
          </div>
          <div className="settings-slider-group">
            <input
              aria-label="Importance threshold"
              className="settings-slider"
              max="1"
              min="0"
              onChange={(e) => setImportanceThreshold(parseFloat(e.target.value))}
              step="0.05"
              type="range"
              value={importanceThreshold}
            />
            <span className="settings-slider-value">{(importanceThreshold * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className={ui.policyPreview}>
          <span className={ui.overline}>YOUR PRIORITY LENS</span>
          <div className={ui.policyScale}><i style={{ width: `${importanceThreshold * 100}%` }} /><span style={{ left: `${importanceThreshold * 100}%` }} /></div>
          <div className={ui.policyLabels}><span>More inclusive</span><strong>{(importanceThreshold * 100).toFixed(0)}% threshold</strong><span>More selective</span></div>
          <p>{importanceThreshold < .4 ? "A broader range of emails can qualify for priority attention." : importanceThreshold < .75 ? "Keep a balanced focus on emails with stronger importance signals." : "Focus on emails with the strongest importance scores."} Your VIP and custom rules also inform triage.</p>
        </div>
        {/* Retention Days */}
        <div className="settings-row">
          <div className="settings-row-label">
            <strong>Raw body retention</strong>
            <span>How many days to keep raw email body data</span>
          </div>
          <div className="settings-input-group">
            <input
              aria-label="Raw body retention in days"
              className="settings-number-input"
              max="365"
              min="1"
              onChange={(e) => setRetentionDays(parseInt(e.target.value, 10) || 30)}
              type="number"
              value={retentionDays}
            />
            <span>days</span>
          </div>
        </div>
      </div>

      {/* Custom AI Triage & Priority Rules */}
      <div className="panel settings-section" id="settings-rules">
        <div className="settings-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sliders size={18} />
            <h2>AI Triage & Priority Rules</h2>
          </div>
          <span style={{
            fontSize: "11.5px",
            fontWeight: 650,
            padding: "3px 10px",
            borderRadius: "999px",
            background: "rgba(80, 45, 85, 0.08)",
            color: "var(--brand-plum)",
            border: "1px solid var(--line)",
          }}>
            Active in AI Pipeline
          </span>
        </div>

        <p style={{ fontSize: "13px", color: "var(--muted)", margin: "4px 0 16px 0", lineHeight: 1.5 }}>
          Personalize the AI classifier to your exact workflow. These rules are injected directly into Gemini & OpenAI triage prompts.
        </p>

        {/* 1. Custom Prompt Guidance */}
        <div className="settings-row" style={{ alignItems: "flex-start", borderBottom: "1px solid var(--line)", paddingBottom: "18px" }}>
          <div className="settings-row-label" style={{ maxWidth: "340px" }}>
            <strong>Custom Prompt Guidance</strong>
            <span>Describe what emails are high priority vs. low priority in your own words.</span>
          </div>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <textarea
              className="text-input"
              rows={3}
              placeholder="E.g., Prioritize customer bug reports, security advisories, billing invoices, and critical system alerts. Deprioritize marketing newsletters, product announcements, and social updates."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              style={{
                width: "100%",
                background: "var(--surface-muted)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "13.5px",
                lineHeight: 1.45,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* 2. VIP Senders & Domains */}
        <div className="settings-row" style={{ alignItems: "flex-start", borderBottom: "1px solid var(--line)", paddingBottom: "18px" }}>
          <div className="settings-row-label" style={{ maxWidth: "340px" }}>
            <strong>VIP Senders & Domains</strong>
            <span>Senders or domains (e.g. boss@company.com, stripe.com, google.com) always marked Important.</span>
          </div>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. client@domain.com or stripe.com"
                value={vipInput}
                onChange={(e) => setVipInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddVipSender();
                  }
                }}
                style={{
                  flex: 1,
                  background: "var(--surface-muted)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "13.5px",
                  height: "38px",
                }}
              />
              <button
                type="button"
                onClick={handleAddVipSender}
                disabled={!vipInput.trim()}
                className="secondary-button"
                style={{
                  height: "38px",
                  padding: "0 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  borderRadius: "10px",
                  cursor: !vipInput.trim() ? "not-allowed" : "pointer",
                }}
              >
                <Plus size={14} />
                <span>Add VIP</span>
              </button>
            </div>

            {/* VIP Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {vipSenders.length > 0 ? (
                vipSenders.map((vip) => (
                  <span
                    key={vip}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      background: "rgba(34, 197, 94, 0.12)",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      color: "var(--ink)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    <Tag size={11} style={{ color: "#16a34a" }} />
                    <span>{vip}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVipSender(vip)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title={`Remove ${vip}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              ) : (
                <span style={{ fontSize: "12px", color: "var(--muted-light)", fontStyle: "italic" }}>
                  No VIP senders added yet.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Ignore & Low-Priority Keywords */}
        <div className="settings-row" style={{ alignItems: "flex-start" }}>
          <div className="settings-row-label" style={{ maxWidth: "340px" }}>
            <strong>Ignore / Low Priority Keywords</strong>
            <span>Emails with these subject words (e.g. webinar, newsletter, digest) will be deprioritized.</span>
          </div>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. newsletter, webinar, digest"
                value={ignoreInput}
                onChange={(e) => setIgnoreInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddIgnoreKeyword();
                  }
                }}
                style={{
                  flex: 1,
                  background: "var(--surface-muted)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "13.5px",
                  height: "38px",
                }}
              />
              <button
                type="button"
                onClick={handleAddIgnoreKeyword}
                disabled={!ignoreInput.trim()}
                className="secondary-button"
                style={{
                  height: "38px",
                  padding: "0 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  borderRadius: "10px",
                  cursor: !ignoreInput.trim() ? "not-allowed" : "pointer",
                }}
              >
                <Plus size={14} />
                <span>Add Keyword</span>
              </button>
            </div>

            {/* Ignore Keyword Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {ignoreKeywords.length > 0 ? (
                ignoreKeywords.map((kw) => (
                  <span
                    key={kw}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      color: "var(--ink)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    <Tag size={11} style={{ color: "#ef4444" }} />
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveIgnoreKeyword(kw)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title={`Remove ${kw}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              ) : (
                <span style={{ fontSize: "12px", color: "var(--muted-light)", fontStyle: "italic" }}>
                  No ignore keywords added yet.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Delivery Configuration */}
      <div className="panel settings-section" id="whatsapp-settings">
        <div className="settings-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <MessageSquare size={18} />
            <h2>WhatsApp Instant Delivery</h2>
          </div>
          <span style={{
            fontSize: "11.5px",
            fontWeight: 650,
            padding: "3px 10px",
            borderRadius: "999px",
            background: "var(--surface-muted)",
            color: "var(--muted)",
            border: "1px solid var(--line)",
          }}>
            1 Active Recipient Allowed
          </span>
        </div>

        {/* Active Connected Number Status Card */}
        {savedDestination ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderRadius: "10px",
            background: "rgba(34, 197, 94, 0.08)",
            border: "1px solid rgba(34, 197, 94, 0.25)",
            marginTop: "14px",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "rgba(34, 197, 94, 0.2)",
                color: "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                  Connected Recipient: <span style={{ color: "#16a34a", fontFamily: "var(--font-mono, monospace)" }}>{savedDestination}</span>
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                  Automated AI email triage and priority briefs are actively delivered to this number.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDisconnectWhatsApp}
              disabled={isDisconnecting}
              className="secondary-button danger-button"
              style={{
                fontSize: "12px",
                height: "32px",
                padding: "0 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                margin: 0,
              }}
              title="Remove this WhatsApp number from receiving alerts"
            >
              <Trash2 size={13} />
              <span>{isDisconnecting ? "Disconnecting…" : "Disconnect Number"}</span>
            </button>
          </div>
        ) : (
          <div style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "rgba(80, 45, 85, 0.05)",
            border: "1px solid var(--line)",
            marginTop: "14px",
            marginBottom: "16px",
            fontSize: "12.5px",
            color: "var(--muted)",
          }}>
            ⚪ <strong>No active WhatsApp recipient configured.</strong> Enter your number below to receive instant AI email summaries.
          </div>
        )}

        {/* Number Input / Change Row */}
        <div className="settings-row">
          <div className="settings-row-label">
            <strong>{savedDestination ? "Change Recipient Number" : "Recipient Mobile Number"}</strong>
            <span>Select country code and enter your WhatsApp mobile number</span>
          </div>
          <div className="settings-input-group" style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", width: "100%", maxWidth: "520px" }}>
            {/* Country code selector */}
            <select
              aria-label="Country Code"
              className="text-input"
              onChange={(e) => setCountryCode(e.target.value)}
              value={countryCode}
              style={{
                background: "var(--surface-muted)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                borderRadius: "10px",
                padding: "8px 10px",
                fontSize: "14px",
                height: "40px",
                minWidth: "120px",
                maxWidth: "140px",
                cursor: "pointer",
              }}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code + c.label} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>

            {/* Local phone number input */}
            <input
              aria-label="WhatsApp Phone Number"
              className="text-input"
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="9876543210"
              style={{
                background: "var(--surface-muted)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                borderRadius: "10px",
                padding: "8px 12px",
                fontSize: "14px",
                flex: "1 1 150px",
                minWidth: "130px",
                height: "40px",
                minHeight: "40px",
                boxSizing: "border-box",
              }}
              type="tel"
              value={phoneNumber}
            />

            {/* Connect & Send Welcome Brief Button */}
            <button
              className="secondary-button"
              disabled={isTestingWhatsApp || !phoneNumber.trim()}
              onClick={handleTestWhatsApp}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "0 16px",
                fontSize: "13px",
                fontWeight: 600,
                borderRadius: "10px",
                height: "40px",
                minHeight: "40px",
                margin: 0,
                cursor: isTestingWhatsApp || !phoneNumber.trim() ? "not-allowed" : "pointer",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
              type="button"
              title="Send Welcome Onboarding Brief to your WhatsApp and connect"
            >
              <Send size={13} />
              <span>{isTestingWhatsApp ? "Sending Brief…" : "Send Welcome Brief"}</span>
            </button>
          </div>
        </div>

        {/* Display live formatted destination preview if filled */}
        {fullWhatsappDestination && (
          <div style={{ marginTop: "-6px", marginBottom: "12px", fontSize: "12px", color: "var(--muted)" }}>
            Format: <code style={{ color: "var(--brand-plum)", fontWeight: 600 }}>{fullWhatsappDestination}</code>
          </div>
        )}

        {/* Test Result Message */}
        {testResult && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              background: testResult.success ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: testResult.success ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
              color: testResult.success ? "#22c55e" : "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "14px",
            }}
          >
            {testResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Automated WhatsApp Onboarding & Daily Intelligence Guide */}
        <div style={{
          marginTop: "16px",
          padding: "16px 18px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, rgba(80, 45, 85, 0.06) 0%, rgba(147, 80, 115, 0.03) 100%)",
          border: "1px solid var(--line)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Sparkles size={16} style={{ color: "var(--brand-plum)" }} />
            <strong style={{ fontSize: "13px", color: "var(--ink)" }}>
              Zero-Friction WhatsApp Onboarding & Daily Sync
            </strong>
          </div>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 10px 0", lineHeight: 1.5 }}>
            Strike delivers AI email triage directly to your WhatsApp using official Meta Utility Templates — no manual &quot;Hi&quot; messages needed.
          </p>
          <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "12.5px", color: "var(--ink)", lineHeight: 1.6 }}>
            <li style={{ marginBottom: "6px" }}>
              <strong>Enter your number:</strong> Select your country code and enter your WhatsApp mobile number above.
            </li>
            <li style={{ marginBottom: "6px" }}>
              <strong>Send Welcome Brief:</strong> Click <strong>&quot;Send Welcome Brief&quot;</strong> to receive an interactive walkthrough message directly on WhatsApp with quick-reply action buttons.
            </li>
            <li>
              <strong>Daily 7:00 AM Briefing:</strong> Strike automatically delivers your morning inbox intelligence every day at 7:00 AM with one-tap actions to keep your briefing stream active.
            </li>
          </ol>
        </div>
      </div>

      {/* Notifications */}
      <div className="panel settings-section" id="settings-notifications">
        <div className="settings-section-header">
          <Shield size={18} />
          <h2>Notifications</h2>
        </div>
        <div className="settings-row">
          <div className="settings-row-label">
            <strong>Important emails</strong>
            <span>Get notified when an email is flagged as important</span>
          </div>
          <label className="settings-toggle">
            <input
              aria-label="Notify me about important emails"
              checked={notifyImportant}
              onChange={(e) => setNotifyImportant(e.target.checked)}
              type="checkbox"
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>
        <div className="settings-row">
          <div className="settings-row-label">
            <strong>Processing failures</strong>
            <span>Get notified when a processing job fails</span>
          </div>
          <label className="settings-toggle">
            <input
              aria-label="Notify me about processing failures"
              checked={notifyFailures}
              onChange={(e) => setNotifyFailures(e.target.checked)}
              type="checkbox"
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className={`settings-save-row ${ui.saveDock}`}>
        <div><strong>Your workspace, your way.</strong><span>Save to apply your processing and notification preferences.</span></div>
        <button
          className="primary-button"
          disabled={isSaving}
          onClick={handleSave}
          type="button"
        >
          {isSaving ? "Saving…" : saveSuccess ? "✓ Saved" : "Save preferences"}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="panel settings-section settings-danger-section">
        <div className="settings-section-header">
          <Trash2 size={18} />
          <h2>Danger Zone</h2>
        </div>
        <div className="settings-row">
          <div className="settings-row-label">
            <strong>Sign out</strong>
            <span>Sign out of your Strike workspace</span>
          </div>
          <button
            className="secondary-button danger-button"
            disabled={isSigningOut}
            onClick={handleSignOut}
            type="button"
          >
            <LogOut size={14} />
            <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Ingestion-Only Mode Toggle */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        title={
          pendingProcessingState
            ? "Pause AI Processing & WhatsApp Delivery?"
            : "Resume AI Processing & WhatsApp Delivery?"
        }
        description={
          pendingProcessingState
            ? "This will disable all email filtration, noise reduction, AI summarization, and WhatsApp notifications. Strike will only ingest and store messages in your dashboard. Are you sure you want to proceed?"
            : "This will re-enable email noise reduction, AI triage scoring, executive summarization, and real-time WhatsApp notifications for important emails. Are you sure you want to resume?"
        }
        confirmLabel={pendingProcessingState ? "Yes, Pause Processing" : "Yes, Resume"}
        cancelLabel={pendingProcessingState ? "No, Keep Active" : "No, Keep Paused"}
        isDestructive={pendingProcessingState ?? false}
        isLoading={isTogglingProcessing}
        onConfirm={handleConfirmToggleProcessing}
        onClose={() => setIsConfirmModalOpen(false)}
      />
    </div>
  );
}
