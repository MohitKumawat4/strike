"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Moon,
  Settings2,
  Shield,
  Sun,
  Trash2,
  User,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/database/supabase/browser";
import type { UserSettings } from "../dashboard-shell";

type SettingsTabProps = {
  email: string;
  userSettings: UserSettings | null;
};

export function SettingsTab({ email, userSettings }: SettingsTabProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  /* Form state initialized from persisted settings or defaults */
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /* Sign out handler */
  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  /* Save settings to user_settings table */
  async function handleSave() {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          importance_threshold: importanceThreshold,
          raw_body_retention_days: retentionDays,
          notify_on_important: notifyImportant,
          notify_on_failure: notifyFailures,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      setSaveSuccess(true);
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
    <>
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

      {/* Profile Card */}
      <div className="panel settings-section">
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
      <div className="panel settings-section">
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
              className={`theme-toggle-btn ${resolvedTheme === "light" ? "theme-toggle-active" : ""}`}
              onClick={() => setTheme("light")}
              type="button"
            >
              <Sun size={16} />
              Light
            </button>
            <button
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

      {/* Processing Preferences */}
      <div className="panel settings-section">
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

        {/* Retention Days */}
        <div className="settings-row">
          <div className="settings-row-label">
            <strong>Raw body retention</strong>
            <span>How many days to keep raw email body data</span>
          </div>
          <div className="settings-input-group">
            <input
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

      {/* Notifications */}
      <div className="panel settings-section">
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
              checked={notifyFailures}
              onChange={(e) => setNotifyFailures(e.target.checked)}
              type="checkbox"
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="settings-save-row">
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
    </>
  );
}
